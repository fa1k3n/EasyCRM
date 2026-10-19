/* Tests for tools/preview.js: which brand the preview uses, and which files it writes.
 * Runs in a temporary copy of what the preview needs, so that the repo's own root never gets a brand folder. */
const fs = require('fs');
const os = require('os');
const path = require('path');
const {spawnSync} = require('child_process');

const ROOT = path.resolve(__dirname, '..');
jest.setTimeout(60000);
let tmp;
beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'crm-preview-')); });
afterEach(() => fs.rmSync(tmp, {recursive: true, force: true}));

const write = (file, data) => { fs.mkdirSync(path.dirname(file), {recursive: true}); fs.writeFileSync(file, data); };
const read = file => fs.readFileSync(file, 'utf8');
const exists = (...p) => fs.existsSync(path.join(...p));
function repoCopy(name) {
  const dir = path.join(tmp, name);
  for (const f of ['tools/preview.js', 'tools/preview-stub.js', 'tools/build-app.js', 'tools/build.js', 'kundregister/logic.js', 'kundregister/logo.svg']) {
    write(path.join(dir, f), fs.readFileSync(path.join(ROOT, f)));
  }
  // Building the React app needs the app, the logic's types and node_modules; links instead of copies
  for (const d of ['app', 'node_modules', path.join('kundregister', 'logic')]) fs.symlinkSync(path.join(ROOT, d), path.join(dir, d), 'junction');
  return dir;
}
const preview = (repo, ...args) => spawnSync(process.execPath, [path.join(repo, 'tools', 'preview.js'), ...args], {encoding: 'utf8'});

describe('tools/preview.js without --brand', () => {
  test('with profile/ in the repo root: uses it (brand.js from its brand.json)', () => {
    const repo = repoCopy('with');
    write(path.join(repo, 'profile', 'brand.json'), '{"company": {"name": "Provbolaget AB"}}');
    const out = path.join(tmp, 'with-out');
    expect(preview(repo, '--out-dir', out).status).toBe(0);
    expect(read(path.join(out, 'brand.js'))).toMatch('Provbolaget AB');
  });

  test('without profile/: shows the example company (no brand.js)', () => {
    const repo = repoCopy('without');
    const out = path.join(tmp, 'without-out');
    expect(preview(repo, '--out-dir', out).status).toBe(0);
    expect(exists(out, 'brand.js')).toBe(false);
    expect(exists(out, 'preview.html')).toBe(true);
  });
});

describe('tools/preview.js output', () => {
  test('preview.html wraps the React page fragment and loads the fake database first; app.js, app.css, logic.js, the stub and the logo are copied', () => {
    const repo = repoCopy('files');
    const out = path.join(tmp, 'files-out');
    const r = preview(repo, '--out-dir', out);
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe(path.join(out, 'preview.html'));
    const html = read(path.join(out, 'preview.html'));
    expect(html).toMatch(/^<!doctype html>/);
    expect(html).toMatch('<div id="root"></div>');
    expect(html.indexOf('preview-stub.js')).toBeLessThan(html.indexOf('app.js'));
    for (const f of ['app.js', 'app.css', 'logic.js', 'preview-stub.js', 'logo.svg']) expect(exists(out, f)).toBe(true);
  });

  test('--brand: brand.js and the brand images are copied; an old brand.js is removed without brand', () => {
    const repo = repoCopy('brand');
    const brand = path.join(tmp, 'mybrand');
    write(path.join(brand, 'brand.json'), '{"company": {"name": "Annat AB"}}');
    write(path.join(brand, 'logga.png'), Buffer.from([137, 80, 78, 71]));
    write(path.join(brand, 'notes.txt'), 'not an image');
    const out = path.join(tmp, 'brand-out');
    expect(preview(repo, '--out-dir', out, '--brand', brand).status).toBe(0);
    expect(read(path.join(out, 'brand.js'))).toBe('window.BRAND = {"company": {"name": "Annat AB"}};\n');
    expect(exists(out, 'logga.png')).toBe(true);
    expect(exists(out, 'notes.txt')).toBe(false);

    expect(preview(repo, '--out-dir', out).status).toBe(0);
    expect(exists(out, 'brand.js')).toBe(false);
  });

  test('a brand folder without brand.json: exit code 1', () => {
    const repo = repoCopy('nobrand');
    const r = preview(repo, '--out-dir', path.join(tmp, 'x'), '--brand', path.join(tmp, 'missing'));
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch('brand.json');
  });
});

describe('tools/preview.js (the React app)', () => {
  test('builds the app and writes preview.html with the root element, app.js and app.css; the fake database loads first', () => {
    const out = path.join(tmp, 'react-out');
    const r = spawnSync(process.execPath, [path.join(ROOT, 'tools', 'preview.js'), '--out-dir', out, '--brand', path.join(ROOT, 'exempel')], {encoding: 'utf8'});
    expect(r.status).toBe(0);
    const html = read(path.join(out, 'preview.html'));
    expect(html).toMatch('<div id="root"></div>');
    expect(html.indexOf('preview-stub.js')).toBeLessThan(html.indexOf('app.js'));
    for (const f of ['app.js', 'app.css', 'logic.js', 'brand.js']) expect(exists(out, f)).toBe(true);
  }, 120000);
});
