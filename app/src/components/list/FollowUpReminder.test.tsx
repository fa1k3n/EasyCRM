import {act, render, screen} from '@testing-library/react';
import {fakeClaude} from '../../../test/fakeDb';
import {createArtifactStore} from '../../data/artifactStore';
import {StoreProvider} from '../../data/StoreContext';
import {ViewProvider} from '../../view';
import CustomerList from './CustomerList';
import Stats from './Stats';

// The reminder to get in touch in the list. "Today" is fixed; all customers are made up.
const TODAY = '2026-10-15';
const CUSTOMERS = {
  c1: {company: 'Exempel Due', status: 'kund', comms: [{id: 'm1', kind: 'mote', date: '2026-08-15'}], followUp: {date: '2026-10-15', note: 'Höras om två månader'}},
  c2: {company: 'Exempel Later', status: 'kund', comms: [{id: 'm2', kind: 'mote', date: '2026-10-01'}], followUp: {date: '2026-12-01'}},
  c3: {company: 'Exempel Green', status: 'kund', comms: [{id: 'm3', kind: 'samtal', date: '2026-10-10'}]}
};

beforeEach(() => { window.CRMLogic.setClock(() => new Date(TODAY + 'T12:00:00')); localStorage.clear(); });
afterEach(() => window.CRMLogic.setClock(null));

async function show() {
  const store = await createArtifactStore(fakeClaude({customers: CUSTOMERS}).claude);
  render(<StoreProvider store={store}><ViewProvider><Stats /><CustomerList selected={null} onSelect={() => {}} /></ViewProvider></StoreProvider>);
  await act(() => new Promise(r => setTimeout(r, 0)));
}
const row = (id: string) => screen.getAllByRole('button').find(b => b.dataset.id === id)!;

test('a due reminder gives the row the badge "Följ upp" with the note as its title', async () => {
  await show();
  const badge = row('c1').querySelector('[title="Höras om två månader"]');
  expect(badge?.textContent).toBe('Följ upp');
  expect(row('c2').textContent).not.toMatch('Följ upp');
  expect(row('c3').textContent).not.toMatch('Följ upp');
});

test('the count "Att kontakta" includes the due reminder', async () => {
  await show();
  expect(screen.getByRole('button', {name: '1 att kontakta'})).toBeTruthy();
});

test('the lamp on the logo lights for a due reminder alone', async () => {
  const {default: App} = await import('../../App');
  const {applyBrand} = await import('../../brand');
  const due = {c1: {company: 'Exempel Due', status: 'kund', comms: [{id: 'm1', kind: 'samtal', date: '2026-10-10'}], followUp: {date: '2026-10-12'}}};
  const {container} = render(<App brand={applyBrand()} store={await createArtifactStore(fakeClaude({customers: due}).claude)} />);
  await act(() => new Promise(r => setTimeout(r, 0)));
  expect(container.querySelector('[data-lamp]')).not.toBeNull();
});
