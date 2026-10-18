import {act, fireEvent, render, screen, within} from '@testing-library/react';
import {fakeClaude} from '../../../test/fakeDb';
import {createArtifactStore} from '../../data/artifactStore';
import {StoreProvider} from '../../data/StoreContext';
import {ExtensionsProvider} from '../../extensions/ExtensionsContext';
import {loadExtensions} from '../../extensions/load';
import {ToastProvider} from '../Toast';
import CustomerCard from './CustomerCard';

// "Today" is fixed; all customers and events are made up
const TODAY = '2026-10-15';
const L = () => window.CRMLogic;
beforeEach(() => L().setClock(() => new Date(TODAY + 'T12:00:00')));
afterEach(() => { L().setClock(null); jest.restoreAllMocks(); });

const CUSTOMERS = {
  k1: {company: 'Exempel Kund AB', status: 'kund', email: 'anna@exempel.se', comms: [], jobs: [], events: [
    {id: 'e1', title: 'Höstmässan', date: '2026-10-27', location: 'Exempelhallen', url: 'https://massan.example/2026', foundAt: '2026-10-14', why: 'De ställer ut'},
    {id: 'e2', title: 'Julfesten', date: '2026-12-10', dismissed: true},
    {id: 'e3', title: 'Sommarkonferensen', date: '2026-10-10'}
  ]},
  k2: {company: 'Exempel Annan AB', status: 'kund', bookings: [{id: 'b1', date: '2026-10-27', time: '10:00', title: 'Porträtt hos Annan', kind: 'jobb'}]},
  p1: {company: 'Exempel Prospekt AB', status: 'potentiell', email: 'p@exempel.se', draft: {subject: 'Hej från oss', body: 'Vi gör bilder.', summary: 'Första mailet'}}
};
const settle = () => act(() => new Promise(r => setTimeout(r, 0)));
const MAIL = {
  buildOffer: (c: {name?: string}, e: {title?: string}) => ({subject: `Inför ${e.title}`, body: 'Vi kan fota.', note: 'Erbjudande skickat', tags: ['Foto'], hint: 'Tips.'}),
  buildEventFollowUp: (c: unknown, e: {title?: string}) => ({subject: `Efter ${e.title}`, body: 'Hur gick det?', note: 'Uppföljning skickad'})
};

async function show(id: string, {mail, canWrite = true}: {mail?: unknown; canWrite?: boolean} = {}) {
  const fake = fakeClaude({customers: CUSTOMERS, canWrite});
  const store = await createArtifactStore(fake.claude);
  const ext = mail ? [{id: 'mailtexter', apiVersion: 1, name: 'Mailtexter', mail}] : [];
  render(<ToastProvider><StoreProvider store={store}><ExtensionsProvider loaded={loadExtensions(ext)}><CustomerCard id={id} onBack={() => {}} /></ExtensionsProvider></StoreProvider></ToastProvider>);
  await settle();
  return {doc: (x = id) => fake.collections.get('customers')!.get(x) as Customer};
}
const events = () => screen.getByRole('region', {name: /Kommande event/});

test('upcoming events: date, title, new, place, why, source link, no offer yet and a conflict with a booking', async () => {
  await show('k1');
  const list = within(events());
  expect(list.getByText('Höstmässan')).toBeTruthy();
  expect(list.getByText('Ny')).toBeTruthy();
  expect(list.getByText('Exempelhallen')).toBeTruthy();
  expect(list.getByText('De ställer ut')).toBeTruthy();
  expect(list.getByRole('link', {name: /massan\.example/}).getAttribute('href')).toBe('https://massan.example/2026');
  expect(list.getByText('Inget erbjudande skickat')).toBeTruthy();
  expect(list.getByText(/Krockar med/).parentElement!.textContent).toMatch(/10:00 .*Porträtt hos Annan/);
  expect(list.getByText('Julfesten').closest('details')).not.toBeNull(); // only among the hidden events
});

test('without a mail extension an offer is logged without text, after a question', async () => {
  const {doc} = await show('k1');
  fireEvent.click(within(events()).getByRole('button', {name: 'Logga erbjudande skickat'}));
  expect(screen.getByRole('dialog').textContent).toMatch('Erbjudande inför Höstmässan: logga som skickat?');
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', {name: 'Logga'}));
  await settle();
  expect(doc().events!.find(e => e.id === 'e1')!.offeredAt).toBe(TODAY);
  expect(doc().comms!.map(m => m.subject)).toEqual(['Erbjudande inför Höstmässan']);
  expect(within(events()).getByText(/Erbjudande skickat/)).toBeTruthy();
});

test('with a mail extension the offer dialog has its text, can be edited and is logged as sent', async () => {
  const {doc} = await show('k1', {mail: MAIL});
  fireEvent.click(within(events()).getByRole('button', {name: '✉ Erbjud tjänster'}));
  const dialog = within(screen.getByRole('dialog'));
  expect(dialog.getByText('Foto')).toBeTruthy();
  expect((dialog.getByLabelText('Till') as HTMLInputElement).value).toBe('anna@exempel.se');
  fireEvent.change(dialog.getByLabelText('Ämne'), {target: {value: 'Inför mässan'}});
  expect(dialog.getByRole('link', {name: 'Öppna i mailprogram'}).getAttribute('href')).toBe('mailto:anna@exempel.se?subject=Inf%C3%B6r%20m%C3%A4ssan&body=Vi%20kan%20fota.');
  fireEvent.click(dialog.getByRole('button', {name: 'Jag har skickat det'}));
  await settle();
  const m = doc().comms![0];
  expect([m.subject, m.body, m.note, m.kind]).toEqual(['Inför mässan', 'Vi kan fota.', 'Erbjudande skickat', 'mail_ut']);
  expect(doc().events!.find(e => e.id === 'e1')!.offeredAt).toBe(TODAY);
  expect(screen.queryByRole('dialog')).toBeNull();
});

test('the offer can be saved as a draft for later', async () => {
  const {doc} = await show('k1', {mail: MAIL});
  fireEvent.click(within(events()).getByRole('button', {name: '✉ Erbjud tjänster'}));
  fireEvent.click(screen.getByRole('button', {name: 'Spara som utkast'}));
  await settle();
  expect(doc().draft).toEqual({subject: 'Inför Höstmässan', body: 'Vi kan fota.', summary: 'Erbjudande skickat', eventId: 'e1', kind: 'offer'});
  expect(doc().comms).toEqual([]);
});

test('a mail extension that throws: a message, and the offer can still be logged without text', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  await show('k1', {mail: {...MAIL, buildOffer: () => { throw new Error('trasig'); }}});
  fireEvent.click(within(events()).getByRole('button', {name: '✉ Erbjud tjänster'}));
  expect(screen.getByText(/Mailtillägget gav ett fel: trasig/)).toBeTruthy();
  expect(screen.getByRole('dialog').textContent).toMatch('logga som skickat?');
});

test('hide an event and show it again', async () => {
  const {doc} = await show('k1');
  fireEvent.click(within(events()).getByRole('button', {name: 'Dölj Höstmässan'}));
  await settle();
  expect(doc().events!.find(e => e.id === 'e1')!.dismissed).toBe(true);
  fireEvent.click(screen.getByText('Dolda event (2)'));
  fireEvent.click(screen.getByRole('button', {name: 'Visa Julfesten igen'}));
  await settle();
  expect(doc().events!.find(e => e.id === 'e2')!.dismissed).toBe(false);
});

test('an ended event can be followed up (logged without text) or skipped', async () => {
  const {doc} = await show('k1');
  const done = within(screen.getByRole('list', {name: 'Avslutade event att följa upp'}));
  expect(done.getByText('Sommarkonferensen')).toBeTruthy();
  fireEvent.click(done.getByRole('button', {name: 'Logga uppföljning skickad'}));
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', {name: 'Logga'}));
  await settle();
  expect(doc().events!.find(e => e.id === 'e3')!.followUpSentAt).toBe(TODAY);
  expect(screen.queryByRole('list', {name: 'Avslutade event att följa upp'})).toBeNull();
});

test('an event can be added by hand', async () => {
  const {doc} = await show('k1');
  fireEvent.change(screen.getByLabelText('Event'), {target: {value: 'Vårgalan'}});
  fireEvent.change(screen.getByLabelText('Eventdatum'), {target: {value: '2027-03-01'}});
  fireEvent.click(screen.getByRole('button', {name: 'Lägg till event'}));
  await settle();
  expect(doc().events!.at(-1)).toMatchObject({title: 'Vårgalan', date: '2027-03-01', source: 'manuell', dismissed: false});
});

test('read-only: the events are shown without buttons or form', async () => {
  await show('k1', {canWrite: false});
  expect(within(events()).getByText('Höstmässan')).toBeTruthy();
  expect(within(events()).queryByRole('button')).toBeNull();
  expect(screen.queryByLabelText('Event')).toBeNull();
});

test("a potential customer's mail draft: copy, open in the mail program, discard or mark as sent", async () => {
  const {doc} = await show('p1');
  const draft = within(screen.getByRole('region', {name: 'Utkast till mail'}));
  expect(draft.getByText('Hej från oss')).toBeTruthy();
  expect(draft.getByRole('link', {name: 'Öppna i mailprogram'}).getAttribute('href')).toMatch('mailto:p@exempel.se?subject=Hej');
  fireEvent.click(draft.getByRole('button', {name: 'Jag har skickat det'}));
  await settle();
  expect(doc().draft).toBeNull();
  expect(doc().comms![0]).toMatchObject({subject: 'Hej från oss', body: 'Vi gör bilder.', note: 'Första mailet'});
  expect(screen.queryByRole('region', {name: 'Utkast till mail'})).toBeNull();
});

test('a draft can be discarded', async () => {
  const {doc} = await show('p1');
  fireEvent.click(screen.getByRole('button', {name: 'Släng utkast'}));
  await settle();
  expect(doc().draft).toBeNull();
  expect(doc().comms || []).toEqual([]);
});
