/* The customer card: the changes that are written with update on the customer (contacts, jobs, status, the form). */
import {addBookingPatch, removeBookingPatch} from './bookings';
import {lastTouch} from './contact';
import {addEventPatch} from './events';

// A new contact in the log: the latest contact is worked out again, and the latest mail is set for a mail
export const addCommPatch = (c: Customer, m: Comm): Partial<Customer> => {
  const comms = [...(c.comms || []), m];
  const p: Partial<Customer> = {comms, lastContact: lastTouch({comms, jobs: c.jobs || []})};
  if (m.kind === 'mail_ut' || m.kind === 'mail_in') p.lastMail = {date: m.date, subject: m.subject};
  return p;
};
export const removeCommPatch = (c: Customer, id: string): Partial<Customer> => {
  const comms = (c.comms || []).filter(m => m.id !== id);
  return {comms, lastContact: lastTouch({comms, jobs: c.jobs || []})};
};
// A job also counts as a contact
export const addJobPatch = (c: Customer, j: Job): Partial<Customer> => {
  const jobs = [...(c.jobs || []), j];
  return {jobs, lastJob: {title: j.title, date: j.date}, lastContact: lastTouch({comms: c.comms || [], jobs})};
};
export const removeJobPatch = (c: Customer, id: string): Partial<Customer> => {
  const jobs = (c.jobs || []).filter(j => j.id !== id);
  return {jobs, lastContact: lastTouch({comms: c.comms || [], jobs})};
};
// Customer or potential customer: only the status changes, nothing else in the document
export const statusPatch = (status: 'kund' | 'potentiell'): Partial<Customer> => ({status});
// The customer form: the fields trimmed and the customer types. The errors are text keys (the language files), not finished texts.
interface CustomerForm { company?: string; name?: string; role?: string; email?: string; phone?: string; website?: string; city?: string; notes?: string; status: string; types: string[]; }
export const customerFormPatch = (f: CustomerForm): {patch: Partial<Customer>; errors: string[]} => {
  const v = (x?: string) => (x || '').trim();
  const patch: Partial<Customer> = {company: v(f.company), name: v(f.name), role: v(f.role), email: v(f.email), phone: v(f.phone),
    website: v(f.website), city: v(f.city), notes: v(f.notes), status: f.status, types: [...f.types]};
  return {patch, errors: patch.company || patch.name ? [] : ['companyOrName']};
};

/* The customer's lists by name, for the REST API: the same rules as the app's own patches above */
export type ListName = 'comms' | 'jobs' | 'events' | 'bookings';
export const LISTS: ListName[] = ['comms', 'jobs', 'events', 'bookings'];
type Item = {id?: string};
// A new element: contacts and jobs work out the latest contact (and the latest mail or job) as when the app adds them
export const addItemPatch = (c: Customer, list: ListName, item: Item): Partial<Customer> =>
  list === 'comms' ? addCommPatch(c, item as Comm) : list === 'jobs' ? addJobPatch(c, item as Job)
    : list === 'bookings' ? addBookingPatch(c, item as Booking) : addEventPatch(c, item as CustomerEvent);
// An element replaced in place (the same id); for contacts and jobs the latest contact is worked out again
export const replaceItemPatch = (c: Customer, list: ListName, item: Item): Partial<Customer> => {
  const items = ((c[list] || []) as Item[]).map(x => (x.id === item.id ? item : x));
  if (list !== 'comms' && list !== 'jobs') return {[list]: items};
  const comms = list === 'comms' ? items as Comm[] : c.comms || [], jobs = list === 'jobs' ? items as Job[] : c.jobs || [];
  return {[list]: items, lastContact: lastTouch({comms, jobs})};
};
// An element removed by its id
export const removeItemPatch = (c: Customer, list: ListName, id: string): Partial<Customer> =>
  list === 'comms' ? removeCommPatch(c, id) : list === 'jobs' ? removeJobPatch(c, id)
    : list === 'bookings' ? removeBookingPatch(c, id) : {events: (c.events || []).filter(e => e.id !== id)};
// The starting values of a new customer (they always win over what was sent): the lists the logic expects, no contact yet
export const newCustomerDefaults = (at: string) => ({jobs: [] as Job[], comms: [] as Comm[], lastContact: null, createdAt: at, updatedAt: at});
