/* A small D1 for the tests, over node:sqlite: prepare/bind/first/all/run, batch (one transaction) and exec, with
 * meta.changes like Cloudflare's. Only what the D1 adapter uses. */
import {DatabaseSync} from 'node:sqlite';

export function fakeD1(file = ':memory:') {
  const db = new DatabaseSync(file);
  const statement = (sql: string, args: unknown[] = []) => ({
    sql, args,
    bind: (...values: unknown[]) => statement(sql, values),
    async first<T>() { return (db.prepare(sql).get(...(args as never[])) ?? null) as T | null; },
    async all<T>() { return {results: db.prepare(sql).all(...(args as never[])) as T[], success: true}; },
    async run() { const r = db.prepare(sql).run(...(args as never[])); return {success: true, meta: {changes: Number(r.changes)}}; }
  });
  type Statement = ReturnType<typeof statement>;
  return {
    prepare: (sql: string) => statement(sql),
    async batch(list: Statement[]) {
      db.exec('BEGIN IMMEDIATE');
      try {
        const out = [];
        for (const s of list) {
          const r = db.prepare(s.sql);
          if (r.columns().length) out.push({results: r.all(...(s.args as never[])), success: true, meta: {changes: 0}});
          else out.push({results: [], success: true, meta: {changes: Number(r.run(...(s.args as never[])).changes)}});
        }
        db.exec('COMMIT');
        return out;
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
    async exec(sql: string) { db.exec(sql); return {count: 1}; },
    close: () => db.close()
  };
}
