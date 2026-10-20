/* The customers: create, read, replace, merge and remove, with validation, ETag/If-Match and the size limit. */
import {json, testApi} from './helpers';

let t: ReturnType<typeof testApi>;
beforeEach(() => { t = testApi(); });
afterEach(() => t.close());

const req = (path: string, init?: RequestInit) => t.app.request(`/api/v1${path}`, init);
const create = async (body: object = {company: 'Exempelbolaget AB', status: 'kund'}) => {
  const res = await req('/customers', json('POST', body));
  expect(res.status).toBe(201);
  return res.json() as Promise<Record<string, unknown> & {id: string}>;
};
const etag = (res: Response) => res.headers.get('ETag');

describe('POST /customers', () => {
  test('creates a customer with a server id and the same starting values as the app', async () => {
    const res = await req('/customers', json('POST', {company: 'Exempelbolaget AB', jobs: [{title: 'x'}], lastContact: '2026-01-01', id: 'mine'}));
    expect(res.status).toBe(201);
    const c = await res.json();
    expect(c.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(c).toMatchObject({company: 'Exempelbolaget AB', jobs: [], comms: [], lastContact: null});
    expect(typeof c.createdAt).toBe('string');
    expect(c.updatedAt).toBe(c.createdAt);
    expect(res.headers.get('Location')).toBe(`/api/v1/customers/${c.id}`);
    expect(etag(res)).toBe('"1"');
  });

  test('an invalid customer gives 400 with code "validation" and the issues as details', async () => {
    const res = await req('/customers', json('POST', {status: 'gammal', types: 'x'}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('validation');
    expect(body.error.details.map((d: {path: string}) => d.path)).toEqual(['status', 'types']);
    expect((await (await req('/customers')).json())).toEqual([]);
  });

  test('a document over 256 kB gives 413', async () => {
    const res = await req('/customers', json('POST', {notes: 'a'.repeat(256 * 1024)}));
    expect(res.status).toBe(413);
    expect((await res.json()).error.code).toBe('too_large');
  });
});

describe('GET /customers', () => {
  test('lists all customers with their id; the ETag changes with every write and gives 304 when unchanged', async () => {
    const empty = await req('/customers');
    expect(await empty.json()).toEqual([]);
    const a = await create();
    const b = await create({company: 'Andra Exempel AB'});
    const res = await req('/customers');
    const list = await res.json();
    expect(list.map((c: {id: string}) => c.id).sort()).toEqual([a.id, b.id].sort());
    const tag = etag(res)!;
    expect(tag).not.toBe(etag(empty));
    const same = await req('/customers', {headers: {'If-None-Match': tag}});
    expect(same.status).toBe(304);
    await req(`/customers/${a.id}`, {method: 'DELETE'});
    const after = await req('/customers', {headers: {'If-None-Match': tag}});
    expect(after.status).toBe(200);
    expect((await after.json()).length).toBe(1);
  });
});

describe('GET /customers/{id}', () => {
  test('gives the customer with its version as ETag', async () => {
    const a = await create();
    const res = await req(`/customers/${a.id}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(a);
    expect(etag(res)).toBe('"1"');
  });
  test('an unknown id gives 404', async () => {
    const res = await req('/customers/finns-inte');
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe('not_found');
  });
});

describe('PUT /customers/{id}', () => {
  test('creates a customer with a known id (import, retries) and replaces it the next time', async () => {
    const first = await req('/customers/c1', json('PUT', {company: 'A', createdAt: '2026-01-01T00:00:00.000Z', notes: 'x'}));
    expect(first.status).toBe(201);
    expect(await first.json()).toMatchObject({id: 'c1', company: 'A', createdAt: '2026-01-01T00:00:00.000Z'});
    const second = await req('/customers/c1', json('PUT', {company: 'B'}));
    expect(second.status).toBe(200);
    const c = await second.json();
    expect(c).toMatchObject({id: 'c1', company: 'B', createdAt: '2026-01-01T00:00:00.000Z'});
    expect(c.notes).toBeUndefined();
    expect(etag(second)).toBe('"2"');
  });
  test('the same PUT twice gives the same document (idempotent) apart from the time and version', async () => {
    const body = {company: 'A', comms: [{id: 'm1', kind: 'mail_ut', date: '2026-10-01'}]};
    await req('/customers/c1', json('PUT', body));
    const a = await (await req('/customers/c1')).json();
    await req('/customers/c1', json('PUT', body));
    const b = await (await req('/customers/c1')).json();
    expect({...b, updatedAt: ''}).toEqual({...a, updatedAt: ''});
  });
  test('invalid data gives 400 and changes nothing', async () => {
    await req('/customers/c1', json('PUT', {company: 'A'}));
    expect((await req('/customers/c1', json('PUT', {company: 5}))).status).toBe(400);
    expect((await (await req('/customers/c1')).json()).company).toBe('A');
  });
});

describe('PATCH /customers/{id}', () => {
  test('merges the fields on the top level and updates updatedAt; null removes nothing but sets null', async () => {
    const a = await create({company: 'A', city: 'Exempelstad', status: 'kund'});
    const res = await req(`/customers/${a.id}`, json('PATCH', {status: 'potentiell', draft: null}));
    expect(res.status).toBe(200);
    const c = await res.json();
    expect(c).toMatchObject({company: 'A', city: 'Exempelstad', status: 'potentiell', draft: null, createdAt: a.createdAt});
    expect(etag(res)).toBe('"2"');
  });
  test('the id in the body is ignored', async () => {
    const a = await create();
    const c = await (await req(`/customers/${a.id}`, json('PATCH', {id: 'other', city: 'X'}))).json();
    expect(c.id).toBe(a.id);
    expect((await req('/customers/other')).status).toBe(404);
  });
  test('an unknown customer gives 404; an invalid patch 400', async () => {
    expect((await req('/customers/nope', json('PATCH', {city: 'X'}))).status).toBe(404);
    const a = await create();
    expect((await req(`/customers/${a.id}`, json('PATCH', {types: [1]}))).status).toBe(400);
  });
  test('the body must be an object', async () => {
    const a = await create();
    const res = await req(`/customers/${a.id}`, json('PATCH', [1, 2]));
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('validation');
  });
});

describe('If-Match (agents always send it)', () => {
  test('PATCH, PUT and DELETE with the wrong version give 412 and change nothing; the right version works', async () => {
    const a = await create();
    for (const [method, body] of [['PATCH', {city: 'X'}], ['PUT', {company: 'X'}], ['DELETE', undefined]] as const) {
      const res = await req(`/customers/${a.id}`, json(method, body, {'If-Match': '"7"'}));
      expect(res.status).toBe(412);
      expect((await res.json()).error.code).toBe('version_conflict');
    }
    expect((await (await req(`/customers/${a.id}`)).json())).toEqual(a);
    const ok = await req(`/customers/${a.id}`, json('PATCH', {city: 'X'}, {'If-Match': '"1"'}));
    expect(ok.status).toBe(200);
    expect(etag(ok)).toBe('"2"');
  });
  test('PUT with If-Match "0" only creates: an existing customer gives 412', async () => {
    expect((await req('/customers/c1', json('PUT', {company: 'A'}, {'If-Match': '"0"'}))).status).toBe(201);
    expect((await req('/customers/c1', json('PUT', {company: 'B'}, {'If-Match': '"0"'}))).status).toBe(412);
  });
  test('an If-Match that is not a version gives 400', async () => {
    const a = await create();
    const res = await req(`/customers/${a.id}`, json('PATCH', {city: 'X'}, {'If-Match': 'abc'}));
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('invalid_if_match');
  });
});

describe('DELETE /customers/{id}', () => {
  test('removes the customer (204); a second time gives 404', async () => {
    const a = await create();
    expect((await req(`/customers/${a.id}`, {method: 'DELETE'})).status).toBe(204);
    expect((await req(`/customers/${a.id}`, {method: 'DELETE'})).status).toBe(404);
    expect((await req(`/customers/${a.id}`)).status).toBe(404);
  });
});

describe('ids', () => {
  test('an id over 200 characters or with control characters gives 400', async () => {
    expect((await req(`/customers/${'a'.repeat(201)}`)).status).toBe(400);
    expect((await req('/customers/a%0Ab', json('PUT', {}))).status).toBe(400);
  });
});
