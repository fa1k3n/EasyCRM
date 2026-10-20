/* The Db adapter for the local server: Node 24's built-in SQLite (node:sqlite), one file. */
import {DatabaseSync} from 'node:sqlite';
import type {Collection, Db} from './db';
import {MIGRATIONS, type Row, SELECT_DOCS, SET_SCHEMA, toDoc, UPSERT_DOC} from './schema';

export function openSqlite(file: string, now: () => string = () => new Date().toISOString()): Db {
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
  migrate(db);

  const stmt = {
    list: db.prepare(`${SELECT_DOCS} WHERE collection = ? ORDER BY id`),
    get: db.prepare(`${SELECT_DOCS} WHERE collection = ? AND id = ?`),
    upsert: db.prepare(UPSERT_DOC),
    remove: db.prepare('DELETE FROM docs WHERE collection = ? AND id = ?'),
    bump: db.prepare("UPDATE meta SET value = value + 1 WHERE key = 'revision'"),
    meta: db.prepare('SELECT value FROM meta WHERE key = ?')
  };
  const getRow = (c: Collection, id: string) => stmt.get.get(c, id) as unknown as Row | undefined;
  // Everything in a write happens in one transaction, so a version check and the write cannot be split by another write
  const transaction = <T>(fn: () => T): T => {
    db.exec('BEGIN IMMEDIATE');
    try { const result = fn(); db.exec('COMMIT'); return result; } catch (e) { db.exec('ROLLBACK'); throw e; }
  };

  return {
    async schemaVersion() { return Number((stmt.meta.get('schema') as {value: number} | undefined)?.value ?? 0); },
    async revision() { return Number((stmt.meta.get('revision') as {value: number}).value); },
    async list(c) { return (stmt.list.all(c) as unknown as Row[]).map(toDoc); },
    async get(c, id) { const r = getRow(c, id); return r ? toDoc(r) : null; },
    async put(c, id, data, expectVersion) {
      return transaction(() => {
        if (expectVersion !== undefined && (getRow(c, id)?.version ?? 0) !== expectVersion) return 'conflict' as const;
        stmt.upsert.run(c, id, JSON.stringify(data), now());
        stmt.bump.run();
        return toDoc(getRow(c, id)!);
      });
    },
    async remove(c, id, expectVersion) {
      return transaction(() => {
        const row = getRow(c, id);
        if (expectVersion !== undefined && (row?.version ?? 0) !== expectVersion) return 'conflict' as const;
        if (!row) return 'missing' as const;
        stmt.remove.run(c, id);
        stmt.bump.run();
        return 'removed' as const;
      });
    },
    async putMany(docs) {
      transaction(() => {
        for (const d of docs) stmt.upsert.run(d.collection, d.id, JSON.stringify(d.data), now());
        if (docs.length) stmt.bump.run();
      });
    },
    close() { db.close(); }
  };
}

// Runs the migrations the database has not run yet, each in its own transaction with the new schema version
function migrate(db: DatabaseSync) {
  db.exec('CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value INTEGER NOT NULL)');
  const current = Number((db.prepare("SELECT value FROM meta WHERE key = 'schema'").get() as {value: number} | undefined)?.value ?? 0);
  for (let v = current; v < MIGRATIONS.length; v++) {
    db.exec('BEGIN IMMEDIATE');
    try {
      db.exec(MIGRATIONS[v]);
      db.prepare(SET_SCHEMA).run(v + 1);
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  }
}
