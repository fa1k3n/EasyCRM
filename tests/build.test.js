/* Tests for tools/build.js (the TypeScript build with typescript from npm). Each build runs in a temporary copy,
 * so the real files are never changed. Covers the same cases as the old tests/tsc.Tests.ps1. */
const fs = require('fs');
const os = require('os');
const path = require('path');
const {spawnSync} = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const BUILD = path.join(ROOT, 'tools', 'build.js');
const OLD_JS = '// old logic.js\n';

let tmp;
beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'crm-build-')); });
afterEach(() => fs.rmSync(tmp, {recursive: true, force: true}));

const write = (file, text) => { fs.mkdirSync(path.dirname(file), {recursive: true}); fs.writeFileSync(file, text, 'utf8'); };
const read = file => fs.readFileSync(file, 'utf8');
// A copy of kundregister/ with the logic's modules (logic/) and tsconfig.json, and a stale logic.js.
// edit changes the text of logic/time.ts (e.g. to add a type error).
function appCopy(edit = t => t) {
  const dir = path.join(tmp, 'kundregister');
  fs.cpSync(path.join(ROOT, 'kundregister', 'logic'), path.join(dir, 'logic'), {recursive: true});
  write(path.join(dir, 'logic', 'time.ts'), edit(read(path.join(ROOT, 'kundregister', 'logic', 'time.ts'))));
  write(path.join(dir, 'tsconfig.json'), read(path.join(ROOT, 'kundregister', 'tsconfig.json')));
  write(path.join(dir, 'logic.js'), OLD_JS);
  return dir;
}
const run = (...args) => spawnSync(process.execPath, [BUILD, ...args], {encoding: 'utf8'});

describe('tools/build.js', () => {
  test('without --project the app in kundregister/ is built', () => {
    const {parseArgs, DEFAULT_PROJECT} = require(BUILD);
    expect(DEFAULT_PROJECT).toBe(path.join(ROOT, 'kundregister'));
    expect(parseArgs([]).project).toBe(DEFAULT_PROJECT);
  });

  describe('without type errors', () => {
    test('exits with 0, writes logic.js from the logic modules without types', () => {
      const dir = appCopy();
      const r = run('--project', dir);
      expect(r.status).toBe(0);
      const js = read(path.join(dir, 'logic.js'));
      expect(js).toMatch('CRMLogic');
      expect(js).not.toMatch('interface Customer');
    });

    test('gives exactly the committed logic.js', () => {
      const dir = appCopy();
      expect(run('--project', dir).status).toBe(0);
      expect(read(path.join(dir, 'logic.js'))).toBe(read(path.join(ROOT, 'kundregister', 'logic.js')).replace(/\r\n/g, '\n'));
    });
  });

  test('with a type error: exits with 1 and leaves logic.js untouched', () => {
    const dir = appCopy(t => t + "\nexport const fel: number = 'not a number';\n");
    const r = run('--project', dir);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/TS2322/);
    expect(read(path.join(dir, 'logic.js'))).toBe(OLD_JS);
  });

  describe('--project builds another folder (e.g. a mail plugin)', () => {
    test('writes all built files there and exits with 0', () => {
      const dir = path.join(tmp, 'plugin');
      write(path.join(dir, 'tsconfig.json'), '{"compilerOptions":{"target":"ES2020","strict":true,"noEmitOnError":true},"files":["a.ts","b.ts"]}');
      write(path.join(dir, 'a.ts'), 'const a: number = 1;\n');
      write(path.join(dir, 'b.ts'), "const b: string = 'b';\n");
      const appJs = path.join(ROOT, 'kundregister', 'logic.js');
      const before = fs.statSync(appJs).mtimeMs;
      expect(run('--project', dir).status).toBe(0);
      expect(fs.existsSync(path.join(dir, 'a.js'))).toBe(true);
      expect(fs.existsSync(path.join(dir, 'b.js'))).toBe(true);
      expect(fs.statSync(appJs).mtimeMs).toBe(before);   // the app's logic.js is not touched
    });

    test('with a type error: exits with 1 and writes no file', () => {
      const dir = path.join(tmp, 'plugin-error');
      write(path.join(dir, 'tsconfig.json'), '{"compilerOptions":{"target":"ES2020","strict":true,"noEmitOnError":true},"files":["a.ts"]}');
      write(path.join(dir, 'a.ts'), "const a: number = 'not a number';\n");
      expect(run('--project', dir).status).toBe(1);
      expect(fs.existsSync(path.join(dir, 'a.js'))).toBe(false);
    });
  });

  test('a folder without tsconfig.json: exits with 1', () => {
    const r = run('--project', tmp);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/tsconfig\.json/);
  });
});

describe('tools/build.js with a type-check-only project (noEmit, like the React app)', () => {
  test('no type errors: exits with 0 and writes no files', () => {
    const dir = path.join(tmp, 'check-only');
    write(path.join(dir, 'tsconfig.json'), '{"compilerOptions":{"target":"ES2020","strict":true,"noEmit":true},"files":["a.ts"]}');
    write(path.join(dir, 'a.ts'), 'const a: number = 1;\n');
    const r = run('--project', dir);
    expect(r.status).toBe(0);
    expect(fs.existsSync(path.join(dir, 'a.js'))).toBe(false);
    expect(r.stdout).toMatch(/no type errors/);
  });
  test('a type error: exits with 1', () => {
    const dir = path.join(tmp, 'check-only-error');
    write(path.join(dir, 'tsconfig.json'), '{"compilerOptions":{"target":"ES2020","strict":true,"noEmit":true},"files":["a.ts"]}');
    write(path.join(dir, 'a.ts'), "const a: number = 'x';\n");
    expect(run('--project', dir).status).toBe(1);
  });
});
