import {useId} from 'react';
import type {CustomerDoc} from '../../data/store';
import {useStore, useWrite} from '../../data/StoreContext';
import {t} from '../../i18n';
import {logic} from '../../logic';
import {newId, useCopy} from './forms';

/* A mail draft on the customer (written by an agent for a potential customer, or saved from an offer): copy, open in
 * the mail program, discard, or "I have sent it", which logs the mail. The app never sends it. */
export default function Draft({c}: {c: CustomerDoc}) {
  const L = logic();
  const store = useStore();
  const copy = useCopy();
  const {run, pending} = useWrite();
  const heading = useId();
  const d = c.draft;
  if (!d || !(d.subject || d.body)) return null;
  const canWrite = !!store?.canWrite;
  const btn = 'rounded-full border border-line bg-surface px-3 py-1.5 text-[13px] font-medium hover:bg-sunk disabled:opacity-60';
  const label = 'mt-2 text-[11px] font-semibold uppercase tracking-wider text-muted';
  return (
    <section aria-labelledby={heading} className="mt-5 grid gap-1 rounded-2xl border border-dashed border-muted bg-surface p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h3 id={heading} className="font-display text-[13px] font-semibold uppercase tracking-wider text-muted">{t('draftTitle')}</h3>
        <span className="text-[13px] text-muted">{t('notSent')}</span>
      </div>
      <div className={label}>{t('mailTo')}</div><div className="font-display text-[13px]">{c.email || '–'}</div>
      <div className={label}>{t('subject')}</div><div className="font-medium">{d.subject}</div>
      <div className={label}>{t('mailBody')}</div><div className="whitespace-pre-wrap text-[14px] leading-normal">{d.body}</div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <button type="button" onClick={() => copy(d.subject || '')} className={btn}>{t('copySubject')}</button>
        <button type="button" onClick={() => copy(d.body || '')} className={btn}>{t('copyText')}</button>
        {c.email && <a href={`mailto:${c.email}?subject=${encodeURIComponent(d.subject || '')}&body=${encodeURIComponent(d.body || '')}`} className={btn}>{t('openInMail')}</a>}
        <span className="flex-1" />
        {canWrite && <>
          <button type="button" disabled={pending} onClick={() => run(() => store!.updateCustomer(c.id, {draft: null}), t('draftDiscarded'))} className={`${btn} border-transparent text-muted`}>{t('discardDraft')}</button>
          <button type="button" disabled={pending} onClick={() => run(() => store!.updateCustomer(c.id, L.draftSentPatch(c, newId())), t('loggedAsSent'))}
            className="rounded-full bg-accent px-3 py-1.5 text-[13px] font-bold text-accent-ink hover:bg-accent-hover disabled:opacity-60">{t('iHaveSent')}</button>
        </>}
      </div>
    </section>
  );
}
