/* /api/v1/calendar: everything the calendar agent syncs (the logic's calendarItems) and, for every upcoming event,
 * what is already booked during it (the logic's calendarConflicts against all bookings and sync/busy), worked out by
 * the server so that agents do not need to repeat the rules. */
import {Hono} from 'hono';
import {calendarItems} from '../../crm/logic/bookings';
import {calendarConflicts} from '../../crm/logic/events';
import type {Env} from './app';
import type {Db} from './db';

export function calendarRoutes(db: Db) {
  const r = new Hono<Env>();
  r.get('/', async c => {
    const customers = (await db.list('customers')).map(row => ({...row.data, id: row.id}) as Customer);
    const busyDoc = await db.get('sync', 'busy');
    // A missing or broken sync/busy only means no busy times (design rule: one broken part never stops the rest)
    const busy = Array.isArray(busyDoc?.data.items) ? busyDoc!.data.items as BusyItem[] : null;
    return c.json({items: calendarItems(customers), conflicts: calendarConflicts(customers, busy)});
  });
  return r;
}
