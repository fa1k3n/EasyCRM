import {act, fireEvent, render, screen, within} from '@testing-library/react';
import {fakeClaude} from '../../../test/fakeDb';
import {createArtifactStore} from '../../data/artifactStore';
import {StoreProvider} from '../../data/StoreContext';
import {ViewProvider} from '../../view';
import CustomerList from './CustomerList';
import Stats from './Stats';
import Toolbar from './Toolbar';

// "Today" is fixed so that the 60/90-day colours and the day counts are the same whenever the tests run
const TODAY = '2026-10-15';
const daysAgo = (n: number) => { const d = new Date(TODAY + 'T12:00:00'); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
const BRAND = {
  company: {name: 'Testbolaget AB'}, colors: {accent: '#0f766e', ink: '#1f2933', bg: '#f6f7f7'},
  senders: [{id: 's', signature: ['X']}], defaultSender: 's',
  customerTypes: [{id: 'konsult', label: 'Konsultation', color: '#0f766e'}, {id: 'event', label: 'Event', color: '#6b4fb3'}]
};
// All customers are made up
const CUSTOMERS = {
  c1: {company: 'Exempel Advokatbyrå', name: 'Anna Exempel', email: 'anna@exempel.se', status: 'kund', types: ['konsult'],
    comms: [{id: 'm1', kind: 'mail_ut', date: daysAgo(140), subject: 'Porträtt'}], createdAt: '2026-01-01'},
  c2: {company: 'Exempel Konsult', status: 'kund', types: ['konsult'], comms: [{id: 'm2', kind: 'samtal', date: daysAgo(10)}], createdAt: '2026-03-01',
    bookings: [{id: 'b1', kind: 'mote', date: daysAgo(-5), time: '14:00', title: 'Kaffe'}]},
  c3: {company: 'Exempel Fastigheter', status: 'potentiell', draft: {subject: 'Hej', body: 'Text'}, createdAt: '2026-10-10'},
  c4: {company: 'Exempel Simklubb', status: 'kund', types: ['event'], comms: [{id: 'm4', kind: 'mail_ut', date: daysAgo(70)}],
    events: [{id: 'e1', title: 'Distriktsmästerskap', date: daysAgo(-20)}], createdAt: '2026-02-01'}
};

beforeEach(() => {
  window.CRMLogic.setClock(() => new Date(TODAY + 'T12:00:00'));
  window.CRMLogic.setBrand(BRAND as unknown as Brand);
  localStorage.clear();
});
afterEach(() => { window.CRMLogic.setClock(null); window.CRMLogic.setBrand(null); });

async function show(onSelect = (_id: string) => {}, selected: string | null = null) {
  const store = await createArtifactStore(fakeClaude({customers: CUSTOMERS}).claude);
  const utils = render(
    <StoreProvider store={store}><ViewProvider>
      <Stats /><Toolbar /><CustomerList selected={selected} onSelect={onSelect} />
    </ViewProvider></StoreProvider>
  );
  await act(() => new Promise(r => setTimeout(r, 0)));
  return utils;
}
const rows = () => screen.getAllByRole('button', {name: /Exempel/}).filter(b => b.dataset.id).map(b => b.dataset.id);

test('the rows come sorted by longest since contact, with the never-contacted after the overdue', async () => {
  await show();
  expect(rows()).toEqual(['c1', 'c3', 'c4', 'c2']);
});

test('a row shows company, contact person, days since contact and the right badges', async () => {
  await show();
  const c1 = screen.getByRole('button', {name: /^Exempel Advokatbyrå/});
  expect(within(c1).getByText('Anna Exempel')).toBeTruthy();
  expect(within(c1).getByText('Kontakta')).toBeTruthy();
  expect(within(c1).getByText('140 d sedan')).toBeTruthy();
  expect(c1.textContent).toMatch('Porträtt');
  const c3 = screen.getByRole('button', {name: /^Exempel Fastigheter/});
  expect(within(c3).getByText('Utkast klart')).toBeTruthy();
  expect(within(c3).getByText('Ej kontaktad')).toBeTruthy();
  const c4 = screen.getByRole('button', {name: /^Exempel Simklubb/});
  expect(within(c4).getByText(/Att erbjuda/)).toBeTruthy();
  expect(c4.textContent).toMatch('Distriktsmästerskap');
  const c2 = screen.getByRole('button', {name: /^Exempel Konsult/});
  expect(c2.textContent).toMatch('Kaffe');
});

test('the stats count customers to contact, customers and potential ones; a click filters and a second click clears', async () => {
  await show();
  const toContact = screen.getByRole('button', {name: /2 att kontakta/});
  expect(screen.getByRole('button', {name: /3 kunder/})).toBeTruthy();
  const potential = screen.getByRole('button', {name: /1 prospekt/});
  fireEvent.click(potential);
  expect(rows()).toEqual(['c3']);
  fireEvent.click(potential);
  expect(rows()).toHaveLength(4);
  fireEvent.click(toContact);
  expect(rows()).toEqual(['c1', 'c3']);
});

test('the segments filter (e.g. Bokat) and show their counts', async () => {
  await show();
  const seg = screen.getByRole('group', {name: 'Filter'});
  fireEvent.click(within(seg).getByRole('button', {name: /Bokat/}));
  expect(rows()).toEqual(['c2']);
  expect(within(seg).getByRole('button', {name: /Bokat/}).getAttribute('aria-pressed')).toBe('true');
});

test('the search filters on name, company and e-mail', async () => {
  await show();
  const search = screen.getByRole('searchbox');
  fireEvent.change(search, {target: {value: 'anna@'}});
  expect(rows()).toEqual(['c1']);
  fireEvent.change(search, {target: {value: 'Anna Exempel'}});
  expect(rows()).toEqual(['c1']);
  fireEvent.change(search, {target: {value: 'simklubb'}});
  expect(rows()).toEqual(['c4']);
});

test('the colour stripe follows the contact status: red from 90 days, amber from 60 days or never contacted, nothing when recent', async () => {
  await show();
  const stripe = (id: string) => (document.querySelector(`[data-id="${id}"] > span`) as HTMLElement).className;
  expect(stripe('c1')).toMatch('bg-tally');
  expect(stripe('c4')).toMatch('bg-amber');
  expect(stripe('c3')).toMatch('bg-amber');
  expect(stripe('c2')).toMatch('bg-transparent');
});

test('the customer type filter and the sort by name', async () => {
  await show();
  fireEvent.click(within(screen.getByRole('group', {name: 'Kundtyp'})).getByRole('button', {name: 'Event'}));
  expect(rows()).toEqual(['c4']);
  fireEvent.click(within(screen.getByRole('group', {name: 'Kundtyp'})).getByRole('button', {name: 'Alla typer'}));
  fireEvent.change(screen.getByRole('combobox', {name: 'Sortering'}), {target: {value: 'namn'}});
  expect(rows()).toEqual(['c1', 'c3', 'c2', 'c4']);
});

test('no matches says so', async () => {
  await show();
  fireEvent.change(screen.getByRole('searchbox'), {target: {value: 'finns inte'}});
  expect(screen.getByText('Inga träffar')).toBeTruthy();
});

test('clicking a row selects the customer, and the selected row is marked', async () => {
  const picked: string[] = [];
  await show(id => picked.push(id), 'c2');
  fireEvent.click(screen.getByRole('button', {name: /^Exempel Simklubb/}));
  expect(picked).toEqual(['c4']);
  expect(screen.getByRole('button', {name: /^Exempel Konsult/}).getAttribute('aria-current')).toBe('true');
});

test('the chosen filter, type and sort are remembered (only the view, never customer data)', async () => {
  const {unmount} = await show();
  fireEvent.click(within(screen.getByRole('group', {name: 'Status'})).getByRole('button', {name: /Prospekt/}));
  fireEvent.change(screen.getByRole('combobox', {name: 'Sortering'}), {target: {value: 'namn'}});
  fireEvent.change(screen.getByRole('searchbox'), {target: {value: 'Fast'}});
  unmount();
  expect(JSON.parse(localStorage.getItem('crm-view')!)).toEqual({status: ['potentiell'], flags: [], type: 'alla', sort: 'namn'});
  await show();
  expect(rows()).toEqual(['c3']);
  expect((screen.getByRole('searchbox') as HTMLInputElement).value).toBe('');
});

test('a saved customer type that no longer exists shows all customers, and "Alla typer" is marked', async () => {
  localStorage.setItem('crm-view', JSON.stringify({seg: 'alla', type: 'finns-inte', sort: 'kontakt'}));
  await show();
  expect(rows()).toHaveLength(4);
  expect(within(screen.getByRole('group', {name: 'Kundtyp'})).getByRole('button', {name: 'Alla typer'}).getAttribute('aria-pressed')).toBe('true');
});
