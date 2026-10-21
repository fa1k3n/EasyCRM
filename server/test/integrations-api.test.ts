/* The integration plugins through the API (the Worker): the list with the latest runs, switching a plugin off and on,
 * and running one now, with the guards (unknown, switched off, already running, too soon). All data is made up. */
import {createWorker, type WorkerIntegration} from '../src/worker';
import {fakeD1} from './fakeD1';

const CRON = '0 */6 * * *';
const json = {'Content-Type': 'application/json'};
const invoice = (id: string) => ({id, title: `Faktura ${id}`, date: '2026-10-01', invoiceNumber: id, invoiceStatus: 'published'});

function setUp(run: WorkerIntegration['manifest']['run'] = async () => ({jobs: [{customerId: 'c1', item: invoice('1')}], notes: ['klar']})) {
  let clock = new Date('2026-10-21T10:00:00Z');
  const manifest = {id: 'test-invoices', name: 'Testfakturor', apiVersion: 1, owns: {jobs: ['invoiceStatus' as const]}, run};
  const worker = createWorker({integrations: [{manifest, settings: {}, cron: CRON}], clock: () => clock});
  const env = {DB: fakeD1()};
  const req = async (method: string, path: string, body?: unknown) => {
    const res = await worker.fetch(new Request(`http://localhost/api/v1${path}`, {method, headers: body === undefined ? {} : json, body: body === undefined ? undefined : JSON.stringify(body)}), env);
    return {status: res.status, body: res.status === 204 ? null : await res.json()};
  };
  return {worker, env, req, later: (seconds: number) => { clock = new Date(clock.getTime() + seconds * 1000); }};
}

test('GET /integrations lists the built-in plugins with name, schedule, on/off and the latest run', async () => {
  const t = setUp();
  await t.req('PUT', '/customers/c1', {company: 'Exempelbolaget AB', status: 'kund'});
  expect((await t.req('GET', '/integrations')).body).toEqual([{id: 'test-invoices', name: 'Testfakturor', cron: CRON, enabled: true, failures: 0, lastRun: null}]);
  await t.worker.scheduled({cron: CRON}, t.env);
  expect((await t.req('GET', '/integrations')).body[0].lastRun).toMatchObject({ok: true, trigger: 'cron', counts: {created: 1}});
});

test('POST /integrations/{id}/run runs it now with the same code and answers with the run', async () => {
  const t = setUp();
  await t.req('PUT', '/customers/c1', {company: 'Exempelbolaget AB', status: 'kund'});
  const r = await t.req('POST', '/integrations/test-invoices/run', {});
  expect(r.status).toBe(200);
  expect(r.body).toMatchObject({ok: true, trigger: 'manual', counts: {created: 1}, notes: ['klar']});
  expect((await t.req('GET', '/customers/c1')).body.jobs.map((j: Job) => j.id)).toEqual(['1']);
  expect((await t.req('GET', '/integrations')).body[0].lastRun).toMatchObject({trigger: 'manual'});
});

test('at most one manual run per plugin and minute (429); after a minute it runs again', async () => {
  const t = setUp();
  await t.req('PUT', '/customers/c1', {company: 'Exempelbolaget AB', status: 'kund'});
  expect((await t.req('POST', '/integrations/test-invoices/run', {})).status).toBe(200);
  expect((await t.req('POST', '/integrations/test-invoices/run', {})).status).toBe(429);
  t.later(61);
  expect((await t.req('POST', '/integrations/test-invoices/run', {})).status).toBe(200);
});

test('a run that is going on stops another (409); one that has hung for more than 5 minutes does not', async () => {
  const waiting: (() => void)[] = [];
  const t = setUp(() => new Promise(resolve => { waiting.push(() => resolve({})); }));
  const first = t.req('POST', '/integrations/test-invoices/run', {});
  await new Promise(r => setTimeout(r, 10));
  expect((await t.req('POST', '/integrations/test-invoices/run', {})).status).toBe(409);
  t.later(301);
  const third = t.req('POST', '/integrations/test-invoices/run', {});
  await new Promise(r => setTimeout(r, 10));
  waiting.forEach(release => release());
  expect((await first).status).toBe(200);
  expect((await third).status).toBe(200);
});

test('PUT /integrations/{id} switches it off: the schedule skips it and Kör nu answers 409; on again it runs', async () => {
  const t = setUp();
  await t.req('PUT', '/customers/c1', {company: 'Exempelbolaget AB', status: 'kund'});
  expect((await t.req('PUT', '/integrations/test-invoices', {enabled: false})).body).toMatchObject({id: 'test-invoices', enabled: false});
  await t.worker.scheduled({cron: CRON}, t.env);
  expect((await t.req('GET', '/customers/c1')).body.jobs ?? []).toEqual([]);
  expect((await t.req('POST', '/integrations/test-invoices/run', {})).status).toBe(409);
  await t.req('PUT', '/integrations/test-invoices', {enabled: true});
  await t.worker.scheduled({cron: CRON}, t.env);
  expect((await t.req('GET', '/customers/c1')).body.jobs.map((j: Job) => j.id)).toEqual(['1']);
});

test('switching off keeps the latest run; a body without enabled as true or false is refused', async () => {
  const t = setUp();
  await t.req('PUT', '/customers/c1', {company: 'Exempelbolaget AB', status: 'kund'});
  await t.worker.scheduled({cron: CRON}, t.env);
  await t.req('PUT', '/integrations/test-invoices', {enabled: false});
  expect((await t.req('GET', '/integrations')).body[0]).toMatchObject({enabled: false, lastRun: {ok: true}});
  expect((await t.req('PUT', '/integrations/test-invoices', {enabled: 'nej'})).status).toBe(400);
});

test('an unknown plugin gives 404', async () => {
  const t = setUp();
  expect((await t.req('POST', '/integrations/finns-inte/run', {})).status).toBe(404);
  expect((await t.req('PUT', '/integrations/finns-inte', {enabled: false})).status).toBe(404);
});

test('a Worker without plugins, like the local server, has no /integrations (404)', async () => {
  const worker = createWorker();
  const res = await worker.fetch(new Request('http://localhost/api/v1/integrations'), {DB: fakeD1()});
  expect(res.status).toBe(404);
});

test('MCP: run_integration runs a plugin now', async () => {
  const t = setUp();
  await t.req('PUT', '/customers/c1', {company: 'Exempelbolaget AB', status: 'kund'});
  const r = await t.req('POST', '/mcp', {jsonrpc: '2.0', id: 1, method: 'tools/call', params: {name: 'run_integration', arguments: {id: 'test-invoices'}}});
  expect(JSON.parse(r.body.result.content[0].text)).toMatchObject({ok: true, trigger: 'manual'});
});

test('failures counts the failed runs in a row; a successful run sets it to 0', async () => {
  let fail = true;
  const t = setUp(async () => { if (fail) throw new Error('no answer'); return {}; });
  for (let i = 0; i < 3; i++) await t.worker.scheduled({cron: CRON}, t.env);
  expect((await t.req('GET', '/integrations')).body[0]).toMatchObject({failures: 3, lastRun: {ok: false, error: 'no answer'}});
  fail = false;
  await t.worker.scheduled({cron: CRON}, t.env);
  expect((await t.req('GET', '/integrations')).body[0]).toMatchObject({failures: 0, lastRun: {ok: true}});
});
