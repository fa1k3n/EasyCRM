import {useState} from 'react';
import type {CustomerDoc} from '../../data/store';
import {useStore, writeErrorMessage} from '../../data/StoreContext';
import {t} from '../../i18n';
import {logic, type MailText} from '../../logic';
import Dialog from '../Dialog';
import {useToast} from '../Toast';
import {inputClass as input, newId, useCopy} from './forms';

export type MailKind = 'offer' | 'eventfu';

/* The mail before a customer's event (offer) or after it (follow-up), with the text from the mail extension. The text
 * can be changed freely; the mail is never sent by the app. "Open in mail program" opens a mailto link, "I have sent
 * it" logs the mail and marks the event, and "Save as draft" keeps it on the customer for later. */
export default function MailDialog({c, e, kind, text, onClose}: {c: CustomerDoc; e: CustomerEvent; kind: MailKind; text: MailText; onClose: () => void}) {
  const L = logic();
  const store = useStore();
  const toast = useToast();
  const [to, setTo] = useState(c.email || '');
  const [subject, setSubject] = useState(text.subject);
  const [body, setBody] = useState(text.body);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const mailto = `mailto:${to.trim()}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  const write = async (patch: Partial<Customer>, message: string) => {
    setPending(true);
    setError('');
    try {
      await store!.updateCustomer(c.id, patch);
      toast(message);
      onClose();
    } catch (err) {
      setError(writeErrorMessage(err));
      setPending(false);
    }
  };
  const sent = (ev: React.FormEvent) => {
    ev.preventDefault();
    const m = {id: newId(), kind: 'mail_ut', date: L.todayISO(), subject: subject.trim(), note: text.note, body};
    write(L.sentPatch(c, e.id!, kind, m), t('loggedAsSent'));
  };
  const draft = () => write({draft: {subject: subject.trim(), body, summary: text.note, eventId: e.id, kind}}, t('savedAsDraft'));
  const copy = useCopy();
  const btn = 'rounded-full border border-line bg-surface px-3 py-1.5 text-[13px] font-medium hover:bg-sunk';

  return (
    <Dialog title={t(kind === 'eventfu' ? 'followUpAfter' : 'offerBefore', {title: e.title || ''})} onClose={onClose} busy={pending} wide>
      <form onSubmit={sent} className="grid gap-3">
        {text.tags.length > 0 && (
          <div className="-mt-1.5 flex flex-wrap gap-1.5">
            {text.tags.map((tag, i) => <span key={i} className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${i === 0 ? 'bg-info text-surface' : 'bg-sunk text-muted'}`}>{tag}</span>)}
          </div>
        )}
        <label className="grid gap-1 text-[13px] font-semibold text-muted">{t('mailTo')}
          <input type="email" value={to} placeholder={t('noEmailSaved')} onChange={ev => setTo(ev.target.value)} className={`${input} font-normal text-ink`} />
        </label>
        <label className="grid gap-1 text-[13px] font-semibold text-muted">{t('subject')}
          <input value={subject} onChange={ev => setSubject(ev.target.value)} className={`${input} font-normal text-ink`} />
        </label>
        <label className="grid gap-1 text-[13px] font-semibold text-muted">{t('mailBody')}
          <textarea rows={14} value={body} onChange={ev => setBody(ev.target.value)} className={`${input} min-h-72 font-normal leading-normal text-ink`} />
        </label>
        <p className="max-w-[70ch] text-[13px] text-muted">{text.hint ? `${text.hint} ` : ''}{t('mailHint')}</p>
        {error && <p role="alert" className="text-[13px] text-tally">{error}</p>}
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => copy(body)} className={btn}>{t('copyText')}</button>
          <a href={mailto} className={btn}>{t('openInMail')}</a>
          <button type="button" onClick={draft} disabled={pending} className={`${btn} disabled:opacity-60`}>{t('saveAsDraft')}</button>
          <span className="flex-1" />
          <button type="submit" disabled={pending} className="rounded-full bg-accent px-4 py-1.5 text-[13px] font-bold text-accent-ink hover:bg-accent-hover disabled:opacity-60">{t('iHaveSent')}</button>
        </div>
      </form>
    </Dialog>
  );
}
