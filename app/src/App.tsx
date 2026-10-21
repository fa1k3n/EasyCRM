import {useEffect, useMemo, useState} from 'react';
import type {AppliedBrand} from './brand';
import ErrorBoundary from './components/ErrorBoundary';
import CustomerCard from './components/card/CustomerCard';
import CustomerForm from './components/CustomerForm';
import CustomerList from './components/list/CustomerList';
import Stats from './components/list/Stats';
import Toolbar from './components/list/Toolbar';
import {ToastProvider} from './components/Toast';
import type {Store} from './data/store';
import {StoreProvider, useCustomers} from './data/StoreContext';
import {ExtensionsProvider} from './extensions/ExtensionsContext';
import {loadExtensions} from './extensions/load';
import {t} from './i18n';
import {logic} from './logic';
import {ViewProvider} from './view';

/* A red lamp on the logo when some customer is waiting for contact (90 days, never contacted or a due reminder). */
function Lamp() {
  const {state, customers} = useCustomers();
  if (state !== 'ready' || logic().segmentCounts(customers).kontakta === 0) return null;
  return <span data-lamp title={t('lampTitle')} className="absolute -right-0.5 -top-0.5 size-3.5 rounded-full bg-tally shadow-[0_0_0_3px_var(--bg)]"><span className="sr-only">{t('lampTitle')}</span></span>;
}

/* The app's shell: header with the brand and the counters, the toolbar, the customer list on the left and the card on
 * the right (one at a time on a phone). store: null = no database here, undefined = still connecting; connectFailed:
 * connecting to the database failed. */
export default function App({brand: {brand, error}, store, connectFailed = false, extensions}: {brand: AppliedBrand; store?: Store | null; connectFailed?: boolean; extensions?: unknown[]}) {
  const loaded = useMemo(() => loadExtensions(extensions), [extensions]);
  const [selected, setSelected] = useState<string | null>(null);
  const [returnTo, setReturnTo] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  // Back from the card: the focus returns to the customer's row in the list, or to the search field if the row is gone
  // (the customer was removed)
  useEffect(() => {
    if (!returnTo) return;
    (document.querySelector<HTMLElement>(`[data-id="${returnTo.replace(/["\\]/g, '\\$&')}"]`) ?? document.querySelector<HTMLElement>('input[type="search"]'))?.focus();
    setReturnTo(null);
  }, [returnTo]);
  const back = () => { setReturnTo(selected); setSelected(null); };
  return (
    <ToastProvider>
      <StoreProvider store={store} connectFailed={connectFailed}>
        <ViewProvider>
          <ExtensionsProvider loaded={loaded}>
          <div className="mx-auto flex min-h-screen max-w-[1440px] flex-col bg-bg px-4 font-body text-ink">
            <header className="flex flex-wrap items-center gap-x-6 gap-y-3 py-4">
              <div className="mr-auto flex min-w-0 items-center gap-3">
                <span className="relative flex-none">
                  <img src={brand.logo || 'logo.svg'} alt="" width={44} height={44} className="size-11 object-contain" />
                  <ErrorBoundary><Lamp /></ErrorBoundary>
                </span>
                <h1 className="truncate font-display text-xl font-semibold tracking-tight">
                  {brand.company.name}
                  <span className="ml-3 hidden rounded-full bg-accent px-2.5 py-1.5 align-middle text-[10.5px] font-semibold uppercase tracking-widest text-accent-ink sm:inline">
                    {t('appLabel')}
                  </span>
                </h1>
              </div>
              <ErrorBoundary><Stats /></ErrorBoundary>
              {store?.canWrite && (
                <button type="button" onClick={() => setAdding(true)} className="flex-none rounded-full bg-accent px-4 py-2 font-bold text-accent-ink hover:bg-accent-hover">{t('newCustomer')}</button>
              )}
            </header>
            {error && (
              <div role="alert" className="mb-3 rounded-lg border border-tally bg-tally-soft px-3 py-2 text-sm text-tally">
                <strong>{t('brandError')}</strong> – {t('brandErrorHint')} {error}
              </div>
            )}
            {loaded.errors.length > 0 && (
              <div role="alert" className="mb-3 rounded-lg border border-tally bg-tally-soft px-3 py-2 text-sm text-tally">
                <strong>{t('extensionsError')}</strong> – {t('extensionsErrorHint')}
                <ul className="mt-1 list-disc pl-5">{loaded.errors.map(e => <li key={e}>{e}</li>)}</ul>
              </div>
            )}
            <div className={selected ? 'hidden md:block' : ''}><ErrorBoundary><Toolbar /></ErrorBoundary></div>
            <main className="grid flex-1 grid-cols-1 md:grid-cols-[minmax(300px,400px)_1fr]">
              <section aria-label={t('customersLabel')} className={`py-2 md:border-r md:border-line md:pr-3 ${selected ? 'hidden md:block' : ''}`}>
                <ErrorBoundary>
                  <CustomerList selected={selected} onSelect={setSelected} />
                </ErrorBoundary>
              </section>
              <aside aria-live="polite" className="py-5 md:pl-7">
                <ErrorBoundary>
                  <CustomerCard id={selected} onBack={back} />
                </ErrorBoundary>
              </aside>
            </main>
          </div>
          {adding && <CustomerForm onSaved={setSelected} onClose={() => setAdding(false)} />}
          </ExtensionsProvider>
        </ViewProvider>
      </StoreProvider>
    </ToastProvider>
  );
}
