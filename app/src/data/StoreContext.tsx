/* Hooks over the store: useCustomers (all customers with a loading/error state), useCustomer (one by id),
 * useBusy (calendar busy times), useIntegrations (the cloud's integration plugins with a loading/error state), useStore (the store itself, for writes) and useWrite (a write with a disabled state
 * and a visible result). */
import {createContext, useCallback, useContext, useEffect, useState, type ReactNode} from 'react';
import {useToast} from '../components/Toast';
import {t} from '../i18n';
import type {CustomerDoc, Store} from './store';

type LoadState = 'unavailable' | 'loading' | 'ready' | 'error';
/** The integration plugins: list null = none run here */
interface IntegrationsState { state: LoadState; list: IntegrationInfo[] | null }
interface Shared { store: Store | null; state: LoadState; customers: CustomerDoc[]; busy: BusyItem[] | null; integrations: IntegrationsState }

const NO_INTEGRATIONS: IntegrationsState = {state: 'unavailable', list: null};
const StoreContext = createContext<Shared>({store: null, state: 'unavailable', customers: [], busy: null, integrations: NO_INTEGRATIONS});

/* store: null = no database here (outside claude.ai); undefined = still connecting. connectFailed: connecting to the
 * database failed, which is shown as a lost connection rather than "not available here". */
export function StoreProvider({store, connectFailed = false, children}: {store: Store | null | undefined; connectFailed?: boolean; children: ReactNode}) {
  const [state, setState] = useState<LoadState>(connectFailed ? 'error' : store === null ? 'unavailable' : 'loading');
  const [customers, setCustomers] = useState<CustomerDoc[]>([]);
  const [busy, setBusy] = useState<BusyItem[] | null>(null);
  const [integrations, setIntegrations] = useState<IntegrationsState>(NO_INTEGRATIONS);
  useEffect(() => {
    if (!store) { setState(connectFailed ? 'error' : store === null ? 'unavailable' : 'loading'); return; }
    setState('loading');
    setIntegrations({state: 'loading', list: null});
    const stopCustomers = store.watchCustomers(cs => { setCustomers(cs); setState('ready'); }, () => setState('error'));
    const stopBusy = store.watchBusy(setBusy);
    // A broken integrations list must never stop the rest of the app (design rule 10)
    const stopIntegrations = store.watchIntegrations(list => setIntegrations({state: list ? 'ready' : 'unavailable', list}),
      () => setIntegrations(i => ({state: 'error', list: i.list})));
    return () => { stopCustomers(); stopBusy(); stopIntegrations(); };
  }, [store, connectFailed]);
  return <StoreContext.Provider value={{store: store || null, state, customers, busy, integrations}}>{children}</StoreContext.Provider>;
}

export const useCustomers = () => { const {state, customers} = useContext(StoreContext); return {state, customers}; };
export const useCustomer = (id: string | null | undefined): CustomerDoc | undefined =>
  useContext(StoreContext).customers.find(c => c.id === id);
export const useBusy = () => useContext(StoreContext).busy;
export const useIntegrations = () => useContext(StoreContext).integrations;
export const useStore = () => useContext(StoreContext).store;

/* A readable message for a failed write: known database codes get their own text. */
export function writeErrorMessage(error: unknown): string {
  const code = error && typeof error === 'object' ? (error as {code?: string}).code : undefined;
  if (code === 'quota_exceeded') return t('errorQuota');
  if (code === 'invalid_argument') return t('errorPermission');
  return t('errorSave');
}

/* run(write, successMessage) performs a write, shows the result as a message and returns whether it worked;
 * pending is true meanwhile, so buttons can be disabled (design rule 2). */
export function useWrite() {
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const run = useCallback(async (write: () => Promise<unknown>, successMessage?: string) => {
    setPending(true);
    try {
      await write();
      if (successMessage) toast(successMessage);
      return true;
    } catch (e) {
      toast(writeErrorMessage(e));
      return false;
    } finally {
      setPending(false);
    }
  }, [toast]);
  return {run, pending};
}
