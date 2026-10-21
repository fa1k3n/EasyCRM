/* Tests for integration plugins in the Cloudflare folder (tools/cloudflare.js): integrations in cloudflare.json become
 * Cron Triggers, the plugins are type-checked and built into the Worker, and the built Worker runs a plugin on its
 * schedule in workerd (wrangler, a local D1 in a temporary folder). The names and data are made up. */
const fs = require('fs');
const os = require('os');
const path = require('path');
const {spawnSync} = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const TOOL = path.join(ROOT, 'tools', 'cloudflare.js');
jest.setTimeout(240000);
const SETTINGS = {name: 'crm-test', databaseName: 'crm', databaseId: '00000000-0000-0000-0000-000000000000'};
const CRON = '*/30 * * * *';

// A plugin without a service: an invoice for every customer, with the number from its settings
const PLUGIN = `import type {IntegrationManifest} from 'crm-integration-api';
const plugin: IntegrationManifest = {
  id: 'test-invoices', name: 'Testfakturor', apiVersion: 1, owns: {jobs: ['invoiceStatus']},
  async run(ctx) {
    const number = String(ctx.settings.number);
    return {jobs: ctx.customers.map(c => ({customerId: c.id, item: {id: 'inv-' + number, title: 'Faktura ' + number, date: '2026-10-01', invoiceNumber: number, invoiceStatus: 'published'}})), notes: ['klar']};
  }
};
export default plugin;
`;

let dir, brand;
beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'crm-cloudflare-integrations-'));
  brand = path.join(dir, 'brand');
  fs.cpSync(path.join(ROOT, 'example'), brand, {recursive: true});
  fs.mkdirSync(path.join(brand, 'integrations', 'test-invoices'), {recursive: true});
  fs.writeFileSync(path.join(brand, 'integrations', 'test-invoices', 'index.ts'), PLUGIN);
  fs.writeFileSync(path.join(brand, 'integrations', 'test-invoices', 'settings.json'), JSON.stringify({number: '42'}));
});
afterAll(() => fs.rmSync(dir, {recursive: true, force: true}));

const run = (...args) => spawnSync(process.execPath, [TOOL, ...args], {encoding: 'utf8'});
const settings = s => fs.writeFileSync(path.join(brand, 'cloudflare.json'), JSON.stringify(s));

describe('tools/cloudflare.js with integrations', () => {
  test('integrations become Cron Triggers and the plugin is built into the Worker', () => {
    settings({...SETTINGS, integrations: [{id: 'test-invoices', cron: CRON}]});
    const out = path.join(dir, 'out');
    const r = run('--brand', brand, '--out-dir', out);
    expect(r.stderr).toBe('');
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/test-invoices/);
    const config = JSON.parse(fs.readFileSync(path.join(out, 'wrangler.json'), 'utf8'));
    expect(config.triggers).toEqual({crons: [CRON]});
    expect(fs.readFileSync(path.join(out, 'worker.mjs'), 'utf8')).toMatch('Testfakturor');
  });

  test('without integrations there are no triggers', () => {
    settings(SETTINGS);
    const r = run('--brand', brand, '--out-dir', path.join(dir, 'plain'));
    expect(r.status).toBe(0);
    expect(JSON.parse(fs.readFileSync(path.join(dir, 'plain', 'wrangler.json'), 'utf8')).triggers).toBeUndefined();
  });

  test('a missing plugin, a bad schedule or a plugin with type errors stops it, and nothing is written', () => {
    for (const [integrations, message] of [
      [[{id: 'finns-inte', cron: CRON}], /Cannot find the plugin/],
      [[{id: 'test-invoices', cron: 'every hour'}], /cron/],
      [[{id: 'test-invoices'}], /cron/],
      [{}, /integrations.*list/]
    ]) {
      settings({...SETTINGS, integrations});
      const r = run('--brand', brand, '--out-dir', path.join(dir, 'stopped'));
      expect(r.status).toBe(1);
      expect(r.stderr).toMatch(message);
      expect(fs.existsSync(path.join(dir, 'stopped'))).toBe(false);
    }
    const broken = path.join(dir, 'broken');
    fs.cpSync(brand, broken, {recursive: true});
    fs.writeFileSync(path.join(broken, 'integrations', 'test-invoices', 'index.ts'), PLUGIN.replace("apiVersion: 1", "apiVersion: 'one'"));
    fs.writeFileSync(path.join(broken, 'cloudflare.json'), JSON.stringify({...SETTINGS, integrations: [{id: 'test-invoices', cron: CRON}]}));
    const r = run('--brand', broken, '--out-dir', path.join(dir, 'stopped'));
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/type errors/);
    expect(fs.existsSync(path.join(dir, 'stopped'))).toBe(false);
  });

  test('the built Worker runs the plugin on its schedule in workerd and keeps the result', () => {
    const out = path.join(dir, 'out');
    const script = `
      const {unstable_dev} = require(${JSON.stringify(require.resolve('wrangler'))});
      (async () => {
        const worker = await unstable_dev(process.argv[1], {config: process.argv[2], persistTo: process.argv[3], logLevel: 'none', testScheduled: true,
          experimental: {disableExperimentalWarning: true}});
        const json = {'Content-Type': 'application/json'};
        const r = {};
        try {
          r.put = (await worker.fetch('/api/v1/customers/c1', {method: 'PUT', headers: json, body: JSON.stringify({company: 'Example Ltd', status: 'kund'})})).status;
          r.scheduled = (await worker.fetch('/__scheduled?cron=' + encodeURIComponent(${JSON.stringify(CRON)}))).status;
          r.jobs = ((await (await worker.fetch('/api/v1/customers/c1')).json()).jobs || []).map(j => j.id);
          r.lastRun = (await (await worker.fetch('/api/v1/sync/integrations')).json())['test-invoices'].lastRun;
        } finally {
          await worker.stop();
        }
        console.log('RESULT ' + JSON.stringify(r));
      })().catch(e => { console.error(e); process.exit(1); });`;
    const res = spawnSync(process.execPath, ['-e', script, path.join(out, 'worker.mjs'), path.join(out, 'wrangler.json'), path.join(dir, 'state')],
      {encoding: 'utf8', cwd: dir, timeout: 200000});
    const line = (res.stdout || '').split('\n').find(l => l.startsWith('RESULT '));
    if (!line) throw new Error(`The Worker did not answer:\n${res.stdout}\n${res.stderr}`);
    const r = JSON.parse(line.slice(7));
    expect(r).toMatchObject({put: 201, scheduled: 200, jobs: ['inv-42']});
    expect(r.lastRun).toMatchObject({ok: true, trigger: 'cron', counts: {created: 1}, notes: ['klar']});
  });
});
