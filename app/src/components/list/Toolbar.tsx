import {Search} from 'lucide-react';
import {useState} from 'react';
import {useCustomers} from '../../data/StoreContext';
import {t, type TextKey} from '../../i18n';
import {logic} from '../../logic';
import {SORTS, useView, type Segment, type Sort} from '../../view';

const SEGMENT_LABELS: [Segment, TextKey][] = [['alla', 'segAll'], ['kontakta', 'segContact'], ['bokat', 'segBooked'], ['kunder', 'segCustomers'], ['potentiella', 'segPotential']];
const SORT_LABELS: Record<Sort, TextKey> = {kontakt: 'sortContact', namn: 'sortName', nyast: 'sortNewest'};

/* Search, segments with counts, customer type and sort. On a phone the type and sort sit behind a Filter button. */
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
      <div role="group" aria-label={t('filterGroup')} className="order-3 flex w-full gap-0.5 overflow-x-auto rounded-full bg-sunk p-[3px] md:order-none md:w-auto">
        {SEGMENT_LABELS.map(([seg, label]) => (
          <button key={seg} type="button" aria-pressed={view.seg === seg} onClick={() => setView({seg})} className={pill(view.seg === seg)}>
            {t(label)}<span className="ml-1 text-xs font-semibold opacity-70">{count[seg]}</span>
          </button>
        ))}
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
