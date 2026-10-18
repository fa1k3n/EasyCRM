/* The store over the claude.ai artifact database (window.claude.use('db')), with the same reads and writes as the
 * old kundregister/index.html: collections "customers" and "skipped", and the document "sync/busy". */
import type {CustomerDoc, Store} from './store';

type Data = Record<string, unknown>;
interface DocRef { id: string; set(data: Data): Promise<unknown>; update(data: Data): Promise<unknown>; delete(): Promise<unknown> }
interface ArtifactDb {
  collection(name: string): {
    doc(id?: string): DocRef;
    onSnapshot(next: (snap: {docs: {id: string; data(): Data}[]}) => void, error: (e: unknown) => void): () => void;
  };
  doc(path: string): {onSnapshot(next: (snap: {exists: boolean; data(): Data | undefined}) => void, error?: (e: unknown) => void): () => void};
}
export interface ClaudeRuntime { use(name: string): Promise<unknown> }

const now = () => new Date().toISOString();

/* Returns the store, or null when there is no database (the page is opened outside claude.ai). */
export async function createArtifactStore(claude: ClaudeRuntime | undefined = (window as unknown as {claude?: ClaudeRuntime}).claude): Promise<Store | null> {
  const db = claude ? ((await claude.use('db')) as ArtifactDb | null) : null;
  if (!db) return null;
  // A broken permission check must not stop the register (design rule 10): then it is read-only
  let canWrite = false;
  try {
    const user = (await claude!.use('user')) as {can(permission: string): Promise<boolean>} | null;
    canWrite = user ? (await user.can('data.write')) !== false : true;
  } catch { canWrite = false; }
  const customers = db.collection('customers');
  return {
    canWrite,
    watchCustomers(next, fail) {
      return customers.onSnapshot(snap => next(snap.docs.map(d => ({...(d.data() as Customer), id: d.id}) as CustomerDoc)), fail);
    },
    watchBusy(next) {
      // A missing or broken sync/busy must never stop the rest of the app (design rule 10)
      return db.doc('sync/busy').onSnapshot(s => {
        const d = s.exists ? s.data() : undefined;
        next(d && Array.isArray(d.items) ? (d.items as BusyItem[]) : null);
      }, () => next(null));
    },
    async createCustomer(data) {
      const ref = customers.doc();
      // The same starting values as the old app (they always win), so that every new customer has the lists the logic expects
      await ref.set({...data, jobs: [], comms: [], lastContact: null, createdAt: now(), updatedAt: now()});
      return ref.id;
    },
    async updateCustomer(id, patch) {
      await customers.doc(id).update({...patch, updatedAt: now()});
    },
    async deleteCustomer(id) {
      await customers.doc(id).delete();
    },
    async skipCustomer(key, data) {
      await db.collection('skipped').doc(key).set({...data, at: now()});
    }
  };
}
