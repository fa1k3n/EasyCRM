/* Bookings and the calendar: upcoming and past bookings, and everything the calendar agent syncs to Google Calendar. */
import {contactDeadline} from './contact';
import {EVENT_FOLLOWUP_AFTER, eventEnd} from './events';
import {addDays, todayISO} from './time';

export const BOOKING_KINDS: Record<string, string> = {jobb:'Jobb', mote:'Möte', samtal:'Samtal'} satisfies Record<BookingKind, string>;
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
    const who = c.company || c.name || 'Namnlös';
    for (const b of c.bookings||[]) {
      if (!b.date || b.date < from || b.source === 'gcal') continue;
      items.push({key:`booking:${c.id}:${b.id}`, kind:'booking', customerId:c.id,
        title:`${BOOKING_KINDS[b.kind as string] || 'Möte'}: ${who}${b.title ? ' – ' + b.title : ''}`,
        date:b.date, time:b.time || null, allDay:!b.time, durationMin:b.durationMin || 60, location:b.location || ''});
    }
    if (c.followUp && c.followUp.date && c.followUp.date >= today) {
      items.push({key:`followup:${c.id}`, kind:'followup', customerId:c.id, title:`Följ upp: ${who}`,
        date:c.followUp.date, allDay:true, note:c.followUp.note || ''});
    }
    const deadline = contactDeadline(c);
    if (c.status !== 'potentiell' && deadline && deadline >= today && !hasBooking(c)) {
      items.push({key:`deadline:${c.id}`, kind:'deadline', customerId:c.id, title:`90 dagar utan kontakt: ${who}`, date:deadline, allDay:true});
    }
    if (c.status !== 'potentiell') {
      for (const e of c.events||[]) {
        if (e.dismissed || e.followUpSentAt || !e.date) continue;
        const date = addDays(eventEnd(e)!, EVENT_FOLLOWUP_AFTER);
        if (date < today) continue;
        items.push({key:`eventfu:${c.id}:${e.id}`, kind:'eventfu', customerId:c.id, title:`Följ upp event: ${who} – ${e.title}`, date, allDay:true});
      }
    }
    for (const j of c.jobs||[]) {
      if (!j.dueDate || !OPEN_INVOICE.includes(j.invoiceStatus as string)) continue;
      items.push({key:`invoice:${c.id}:${j.id}`, kind:'invoice', customerId:c.id,
        title:`Förfaller: faktura #${j.invoiceNumber} ${who}${j.amount ? ` (${j.amount} kr)` : ''}`, date:j.dueDate, allDay:true});
    }
  }
  return items.sort((a,b) => a.date.localeCompare(b.date) || a.key.localeCompare(b.key));
}
