/* The store over the REST API (server/), tested against a small fake server in memory: polling with ETag, writes,
 * errors with the API's codes, and the choice between the artifact database and the API. */
import {fakeClaude} from '../../test/fakeDb';
import {connectStore} from './connect';
import {createRestStore} from './restStore';

type Doc = Record<string, unknown>;

/* A fake API: the paths the app uses, with a revision as the list's ETag. calls records every request. */
function fakeApi({healthy = true, busy = null as Doc | null} = {}) {
  const customers = new Map<string, Doc>();
  const skipped = new Map<string, Doc>();
  let revision = 0, next = 1, down = false;
  const calls: {method: string; path: string; headers: Record<string, string>; body?: unknown}[] = [];
  const reply = (status: number, body?: unknown, headers: Record<string, string> = {}) =>
    ({ok: status < 400, status, headers: {get: (k: string) => headers[k] ?? null}, json: async () => body}) as unknown as Response;
  const fetch = async (url: string, init: RequestInit = {}) => {
    const method = init.method ?? 'GET', path = url.replace(/^\/api\/v1/, '');
    const headers = (init.headers ?? {}) as Record<string, string>;
    const body = init.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({method, path, headers, body});
    if (down) throw new TypeError('Failed to fetch');
    if (path === '/health') return healthy ? reply(200, {api: 'v1', schema: 1}) : reply(500, {error: {code: 'internal'}});
    if (path === '/customers' && method === 'GET') {
      const tag = `"r${revision}"`;
      if (headers['If-None-Match'] === tag) return reply(304);
      return reply(200, [...customers].map(([id, d]) => ({...d, id})), {ETag: tag});
    }
    if (path === '/customers' && method === 'POST') {
      const id = `c${next++}`;
      customers.set(id, {...body, jobs: [], comms: []}); revision++;
      return reply(201, {...body, id});
    }
    const m = /^\/customers\/([^/]+)$/.exec(path);
    if (m && method === 'PATCH') {
      if (!customers.has(m[1])) return reply(404, {error: {code: 'not_found', message: 'Not found'}});
      if (body.types && !Array.isArray(body.types)) return reply(400, {error: {code: 'validation', message: 'The data is not valid'}});
      customers.set(m[1], {...customers.get(m[1]), ...body}); revision++;
      return reply(200, {});
    }
    if (m && method === 'DELETE') { customers.delete(m[1]); revision++; return reply(204); }
    const s = /^\/skipped\/(.+)$/.exec(path);
    if (s && method === 'PUT') { skipped.set(decodeURIComponent(s[1]), body); return reply(201, body); }
    if (path === '/sync/busy') return busy ? reply(200, busy) : reply(404, {error: {code: 'not_found'}});
    return reply(404, {error: {code: 'not_found'}});
  };
  return {fetch, customers, skipped, calls, setDown(v: boolean) { down = v; }, change(id: string, d: Doc) { customers.set(id, d); revision++; }};
}

// Fake timers: tick(ms) moves the clock and runs the polls that fall due, so the number of polls never depends on
// how fast the machine is
beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());
const tick = (ms = 0) => jest.advanceTimersByTimeAsync(ms);

describe('createRestStore', () => {
  test('without an answering API (a page opened as a file, no fetch) there is no store', async () => {
    expect(await createRestStore({fetch: fakeApi({healthy: false}).fetch})).toBeNull();
    expect(await createRestStore({fetch: async () => { throw new TypeError('Failed to fetch'); }})).toBeNull();
    expect(await createRestStore({fetch: undefined})).toBeNull();
  });

  test('watchCustomers delivers the customers, polls with If-None-Match and only delivers again after a change', async () => {
    const api = fakeApi();
    api.change('a1', {company: 'Exempelbolaget AB'});
    const store = (await createRestStore({fetch: api.fetch, interval: 5}))!;
    expect(store.canWrite).toBe(true);
    const seen: string[][] = [];
    const stop = store.watchCustomers(cs => seen.push(cs.map(c => `${c.id}:${c.company}`)), () => {});
    await tick(30);
    expect(seen).toEqual([['a1:Exempelbolaget AB']]);
    expect(api.calls.filter(c => c.path === '/customers').length).toBeGreaterThan(1);
    expect(api.calls.filter(c => c.path === '/customers')[1].headers['If-None-Match']).toBe('"r1"');
    api.change('a2', {company: 'Andra Exempel AB'});
    await tick(30);
    expect(seen[seen.length - 1].sort()).toEqual(['a1:Exempelbolaget AB', 'a2:Andra Exempel AB']);
    stop();
    const count = api.calls.length;
    await tick(30);
    expect(api.calls.length).toBe(count);
  });

  test('a lost connection calls fail, and the customers come again when the API answers', async () => {
    const api = fakeApi();
    const store = (await createRestStore({fetch: api.fetch, interval: 5}))!;
    const events: string[] = [];
    const stop = store.watchCustomers(cs => events.push(`next:${cs.length}`), () => events.push('fail'));
    await tick(20);
    api.setDown(true);
    await tick(20);
    api.setDown(false);
    await tick(20);
    stop();
    expect(events[0]).toBe('next:0');
    expect(events).toContain('fail');
    expect(events[events.length - 1]).toBe('next:0');
  });

  test('a write asks for the customers at once instead of waiting for the next poll', async () => {
    const api = fakeApi();
    const store = (await createRestStore({fetch: api.fetch, interval: 60000}))!;
    const seen: number[] = [];
    const stop = store.watchCustomers(cs => seen.push(cs.length), () => {});
    await tick();
    const id = await store.createCustomer({company: 'Exempel Ny AB', status: 'kund'});
    await tick();
    stop();
    expect(id).toBe('c1');
    expect(seen).toEqual([0, 1]);
  });

  test('the writes use the API: POST, PATCH, DELETE and PUT /skipped/<key> with JSON', async () => {
    const api = fakeApi();
    const store = (await createRestStore({fetch: api.fetch}))!;
    const id = await store.createCustomer({company: 'A', status: 'kund'});
    await store.updateCustomer(id, {notes: 'Ringt'});
    await store.skipCustomer('Exempel Bolaget AB', {company: 'Exempel Bolaget AB', website: ''});
    await store.deleteCustomer(id);
    const writes = api.calls.filter(c => c.method !== 'GET');
    expect(writes.map(c => `${c.method} ${c.path}`)).toEqual(['POST /customers', `PATCH /customers/${id}`, 'PUT /skipped/Exempel%20Bolaget%20AB', `DELETE /customers/${id}`]);
    for (const w of writes.filter(c => c.body !== undefined)) expect(w.headers['Content-Type']).toBe('application/json');
    expect(api.skipped.get('Exempel Bolaget AB')).toEqual({company: 'Exempel Bolaget AB', website: ''});
    expect(api.customers.has(id)).toBe(false);
  });

  test('a refused write throws an error with the API\'s code and message', async () => {
    const api = fakeApi();
    const store = (await createRestStore({fetch: api.fetch}))!;
    await expect(store.updateCustomer('nope', {notes: 'x'})).rejects.toMatchObject({code: 'not_found'});
    const id = await store.createCustomer({company: 'A'});
    await expect(store.updateCustomer(id, {types: 'x' as unknown as string[]})).rejects.toMatchObject({code: 'validation', message: 'The data is not valid'});
  });

  test('watchBusy gives the busy times, or null when sync/busy is missing or the API fails', async () => {
    const items = [{date: '2026-10-20', time: '09:00', title: 'Upptagen'}];
    const withBusy = (await createRestStore({fetch: fakeApi({busy: {items}}).fetch, interval: 5}))!;
    const got: unknown[] = [];
    const stop = withBusy.watchBusy(x => got.push(x));
    await tick(20);
    stop();
    expect(got[0]).toEqual(items);
    const without = (await createRestStore({fetch: fakeApi().fetch}))!;
    const none: unknown[] = [];
    without.watchBusy(x => none.push(x))();
    await tick();
    expect(none).toEqual([null]);
  });
});

describe('connectStore: the artifact database on claude.ai, otherwise the REST API', () => {
  test('with window.claude the artifact database is used, and the API is never asked', async () => {
    const api = fakeApi();
    const store = await connectStore(fakeClaude().claude, api.fetch);
    expect(store).not.toBeNull();
    expect(api.calls).toEqual([]);
  });
  test('without claude.ai the REST API on the same address is used when it answers', async () => {
    const api = fakeApi();
    const store = await connectStore(undefined, api.fetch);
    expect(store).not.toBeNull();
    expect(api.calls[0].path).toBe('/health');
  });
  test('without either there is no store (the list says the register is not available here)', async () => {
    expect(await connectStore(undefined, fakeApi({healthy: false}).fetch)).toBeNull();
  });
});
