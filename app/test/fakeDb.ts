/* A fake claude.ai artifact database for the UI tests: the parts the app uses (collection/doc, set, update, delete,
 * onSnapshot) kept in memory. All data here is made up. Writes can be made to fail to test error handling. */
type Doc = Record<string, unknown>;
type Listener = (snap: {docs: {id: string; data: () => Doc}[]}) => void;

export function fakeClaude(opts: {db?: boolean; canWrite?: boolean; customers?: Record<string, Doc>; busy?: Doc | null} = {}) {
  const collections = new Map<string, Map<string, Doc>>([['customers', new Map(Object.entries(opts.customers || {}))], ['skipped', new Map()]]);
  const listeners = new Set<Listener>();
  const failing = {write: null as null | {code?: string}, snapshot: false, busy: false};
  let open = 0;
  let seq = 0;
  const emit = () => {
    const docs = [...collections.get('customers')!.entries()].map(([id, d]) => ({id, data: () => d}));
    listeners.forEach(l => l({docs}));
  };
  const write = async (fn: () => void) => {
    if (failing.write) throw Object.assign(new Error('write failed'), failing.write);
    fn();
    emit();
  };
  const ref = (name: string, id: string) => ({
    id,
    set: (data: Doc) => write(() => { collections.get(name)!.set(id, {...data}); }),
    update: (data: Doc) => write(() => { collections.get(name)!.set(id, {...collections.get(name)!.get(id), ...data}); }),
    delete: () => write(() => { collections.get(name)!.delete(id); })
  });
  const db = {
    collection: (name: string) => ({
      doc: (id?: string) => ref(name, id || `new${++seq}`),
      onSnapshot: (next: Listener, error: (e: unknown) => void) => {
        if (failing.snapshot) { setTimeout(() => error(new Error('connection lost')), 0); return () => {}; }
        listeners.add(next);
        open++;
        setTimeout(emit, 0);
        return () => { if (listeners.delete(next)) open--; };
      }
    }),
    doc: (p: string) => ({
      onSnapshot: (next: (s: {exists: boolean; data: () => Doc | undefined}) => void, error?: (e: unknown) => void) => {
        if (failing.busy && error) { setTimeout(() => error(new Error('sync/busy unreadable')), 0); return () => {}; }
        const d = p === 'sync/busy' ? opts.busy : null;
        setTimeout(() => next({exists: !!d, data: () => d || undefined}), 0);
        return () => {};
      }
    })
  };
  const user = {can: async () => opts.canWrite !== false};
  const claude = {use: async (name: string) => (name === 'db' ? (opts.db === false ? null : db) : name === 'user' ? user : null)};
  return {claude, collections, failing, openListeners: () => open};
}
