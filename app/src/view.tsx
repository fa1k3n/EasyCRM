/* What the list shows: segment, customer type, search and sort. Shared by the stats, the toolbar and the list.
 * Segment, type and sort are remembered in the browser (localStorage, only the view, never customer data); the
 * search is not. Reading and writing localStorage may fail (private mode), and then the view simply is not kept. */
import {createContext, useCallback, useContext, useEffect, useState, type ReactNode} from 'react';
import {logic} from './logic';

export type Segment = 'alla' | 'kontakta' | 'bokat' | 'kunder' | 'potentiella';
export type Sort = 'kontakt' | 'namn' | 'nyast';
export interface ListView { seg: Segment; type: string; q: string; sort: Sort }

const SEGMENTS: Segment[] = ['alla', 'kontakta', 'bokat', 'kunder', 'potentiella'];
export const SORTS: Sort[] = ['kontakt', 'namn', 'nyast'];
const KEY = 'crm-view';
const DEFAULT: ListView = {seg: 'alla', type: 'alla', q: '', sort: 'kontakt'};

function load(): ListView {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!s) return DEFAULT;
    return {
      ...DEFAULT,
      seg: SEGMENTS.includes(s.seg) ? s.seg : 'alla',
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
    try { localStorage.setItem(KEY, JSON.stringify({seg: view.seg, type: view.type, sort: view.sort})); } catch { /* not kept */ }
  }, [view.seg, view.type, view.sort]);
  return <ViewContext.Provider value={{view, setView}}>{children}</ViewContext.Provider>;
}

/* The view as everyone should read it: a saved customer type that the brand no longer has means all types, so the
 * toolbar and the list always agree. */
export function useView() {
  const {view, setView} = useContext(ViewContext);
  const type = view.type === 'alla' || logic().SERVICE_TYPES[view.type] ? view.type : 'alla';
  return {view: type === view.type ? view : {...view, type}, setView};
}
