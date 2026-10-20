/* The API's error format: {"error": {"code", "message", "details"?}} with an HTTP status. */
import type {Context} from 'hono';
import type {ContentfulStatusCode} from 'hono/utils/http-status';

export interface ErrorDetail { path: string; message: string }

/** Thrown by the routes; the app turns it into the error format */
export class ApiError extends Error {
  constructor(readonly status: ContentfulStatusCode, readonly code: string, message: string, readonly details?: ErrorDetail[]) {
    super(message);
  }
}

export function errorResponse(c: Context, e: ApiError) {
  return c.json({error: {code: e.code, message: e.message, ...(e.details ? {details: e.details} : {})}}, e.status);
}
