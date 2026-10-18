import {act, fireEvent, render, screen, within} from '@testing-library/react';
import {fakeClaude} from '../../../test/fakeDb';
import {createArtifactStore} from '../../data/artifactStore';
import {StoreProvider, useCustomer} from '../../data/StoreContext';
import {ToastProvider} from '../Toast';
import Bookings from './Bookings';

const TODAY = '2026-10-15';
const daysAgo = (n: number) => { const d = new Date(TODAY + 'T12:00:00'); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
// Made-up customer and bookings
const CUSTOMER = {company: 'Exempel AB', status: 'kund',
  bookings: [
    {id: 'b1', kind: 'mote', title: 'Kaffe', date: daysAgo(-5), time: '14:00', location: 'Kontoret', source: 'app', gcalEventId: 'g1'},
    {id: 'b2', kind: 'jobb', title: 'Porträtt', date: daysAgo(-19), source: 'app'},
    {id: 'b3', kind: 'samtal', title: 'Avstämning', date: daysAgo(-2), time: '10:00', source: 'gcal', gcalEventId: 'g3'},
    {id: 'b4', kind: 'mote', title: 'Förra mötet', date: daysAgo(20), time: '09:00', source: 'app'}
  ],
  followUp: {date: daysAgo(-12), note: 'Fråga om julfoto'}};

beforeEach(() => window.CRMLogic.setClock(() => new Date(TODAY + 'T12:00:00')));
afterEach(() => window.CRMLogic.setClock(null));
const settle = () => act(() => new Promise(r => setTimeout(r, 0)));

async function show(customer: object = CUSTOMER, canWrite = true) {
  const fake = fakeClaude({customers: {c1: customer}, canWrite});
  const store = await createArtifactStore(fake.claude);
  function Card() {
    const c = useCustomer('c1');
    return c ? <Bookings c={c} /> : null;
  }
  render(<ToastProvider><StoreProvider store={store}><Card /></StoreProvider></ToastProvider>);
  await settle();
  return {...fake, store: store!};
}
const doc = (fake: ReturnType<typeof fakeClaude>) => fake.collections.get('customers')!.get('c1') as Customer;

test('upcoming bookings in date order, with time or "heldag", kind, title, place and calendar status', async () => {
  await show();
  const list = screen.getByRole('list', {name: 'Bokningar'});
  const items = within(list).getAllByRole('listitem');
  expect(items.map(li => li.textContent)).toEqual([
    expect.stringMatching(/10:00.*Samtal.*Avstämning.*Från Google Kalender/),
    expect.stringMatching(/14:00.*Möte.*Kaffe.*Kontoret.*I kalendern/),
    expect.stringMatching(/heldag.*Jobb.*Porträtt.*Läggs i kalendern vid nästa synk/)
  ]);
});

test('earlier bookings are folded away', async () => {
  await show();
  const past = screen.getByText('Tidigare bokningar (1)').closest('details')!;
  expect(past.textContent).toMatch('Förra mötet');
});

test('booking writes a new booking from the app (synced to the calendar later) and shows a message', async () => {
  const fake = await show();
  fireEvent.change(screen.getByRole('combobox', {name: 'Typ'}), {target: {value: 'jobb'}});
  fireEvent.change(screen.getByLabelText('Bokningsdatum'), {target: {value: daysAgo(-30)}});
  fireEvent.change(screen.getByRole('textbox', {name: 'Rubrik'}), {target: {value: 'Eventfoto'}});
  fireEvent.click(screen.getByRole('button', {name: 'Boka'}));
  await settle();
  expect(doc(fake).bookings!.find(b => b.title === 'Eventfoto')).toMatchObject({kind: 'jobb', date: daysAgo(-30), source: 'app'});
  expect(screen.getByRole('status').textContent).toBe('Bokat – läggs i kalendern vid nästa synk');
});

test('removing a booking needs a second click', async () => {
  const fake = await show();
  const remove = () => within(screen.getByRole('list', {name: 'Bokningar'})).getAllByRole('button', {name: /Ta bort/})[0];
  fireEvent.click(remove());
  fireEvent.click(remove());
  await settle();
  expect(doc(fake).bookings!.map(b => b.id)).toEqual(['b1', 'b2', 'b4']);
});

test('the follow-up reminder: shown, saved and removed', async () => {
  const fake = await show();
  expect((screen.getByLabelText('Uppföljningsdatum') as HTMLInputElement).value).toBe(daysAgo(-12));
  fireEvent.change(screen.getByRole('textbox', {name: 'Anteckning om uppföljning'}), {target: {value: 'Skicka offert'}});
  fireEvent.click(screen.getByRole('button', {name: 'Spara'}));
  await settle();
  expect(doc(fake).followUp).toEqual({date: daysAgo(-12), note: 'Skicka offert'});
  fireEvent.click(screen.getByRole('button', {name: 'Ta bort påminnelsen'}));
  await settle();
  expect(doc(fake).followUp).toBeNull();
});

test('a follow-up without a date asks for one and writes nothing', async () => {
  const fake = await show({company: 'Exempel AB', status: 'kund'});
  fireEvent.click(screen.getByRole('button', {name: 'Spara'}));
  await settle();
  expect(screen.getByRole('status').textContent).toBe('Välj ett datum för uppföljningen');
  expect(doc(fake).followUp).toBeUndefined();
});

test('nothing booked says so; read-only has no forms', async () => {
  await show({company: 'Exempel AB', status: 'kund'}, false);
  expect(screen.getByText('Inget bokat framåt.')).toBeTruthy();
  expect(screen.queryByRole('button', {name: 'Boka'})).toBeNull();
  expect(screen.queryByRole('button', {name: 'Spara'})).toBeNull();
});

test('the follow-up fields follow the database when it changes elsewhere (an agent, another tab)', async () => {
  const fake = await show();
  await act(() => fake.store.updateCustomer('c1', {followUp: {date: daysAgo(-40), note: 'Ändrad av agenten'}}));
  expect((screen.getByRole('textbox', {name: 'Anteckning om uppföljning'}) as HTMLInputElement).value).toBe('Ändrad av agenten');
  expect((screen.getByLabelText('Uppföljningsdatum') as HTMLInputElement).value).toBe(daysAgo(-40));
});

test('a booking without an id is shown but cannot be removed (so other bookings are never removed with it)', async () => {
  await show({company: 'Exempel AB', status: 'kund', bookings: [{kind: 'mote', title: 'Utan id', date: daysAgo(-3)}, {id: 'b9', kind: 'mote', title: 'Med id', date: daysAgo(-4)}]});
  const items = within(screen.getByRole('list', {name: 'Bokningar'})).getAllByRole('listitem');
  expect(items[0].textContent).toMatch('Utan id');
  expect(within(items[0]).queryByRole('button')).toBeNull();
  expect(within(items[1]).getByRole('button', {name: 'Ta bort'})).toBeTruthy();
});

test('a failed booking shows a readable error and keeps what was typed', async () => {
  const fake = await show();
  fake.failing.write = {code: 'quota_exceeded'};
  fireEvent.change(screen.getByLabelText('Bokningsdatum'), {target: {value: daysAgo(-30)}});
  fireEvent.change(screen.getByRole('textbox', {name: 'Rubrik'}), {target: {value: 'Eventfoto'}});
  fireEvent.click(screen.getByRole('button', {name: 'Boka'}));
  await settle();
  expect(screen.getByRole('status').textContent).toMatch('fullt');
  expect((screen.getByRole('textbox', {name: 'Rubrik'}) as HTMLInputElement).value).toBe('Eventfoto');
});

test('read-only shows the follow-up reminder as text; a reminder without a date counts as none', async () => {
  await show(undefined, false);
  expect(screen.getByText(/Påminn mig att följa upp: .*Fråga om julfoto/)).toBeTruthy();
});

test('a reminder without a date gives no remove button and an empty date field', async () => {
  await show({company: 'Exempel AB', status: 'kund', followUp: {note: 'Bara en anteckning'}});
  expect(screen.queryByRole('button', {name: 'Ta bort påminnelsen'})).toBeNull();
  expect((screen.getByLabelText('Uppföljningsdatum') as HTMLInputElement).value).toBe('');
});
