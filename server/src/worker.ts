/* The API on Cloudflare Workers with D1. The app's files are served by Workers Static Assets on the same domain (they
 * are answered before the Worker is called), so the Worker only sees /api/. The brand comes from the variable BRAND
 * (brand.json as text, written by tools/cloudflare.js).
 * Login: Cloudflare Access (ACCESS_TEAM_DOMAIN and ACCESS_AUD); every request needs a valid Access token. Without those
 * settings the Worker only answers local requests (wrangler dev) and refuses everything else with 503, so a Worker
 * published without Access never opens the register to the internet. A request is local when its address is localhost,
 * or when CF-Connecting-IP is a loopback address: wrangler dev sets it to 127.0.0.1 (also when it rewrites the address
 * to a route's domain), and Cloudflare always replaces it with the real client's address, which is never loopback.
 * Integration plugins: tools/cloudflare.js builds the company's plugins in (integrations in cloudflare.json) and gives
 * each its schedule as a Cron Trigger. On its schedule a plugin runs with tools/integration-core.js, the same code as
 * npm run integration --apply, and its plan is written with the API inside the Worker (no request from outside can
 * reach that path). The result is kept in sync/integrations; the log only gets the plugin's id and counts. */
import {setBrand} from '../../crm/logic/brand';
import {validateCustomer} from '../../crm/logic/validate';
import type {IntegrationCall} from '../../tools/integration-core.js';
import {accessCheck, type AccessConfig} from './access';
import {createApp, innerApi, LOCAL_HOSTS} from './app';
import {openD1, type D1Like} from './d1';
import {ApiError} from './errors';
import {createIntegrations, type BuiltInIntegration, type Integrations} from './integrations';

/** The Worker's bindings and variables; a plugin's secrets (wrangler secret put) are among the rest */
export interface WorkerEnv { DB: D1Like; BRAND?: string; ACCESS_TEAM_DOMAIN?: string; ACCESS_AUD?: string; [name: string]: unknown }
/** A plugin built into the Worker, its settings.json and its schedule (cron, UTC) */
export type WorkerIntegration = BuiltInIntegration;

const isLoopback = (ip: string) => ip === '::1' || /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip);

/* The Worker; integrations are the built-in plugins, the other options are for the tests (the clocks and the Access keys) */
export function createWorker({integrations = [], clock = () => new Date(), ...options}:
  Pick<AccessConfig, 'now' | 'fetchKeys'> & {integrations?: WorkerIntegration[]; clock?: () => Date} = {}) {
  // One app per environment (in Cloudflare: once per Worker instance): the brand and the database with any missing migrations
  const apps = new WeakMap<WorkerEnv, Promise<{app: ReturnType<typeof createApp>; plugins: Integrations | undefined}>>();
  const appFor = (env: WorkerEnv) => {
    let app = apps.get(env);
    if (!app) {
      app = (async () => {
        setBrand(env.BRAND ? JSON.parse(env.BRAND) as Brand : null);
        const auth = env.ACCESS_TEAM_DOMAIN && env.ACCESS_AUD
          ? accessCheck({teamDomain: env.ACCESS_TEAM_DOMAIN, aud: env.ACCESS_AUD, ...options})
          : notConfigured;
        const db = await openD1(env.DB);
        const api = innerApi(db);
        const call: IntegrationCall = async (method, path, body, version) => {
          const r = await api(method, path, body, version);
          return {status: r.status, data: r.body, version: r.version};
        };
        const vars = Object.fromEntries(Object.entries(env).filter((e): e is [string, string] => typeof e[1] === 'string'));
        const plugins = integrations.length ? createIntegrations({integrations, call, env: vars, clock, validateCustomer}) : undefined;
        return {app: createApp({db, auth, integrations: plugins}), plugins};
      })();
      apps.set(env, app);
    }
    return app;
  };
  return {
    async fetch(request: Request, env: WorkerEnv): Promise<Response> {
      return (await appFor(env)).app.fetch(request);
    },
    /** A Cron Trigger: runs the plugins with this schedule, one after the other; one that fails does not stop the next */
    async scheduled(event: {cron: string}, env: WorkerEnv): Promise<void> {
      const {plugins} = await appFor(env);
      if (plugins) await plugins.runDue(event.cron);
    }
  };
}

const notConfigured: Parameters<typeof createApp>[0]['auth'] = async (c, next) => {
  if (!LOCAL_HOSTS.has(new URL(c.req.url).hostname) && !isLoopback(c.req.header('CF-Connecting-IP') ?? '')) throw new ApiError(503, 'access_not_configured', 'Cloudflare Access is not set up for this Worker');
  await next();
};

export default createWorker();
