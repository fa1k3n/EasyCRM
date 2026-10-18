import {useCustomers} from '../../data/StoreContext';
import {t} from '../../i18n';
import {logic} from '../../logic';
import {useView} from '../../view';
import CustomerRow from './CustomerRow';

/* The customer list, filtered and sorted by the shared logic. Every state has a message: not available here,
 * loading, lost connection, empty register and no matches (design rule 2). */
export default function CustomerList({selected, onSelect}: {selected: string | null; onSelect: (id: string) => void}) {
  const {state, customers} = useCustomers();
  const {view} = useView();
  const message = (title: string, hint?: string) => (
    <div className="p-10 text-center text-muted">
      <h2 className="font-display text-base font-semibold text-ink">{title}</h2>
      {hint && <p className="mt-1">{hint}</p>}
    </div>
  );
  if (state === 'unavailable') return message(t('unavailable'), t('unavailableHint'));
  if (state === 'error') return <div role="alert">{message(t('connectionLost'), t('connectionLostHint'))}</div>;
  if (state === 'loading') return <p className="p-10 text-center text-muted">{t('loading')}</p>;
  if (!customers.length) return message(t('noCustomers'), t('noCustomersHint'));
  const items = logic().filterCustomers(customers, view);
  if (!items.length) return message(t('noMatches'), t('noMatchesHint'));
  return (
    <div>
      {items.map(c => <CustomerRow key={c.id} c={c} selected={c.id === selected} onSelect={onSelect} />)}
      <p className="px-3 py-4 text-center text-xs text-muted">{t('customerCount', {count: items.length})}</p>
    </div>
  );
}
