import {useState} from 'react';
import type {CustomerDoc} from '../../data/store';
import {useStore} from '../../data/StoreContext';
import {t, type TextKey} from '../../i18n';
import {logic} from '../../logic';
import type {Status} from '../../view';
import CustomerForm from '../CustomerForm';
import {ConfirmDialog} from '../Dialog';
import {useToast} from '../Toast';

type Open = null | Status | 'edit' | 'remove';

// The texts for moving a customer to each status: the button, the question, its OK button and the message afterwards
const TO: Record<Status, {button: TextKey; confirm: TextKey; ok: TextKey; done: TextKey}> = {
  kund: {button: 'makeCustomer', confirm: 'confirmMakeCustomer', ok: 'confirmMakeCustomerOk', done: 'nowCustomer'},
  kontaktad: {button: 'makeContacted', confirm: 'confirmMakeContacted', ok: 'confirmMakeContactedOk', done: 'nowContacted'},
  potentiell: {button: 'makePotential', confirm: 'confirmMakePotential', ok: 'confirmMakePotentialOk', done: 'nowPotential'}
};
// The statuses a customer can be moved to, in the order of the buttons
const MOVES: Record<Status, Status[]> = {potentiell: ['kontaktad', 'kund'], kontaktad: ['kund', 'potentiell'], kund: ['kontaktad', 'potentiell']};

/* The customer's buttons: move to one of the two other statuses (customer, potential customer, prospect; each asks
 * first), edit, and remove (asks first; a suggestion from an agent is remembered in "skipped" so it is not suggested
 * again). Only when the user may write. */
export default function CardActions({c, onRemoved}: {c: CustomerDoc; onRemoved: () => void}) {
  const L = logic();
  const store = useStore();
  const toast = useToast();
  const [open, setOpen] = useState<Open>(null);
  if (!store?.canWrite) return null;
  const name = c.company || c.name || t('unnamed');
  const current = L.statusOf(c);
  const button = 'rounded-full border border-line bg-surface px-4 py-2 text-sm font-medium hover:border-muted';
  const changeStatus = (to: Status) => async () => {
    await store.updateCustomer(c.id, L.statusPatch(to));
    toast(t(TO[to].done, {name}));
  };
  const remove = async () => {
    if (c.source === 'agent') await store.skipCustomer(L.skipKey(c), {company: c.company || '', website: c.website || ''});
    await store.deleteCustomer(c.id);
    toast(t('customerRemoved'));
    onRemoved();
  };
  return (
    <div className="flex flex-wrap gap-1.5">
      {MOVES[current].map(to => <button key={to} type="button" onClick={() => setOpen(to)} className={button}>{t(TO[to].button)}</button>)}
      <button type="button" onClick={() => setOpen('edit')} className={button}>{t('edit')}</button>
      <button type="button" onClick={() => setOpen('remove')} aria-label={t('removeCustomer')} className="rounded-full px-4 py-2 text-sm font-medium text-tally hover:bg-sunk">{t('remove')}</button>
      {(open === 'kund' || open === 'kontaktad' || open === 'potentiell') && (
        <ConfirmDialog text={t(TO[open].confirm, {name})} okLabel={t(TO[open].ok)} onConfirm={changeStatus(open)} onClose={() => setOpen(null)} />
      )}
      {open === 'edit' && <CustomerForm customer={c} onSaved={() => {}} onClose={() => setOpen(null)} />}
      {open === 'remove' && (
        <ConfirmDialog text={c.source === 'agent' ? t('confirmRemoveAgent', {name}) : t('confirmRemove', {name})}
          okLabel={t('confirmRemoveOk')} onConfirm={remove} onClose={() => setOpen(null)} />
      )}
    </div>
  );
}
