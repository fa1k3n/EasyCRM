import {useId, useState} from 'react';
import type {CustomerDoc} from '../../data/store';
import {useBusy, useCustomers, useStore, useWrite} from '../../data/StoreContext';
import {frozen, useMail} from '../../extensions/ExtensionsContext';
import {t} from '../../i18n';
import {logic, type MailText} from '../../logic';
import {ConfirmDialog} from '../Dialog';
import {useToast} from '../Toast';
import {inputClass as input, newId} from './forms';
import MailDialog, {type MailKind} from './MailDialog';

type Open = {kind: MailKind; e: CustomerEvent; text: MailText | null} | null;
const btn = 'rounded-full border px-3 py-1 text-[13px] font-medium disabled:opacity-60';

/* What else is booked during the event's day(s): bookings at all customers and busy times from the synced calendar. */
function Conflicts({e}: {e: CustomerEvent}) {
  const L = logic();
  const {customers} = useCustomers();
  const busy = useBusy();
  const k = L.eventConflicts(e, customers, busy);
  const multiDay = !!e.endDate && e.endDate !== e.date;
  if (k.length) return (
    <p className="mt-1 text-[13px] text-amber">
      <strong>{t('conflictsWith')}</strong>{' '}
      {k.map((x, i) => (
        <span key={i}>
          {i > 0 && ' · '}
          {x.time ? `${multiDay ? L.fmtDate(x.date) + ' ' : ''}${x.time}` : multiDay ? L.fmtDate(x.date) : t('allDay')} {x.title}
          {x.source === 'kalender' && <span className="text-muted"> {t('fromGoogleCalendar')}</span>}
        </span>
      ))}
    </p>
  );
  return <p className={`mt-1 text-[13px] ${busy ? 'text-ok' : 'text-muted'}`}>{busy ? t('noConflicts') : t('calendarNotSynced')}</p>;
}

function When({e}: {e: CustomerEvent}) {
  const L = logic();
  return (
    <div className="font-display text-[13px]">
      {L.fmtDate(e.date)}
      {e.endDate && e.endDate !== e.date && <><br /><span className="text-muted">– {L.fmtDate(e.endDate)}</span></>}
    </div>
  );
}

/* The customer's events: upcoming ones (offer services or log the offer, hide), ended ones to follow up (write or log
 * a follow-up, skip), hidden ones (show again) and a form to add an event by hand. With a mail extension the offer
 * and the follow-up open a mail with its text; without one they are logged as sent without text, after a question. */
export default function Events({c}: {c: CustomerDoc}) {
  const L = logic();
  const store = useStore();
  const mail = useMail();
  const toast = useToast();
  const {run, pending} = useWrite();
  const heading = useId();
  const [open, setOpen] = useState<Open>(null);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [url, setUrl] = useState('');
  const canWrite = !!store?.canWrite;
  const upcoming = L.upcomingEvents(c), done = L.eventsToFollowUp(c), hidden = L.hiddenEvents(c);

  const start = (e: CustomerEvent, kind: MailKind) => {
    if (!mail) return setOpen({kind, e, text: null});
    try {
      const raw = kind === 'eventfu' ? mail.buildEventFollowUp(frozen(c), e) : mail.buildOffer(frozen(c), e);
      setOpen({kind, e, text: L.normalizeMailText(raw)});
    } catch (err) {
      // An error in the extension never stops the app: the event can still be logged without text
      toast(t('mailError', {message: err instanceof Error ? err.message : String(err)}));
      setOpen({kind, e, text: null});
    }
  };
  const logOnly = async (e: CustomerEvent, kind: MailKind) => {
    const entry = L.logOnlyEntry(e, kind);
    await store!.updateCustomer(c.id, L.sentPatch(c, e.id!, kind, {id: newId(), kind: 'mail_ut', date: L.todayISO(), subject: entry.subject, note: entry.note}));
    toast(t('loggedAsSent'));
  };
  const dismiss = (e: CustomerEvent, dismissed: boolean) =>
    run(() => store!.updateCustomer(c.id, L.dismissEventPatch(c, e.id!, dismissed)), dismissed ? t('eventHidden') : t('eventShown'));
  const add = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!title.trim() || !date) return;
    const e = {id: newId(), title: title.trim(), date, url: url.trim(), source: 'manuell', dismissed: false};
    if (await run(() => store!.updateCustomer(c.id, L.addEventPatch(c, e)), t('eventAdded'))) { setTitle(''); setDate(''); setUrl(''); }
  };

  return (
    <section aria-labelledby={heading} className="mt-5 rounded-2xl border border-line bg-surface p-4">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h3 id={heading} className="font-display text-[13px] font-semibold uppercase tracking-wider text-event">★ {t('upcomingEvents')} <span className="text-muted">{upcoming.length}</span></h3>
        <span className="text-[13px] text-muted">{c.eventsCheckedAt ? t('eventsChecked', {date: L.fmtDate(String(c.eventsCheckedAt).slice(0, 10))}) : t('eventsNotChecked')}</span>
      </div>
      {upcoming.length ? (
        <ul>
          {upcoming.map(e => {
            const u = L.safeUrl(e.url);
            return (
              <li key={e.id} className={`grid grid-cols-[88px_1fr] gap-3 border-t border-line py-3 first:border-t-0 sm:grid-cols-[88px_1fr_auto] ${e.offeredAt ? 'rounded-lg border border-ok bg-ok-soft px-2.5' : ''}`}>
                <When e={e} />
                <div className="min-w-0">
                  <div className="font-medium [overflow-wrap:anywhere]">
                    {e.title}
                    {L.isNewEvent(e) && <span className="ml-2 rounded-full border border-event px-[7px] py-0.5 text-[11px] font-semibold uppercase text-event">{t('eventNew')}</span>}
                  </div>
                  {e.location && <div className="text-[13px] text-muted">{e.location}</div>}
                  {e.why && <p className="mt-1 text-[13.5px]">{e.why}</p>}
                  <div className="mt-1 text-[13px]">
                    {u
                      ? <><span className="text-muted">{t('foundOn')}</span> <a href={u} target="_blank" rel="noopener noreferrer" title={u} className="text-info underline">{e.sourceLabel || L.hostOf(u)} ↗</a></>
                      : <span className="text-muted">{t('noSource')}</span>}
                    {e.source === 'manuell' && <span className="text-muted"> {t('addedByHand')}</span>}
                  </div>
                  {e.offeredAt
                    ? <div className="mt-1 text-[13px] font-medium text-ok">{t('offerSentOn', {date: L.fmtDate(e.offeredAt)})}</div>
                    : c.status !== 'potentiell' && <div className="mt-1 text-[13px] text-tally">{t('eventNoOffer')}</div>}
                  <Conflicts e={e} />
                </div>
                {canWrite && (
                  <div className="col-span-2 flex flex-wrap items-start gap-1.5 sm:col-span-1 sm:flex-col sm:items-end">
                    {!e.offeredAt && (
                      <button type="button" onClick={() => start(e, 'offer')} title={mail ? t('offerServicesTitle') : t('logOfferTitle')}
                        className={`${btn} border-event bg-surface text-event hover:bg-event hover:text-surface`}>{mail ? t('offerServices') : t('logOffer')}</button>
                    )}
                    <button type="button" onClick={() => dismiss(e, true)} disabled={pending} aria-label={t('hideEvent', {title: e.title || ''})} className={`${btn} border-transparent text-muted hover:bg-sunk`}>{t('hide')}</button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      ) : <p className="text-[13px] text-muted">{t('noUpcomingEvents')}</p>}

      {done.length > 0 && (
        <div className="mt-3 border-t border-line pt-3">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">{t('endedEvents')}</div>
          <ul aria-label={t('endedEvents')}>
            {done.map(e => (
              <li key={e.id} className="grid grid-cols-[88px_1fr] gap-3 py-2.5 sm:grid-cols-[88px_1fr_auto]">
                <div className="font-display text-[13px]">{L.fmtDate(e.endDate || e.date)}</div>
                <div className="min-w-0"><div className="font-medium">{e.title}</div><div className="text-[13px] text-muted">{t('followUpHint')}</div></div>
                {canWrite && (
                  <div className="col-span-2 flex flex-wrap gap-1.5 sm:col-span-1 sm:flex-col sm:items-end">
                    <button type="button" onClick={() => start(e, 'eventfu')} className={`${btn} border-event bg-surface text-event hover:bg-event hover:text-surface`}>{mail ? t('writeFollowUp') : t('logFollowUp')}</button>
                    <button type="button" onClick={() => dismiss(e, true)} disabled={pending} aria-label={t('skipFollowUp', {title: e.title || ''})} className={`${btn} border-transparent text-muted hover:bg-sunk`}>{t('skip')}</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {hidden.length > 0 && (
        <details className="mt-3 border-t border-line pt-3">
          <summary className="cursor-pointer text-[13px] text-muted">{t('hiddenEvents', {count: hidden.length})}</summary>
          <ul>
            {hidden.map(e => (
              <li key={e.id} className="grid grid-cols-[88px_1fr_auto] gap-3 py-2 opacity-80">
                <When e={e} />
                <div className="min-w-0 font-medium">{e.title}{e.location && <div className="text-[13px] font-normal text-muted">{e.location}</div>}</div>
                {canWrite ? <button type="button" onClick={() => dismiss(e, false)} disabled={pending} aria-label={t('showEventAgain', {title: e.title || ''})} className={`${btn} border-line`}>{t('showAgain')}</button> : <span />}
              </li>
            ))}
          </ul>
        </details>
      )}

      {canWrite && (
        <form onSubmit={add} className="mt-3 grid grid-cols-2 gap-2 border-t border-line pt-3">
          <input aria-label={t('eventField')} placeholder={t('eventPlaceholder')} required value={title} onChange={ev => setTitle(ev.target.value)} className={`${input} col-span-2`} />
          <input type="date" aria-label={t('eventDate')} required value={date} onChange={ev => setDate(ev.target.value)} className={input} />
          <input type="url" aria-label={t('eventUrl')} placeholder={t('eventUrl')} value={url} onChange={ev => setUrl(ev.target.value)} className={input} />
          <div className="col-span-2 flex justify-end">
            <button type="submit" disabled={pending} className="rounded-full bg-accent px-3 py-1 text-[13px] font-bold text-accent-ink hover:bg-accent-hover disabled:opacity-60">{t('addEvent')}</button>
          </div>
        </form>
      )}

      {open && open.text && <MailDialog c={c} e={open.e} kind={open.kind} text={open.text} onClose={() => setOpen(null)} />}
      {open && !open.text && (
        <ConfirmDialog text={t('logAsSent', {subject: L.logOnlyEntry(open.e, open.kind).subject})} okLabel={t('logOk')}
          onConfirm={() => logOnly(open.e, open.kind)} onClose={() => setOpen(null)} />
      )}
    </section>
  );
}
