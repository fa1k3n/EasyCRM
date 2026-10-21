/* The customer list: filters, sorting, counts per segment, and the key for a removed agent suggestion. */
import {hasBooking} from './bookings';
import {customerTypes} from './brand';
import {contactScore, followUpDue, needsContact} from './contact';
import {safeUrl} from './text';

type Segment = 'alla' | 'kontakta' | 'bokat' | 'kunder' | 'kontaktade' | 'potentiella';
const SEGMENTS: Segment[] = ['alla', 'kontakta', 'bokat', 'kunder', 'kontaktade', 'potentiella'];
// The status as the list sees it: "kontaktad", "potentiell", or "kund" (also for a missing or unknown status)
export const statusOf = (c: Customer): 'kund' | 'kontaktad' | 'potentiell' => c.status === 'kontaktad' || c.status === 'potentiell' ? c.status : 'kund';
// Whether the customer belongs to the segment (an unknown segment shows all, like "alla")
const inSegment = (c: Customer, seg: string): boolean =>
  seg === 'kontakta' ? needsContact(c) || followUpDue(c) : seg === 'bokat' ? hasBooking(c) : seg === 'kunder' ? statusOf(c) === 'kund'
    : seg === 'kontaktade' ? statusOf(c) === 'kontaktad' : seg === 'potentiella' ? statusOf(c) === 'potentiell' : true;
// The quick filters: one of the statuses, and one of the flags ("kontakta", "bokat"); an empty or missing list is no filter
const inFilters = (c: Customer, view: View): boolean =>
  (!view.status?.length || view.status.includes(statusOf(c))) && (!view.flags?.length || view.flags.some(f => inSegment(c, f)));
// The number of customers in each segment (the same division as filterCustomers)
export const segmentCounts = (customers: Customer[]): Record<Segment, number> =>
  Object.fromEntries(SEGMENTS.map(s => [s, customers.filter(c => inSegment(c, s)).length])) as Record<Segment, number>;

export function filterCustomers(customers: Customer[], view: View): Customer[] {
  const q = (view.q || '').trim().toLowerCase();
  const items = customers.filter(c => {
    if (view.type && view.type !== 'alla' && !customerTypes(c).includes(view.type)) return false;
    if (view.seg && !inSegment(c, view.seg)) return false;
    if (!inFilters(c, view)) return false;
    if (q) { const hay = [c.company,c.name,c.email,c.phone,c.notes].join(' ').toLowerCase(); if (!hay.includes(q)) return false; }
    return true;
  });
  const label = (c: Customer): string => (c.company || c.name || '').toLowerCase();
  if (view.sort === 'namn') items.sort((a,b) => label(a).localeCompare(label(b),'sv'));
  else if (view.sort === 'nyast') items.sort((a,b) => String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
  else items.sort((a,b) => contactScore(b)-contactScore(a) || label(a).localeCompare(label(b),'sv'));
  return items;
}

// The key in the "skipped" collection (suggestions removed from the agent): the web domain if there is one, otherwise the company name
export function skipKey(c: Customer): string {
  let key = '';
  try { key = new URL(safeUrl(c.website) as string).hostname.replace(/^www\./, ''); } catch {}
  return (key || c.company || c.name || c.id || '').toLowerCase().replace(/[^a-z0-9.-]+/g, '-').slice(0, 120) || (c.id as string);
}
