/* The API on Cloudflare Workers with D1. The app's files are served by Workers Static Assets on the same domain (they
 * are answered before the Worker is called), so the Worker only sees /api/. The brand comes from the variable BRAND
 * (brand.json as text, written by tools/cloudflare.js).
 * Login: Cloudflare Access (ACCESS_TEAM_DOMAIN and ACCESS_AUD); every request needs a valid Access token. Without those
 * settings the Worker only answers local requests (wrangler dev) and refuses everything else with 503, so a Worker
 * published without Access never opens the register to the internet. A request is local when its address is localhost,
 * or when CF-Connecting-IP is a loopback address: wrangler dev sets it to 127.0.0.1 (also when it rewrites the address
 * to a route's domain), and Cloudflare always replaces it with the real client's address, which is never loopback. */
import {setBrand} from '../../crm/logic/brand';
import {accessCheck, type AccessConfig} from './access';
import {createApp, LOCAL_HOSTS} from './app';
import {openD1, type D1Like} from './d1';
import {ApiError} from './errors';

export interface WorkerEnv { DB: D1Like; BRAND?: string; ACCESS_TEAM_DOMAIN?: string; ACCESS_AUD?: string }

const isLoopback = (ip: string) => ip === '::1' || /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip);

/* The Worker; options are for the tests (the clock and the Access keys) */
export function createWorker(options: Pick<AccessConfig, 'now' | 'fetchKeys'> = {}) {
  // One app per environment (in Cloudflare: once per Worker instance): the brand and the database with any missing migrations
  const apps = new WeakMap<WorkerEnv, Promise<ReturnType<typeof createApp>>>();
  const appFor = (env: WorkerEnv) => {
    let app = apps.get(env);
    if (!app) {
      app = (async () => {
        setBrand(env.BRAND ? JSON.parse(env.BRAND) as Brand : null);
        const auth = env.ACCESS_TEAM_DOMAIN && env.ACCESS_AUD
          ? accessCheck({teamDomain: env.ACCESS_TEAM_DOMAIN, aud: env.ACCESS_AUD, ...options})
          : notConfigured;
        return createApp({db: await openD1(env.DB), auth});
      })();
      apps.set(env, app);
    }
    return app;
  };
  return {
    async fetch(request: Request, env: WorkerEnv): Promise<Response> {
      return (await appFor(env)).fetch(request);
    }
  };
}

const notConfigured: Parameters<typeof createApp>[0]['auth'] = async (c, next) => {
  if (!LOCAL_HOSTS.has(new URL(c.req.url).hostname) && !isLoopback(c.req.header('CF-Connecting-IP') ?? '')) throw new ApiError(503, 'access_not_configured', 'Cloudflare Access is not set up for this Worker');
  await next();
};

export default createWorker();
