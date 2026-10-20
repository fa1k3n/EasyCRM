/* The database schema as numbered migrations, the same SQL for SQLite and D1. A database records the last one it has
 * run in meta.schema; the adapters run the missing ones in order when they open it. Never change a migration that has
 * been released: add a new one. */
import type {DocRow, JsonObject} from './db';


export const MIGRATIONS: string[] = [
  // 1: the documents and the meta table (schema version, revision)
  `CREATE TABLE IF NOT EXISTS docs (
     collection TEXT NOT NULL,
     id TEXT NOT NULL,
     data TEXT NOT NULL,
     version INTEGER NOT NULL,
     updated_at TEXT NOT NULL,
     PRIMARY KEY (collection, id)
   );
   CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value INTEGER NOT NULL);
   INSERT OR IGNORE INTO meta (key, value) VALUES ('revision', 0);`
];

export const SCHEMA_VERSION = MIGRATIONS.length;

/* The SQL and the row format both adapters use (SQLite and D1 run the same statements) */
export interface Row { id: string; data: string; version: number; updated_at: string }
export const toDoc = (r: Row): DocRow => ({id: r.id, data: JSON.parse(r.data) as JsonObject, version: r.version, updatedAt: r.updated_at});
export const SELECT_DOCS = 'SELECT id, data, version, updated_at FROM docs';
/** Writes a document (collection, id, data, updated_at): new ones get version 1, existing ones the next version */
export const UPSERT_DOC = `INSERT INTO docs (collection, id, data, version, updated_at) VALUES (?, ?, ?, 1, ?)
  ON CONFLICT (collection, id) DO UPDATE SET data = excluded.data, version = docs.version + 1, updated_at = excluded.updated_at`;
export const SET_SCHEMA = "INSERT INTO meta (key, value) VALUES ('schema', ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value";
