/* The data layer: the only place that talks to a database. Components use the hooks in StoreContext.tsx; the store
 * behind them is the claude.ai artifact database (artifactStore.ts) or the REST API in server/ (restStore.ts); connect.ts
 * chooses. */

/** A customer document with its id */
export interface CustomerDoc extends Customer { id: string }

export type Unsubscribe = () => void;

export interface Store {
  /** false when the signed-in user may only read */
  readonly canWrite: boolean;
  /** All customers, now and after every change; `fail` is called if the connection is lost */
  watchCustomers(next: (customers: CustomerDoc[]) => void, fail: (error: unknown) => void): Unsubscribe;
  /** Busy times from the synced calendar, or null when it has not been synced */
  watchBusy(next: (items: BusyItem[] | null) => void): Unsubscribe;
  /** The integration plugins that run here, or null where none do (claude.ai, the local server); `fail` on an error */
  watchIntegrations(next: (list: IntegrationInfo[] | null) => void, fail: (error: unknown) => void): Unsubscribe;
  /** Runs a plugin now and returns its run; a refusal (switched off, running, too soon) is an error with the API's code */
  runIntegration(id: string): Promise<IntegrationRun>;
  /** Switches a plugin off (it does not run on its schedule) or on */
  setIntegrationEnabled(id: string, enabled: boolean): Promise<void>;
  /** Creates a customer (always with empty jobs and comms and no last contact, as before) and returns its id */
  createCustomer(data: Customer): Promise<string>;
  /** Merges the fields into the customer (idempotent: the same patch twice gives the same document) */
  updateCustomer(id: string, patch: Partial<Customer>): Promise<void>;
  deleteCustomer(id: string): Promise<void>;
  /** Remembers a removed suggestion so that agents do not suggest the company again */
  skipCustomer(key: string, data: {company: string; website: string}): Promise<void>;
}
