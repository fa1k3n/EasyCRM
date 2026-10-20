/* /api/v1/customers: the customer documents. Every write is validated with the logic's validateCustomer and updates
 * updatedAt and the version; If-Match makes a write conditional (agents always send it). */
import {Hono} from 'hono';
import {newCustomerDefaults} from '../../crm/logic/card';
import {validateCustomer} from '../../crm/logic/validate';
import type {Env} from './app';
import type {Db, DocRow, JsonObject} from './db';
import {bodyObject, checkId, checkSize, conflict, docResponse, ifMatch, invalid, notFound, now, withoutId} from './docs';

export function validate(data: JsonObject) {
  const issues = validateCustomer(data);
  if (issues.length) throw invalid(issues);
}

/* Reads the customer, changes it with change() and writes it with updatedAt, only if nobody wrote in between. With the
 * client's If-Match (expect) a changed customer gives 412; without it the change is made again on the new version. */
export async function modifyCustomer(db: Db, id: string, expect: number | undefined, change: (data: JsonObject) => JsonObject): Promise<DocRow> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const old = await db.get('customers', id);
    if (!old) throw notFound();
    if (expect !== undefined && expect !== old.version) throw conflict();
    const data = {...change(old.data), updatedAt: now()};
    checkSize(data);
    const row = await db.put('customers', id, data, old.version);
    if (row !== 'conflict') return row;
    if (expect !== undefined) throw conflict();
  }
  throw conflict();
}

export function customerRoutes(db: Db) {
  const r = new Hono<Env>();

  r.get('/', async c => {
    const tag = `"r${await db.revision()}"`;
    if (c.req.header('If-None-Match') === tag) return c.body(null, 304, {ETag: tag});
    const rows = await db.list('customers');
    c.header('ETag', tag);
    return c.json(rows.map(row => ({...row.data, id: row.id})));
  });

  r.post('/', async c => {
    const body = withoutId(bodyObject(c));
    validate(body);
    const at = now();
    // The logic's starting values, the same as the app's (they always win)
    const data = {...body, ...newCustomerDefaults(at)};
    checkSize(data);
    const row = await db.put('customers', crypto.randomUUID(), data, 0);
    if (row === 'conflict') throw conflict();
    c.header('Location', `/api/v1/customers/${row.id}`);
    return docResponse(c, row, 201);
  });

  r.get('/:id', async c => {
    const row = await db.get('customers', checkId(c.req.param('id')));
    if (!row) throw notFound();
    return docResponse(c, row);
  });

  // Replaces the whole document, or creates it with this id (import, retries)
  r.put('/:id', async c => {
    const id = checkId(c.req.param('id'));
    const expect = ifMatch(c);
    const body = withoutId(bodyObject(c));
    validate(body);
    const old = await db.get('customers', id);
    const at = now();
    const data = {...body, createdAt: body.createdAt ?? old?.data.createdAt ?? at, updatedAt: at};
    checkSize(data);
    const row = await db.put('customers', id, data, expect);
    if (row === 'conflict') throw conflict();
    return docResponse(c, row, old ? 200 : 201);
  });

  // Merges the fields on the top level, like update in the artifact database
  r.patch('/:id', async c => {
    const patch = withoutId(bodyObject(c));
    validate(patch);
    const row = await modifyCustomer(db, checkId(c.req.param('id')), ifMatch(c), data => ({...data, ...patch}));
    return docResponse(c, row);
  });

  r.delete('/:id', async c => {
    const result = await db.remove('customers', checkId(c.req.param('id')), ifMatch(c));
    if (result === 'conflict') throw conflict();
    if (result === 'missing') throw notFound();
    return c.body(null, 204);
  });

  return r;
}
