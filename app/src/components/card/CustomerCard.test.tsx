import {act, fireEvent, render, screen, within} from '@testing-library/react';
import {fakeClaude} from '../../../test/fakeDb';
import {createArtifactStore} from '../../data/artifactStore';
import {StoreProvider} from '../../data/StoreContext';
import {ToastProvider} from '../Toast';
import CustomerCard from './CustomerCard';

const TODAY = '2026-10-15';
const daysAgo = (n: number) => { const d = new Date(TODAY + 'T12:00:00'); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
const BRAND = {
  company: {name: 'Testbolaget AB'}, colors: {accent: '#0f766e', ink: '#1f2933', bg: '#f6f7f7'},
  senders: [{id: 's', signature: ['X']}], defaultSender: 's',
  customerTypes: [{id: 'konsult', label: 'Konsultation', color: '#0f766e'}]
};
// All customers are made up
const CUSTOMERS = {
  c1: {company: 'Exempel Advokatbyrå', name: 'Anna Exempel', role: 'Marknadschef', status: 'kund', types: ['konsult'],
    email: 'anna@exempel.se', phone: '070-000 00 00', website: 'www.exempel.se', city: 'Stockholm', notes: 'Vill ha porträtt i vår.',
    comms: [{id: 'm1', kind: 'mail_ut', date: daysAgo(140), subject: 'Porträtt', note: 'Skickade offert', body: 'Hej Anna,\n\nHär kommer offerten.'},
            {id: 'm2', kind: 'samtal', date: daysAgo(150), subject: 'Första samtalet'}],
    jobs: [{id: 'j1', title: 'Porträtt 12 medarbetare', date: daysAgo(150), amount: '18 000', invoiceNumber: '7', invoiceStatus: 'overdue', invoiceUrl: 'https://faktura.example/7'},
           {id: 'j2', title: 'Eventfoto', date: daysAgo(160), invoiceUrl: 'javascript:alert(1)'}]},
  c2: {company: 'Exempel Fastigheter', name: 'Lena Exempel', status: 'potentiell', source: 'agent', why: 'Växer och har nya medarbetare.',
    website: 'javascript:alert(1)'},
  c3: {company: 'Exempel Konsult', status: 'kund', comms: [{id: 'm3', kind: 'samtal', date: daysAgo(70)}]}
};

beforeEach(() => {
  window.CRMLogic.setClock(() => new Date(TODAY + 'T12:00:00'));
  window.CRMLogic.setBrand(BRAND as unknown as Brand);
});
afterEach(() => { window.CRMLogic.setClock(null); window.CRMLogic.setBrand(null); });

async function show(id: string, opts: {canWrite?: boolean} = {}) {
  const fake = fakeClaude({customers: CUSTOMERS, canWrite: opts.canWrite});
  const store = await createArtifactStore(fake.claude);
  render(<ToastProvider><StoreProvider store={store}><CustomerCard id={id} onBack={() => {}} /></StoreProvider></ToastProvider>);
  await act(() => new Promise(r => setTimeout(r, 0)));
  return fake;
}
const settle = () => act(() => new Promise(r => setTimeout(r, 0)));

test('the head shows company, person and role, customer type and last contact', async () => {
  await show('c1');
  expect(screen.getByRole('heading', {level: 2}).textContent).toBe('Exempel Advokatbyrå');
  expect(screen.getByText('Anna Exempel · Marknadschef')).toBeTruthy();
  expect(screen.getByText('Konsultation')).toBeTruthy();
  expect(screen.getByText(`Senast kontakt ${window.CRMLogic.fmtDate(daysAgo(140))}`)).toBeTruthy();
});

test('over 90 days: a red bar with the days and a button that takes you to the contact log', async () => {
  await show('c1');
  const bar = screen.getByText(/Ingen kontakt sedan/).closest('div')!;
  expect(bar.textContent).toMatch('140 d');
  fireEvent.click(within(bar).getByRole('button', {name: 'Logga kontakt'}));
  expect(document.activeElement).toBe(screen.getByRole('textbox', {name: 'Ämne'}));
});

test('60–89 days: an amber note with the days and when it turns red', async () => {
  await show('c3');
  expect(screen.getByText(/sedan senaste kontakt/).textContent).toMatch('Markeras rött vid 90 dagar');
});

test('contact details: mail and phone links, and the website only as an http(s) link', async () => {
  await show('c1');
  expect(screen.getByRole('link', {name: 'anna@exempel.se'}).getAttribute('href')).toBe('mailto:anna@exempel.se');
  expect(screen.getByText('070-000 00 00')).toBeTruthy();
  expect(screen.getByRole('link', {name: 'www.exempel.se'}).getAttribute('href')).toBe('https://www.exempel.se');
  expect(screen.getByText('Stockholm')).toBeTruthy();
});

test('a potential customer from an agent shows why they fit; no jobs; an unsafe website is not a link', async () => {
  await show('c2');
  expect(screen.getByText('Prospekt')).toBeTruthy();
  expect(screen.getByText('Växer och har nya medarbetare.')).toBeTruthy();
  expect(screen.queryByRole('heading', {name: /Jobb/})).toBeNull();
  expect(screen.queryByRole('link', {name: /javascript/})).toBeNull();
  expect(screen.getByText('Ej kontaktad')).toBeTruthy();
});

test('the contact log lists the newest first, and a mail with text can be opened', async () => {
  await show('c1');
  const log = screen.getByRole('list', {name: 'Kommunikation'});
  const items = within(log).getAllByRole('listitem');
  expect(items[0].textContent).toMatch('Porträtt');
  expect(items[1].textContent).toMatch('Första samtalet');
  expect(within(items[0]).getByText(/Här kommer offerten/)).toBeTruthy();
});

test('logging a contact writes it with the last contact (and last mail), shows a message and empties the form', async () => {
  const fake = await show('c1');
  fireEvent.change(screen.getByRole('combobox', {name: 'Typ av kontakt'}), {target: {value: 'mail_ut'}});
  fireEvent.change(screen.getByRole('textbox', {name: 'Ämne'}), {target: {value: 'Uppföljning'}});
  fireEvent.click(screen.getByRole('button', {name: 'Logga'}));
  await settle();
  const doc = fake.collections.get('customers')!.get('c1')! as Customer;
  expect(doc.comms!.some(m => m.subject === 'Uppföljning' && m.date === TODAY)).toBe(true);
  expect(doc.lastContact).toBe(TODAY);
  expect(doc.lastMail).toEqual({date: TODAY, subject: 'Uppföljning'});
  expect(screen.getByRole('status').textContent).toBe('Kontakt loggad');
  expect((screen.getByRole('textbox', {name: 'Ämne'}) as HTMLInputElement).value).toBe('');
});

test('removing a contact needs a second click', async () => {
  const fake = await show('c1');
  const remove = () => within(screen.getByRole('list', {name: 'Kommunikation'})).getAllByRole('button', {name: /Ta bort/})[0];
  fireEvent.click(remove());
  expect((fake.collections.get('customers')!.get('c1') as Customer).comms).toHaveLength(2);
  expect(remove().textContent).toMatch('Ta bort?');
  fireEvent.click(remove());
  await settle();
  expect((fake.collections.get('customers')!.get('c1') as Customer).comms).toHaveLength(1);
});

test('jobs and invoices: amount, invoice number, status and a link only for a safe address', async () => {
  await show('c1');
  const jobs = screen.getByRole('list', {name: 'Jobb & fakturor'});
  const [j1, j2] = within(jobs).getAllByRole('listitem');
  expect(j1.textContent).toMatch('18 000 kr');
  expect(j1.textContent).toMatch('#7');
  expect(j1.textContent).toMatch('Förfallen');
  expect(within(j1).getByRole('link', {name: /Faktura/}).getAttribute('href')).toBe('https://faktura.example/7');
  expect(within(j2).queryByRole('link')).toBeNull();
});

test('adding a job writes it and counts it as contact', async () => {
  const fake = await show('c1');
  fireEvent.change(screen.getByRole('textbox', {name: 'Jobb'}), {target: {value: 'Porträtt VD'}});
  fireEvent.click(screen.getByRole('button', {name: 'Lägg till jobb'}));
  await settle();
  const doc = fake.collections.get('customers')!.get('c1')! as Customer;
  expect(doc.jobs!.some(j => j.title === 'Porträtt VD')).toBe(true);
  expect(doc.lastContact).toBe(TODAY);
});

test('the notes are shown', async () => {
  await show('c1');
  expect(screen.getByText('Vill ha porträtt i vår.')).toBeTruthy();
});

test('read-only: no forms or remove buttons', async () => {
  await show('c1', {canWrite: false});
  expect(screen.queryByRole('button', {name: 'Logga'})).toBeNull();
  expect(screen.queryByRole('button', {name: 'Lägg till jobb'})).toBeNull();
  expect(screen.queryAllByRole('button', {name: /Ta bort/})).toHaveLength(0);
});

test('a failed write shows a readable error and keeps what was typed', async () => {
  const fake = await show('c1');
  fake.failing.write = {code: 'quota_exceeded'};
  fireEvent.change(screen.getByRole('textbox', {name: 'Ämne'}), {target: {value: 'Uppföljning'}});
  fireEvent.click(screen.getByRole('button', {name: 'Logga'}));
  await settle();
  expect(screen.getByRole('status').textContent).toMatch('fullt');
  expect((screen.getByRole('textbox', {name: 'Ämne'}) as HTMLInputElement).value).toBe('Uppföljning');
});

test('a job cannot be saved without a date, and removing a job says "Borttaget"', async () => {
  const fake = await show('c1');
  fireEvent.change(screen.getByRole('textbox', {name: 'Jobb'}), {target: {value: 'Utan datum'}});
  fireEvent.change(screen.getAllByLabelText('Datum')[1], {target: {value: ''}});
  fireEvent.click(screen.getByRole('button', {name: 'Lägg till jobb'}));
  await settle();
  const doc = fake.collections.get('customers')!.get('c1')! as Customer;
  expect(doc.jobs!.some(j => j.title === 'Utan datum')).toBe(false);
  const remove = () => within(screen.getByRole('list', {name: 'Jobb & fakturor'})).getAllByRole('button', {name: /Ta bort/})[0];
  fireEvent.click(remove());
  fireEvent.click(remove());
  await settle();
  expect(screen.getByRole('status').textContent).toBe('Borttaget');
});

test('text typed in a form does not follow when another customer is chosen', async () => {
  const store = await createArtifactStore(fakeClaude({customers: CUSTOMERS}).claude);
  const tree = (id: string) => <ToastProvider><StoreProvider store={store}><CustomerCard id={id} onBack={() => {}} /></StoreProvider></ToastProvider>;
  const {rerender} = render(tree('c1'));
  await settle();
  fireEvent.change(screen.getByRole('textbox', {name: 'Ämne'}), {target: {value: 'Halvskrivet'}});
  rerender(tree('c3'));
  expect((screen.getByRole('textbox', {name: 'Ämne'}) as HTMLInputElement).value).toBe('');
});
