import {useState} from 'react';
import type {CustomerDoc} from '../data/store';
import {useStore, writeErrorMessage} from '../data/StoreContext';
import {t, type TextKey} from '../i18n';
import {logic, type CustomerFormFields} from '../logic';
import {inputClass as input} from './card/forms';
import TypeIcon from './TypeIcon';
import Dialog from './Dialog';
import {useToast} from './Toast';


/* Adds a new customer or edits one: status, company, contact person, role, customer types (with the brand's hint about
 * which sender a type gives), contact details and notes. The fields are checked and shaped by the shared logic. */
export default function CustomerForm({customer, onSaved, onClose}: {customer?: CustomerDoc; onSaved: (id: string) => void; onClose: () => void}) {
  const L = logic();
  const store = useStore();
  const toast = useToast();
  const isNew = !customer;
  const [f, setF] = useState<CustomerFormFields>(() => ({
    company: customer?.company || '', name: customer?.name || '', role: customer?.role || '', email: customer?.email || '',
    phone: customer?.phone || '', website: customer?.website || '', city: customer?.city || '', notes: customer?.notes || '',
    status: customer ? L.statusOf(customer) : 'kund',
    types: customer ? L.customerTypes(customer) : L.getBrand().customerTypes.slice(0, 1).map(x => x.id)
  }));
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const set = (k: keyof CustomerFormFields) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF(v => ({...v, [k]: e.target.value}));
  const toggleType = (id: string) => setF(v => ({...v, types: v.types.includes(id) ? v.types.filter(x => x !== id) : [...v.types, id]}));
  const hint = L.senderHint();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const {patch, errors} = L.customerFormPatch(f);
    if (errors.length) { setError(t(errors[0] as TextKey)); return; }
    setPending(true);
    setError('');
    try {
      const id = isNew ? await store!.createCustomer(patch) : (await store!.updateCustomer(customer.id, {...patch, example: false}), customer.id);
      toast(isNew ? t(f.status === 'potentiell' ? 'potentialAdded' : f.status === 'kontaktad' ? 'contactedAdded' : 'customerAdded') : t('saved'));
      onSaved(id);
      onClose();
    } catch (err) {
      setError(writeErrorMessage(err));
      setPending(false);
    }
  };

  const text = (key: keyof CustomerFormFields, label: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</span>
      <input value={f[key] as string} onChange={set(key)} className={input} {...extra} />
    </label>
  );
  return (
    <Dialog title={isNew ? t('newCustomerTitle') : t('editCustomerTitle')} onClose={onClose} busy={pending}>
      <form onSubmit={submit} noValidate>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div role="group" aria-label={t('statusGroup')} className="flex w-fit gap-0.5 rounded-full bg-sunk p-[3px] sm:col-span-2">
            {(['kund', 'kontaktad', 'potentiell'] as const).map(st => (
              <button key={st} type="button" aria-pressed={f.status === st} onClick={() => setF(v => ({...v, status: st}))}
                className={`rounded-full px-3 py-1.5 text-[13.5px] font-medium ${f.status === st ? 'bg-ink text-bg' : 'text-text'}`}>
                {t(st === 'kund' ? 'statusCustomer' : st === 'kontaktad' ? 'contactedCustomer' : 'potentialCustomer')}
              </button>
            ))}
          </div>
          {text('company', t('companyField'), {placeholder: t('companyPlaceholder')})}
          {text('name', t('contactPerson'), {placeholder: t('contactPersonPlaceholder')})}
          {text('role', t('role'), {placeholder: t('rolePlaceholder')})}
          <fieldset className="flex flex-wrap gap-2 sm:col-span-2">
            <legend className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">{t('customerTypesField')}</legend>
            {Object.entries(L.SERVICE_TYPES).map(([id, label]) => (
              <label key={id} className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-line bg-bg py-1.5 pl-2 pr-3 font-medium has-[:checked]:bg-surface"
                style={{borderColor: f.types.includes(id) ? `var(--t-${id})` : undefined}}>
                <input type="checkbox" checked={f.types.includes(id)} onChange={() => toggleType(id)} className="accent-accent" />
                <TypeIcon id={id} decorative />
                <span>{label}</span>
              </label>
            ))}
            {hint && <span className="basis-full text-[13px] text-muted">{hint}</span>}
          </fieldset>
          {text('email', t('email'), {type: 'email'})}
          {text('phone', t('phone'), {type: 'tel'})}
          {text('website', t('website'))}
          {text('city', t('city'))}
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">{t('notes')}</span>
            <textarea value={f.notes} onChange={set('notes')} className={`${input} min-h-20 resize-y`} />
          </label>
        </div>
        {error && <p role="alert" className="mt-3 text-[13px] text-tally">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={pending} className="rounded-full border border-line bg-surface px-4 py-2 font-medium disabled:opacity-60">{t('cancel')}</button>
          <button type="submit" disabled={pending} className="rounded-full bg-accent px-4 py-2 font-bold text-accent-ink hover:bg-accent-hover disabled:opacity-60">{isNew ? t('add') : t('save')}</button>
        </div>
      </form>
    </Dialog>
  );
}
