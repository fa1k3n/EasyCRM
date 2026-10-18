import {act, render, screen} from '@testing-library/react';
import {fakeClaude} from '../../test/fakeDb';
import {ToastProvider} from '../components/Toast';
import {createArtifactStore} from './artifactStore';
import type {Store} from './store';
import {StoreProvider, useCustomers, useWrite, writeErrorMessage} from './StoreContext';

const tick = () => act(() => new Promise(r => setTimeout(r, 0)));

function Status() {
  const {state, customers} = useCustomers();
  return <p>{state}:{customers.length}</p>;
}

test('useCustomers: unavailable without a store, loading until the first snapshot, then ready', async () => {
  const {rerender} = render(<StoreProvider store={null}><Status /></StoreProvider>);
  expect(screen.getByText('unavailable:0')).toBeTruthy();
  const store = await createArtifactStore(fakeClaude({customers: {a1: {company: 'Exempelbolaget AB'}}}).claude);
  rerender(<StoreProvider store={store}><Status /></StoreProvider>);
  expect(screen.getByText('loading:0')).toBeTruthy();
  await tick();
  expect(screen.getByText('ready:1')).toBeTruthy();
});

test('useCustomers: a lost connection gives the error state', async () => {
  const fake = fakeClaude();
  fake.failing.snapshot = true;
  render(<StoreProvider store={await createArtifactStore(fake.claude)}><Status /></StoreProvider>);
  await tick();
  expect(screen.getByText('error:0')).toBeTruthy();
});

function Saver({store}: {store: Store}) {
  const {run, pending} = useWrite();
  return <button disabled={pending} onClick={() => run(() => store.updateCustomer('a1', {notes: 'x'}), 'Sparat')}>spara</button>;
}

test('useWrite: the button is disabled while writing, success shows the message', async () => {
  const store = (await createArtifactStore(fakeClaude({customers: {a1: {}}}).claude))!;
  render(<ToastProvider><StoreProvider store={store}><Saver store={store} /></StoreProvider></ToastProvider>);
  const button = screen.getByText('spara') as HTMLButtonElement;
  act(() => button.click());
  expect(button.disabled).toBe(true);
  await tick();
  expect(button.disabled).toBe(false);
  expect(screen.getByRole('status').textContent).toBe('Sparat');
});

test('useWrite: a failed write shows a readable error and enables the button again', async () => {
  const fake = fakeClaude({customers: {a1: {}}});
  fake.failing.write = {code: 'quota_exceeded'};
  const store = (await createArtifactStore(fake.claude))!;
  render(<ToastProvider><StoreProvider store={store}><Saver store={store} /></StoreProvider></ToastProvider>);
  const button = screen.getByText('spara') as HTMLButtonElement;
  act(() => button.click());
  await tick();
  expect(screen.getByRole('status').textContent).toBe(writeErrorMessage({code: 'quota_exceeded'}));
  expect(button.disabled).toBe(false);
});

test('writeErrorMessage: known codes get their own text, everything else a general one', () => {
  expect(writeErrorMessage({code: 'quota_exceeded'})).toMatch('fullt');
  expect(writeErrorMessage({code: 'invalid_argument'})).toMatch('behörighet');
  expect(writeErrorMessage(new Error('x'))).toMatch('Kunde inte spara');
});

test('useCustomer gives one customer by id, or undefined', async () => {
  const {useCustomer} = require('./StoreContext') as typeof import('./StoreContext');
  function One({id}: {id: string}) { const c = useCustomer(id); return <p>{c ? c.company : 'ingen'}</p>; }
  const store = await createArtifactStore(fakeClaude({customers: {a1: {company: 'Exempelbolaget AB'}}}).claude);
  render(<StoreProvider store={store}><One id="a1" /><One id="saknas" /></StoreProvider>);
  await tick();
  expect(screen.getByText('Exempelbolaget AB')).toBeTruthy();
  expect(screen.getByText('ingen')).toBeTruthy();
});

test('useBusy gives the synced busy times, or null', async () => {
  const {useBusy} = require('./StoreContext') as typeof import('./StoreContext');
  function Busy() { const b = useBusy(); return <p>{b === null ? 'ej synkad' : `${b.length} upptagna`}</p>; }
  const synced = await createArtifactStore(fakeClaude({busy: {items: [{date: '2026-10-20', title: 'Upptagen'}]}}).claude);
  const {unmount} = render(<StoreProvider store={synced}><Busy /></StoreProvider>);
  await tick();
  expect(screen.getByText('1 upptagna')).toBeTruthy();
  unmount();
  render(<StoreProvider store={await createArtifactStore(fakeClaude().claude)}><Busy /></StoreProvider>);
  await tick();
  expect(screen.getByText('ej synkad')).toBeTruthy();
});

test('useStore gives the store for writes, or null', async () => {
  const {useStore} = require('./StoreContext') as typeof import('./StoreContext');
  function Writable() { const s = useStore(); return <p>{s ? `skrivbar:${s.canWrite}` : 'ingen'}</p>; }
  render(<StoreProvider store={await createArtifactStore(fakeClaude().claude)}><Writable /></StoreProvider>);
  expect(screen.getByText('skrivbar:true')).toBeTruthy();
});

test('the subscriptions stop when the app is removed', async () => {
  const fake = fakeClaude();
  const {unmount} = render(<StoreProvider store={await createArtifactStore(fake.claude)}><Status /></StoreProvider>);
  await tick();
  expect(fake.openListeners()).toBe(1);
  unmount();
  expect(fake.openListeners()).toBe(0);
});
