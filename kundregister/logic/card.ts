/* The customer card: the changes that are written with update on the customer (contacts, jobs, status, the form). */
import {lastTouch} from './contact';

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
