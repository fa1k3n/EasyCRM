import {act, fireEvent, render, screen} from '@testing-library/react';
import {useState} from 'react';
import {fakeClaude} from '../../test/fakeDb';
import CustomerCard from '../components/card/CustomerCard';
import CustomerList from '../components/list/CustomerList';
import {ToastProvider} from '../components/Toast';
import {createArtifactStore} from '../data/artifactStore';
import {StoreProvider} from '../data/StoreContext';
import {ViewProvider} from '../view';
import type {CustomerSectionProps, ExtensionManifest} from './api';
import {ExtensionsProvider} from './ExtensionsContext';
import {loadExtensions} from './load';

// Made-up customers
const CUSTOMERS = {k1: {company: 'Exempel Kund AB', status: 'kund', notes: 'Hej', ext: {annat: {x: 1}}}};
const settle = () => act(() => new Promise(r => setTimeout(r, 0)));
const seen: {customer?: unknown} = {};

function Counter({customer, data, save}: CustomerSectionProps<{n: number}>) {
  seen.customer = customer;
  const [error, setError] = useState('');
  return (
    <div>
      <p>Räknare {data?.n ?? 0} för {customer.company}</p>
      <button onClick={() => save({n: (data?.n ?? 0) + 1}).catch(e => setError(String(e)))}>Öka</button>
      {error && <p>{error}</p>}
    </div>
  );
}
const counter: ExtensionManifest = {id: 'raknare', apiVersion: 1, name: 'Räknare',
  customerSections: [{id: 'r', title: 'Räknaren', Component: Counter}],
  listBadges: [c => (c.notes ? {text: 'Har anteckning'} : null)]};
const broken: ExtensionManifest = {id: 'trasig', apiVersion: 1, name: 'Trasig',
  customerSections: [{id: 't', title: 'Trasig sektion', Component: () => { throw new Error('boom'); }}],
  listBadges: [() => { throw new Error('boom'); }]};

async function show(manifests: unknown[], what: 'card' | 'list' = 'card') {
  const fake = fakeClaude({customers: CUSTOMERS});
  const store = await createArtifactStore(fake.claude);
  render(
    <ToastProvider><StoreProvider store={store}><ViewProvider><ExtensionsProvider loaded={loadExtensions(manifests)}>
      {what === 'card' ? <CustomerCard id="k1" onBack={() => {}} /> : <CustomerList selected={null} onSelect={() => {}} />}
    </ExtensionsProvider></ViewProvider></StoreProvider></ToastProvider>
  );
  await settle();
  return {doc: () => fake.collections.get('customers')!.get('k1') as Record<string, unknown>};
}

test('a section on the customer card gets the customer and saves only in customer.ext[its id]', async () => {
  const {doc} = await show([counter]);
  expect(screen.getByRole('heading', {name: 'Räknaren'})).toBeTruthy();
  expect(screen.getByText('Räknare 0 för Exempel Kund AB')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', {name: 'Öka'}));
  await settle();
  expect(screen.getByText('Räknare 1 för Exempel Kund AB')).toBeTruthy();
  const {updatedAt, ...rest} = doc();
  expect(rest).toEqual({company: 'Exempel Kund AB', status: 'kund', notes: 'Hej', ext: {annat: {x: 1}, raknare: {n: 1}}});
});

test('the customer an extension gets is read-only', async () => {
  await show([counter]);
  const c = seen.customer as Record<string, unknown>;
  expect(Object.isFrozen(c)).toBe(true);
  expect(Object.isFrozen(c.ext)).toBe(true);
  expect(() => { 'use strict'; (c as {company: string}).company = 'Annat'; }).toThrow();
});

test('save refuses data that is not JSON', async () => {
  let save: CustomerSectionProps['save'] | undefined;
  await show([{id: 'json', apiVersion: 1, name: 'J', customerSections: [{id: 'j', title: 'J', Component: (p: CustomerSectionProps) => { save = p.save; return null; }}]}]);
  await expect(save!({f: () => 1} as unknown as Record<string, unknown>)).rejects.toThrow();
});

test('a section that throws shows an error in its place, and the rest of the card still works', async () => {
  await show([broken, counter]);
  jest.spyOn(console, 'error').mockImplementation(() => {});
  expect(screen.getByRole('heading', {name: 'Räknaren'})).toBeTruthy();
  expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
  expect(screen.getByText('Exempel Kund AB', {selector: 'h2'})).toBeTruthy();
});

test('list badges show on the row; a badge that throws is left out', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  await show([broken, counter], 'list');
  expect(screen.getByText('Har anteckning')).toBeTruthy();
  expect(screen.getByText('Exempel Kund AB')).toBeTruthy();
});

test("a section's own state starts over when another customer is shown", async () => {
  function Typing() { const [v, setV] = useState(''); return <input aria-label="Fält" value={v} onChange={e => setV(e.target.value)} />; }
  const fake = fakeClaude({customers: {...CUSTOMERS, k2: {company: 'Exempel Två AB', status: 'kund'}}});
  const store = await createArtifactStore(fake.claude);
  const loaded = loadExtensions([{id: 'skriv', apiVersion: 1, name: 'S', customerSections: [{id: 's', title: 'Skriv', Component: Typing}]}]);
  const ui = (id: string) => <ToastProvider><StoreProvider store={store}><ExtensionsProvider loaded={loaded}><CustomerCard id={id} onBack={() => {}} /></ExtensionsProvider></StoreProvider></ToastProvider>;
  const {rerender} = render(ui('k1'));
  await settle();
  fireEvent.change(screen.getByLabelText('Fält'), {target: {value: 'halvskrivet'}});
  rerender(ui('k2'));
  await settle();
  expect((screen.getByLabelText('Fält') as HTMLInputElement).value).toBe('');
});
