/* Bookings and the calendar: upcoming and past bookings, and everything the calendar agent syncs to Google Calendar. */
import {LIMIT, contactDeadline} from './contact';
import {EVENT_FOLLOWUP_AFTER, eventEnd} from './events';
import {type LogicTextKey, tx} from './i18n';
import {addDays, todayISO} from './time';

const KIND_IDS: BookingKind[] = ['jobb', 'mote', 'samtal'];
// The kinds of booking as {id: text} in the current language
export const bookingKinds = (): Record<string, string> => Object.fromEntries(KIND_IDS.map(k => [k, tx(`booking.${k}` as LogicTextKey)]));
// A booking's title in the calendar and in the conflicts: "Meeting: Example Ltd – Coffee"
export const bookingTitle = (b: Booking, who: string): string =>
  tx(b.title ? 'cal.bookingTitle' : 'cal.booking', {kind: bookingKinds()[b.kind as string] || tx('booking.mote'), who, title: b.title || ''});
const bookingSortKey = (b: Booking): string => (b.date || '') + ' ' + (b.time || '');
export const upcomingBookings = (c: Customer): Booking[] => (c.bookings||[]).filter(b => b.date && b.date >= todayISO()).sort((a,b) => bookingSortKey(a).localeCompare(bookingSortKey(b)));
export const nextBooking = (c: Customer): Booking | null => upcomingBookings(c)[0] || null;
export const hasBooking = (c: Customer): boolean => upcomingBookings(c).length > 0;
// Past bookings, the latest first
export const pastBookings = (c: Customer): Booking[] => (c.bookings||[]).filter(b => b.date && b.date < todayISO()).sort((a,b) => bookingSortKey(b).localeCompare(bookingSortKey(a)));
export const addBookingPatch = (c: Customer, b: Booking): Partial<Customer> => ({bookings: [...(c.bookings || []), b]});
export const removeBookingPatch = (c: Customer, id: string): Partial<Customer> => ({bookings: (c.bookings || []).filter(b => b.id !== id)});

const OPEN_INVOICE = ['published', 'overdue', 'underPaid'];
// Everything that should be in the Google Calendar the cloud agent syncs to. The key is stable, so that the agent can
// create, update and remove the right calendar event.
export function calendarItems(customers: Customer[]): CalendarItem[] {
  const today = todayISO(), from = addDays(today, -7);
  const items: CalendarItem[] = [];
  for (const c of customers) {
    if (c.example) continue;
    const who = c.company || c.name || tx('unnamed');
    for (const b of c.bookings||[]) {
      if (!b.date || b.date < from || b.source === 'gcal') continue;
      items.push({key:`booking:${c.id}:${b.id}`, kind:'booking', customerId:c.id,
        title:bookingTitle(b, who),
        date:b.date, time:b.time || null, allDay:!b.time, durationMin:b.durationMin || 60, location:b.location || ''});
    }
    if (c.followUp && c.followUp.date && c.followUp.date >= today) {
      items.push({key:`followup:${c.id}`, kind:'followup', customerId:c.id, title:tx('cal.followUp', {who}),
        date:c.followUp.date, allDay:true, note:c.followUp.note || ''});
    }
    const deadline = contactDeadline(c);
    if (c.status !== 'potentiell' && deadline && deadline >= today && !hasBooking(c)) {
      items.push({key:`deadline:${c.id}`, kind:'deadline', customerId:c.id, title:tx('cal.deadline', {days: LIMIT, who}), date:deadline, allDay:true});
    }
    if (c.status !== 'potentiell') {
      for (const e of c.events||[]) {
        if (e.dismissed || e.followUpSentAt || !e.date) continue;
        const date = addDays(eventEnd(e)!, EVENT_FOLLOWUP_AFTER);
        if (date < today) continue;
        items.push({key:`eventfu:${c.id}:${e.id}`, kind:'eventfu', customerId:c.id, title:tx('cal.eventFollowUp', {who, title: e.title || ''}), date, allDay:true});
      }
    }
    for (const j of c.jobs||[]) {
      if (!j.dueDate || !OPEN_INVOICE.includes(j.invoiceStatus as string)) continue;
      items.push({key:`invoice:${c.id}:${j.id}`, kind:'invoice', customerId:c.id,
        title:tx('cal.invoice', {number: j.invoiceNumber || '', who}) + (j.amount ? tx('cal.invoiceAmount', {amount: j.amount}) : ''), date:j.dueDate, allDay:true});
    }
  }
  return items.sort((a,b) => a.date.localeCompare(b.date) || a.key.localeCompare(b.key));
}
