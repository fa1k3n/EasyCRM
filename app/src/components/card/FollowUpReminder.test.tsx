import {act, fireEvent, render, screen} from '@testing-library/react';
import {fakeClaude} from '../../../test/fakeDb';
import {createArtifactStore} from '../../data/artifactStore';
import {StoreProvider, useCustomer} from '../../data/StoreContext';
import {ToastProvider} from '../Toast';
import Bookings from './Bookings';

// The reminder on the card: quick choices and a due reminder. "Today" is fixed; the customer is made up.
const TODAY = '2026-10-15';
const CUSTOMER = {company: 'Exempel AB', status: 'kund', comms: [{id: 'm1', kind: 'mote', date: '2026-08-15'}]};

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
  return fake;
}

test('the quick choices fill in the date 1, 2 or 3 months from today', async () => {
  await show();
  const date = screen.getByLabelText('Uppföljningsdatum') as HTMLInputElement;
  fireEvent.click(screen.getByRole('button', {name: 'Om 2 mån'}));
  expect(date.value).toBe('2026-12-15');
  fireEvent.click(screen.getByRole('button', {name: 'Om 1 mån'}));
  expect(date.value).toBe('2026-11-15');
  fireEvent.click(screen.getByRole('button', {name: 'Om 3 mån'}));
  expect(date.value).toBe('2027-01-15');
});

test('a quick choice and save writes the reminder', async () => {
  const fake = await show();
  fireEvent.click(screen.getByRole('button', {name: 'Om 2 mån'}));
  fireEvent.click(screen.getByRole('button', {name: 'Spara'}));
  await settle();
  expect((fake.collections.get('customers')!.get('c1') as Customer).followUp).toEqual({date: '2026-12-15', note: ''});
});

test('a due reminder is shown highlighted with its note', async () => {
  await show({...CUSTOMER, followUp: {date: '2026-10-10', note: 'Höras efter mötet'}});
  const due = screen.getByRole('status', {name: 'Dags att följa upp'});
  expect(due.textContent).toMatch('Höras efter mötet');
});

test('a reminder ahead in time is not highlighted', async () => {
  await show({...CUSTOMER, followUp: {date: '2026-11-10', note: 'Senare'}});
  expect(screen.queryByRole('status', {name: 'Dags att följa upp'})).toBeNull();
});

test('the quick choices are not shown without write access', async () => {
  await show(CUSTOMER, false);
  expect(screen.queryByRole('button', {name: 'Om 1 mån'})).toBeNull();
});
