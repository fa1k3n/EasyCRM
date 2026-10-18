/* Tests for tools/preview.js: which brand the preview uses, and which files it writes.
 * Runs in a temporary copy of what the preview needs, so that the repo's own root never gets a brand folder. */
const fs = require('fs');
const os = require('os');
const path = require('path');
const {spawnSync} = require('child_process');

const ROOT = path.resolve(__dirname, '..');
let tmp;
beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'crm-preview-')); });
afterEach(() => fs.rmSync(tmp, {recursive: true, force: true}));

const write = (file, data) => { fs.mkdirSync(path.dirname(file), {recursive: true}); fs.writeFileSync(file, data); };
const read = file => fs.readFileSync(file, 'utf8');
const exists = (...p) => fs.existsSync(path.join(...p));
function repoCopy(name) {
  const dir = path.join(tmp, name);
  for (const f of ['tools/preview.js', 'tools/preview-stub.js', 'kundregister/index.html', 'kundregister/logic.js', 'kundregister/logo.svg']) {
    write(path.join(dir, f), fs.readFileSync(path.join(ROOT, f)));
  }
  return dir;
}
const preview = (repo, ...args) => spawnSync(process.execPath, [path.join(repo, 'tools', 'preview.js'), ...args], {encoding: 'utf8'});

describe('tools/preview.js without --brand', () => {
  test('with varumarke/ in the repo root: uses it (brand.js from its brand.json)', () => {
    const repo = repoCopy('with');
    write(path.join(repo, 'varumarke', 'brand.json'), '{"company": {"name": "Provbolaget AB"}}');
    const out = path.join(tmp, 'with-out');
    expect(preview(repo, '--out-dir', out).status).toBe(0);
    expect(read(path.join(out, 'brand.js'))).toMatch('Provbolaget AB');
  });

  test('without varumarke/: shows the example company (no brand.js)', () => {
    const repo = repoCopy('without');
    const out = path.join(tmp, 'without-out');
    expect(preview(repo, '--out-dir', out).status).toBe(0);
    expect(exists(out, 'brand.js')).toBe(false);
    expect(exists(out, 'preview.html')).toBe(true);
  });
});

describe('tools/preview.js output', () => {
  test('preview.html wraps index.html and loads the fake database first; logic.js, the stub and the logo are copied', () => {
    const repo = repoCopy('files');
    const out = path.join(tmp, 'files-out');
    const r = preview(repo, '--out-dir', out);
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe(path.join(out, 'preview.html'));
    const html = read(path.join(out, 'preview.html'));
    expect(html).toMatch(/^<!doctype html>/);
    expect(html.indexOf('preview-stub.js')).toBeLessThan(html.indexOf(read(path.join(repo, 'kundregister', 'index.html')).slice(0, 40)));
    for (const f of ['logic.js', 'preview-stub.js', 'logo.svg']) expect(exists(out, f)).toBe(true);
  });

  test('--brand: brand.js, the brand images and mail/mail.js are copied; old brand.js/mail.js are removed without brand', () => {
    const repo = repoCopy('brand');
    const brand = path.join(tmp, 'mybrand');
    write(path.join(brand, 'brand.json'), '{"company": {"name": "Annat AB"}}');
    write(path.join(brand, 'logga.png'), Buffer.from([137, 80, 78, 71]));
    write(path.join(brand, 'notes.txt'), 'not an image');
    write(path.join(brand, 'mail', 'mail.js'), 'window.CRM_MAIL = {};\n');
    const out = path.join(tmp, 'brand-out');
    expect(preview(repo, '--out-dir', out, '--brand', brand).status).toBe(0);
    expect(read(path.join(out, 'brand.js'))).toBe('window.BRAND = {"company": {"name": "Annat AB"}};\n');
    expect(exists(out, 'logga.png')).toBe(true);
    expect(exists(out, 'notes.txt')).toBe(false);
    expect(read(path.join(out, 'mail.js'))).toBe('window.CRM_MAIL = {};\n');

    expect(preview(repo, '--out-dir', out).status).toBe(0);
    expect(exists(out, 'brand.js')).toBe(false);
    expect(exists(out, 'mail.js')).toBe(false);
  });

  test('a brand folder without brand.json: exit code 1', () => {
    const repo = repoCopy('nobrand');
    const r = preview(repo, '--out-dir', path.join(tmp, 'x'), '--brand', path.join(tmp, 'missing'));
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch('brand.json');
  });
});

describe('tools/preview.js --react (the React app)', () => {
  test('builds the app and writes preview.html with the root element, app.js and app.css; the fake database loads first', () => {
    const out = path.join(tmp, 'react-out');
    const r = spawnSync(process.execPath, [path.join(ROOT, 'tools', 'preview.js'), '--react', '--out-dir', out, '--brand', path.join(ROOT, 'exempel')], {encoding: 'utf8'});
    expect(r.status).toBe(0);
    const html = read(path.join(out, 'preview.html'));
    expect(html).toMatch('<div id="root"></div>');
    expect(html.indexOf('preview-stub.js')).toBeLessThan(html.indexOf('app.js'));
    for (const f of ['app.js', 'app.css', 'logic.js', 'brand.js']) expect(exists(out, f)).toBe(true);
  }, 120000);
});

describe('tools/preview.js and the profile/ folder (#3)', () => {
  test('profile/ in the repo root is used, before an old varumarke/', () => {
    const repo = repoCopy('profile');
    write(path.join(repo, 'profile', 'brand.json'), '{"company": {"name": "Profilbolaget AB"}}');
    write(path.join(repo, 'varumarke', 'brand.json'), '{"company": {"name": "Gamla AB"}}');
    const out = path.join(tmp, 'profile-out');
    expect(preview(repo, '--out-dir', out).status).toBe(0);
    expect(read(path.join(out, 'brand.js'))).toMatch('Profilbolaget AB');
  });
  test('an old varumarke/ alone still works, with a message to rename it', () => {
    const repo = repoCopy('old');
    write(path.join(repo, 'varumarke', 'brand.json'), '{"company": {"name": "Gamla AB"}}');
    const out = path.join(tmp, 'old-out');
    const r = preview(repo, '--out-dir', out);
    expect(r.status).toBe(0);
    expect(read(path.join(out, 'brand.js'))).toMatch('Gamla AB');
    expect(r.stdout + r.stderr).toMatch(/rename.*varumarke.*profile/i);
  });
});
