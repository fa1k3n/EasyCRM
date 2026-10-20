/* Moving data between environments (claude.ai, localhost, the cloud) as one JSON file:
 *   {"format": "crm-export", "version": 1, "exportedAt": "…", "collections": {"customers": {"<id>": {…}}, "skipped": {…}, "sync": {…}}}
 * GET /export gives the whole database; POST /import writes a file (?dryRun=1 only shows what would change). The
 * import writes every document exactly as in the file, all in one transaction, and never removes anything. */
import {Hono} from 'hono';
import {validateCustomer} from '../../crm/logic/validate';
import type {Env} from './app';
import {SYNC_DOCS} from './collections';
import type {Collection, Db, JsonObject} from './db';
import {checkId, checkSize, invalid} from './docs';
import type {ErrorDetail} from './errors';

export const COLLECTIONS: Collection[] = ['customers', 'skipped', 'sync'];
const isObject = (v: unknown): v is JsonObject => typeof v === 'object' && v !== null && !Array.isArray(v);
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/* The file's documents, checked: the format, known collections, ids, sizes, valid customers and known sync documents.
 * Every problem is collected, so one answer lists them all. */
function readFile(body: unknown): {collection: Collection; id: string; data: JsonObject}[] {
  if (!isObject(body) || body.format !== 'crm-export' || body.version !== 1 || !isObject(body.collections)) {
    throw invalid([{path: '', message: 'must be {"format": "crm-export", "version": 1, "collections": {…}}'}]);
  }
  const docs: {collection: Collection; id: string; data: JsonObject}[] = [];
  const issues: ErrorDetail[] = [];
  for (const [name, docsIn] of Object.entries(body.collections)) {
    if (!(COLLECTIONS as string[]).includes(name)) { issues.push({path: name, message: 'unknown collection'}); continue; }
    if (!isObject(docsIn)) { issues.push({path: name, message: 'must be an object {id: document}'}); continue; }
    const collection = name as Collection;
    for (const [id, data] of Object.entries(docsIn)) {
      const where = `${collection}/${id}`;
      try { checkId(id); } catch { issues.push({path: where, message: 'invalid id'}); continue; }
      if (!isObject(data)) { issues.push({path: where, message: 'must be an object'}); continue; }
      if (collection === 'sync' && !SYNC_DOCS.includes(id)) { issues.push({path: where, message: `must be one of: ${SYNC_DOCS.join(', ')}`}); continue; }
      if (collection === 'customers') issues.push(...validateCustomer(data).map(i => ({path: `${where}: ${i.path}`, message: i.message})));
      try { checkSize(data); } catch { issues.push({path: where, message: 'larger than 256 kB'}); }
      docs.push({collection, id, data});
    }
  }
  if (issues.length) throw invalid(issues);
  return docs;
}

export function transferRoutes(db: Db) {
  const r = new Hono<Env>();

  r.get('/export', async c => {
    const collections: Record<string, Record<string, JsonObject>> = {};
    for (const name of COLLECTIONS) collections[name] = Object.fromEntries((await db.list(name)).map(row => [row.id, row.data]));
    return c.json({format: 'crm-export', version: 1, exportedAt: new Date().toISOString(), collections});
  });

  r.post('/import', async c => {
    const dryRun = ['1', 'true'].includes(c.req.query('dryRun') ?? '');
    const docs = readFile(c.get('body'));
    const empty = () => Object.fromEntries(COLLECTIONS.map(n => [n, [] as string[]]));
    const create = empty(), update = empty();
    const writes = [];
    let unchanged = 0;
    for (const d of docs) {
      const old = await db.get(d.collection, d.id);
      if (old && same(old.data, d.data)) { unchanged++; continue; }
      (old ? update : create)[d.collection].push(d.id);
      writes.push(d);
    }
    if (!dryRun) await db.putMany(writes);
    return c.json({dryRun, create, update, unchanged});
  });

  return r;
}
