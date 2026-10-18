import {act, fireEvent, render, screen} from '@testing-library/react';
import {fakeClaude} from '../../../test/fakeDb';
import {createArtifactStore} from '../../data/artifactStore';
import {StoreProvider} from '../../data/StoreContext';
import {ToastProvider} from '../Toast';
import CustomerCard from './CustomerCard';

// Made-up customers
const CUSTOMERS = {
  k1: {company: 'Exempel Kund AB', name: 'Anna', status: 'kund', comms: [], jobs: []},
  p1: {company: 'Exempel Prospekt AB', status: 'potentiell', source: 'agent', website: 'https://www.prospekt.example'},
  p2: {company: 'Exempel Egen AB', status: 'potentiell'}
};
const settle = () => act(() => new Promise(r => setTimeout(r, 0)));

async function show(id: string, canWrite = true) {
  const fake = fakeClaude({customers: CUSTOMERS, canWrite});
  const store = await createArtifactStore(fake.claude);
  const back: string[] = [];
  render(<ToastProvider><StoreProvider store={store}><CustomerCard id={id} onBack={() => back.push('x')} /></StoreProvider></ToastProvider>);
  await settle();
  return {fake, back, doc: (x: string) => fake.collections.get('customers')!.get(x) as Customer | undefined};
}

test('"Gör till kund" asks first; Avbryt changes nothing; confirming changes only the status (#103)', async () => {
  const {doc} = await show('p2');
  fireEvent.click(screen.getByRole('button', {name: 'Gör till kund'}));
  fireEvent.click(screen.getByRole('button', {name: 'Avbryt'}));
  expect(doc('p2')!.status).toBe('potentiell');
  fireEvent.click(screen.getByRole('button', {name: 'Gör till kund'}));
  expect(screen.getByRole('dialog').textContent).toMatch('Gör Exempel Egen AB till kund?');
  fireEvent.click(screen.getByRole('button', {name: 'Ja, gör till kund'}));
  await settle();
  const {updatedAt, ...rest} = doc('p2')!;
  expect(rest).toEqual({company: 'Exempel Egen AB', status: 'kund'});
  expect(typeof updatedAt).toBe('string');
});

test('a customer can be moved back to potential, also with a question first (#103)', async () => {
  const {doc} = await show('k1');
  fireEvent.click(screen.getByRole('button', {name: 'Gör till potentiell kund'}));
  fireEvent.click(screen.getByRole('button', {name: 'Ja, gör till potentiell'}));
  await settle();
  expect(doc('k1')!.status).toBe('potentiell');
  expect(screen.getByRole('button', {name: 'Gör till kund'})).toBeTruthy();
});

test('removing asks first; a suggestion from an agent is remembered so it is not suggested again', async () => {
  const {fake, doc, back} = await show('p1');
  fireEvent.click(screen.getByRole('button', {name: 'Ta bort kunden'}));
  expect(screen.getByRole('dialog').textContent).toMatch('Agenten föreslår inte företaget igen');
  fireEvent.click(screen.getByRole('button', {name: 'Ta bort kund'}));
  await settle();
  expect(doc('p1')).toBeUndefined();
  expect(fake.collections.get('skipped')!.get('prospekt.example')).toMatchObject({company: 'Exempel Prospekt AB', website: 'https://www.prospekt.example'});
  expect(back).toEqual(['x']);
});

test('Redigera opens the form with the customer', async () => {
  await show('k1');
  fireEvent.click(screen.getByRole('button', {name: 'Redigera'}));
  expect(screen.getByRole('dialog', {name: 'Redigera kund'})).toBeTruthy();
});

test('read-only: no buttons that change the customer', async () => {
  await show('k1', false);
  for (const name of ['Redigera', 'Ta bort kunden', 'Gör till potentiell kund']) expect(screen.queryByRole('button', {name})).toBeNull();
});
