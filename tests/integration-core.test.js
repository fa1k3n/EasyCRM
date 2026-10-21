/* Tests for tools/integration-core.js, the code tools/integration.js and the Worker share: one run of a plugin (plan,
 * checks, writing within the limit per run) and the run's result in sync/integrations. The API is a fake in memory;
 * all data is made up. */
const core = require('../tools/integration-core');
const L = require('../crm/logic.js');

// A fake REST API (the paths after /api/v1) with versions and If-Match, recording every write
function fakeApi(customers = {}, sync = {}) {
  const docs = new Map(Object.entries(customers).map(([id, c]) => [`customers/${id}`, {data: {id, ...c}, version: 1}]));
  for (const [id, d] of Object.entries(sync)) docs.set(`sync/${id}`, {data: d, version: 1});
  const writes = [];
  const call = async (method, path, body, version) => {
    const [, col, id, list, itemId] = path.split('/');
    const key = `${col}/${id}`;
    const doc = docs.get(key);
    if (method === 'GET' && !id) return {status: 200, data: [...docs].filter(([k]) => k.startsWith(col + '/')).map(([, d]) => d.data)};
    if (method === 'GET') return doc ? {status: 200, data: doc.data, version: doc.version} : {status: 404, data: null};
    writes.push(`${method} ${path}`);
    if (version !== undefined && (doc ? doc.version : 0) !== version) return {status: 412, data: null};
    let data;
    if (method === 'PUT') data = col === 'customers' ? {id, ...body} : body;
    else {
      data = structuredClone(doc.data);
      if (list === 'jobs' && method === 'POST') data.jobs = [...(data.jobs || []), body];
      else if (list === 'jobs') data.jobs = data.jobs.map(j => (j.id === itemId ? {...j, ...body} : j));
      else Object.assign(data, body);
    }
    const next = {data, version: (doc ? doc.version : 0) + 1};
    docs.set(key, next);
    return {status: doc ? 200 : 201, data, version: next.version};
  };
  return {call, writes, doc: key => docs.get(key) && docs.get(key).data};
}

const job = (id, over = {}) => ({id, title: `Faktura ${id}`, date: '2026-10-01', invoiceNumber: id, ...over});
const plugin = (plan, over = {}) => ({id: 'test-invoices', name: 'Testfakturor', apiVersion: 1, owns: {jobs: ['invoiceStatus']}, run: async () => plan, ...over});
const CUSTOMERS = {c1: {company: 'Exempelbolaget AB', status: 'kund', jobs: [job('1', {invoiceStatus: 'published'})]}};
const options = (api, over = {}) => ({validateCustomer: L.validateCustomer, call: api.call, env: {}, settings: {}, trigger: 'cron', now: () => new Date('2026-10-21T06:00:00Z'), ...over});

describe('applyPlan: the limit per run', () => {
  test('writes at most maxWrites changes and says how many are left', async () => {
    const api = fakeApi(CUSTOMERS);
    const diff = {create: ['2', '3', '4'].map(id => ({customerId: 'c1', item: job(id)})), update: [], links: []};
    const n = await core.applyPlan(diff, plugin({}), api.call, {maxWrites: 2});
    expect(n).toEqual({created: 2, updated: 0, linked: 0, remaining: 1});
    expect(api.writes.filter(w => w.startsWith('POST'))).toHaveLength(2);
  });

  test('without a limit everything is written and nothing is left', async () => {
    const api = fakeApi(CUSTOMERS);
    const diff = {create: [{customerId: 'c1', item: job('2')}], update: [{customerId: 'c1', itemId: '1', patch: {invoiceStatus: 'paid'}}], links: [{customerId: 'c1', data: {customerId: 'x'}}]};
    expect(await core.applyPlan(diff, plugin({}), api.call)).toEqual({created: 1, updated: 1, linked: 1, remaining: 0});
    expect(api.doc('customers/c1').jobs.map(j => [j.id, j.invoiceStatus])).toEqual([['1', 'paid'], ['2', undefined]]);
    expect(api.doc('customers/c1').ext).toEqual({'test-invoices': {customerId: 'x'}});
  });
});

describe('runOnce: one run of a plugin, as the Worker makes it', () => {
  test('a plan is written and the result says when, how and how much', async () => {
    const api = fakeApi(CUSTOMERS);
    const plan = {jobs: [{customerId: 'c1', item: job('1', {invoiceStatus: 'paid'})}, {customerId: 'c1', item: job('2')}], notes: ['2 fakturor lästa'], unmatched: ['Okänd AB']};
    const {lastRun} = await core.runOnce(plugin(plan), options(api));
    expect(lastRun).toEqual({at: '2026-10-21T06:00:00.000Z', ok: true, trigger: 'cron', counts: {customers: 0, created: 1, updated: 1, linked: 0}, remaining: 0, notes: ['2 fakturor lästa'], unmatched: ['Okänd AB']});
    expect(api.doc('customers/c1').jobs).toHaveLength(2);
  });

  test('maxWritesPerRun in the settings limits the run; the next run writes the rest', async () => {
    const api = fakeApi(CUSTOMERS);
    const plan = {jobs: ['2', '3', '4'].map(id => ({customerId: 'c1', item: job(id)}))};
    const first = await core.runOnce(plugin(plan), options(api, {settings: {maxWritesPerRun: 2}}));
    expect(first.lastRun).toMatchObject({ok: true, counts: {created: 2}, remaining: 1});
    const second = await core.runOnce(plugin(plan), options(api, {settings: {maxWritesPerRun: 2}}));
    expect(second.lastRun).toMatchObject({ok: true, counts: {created: 1}, remaining: 0});
    expect(api.doc('customers/c1').jobs.map(j => j.id)).toEqual(['1', '2', '3', '4']);
  });

  test('the default limit is 20 writes per run', async () => {
    const api = fakeApi(CUSTOMERS);
    const plan = {jobs: Array.from({length: 25}, (_, i) => ({customerId: 'c1', item: job(String(i + 10))}))};
    expect((await core.runOnce(plugin(plan), options(api))).lastRun).toMatchObject({counts: {created: 20}, remaining: 5});
  });

  test('a plugin that throws writes nothing; the error is kept without the secret values', async () => {
    const api = fakeApi(CUSTOMERS);
    const broken = plugin(null, {env: ['TEST_KEY'], run: async ctx => { throw new Error(`the service said no to ${ctx.config.TEST_KEY}`); }});
    const {lastRun} = await core.runOnce(broken, options(api, {env: {TEST_KEY: 'hemligt-värde-123'}}));
    expect(lastRun).toMatchObject({ok: false, error: 'the service said no to ***'});
    expect(api.writes).toEqual([]);
  });

  test('a missing environment variable is named, nothing is written', async () => {
    const api = fakeApi(CUSTOMERS);
    const {lastRun} = await core.runOnce(plugin({jobs: []}, {env: ['TEST_KEY']}), options(api));
    expect(lastRun).toMatchObject({ok: false, error: 'Missing environment variable: TEST_KEY'});
    expect(api.writes).toEqual([]);
  });

  test('a plan with a secret value or a plan that does not pass the checks writes nothing', async () => {
    const api = fakeApi(CUSTOMERS);
    const leaky = plugin(null, {env: ['TEST_KEY'], run: async ctx => ({notes: [ctx.config.TEST_KEY]})});
    expect((await core.runOnce(leaky, options(api, {env: {TEST_KEY: 'hemligt-värde-123'}}))).lastRun).toMatchObject({ok: false, error: expect.stringMatching(/secret/)});
    const bad = plugin({jobs: [{customerId: 'finns-inte', item: job('9')}]});
    expect((await core.runOnce(bad, options(api))).lastRun).toMatchObject({ok: false, error: expect.stringMatching(/unknown customer/)});
    expect(api.writes).toEqual([]);
  });

  test('a long error is cut', async () => {
    const api = fakeApi(CUSTOMERS);
    const {lastRun} = await core.runOnce(plugin(null, {run: async () => { throw new Error('x'.repeat(1000)); }}), options(api));
    expect(lastRun.error.length).toBeLessThanOrEqual(300);
  });
});

describe('recordRun: the result in sync/integrations', () => {
  test('the plugin\'s result is kept next to the other plugins\' results', async () => {
    const api = fakeApi({}, {integrations: {other: {lastRun: {ok: true}}}});
    await core.recordRun(api.call, 'test-invoices', {ok: true, at: '2026-10-21T06:00:00.000Z'});
    expect(api.doc('sync/integrations')).toEqual({other: {lastRun: {ok: true}}, 'test-invoices': {lastRun: {ok: true, at: '2026-10-21T06:00:00.000Z'}}});
  });

  test('the document is created when it is missing', async () => {
    const api = fakeApi();
    await core.recordRun(api.call, 'test-invoices', {ok: false});
    expect(api.doc('sync/integrations')).toEqual({'test-invoices': {lastRun: {ok: false}}});
  });
});
