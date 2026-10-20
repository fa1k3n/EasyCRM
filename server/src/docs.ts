/* Shared rules for the document routes: ids, If-Match, the size limit and the answer with the version as ETag. */
import type {Context} from 'hono';
import type {DocRow, JsonObject} from './db';
import {ApiError, type ErrorDetail} from './errors';

/** Largest stored document */
export const MAX_DOC = 256 * 1024;

export const now = () => new Date().toISOString();

/** A document id from the path: 1–200 characters, no control characters, no slash */
export function checkId(id: string): string {
  if (!id || id.length > 200 || /[\u0000-\u001f\u007f/]/.test(id)) throw new ApiError(400, 'invalid_id', 'The id must be 1–200 characters without control characters');
  return id;
}

/** The version in If-Match ("3" or 3), or undefined without the header. "0" = the document must not exist */
export function ifMatch(c: Context): number | undefined {
  const header = c.req.header('If-Match');
  if (header === undefined) return undefined;
  const m = /^\s*"?(\d{1,15})"?\s*$/.exec(header);
  if (!m) throw new ApiError(400, 'invalid_if_match', 'If-Match must be a version, e.g. "3"');
  return Number(m[1]);
}

export const conflict = () => new ApiError(412, 'version_conflict', 'The document has been changed; read it again and retry');
export const notFound = () => new ApiError(404, 'not_found', 'Not found');

/** The request body as an object, or 400 */
export function bodyObject(c: Context): JsonObject {
  const body = c.get('body');
  if (typeof body !== 'object' || body === null || Array.isArray(body)) throw invalid([{path: '', message: 'must be an object'}]);
  return body as JsonObject;
}

export const invalid = (details: ErrorDetail[]) => new ApiError(400, 'validation', 'The data is not valid', details);

export function checkSize(data: JsonObject) {
  if (new TextEncoder().encode(JSON.stringify(data)).length > MAX_DOC) throw new ApiError(413, 'too_large', `The document is larger than ${MAX_DOC} bytes`);
}

/** The document with its id, and its version as ETag */
export function docResponse(c: Context, row: DocRow, status: 200 | 201 = 200) {
  c.header('ETag', `"${row.version}"`);
  return c.json({...row.data, id: row.id}, status);
}

/** The data to store: never the id (it is the key) */
export function withoutId(data: JsonObject): JsonObject {
  const {id: _id, ...rest} = data;
  return rest;
}
