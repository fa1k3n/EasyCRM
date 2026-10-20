/* Tests for tools/data.js: moving data between claude.ai (the backup folder from ArtifactData) and the REST API, as one
 * JSON file. The round trip claude.ai → localhost → claude.ai must keep every field. All data is made up. */
const fs = require('fs');
const os = require('os');
const path = require('path');
const {spawn, spawnSync} = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const TOOL = path.join(ROOT, 'tools', 'data.js');
jest.setTimeout(60000);
let dir;
beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'crm-data-')); });
afterEach(() => fs.rmSync(dir, {recursive: true, force: true}));

const run = (...args) => spawnSync(process.execPath, [TOOL, ...args], {encoding: 'utf8'});
const write = (file, data) => { fs.mkdirSync(path.dirname(file), {recursive: true}); fs.writeFileSync(file, JSON.stringify(data, null, 2)); };
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));

/* A backup folder as ArtifactData list writes it: one folder per collection, one file per document */
function backup(root) {
  write(path.join(root, 'customers', 'c1.json'), {company: 'Exempelbolaget AB', status: 'kund', types: ['konsultation'],
    comms: [{id: 'm1', kind: 'mail_ut', date: '2026-02-01', subject: 'Hej'}], bokioCustomerId: 'x-1', ext: {'next-step': {text: 'Ring'}}});
  write(path.join(root, 'customers', 'c2.json'), {company: 'Andra Exempel AB', status: 'potentiell', emailConfidence: 'gissad'});
  write(path.join(root, 'skipped', 'exempel.se.json'), {company: 'Exempel', website: 'https://exempel.se', at: '2026-03-01T00:00:00.000Z'});
  write(path.join(root, 'sync', 'busy.json'), {items: [{date: '2026-10-20', time: '10:00', title: 'Upptagen'}]});
  fs.mkdirSync(path.join(root, 'profile'), {recursive: true});
  write(path.join(root, 'notes.json'), {not: 'a collection'});
}

describe('pack and unpack', () => {
  test('pack makes one export file of the backup folder\'s collections (other folders and files are left out)', () => {
    backup(path.join(dir, 'b'));
    const r = run('pack', path.join(dir, 'b'), '--out', path.join(dir, 'export.json'));
    expect(r.status).toBe(0);
    const file = read(path.join(dir, 'export.json'));
    expect(file.format).toBe('crm-export');
    expect(file.version).toBe(1);
    expect(Object.keys(file.collections.customers).sort()).toEqual(['c1', 'c2']);
    expect(file.collections.skipped['exempel.se'].website).toBe('https://exempel.se');
    expect(file.collections.sync.busy.items.length).toBe(1);
    expect(r.stdout).toMatch(/2 customers, 1 skipped, 1 sync/);
  });

  test('unpack writes the backup folder again, file for file the same', () => {
    backup(path.join(dir, 'b'));
    run('pack', path.join(dir, 'b'), '--out', path.join(dir, 'export.json'));
    const r = run('unpack', path.join(dir, 'export.json'), '--out-dir', path.join(dir, 'again'));
    expect(r.status).toBe(0);
    for (const f of ['customers/c1.json', 'customers/c2.json', 'skipped/exempel.se.json', 'sync/busy.json']) {
      expect(read(path.join(dir, 'again', f))).toEqual(read(path.join(dir, 'b', f)));
    }
  });

  test('unpack refuses a folder that is not empty', () => {
    backup(path.join(dir, 'b'));
    run('pack', path.join(dir, 'b'), '--out', path.join(dir, 'export.json'));
    const r = run('unpack', path.join(dir, 'export.json'), '--out-dir', path.join(dir, 'b'));
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/not empty/);
  });

  test('a file that is not an export is refused', () => {
    write(path.join(dir, 'x.json'), {hello: 1});
    const r = run('unpack', path.join(dir, 'x.json'), '--out-dir', path.join(dir, 'o'));
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/crm-export/);
  });

  test('an unknown command gives exit code 1 and the usage', () => {
    const r = run('nonsense');
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/Usage/);
  });
});

describe('push and pull against the local server (the round trip claude.ai → localhost → claude.ai)', () => {
  let server, url;
  beforeEach(async () => {
    server = spawn(process.execPath, [path.join(ROOT, 'server', 'dist', 'node.mjs'), '--port', '0', '--db', path.join(dir, 'crm.sqlite')], {cwd: dir});
    url = await new Promise((resolve, reject) => {
      let out = '';
      server.stdout.on('data', d => { out += d; const m = /(http:\/\/127\.0\.0\.1:\d+)\/api\/v1\//.exec(out); if (m) resolve(m[1]); });
      server.on('exit', code => reject(new Error(`server exited with ${code}`)));
    });
  });
  afterEach(() => server.kill());

  test('a dry run shows the plan and writes nothing; push writes; pull and unpack give the same files back', () => {
    backup(path.join(dir, 'b'));
    run('pack', path.join(dir, 'b'), '--out', path.join(dir, 'export.json'));
    const dry = run('push', path.join(dir, 'export.json'), '--url', url, '--dry-run');
    expect(dry.status).toBe(0);
    expect(dry.stdout).toMatch(/Dry run: would create 4, update 0, unchanged 0/);
    expect(run('pull', '--url', url, '--out', path.join(dir, 'empty.json')).status).toBe(0);
    expect(read(path.join(dir, 'empty.json')).collections.customers).toEqual({});

    const push = run('push', path.join(dir, 'export.json'), '--url', url);
    expect(push.status).toBe(0);
    expect(push.stdout).toMatch(/Imported: created 4, updated 0, unchanged 0/);
    expect(run('pull', '--url', url, '--out', path.join(dir, 'back.json')).status).toBe(0);
    expect(run('unpack', path.join(dir, 'back.json'), '--out-dir', path.join(dir, 'restore')).status).toBe(0);
    for (const f of ['customers/c1.json', 'customers/c2.json', 'skipped/exempel.se.json', 'sync/busy.json']) {
      expect(read(path.join(dir, 'restore', f))).toEqual(read(path.join(dir, 'b', f)));
    }
  });

  test('a refused import gives exit code 1 and the server\'s message', () => {
    write(path.join(dir, 'bad.json'), {format: 'crm-export', version: 1, collections: {customers: {c1: {status: 'gammal'}}}});
    const r = run('push', path.join(dir, 'bad.json'), '--url', url);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/customers\/c1: status/);
  });
});

describe('pull and push through Cloudflare Access (backup of the cloud database)', () => {
  test('the service token comes from CF_ACCESS_CLIENT_ID and CF_ACCESS_CLIENT_SECRET and is sent as Access headers, never printed', async () => {
    const http = require('http');
    const seen = [];
    const server = http.createServer((req, res) => {
      seen.push({id: req.headers['cf-access-client-id'], secret: req.headers['cf-access-client-secret']});
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({format: 'crm-export', version: 1, collections: {customers: {}, skipped: {}, sync: {}}}));
    });
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    const url = `http://127.0.0.1:${server.address().port}`;
    try {
      const {spawn} = require('child_process');
      const child = spawn(process.execPath, [TOOL, 'pull', '--url', url, '--out', path.join(dir, 'cloud.json')],
        {env: {...process.env, CF_ACCESS_CLIENT_ID: 'id-0000.access', CF_ACCESS_CLIENT_SECRET: 'not-a-real-secret'}});
      let out = '';
      child.stdout.on('data', d => { out += d; });
      child.stderr.on('data', d => { out += d; });
      const code = await new Promise(r => child.on('exit', r));
      expect(code).toBe(0);
      expect(seen).toEqual([{id: 'id-0000.access', secret: 'not-a-real-secret'}]);
      expect(out).not.toMatch('not-a-real-secret');
      expect(read(path.join(dir, 'cloud.json')).format).toBe('crm-export');
    } finally {
      server.close();
    }
  });
});
