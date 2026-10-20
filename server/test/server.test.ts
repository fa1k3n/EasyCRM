/* The local server, the database, the health endpoint, the error format and the local protections. */
import fs from 'node:fs';
import path from 'node:path';
import {createApp} from '../src/app';
import {openSqlite} from '../src/sqlite';
import {SCHEMA_VERSION} from '../src/schema';
import {start} from '../src/node';
import type {Db} from '../src/db';
import {json, tempDir, testApi} from './helpers';

let t: ReturnType<typeof testApi>;
beforeEach(() => { t = testApi(); });
afterEach(() => t.close());

describe('health', () => {
  test('GET /api/v1/health answers with the API version and the schema version', async () => {
    const res = await t.app.request('/api/v1/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({api: 'v1', schema: SCHEMA_VERSION});
  });
});

describe('the error format', () => {
  test('an unknown path gives 404 with {error: {code, message}}', async () => {
    const res = await t.app.request('/api/v1/nothing-here');
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('not_found');
    expect(typeof body.error.message).toBe('string');
  });

  test('an unexpected error gives 500 with code "internal" and no details from the error', async () => {
    const broken = {schemaVersion: () => Promise.reject(new Error('secret detail'))} as unknown as Db;
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const res = await createApp({db: broken, local: true}).request('/api/v1/health');
      expect(res.status).toBe(500);
      const text = await res.text();
      expect(JSON.parse(text).error.code).toBe('internal');
      expect(text).not.toContain('secret detail');
    } finally {
      spy.mockRestore();
    }
  });
});

describe('the local protections', () => {
  test('a request with another Host (DNS rebinding) is refused with 403', async () => {
    const res = await t.app.request('http://evil.example/api/v1/health');
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe('forbidden_host');
  });

  test('localhost and 127.0.0.1 with a port are allowed', async () => {
    expect((await t.app.request('http://localhost:8787/api/v1/health')).status).toBe(200);
    expect((await t.app.request('http://127.0.0.1:8787/api/v1/health')).status).toBe(200);
  });

  test('a write without Content-Type application/json (e.g. a form on another page) is refused with 415', async () => {
    const res = await t.app.request('/api/v1/health', {method: 'POST', headers: {'Content-Type': 'text/plain'}, body: '{}'});
    expect(res.status).toBe(415);
    expect((await res.json()).error.code).toBe('unsupported_media_type');
  });

  test('a body over 1 MB is refused with 413', async () => {
    const res = await t.app.request('/api/v1/health', json('POST', {x: 'a'.repeat(1024 * 1024 + 1)}));
    expect(res.status).toBe(413);
    expect((await res.json()).error.code).toBe('too_large');
  });

  test('no CORS headers, not even for a preflight from another origin', async () => {
    const res = await t.app.request('/api/v1/health', {headers: {Origin: 'https://evil.example'}});
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
    const pre = await t.app.request('/api/v1/health', {
      method: 'OPTIONS', headers: {Origin: 'https://evil.example', 'Access-Control-Request-Method': 'PUT'}
    });
    expect(pre.headers.get('access-control-allow-origin')).toBeNull();
    expect(pre.headers.get('access-control-allow-methods')).toBeNull();
  });
});

describe('the SQLite database', () => {
  test('opening creates the schema; opening again keeps the data and the schema version', async () => {
    const file = path.join(t.dir, 'again.sqlite');
    const a = openSqlite(file);
    expect(await a.schemaVersion()).toBe(SCHEMA_VERSION);
    await a.put('customers', 'c1', {company: 'Exempelbolaget AB'});
    a.close();
    const b = openSqlite(file);
    expect(await b.schemaVersion()).toBe(SCHEMA_VERSION);
    expect((await b.get('customers', 'c1'))?.data).toEqual({company: 'Exempelbolaget AB'});
    b.close();
  });

  test('put, get, list and remove; the version grows with every write', async () => {
    const db = t.db;
    expect(await db.get('customers', 'c1')).toBeNull();
    const first = await db.put('customers', 'c1', {company: 'A'});
    expect(first).toMatchObject({id: 'c1', version: 1, data: {company: 'A'}});
    const second = await db.put('customers', 'c1', {company: 'B'});
    expect(second).toMatchObject({version: 2, data: {company: 'B'}});
    await db.put('skipped', 'exempel.se', {company: 'C'});
    expect((await db.list('customers')).map(r => r.id)).toEqual(['c1']);
    expect(await db.remove('customers', 'c1')).toBe('removed');
    expect(await db.remove('customers', 'c1')).toBe('missing');
    expect(await db.list('customers')).toEqual([]);
    expect((await db.list('skipped')).length).toBe(1);
  });

  test('expectVersion: a write or removal against another version is a conflict and changes nothing', async () => {
    const db = t.db;
    expect(await db.put('customers', 'c1', {company: 'A'}, 1)).toBe('conflict');
    expect(await db.put('customers', 'c1', {company: 'A'}, 0)).toMatchObject({version: 1});
    expect(await db.put('customers', 'c1', {company: 'B'}, 0)).toBe('conflict');
    expect(await db.put('customers', 'c1', {company: 'B'}, 1)).toMatchObject({version: 2});
    expect(await db.remove('customers', 'c1', 1)).toBe('conflict');
    expect((await db.get('customers', 'c1'))?.data).toEqual({company: 'B'});
    expect(await db.remove('customers', 'c1', 2)).toBe('removed');
  });

  test('the revision grows with every write and removal (the ETag of the lists)', async () => {
    const db = t.db;
    const r0 = await db.revision();
    await db.put('customers', 'c1', {});
    const r1 = await db.revision();
    await db.remove('customers', 'c1');
    const r2 = await db.revision();
    await db.remove('customers', 'c1');
    expect(r1).toBeGreaterThan(r0);
    expect(r2).toBeGreaterThan(r1);
    expect(await db.revision()).toBe(r2);
  });
});

describe('the Node entry', () => {
  test('start() listens on 127.0.0.1 only and answers the health endpoint', async () => {
    const dir = tempDir();
    const server = await start({port: 0, dbFile: path.join(dir, 'sub', 'crm.sqlite')});
    try {
      expect(server.host).toBe('127.0.0.1');
      const res = await fetch(`http://127.0.0.1:${server.port}/api/v1/health`);
      expect(res.status).toBe(200);
      expect(fs.existsSync(path.join(dir, 'sub', 'crm.sqlite'))).toBe(true);
    } finally {
      await server.close();
      fs.rmSync(dir, {recursive: true, force: true});
    }
  });
});
