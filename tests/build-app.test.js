/* Tests for tools/build-app.js: the React app (app/) is built with Vite into the files that are published as an
 * artifact: a page fragment (index.html), app.js and app.css. The build goes to a temporary folder. */
const fs = require('fs');
const os = require('os');
const path = require('path');
const {spawnSync} = require('child_process');

const ROOT = path.resolve(__dirname, '..');
jest.setTimeout(120000);
let out, r;
beforeAll(() => {
  out = fs.mkdtempSync(path.join(os.tmpdir(), 'crm-app-'));
  r = spawnSync(process.execPath, [path.join(ROOT, 'tools', 'build-app.js'), '--out-dir', out], {encoding: 'utf8'});
});
afterAll(() => fs.rmSync(out, {recursive: true, force: true}));
const read = f => fs.readFileSync(path.join(out, f), 'utf8');

describe('tools/build-app.js', () => {
  test('exits with 0 and writes index.html, app.js and app.css', () => {
    expect(r.status).toBe(0);
    for (const f of ['index.html', 'app.js', 'app.css']) expect(fs.existsSync(path.join(out, f))).toBe(true);
  });

  test('index.html is a page fragment (claude.ai adds the document around it) with a root element', () => {
    const html = read('index.html');
    expect(html).not.toMatch(/<html|<head|<body|<!doctype/i);
    expect(html).toMatch('<div id="root"></div>');
    expect(html).toMatch('<link rel="stylesheet" href="app.css">');
  });

  test('the brand, the logic and the optional mail plugin load before the app, as plain scripts', () => {
    const html = read('index.html');
    const at = s => html.indexOf(`<script src="${s}"></script>`);
    for (const s of ['brand.js', 'logic.js', 'mail.js', 'app.js']) expect(at(s)).toBeGreaterThan(-1);
    expect(at('brand.js')).toBeLessThan(at('logic.js'));
    expect(at('logic.js')).toBeLessThan(at('mail.js'));
    expect(at('mail.js')).toBeLessThan(at('app.js'));
    expect(html).not.toMatch('type="module"');
  });

  test('app.js is one self-contained script (no imports) with React in it', () => {
    const js = read('app.js');
    expect(js).not.toMatch(/^\s*import[\s{]/m);
    expect(js).toMatch('createRoot');
  });

  test("app.css is Tailwind's output with the theme pointing at the brand's colour variables", () => {
    const css = read('app.css');
    // @theme inline: the utilities use the brand's variables directly
    expect(css).toMatch('.bg-accent{background-color:var(--accent)}');
    expect(css).toMatch('--accent:#0f766e');
  });

  test('an unknown argument: exit code 1', () => {
    expect(spawnSync(process.execPath, [path.join(ROOT, 'tools', 'build-app.js'), '--nope'], {encoding: 'utf8'}).status).toBe(1);
  });
});
