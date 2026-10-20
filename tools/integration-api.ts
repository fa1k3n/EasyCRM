/* The integration API, version 1: the types an integration plugin is written against (imported as 'crm-integration-api').
 * A plugin brings data from another service (e.g. invoices from an accounting system) into the register. It runs
 * outside the page, with Node (tools/integration.js). It reads the service with ctx.fetch (GET, only to the hosts it
 * declares), reads the customers (frozen), and returns a plan (new customers, jobs, links); the platform writes the plan through the REST API with
 * the same rules as the app. A plugin never writes itself. It runs in its own context: besides JavaScript's built-ins it
 * only has URL, URLSearchParams and structuredClone (tools/integration-globals.d.ts), so ctx is its only way out.
 * A breaking change needs a new apiVersion. */

export const INTEGRATION_API_VERSION = 1;

/** Plain JSON: what a plugin can keep in customer.ext[<its id>] */
export type Json = string | number | boolean | null | Json[] | {[key: string]: Json};

/** A customer as the plugin sees it: frozen, so changing it throws */
export type ReadonlyCustomer = Readonly<Customer & {id: string}>;

/** The answer of ctx.fetch */
export interface IntegrationResponse { ok: boolean; status: number; json(): Promise<unknown>; text(): Promise<string> }

export interface IntegrationContext {
  /** The environment variables the manifest lists in env, and only those (never print them) */
  config: Readonly<Record<string, string>>;
  /** A GET over https to one of the manifest's hosts; anything else throws */
  fetch(url: string, init?: {headers?: Record<string, string>}): Promise<IntegrationResponse>;
  /** All customers, frozen */
  customers: readonly ReadonlyCustomer[];
  /** Today as YYYY-MM-DD */
  today: string;
  /** The command's options, e.g. {since: '2026-01-01'} for --since */
  options: Readonly<Record<string, string>>;
  /** The plugin's settings file (settings.json next to index.ts), or {} */
  settings: Readonly<Record<string, Json>>;
}

/** A job (with an invoice) the plugin wants on a customer. The id is stable, so that a new run never adds it twice:
 * an existing job with this id only gets the fields in the manifest's owns.jobs */
export interface PlannedJob { customerId: string; item: Job & {id: string} }
/** What the plugin keeps for a customer in customer.ext[<its id>], e.g. the service's id for the customer */
export interface PlannedLink { customerId: string; data: Json }

/** A customer the service has that the register lacks: created (never overwritten) before the plan's jobs and links,
 * which may refer to it. The id is stable (e.g. '<plugin id>-<the service's id>'), so a new run never adds it twice */
export interface PlannedCustomer { id: string; data: Customer }

export interface IntegrationPlan {
  /** New customers (optional; plans without them work as before) */
  customers?: PlannedCustomer[];
  jobs?: PlannedJob[];
  links?: PlannedLink[];
  /** Things in the service the plugin could not connect to a customer; shown to the user, never written */
  unmatched?: string[];
  /** Other things to tell the user */
  notes?: string[];
}

/** A job field a plugin may list in owns.jobs. The type is every job field, but only the service's fields are accepted
 * when the plugin is loaded (with an error about owns otherwise): invoiceNumber, invoiceStatus and dueDate, never the
 * user's title, amount or link */
export type OwnedJobField = keyof Job;

export interface IntegrationManifest {
  /** a–z, 0–9, - and _; the plugin's folder name and its key in customer.ext; never change it once customers have data */
  id: string;
  name: string;
  apiVersion: number;
  /** The environment variables the plugin needs (e.g. the service's key) */
  env?: string[];
  /** The hosts ctx.fetch may call, e.g. ['api.example.com'] */
  hosts?: string[];
  /** The fields the plugin may change on a job that already exists (the rest are the user's) */
  owns?: {jobs?: OwnedJobField[]};
  run(ctx: IntegrationContext): Promise<IntegrationPlan>;
}
