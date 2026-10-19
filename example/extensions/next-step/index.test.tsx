/* Tests for the example extension "Next step". An extension is tested like any React component: render its section
 * with a made-up customer and a fake save, and call its badge with made-up customers. */
import {act, fireEvent, render, screen} from '@testing-library/react';
import manifest, {NextStep} from './index';

const customer = Object.freeze({id: 'c1', company: 'Example Company Ltd'});

test('the manifest is for API version 1, with one section and one badge', () => {
  expect(manifest).toMatchObject({id: 'next-step', apiVersion: 1});
  expect(manifest.customerSections).toHaveLength(1);
  expect(manifest.listBadges).toHaveLength(1);
});

test('the section shows the saved next step and saves a new one as JSON in its own field', async () => {
  const saved: unknown[] = [];
  render(<NextStep customer={customer} data={{text: 'Call about the quote', date: '2026-11-02'}} canWrite save={async d => { saved.push(d); }} />);
  expect((screen.getByLabelText('Next step') as HTMLInputElement).value).toBe('Call about the quote');
  fireEvent.change(screen.getByLabelText('Next step'), {target: {value: 'Send the price proposal'}});
  fireEvent.change(screen.getByLabelText('By'), {target: {value: '2026-11-05'}});
  await act(async () => { fireEvent.click(screen.getByRole('button', {name: 'Save'})); });
  expect(saved).toEqual([{text: 'Send the price proposal', date: '2026-11-05'}]);
  expect(screen.getByText('Saved')).toBeTruthy();
});

test('a failed save is shown in the section', async () => {
  render(<NextStep customer={customer} data={undefined} canWrite save={async () => { throw new Error('no'); }} />);
  fireEvent.change(screen.getByLabelText('Next step'), {target: {value: 'X'}});
  await act(async () => { fireEvent.click(screen.getByRole('button', {name: 'Save'})); });
  expect(screen.getByRole('alert').textContent).toMatch('Could not save');
});

test('read-only: the next step is shown as text, without a form', () => {
  render(<NextStep customer={customer} data={{text: 'Call', date: ''}} canWrite={false} save={async () => {}} />);
  expect(screen.getByText('Call')).toBeTruthy();
  expect(screen.queryByRole('button')).toBeNull();
});

test('the badge shows when there is a next step, and says when it is due', () => {
  const badge = manifest.listBadges![0];
  expect(badge({...customer})).toBeNull();
  expect(badge({...customer, ext: {'next-step': {text: 'Call', date: ''}}})).toEqual({text: 'Next step', title: 'Call'});
  expect(badge({...customer, ext: {'next-step': {text: 'Call', date: '2026-11-02'}}})).toEqual({text: 'Next step 2026-11-02', title: 'Call'});
});
