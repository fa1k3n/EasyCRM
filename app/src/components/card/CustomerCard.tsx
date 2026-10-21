import {useEffect, useRef} from 'react';
import {useCustomer} from '../../data/StoreContext';
import {t} from '../../i18n';
import {logic} from '../../logic';
import ErrorBoundary from '../ErrorBoundary';
import TypeIcon from '../TypeIcon';
import {ExtensionSections} from '../../extensions/ExtensionsContext';
import Bookings from './Bookings';
import Draft from './Draft';
import Events from './Events';
import CardActions from './CardActions';
import ContactDetails, {Why} from './ContactDetails';
import ContactLog from './ContactLog';
import Jobs from './Jobs';

const DAYS_TEXT: Record<ContactStatus['level'], string> = {over: 'text-tally', never: 'text-amber', warn: 'text-amber', ok: 'text-muted'};

/* The red or amber bar under the head: overdue (90+ days), never contacted, or getting close (60+ days). */
function AlertBar({c, onLog}: {c: Customer; onLog: () => void}) {
  const L = logic();
  const st = L.status(c);
  const logButton = <button type="button" onClick={onLog} className="ml-auto rounded-full border border-line bg-surface px-2.5 py-1 text-[13px] font-medium text-ink">{t('logContact')}</button>;
  if (st.level === 'over') return (
    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2.5 rounded-2xl bg-tally-soft px-4 py-3 text-tally">
      <span className="font-display text-2xl font-semibold">{t('daysShort', {days: st.days!})}</span>
      <span><strong className="font-semibold">{t('noContactSince', {date: L.fmtDate(st.d)})}</strong> {t('timeToGetInTouch')}</span>
      {logButton}
    </div>
  );
  if (st.level === 'never') return (
    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2.5 rounded-2xl bg-amber-soft px-4 py-3 text-amber">
      <span><strong className="font-semibold">{t('noContactYet')}</strong> {c.status === 'potentiell' ? t('noContactYetPotential') : ''}</span>
      {logButton}
    </div>
  );
  if (st.level === 'warn') return (
    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2.5 rounded-2xl bg-amber-soft px-4 py-3 text-amber">
      <span className="font-display text-2xl font-semibold">{t('daysShort', {days: st.days!})}</span>
      <span>{t('sinceLastContact', {limit: L.LIMIT})}</span>
    </div>
  );
  return null;
}

/* The customer card: head, contact status, contact details, why an agent suggested them, bookings and the follow-up
 * reminder, the contact log, jobs and invoices, and notes. Every part has its own error boundary, so one broken part
 * does not hide the rest, and each form is keyed by the customer, so typed text never follows to another customer. */
export default function CustomerCard({id, onBack}: {id: string | null; onBack: () => void}) {
  const c = useCustomer(id);
  const heading = useRef<HTMLHeadingElement>(null);
  const subject = useRef<HTMLInputElement>(null);
  // A chosen customer gets the focus, so keyboard and screen reader users land on the card (the list may be hidden)
  useEffect(() => { if (id) heading.current?.focus(); }, [id]);
  const back = <button type="button" onClick={onBack} className="mb-2 rounded-full px-3 py-1.5 text-muted hover:bg-sunk hover:text-ink md:hidden">{t('backToList')}</button>;

  // The chosen customer can disappear (removed in another tab or by an agent): say so, with a way back
  if (id && !c) return <div>{back}<p className="text-muted">{t('customerGone')}</p></div>;
  if (!c) {
    return (
      <div className="hidden h-full place-items-center text-center text-muted md:grid">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink">{t('chooseCustomer')}</h2>
          <p>{t('chooseCustomerHint')}</p>
        </div>
      </div>
    );
  }
  const L = logic();
  const st = L.status(c);
  return (
    <article>
      {back}
      <div className="flex flex-wrap items-center gap-2.5">
        {L.customerTypes(c).map(type => (
          <span key={type} className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-wide" style={{color: `var(--t-${type})`}}><TypeIcon id={type} size={15} decorative />{L.SERVICE_TYPES[type]}</span>
        ))}
        {c.status === 'potentiell' && <span className="rounded-full border border-dashed border-muted px-[7px] py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted">{t('potentialCustomer')}</span>}
        {c.status === 'kontaktad' && <span className="rounded-full border border-info px-[7px] py-0.5 text-[11px] font-semibold uppercase tracking-wide text-info">{t('contactedCustomer')}</span>}
        <span className={`font-display text-[12.5px] font-semibold ${DAYS_TEXT[st.level]}`}>
          {st.level === 'never' ? t('notContacted') : t('lastContactOn', {date: L.fmtDate(st.d)})}
        </span>
      </div>
      <div className="flex flex-wrap items-start justify-between gap-x-5 gap-y-3">
        <div className="min-w-0">
          <h2 ref={heading} tabIndex={-1} className="mt-1 font-display text-3xl font-medium tracking-tight outline-none [text-wrap:balance]">{c.company || c.name || t('unnamed')}</h2>
          {c.company && c.name && <p className="text-[15px] text-muted">{c.name}{c.role ? ` · ${c.role}` : ''}</p>}
        </div>
        <ErrorBoundary><CardActions c={c} onRemoved={onBack} /></ErrorBoundary>
      </div>
      <AlertBar c={c} onLog={() => subject.current?.focus()} />
      <ErrorBoundary><ContactDetails c={c} /></ErrorBoundary>
      <ErrorBoundary><Why c={c} /></ErrorBoundary>
      <ErrorBoundary><Draft key={c.id} c={c} /></ErrorBoundary>
      <ErrorBoundary><Events key={c.id} c={c} /></ErrorBoundary>
      <ExtensionSections c={c} />
      <ErrorBoundary><Bookings key={c.id} c={c} /></ErrorBoundary>
      <div className="mt-7 grid grid-cols-1 gap-7 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <ErrorBoundary><ContactLog key={c.id} c={c} subjectRef={subject} /></ErrorBoundary>
        <div className="flex flex-col gap-7">
          {c.status !== 'potentiell' && <ErrorBoundary><Jobs key={c.id} c={c} /></ErrorBoundary>}
          <section>
            <h3 className="mb-2.5 font-display text-[13px] font-semibold uppercase tracking-wider text-muted">{t('notes')}</h3>
            {c.notes ? <div className="whitespace-pre-wrap rounded-2xl border border-line bg-surface px-3.5 py-3 text-text [overflow-wrap:anywhere]">{c.notes}</div>
              : <p className="text-[13px] text-muted">{t('noNotes')}</p>}
          </section>
        </div>
      </div>
    </article>
  );
}
