import {useCustomers} from '../../data/StoreContext';
import {t, type TextKey} from '../../i18n';
import {logic} from '../../logic';
import {useView, type Segment} from '../../view';

/* The counters in the header: customers to contact, customers and potential customers. A click shows that segment,
 * a second click shows all again. Hidden on a phone, where the segments in the toolbar do the same. */
export default function Stats() {
  const {state, customers} = useCustomers();
  const {view, setView} = useView();
  if (state !== 'ready') return null;
  const n = logic().segmentCounts(customers);
  const stat = (seg: Segment, n: number, label: TextKey, alert = false) => (
    <button type="button" aria-pressed={view.seg === seg}
      onClick={() => setView({seg: view.seg === seg ? 'alla' : seg})}
      className={`flex items-baseline gap-2 rounded-full border px-3.5 py-1.5 text-[13px] ${alert ? 'border-tally bg-tally-soft text-tally' : 'border-line bg-surface text-muted'}`}>
      <b className={`font-display text-[15px] font-semibold ${alert ? 'text-tally' : 'text-ink'}`}>{n}</b> {t(label)}
    </button>
  );
  return (
    <div className="hidden flex-wrap gap-1.5 md:flex">
      {stat('kontakta', n.kontakta, 'statToContact', n.kontakta > 0)}
      {stat('kunder', n.kunder, 'statCustomers')}
      {stat('potentiella', n.potentiella, 'statPotential')}
    </div>
  );
}
