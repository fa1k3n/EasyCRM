import {useCustomers} from '../../data/StoreContext';
import {t, type TextKey} from '../../i18n';
import {logic} from '../../logic';
import {useView, type ListView} from '../../view';

/* The counters in the header: customers to contact, customers, potential customers and prospects. A click shows only
 * that quick filter, a second click shows all again. Hidden on a phone, where the quick filters in the toolbar do the same. */
export default function Stats() {
  const {state, customers} = useCustomers();
  const {view, setView} = useView();
  if (state !== 'ready') return null;
  const n = logic().segmentCounts(customers);
  const stat = (only: Pick<ListView, 'status' | 'flags'>, n: number, label: TextKey, alert = false) => {
    const same = (a: string[], b: string[]) => a.length === b.length && a.every(x => b.includes(x));
    const on = same(view.status, only.status) && same(view.flags, only.flags);
    return (
      <button type="button" aria-pressed={on}
        onClick={() => setView(on ? {status: [], flags: []} : only)}
        className={`flex items-baseline gap-2 rounded-full border px-3.5 py-1.5 text-[13px] ${alert ? 'border-tally bg-tally-soft text-tally' : 'border-line bg-surface text-muted'}`}>
        <b className={`font-display text-[15px] font-semibold ${alert ? 'text-tally' : 'text-ink'}`}>{n}</b> {t(label)}
      </button>
    );
  };
  return (
    <div className="hidden flex-wrap gap-1.5 md:flex">
      {stat({status: [], flags: ['kontakta']}, n.kontakta, 'statToContact', n.kontakta > 0)}
      {stat({status: ['kund'], flags: []}, n.kunder, 'statCustomers')}
      {stat({status: ['kontaktad'], flags: []}, n.kontaktade, 'statContacted')}
      {stat({status: ['potentiell'], flags: []}, n.potentiella, 'statPotential')}
    </div>
  );
}
