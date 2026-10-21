/* The store over the CRM's REST API (server/, /api/v1/ on the same address as the page): used on localhost and in the
 * cloud, where there is no claude.ai database. The API has no change stream, so the customers are polled with
 * If-None-Match (an unchanged list costs a 304) and asked for at once after every own write. */
import type {CustomerDoc, Store} from './store';

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;
export interface RestOptions {
  /** fetch, or undefined where there is none (then there is no store) */
  fetch?: Fetch;
  /** where the API is */
  base?: string;
  /** milliseconds between polls */
  interval?: number;
}

/** A refused request: code and message from the API's error format ({error: {code, message}}) */
export class ApiRequestError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) { super(message); }
}

const defaultFetch = (): Fetch | undefined => (typeof fetch === 'function' ? (url, init) => fetch(url, init) : undefined);

/* Returns the store, or null when no API answers on /health (e.g. the page is opened as a file). */
export async function createRestStore({fetch: doFetch = defaultFetch(), base = '/api/v1', interval = 10000}: RestOptions = {}): Promise<Store | null> {
  if (!doFetch) return null;
  try {
    const res = await doFetch(`${base}/health`);
    if (!res.ok || (await res.json() as {api?: string}).api !== 'v1') return null;
  } catch {
    return null;
  }

  async function call(method: string, path: string, body?: unknown): Promise<unknown> {
    const init: RequestInit = body === undefined
      ? {method, headers: {}}
      : {method, headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)};
    const res = await doFetch!(`${base}${path}`, init);
    if (!res.ok) {
      const error = await res.json().catch(() => null) as {error?: {code?: string; message?: string}} | null;
      throw new ApiRequestError(res.status, error?.error?.code ?? 'http_error', error?.error?.message ?? `HTTP ${res.status}`);
    }
    return res.status === 204 ? null : res.json();
  }

  // Everyone watching the customers is asked again at once after a write
  const refreshers = new Set<() => void>();
  const written = <T>(result: T) => { refreshers.forEach(r => r()); return result; };

  /* Calls poll() now and then every `interval` ms until stopped; refresh() polls at once */
  function every(poll: () => Promise<void>, register = false) {
    let stopped = false, timer: ReturnType<typeof setTimeout> | undefined, running = false, again = false;
    const run = async () => {
      if (stopped) return;
      if (running) { again = true; return; }
      clearTimeout(timer);
      running = true;
      try { await poll(); } finally { running = false; }
      if (stopped) return;
      if (again) { again = false; void run(); return; }
      timer = setTimeout(run, interval);
    };
    if (register) refreshers.add(run);
    void run();
    return () => { stopped = true; clearTimeout(timer); refreshers.delete(run); };
  }

  return {
    canWrite: true,
    watchCustomers(next, fail) {
      let tag = '', last: CustomerDoc[] = [], failed = false;
      return every(async () => {
        try {
          const res = await doFetch!(`${base}/customers`, {headers: tag ? {'If-None-Match': tag} : {}});
          if (res.status === 304) { if (failed) { failed = false; next(last); } return; }
          if (!res.ok) throw new ApiRequestError(res.status, 'http_error', `HTTP ${res.status}`);
          last = await res.json() as CustomerDoc[];
          tag = res.headers.get('ETag') ?? '';
          failed = false;
          next(last);
        } catch (e) {
          failed = true;
          fail(e);
        }
      }, true);
    },
    watchBusy(next) {
      // A missing or broken sync/busy must never stop the rest of the app
      return every(async () => {
        try {
          const res = await doFetch!(`${base}/sync/busy`);
          const doc = res.ok ? await res.json() as {items?: unknown} : null;
          next(doc && Array.isArray(doc.items) ? doc.items as BusyItem[] : null);
        } catch {
          next(null);
        }
      });
    },
    watchIntegrations(next, fail) {
      // The list is polled like the customers and asked for at once after a run or a switch; 404 = no plugins here
      return every(async () => {
        try {
          const res = await doFetch!(`${base}/integrations`);
          if (res.status === 404) { next(null); return; }
          if (!res.ok) throw new ApiRequestError(res.status, 'http_error', `HTTP ${res.status}`);
          next(await res.json() as IntegrationInfo[]);
        } catch (e) {
          fail(e);
        }
      }, true);
    },
    async runIntegration(id) {
      return written(await call('POST', `/integrations/${encodeURIComponent(id)}/run`, {}) as IntegrationRun);
    },
    async setIntegrationEnabled(id, enabled) {
      written(await call('PUT', `/integrations/${encodeURIComponent(id)}`, {enabled}));
    },
    async createCustomer(data) {
      return written(((await call('POST', '/customers', data)) as {id: string}).id);
    },
    async updateCustomer(id, patch) {
      written(await call('PATCH', `/customers/${encodeURIComponent(id)}`, patch));
    },
    async deleteCustomer(id) {
      written(await call('DELETE', `/customers/${encodeURIComponent(id)}`));
    },
    async skipCustomer(key, data) {
      await call('PUT', `/skipped/${encodeURIComponent(key)}`, data);
    }
  };
}
