import {CalendarDays, Mail} from 'lucide-react';
import type {CustomerDoc} from '../../data/store';
import {t} from '../../i18n';
import {logic} from '../../logic';
import TypeIcon from '../TypeIcon';
import {useListBadges} from '../../extensions/ExtensionsContext';

/* "today", "ongoing", "tomorrow" or "in 12 d" for an event (the logic decides which, this only gives the text) */
function whenLabel(e: CustomerEvent): string {
  const w = logic().eventWhen(e);
  return w.kind === 'ongoing' ? t('whenOngoing') : w.kind === 'today' ? t('whenToday') : w.kind === 'tomorrow' ? t('whenTomorrow') : t('whenInDays', {days: w.days});
}

const STRIPE: Record<ContactStatus['level'], string> = {over: 'bg-tally', never: 'bg-amber', warn: 'bg-amber', ok: 'bg-transparent'};
const DAYS: Record<ContactStatus['level'], string> = {over: 'text-tally', never: 'text-amber', warn: 'text-amber', ok: 'text-muted'};
const pillClass = 'rounded-full px-[7px] py-0.5 text-[11px] font-semibold uppercase tracking-wide';

/* The customer types as icons in the brand's type colours */
function TypeMarks({c}: {c: Customer}) {
  const types = logic().customerTypes(c);
  if (!types.length) return null;
  return <span className="flex gap-1">{types.map(id => <TypeIcon key={id} id={id} size={15} />)}</span>;
}

/* One customer in the list: name, contact person, contact status, badges, latest mail, next event and next booking. */
export default function CustomerRow({c, selected, onSelect}: {c: CustomerDoc; selected: boolean; onSelect: (id: string) => void}) {
  const L = logic();
  const st = L.status(c), lm = L.latestMail(c), ev = L.nextEvent(c), badge = L.eventBadge(c), nb = L.nextBooking(c);
  const followUp = L.eventsToFollowUp(c).length > 0;
  const extBadges = useListBadges(c);
  const more = L.upcomingEvents(c).length - 1;
  const evOpen = L.eventOpen(c, ev);
  const title = c.company || c.name || t('unnamed');
  const sub = c.company && c.name ? c.name : c.email || '';
  return (
    <button type="button" data-id={c.id} aria-current={selected} onClick={() => onSelect(c.id)}
      className={`grid w-full grid-cols-[4px_1fr_auto] items-start gap-x-3 rounded-[14px] py-[11px] pr-3 text-left hover:bg-sunk ${selected ? 'bg-surface shadow-md' : ''} ${badge?.kind === 'offer' && !selected ? 'bg-event-soft' : ''}`}>
      <span className={`row-span-2 self-stretch rounded-sm ${STRIPE[st.level]}`} />
      <span className="min-w-0">
        <span className="block truncate font-semibold">{title}</span>
        {sub && <span className="block truncate text-[13px] text-muted">{sub}</span>}
      </span>
      <span className="flex flex-col items-end gap-1">
        <TypeMarks c={c} />
        {badge?.kind === 'offer' && <span className={`${pillClass} bg-tally text-tally-ink`}>{badge.count > 1 ? t('badgeOfferMany', {count: badge.count}) : t('badgeOffer')}</span>}
        {badge?.kind === 'soon' && <span className={`${pillClass} border border-event text-event`}>{t('badgeSoon')}</span>}
        {followUp && <span className={`${pillClass} border border-ok bg-ok-soft text-ok`}>{t('badgeFollowUpEvent')}</span>}
        {L.followUpDue(c) && <span title={c.followUp?.note || undefined} className={`${pillClass} border border-amber bg-amber-soft text-amber`}>{t('badgeFollowUp')}</span>}
        {extBadges.map(b => <span key={b.key} title={b.title} className={`${pillClass} border border-line text-ink`}>{b.text}</span>)}
        {st.level === 'over' && <span className={`${pillClass} bg-tally text-tally-ink`}>{t('badgeContact')}</span>}
        <span className={`whitespace-nowrap font-display text-[12.5px] font-semibold ${DAYS[st.level]}`}>{L.daysLabel(st)}</span>
        {c.status === 'kontaktad' && <span className={`${pillClass} border border-info text-info`}>{t('badgeContacted')}</span>}
        {c.status === 'potentiell' && (c.draft
          ? <span className={`${pillClass} border border-info text-info`}>{t('badgeDraft')}</span>
          : <span className={`${pillClass} border border-dashed border-muted text-muted`}>{t('badgePotential')}</span>)}
      </span>
      {lm && (
        <span className="col-span-2 col-start-2 mt-1 flex items-center gap-1.5 truncate text-[12.5px] text-muted">
          <Mail size={13} aria-hidden /> {L.fmtDate(lm.date)} · {lm.subject || L.KINDS[lm.kind || '']}
        </span>
      )}
      {ev && (
        <span className={`col-span-2 col-start-2 mt-0.5 truncate text-[12.5px] font-medium ${evOpen ? 'text-tally' : 'text-event'}`}>
          ★ {evOpen && <b title={t('eventNoOffer')} className="inline-grid size-[15px] place-items-center rounded-full bg-tally text-[10.5px] text-tally-ink">!</b>}{' '}
          {L.fmtDate(ev.date)} · {ev.title} · {whenLabel(ev)}{more > 0 && <span className="text-muted"> +{more}</span>}
        </span>
      )}
      {nb && (
        <span className="col-span-2 col-start-2 mt-0.5 flex items-center gap-1.5 truncate text-[12.5px] font-medium text-info">
          <CalendarDays size={13} aria-hidden /> {L.fmtDate(nb.date)}{nb.time ? ' ' + nb.time : ''} · {L.BOOKING_KINDS[nb.kind || ''] || L.BOOKING_KINDS.mote}{nb.title ? ': ' + nb.title : ''}
        </span>
      )}
    </button>
  );
}
