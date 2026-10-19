import {useState} from 'react';
import type {CustomerDoc} from '../../data/store';
import {useStore, useWrite} from '../../data/StoreContext';
import {t} from '../../i18n';
import {logic} from '../../logic';
import {inputClass as input, newId} from './forms';
import RemoveButton from './RemoveButton';

const STATUS_COLOR: Record<string, string> = {paid: 'text-ok', overPaid: 'text-ok', overdue: 'text-tally', underPaid: 'text-amber'};

/* Jobs and invoices: a form to add a job and the jobs, newest first, with amount, invoice
 * number, invoice status and a link to the invoice when it is a safe address. Not shown for potential customers. */
export default function Jobs({c}: {c: CustomerDoc}) {
  const L = logic();
  const store = useStore();
  const {run, pending} = useWrite();
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(L.todayISO());
  const [amount, setAmount] = useState('');
  const [invoiceUrl, setInvoiceUrl] = useState('');
  const canWrite = !!store?.canWrite;
  const jobs = [...(c.jobs || [])].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const j = {id: newId(), title: title.trim(), date: date || L.todayISO(), amount: amount.trim(), invoiceUrl: invoiceUrl.trim()};
    if (await run(() => store!.updateCustomer(c.id, L.addJobPatch(c, j)), t('jobAdded'))) { setTitle(''); setAmount(''); setInvoiceUrl(''); }
  };

  return (
    <section>
      <h3 className="mb-2.5 flex items-center justify-between font-display text-[13px] font-semibold uppercase tracking-wider text-muted">
        {t('jobsInvoices')} <span className="text-[13px]">{jobs.length}</span>
      </h3>
      {canWrite && (
        <form onSubmit={submit} className="grid grid-cols-2 gap-2 rounded-2xl border border-line bg-surface p-3">
          <input aria-label={t('job')} placeholder={t('jobPlaceholder')} required value={title} onChange={e => setTitle(e.target.value)} className={`${input} col-span-2`} />
          <input type="date" aria-label={t('date')} value={date} required onChange={e => setDate(e.target.value)} className={input} />
          <input inputMode="numeric" aria-label={t('amount')} placeholder={t('amountPlaceholder')} value={amount} onChange={e => setAmount(e.target.value)} className={input} />
          <input type="url" aria-label={t('invoiceUrl')} placeholder={t('invoiceUrlPlaceholder')} value={invoiceUrl} onChange={e => setInvoiceUrl(e.target.value)} className={`${input} col-span-2`} />
          <div className="col-span-2 flex justify-end">
            <button type="submit" disabled={pending} className="rounded-full bg-accent px-3 py-1 text-[13px] font-bold text-accent-ink hover:bg-accent-hover disabled:opacity-60">{t('addJob')}</button>
          </div>
        </form>
      )}
      {jobs.length ? (
        <ul aria-label={t('jobsInvoices')} className="mt-3.5">
          {jobs.map(j => {
            const inv = L.safeUrl(j.invoiceUrl);
            return (
              <li key={j.id} className="grid grid-cols-[1fr_auto] gap-x-2.5 gap-y-0.5 border-t border-line py-2.5 first:border-t-0">
                <div className="min-w-0 font-medium [overflow-wrap:anywhere]">{j.title}</div>
                {canWrite ? <RemoveButton disabled={pending} onRemove={() => run(() => store!.updateCustomer(c.id, L.removeJobPatch(c, j.id!)), t('jobRemoved'))} /> : <span />}
                <div className="col-span-2 flex flex-wrap gap-3 text-[13px] text-muted">
                  <span className="font-display">{L.fmtDate(j.date)}</span>
                  {j.amount && <span className="font-display">{t('currency', {amount: j.amount})}</span>}
                  {j.invoiceNumber && <span className="font-display">#{j.invoiceNumber}</span>}
                  {j.invoiceStatus && L.INV_STATUS[j.invoiceStatus] && (
                    <span className={`text-[11px] font-semibold uppercase tracking-wide ${STATUS_COLOR[j.invoiceStatus] || 'text-muted'}`}>{L.INV_STATUS[j.invoiceStatus]}</span>
                  )}
                  {inv ? <a href={inv} target="_blank" rel="noopener" className="font-medium text-info hover:underline">{t('invoice')}</a>
                    : !j.invoiceNumber && <span className="text-amber">{t('noInvoice')}</span>}
                </div>
              </li>
            );
          })}
        </ul>
      ) : <p className="mt-3 text-[13px] text-muted">{t('noJobs')}</p>}
    </section>
  );
}
