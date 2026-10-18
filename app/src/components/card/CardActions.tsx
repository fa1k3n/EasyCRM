import {useState} from 'react';
import type {CustomerDoc} from '../../data/store';
import {useStore} from '../../data/StoreContext';
import {t} from '../../i18n';
import {logic} from '../../logic';
import CustomerForm from '../CustomerForm';
import {ConfirmDialog} from '../Dialog';
import {useToast} from '../Toast';

type Open = null | 'status' | 'edit' | 'remove';

/* The customer's buttons: make customer / make potential again (both ask first), edit, and remove (asks first; a
 * suggestion from an agent is remembered in "skipped" so it is not suggested again). Only when the user may write. */
export default function CardActions({c, onRemoved}: {c: CustomerDoc; onRemoved: () => void}) {
  const L = logic();
  const store = useStore();
  const toast = useToast();
  const [open, setOpen] = useState<Open>(null);
  if (!store?.canWrite) return null;
  const name = c.company || c.name || t('unnamed');
  const potential = c.status === 'potentiell';
  const button = 'rounded-full border border-line bg-surface px-4 py-2 text-sm font-medium hover:border-muted';
  const changeStatus = async () => {
    await store.updateCustomer(c.id, L.statusPatch(potential ? 'kund' : 'potentiell'));
    toast(potential ? t('nowCustomer', {name}) : t('nowPotential', {name}));
  };
  const remove = async () => {
    if (c.source === 'agent') await store.skipCustomer(L.skipKey(c), {company: c.company || '', website: c.website || ''});
    await store.deleteCustomer(c.id);
    toast(t('customerRemoved'));
    onRemoved();
  };
  return (
    <div className="flex flex-wrap gap-1.5">
      <button type="button" onClick={() => setOpen('status')} className={button}>{potential ? t('makeCustomer') : t('makePotential')}</button>
      <button type="button" onClick={() => setOpen('edit')} className={button}>{t('edit')}</button>
      <button type="button" onClick={() => setOpen('remove')} aria-label={t('removeCustomer')} className="rounded-full px-4 py-2 text-sm font-medium text-tally hover:bg-sunk">{t('remove')}</button>
      {open === 'status' && (
        <ConfirmDialog text={potential ? t('confirmMakeCustomer', {name}) : t('confirmMakePotential', {name})}
          okLabel={potential ? t('confirmMakeCustomerOk') : t('confirmMakePotentialOk')} onConfirm={changeStatus} onClose={() => setOpen(null)} />
      )}
      {open === 'edit' && <CustomerForm customer={c} onSaved={() => {}} onClose={() => setOpen(null)} />}
      {open === 'remove' && (
        <ConfirmDialog text={c.source === 'agent' ? t('confirmRemoveAgent', {name}) : t('confirmRemove', {name})}
          okLabel={t('confirmRemoveOk')} onConfirm={remove} onClose={() => setOpen(null)} />
      )}
    </div>
  );
}
