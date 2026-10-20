/* An example integration plugin: invoices from a made-up accounting service (invoices.example) become jobs with an
 * invoice on the right customer. Copy the folder to profile/integrations/<your id>/ and change it for your service.
 * Run: npm run integration -- example-invoices --brand example --url http://127.0.0.1:8787   (add --apply to write)
 * It needs the environment variable EXAMPLE_INVOICES_KEY (never in the repo or the brand folder). */
import type {IntegrationContext, IntegrationManifest, PlannedJob, PlannedLink, ReadonlyCustomer} from 'crm-integration-api';

const ID = 'example-invoices';
const BASE = 'https://invoices.example/v1';

interface ServiceCustomer { id: string; name: string; emails: string[] }
interface ServiceInvoice { id: string; number: number; customerId: string; date: string; dueDate: string; status: string; total: number; description?: string }

async function get<T>(ctx: IntegrationContext, path: string): Promise<T[]> {
  const res = await ctx.fetch(`${BASE}/${path}`, {headers: {Authorization: `Bearer ${ctx.config.EXAMPLE_INVOICES_KEY}`, Accept: 'application/json'}});
  // Only the status: the answer may hold customer data, and the key is in the request
  if (!res.ok) throw new Error(`The service answered ${res.status} for ${path}`);
  return ((await res.json()) as {items?: T[]}).items ?? [];
}

// "Exempelbolaget AB" and "exempelbolaget" are the same company
const plainName = (s = '') => s.toLowerCase().replace(/\bab\b/g, '').replace(/[^a-z0-9åäö]/g, '');
// 14500 → "14 500"
const amount = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

/* The register's customer for a service customer: the link saved last time, then the email, then the name.
 * Never a guess: no match gives undefined. */
function findCustomer(sc: ServiceCustomer, customers: readonly ReadonlyCustomer[]): ReadonlyCustomer | undefined {
  const linked = customers.find(c => (c.ext?.[ID] as {customerId?: string} | undefined)?.customerId === sc.id);
  if (linked) return linked;
  const emails = sc.emails.map(e => e.toLowerCase());
  const byEmail = customers.filter(c => c.email && emails.includes(c.email.toLowerCase()));
  if (byEmail.length === 1) return byEmail[0];
  const byName = customers.filter(c => plainName(c.company || c.name) === plainName(sc.name) && plainName(sc.name));
  return byName.length === 1 ? byName[0] : undefined;
}

const plugin: IntegrationManifest = {
  id: ID,
  name: 'Example invoices',
  apiVersion: 1,
  env: ['EXAMPLE_INVOICES_KEY'],
  hosts: ['invoices.example'],
  // The fields the service decides; the title, amount and link are the user's once the job exists
  owns: {jobs: ['invoiceNumber', 'invoiceStatus', 'dueDate']},

  async run(ctx) {
    const since = ctx.options.since ?? '';
    const ignore = (ctx.settings.ignore as string[] | undefined) ?? [];
    const serviceCustomers = (await get<ServiceCustomer>(ctx, 'customers')).filter(sc => !ignore.includes(sc.id));
    const invoices = (await get<ServiceInvoice>(ctx, 'invoices')).filter(i => i.status !== 'draft' && (!since || i.date >= since));

    const jobs: PlannedJob[] = [], links: PlannedLink[] = [], unmatched: string[] = [];
    const match = new Map<string, ReadonlyCustomer>();
    for (const sc of serviceCustomers) {
      const c = findCustomer(sc, ctx.customers);
      if (!c) { unmatched.push(sc.name); continue; }
      match.set(sc.id, c);
      if ((c.ext?.[ID] as {customerId?: string} | undefined)?.customerId !== sc.id) links.push({customerId: c.id, data: {customerId: sc.id}});
    }
    for (const inv of invoices) {
      const c = match.get(inv.customerId);
      if (!c) continue;
      jobs.push({customerId: c.id, item: {
        id: `${ID}-${inv.id}`, title: inv.description || `Invoice ${inv.number}`, date: inv.date, amount: amount(inv.total),
        invoiceNumber: inv.number, invoiceStatus: inv.status, dueDate: inv.dueDate, invoiceUrl: ''
      }});
    }
    return {jobs, links, unmatched};
  }
};

export default plugin;
