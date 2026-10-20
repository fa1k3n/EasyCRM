/* The database behind the API: documents as JSON in collections, as in the claude.ai artifact database. Two
 * adapters implement it: sqlite.ts (node:sqlite, the local server) and d1.ts (Cloudflare). */

export type Collection = 'customers' | 'skipped' | 'sync';
export type JsonObject = Record<string, unknown>;

/** A stored document: its data, a version that grows with every write, and when it was last written */
export interface DocRow { id: string; data: JsonObject; version: number; updatedAt: string }

export interface Db {
  /** The schema version in the database (the table meta) */
  schemaVersion(): Promise<number>;
  /** A number that grows with every write and removal in the whole database; the ETag of the lists */
  revision(): Promise<number>;
  list(collection: Collection): Promise<DocRow[]>;
  get(collection: Collection, id: string): Promise<DocRow | null>;
  /** Writes the whole document. With expectVersion the write is only made if the stored version is that one
   * (0 = the document must not exist); otherwise nothing changes and 'conflict' is returned */
  put(collection: Collection, id: string, data: JsonObject, expectVersion?: number): Promise<DocRow | 'conflict'>;
  /** Removes the document; with expectVersion only if the stored version is that one */
  remove(collection: Collection, id: string, expectVersion?: number): Promise<'removed' | 'missing' | 'conflict'>;
  /** Writes all the documents in one transaction: either all of them or none (the import) */
  putMany(docs: {collection: Collection; id: string; data: JsonObject}[]): Promise<void>;
  close(): void;
}
