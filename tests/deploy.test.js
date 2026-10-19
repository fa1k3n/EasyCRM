/* Tests for tools/deploy.js: the check of a brand and the publish folder. The brands are built from example/ in a
 * temporary folder, so no real files change. --skip-repo-tests is used, since the repo's tests (which include this
 * file) would otherwise run themselves. Covers the cases of the old tests/deploy.Tests.ps1. */
const fs = require('fs');
const os = require('os');
const path = require('path');
const {spawnSync} = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SCRIPT = path.join(ROOT, 'tools', 'deploy.js');
jest.setTimeout(60000);
let tmp;
beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'crm-deploy-')); });
afterEach(() => fs.rmSync(tmp, {recursive: true, force: true}));

const write = (file, data) => { fs.mkdirSync(path.dirname(file), {recursive: true}); fs.writeFileSync(file, data); };
const read = file => fs.readFileSync(file, 'utf8');
const exists = (...p) => fs.existsSync(path.join(...p));
// A brand in the temp folder: the example's brand.json, changed by change(text), and the logo
function brand(name, change = t => t) {
  const dir = path.join(tmp, name);
  write(path.join(dir, 'brand.json'), change(read(path.join(ROOT, 'example', 'brand.json'))));
  fs.copyFileSync(path.join(ROOT, 'example', 'logo.svg'), path.join(dir, 'logo.svg'));
  return dir;
}
// What building the React app needs in a repo copy: the build tools, and links to the app, the logic and node_modules
function appParts(dir) {
  for (const f of ['build-app.js', 'build.js']) write(path.join(dir, 'tools', f), read(path.join(ROOT, 'tools', f)));
  for (const d of ['app', 'node_modules', path.join('crm', 'logic')]) fs.symlinkSync(path.join(ROOT, d), path.join(dir, d), 'junction');
}
function deploy(...args) {
  const r = spawnSync(process.execPath, [SCRIPT, ...args, '--skip-repo-tests'], {encoding: 'utf8'});
  return {code: r.status, out: r.stdout + r.stderr};
}

describe('tools/deploy.js', () => {
  describe('the example brand in the repo (example/)', () => {
    let out, r;
    beforeEach(() => { out = path.join(tmp, 'out'); r = deploy('--brand', path.join(ROOT, 'example'), '--out-dir', out); });

    test('is approved: exit code 0, the React app (index.html, app.js, app.css), logic.js, brand.js and the logo, no mail plugin', () => {
      expect(r.code).toBe(0);
      for (const f of ['index.html', 'app.js', 'app.css', 'logic.js', 'brand.js', 'logo.svg']) expect(exists(out, f)).toBe(true);
      expect(exists(out, 'mail.js')).toBe(false);
    });
    test('index.html is the React page fragment and logic.js the repo file', () => {
      expect(read(path.join(out, 'index.html'))).toBe(read(path.join(ROOT, 'app', 'index.html')));
      expect(read(path.join(out, 'logic.js'))).toBe(read(path.join(ROOT, 'crm', 'logic.js')));
    });
    test('brand.js sets window.BRAND to brand.json', () => {
      const js = read(path.join(out, 'brand.js'));
      expect(js.startsWith('window.BRAND = {')).toBe(true);
      expect(js).toMatch('Example Studio Ltd');
    });
    test('writes nothing in example/', () => expect(exists(ROOT, 'example', 'publish')).toBe(false));
  });

  test('brand.json missing: exit code 1, says what is missing, no publish folder', () => {
    const dir = path.join(tmp, 'empty');
    fs.mkdirSync(dir);
    const out = path.join(tmp, 'out-empty');
    const r = deploy('--brand', dir, '--out-dir', out);
    expect(r.code).toBe(1);
    expect(r.out).toMatch('brand.json');
    expect(fs.existsSync(out)).toBe(false);
  });

  const set = (from, to) => t => { expect(t).toContain(from); return t.replace(from, to); };
  test.each([
    ['invalid JSON', t => t.trimEnd().replace(/}$/, ',}'), /JSON/],
    ['company name missing', set('"company": {"name": "Example Studio Ltd"}', '"company": {}'), /company\.name/],
    ['invalid colour', set('"accent": "#0f766e"', '"accent": "grön"'), /colors\.accent/],
    ['too low contrast', set('"ink": "#1f2933"', '"ink": "#d0d4d4"'), /contrast/],
    ['customer type id not unique', set('"id": "projekt"', '"id": "konsultation"'), /unique/],
    ['customer type with unknown sender', set('"icon": "stjarna"}', '"icon": "stjarna", "sender": "finns-inte"}'), /finns-inte/],
    ['logo does not exist', set('"logo": "logo.svg"', '"logo": "saknas.png"'), /saknas\.png/],
    ['brand.json is not an object', () => '[1, 2]', /object/]
  ])('broken brand – %s: exit code 1, the error is named, no publish folder', (name, change, match) => {
    const dir = brand('broken', change);
    const out = path.join(dir, 'out');
    const r = deploy('--brand', dir, '--out-dir', out);
    expect(r.code).toBe(1);
    expect(r.out).toMatch(match);
    expect(fs.existsSync(out)).toBe(false);
  });

  test('an image larger than 1 MB is stopped and named', () => {
    const dir = brand('big-image');
    write(path.join(dir, 'stor.png'), Buffer.alloc(1024 * 1024 + 1));
    const r = deploy('--brand', dir, '--out-dir', path.join(dir, 'out'));
    expect(r.code).toBe(1);
    expect(r.out).toMatch('stor.png');
    expect(r.out).toMatch('1 MB');
  });

  describe("the brand's own tests (run-tests.js in the brand folder)", () => {
    test('are run with --repo, and a successful run is approved', () => {
      const dir = brand('tests-ok');
      write(path.join(dir, 'run-tests.js'), "const i = process.argv.indexOf('--repo');\nrequire('fs').writeFileSync(require('path').join(__dirname, 'repo.txt'), process.argv[i + 1]);\n");
      expect(deploy('--brand', dir, '--out-dir', path.join(dir, 'out')).code).toBe(0);
      expect(read(path.join(dir, 'repo.txt'))).toBe(ROOT);
    });
    test('a failing test stops the publishing', () => {
      const dir = brand('tests-fail');
      write(path.join(dir, 'run-tests.js'), 'process.exit(1);\n');
      const r = deploy('--brand', dir, '--out-dir', path.join(dir, 'out'));
      expect(r.code).toBe(1);
      expect(r.out).toMatch('tests');
      expect(exists(dir, 'out')).toBe(false);
    });
  });

  describe('the publish folder', () => {
    test('a folder with other files than deploy writes is not used, and the files are left untouched', () => {
      const dir = brand('folder');
      const out = path.join(dir, 'out');
      write(path.join(out, 'anteckningar.txt'), 'mitt');
      const r = deploy('--brand', dir, '--out-dir', out);
      expect(r.code).toBe(1);
      expect(r.out).toMatch('anteckningar.txt');
      expect(read(path.join(out, 'anteckningar.txt'))).toBe('mitt');
      expect(fs.existsSync(path.join(out, 'index.html'))).toBe(false);
    });
    test('without --out-dir it is written to publish/ in the brand folder', () => {
      const dir = brand('default-folder');
      expect(deploy('--brand', dir).code).toBe(0);
      expect(exists(dir, 'publish', 'brand.js')).toBe(true);
    });
  });
});

describe('tools/deploy.js (the React app)', () => {
  test('the publish folder gets the React page fragment, app.js and app.css', () => {
    const out = path.join(tmp, 'react-out');
    const r = deploy('--brand', path.join(ROOT, 'example'), '--out-dir', out);
    expect(r.code).toBe(0);
    for (const f of ['index.html', 'app.js', 'app.css', 'logic.js', 'brand.js', 'logo.svg']) expect(exists(out, f)).toBe(true);
    expect(read(path.join(out, 'index.html'))).toMatch('<div id="root"></div>');
  }, 120000);
});

// Without --brand, profile/ in the repo root is used (#3)
describe('tools/deploy.js and the profile/ folder (#3)', () => {
  function repoCopy(name) {
    const dir = path.join(tmp, name);
    write(path.join(dir, 'tools', 'deploy.js'), read(SCRIPT));
    write(path.join(dir, 'crm', 'logic.js'), read(path.join(ROOT, 'crm', 'logic.js')));
    fs.cpSync(path.join(ROOT, 'example'), path.join(dir, 'example'), {recursive: true});
    appParts(dir);
    return dir;
  }
  const run = repo => {
    const r = spawnSync(process.execPath, [path.join(repo, 'tools', 'deploy.js'), '--skip-repo-tests'], {encoding: 'utf8'});
    return {code: r.status, out: r.stdout + r.stderr};
  };
  test('without --brand, profile/ in the repo root is used, and the publish folder becomes profile/publish', () => {
    const repo = repoCopy('profile');
    fs.cpSync(path.join(repo, 'example'), path.join(repo, 'profile'), {recursive: true});
    const r = run(repo);
    expect(r.code).toBe(0);
    expect(read(path.join(repo, 'profile', 'publish', 'brand.js'))).toMatch('Example Studio Ltd');
    expect(r.out).not.toMatch('varumarke');
  });
  test('without a brand folder the error says how to create profile/ from example', () => {
    const r = run(repoCopy('none'));
    expect(r.code).toBe(1);
    expect(r.out).toMatch('cp -r example profile');
  });
});

test('a Swedish brand gets the errors from the brand check in Swedish', () => {
  const dir = brand('swedish', t => t.replace('"language": "en"', '"language": "sv"').replace('"company": {"name": "Example Studio Ltd"}', '"company": {}'));
  const r = deploy('--brand', dir, '--out-dir', path.join(dir, 'out'));
  expect(r.code).toBe(1);
  expect(r.out).toMatch('company.name saknas');
});
