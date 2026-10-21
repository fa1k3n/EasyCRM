import {act, fireEvent, render, screen} from '@testing-library/react';
import {fakeClaude} from '../../../test/fakeDb';
import {createArtifactStore} from '../../data/artifactStore';
import {StoreProvider} from '../../data/StoreContext';
import {ToastProvider} from '../Toast';
import CustomerForm from '../CustomerForm';
import CustomerCard from './CustomerCard';

// The three statuses on the card and in the form. All customers are made up.
const CUSTOMERS = {
  k1: {company: 'Exempel Kund AB', status: 'kund', comms: [], jobs: []},
  c1: {company: 'Exempel Kontaktad AB', status: 'kontaktad', comms: [], jobs: [{id: 'j1', title: 'Offert', date: '2026-10-01'}]},
  p1: {company: 'Exempel Prospekt AB', status: 'potentiell'}
};
const settle = () => act(() => new Promise(r => setTimeout(r, 0)));

async function card(id: string) {
  const fake = fakeClaude({customers: CUSTOMERS});
  const store = await createArtifactStore(fake.claude);
  render(<ToastProvider><StoreProvider store={store}><CustomerCard id={id} onBack={() => {}} /></StoreProvider></ToastProvider>);
  await settle();
  return (x: string) => (fake.collections.get('customers')!.get(x) as Customer).status;
}
async function change(id: string, button: string, ok: string, dialog: string) {
  const status = await card(id);
  fireEvent.click(screen.getByRole('button', {name: button}));
  expect(screen.getByRole('dialog').textContent).toMatch(dialog);
  fireEvent.click(screen.getByRole('button', {name: ok}));
  await settle();
  return status(id);
}

test('a prospect can become a potential customer or a customer', async () => {
  await card('p1');
  expect(screen.getByRole('button', {name: 'Gör till potentiell kund'})).toBeTruthy();
  expect(screen.getByRole('button', {name: 'Gör till kund'})).toBeTruthy();
  expect(screen.queryByRole('button', {name: 'Gör till prospekt'})).toBeNull();
});

test('prospect → potential customer, with a question first', async () => {
  expect(await change('p1', 'Gör till potentiell kund', 'Ja, gör till potentiell kund', 'Gör Exempel Prospekt AB till potentiell kund?')).toBe('kontaktad');
});

test('potential customer → customer, and potential customer → prospect', async () => {
  expect(await change('c1', 'Gör till kund', 'Ja, gör till kund', 'Gör Exempel Kontaktad AB till kund?')).toBe('kund');
});

test('potential customer → prospect', async () => {
  expect(await change('c1', 'Gör till prospekt', 'Ja, gör till prospekt', 'Gör Exempel Kontaktad AB till prospekt?')).toBe('potentiell');
});

test('customer → potential customer or prospect', async () => {
  await card('k1');
  expect(screen.getByRole('button', {name: 'Gör till potentiell kund'})).toBeTruthy();
  expect(screen.getByRole('button', {name: 'Gör till prospekt'})).toBeTruthy();
  expect(screen.queryByRole('button', {name: 'Gör till kund'})).toBeNull();
});

test('the card of a potential customer shows its badge and its jobs', async () => {
  await card('c1');
  expect(screen.getByText('Potentiell kund', {selector: 'span'})).toBeTruthy();
  expect(screen.getByText('Offert')).toBeTruthy();
});

test('the form offers three statuses and saves kontaktad', async () => {
  const fake = fakeClaude({customers: {}});
  const store = await createArtifactStore(fake.claude);
  const saved: string[] = [];
  render(<ToastProvider><StoreProvider store={store}><CustomerForm onSaved={id => saved.push(id)} onClose={() => {}} /></StoreProvider></ToastProvider>);
  await settle();
  const group = screen.getByRole('group', {name: 'Status'});
  expect([...group.querySelectorAll('button')].map(b => b.textContent)).toEqual(['Kund', 'Potentiell kund', 'Prospekt']);
  fireEvent.click(screen.getByRole('button', {name: 'Potentiell kund'}));
  fireEvent.change(screen.getByRole('textbox', {name: 'Företag / organisation'}), {target: {value: 'Exempel Ny AB'}});
  fireEvent.click(screen.getByRole('button', {name: 'Lägg till'}));
  await settle();
  expect((fake.collections.get('customers')!.get(saved[0]) as Customer).status).toBe('kontaktad');
});

test('editing a potential customer keeps the status kontaktad', async () => {
  const fake = fakeClaude({customers: {c1: CUSTOMERS.c1}});
  const store = await createArtifactStore(fake.claude);
  render(<ToastProvider><StoreProvider store={store}><CustomerForm customer={{...CUSTOMERS.c1, id: 'c1'} as never} onSaved={() => {}} onClose={() => {}} /></StoreProvider></ToastProvider>);
  await settle();
  expect(screen.getByRole('button', {name: 'Potentiell kund'}).getAttribute('aria-pressed')).toBe('true');
});
