/* Integration plugins run by the Worker on a schedule (Cron Triggers): the plan is written inside the Worker with the
 * API's rules, the result is kept in sync/integrations, and a plugin that fails writes nothing. All data is made up. */
import {createWorker, type WorkerIntegration} from '../src/worker';
import {fakeD1} from './fakeD1';

const CRON = '0 */6 * * *';
const json = {'Content-Type': 'application/json'};
const local = (path: string, init: RequestInit = {}) => new Request(`http://localhost/api/v1${path}`, init);

// A plugin without a service: it gives the first customer an invoice, and its settings and variable are checked
const plugin = (run: WorkerIntegration['manifest']['run'], over: Partial<WorkerIntegration['manifest']> = {}): WorkerIntegration['manifest'] =>
  ({id: 'test-invoices', name: 'Testfakturor', apiVersion: 1, owns: {jobs: ['invoiceStatus']}, run, ...over});
const invoice = (id: string) => ({id, title: `Faktura ${id}`, date: '2026-10-01', invoiceNumber: id, invoiceStatus: 'published'});

async function setUp(integrations: WorkerIntegration[], vars: Record<string, string> = {}) {
  const env = {DB: fakeD1(), ...vars};
  const worker = createWorker({integrations});
  await worker.fetch(local('/customers/c1', {method: 'PUT', headers: json, body: JSON.stringify({company: 'Exempelbolaget AB', status: 'kund'})}), env);
  const get = async (path: string) => (await worker.fetch(local(path), env)).json();
  const scheduled = (cron: string) => worker.scheduled({cron}, env);
  return {worker, env, get, scheduled};
}

test('the schedule runs the plugin: its plan is written with the API\'s rules, and the result is kept', async () => {
  const t = await setUp([{manifest: plugin(async ctx => ({jobs: [{customerId: ctx.customers[0].id, item: invoice('1')}], notes: ['1 faktura']})), settings: {}, cron: CRON}]);
  await t.scheduled(CRON);
  const c = await t.get('/customers/c1');
  expect(c.jobs.map((j: Job) => j.id)).toEqual(['1']);
  expect(c.lastContact).toBe('2026-10-01');
  const sync = await t.get('/sync/integrations');
  expect(sync['test-invoices'].lastRun).toMatchObject({ok: true, trigger: 'cron', counts: {created: 1}, remaining: 0, notes: ['1 faktura']});
});

test('another schedule does not run it', async () => {
  const t = await setUp([{manifest: plugin(async () => ({jobs: [{customerId: 'c1', item: invoice('1')}]})), settings: {}, cron: CRON}]);
  await t.scheduled('0 3 * * *');
  expect((await t.get('/customers/c1')).jobs ?? []).toEqual([]);
});

test('the plugin gets its declared variable from the Worker\'s environment and its settings', async () => {
  let seen: unknown[] = [];
  const t = await setUp([{manifest: plugin(async ctx => { seen = [ctx.config.TEST_KEY, ctx.settings.company]; return {}; }, {env: ['TEST_KEY']}), settings: {company: 'Testbolaget'}, cron: CRON}],
    {TEST_KEY: 'nyckel-123'});
  await t.scheduled(CRON);
  expect(seen).toEqual(['nyckel-123', 'Testbolaget']);
});

test('a plugin that throws writes nothing; the failed run is kept without the secret', async () => {
  const t = await setUp([{manifest: plugin(async ctx => { throw new Error(`refused ${ctx.config.TEST_KEY}`); }, {env: ['TEST_KEY']}), settings: {}, cron: CRON}], {TEST_KEY: 'nyckel-123'});
  await t.scheduled(CRON);
  expect((await t.get('/customers/c1')).jobs ?? []).toEqual([]);
  expect((await t.get('/sync/integrations'))['test-invoices'].lastRun).toMatchObject({ok: false, error: 'refused ***'});
});

test('maxWritesPerRun in the settings: the rest waits for the next run', async () => {
  const run = async () => ({jobs: ['1', '2', '3'].map(id => ({customerId: 'c1', item: invoice(id)}))});
  const t = await setUp([{manifest: plugin(run), settings: {maxWritesPerRun: 2}, cron: CRON}]);
  await t.scheduled(CRON);
  expect((await t.get('/sync/integrations'))['test-invoices'].lastRun).toMatchObject({counts: {created: 2}, remaining: 1});
  await t.scheduled(CRON);
  expect((await t.get('/customers/c1')).jobs.map((j: Job) => j.id)).toEqual(['1', '2', '3']);
});

test('one failing plugin does not stop another on the same schedule', async () => {
  const t = await setUp([
    {manifest: plugin(async () => { throw new Error('down'); }, {id: 'broken'}), settings: {}, cron: CRON},
    {manifest: plugin(async () => ({jobs: [{customerId: 'c1', item: invoice('1')}]})), settings: {}, cron: CRON}
  ]);
  await t.scheduled(CRON);
  const sync = await t.get('/sync/integrations');
  expect([sync.broken.lastRun.ok, sync['test-invoices'].lastRun.ok]).toEqual([false, true]);
});

test('sync/integrations is one of the sync documents', async () => {
  const t = await setUp([]);
  const put = await t.worker.fetch(local('/sync/integrations', {method: 'PUT', headers: json, body: JSON.stringify({x: {lastRun: {ok: true}}})}), t.env);
  expect(put.status).toBe(201);
  expect(await t.get('/sync/integrations')).toEqual({id: 'integrations', x: {lastRun: {ok: true}}});
});
