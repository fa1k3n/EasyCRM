/* The D1 adapter (Cloudflare) against a D1 over node:sqlite: the same contract as the SQLite adapter, and the API on
 * top of it. Versions must be checked inside the database (D1 has no interactive transactions). */
import {createApp} from '../src/app';
import {openD1, type D1Like} from '../src/d1';
import type {Db} from '../src/db';
import {SCHEMA_VERSION} from '../src/schema';
import {fakeD1} from './fakeD1';
import {json} from './helpers';

let d1: ReturnType<typeof fakeD1>, db: Db;
beforeEach(async () => { d1 = fakeD1(); db = await openD1(d1 as unknown as D1Like); });
afterEach(() => d1.close());

test('opening creates the schema once; opening again keeps the data', async () => {
  expect(await db.schemaVersion()).toBe(SCHEMA_VERSION);
  await db.put('customers', 'c1', {company: 'A'});
  const again = await openD1(d1 as unknown as D1Like);
  expect(await again.schemaVersion()).toBe(SCHEMA_VERSION);
  expect((await again.get('customers', 'c1'))?.data).toEqual({company: 'A'});
});

test('put, get, list and remove; the version grows', async () => {
  expect(await db.put('customers', 'c1', {company: 'A'})).toMatchObject({id: 'c1', version: 1, data: {company: 'A'}});
  expect(await db.put('customers', 'c1', {company: 'B'})).toMatchObject({version: 2});
  await db.put('skipped', 'k', {});
  expect((await db.list('customers')).map(r => r.id)).toEqual(['c1']);
  expect(await db.remove('customers', 'c1')).toBe('removed');
  expect(await db.remove('customers', 'c1')).toBe('missing');
});

test('expectVersion is checked in the database: conflicts change nothing', async () => {
  expect(await db.put('customers', 'c1', {company: 'A'}, 1)).toBe('conflict');
  expect(await db.put('customers', 'c1', {company: 'A'}, 0)).toMatchObject({version: 1});
  expect(await db.put('customers', 'c1', {company: 'B'}, 0)).toBe('conflict');
  expect(await db.put('customers', 'c1', {company: 'B'}, 1)).toMatchObject({version: 2});
  expect(await db.remove('customers', 'c1', 1)).toBe('conflict');
  expect(await db.remove('customers', 'nope', 3)).toBe('conflict');
  expect((await db.get('customers', 'c1'))?.data).toEqual({company: 'B'});
  expect(await db.remove('customers', 'c1', 2)).toBe('removed');
});

test('the revision grows with writes and removals, not with conflicts', async () => {
  const r0 = await db.revision();
  await db.put('customers', 'c1', {});
  const r1 = await db.revision();
  await db.put('customers', 'c1', {}, 7);
  expect(await db.revision()).toBe(r1);
  await db.remove('customers', 'c1');
  expect(r1).toBeGreaterThan(r0);
  expect(await db.revision()).toBeGreaterThan(r1);
});

test('putMany writes everything in one batch', async () => {
  await db.putMany([{collection: 'customers', id: 'a', data: {x: 1}}, {collection: 'sync', id: 'busy', data: {items: []}}]);
  expect((await db.get('customers', 'a'))?.data).toEqual({x: 1});
  expect((await db.get('sync', 'busy'))?.version).toBe(1);
});

test('the API runs on the D1 adapter: create, read, merge with If-Match and the lists', async () => {
  const app = createApp({db});
  const req = (p: string, init?: RequestInit) => app.request(`/api/v1${p}`, init);
  const c = await (await req('/customers', json('POST', {company: 'Exempelbolaget AB', status: 'kund'}))).json();
  expect((await req(`/customers/${c.id}`, json('PATCH', {city: 'X'}, {'If-Match': '"9"'}))).status).toBe(412);
  expect((await req(`/customers/${c.id}`, json('PATCH', {city: 'X'}, {'If-Match': '"1"'}))).status).toBe(200);
  await req(`/customers/${c.id}/comms`, json('POST', {id: 'm1', kind: 'samtal', date: '2026-01-02'}));
  const got = await (await req(`/customers/${c.id}`)).json();
  expect(got).toMatchObject({city: 'X', lastContact: '2026-01-02', comms: [{id: 'm1'}]});
});
