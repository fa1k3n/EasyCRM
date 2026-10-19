/* Customers' events: upcoming, open (no offer sent yet), hidden and ended ones to follow up, and what else is booked
 * during an event. */
import {bookingTitle} from './bookings';
import {tx} from './i18n';
import {daysSince, daysUntil, todayISO} from './time';

const SOON_DAYS = 14, EVENT_FOLLOWUP_WINDOW = 30;
export const EVENT_FOLLOWUP_AFTER = 3;

const byDate = (a: {date?: ISODate}, b: {date?: ISODate}): number => (a.date||'').localeCompare(b.date||'');
export const eventEnd = (e: CustomerEvent): ISODate | undefined => e.endDate || e.date;
export const upcomingEvents = (c: Customer): CustomerEvent[] => (c.events||[]).filter(e => !e.dismissed && (e.endDate || e.date)! >= todayISO()).sort(byDate);
// An event to mark: at a customer (not a potential one) and without a sent offer
export const eventOpen = (c: Customer, e: CustomerEvent | null | undefined): boolean => !!e && !e.offeredAt && c.status !== 'potentiell';
// An event is handled when an offer was sent (offeredAt) or it was hidden (dismissed)
export const openEvents = (c: Customer): CustomerEvent[] => upcomingEvents(c).filter(e => eventOpen(c, e));
export const hasEvent = (c: Customer): boolean => openEvents(c).length > 0;
export const hiddenEvents = (c: Customer): CustomerEvent[] => (c.events||[]).filter(e => e.dismissed && (e.endDate || e.date)! >= todayISO()).sort(byDate);
export const isNewEvent = (e: CustomerEvent): boolean => !!e.foundAt && daysSince(String(e.foundAt).slice(0,10)) <= 7;
// The next event is shown in the customer list whether or not an offer was already sent
export const nextEvent = (c: Customer): CustomerEvent | null => upcomingEvents(c)[0] || null;
export const eventSoon = (c: Customer): boolean => { const e = nextEvent(c); return !!e && daysUntil(e.date!) <= SOON_DAYS; };
// The label in the customer list: unhandled events ("to offer", with a count) come before "soon"
export function eventBadge(c: Customer): EventBadge | null {
  if (c.status === 'potentiell') return null;
  const open = openEvents(c).length;
  if (open) return {kind:'offer', count:open};
  return eventSoon(c) ? {kind:'soon', count:0} : null;
}
// Events that ended within 30 days without a sent follow-up mail, the most recently ended first
export const eventsToFollowUp = (c: Customer): CustomerEvent[] => c.status === 'potentiell' ? [] : (c.events||[])
  .filter(e => !e.dismissed && !e.followUpSentAt && e.date && eventEnd(e)! < todayISO() && daysSince(eventEnd(e)!) <= EVENT_FOLLOWUP_WINDOW)
  .sort((a,b) => eventEnd(b)!.localeCompare(eventEnd(a)!));
// When an event is: ongoing (already started), today, tomorrow or in a number of days
export const eventWhen = (e: CustomerEvent): {kind: 'ongoing' | 'today' | 'tomorrow' | 'days'; days: number} => {
  const days = daysUntil(e.date || todayISO()) + 0;   // + 0 turns -0 (today) into 0
  return {kind: days < 0 ? 'ongoing' : days === 0 ? 'today' : days === 1 ? 'tomorrow' : 'days', days};
};
// What is already booked during the event's day(s): bookings at all customers and events in Google Calendar
export function eventConflicts(e: CustomerEvent, customers?: Customer[] | null, busy?: BusyItem[] | null): Conflict[] {
  // Without a date the comparison is against undefined, exactly as in the original JavaScript code
  const from = e.date!, to = eventEnd(e)!, out: Conflict[] = [], seenGcal = new Set<string>();
  for (const c of customers||[]) {
    const who = c.company || c.name || tx('unnamed');
    for (const b of c.bookings||[]) {
      if (!b.date || b.date < from || b.date > to) continue;
      if (b.gcalEventId && b.source === 'gcal') seenGcal.add(b.gcalEventId);
      out.push({date:b.date, time:b.time || '', title:bookingTitle(b, who), source:'bokning', customerId:c.id});
    }
  }
  for (const x of busy||[]) {
    if (!x.date || x.date < from || x.date > to || (x.eventId && seenGcal.has(x.eventId))) continue;
    out.push({date:x.date, time:x.time || '', title:x.title || tx('busy'), source:'kalender'});
  }
  return out.sort((a,b) => (a.date + a.time).localeCompare(b.date + b.time));
}
// An event is added last; an event is hidden or shown again (the others untouched)
export const addEventPatch = (c: Customer, e: CustomerEvent): Partial<Customer> => ({events: [...(c.events || []), e]});
export const dismissEventPatch = (c: Customer, id: string, dismissed: boolean): Partial<Customer> =>
  ({events: (c.events || []).map(e => e.id === id ? {...e, dismissed} : e)});
