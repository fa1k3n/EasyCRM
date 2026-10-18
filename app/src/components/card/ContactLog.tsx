import {useState, type Ref} from 'react';
import type {CustomerDoc} from '../../data/store';
import {useStore, useWrite} from '../../data/StoreContext';
import {t} from '../../i18n';
import {logic} from '../../logic';
import {inputClass as input, newId} from './forms';
import RemoveButton from './RemoveButton';


/* The contact log: a form to log a contact (mail, call, meeting...) and the log, newest first. A mail with its text
 * can be opened. Writes go through the data layer, with the button disabled meanwhile and the result shown. */
export default function ContactLog({c, subjectRef}: {c: CustomerDoc; subjectRef: Ref<HTMLInputElement>}) {
  const L = logic();
  const store = useStore();
  const {run, pending} = useWrite();
  const [kind, setKind] = useState('mail_ut');
  const [date, setDate] = useState(L.todayISO());
  const [subject, setSubject] = useState('');
  const [note, setNote] = useState('');
  const canWrite = !!store?.canWrite;
  const comms = [...(c.comms || [])].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const lm = L.latestMail(c);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const m = {id: newId(), kind, date: date || L.todayISO(), subject: subject.trim(), note: note.trim()};
    if (await run(() => store!.updateCustomer(c.id, L.addCommPatch(c, m)), t('contactLogged'))) { setSubject(''); setNote(''); }
  };
  const remove = (id: string) => run(() => store!.updateCustomer(c.id, L.removeCommPatch(c, id)), t('removed'));

  return (
    <section>
      <h3 className="mb-2.5 flex items-center justify-between font-display text-[13px] font-semibold uppercase tracking-wider text-muted">
        {t('communication')} <span className="text-[13px]">{comms.length}</span>
      </h3>
      {canWrite && (
        <form onSubmit={submit} className="grid grid-cols-2 gap-2 rounded-2xl border border-line bg-surface p-3 sm:grid-cols-[auto_auto_1fr]">
          <select aria-label={t('contactKind')} value={kind} onChange={e => setKind(e.target.value)} className={input}>
            {Object.entries(L.KINDS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
          <input type="date" aria-label={t('date')} value={date} max={L.todayISO()} required onChange={e => setDate(e.target.value)} className={input} />
          <input ref={subjectRef} aria-label={t('subject')} placeholder={t('subjectPlaceholder')} value={subject}
            onChange={e => setSubject(e.target.value)} className={`${input} col-span-2 sm:col-span-1`} />
          <textarea aria-label={t('note')} placeholder={t('notePlaceholder')} rows={2} value={note}
            onChange={e => setNote(e.target.value)} className={`${input} col-span-full min-h-[38px] resize-y`} />
          <div className="col-span-full flex justify-end">
            <button type="submit" disabled={pending} className="rounded-full bg-accent px-3 py-1 text-[13px] font-bold text-accent-ink hover:bg-accent-hover disabled:opacity-60">{t('log')}</button>
          </div>
        </form>
      )}
      {comms.length ? (
        <ul aria-label={t('communication')} className="mt-3.5">
          {comms.map(m => {
            const latest = !!lm && m.id === lm.id;
            const head = (
              <>
                <div className={`text-xs font-semibold uppercase tracking-wide ${m.kind === 'mail_ut' ? 'text-info' : 'text-muted'}`}>
                  {L.KINDS[m.kind || ''] || L.KINDS.ovrigt}{latest && <span className="ml-1.5 text-info">{t('latestMailFlag')}</span>}
                </div>
                {m.subject && <div className="font-medium">{m.subject}</div>}
              </>
            );
            return (
              <li key={m.id} className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 border-t border-line py-2.5 first:border-t-0 sm:grid-cols-[92px_1fr_auto]">
                <div className={`col-span-full font-display text-[13px] font-medium sm:col-span-1 ${latest ? 'text-ink' : 'text-muted'}`}>{L.fmtDate(m.date)}</div>
                <div className="min-w-0">
                  {m.body ? (
                    <details>
                      <summary className="cursor-pointer list-none rounded-md">
                        {head}
                        {m.note && <div className="line-clamp-2 text-[14px] text-text">{m.note}</div>}
                        <div className="mt-0.5 text-[12.5px] font-medium text-info">{t('showMail')}</div>
                      </summary>
                      <div className="mt-2.5 max-w-[70ch] whitespace-pre-wrap rounded-r-lg border-l-[3px] border-info bg-surface px-3.5 py-3 text-[14px] [overflow-wrap:anywhere]">{m.body}</div>
                    </details>
                  ) : (
                    <>
                      {head}
                      {m.note && <div className="whitespace-pre-wrap text-[14px] text-text [overflow-wrap:anywhere]">{m.note}</div>}
                    </>
                  )}
                </div>
                {canWrite && <RemoveButton disabled={pending} onRemove={() => remove(m.id!)} />}
              </li>
            );
          })}
        </ul>
      ) : <p className="mt-3 text-[13px] text-muted">{t('noCommunication')}</p>}
    </section>
  );
}
