/* The loaded extensions for the whole app, and the places they show up: sections on the customer card and badges on
 * the list rows. Each section runs in its own error boundary and each badge in a try/catch, so a broken extension
 * never breaks the page. */
import {createContext, useContext, useMemo, type ReactNode} from 'react';
import ErrorBoundary from '../components/ErrorBoundary';
import type {CustomerDoc} from '../data/store';
import {useStore} from '../data/StoreContext';
import type {Json, MailTexts, ReadonlyCustomer} from './api';
import {logic} from '../logic';
import type {LoadedExtensions} from './load';

const Ctx = createContext<LoadedExtensions>({extensions: [], errors: []});

export function ExtensionsProvider({loaded, children}: {loaded: LoadedExtensions; children: ReactNode}) {
  return <Ctx.Provider value={loaded}>{children}</Ctx.Provider>;
}
export const useExtensions = () => useContext(Ctx);

/* The mail texts: the first extension with mail, otherwise an old mail plugin (mail.js, window.CRM_MAIL) if it is
 * complete, otherwise null (offers and follow-ups are then logged without text). */
export function useMail(): MailTexts | null {
  const {extensions} = useExtensions();
  const fromExt = extensions.find(e => e.mail)?.mail;
  if (fromExt) return fromExt;
  const old = (window as {CRM_MAIL?: unknown}).CRM_MAIL;
  return old && !logic().checkMailModule(old).length ? old as MailTexts : null;
}

// A frozen deep copy: the extension can read the customer but not change it
export function frozen<T>(x: T): T {
  if (typeof x !== 'object' || x === null) return x;
  const copy = (Array.isArray(x) ? x.map(frozen) : Object.fromEntries(Object.entries(x).map(([k, v]) => [k, frozen(v)]))) as T;
  return Object.freeze(copy);
}

// JSON only: a copy through JSON, which must give the same thing back (no functions, dates, undefined or NaN)
function asJson(data: unknown): Json {
  const text = JSON.stringify(data);
  const back: unknown = text === undefined ? undefined : JSON.parse(text);
  if (back === undefined || !sameJson(data, back)) throw new Error('not JSON');
  return back as Json;
}
function sameJson(a: unknown, b: unknown): boolean {
  if (typeof a !== 'object' || a === null) return Object.is(a, b);
  if (typeof b !== 'object' || b === null || Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a), kb = Object.keys(b);
  return ka.length === kb.length && ka.every(k => sameJson((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}

/* The extensions' sections on a customer's card, each under its own heading. */
export function ExtensionSections({c}: {c: CustomerDoc}) {
  const {extensions} = useExtensions();
  const store = useStore();
  const customer = useMemo(() => frozen(c) as ReadonlyCustomer, [c]);
  return (
    <>
      {extensions.flatMap(ext => (ext.customerSections || []).map(s => {
        const save = async (data: unknown) => {
          if (!store?.canWrite) throw new Error('read-only');
          // Only the extension's own field is written; the other extensions' fields are kept
          await store.updateCustomer(c.id, {ext: {...c.ext, [ext.id]: asJson(data)}});
        };
        return (
          <section key={`${c.id}/${ext.id}/${s.id}`} className="mt-7">
            <h3 className="mb-2 font-display text-[17px] font-semibold tracking-tight">{s.title}</h3>
            <ErrorBoundary>
              <s.Component customer={customer} data={c.ext?.[ext.id]} save={save} canWrite={!!store?.canWrite} />
            </ErrorBoundary>
          </section>
        );
      }))}
    </>
  );
}

/* The extensions' badges for a customer's row; a badge that throws is left out. */
export function useListBadges(c: CustomerDoc): {key: string; text: string; title?: string}[] {
  const {extensions} = useExtensions();
  if (!extensions.length) return [];
  const customer = frozen(c) as ReadonlyCustomer;
  return extensions.flatMap(ext => (ext.listBadges || []).flatMap((badge, i) => {
    try {
      const b = badge(customer);
      return b && typeof b.text === 'string' ? [{key: `${ext.id}/${i}`, text: b.text, title: b.title}] : [];
    } catch (e) {
      console.error(`Extension ${ext.id}: a list badge failed:`, e instanceof Error ? e.message : e);
      return [];
    }
  }));
}
