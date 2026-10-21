/* The integration routes are behind the same protection as the rest of the API: in the cloud nothing about them can
 * be read, switched or run without a Cloudflare Access login, and the local server has no such routes. */
import {createWorker} from '../src/worker';
import {fakeD1} from './fakeD1';
import {json, testApi} from './helpers';

const plugin = {manifest: {id: 'test-invoices', name: 'Testfakturor', apiVersion: 1, run: async () => ({})}, settings: {}, cron: '0 5 * * *'};

test('in the cloud without an Access login: the list, the switch and Kör nu are refused (401), and nothing runs', async () => {
  let ran = 0;
  const worker = createWorker({integrations: [{...plugin, manifest: {...plugin.manifest, run: async () => { ran++; return {}; }}}]});
  const env = {DB: fakeD1(), ACCESS_TEAM_DOMAIN: 'exempel.cloudflareaccess.com', ACCESS_AUD: 'aud-0000'};
  const call = (method: string, path: string, body?: unknown) => worker.fetch(new Request(`https://crm.example/api/v1${path}`,
    {method, headers: body === undefined ? {} : {'Content-Type': 'application/json'}, body: body === undefined ? undefined : JSON.stringify(body)}), env);
  expect((await call('GET', '/integrations')).status).toBe(401);
  expect((await call('PUT', '/integrations/test-invoices', {enabled: false})).status).toBe(401);
  expect((await call('POST', '/integrations/test-invoices/run', {})).status).toBe(401);
  expect(ran).toBe(0);
});

test('the local server has no integration plugins: /integrations is 404', async () => {
  const t = testApi();
  try {
    expect((await t.app.request('/api/v1/integrations')).status).toBe(404);
    expect((await t.app.request('/api/v1/integrations/x/run', json('POST', {}))).status).toBe(404);
  } finally {
    t.close();
  }
});

test('the Worker\'s log gets only the plugin\'s id and counts: no secret, no customer data, no error text', async () => {
  const lines: string[] = [];
  const log = jest.spyOn(console, 'log').mockImplementation((...a) => { lines.push(a.join(' ')); });
  const err = jest.spyOn(console, 'error').mockImplementation((...a) => { lines.push(a.join(' ')); });
  try {
    const failing = {...plugin, manifest: {...plugin.manifest, env: ['TEST_KEY'], run: async () => { throw new Error('Exempelbolaget AB refused nyckel-123'); }}};
    const ok = {...plugin, manifest: {...plugin.manifest, id: 'ok-plugin', run: async () => ({notes: ['Exempelbolaget AB']})}};
    const worker = createWorker({integrations: [failing, ok]});
    await worker.scheduled({cron: '0 5 * * *'}, {DB: fakeD1(), TEST_KEY: 'nyckel-123'});
  } finally {
    log.mockRestore();
    err.mockRestore();
  }
  expect(lines.length).toBeGreaterThan(0);
  expect(lines.join('\n')).not.toMatch(/nyckel-123|Exempelbolaget|refused/);
});
