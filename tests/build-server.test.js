/* Tests for tools/build-server.js : the API is built with Vite into one file for Node,
 * server/dist/node.mjs, which starts the local server. The build goes to a temporary folder. */
const fs = require('fs');
const os = require('os');
const path = require('path');
const {spawn, spawnSync} = require('child_process');

const ROOT = path.resolve(__dirname, '..');
jest.setTimeout(60000);
let out, r;
beforeAll(() => {
  out = fs.mkdtempSync(path.join(os.tmpdir(), 'crm-server-'));
  r = spawnSync(process.execPath, [path.join(ROOT, 'tools', 'build-server.js'), '--out-dir', out], {encoding: 'utf8'});
});
afterAll(() => fs.rmSync(out, {recursive: true, force: true}));

describe('tools/build-server.js', () => {
  test('exits with 0 and writes node.mjs with Hono built in', () => {
    expect(r.status).toBe(0);
    expect(fs.existsSync(path.join(out, 'node.mjs'))).toBe(true);
    expect(fs.readFileSync(path.join(out, 'node.mjs'), 'utf8')).not.toMatch(/^import .* from ['"](hono|@hono\/)/m);
  });

  test('the built server starts on 127.0.0.1 with a new database and answers the health endpoint', async () => {
    const db = path.join(out, 'data', 'crm.sqlite');
    const child = spawn(process.execPath, [path.join(out, 'node.mjs'), '--port', '0', '--db', db], {cwd: out});
    try {
      const url = await new Promise((resolve, reject) => {
        let text = '';
        child.stdout.on('data', d => { text += d; const m = /http:\/\/127\.0\.0\.1:\d+\/api\/v1\//.exec(text); if (m) resolve(m[0]); });
        child.on('exit', code => reject(new Error(`exited with ${code}`)));
      });
      const res = await fetch(`${url}health`);
      expect(res.status).toBe(200);
      expect((await res.json()).api).toBe('v1');
      expect(fs.existsSync(db)).toBe(true);
    } finally {
      child.kill();
    }
  });

  test('an unknown argument gives exit code 1 and a message', () => {
    const bad = spawnSync(process.execPath, [path.join(out, 'node.mjs'), '--nonsense'], {encoding: 'utf8', cwd: out});
    expect(bad.status).toBe(1);
    expect(bad.stderr).toMatch(/Unknown or incomplete argument/);
  });
});
