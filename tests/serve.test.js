/* Tests for tools/serve.js (npm run serve): the app and the REST API on localhost, with the brand folder. The app is
 * built into a temporary folder and the built server (server/dist/node.mjs, from npm run build) serves it. */
const fs = require('fs');
const os = require('os');
const path = require('path');
const {spawn, spawnSync} = require('child_process');
const {buildPreview} = require('../tools/preview');

const ROOT = path.resolve(__dirname, '..');
jest.setTimeout(120000);

/* Starts tools/serve.js and resolves with the app's address when the server says it listens */
function serve(args) {
  const child = spawn(process.execPath, [path.join(ROOT, 'tools', 'serve.js'), ...args], {cwd: ROOT});
  const ready = new Promise((resolve, reject) => {
    let out = '';
    child.stdout.on('data', d => { out += d; const m = /App on (http:\/\/127\.0\.0\.1:\d+\/)/.exec(out); if (m) resolve(m[1]); });
    child.stderr.on('data', d => { out += d; });
    child.on('exit', code => reject(new Error(`serve.js exited with ${code}:\n${out}`)));
  });
  return {child, ready};
}

describe('buildPreview with api: true', () => {
  test('writes index.html without the fake database, with the brand and the logic', () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'crm-serve-page-'));
    try {
      expect(buildPreview({outDir: out, brand: path.join(ROOT, 'example'), api: true})).toBe(path.join(out, 'index.html'));
      const html = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
      expect(html).toMatch(/^<!doctype html>/);
      expect(html).not.toMatch('preview-stub');
      expect(fs.existsSync(path.join(out, 'preview-stub.js'))).toBe(false);
      for (const f of ['app.js', 'app.css', 'logic.js', 'brand.js', 'logo.svg']) expect(fs.existsSync(path.join(out, f))).toBe(true);
    } finally {
      fs.rmSync(out, {recursive: true, force: true});
    }
  });
});

describe('tools/serve.js', () => {
  let dir, run, url;
  beforeAll(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'crm-serve-'));
    run = serve(['--brand', path.join(ROOT, 'example'), '--port', '0', '--db', path.join(dir, 'crm.sqlite'), '--out-dir', path.join(dir, 'www')]);
    url = await run.ready;
  });
  afterAll(() => {
    run?.child.kill();
    fs.rmSync(dir, {recursive: true, force: true});
  });

  test('serves the page with the brand and the logic', async () => {
    const page = await (await fetch(url)).text();
    expect(page).toMatch('<div id="root"></div>');
    expect(await (await fetch(`${url}brand.js`)).text()).toMatch('Example Studio Ltd');
    expect((await fetch(`${url}logic.js`)).status).toBe(200);
  });

  test('the API answers on the same address and uses the brand\'s language', async () => {
    expect((await (await fetch(`${url}api/v1/health`)).json()).api).toBe('v1');
    await fetch(`${url}api/v1/customers/c1`, {method: 'PUT', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({company: 'Example Ltd', status: 'kund', followUp: {date: '2999-01-01'}})});
    const cal = await (await fetch(`${url}api/v1/calendar`)).json();
    expect(cal.items[0].title).toMatch(/^Follow up/);
  });

  test('the database is the given file', () => {
    expect(fs.existsSync(path.join(dir, 'crm.sqlite'))).toBe(true);
  });
});

test('an unknown argument gives exit code 1', () => {
  const r = spawnSync(process.execPath, [path.join(ROOT, 'tools', 'serve.js'), '--nonsense'], {encoding: 'utf8'});
  expect(r.status).toBe(1);
  expect(r.stderr).toMatch(/Unknown or incomplete argument/);
});
