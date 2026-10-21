import {act, fireEvent, render, screen, within} from '@testing-library/react';
import {fakeClaude} from '../../../test/fakeDb';
import {createArtifactStore} from '../../data/artifactStore';
import {StoreProvider} from '../../data/StoreContext';
import {ViewProvider} from '../../view';
import CustomerList from './CustomerList';
import Stats from './Stats';
import Toolbar from './Toolbar';

// The quick filters that replace the tabs, and the status "kontaktad" in the list. "Today" is fixed; all
// customers are made up.
const TODAY = '2026-10-15';
const CUSTOMERS = {
  k1: {company: 'Exempel Kund Röd', status: 'kund', comms: [{id: 'm1', kind: 'samtal', date: '2026-01-01'}]},
  k2: {company: 'Exempel Kund Bokad', status: 'kund', comms: [{id: 'm2', kind: 'samtal', date: '2026-10-01'}], bookings: [{id: 'b1', kind: 'mote', date: '2026-10-20'}]},
  c1: {company: 'Exempel Kontaktad', status: 'kontaktad', comms: [{id: 'm3', kind: 'mote', date: '2026-10-01'}]},
  c2: {company: 'Exempel Kontaktad Röd', status: 'kontaktad', comms: [{id: 'm4', kind: 'mote', date: '2026-01-01'}]},
  p1: {company: 'Exempel Prospekt', status: 'potentiell'}
};

beforeEach(() => { window.CRMLogic.setClock(() => new Date(TODAY + 'T12:00:00')); localStorage.clear(); });
afterEach(() => window.CRMLogic.setClock(null));

async function show() {
  const store = await createArtifactStore(fakeClaude({customers: CUSTOMERS}).claude);
  render(<StoreProvider store={store}><ViewProvider><Stats /><Toolbar /><CustomerList selected={null} onSelect={() => {}} /></ViewProvider></StoreProvider>);
  await act(() => new Promise(r => setTimeout(r, 0)));
}
const rows = () => screen.getAllByRole('button').filter(b => b.dataset.id).map(b => b.dataset.id).sort();
const flags = () => screen.getByRole('group', {name: 'Filter'});
const statuses = () => screen.getByRole('group', {name: 'Status'});
const chip = (group: HTMLElement, name: RegExp) => within(group).getByRole('button', {name});

test('the tabs are gone: the quick filters are toggles in two groups, in the agreed order, with counts', async () => {
  await show();
  expect(screen.queryByRole('button', {name: /^Alla\s*\d/})).toBeNull();
  expect(within(flags()).getAllByRole('button').map(b => b.textContent)).toEqual(['Att kontakta3', 'Bokat1']);
  expect(within(statuses()).getAllByRole('button').map(b => b.textContent)).toEqual(['Kunder2', 'Potentiella kunder2', 'Prospekt1']);
  expect(rows()).toEqual(['c1', 'c2', 'k1', 'k2', 'p1']);
});

test('a status filter shows only that status; a second one adds to it; a click again removes it', async () => {
  await show();
  fireEvent.click(chip(statuses(), /^Potentiella kunder/));
  expect(chip(statuses(), /^Potentiella kunder/).getAttribute('aria-pressed')).toBe('true');
  expect(rows()).toEqual(['c1', 'c2']);
  fireEvent.click(chip(statuses(), /^Prospekt/));
  expect(rows()).toEqual(['c1', 'c2', 'p1']);
  fireEvent.click(chip(statuses(), /^Potentiella kunder/));
  expect(rows()).toEqual(['p1']);
});

test('a status and a flag together: both must hold; Rensa shows everybody again', async () => {
  await show();
  expect(screen.queryByRole('button', {name: 'Rensa'})).toBeNull();
  fireEvent.click(chip(statuses(), /^Potentiella kunder/));
  fireEvent.click(chip(statuses(), /^Prospekt/));
  fireEvent.click(chip(flags(), /^Att kontakta/));
  expect(rows()).toEqual(['c2', 'p1']);
  fireEvent.click(screen.getByRole('button', {name: 'Rensa'}));
  expect(rows()).toEqual(['c1', 'c2', 'k1', 'k2', 'p1']);
});

test('the header counts: to contact, customers, potential customers and prospects; a click shows only that filter', async () => {
  await show();
  for (const name of ['3 att kontakta', '2 kunder', '2 potentiella kunder', '1 prospekt']) expect(screen.getByRole('button', {name})).toBeTruthy();
  fireEvent.click(chip(flags(), /^Bokat/));
  fireEvent.click(screen.getByRole('button', {name: '2 potentiella kunder'}));
  expect(rows()).toEqual(['c1', 'c2']);
  expect(chip(flags(), /^Bokat/).getAttribute('aria-pressed')).toBe('false');
  fireEvent.click(screen.getByRole('button', {name: '2 potentiella kunder'}));
  expect(rows()).toEqual(['c1', 'c2', 'k1', 'k2', 'p1']);
});

test('the row of a kontaktad has the badge "Potentiell kund", a prospect "Prospekt"', async () => {
  await show();
  const row = (id: string) => screen.getAllByRole('button').find(b => b.dataset.id === id)!;
  expect(row('c1').textContent).toMatch('Potentiell kund');
  expect(row('p1').textContent).toMatch('Prospekt');
  expect(row('k1').textContent).not.toMatch(/Potentiell|Prospekt/);
});

test('a tab saved by the old version is read as the matching quick filter', async () => {
  localStorage.setItem('crm-view', JSON.stringify({seg: 'potentiella', type: 'alla', sort: 'kontakt'}));
  await show();
  expect(chip(statuses(), /^Prospekt/).getAttribute('aria-pressed')).toBe('true');
  expect(rows()).toEqual(['p1']);
});

test('the quick filters are remembered in the browser', async () => {
  await show();
  fireEvent.click(chip(flags(), /^Att kontakta/));
  expect(JSON.parse(localStorage.getItem('crm-view')!)).toMatchObject({status: [], flags: ['kontakta']});
});
