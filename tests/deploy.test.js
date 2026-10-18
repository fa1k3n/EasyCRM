/* Tests for tools/deploy.js: the check of a brand and the publish folder. The brands are built from exempel/ in a
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
  write(path.join(dir, 'brand.json'), change(read(path.join(ROOT, 'exempel', 'brand.json'))));
  fs.copyFileSync(path.join(ROOT, 'exempel', 'logo.svg'), path.join(dir, 'logo.svg'));
  return dir;
}
function deploy(...args) {
  const r = spawnSync(process.execPath, [SCRIPT, ...args, '--skip-repo-tests'], {encoding: 'utf8'});
  return {code: r.status, out: r.stdout + r.stderr};
}

describe('tools/deploy.js', () => {
  describe('the example brand in the repo (exempel/)', () => {
    let out, r;
    beforeEach(() => { out = path.join(tmp, 'out'); r = deploy('--brand', path.join(ROOT, 'exempel'), '--out-dir', out); });

    test('is approved: exit code 0, index.html, logic.js, brand.js and the logo, no mail plugin', () => {
      expect(r.code).toBe(0);
      for (const f of ['index.html', 'logic.js', 'brand.js', 'logo.svg']) expect(exists(out, f)).toBe(true);
      expect(exists(out, 'mail.js')).toBe(false);
    });
    test('index.html and logic.js are the repo files', () => {
      expect(read(path.join(out, 'index.html'))).toBe(read(path.join(ROOT, 'kundregister', 'index.html')));
      expect(read(path.join(out, 'logic.js'))).toBe(read(path.join(ROOT, 'kundregister', 'logic.js')));
    });
    test('brand.js sets window.BRAND to brand.json', () => {
      const js = read(path.join(out, 'brand.js'));
      expect(js.startsWith('window.BRAND = {')).toBe(true);
      expect(js).toMatch('Exempelstudion AB');
    });
    test('writes nothing in exempel/', () => expect(exists(ROOT, 'exempel', 'publicera')).toBe(false));
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
    ['company name missing', set('"company": {"name": "Exempelstudion AB"}', '"company": {}'), /company\.name/],
    ['invalid colour', set('"accent": "#0f766e"', '"accent": "grön"'), /colors\.accent/],
    ['too low contrast', set('"ink": "#1f2933"', '"ink": "#d0d4d4"'), /kontrast/],
    ['customer type id not unique', set('"id": "projekt"', '"id": "konsultation"'), /unikt/],
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

  describe('mail plugin', () => {
    test('a ready mail/mail.js is included', () => {
      const dir = brand('mail-js');
      write(path.join(dir, 'mail', 'mail.js'), 'window.CRM_MAIL = {};\n');
      const out = path.join(dir, 'out');
      expect(deploy('--brand', dir, '--out-dir', out).code).toBe(0);
      expect(read(path.join(out, 'mail.js'))).toBe('window.CRM_MAIL = {};\n');
    });
    test('a mail.js from an earlier run is removed when the plugin no longer exists', () => {
      const dir = brand('mail-old');
      const out = path.join(dir, 'out');
      write(path.join(out, 'mail.js'), '// from an earlier run\n');
      expect(deploy('--brand', dir, '--out-dir', out).code).toBe(0);
      expect(fs.existsSync(path.join(out, 'mail.js'))).toBe(false);
    });
  });

  describe('mail plugin in TypeScript (mail/tsconfig.json)', () => {
    test('is built against the contract in the repo and included', () => {
      const dir = brand('mail-ts');
      write(path.join(dir, 'mail', 'tsconfig.json'), '{"compilerOptions":{"target":"ES2020","strict":true,"noEmitOnError":true},"files":["mail.ts","mail-api.d.ts"]}');
      write(path.join(dir, 'mail', 'mail.ts'), 'const mod: CrmMailModule | undefined = undefined;\n');
      const out = path.join(dir, 'out');
      expect(deploy('--brand', dir, '--out-dir', out).code).toBe(0);
      expect(exists(dir, 'mail', 'mail-api.d.ts')).toBe(true);
      expect(read(path.join(out, 'mail.js'))).toMatch('const mod = undefined');
    });
    test('a type error stops the publishing', () => {
      const dir = brand('mail-ts-error');
      write(path.join(dir, 'mail', 'tsconfig.json'), '{"compilerOptions":{"target":"ES2020","strict":true,"noEmitOnError":true},"files":["mail.ts"]}');
      write(path.join(dir, 'mail', 'mail.ts'), "const a: number = 'not a number';\n");
      const r = deploy('--brand', dir, '--out-dir', path.join(dir, 'out'));
      expect(r.code).toBe(1);
      expect(r.out).toMatch('mail');
      expect(exists(dir, 'out')).toBe(false);
    });
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
    test('an old run-tests.ps1 stops the publishing with an explanation', () => {
      const dir = brand('tests-ps1');
      write(path.join(dir, 'run-tests.ps1'), 'exit 0\n');
      const r = deploy('--brand', dir, '--out-dir', path.join(dir, 'out'));
      expect(r.code).toBe(1);
      expect(r.out).toMatch('run-tests.js');
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
    test('without --out-dir it is written to publicera/ in the brand folder', () => {
      const dir = brand('default-folder');
      expect(deploy('--brand', dir).code).toBe(0);
      expect(exists(dir, 'publicera', 'brand.js')).toBe(true);
    });
  });

  // Without --brand, varumarke/ in the repo root is used. Runs in a temporary copy of what deploy needs,
  // so that the repo's own root never gets a varumarke/.
  describe('without --brand', () => {
    function repoCopy(name) {
      const dir = path.join(tmp, name);
      write(path.join(dir, 'tools', 'deploy.js'), read(SCRIPT));
      for (const f of ['index.html', 'logic.js', 'mail-api.d.ts']) write(path.join(dir, 'kundregister', f), read(path.join(ROOT, 'kundregister', f)));
      fs.cpSync(path.join(ROOT, 'exempel'), path.join(dir, 'exempel'), {recursive: true});
      return dir;
    }
    const run = repo => {
      const r = spawnSync(process.execPath, [path.join(repo, 'tools', 'deploy.js'), '--skip-repo-tests'], {encoding: 'utf8'});
      return {code: r.status, out: r.stdout + r.stderr};
    };
    test('varumarke/ in the repo root is used, and the publish folder becomes varumarke/publicera', () => {
      const repo = repoCopy('repo-with');
      fs.cpSync(path.join(repo, 'exempel'), path.join(repo, 'varumarke'), {recursive: true});
      expect(run(repo).code).toBe(0);
      expect(read(path.join(repo, 'varumarke', 'publicera', 'brand.js'))).toMatch('Exempelstudion AB');
    });
    test('without varumarke/: exit code 1 and an error that says how to create it from exempel', () => {
      const r = run(repoCopy('repo-without'));
      expect(r.code).toBe(1);
      expect(r.out).toMatch('varumarke');
      expect(r.out).toMatch('exempel');
    });
  });
});
