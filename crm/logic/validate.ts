/* The check of a customer document (the fields in types.ts) that the REST API runs before every write. Known fields
 * are type-checked; unknown fields (agents' own) and ext are kept as they are; null counts as a missing field. The
 * messages are in English, like all of the API's messages. */

export interface ValidationIssue { path: string; message: string }

type Check = (value: unknown, path: string, issues: ValidationIssue[]) => void;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const DATE = /^\d{4}-\d{2}-\d{2}/;

const text: Check = (v, path, issues) => { if (typeof v !== 'string') issues.push({path, message: 'must be text'}); };
const bool: Check = (v, path, issues) => { if (typeof v !== 'boolean') issues.push({path, message: 'must be true or false'}); };
const num: Check = (v, path, issues) => { if (typeof v !== 'number' || !Number.isFinite(v)) issues.push({path, message: 'must be a number'}); };
const date: Check = (v, path, issues) => {
  if (typeof v !== 'string' || !DATE.test(v)) issues.push({path, message: 'must be a date YYYY-MM-DD'});
};
const textOrNumber: Check = (v, path, issues) => {
  if (typeof v !== 'string' && (typeof v !== 'number' || !Number.isFinite(v))) issues.push({path, message: 'must be text or a number'});
};
const oneOf = (...allowed: string[]): Check => (v, path, issues) => {
  if (!allowed.includes(v as string)) issues.push({path, message: `must be one of: ${allowed.join(', ')}`});
};
const anyObject: Check = (v, path, issues) => { if (!isObject(v)) issues.push({path, message: 'must be an object'}); };

/* An object whose known fields are checked; other fields are kept unchecked */
const object = (fields: Record<string, Check>): Check => (v, path, issues) => {
  if (!isObject(v)) { issues.push({path, message: 'must be an object'}); return; }
  for (const [key, value] of Object.entries(v)) {
    if (value === null || value === undefined || !Object.prototype.hasOwnProperty.call(fields, key)) continue;
    fields[key](value, path ? `${path}.${key}` : key, issues);
  }
};
const list = (item: Check): Check => (v, path, issues) => {
  if (!Array.isArray(v)) { issues.push({path, message: 'must be a list'}); return; }
  v.forEach((x, i) => item(x, `${path}[${i}]`, issues));
};

const COMM = object({id: text, kind: text, date, subject: text, note: text, body: text, gmailId: text, bookingId: text});
const JOB = object({id: text, title: text, date, amount: textOrNumber, invoiceUrl: text, invoiceNumber: textOrNumber, invoiceStatus: text, dueDate: date});
const EVENT = object({
  id: text, title: text, date, endDate: date, location: text, url: text, sourceLabel: text, why: text, source: text, foundAt: text,
  dismissed: bool, offeredAt: text, followUpSentAt: text
});
const BOOKING = object({id: text, kind: text, title: text, date, time: text, durationMin: num, location: text, source: text, gcalEventId: text});

const CUSTOMER = object({
  id: text, company: text, name: text, role: text, email: text, phone: text, website: text, city: text, notes: text,
  ext: anyObject,
  status: oneOf('kund', 'kontaktad', 'potentiell'),
  types: list(text), example: bool, createdAt: text, updatedAt: text, addedAt: date,
  comms: list(COMM), jobs: list(JOB), events: list(EVENT), bookings: list(BOOKING),
  followUp: object({date, note: text}),
  lastContact: date, lastMail: object({date, subject: text}), lastJob: object({title: text, date}),
  draft: object({subject: text, body: text, summary: text, eventId: text, kind: text}), eventsCheckedAt: text,
  source: text, why: text, contactSource: text, emailConfidence: oneOf('publicerad', 'gissad')
});

/** The issues in a customer document, in the document's field order; an empty list = valid. path "" = the document itself */
export function validateCustomer(doc: unknown): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  CUSTOMER(doc, '', issues);
  return issues;
}
