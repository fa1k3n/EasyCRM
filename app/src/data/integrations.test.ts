/* The integration plugins in the data layer: over the REST API (the list polled like the customers, run now, switch
 * off and on) and in the artifact database, where there are none. All data is made up. */
import {fakeClaude} from '../../test/fakeDb';
import {createArtifactStore} from './artifactStore';
import {ApiRequestError, createRestStore} from './restStore';

const LIST = [{id: 'test-invoices', name: 'Testfakturor', cron: '0 5 * * *', enabled: true, failures: 0, lastRun: null}];
const reply = (status: number, body?: unknown) => ({ok: status < 400, status, headers: {get: () => null}, json: async () => body}) as unknown as Response;
const settle = async () => { for (let i = 0; i < 4; i++) await new Promise(r => setTimeout(r, 0)); };

// A fake API with /integrations; calls records the requests
function api(answer: (method: string, path: string, body?: unknown) => Response) {
  const calls: string[] = [];
  const fetch = async (url: string, init: RequestInit = {}) => {
    const path = url.replace(/^\/api\/v1/, ''), method = init.method ?? 'GET';
    if (path === '/health') return reply(200, {api: 'v1', schema: 1});
    if (path === '/customers') return reply(200, []);
    calls.push(`${method} ${path}`);
    return answer(method, path, init.body ? JSON.parse(String(init.body)) : undefined);
  };
  return {fetch: fetch as typeof globalThis.fetch, calls};
}
async function watch(fetch: typeof globalThis.fetch) {
  const store = (await createRestStore({fetch, interval: 60000}))!;
  const seen: (IntegrationInfo[] | null)[] = [], errors: unknown[] = [];
  const stop = store.watchIntegrations(r => seen.push(r), e => errors.push(e));
  await settle();
  return {store, seen, errors, stop};
}

describe('integrations over the REST API', () => {
  test('the list of built-in plugins', async () => {
    const w = await watch(api(() => reply(200, LIST)).fetch);
    w.stop();
    expect(w.seen).toEqual([LIST]);
  });
  test('an API without plugins (404, the local server): null, integrations do not run here', async () => {
    const w = await watch(api(() => reply(404, {error: {code: 'not_found'}})).fetch);
    w.stop();
    expect(w.seen).toEqual([null]);
  });
  test('a server error or a lost connection is an error', async () => {
    const w = await watch(api(() => reply(500, {error: {code: 'internal'}})).fetch);
    w.stop();
    expect([w.seen, w.errors.length]).toEqual([[], 1]);
  });
  test('run now and switching off call the API and ask for the list again', async () => {
    const a = api((method, path) => (method === 'POST' ? reply(200, {ok: true, trigger: 'manual'}) : method === 'PUT' ? reply(200, {...LIST[0], enabled: false}) : reply(200, LIST)));
    const w = await watch(a.fetch);
    expect(await w.store.runIntegration('test-invoices')).toEqual({ok: true, trigger: 'manual'});
    await w.store.setIntegrationEnabled('test-invoices', false);
    await settle();
    w.stop();
    expect(a.calls).toEqual(['GET /integrations', 'POST /integrations/test-invoices/run', 'GET /integrations', 'PUT /integrations/test-invoices', 'GET /integrations']);
  });
  test('a refusal keeps the API\'s code (e.g. too_many_runs)', async () => {
    const w = await watch(api(method => (method === 'POST' ? reply(429, {error: {code: 'too_many_runs', message: 'wait'}}) : reply(200, LIST))).fetch);
    w.stop();
    await expect(w.store.runIntegration('test-invoices')).rejects.toMatchObject({status: 429, code: 'too_many_runs'});
    expect(ApiRequestError).toBeDefined();
  });
});

test('the artifact database has no integrations: null', async () => {
  const store = (await createArtifactStore(fakeClaude().claude))!;
  const seen: (IntegrationInfo[] | null)[] = [];
  store.watchIntegrations(r => seen.push(r), () => {})();
  expect(seen).toEqual([null]);
  await expect(store.runIntegration('x')).rejects.toThrow();
});
