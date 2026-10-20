/* Tests for tools/cloudflare.js: the Cloudflare folder (the app as static assets, the API as a Worker with D1, the brand
 * as a variable), and the built Worker run locally by wrangler (workerd with a local D1 in a temporary folder).
 * The Cloudflare names are made up. */
const fs = require('fs');
const os = require('os');
const path = require('path');
const {spawnSync} = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const TOOL = path.join(ROOT, 'tools', 'cloudflare.js');
jest.setTimeout(180000);
const SETTINGS = {name: 'crm-test', databaseName: 'crm', databaseId: '00000000-0000-0000-0000-000000000000'};

let dir, brand;
beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'crm-cloudflare-test-'));
  brand = path.join(dir, 'brand');
  fs.cpSync(path.join(ROOT, 'example'), brand, {recursive: true});
});
afterAll(() => fs.rmSync(dir, {recursive: true, force: true}));

const run = (...args) => spawnSync(process.execPath, [TOOL, ...args], {encoding: 'utf8'});
const settings = s => fs.writeFileSync(path.join(brand, 'cloudflare.json'), JSON.stringify(s));

describe('tools/cloudflare.js', () => {
  test('without cloudflare.json it stops and says how to create the database in the EU', () => {
    fs.rmSync(path.join(brand, 'cloudflare.json'), {force: true});
    const r = run('--brand', brand, '--out-dir', path.join(dir, 'none'));
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/wrangler d1 create .* --jurisdiction eu/);
    expect(fs.existsSync(path.join(dir, 'none'))).toBe(false);
  });

  test('missing names in cloudflare.json are listed', () => {
    settings({name: 'Bad Name'});
    const r = run('--brand', brand, '--out-dir', path.join(dir, 'bad'));
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/"databaseName" is missing/);
    expect(r.stderr).toMatch(/"databaseId" is missing/);
    expect(r.stderr).toMatch(/"name" may only have/);
  });

  test('a brand that does not pass the checks stops it', () => {
    const broken = path.join(dir, 'broken');
    fs.cpSync(brand, broken, {recursive: true});
    fs.writeFileSync(path.join(broken, 'brand.json'), JSON.stringify({company: {name: ''}}));
    fs.writeFileSync(path.join(broken, 'cloudflare.json'), JSON.stringify(SETTINGS));
    const r = run('--brand', broken, '--out-dir', path.join(dir, 'broken-out'));
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/brand\.json/);
  });

  test('writes www/ (the app without the fake database), worker.mjs and wrangler.json with D1 and the brand', () => {
    settings({...SETTINGS, routes: [{pattern: 'crm.example', custom_domain: true}]});
    const out = path.join(dir, 'out');
    const r = run('--brand', brand, '--out-dir', out);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/npx wrangler deploy --config/);
    for (const f of ['www/index.html', 'www/app.js', 'www/logic.js', 'www/brand.js', 'www/logo.svg', 'worker.mjs']) expect(fs.existsSync(path.join(out, f))).toBe(true);
    expect(fs.readFileSync(path.join(out, 'www', 'index.html'), 'utf8')).not.toMatch('preview-stub');
    const config = JSON.parse(fs.readFileSync(path.join(out, 'wrangler.json'), 'utf8'));
    expect(config).toMatchObject({name: 'crm-test', main: 'worker.mjs', assets: {directory: 'www'},
      d1_databases: [{binding: 'DB', database_name: 'crm', database_id: SETTINGS.databaseId}], routes: [{pattern: 'crm.example', custom_domain: true}]});
    expect(JSON.parse(config.vars.BRAND).company.name).toBe('Example Studio Ltd');
    expect(config.account_id).toBeUndefined();
  });

  test('the Worker runs locally in workerd: the API with D1, the brand\'s language and the app on the same address', () => {
    const out = path.join(dir, 'out');
    // wrangler runs the Worker in its own Node process (inside jest it cannot read its files), answering with JSON;
    // it runs in the temporary folder, so wrangler's own .wrangler/ folder ends up there
    const script = `
      const {unstable_dev} = require(${JSON.stringify(require.resolve('wrangler'))});
      (async () => {
        const worker = await unstable_dev(process.argv[1], {config: process.argv[2], persistTo: process.argv[3], logLevel: 'none',
          experimental: {disableExperimentalWarning: true}});
        const json = {'Content-Type': 'application/json'};
        const r = {};
        try {
          r.health = await (await worker.fetch('/api/v1/health')).json();
          r.put = (await worker.fetch('/api/v1/customers/c1', {method: 'PUT', headers: json,
            body: JSON.stringify({company: 'Example Ltd', status: 'kund', followUp: {date: '2999-01-01'}})})).status;
          r.conflict = (await worker.fetch('/api/v1/customers/c1', {method: 'PATCH', headers: {...json, 'If-Match': '"5"'}, body: '{}'})).status;
          r.title = (await (await worker.fetch('/api/v1/calendar')).json()).items[0].title;
          const page = await worker.fetch('/');
          r.page = [page.status, (await page.text()).includes('<div id="root"></div>')];
          r.missing = (await worker.fetch('/api/v1/nothing')).status;
        } finally {
          await worker.stop();
        }
        console.log('RESULT ' + JSON.stringify(r));
      })().catch(e => { console.error(e); process.exit(1); });`;
    const res = spawnSync(process.execPath, ['-e', script, path.join(out, 'worker.mjs'), path.join(out, 'wrangler.json'), path.join(dir, 'state')],
      {encoding: 'utf8', cwd: dir, timeout: 150000});
    const line = (res.stdout || '').split('\n').find(l => l.startsWith('RESULT '));
    if (!line) throw new Error(`The Worker did not answer:\n${res.stdout}\n${res.stderr}`);
    expect(JSON.parse(line.slice(7))).toEqual({
      health: {api: 'v1', schema: 1}, put: 201, conflict: 412, title: 'Follow up: Example Ltd', page: [200, true], missing: 404
    });
  });
});

describe('tools/cloudflare.js and Cloudflare Access', () => {
  test('access in cloudflare.json becomes the Worker\'s ACCESS_TEAM_DOMAIN and ACCESS_AUD; without it a warning is printed', () => {
    const own = path.join(dir, 'access');
    fs.cpSync(path.join(ROOT, 'example'), own, {recursive: true});
    fs.writeFileSync(path.join(own, 'cloudflare.json'), JSON.stringify({...SETTINGS, access: {teamDomain: 'exempel.cloudflareaccess.com', aud: 'aud-0000'}}));
    const r = run('--brand', own, '--out-dir', path.join(dir, 'access-out'));
    expect(r.status).toBe(0);
    expect(r.stdout).not.toMatch(/WARNING/);
    const config = JSON.parse(fs.readFileSync(path.join(dir, 'access-out', 'wrangler.json'), 'utf8'));
    expect(config.vars).toMatchObject({ACCESS_TEAM_DOMAIN: 'exempel.cloudflareaccess.com', ACCESS_AUD: 'aud-0000'});

    fs.writeFileSync(path.join(own, 'cloudflare.json'), JSON.stringify(SETTINGS));
    const without = run('--brand', own, '--out-dir', path.join(dir, 'access-out'));
    expect(without.status).toBe(0);
    expect(without.stdout).toMatch(/WARNING.*Access/);
    expect(JSON.parse(fs.readFileSync(path.join(dir, 'access-out', 'wrangler.json'), 'utf8')).vars.ACCESS_AUD).toBeUndefined();
  });

  test('an access block without teamDomain or aud is refused', () => {
    const own = path.join(dir, 'access-bad');
    fs.cpSync(path.join(ROOT, 'example'), own, {recursive: true});
    fs.writeFileSync(path.join(own, 'cloudflare.json'), JSON.stringify({...SETTINGS, access: {teamDomain: 'exempel.cloudflareaccess.com'}}));
    const r = run('--brand', own, '--out-dir', path.join(dir, 'access-bad-out'));
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/access\.aud/);
  });
});
