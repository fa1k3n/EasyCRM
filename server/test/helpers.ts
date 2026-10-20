/* Shared helpers for the server's tests: an API over a SQLite database in a temporary folder. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createApp} from '../src/app';
import {openSqlite} from '../src/sqlite';
import type {Db} from '../src/db';

export function tempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'crm-server-test-'));
}

/* A fresh database file and the API over it. close() removes everything. */
export function testApi() {
  const dir = tempDir();
  const db: Db = openSqlite(path.join(dir, 'crm.sqlite'));
  const app = createApp({db, local: true});
  return {
    dir, db, app,
    close() { db.close(); fs.rmSync(dir, {recursive: true, force: true}); }
  };
}

/* A JSON request against the app (Content-Type set when there is a body) */
export function json(method: string, body?: unknown, headers: Record<string, string> = {}): RequestInit {
  return body === undefined
    ? {method, headers}
    : {method, headers: {'Content-Type': 'application/json', ...headers}, body: JSON.stringify(body)};
}
