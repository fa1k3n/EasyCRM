/* The Db adapter for Cloudflare D1 (SQLite in the cloud). D1 has no interactive transactions, so a version check is
 * part of the SQL (WHERE version = ?), and a write and the revision are sent together as one batch (one transaction).
 * The schema is the same as the local server's (schema.ts); missing migrations run when the database is opened. */
import type {Collection, Db} from './db';
import {MIGRATIONS, type Row, SELECT_DOCS, SET_SCHEMA, toDoc, UPSERT_DOC} from './schema';

/** The part of D1's API the adapter uses (D1Database in Cloudflare's types) */
export interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  first<T = unknown>(): Promise<T | null>;
  all<T = unknown>(): Promise<{results: T[]}>;
  run(): Promise<{meta: {changes?: number}}>;
}
export interface D1Like {
  prepare(sql: string): D1Statement;
  batch(statements: D1Statement[]): Promise<{meta?: {changes?: number}}[]>;
}

// Raises the revision only if the statement before it in the batch changed a row
const BUMP_IF_CHANGED = "UPDATE meta SET value = value + 1 WHERE key = 'revision' AND changes() > 0";

export async function openD1(d1: D1Like, now: () => string = () => new Date().toISOString()): Promise<Db> {
  await migrate(d1);
  const get = async (c: Collection, id: string) => {
    const r = await d1.prepare(`${SELECT_DOCS} WHERE collection = ? AND id = ?`).bind(c, id).first<Row>();
    return r ? toDoc(r) : null;
  };
  const meta = async (key: string) => Number((await d1.prepare('SELECT value FROM meta WHERE key = ?').bind(key).first<{value: number}>())?.value ?? 0);

  return {
    schemaVersion: () => meta('schema'),
    revision: () => meta('revision'),
    async list(c) { return (await d1.prepare(`${SELECT_DOCS} WHERE collection = ? ORDER BY id`).bind(c).all<Row>()).results.map(toDoc); },
    get,
    async put(c, id, data, expectVersion) {
      const json = JSON.stringify(data), at = now();
      const write = expectVersion === undefined
        ? d1.prepare(UPSERT_DOC).bind(c, id, json, at)
        : expectVersion === 0
          ? d1.prepare('INSERT INTO docs (collection, id, data, version, updated_at) VALUES (?, ?, ?, 1, ?) ON CONFLICT (collection, id) DO NOTHING').bind(c, id, json, at)
          : d1.prepare('UPDATE docs SET data = ?, version = version + 1, updated_at = ? WHERE collection = ? AND id = ? AND version = ?').bind(json, at, c, id, expectVersion);
      const [result] = await d1.batch([write, d1.prepare(BUMP_IF_CHANGED)]);
      if (!result.meta?.changes) return 'conflict';
      return (await get(c, id))!;
    },
    async remove(c, id, expectVersion) {
      const remove = expectVersion === undefined
        ? d1.prepare('DELETE FROM docs WHERE collection = ? AND id = ?').bind(c, id)
        : d1.prepare('DELETE FROM docs WHERE collection = ? AND id = ? AND version = ?').bind(c, id, expectVersion);
      const [result] = await d1.batch([remove, d1.prepare(BUMP_IF_CHANGED)]);
      if (result.meta?.changes) return 'removed';
      return expectVersion !== undefined ? 'conflict' : 'missing';
    },
    async putMany(docs) {
      if (!docs.length) return;
      const at = now();
      await d1.batch([
        ...docs.map(d => d1.prepare(UPSERT_DOC)
          .bind(d.collection, d.id, JSON.stringify(d.data), at)),
        d1.prepare("UPDATE meta SET value = value + 1 WHERE key = 'revision'")
      ]);
    },
    close() {}
  };
}

// Runs the missing migrations; each one and its new schema version in one batch. The statements are split on ";".
async function migrate(d1: D1Like) {
  await d1.prepare('CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value INTEGER NOT NULL)').run();
  const current = Number((await d1.prepare("SELECT value FROM meta WHERE key = 'schema'").first<{value: number}>())?.value ?? 0);
  for (let v = current; v < MIGRATIONS.length; v++) {
    const statements = MIGRATIONS[v].split(';').map(s => s.trim()).filter(Boolean).map(s => d1.prepare(s));
    await d1.batch([...statements,
      d1.prepare(SET_SCHEMA).bind(v + 1)]);
  }
}
