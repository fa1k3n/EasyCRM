'use strict';
/* Tests for tools/integration.js (integration plugins): loading and checking a plugin, what it gets (config, a fetch
 * that only reaches its hosts, frozen customers), its plan, and the dry run that shows what would change.
 * The example plugin (example/integrations/example-invoices) runs against a made-up service. All data is made up. */
const fs = require('fs');
const os = require('os');
const path = require('path');
const {loadPlugin, makeContext, checkPlan, diffPlan, formatPlan} = require('../tools/integration');

const ROOT = path.resolve(__dirname, '..');
const EXAMPLE = path.join(ROOT, 'example');
jest.setTimeout(60000);

const CUSTOMERS = [
  {id: 'c1', company: 'Exempelbolaget AB', email: 'info@exempel.se', status: 'kund', jobs: []},
  {id: 'c2', company: 'Andra Exempel AB', email: 'kontakt@andra.example', status: 'kund',
    jobs: [{id: 'example-invoices-inv-2', title: 'Egen titel', date: '2026-09-01', amount: '9 000', invoiceNumber: 2, invoiceStatus: 'published', dueDate: '2026-09-30'}],
    ext: {'example-invoices': {customerId: 'svc-2'}}}
];

// The made-up service the example plugin reads
const SERVICE = {
  'https://invoices.example/v1/customers': {items: [
    {id: 'svc-1', name: 'Exempelbolaget', emails: ['INFO@exempel.se']},
    {id: 'svc-2', name: 'Andra Exempel AB', emails: []},
    {id: 'svc-3', name: 'Okänt Bolag', emails: ['x@okant.example']}
  ]},
  'https://invoices.example/v1/invoices': {items: [
    {id: 'inv-1', number: 1, customerId: 'svc-1', date: '2026-10-01', dueDate: '2026-10-31', status: 'published', total: 14500, description: 'Fotografering'},
    {id: 'inv-2', number: 2, customerId: 'svc-2', date: '2026-09-01', dueDate: '2026-09-30', status: 'paid', total: 9000, description: 'Video'},
    {id: 'inv-3', number: 3, customerId: 'svc-3', date: '2026-10-05', dueDate: '2026-11-04', status: 'published', total: 100, description: 'X'},
    {id: 'inv-4', number: 4, customerId: 'svc-1', date: '2026-10-10', dueDate: '2026-11-09', status: 'draft', total: 1, description: 'Utkast'}
  ]}
};
const calls = [];
const fakeFetch = async (url, init = {}) => {
  calls.push({url, init});
  const body = SERVICE[url.split('?')[0]];
  return body ? new Response(JSON.stringify(body), {status: 200}) : new Response('{}', {status: 404});
};
const ENV = {EXAMPLE_INVOICES_KEY: 'not-a-real-key-0000', UNRELATED: 'must-not-be-seen'};

// A plugin of our own in a temporary brand folder (removed when the file's tests are done)
const tempDirs = [];
afterAll(() => { for (const d of tempDirs) fs.rmSync(d, {recursive: true, force: true}); });
function tempPlugin(id, source, settings) {
  const brand = fs.mkdtempSync(path.join(os.tmpdir(), 'crm-integration-'));
  tempDirs.push(brand);
  fs.mkdirSync(path.join(brand, 'integrations', id), {recursive: true});
  fs.writeFileSync(path.join(brand, 'integrations', id, 'index.ts'), source);
  if (settings) fs.writeFileSync(path.join(brand, 'integrations', id, 'settings.json'), JSON.stringify(settings));
  return brand;
}
const manifestSource = (body, extra = '') => `import type {IntegrationManifest} from 'crm-integration-api';
const plugin: IntegrationManifest = {id: 'test-plugin', name: 'Test', apiVersion: 1, ${extra}
  async run(ctx) { ${body} }
};
export default plugin;
`;

describe('loadPlugin', () => {
  test('type-checks and loads the example plugin from the brand folder', async () => {
    const p = await loadPlugin(EXAMPLE, 'example-invoices');
    expect(p.manifest).toMatchObject({id: 'example-invoices', apiVersion: 1, env: ['EXAMPLE_INVOICES_KEY'], hosts: ['invoices.example']});
    expect(typeof p.manifest.run).toBe('function');
  });

  test('a plugin that does not exist gives a clear error', async () => {
    await expect(loadPlugin(EXAMPLE, 'nothing')).rejects.toThrow(/integrations[\\/]nothing[\\/]index\.ts/);
  });

  test('a type error stops it before anything runs', async () => {
    const brand = tempPlugin('test-plugin', manifestSource('const n: number = "text"; return {};'));
    await expect(loadPlugin(brand, 'test-plugin')).rejects.toThrow(/type errors/);
  });

  test('another apiVersion, another id than the folder or a missing run is refused', async () => {
    for (const [src, msg] of [
      [manifestSource('return {};').replace('apiVersion: 1', 'apiVersion: 2'), /apiVersion/],
      [manifestSource('return {};').replace("id: 'test-plugin'", "id: 'other'"), /id/],
      [manifestSource('return {};', "owns: {jobs: ['amount', 'nonsense' as never]},"), /owns/]
    ]) {
      const brand = tempPlugin('test-plugin', src);
      await expect(loadPlugin(brand, 'test-plugin')).rejects.toThrow(msg);
    }
  });

  test('the settings file next to the plugin is read', async () => {
    const brand = tempPlugin('test-plugin', manifestSource('return {};'), {ignore: ['x']});
    expect((await loadPlugin(brand, 'test-plugin')).settings).toEqual({ignore: ['x']});
  });
});

describe('makeContext: what a plugin gets', () => {
  const manifest = {id: 'p', env: ['EXAMPLE_INVOICES_KEY'], hosts: ['invoices.example']};

  test('config has only the declared variables; a missing one is an error naming it', () => {
    const ctx = makeContext({manifest, env: ENV, customers: CUSTOMERS, fetchImpl: fakeFetch});
    expect(ctx.config).toEqual({EXAMPLE_INVOICES_KEY: 'not-a-real-key-0000'});
    expect(() => makeContext({manifest, env: {}, customers: [], fetchImpl: fakeFetch})).toThrow(/EXAMPLE_INVOICES_KEY/);
  });

  test('fetch reaches only the declared hosts, over https, with GET', async () => {
    const ctx = makeContext({manifest, env: ENV, customers: [], fetchImpl: fakeFetch});
    expect((await ctx.fetch('https://invoices.example/v1/customers')).status).toBe(200);
    await expect(ctx.fetch('https://evil.example/steal')).rejects.toThrow(/evil\.example/);
    await expect(ctx.fetch('http://invoices.example/v1/customers')).rejects.toThrow(/https/);
    await expect(ctx.fetch('https://invoices.example/v1/x', {method: 'POST'})).rejects.toThrow(/GET/);
  });

  test('the customers are frozen copies: changing them throws and the originals are untouched', () => {
    const ctx = makeContext({manifest, env: ENV, customers: CUSTOMERS, fetchImpl: fakeFetch});
    expect(() => { ctx.customers[0].company = 'X'; }).toThrow();
    expect(() => { ctx.customers[1].jobs.push({}); }).toThrow();
    expect(CUSTOMERS[0].company).toBe('Exempelbolaget AB');
  });
});

describe('the example plugin\'s plan, and the dry run', () => {
  let plan;
  beforeAll(async () => {
    const {manifest, settings} = await loadPlugin(EXAMPLE, 'example-invoices');
    calls.length = 0;   // only the example plugin's own calls
    plan = await manifest.run(makeContext({manifest, settings, env: ENV, customers: CUSTOMERS, fetchImpl: fakeFetch, options: {}}));
  });

  test('invoices of connected customers become jobs with stable ids; drafts are left out; unknown customers are listed', () => {
    expect(plan.jobs.map(j => [j.customerId, j.item.id])).toEqual([['c1', 'example-invoices-inv-1'], ['c2', 'example-invoices-inv-2']]);
    expect(plan.jobs[0].item).toEqual({id: 'example-invoices-inv-1', title: 'Fotografering', date: '2026-10-01', amount: '14 500',
      invoiceNumber: 1, invoiceStatus: 'published', dueDate: '2026-10-31', invoiceUrl: ''});
    expect(plan.links).toEqual([{customerId: 'c1', data: {customerId: 'svc-1'}}]);
    expect(plan.unmatched).toEqual(['Okänt Bolag']);
  });

  test('the key is sent to the service as a header and never ends up in the plan', () => {
    expect(calls.every(c => c.init.headers.Authorization === 'Bearer not-a-real-key-0000')).toBe(true);
    expect(JSON.stringify(plan)).not.toMatch('not-a-real-key');
  });

  test('checkPlan accepts the plan', async () => {
    const {manifest} = await loadPlugin(EXAMPLE, 'example-invoices');
    expect(checkPlan(plan, manifest, CUSTOMERS)).toEqual([]);
  });

  test('diffPlan: a new job is created; an existing one only gets the fields the plugin owns that differ', async () => {
    const {manifest} = await loadPlugin(EXAMPLE, 'example-invoices');
    const diff = diffPlan(plan, manifest, CUSTOMERS);
    expect(diff.create.map(c => c.item.id)).toEqual(['example-invoices-inv-1']);
    expect(diff.update).toEqual([{customerId: 'c2', itemId: 'example-invoices-inv-2', patch: {invoiceStatus: 'paid'}}]);
    expect(diff.links).toEqual([{customerId: 'c1', data: {customerId: 'svc-1'}}]);
  });

  test('formatPlan shows what would change without the key', async () => {
    const {manifest} = await loadPlugin(EXAMPLE, 'example-invoices');
    const text = formatPlan(diffPlan(plan, manifest, CUSTOMERS), plan, CUSTOMERS);
    expect(text).toMatch(/1 new job/);
    expect(text).toMatch(/1 changed job/);
    expect(text).toMatch(/Exempelbolaget AB/);
    expect(text).toMatch(/Okänt Bolag/);
    expect(text).not.toMatch('not-a-real-key');
  });
});

describe('checkPlan: a plan the platform cannot write is refused', () => {
  const manifest = {id: 'p', owns: {jobs: ['invoiceStatus']}};
  test.each([
    ['an unknown customer', {jobs: [{customerId: 'nope', item: {id: 'a'}}]}, /nope/],
    ['a job without an id', {jobs: [{customerId: 'c1', item: {title: 'x'}}]}, /id/],
    ['an invalid job field', {jobs: [{customerId: 'c1', item: {id: 'a', date: 'igår'}}]}, /date/],
    ['the same job twice', {jobs: [{customerId: 'c1', item: {id: 'a'}}, {customerId: 'c1', item: {id: 'a'}}]}, /twice/],
    ['a link to an unknown customer', {links: [{customerId: 'nope', data: {}}]}, /nope/]
  ])('%s', (_name, plan, msg) => {
    const issues = checkPlan(plan, manifest, CUSTOMERS);
    expect(issues.join('\n')).toMatch(msg);
  });
});

describe('--apply: the plan written through the REST API (the local server)', () => {
  const {spawn, spawnSync} = require('child_process');
  let dir, server, url;
  beforeAll(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'crm-integration-apply-'));
    server = spawn(process.execPath, [path.join(ROOT, 'server', 'dist', 'node.mjs'), '--port', '0', '--db', path.join(dir, 'crm.sqlite')], {cwd: dir});
    url = await new Promise((resolve, reject) => {
      let out = '';
      server.stdout.on('data', d => { out += d; const m = /(http:\/\/127\.0\.0\.1:\d+)\/api\/v1\//.exec(out); if (m) resolve(m[1]); });
      server.on('exit', code => reject(new Error(`server exited with ${code}`)));
    });
  });
  afterAll(() => { server.kill(); fs.rmSync(dir, {recursive: true, force: true}); });

  const api = async (p, init) => (await fetch(`${url}/api/v1${p}`, init)).json();
  const put = (id, body) => fetch(`${url}/api/v1/customers/${id}`, {method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)});
  const reset = async () => {
    for (const c of await api('/customers')) await fetch(`${url}/api/v1/customers/${c.id}`, {method: 'DELETE'});
    for (const c of CUSTOMERS) { const {id, ...data} = c; await put(id, data); }
  };

  test('new jobs are added, owned fields changed, links saved; the user\'s own fields are kept; a second run changes nothing', async () => {
    await reset();
    const {manifest, settings} = await loadPlugin(EXAMPLE, 'example-invoices');
    const before = await api('/customers');
    const plan = await manifest.run(makeContext({manifest, settings, env: ENV, customers: before, fetchImpl: fakeFetch}));
    const {applyPlan} = require('../tools/integration');
    expect(await applyPlan(diffPlan(plan, manifest, before), manifest, url)).toEqual({created: 1, updated: 1, linked: 1});

    const c1 = await api('/customers/c1'), c2 = await api('/customers/c2');
    expect(c1.jobs).toEqual([plan.jobs[0].item]);
    expect(c1.lastJob).toEqual({title: 'Fotografering', date: '2026-10-01'});   // the server's rules ran
    expect(c1.ext['example-invoices']).toEqual({customerId: 'svc-1'});
    expect(c2.jobs[0]).toMatchObject({title: 'Egen titel', amount: '9 000', invoiceStatus: 'paid'});

    const after = await api('/customers');
    const again = diffPlan(await manifest.run(makeContext({manifest, settings, env: ENV, customers: after, fetchImpl: fakeFetch})), manifest, after);
    expect(again).toEqual({create: [], update: [], links: []});
    expect(await applyPlan(again, manifest, url)).toEqual({created: 0, updated: 0, linked: 0});
  });

  test('a customer changed by someone else in between is read again, and their change is kept', async () => {
    await reset();
    const {manifest, settings} = await loadPlugin(EXAMPLE, 'example-invoices');
    const before = await api('/customers');
    const diff = diffPlan(await manifest.run(makeContext({manifest, settings, env: ENV, customers: before, fetchImpl: fakeFetch})), manifest, before);
    await fetch(`${url}/api/v1/customers/c1`, {method: 'PATCH', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({notes: 'Ändrad under tiden'})});
    const {applyPlan} = require('../tools/integration');
    expect(await applyPlan(diff, manifest, url)).toEqual({created: 1, updated: 1, linked: 1});
    const c1 = await api('/customers/c1');
    expect(c1.notes).toBe('Ändrad under tiden');
    expect(c1.jobs.length).toBe(1);
  });

  test('the command: a dry run writes nothing, --apply writes, and the key is never printed', async () => {
    await reset();
    const brand = tempPlugin('test-plugin', manifestSource(`
      return {jobs: [{customerId: 'c1', item: {id: 'test-plugin-1', title: 'Från tjänsten', date: '2026-10-02', invoiceStatus: 'published', invoiceNumber: 7}}],
        notes: ['klart']};`, "env: ['TEST_PLUGIN_KEY'], owns: {jobs: ['invoiceStatus']},"));
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'crm-integration-home-'));
    tempDirs.push(home);
    const run = (...extra) => spawnSync(process.execPath, [path.join(ROOT, 'tools', 'integration.js'), 'test-plugin', '--brand', brand, '--url', url, ...extra],
      {encoding: 'utf8', env: {...process.env, HOME: home, TEST_PLUGIN_KEY: 'not-a-real-key-0000'}});
    const dry = run();
    expect(dry.status).toBe(0);
    expect(dry.stdout).toMatch(/1 new job/);
    expect(dry.stdout).toMatch(/Exempelbolaget AB: Från tjänsten \(invoice 7\)/);
    expect(dry.stdout).toMatch(/Dry run: nothing is written/);
    expect((await api('/customers/c1')).jobs).toEqual([]);
    const applied = run('--apply');
    expect(applied.status).toBe(0);
    expect(applied.stdout).toMatch(/Written: 1 new job, 0 changed jobs, 0 customer links/);
    expect((await api('/customers/c1')).jobs.map(j => j.id)).toEqual(['test-plugin-1']);
    expect(dry.stdout + dry.stderr + applied.stdout + applied.stderr).not.toMatch('not-a-real-key');
    const missing = spawnSync(process.execPath, [path.join(ROOT, 'tools', 'integration.js'), 'test-plugin', '--brand', brand, '--url', url],
      {encoding: 'utf8', env: {...process.env, HOME: home, TEST_PLUGIN_KEY: ''}});
    expect(missing.status).toBe(2);
    expect(missing.stderr).toMatch(/TEST_PLUGIN_KEY/);
  });
});

describe('new customers in the plan (the service\'s customers must always be in the register)', () => {
  const manifest = {id: 'p', owns: {jobs: ['invoiceStatus']}};
  const plan = {
    customers: [{id: 'p-n1', data: {company: 'Ny Kund AB', email: 'ny@kund.example', status: 'kund', ext: {p: {customerId: 'n1'}}}}],
    jobs: [{customerId: 'p-n1', item: {id: 'p-inv-9', title: 'Faktura 9', date: '2026-10-01', invoiceStatus: 'published'}}]
  };

  test('checkPlan accepts a new customer, and jobs for it in the same plan', () => {
    expect(checkPlan(plan, manifest, CUSTOMERS)).toEqual([]);
  });

  test('checkPlan refuses a new customer with an existing id, an invalid id, invalid data or the same id twice', () => {
    const bad = (customers) => checkPlan({customers}, manifest, CUSTOMERS).join('\n');
    expect(bad([{id: 'c1', data: {company: 'X'}}])).toMatch(/already exists/);
    expect(bad([{id: 'a/b', data: {company: 'X'}}])).toMatch(/valid id/);
    expect(bad([{id: 'p-n2', data: {status: 'gammal'}}])).toMatch(/status/);
    expect(bad([{id: 'p-n3', data: {company: 'X'}}, {id: 'p-n3', data: {company: 'X'}}])).toMatch(/twice/);
  });

  test('diffPlan creates the customer and its jobs; formatPlan shows the new customer', () => {
    const diff = diffPlan(plan, manifest, CUSTOMERS);
    expect(diff.customers).toEqual(plan.customers);
    expect(diff.create.map(c => c.item.id)).toEqual(['p-inv-9']);
    const text = formatPlan(diff, plan, CUSTOMERS);
    expect(text).toMatch(/1 new customer/);
    expect(text).toMatch(/\+ new customer: Ny Kund AB/);
    expect(text).toMatch(/Ny Kund AB: Faktura 9/);
  });

  test('--apply creates the customer first (create only) and then its job; a second run creates nothing', async () => {
    const {spawn} = require('child_process');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'crm-integration-newcust-'));
    const server = spawn(process.execPath, [path.join(ROOT, 'server', 'dist', 'node.mjs'), '--port', '0', '--db', path.join(dir, 'crm.sqlite')], {cwd: dir});
    try {
      const url = await new Promise((resolve, reject) => {
        let out = '';
        server.stdout.on('data', d => { out += d; const m = /(http:\/\/127\.0\.0\.1:\d+)\/api\/v1\//.exec(out); if (m) resolve(m[1]); });
        server.on('exit', code => reject(new Error(`server exited with ${code}`)));
      });
      const {applyPlan} = require('../tools/integration');
      expect(await applyPlan(diffPlan(plan, manifest, []), manifest, url)).toEqual({customers: 1, created: 1, updated: 0, linked: 0});
      const c = await (await fetch(`${url}/api/v1/customers/p-n1`)).json();
      expect(c).toMatchObject({company: 'Ny Kund AB', email: 'ny@kund.example', status: 'kund', ext: {p: {customerId: 'n1'}}});
      expect(c.jobs.map(j => j.id)).toEqual(['p-inv-9']);
      expect(c.lastJob).toEqual({title: 'Faktura 9', date: '2026-10-01'});
      const now = await (await fetch(`${url}/api/v1/customers`)).json();
      expect(diffPlan(plan, manifest, now)).toEqual({customers: [], create: [], update: [], links: []});
    } finally {
      server.kill();
      fs.rmSync(dir, {recursive: true, force: true});
    }
  });
});

describe('a plugin cannot go around ctx', () => {
  test('using the global fetch or process is a type error', async () => {
    for (const body of ["await fetch('https://other.example/'); return {};", 'return {notes: [String(process.env.HOME)]};']) {
      const brand = tempPlugin('test-plugin', manifestSource(body));
      await expect(loadPlugin(brand, 'test-plugin')).rejects.toThrow(/type errors/);
    }
  });

  test('at run time there is no fetch, process or require, even reached around the type check', async () => {
    const brand = tempPlugin('test-plugin', manifestSource(`
      const g = globalThis as unknown as Record<string, unknown>;
      return {notes: ['fetch', 'process', 'require', 'XMLHttpRequest', 'WebSocket'].map(k => k + ':' + typeof g[k])};`));
    const {manifest} = await loadPlugin(brand, 'test-plugin');
    const plan = await manifest.run(makeContext({manifest, env: ENV, customers: [], fetchImpl: fakeFetch}));
    expect(plan.notes).toEqual(['fetch:undefined', 'process:undefined', 'require:undefined', 'XMLHttpRequest:undefined', 'WebSocket:undefined']);
  });

  test('URL and the built-ins a plugin needs are there', async () => {
    const brand = tempPlugin('test-plugin', manifestSource(`
      const u = new URL('https://invoices.example/v1?page=2');
      return {notes: [u.searchParams.get('page') ?? '', encodeURIComponent('a b'), JSON.stringify(structuredClone({x: 1})), new Date(0).toISOString()]};`));
    const {manifest} = await loadPlugin(brand, 'test-plugin');
    const plan = await manifest.run(makeContext({manifest, env: ENV, customers: [], fetchImpl: fakeFetch}));
    expect(plan.notes).toEqual(['2', 'a%20b', '{"x":1}', '1970-01-01T00:00:00.000Z']);
  });

  test('owns.jobs can never include the user\'s title, amount or link', async () => {
    for (const field of ['title', 'amount', 'invoiceUrl']) {
      const brand = tempPlugin('test-plugin', manifestSource('return {};', `owns: {jobs: ['${field}' as never]},`));
      await expect(loadPlugin(brand, 'test-plugin')).rejects.toThrow(/owns/);
    }
  });
});

describe('the second review: tighter limits', () => {
  const manifest = {id: 'p', env: ['EXAMPLE_INVOICES_KEY'], hosts: ['invoices.example']};

  test('ctx.fetch never follows a redirect (to another host)', async () => {
    let seen;
    const ctx = makeContext({manifest, env: ENV, customers: [], fetchImpl: async (url, init) => { seen = init; return new Response('{}'); }});
    await ctx.fetch('https://invoices.example/v1/x');
    expect(seen.redirect).toBe('error');
  });

  test('reading a variable the manifest did not declare throws', () => {
    const ctx = makeContext({manifest, env: ENV, customers: [], fetchImpl: fakeFetch});
    expect(() => ctx.config.UNRELATED).toThrow(/UNRELATED/);
    expect(ctx.config.EXAMPLE_INVOICES_KEY).toBe('not-a-real-key-0000');
  });

  test('a new customer may only have the plugin\'s own ext', () => {
    const issues = checkPlan({customers: [{id: 'p-n9', data: {company: 'X', ext: {p: {}, 'next-step': {}}}}]}, manifest, CUSTOMERS);
    expect(issues.join('\n')).toMatch(/next-step/);
    expect(checkPlan({customers: [{id: 'p-n9', data: {company: 'X', ext: {p: {}}}}]}, manifest, CUSTOMERS)).toEqual([]);
  });

  test('the command refuses a plan that holds a secret value, and masks one in an error', async () => {
    // A server with no customers, for the command to read them from
    const http = require('http');
    const server = http.createServer((req, res) => { res.setHeader('Content-Type', 'application/json'); res.end('[]'); });
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    const url = `http://127.0.0.1:${server.address().port}`;
    const run = (body, env = {}) => {
      const brand = tempPlugin('test-plugin', manifestSource(body, "env: ['TEST_PLUGIN_KEY'],"));
      const home = fs.mkdtempSync(path.join(os.tmpdir(), 'crm-integration-home-'));
      tempDirs.push(home);
      return new Promise(resolve => {
        const child = require('child_process').spawn(process.execPath, [path.join(ROOT, 'tools', 'integration.js'), 'test-plugin', '--brand', brand, '--url', url],
          {env: {...process.env, HOME: home, TEST_PLUGIN_KEY: 'not-a-real-key-0000', ...env}});
        let stdout = '', stderr = '';
        child.stdout.on('data', d => { stdout += d; });
        child.stderr.on('data', d => { stderr += d; });
        child.on('exit', status => resolve({status, stdout, stderr}));
      });
    };
    const leak = await run("return {notes: ['the key is ' + ctx.config.TEST_PLUGIN_KEY]};");
    const thrown = await run("throw new Error('failed with ' + ctx.config.TEST_PLUGIN_KEY);");
    server.close();
    for (const r of [leak, thrown]) {
      expect(r.status).toBe(1);
      expect(r.stdout + r.stderr).not.toMatch('not-a-real-key');
    }
    expect(leak.stderr).toMatch(/secret/);
    expect(thrown.stderr).toMatch(/failed with \*\*\*/);
  });

  test('an env file others can read gives a warning', () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'crm-integration-home-'));
    tempDirs.push(home);
    fs.mkdirSync(path.join(home, '.config', 'crm'), {recursive: true});
    const file = path.join(home, '.config', 'crm', 'test-plugin.env');
    fs.writeFileSync(file, 'TEST_PLUGIN_KEY=not-a-real-key-0000\n');
    fs.chmodSync(file, 0o644);
    const brand = tempPlugin('test-plugin', manifestSource('return {};', "env: ['TEST_PLUGIN_KEY'],"));
    const r = require('child_process').spawnSync(process.execPath, [path.join(ROOT, 'tools', 'integration.js'), 'test-plugin', '--brand', brand, '--url', 'http://127.0.0.1:9'],
      {encoding: 'utf8', env: {...process.env, HOME: home, TEST_PLUGIN_KEY: ''}});
    expect(r.stderr).toMatch(/WARNING.*test-plugin\.env.*chmod 600/);
    expect(r.stdout + r.stderr).not.toMatch('not-a-real-key');
  });
});
