/* The REST API as a Hono app. It does not know where it runs: node.ts (local server, SQLite) and worker.ts
 * (Cloudflare, D1) give it a database. All paths are under /api/v1/. */
import {Hono} from 'hono';
import type {MiddlewareHandler} from 'hono';
import type {Db} from './db';
import {calendarRoutes} from './calendar';
import {skippedRoutes, syncRoutes} from './collections';
import {customerRoutes} from './customers';
import {ApiError, errorResponse} from './errors';
import {listRoutes} from './lists';
import {mcpRoutes, type ApiCall} from './mcp';
import {transferRoutes} from './transfer';

export const API_VERSION = 'v1';
/** Largest request body; an import (a whole register) may be larger */
export const MAX_BODY = 1024 * 1024;
export const MAX_IMPORT = 32 * 1024 * 1024;
/** The addresses of a request from the same computer */
export const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);
const WRITES = new Set(['POST', 'PUT', 'PATCH']);

export interface AppOptions {
  db: Db;
  /** The local server: only answers when Host is localhost or 127.0.0.1 (protection against DNS rebinding) */
  local?: boolean;
  /** Serves the app's files outside /api/ (the local server with npm run serve) */
  assets?: MiddlewareHandler;
  /** Login, checked before every API route (the Worker: Cloudflare Access) */
  auth?: MiddlewareHandler;
  /** The MCP endpoint /api/v1/mcp (default on; off for the API the MCP tools call themselves) */
  mcp?: boolean;
}

export type Env = {Variables: {body: unknown}};

export function createApp({db, local = false, assets, auth, mcp = true}: AppOptions) {
  const app = new Hono<Env>();

  app.onError((err, c) => {
    if (err instanceof ApiError) return errorResponse(c, err);
    // Only the kind of error and the path: a message may contain customer data (design rule 9)
    console.error(`[api] internal error (${err.name}) on ${c.req.method} ${c.req.routePath}`);
    return errorResponse(c, new ApiError(500, 'internal', 'Internal server error'));
  });
  app.notFound(c => errorResponse(c, new ApiError(404, 'not_found', 'Not found')));

  // The local protections: localhost only, JSON only. No CORS headers are ever sent, so other origins cannot read the answers.
  app.use('*', async (c, next) => {
    if (local && !LOCAL_HOSTS.has(new URL(c.req.url).hostname)) throw new ApiError(403, 'forbidden_host', 'Only localhost may call the local server');
    if (WRITES.has(c.req.method)) {
      // A form on another web page can only send form or text bodies; requiring JSON stops it from writing
      if (!/^application\/json\b/i.test(c.req.header('Content-Type') ?? '')) {
        throw new ApiError(415, 'unsupported_media_type', 'The body must be JSON (Content-Type: application/json)');
      }
      const max = c.req.path === `/api/${API_VERSION}/import` ? MAX_IMPORT : MAX_BODY;
      if (Number(c.req.header('Content-Length') ?? 0) > max) throw tooLarge(max);
      const text = await c.req.text();
      if (new TextEncoder().encode(text).length > max) throw tooLarge(max);
      try { c.set('body', JSON.parse(text)); } catch { throw new ApiError(400, 'invalid_json', 'The body is not valid JSON'); }
    }
    await next();
  });

  const api = new Hono<Env>();
  if (auth) api.use('*', auth);
  api.get('/health', async c => c.json({api: API_VERSION, schema: await db.schemaVersion()}));
  api.route('/customers', customerRoutes(db));
  api.route('/customers', listRoutes(db));
  api.route('/skipped', skippedRoutes(db));
  api.route('/sync', syncRoutes(db));
  api.route('/calendar', calendarRoutes(db));
  api.route('/', transferRoutes(db));
  // The MCP tools call the same API, inside the server, after the caller has passed the protections above
  if (mcp) api.route('/mcp', mcpRoutes(innerApi(db)));
  app.route(`/api/${API_VERSION}`, api);
  if (assets) app.get('*', (c, next) => (c.req.path.startsWith('/api/') ? next() : assets(c, next)));

  return app;
}

/* The API as a function, for the MCP tools: the same routes without the outer protections (already passed) */
function innerApi(db: Db): ApiCall {
  let inner: ReturnType<typeof createApp> | null = null;
  return async (method, path, body, version) => {
    inner ??= createApp({db, mcp: false});
    const headers: Record<string, string> = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (version !== undefined) headers['If-Match'] = `"${version}"`;
    const res = await inner.request(`/api/${API_VERSION}${path}`, {method, headers, body: body === undefined ? undefined : JSON.stringify(body)});
    const tag = /^"(\d+)"$/.exec(res.headers.get('ETag') ?? '');
    return {status: res.status, body: res.status === 204 ? null : await res.json(), version: tag ? Number(tag[1]) : undefined};
  };
}

const tooLarge = (max: number) => new ApiError(413, 'too_large', `The body is larger than ${max} bytes`);

