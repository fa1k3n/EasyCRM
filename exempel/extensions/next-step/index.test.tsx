/* Tests for the example extension "Nästa steg". An extension is tested like any React component: render its section
 * with a made-up customer and a fake save, and call its badge with made-up customers. */
import {act, fireEvent, render, screen} from '@testing-library/react';
import manifest, {NextStep} from './index';

const customer = Object.freeze({id: 'c1', company: 'Exempelbolaget AB'});

test('the manifest is for API version 1, with one section and one badge', () => {
  expect(manifest).toMatchObject({id: 'next-step', apiVersion: 1});
  expect(manifest.customerSections).toHaveLength(1);
  expect(manifest.listBadges).toHaveLength(1);
});

test('the section shows the saved next step and saves a new one as JSON in its own field', async () => {
  const saved: unknown[] = [];
  render(<NextStep customer={customer} data={{text: 'Ring om offerten', date: '2026-11-02'}} canWrite save={async d => { saved.push(d); }} />);
  expect((screen.getByLabelText('Nästa steg') as HTMLInputElement).value).toBe('Ring om offerten');
  fireEvent.change(screen.getByLabelText('Nästa steg'), {target: {value: 'Skicka prisförslag'}});
  fireEvent.change(screen.getByLabelText('Senast'), {target: {value: '2026-11-05'}});
  await act(async () => { fireEvent.click(screen.getByRole('button', {name: 'Spara'})); });
  expect(saved).toEqual([{text: 'Skicka prisförslag', date: '2026-11-05'}]);
  expect(screen.getByText('Sparat')).toBeTruthy();
});

test('a failed save is shown in the section', async () => {
  render(<NextStep customer={customer} data={undefined} canWrite save={async () => { throw new Error('nej'); }} />);
  fireEvent.change(screen.getByLabelText('Nästa steg'), {target: {value: 'X'}});
  await act(async () => { fireEvent.click(screen.getByRole('button', {name: 'Spara'})); });
  expect(screen.getByRole('alert').textContent).toMatch('Kunde inte spara');
});

test('read-only: the next step is shown as text, without a form', () => {
  render(<NextStep customer={customer} data={{text: 'Ring', date: ''}} canWrite={false} save={async () => {}} />);
  expect(screen.getByText('Ring')).toBeTruthy();
  expect(screen.queryByRole('button')).toBeNull();
});

test('the badge shows when there is a next step, and says when it is due', () => {
  const badge = manifest.listBadges![0];
  expect(badge({...customer})).toBeNull();
  expect(badge({...customer, ext: {'next-step': {text: 'Ring', date: ''}}})).toEqual({text: 'Nästa steg', title: 'Ring'});
  expect(badge({...customer, ext: {'next-step': {text: 'Ring', date: '2026-11-02'}}})).toEqual({text: 'Nästa steg 2026-11-02', title: 'Ring'});
});
