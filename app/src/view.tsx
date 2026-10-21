/* What the list shows: the quick filters (statuses and flags), customer type, search and sort. Shared by the stats, the
 * toolbar and the list. Filters, type and sort are remembered in the browser (localStorage, only the view, never customer data); the
 * search is not. Reading and writing localStorage may fail (private mode), and then the view simply is not kept. */
import {createContext, useCallback, useContext, useEffect, useState, type ReactNode} from 'react';
import {logic} from './logic';

export type Status = 'kund' | 'kontaktad' | 'potentiell';
export type Flag = 'kontakta' | 'bokat';
export type Sort = 'kontakt' | 'namn' | 'nyast';
/** status: show these statuses (none = all); flags: show customers with one of these (none = all); both must hold */
export interface ListView { status: Status[]; flags: Flag[]; type: string; q: string; sort: Sort }

export const STATUSES: Status[] = ['kund', 'kontaktad', 'potentiell'];
export const FLAGS: Flag[] = ['kontakta', 'bokat'];
export const SORTS: Sort[] = ['kontakt', 'namn', 'nyast'];
const KEY = 'crm-view';
const DEFAULT: ListView = {status: [], flags: [], type: 'alla', q: '', sort: 'kontakt'};
// A tab saved by the version before the quick filters (seg), as the matching filter
const OLD_TABS: Record<string, Partial<ListView>> = {kontakta: {flags: ['kontakta']}, bokat: {flags: ['bokat']}, kunder: {status: ['kund']}, potentiella: {status: ['potentiell']}};
const only = <T,>(values: unknown, allowed: T[]): T[] => Array.isArray(values) ? allowed.filter(x => values.includes(x)) : [];

function load(): ListView {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!s) return DEFAULT;
    return {
      ...DEFAULT,
      status: only(s.status, STATUSES),
      flags: only(s.flags, FLAGS),
      ...(typeof s.seg === 'string' && !s.status && !s.flags ? OLD_TABS[s.seg] : {}),
      type: typeof s.type === 'string' ? s.type : 'alla',
      sort: SORTS.includes(s.sort) ? s.sort : 'kontakt'
    };
  } catch { return DEFAULT; }
}

const ViewContext = createContext<{view: ListView; setView: (patch: Partial<ListView>) => void}>({view: DEFAULT, setView: () => {}});

export function ViewProvider({children}: {children: ReactNode}) {
  const [view, set] = useState<ListView>(load);
  const setView = useCallback((patch: Partial<ListView>) => set(v => ({...v, ...patch})), []);
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify({status: view.status, flags: view.flags, type: view.type, sort: view.sort})); } catch { /* not kept */ }
  }, [view.status, view.flags, view.type, view.sort]);
  return <ViewContext.Provider value={{view, setView}}>{children}</ViewContext.Provider>;
}

/* The view as everyone should read it: a saved customer type that the brand no longer has means all types, so the
 * toolbar and the list always agree. */
export function useView() {
  const {view, setView} = useContext(ViewContext);
  const type = view.type === 'alla' || logic().SERVICE_TYPES[view.type] ? view.type : 'alla';
  return {view: type === view.type ? view : {...view, type}, setView};
}
