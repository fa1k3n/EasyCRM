import {Search} from 'lucide-react';
import {useState} from 'react';
import {useCustomers} from '../../data/StoreContext';
import {t, type TextKey} from '../../i18n';
import {logic} from '../../logic';
import {SORTS, useView, type Flag, type Sort, type Status} from '../../view';

// The quick filters and the segment that counts them (the same division as the logic's segmentCounts)
const FLAG_LABELS: [Flag, TextKey][] = [['kontakta', 'segContact'], ['bokat', 'segBooked']];
const STATUS_LABELS: [Status, TextKey, 'kunder' | 'kontaktade' | 'potentiella'][] = [['kund', 'segCustomers', 'kunder'], ['kontaktad', 'segContacted', 'kontaktade'], ['potentiell', 'segPotential', 'potentiella']];
const SORT_LABELS: Record<Sort, TextKey> = {kontakt: 'sortContact', namn: 'sortName', nyast: 'sortNewest'};

/* Search, the quick filters with counts (toggles: flags and statuses; within a group either, between the groups both),
 * customer type and sort. On a phone the type and sort sit behind a Filter button. */
export default function Toolbar() {
  const {customers} = useCustomers();
  const {view, setView} = useView();
  const [showFilters, setShowFilters] = useState(false);
  const L = logic();
  const types = L.SERVICE_TYPES;
  const count = L.segmentCounts(customers);
  const type = view.type;
  const pill = (pressed: boolean) => `whitespace-nowrap rounded-full px-3 py-1.5 text-[13.5px] font-medium ${pressed ? 'bg-ink text-bg' : 'text-text hover:text-ink'}`;
  const filtered = type !== 'alla' || view.sort !== 'kontakt';
  const toggle = <T,>(list: T[], x: T): T[] => list.includes(x) ? list.filter(y => y !== x) : [...list, x];
  const any = view.status.length > 0 || view.flags.length > 0;
  return (
    <div className="flex flex-wrap items-center gap-2.5 border-b border-line pb-3.5">
      <label className="relative min-w-0 flex-[1_1_220px]">
        <Search size={16} aria-hidden className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
        <input type="search" value={view.q} onChange={e => setView({q: e.target.value})} aria-label={t('searchLabel')}
          placeholder={t('searchPlaceholder')} autoComplete="off"
          className="w-full rounded-full border border-line bg-surface py-2 pl-9 pr-3.5" />
      </label>
      <button type="button" aria-expanded={showFilters} aria-controls="list-filters" onClick={() => setShowFilters(s => !s)}
        className="rounded-full border border-line bg-surface px-3 py-1.5 font-medium md:hidden">
        {t('filterButton')}{filtered && <span aria-hidden className="ml-1.5 inline-block size-[7px] rounded-full bg-info" />}
      </button>
      <div className="order-3 flex w-full items-center gap-1.5 overflow-x-auto md:order-none md:w-auto">
        <div role="group" aria-label={t('filterGroup')} className="flex shrink-0 gap-0.5 rounded-full bg-sunk p-[3px]">
          {FLAG_LABELS.map(([flag, label]) => (
            <button key={flag} type="button" aria-pressed={view.flags.includes(flag)} onClick={() => setView({flags: toggle(view.flags, flag)})} className={pill(view.flags.includes(flag))}>
              {t(label)}<span className="ml-1 text-xs font-semibold opacity-70">{count[flag]}</span>
            </button>
          ))}
        </div>
        <div role="group" aria-label={t('statusGroup')} className="flex shrink-0 gap-0.5 rounded-full bg-sunk p-[3px]">
          {STATUS_LABELS.map(([status, label, seg]) => (
            <button key={status} type="button" aria-pressed={view.status.includes(status)} onClick={() => setView({status: toggle(view.status, status)})} className={pill(view.status.includes(status))}>
              {t(label)}<span className="ml-1 text-xs font-semibold opacity-70">{count[seg]}</span>
            </button>
          ))}
        </div>
        {any && <button type="button" onClick={() => setView({status: [], flags: []})} className="shrink-0 rounded-full px-2.5 py-1.5 text-[13.5px] font-medium text-info hover:bg-sunk">{t('clearFilters')}</button>}
      </div>
      <div id="list-filters" className={`order-4 w-full flex-wrap gap-2.5 md:order-none md:flex md:w-auto ${showFilters ? 'flex' : 'hidden'}`}>
        <div role="group" aria-label={t('typeGroup')} className="flex flex-wrap gap-0.5 rounded-full bg-sunk p-[3px]">
          {[['alla', t('allTypes')] as const, ...Object.entries(types)].map(([id, label]) => (
            <button key={id} type="button" aria-pressed={type === id} onClick={() => setView({type: id})} className={pill(type === id)}>{label}</button>
          ))}
        </div>
        <select aria-label={t('sortLabel')} value={view.sort} onChange={e => setView({sort: e.target.value as Sort})}
          className="rounded-full border border-line bg-surface px-3.5 py-2 text-[13.5px]">
          {SORTS.map(s => <option key={s} value={s}>{t(SORT_LABELS[s])}</option>)}
        </select>
      </div>
    </div>
  );
}
