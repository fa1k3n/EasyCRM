/* /api/v1/skipped (removed suggestions; the key comes from the logic's skipKey) and /api/v1/sync/{busy|calendar|gmail|integrations}
 * (the documents the agents sync, and the integration plugins' last runs). Both are whole documents written with PUT; If-Match works as for customers. */
import {Hono} from 'hono';
import type {Context} from 'hono';
import type {Env} from './app';
import type {Collection, Db, JsonObject} from './db';
import type {ErrorDetail} from './errors';
import {bodyObject, checkId, checkSize, conflict, docResponse, ifMatch, invalid, notFound, now, withoutId} from './docs';

export const SYNC_DOCS = ['busy', 'calendar', 'gmail', 'integrations'];

async function putDoc(c: Context<Env>, db: Db, collection: Collection, id: string, data: JsonObject) {
  checkSize(data);
  const existed = (await db.get(collection, id)) !== null;
  const row = await db.put(collection, id, data, ifMatch(c));
  if (row === 'conflict') throw conflict();
  return docResponse(c, row, existed ? 200 : 201);
}

async function getDoc(c: Context<Env>, db: Db, collection: Collection, id: string) {
  const row = await db.get(collection, id);
  if (!row) throw notFound();
  return docResponse(c, row);
}

function check(issues: ErrorDetail[]) {
  if (issues.length) throw invalid(issues);
}

export function skippedRoutes(db: Db) {
  const r = new Hono<Env>();
  r.get('/', async c => c.json((await db.list('skipped')).map(row => ({...row.data, id: row.id}))));
  r.get('/:key', c => getDoc(c, db, 'skipped', checkId(c.req.param('key'))));
  r.put('/:key', async c => {
    const body = withoutId(bodyObject(c));
    check(['company', 'website', 'at'].filter(k => body[k] != null && typeof body[k] !== 'string').map(path => ({path, message: 'must be text'})));
    return putDoc(c, db, 'skipped', checkId(c.req.param('key')), {...body, at: body.at ?? now()});
  });
  r.delete('/:key', async c => {
    const result = await db.remove('skipped', checkId(c.req.param('key')), ifMatch(c));
    if (result === 'conflict') throw conflict();
    if (result === 'missing') throw notFound();
    return c.body(null, 204);
  });
  return r;
}

export function syncRoutes(db: Db) {
  const r = new Hono<Env>();
  const docName = (name: string) => { if (!SYNC_DOCS.includes(name)) throw notFound(); return name; };
  r.get('/:doc', c => getDoc(c, db, 'sync', docName(c.req.param('doc'))));
  r.put('/:doc', async c => {
    const doc = docName(c.req.param('doc'));
    const body = withoutId(bodyObject(c));
    check(body.items != null && !Array.isArray(body.items) ? [{path: 'items', message: 'must be a list'}] : []);
    return putDoc(c, db, 'sync', doc, body);
  });
  return r;
}
