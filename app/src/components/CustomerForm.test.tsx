import {act, fireEvent, render, screen, within} from '@testing-library/react';
import {fakeClaude} from '../../test/fakeDb';
import {createArtifactStore} from '../data/artifactStore';
import {StoreProvider} from '../data/StoreContext';
import CustomerForm from './CustomerForm';
import {ToastProvider} from './Toast';

const BRAND = {
  company: {name: 'Testbolaget AB'}, colors: {accent: '#0f766e', ink: '#1f2933', bg: '#f6f7f7'},
  senders: [{id: 's', company: 'Testbolaget AB', signature: ['X']}, {id: 'sport', company: 'Testsporten', signature: ['Y']}], defaultSender: 's',
  customerTypes: [{id: 'konsult', label: 'Konsultation', color: '#0f766e'}, {id: 'event', label: 'Event', color: '#6b4fb3', sender: 'sport'}]
};
beforeEach(() => window.CRMLogic.setBrand(BRAND as unknown as Brand));
afterEach(() => window.CRMLogic.setBrand(null));
const settle = () => act(() => new Promise(r => setTimeout(r, 0)));

async function show(customer?: object) {
  const fake = fakeClaude({customers: customer ? {c1: customer} : {}});
  const store = await createArtifactStore(fake.claude);
  const saved: string[] = [], closed: string[] = [];
  const doc = customer ? {...customer, id: 'c1'} as never : undefined;
  render(<ToastProvider><StoreProvider store={store}>
    <CustomerForm customer={doc} onSaved={id => saved.push(id)} onClose={() => closed.push('x')} />
  </StoreProvider></ToastProvider>);
  await settle();
  return {fake, saved, closed};
}
const field = (name: string) => screen.getByRole('textbox', {name});

test('a new customer: the first customer type is pre-chosen, and saving creates the customer and selects it', async () => {
  const {fake, saved, closed} = await show();
  expect(screen.getByRole('dialog', {name: 'Ny kund'})).toBeTruthy();
  expect((screen.getByRole('checkbox', {name: 'Konsultation'}) as HTMLInputElement).checked).toBe(true);
  fireEvent.change(field('Företag / organisation'), {target: {value: 'Exempel Ny AB'}});
  fireEvent.change(field('E-post'), {target: {value: 'ny@exempel.se'}});
  fireEvent.click(screen.getByRole('checkbox', {name: 'Event'}));
  fireEvent.click(screen.getByRole('button', {name: 'Lägg till'}));
  await settle();
  const [id] = saved;
  expect(fake.collections.get('customers')!.get(id)).toMatchObject({company: 'Exempel Ny AB', email: 'ny@exempel.se', status: 'kund', types: ['konsult', 'event'], comms: [], jobs: []});
  expect(closed).toEqual(['x']);
  expect(screen.getByRole('status').textContent).toBe('Kund tillagd');
});

test('a potential customer can be added; the sender hint for customer types is shown', async () => {
  const {fake, saved} = await show();
  expect(screen.getByText(/Event ger avsändaren Testsporten/)).toBeTruthy();
  fireEvent.click(within(screen.getByRole('group', {name: 'Status'})).getByRole('button', {name: 'Potentiell kund'}));
  fireEvent.change(field('Kontaktperson'), {target: {value: 'Anna Exempel'}});
  fireEvent.click(screen.getByRole('button', {name: 'Lägg till'}));
  await settle();
  expect(fake.collections.get('customers')!.get(saved[0])).toMatchObject({name: 'Anna Exempel', status: 'potentiell'});
  expect(screen.getByRole('status').textContent).toBe('Potentiell kund tillagd');
});

test('without company and contact person the form says so and writes nothing', async () => {
  const {fake, closed} = await show();
  fireEvent.click(screen.getByRole('button', {name: 'Lägg till'}));
  await settle();
  expect(screen.getByRole('alert').textContent).toBe('Fyll i företag eller kontaktperson.');
  expect(fake.collections.get('customers')!.size).toBe(0);
  expect(closed).toEqual([]);
});

test('editing fills in the customer, saves the changes and clears the example mark', async () => {
  const {fake} = await show({company: 'Exempel AB', name: 'Anna', status: 'kund', types: ['event'], notes: 'Gammal', example: true});
  expect(screen.getByRole('dialog', {name: 'Redigera kund'})).toBeTruthy();
  expect((field('Företag / organisation') as HTMLInputElement).value).toBe('Exempel AB');
  expect((screen.getByRole('checkbox', {name: 'Event'}) as HTMLInputElement).checked).toBe(true);
  fireEvent.change(field('Anteckningar'), {target: {value: 'Ny anteckning'}});
  fireEvent.click(screen.getByRole('button', {name: 'Spara'}));
  await settle();
  expect(fake.collections.get('customers')!.get('c1')).toMatchObject({company: 'Exempel AB', notes: 'Ny anteckning', example: false});
  expect(screen.getByRole('status').textContent).toBe('Sparat');
});

test('a failed save keeps the form open with a readable error', async () => {
  const {fake, closed} = await show({company: 'Exempel AB', status: 'kund'});
  fake.failing.write = {code: 'quota_exceeded'};
  fireEvent.click(screen.getByRole('button', {name: 'Spara'}));
  await settle();
  expect(screen.getByRole('alert').textContent).toMatch('fullt');
  expect(closed).toEqual([]);
});
