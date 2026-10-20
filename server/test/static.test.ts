/* The local server can also serve the app's files (npm run serve): the page on /, the API stays under /api/v1/. */
import fs from 'node:fs';
import path from 'node:path';
import {start} from '../src/node';
import {tempDir} from './helpers';

let dir: string, server: Awaited<ReturnType<typeof start>>;
const get = (p: string) => fetch(`http://127.0.0.1:${server.port}${p}`);

beforeAll(async () => {
  dir = tempDir();
  const www = path.join(dir, 'www');
  fs.mkdirSync(www);
  fs.writeFileSync(path.join(www, 'index.html'), '<!doctype html><div id="root"></div>');
  fs.writeFileSync(path.join(www, 'app.js'), 'console.log(1);');
  fs.writeFileSync(path.join(dir, 'secret.txt'), 'outside');
  server = await start({port: 0, dbFile: path.join(dir, 'crm.sqlite'), staticDir: www});
});
afterAll(async () => { await server.close(); fs.rmSync(dir, {recursive: true, force: true}); });

test('/ gives index.html and the other files are served with their type', async () => {
  const page = await get('/');
  expect(page.status).toBe(200);
  expect(page.headers.get('content-type')).toMatch(/text\/html/);
  expect(await page.text()).toMatch('<div id="root">');
  const js = await get('/app.js');
  expect(js.headers.get('content-type')).toMatch(/javascript/);
});

test('the API is still under /api/v1/, and an unknown API path is the JSON error, not a file', async () => {
  expect((await (await get('/api/v1/health')).json()).api).toBe('v1');
  const res = await get('/api/v1/nothing');
  expect(res.status).toBe(404);
  expect((await res.json()).error.code).toBe('not_found');
});

test('files outside the folder cannot be reached', async () => {
  for (const p of ['/../secret.txt', '/%2e%2e/secret.txt', '/..%2Fsecret.txt']) {
    const res = await get(p);
    expect(res.status).toBe(404);
    expect(await res.text()).not.toMatch('outside');
  }
});

test('a missing file gives 404', async () => {
  expect((await get('/nothing.js')).status).toBe(404);
});
