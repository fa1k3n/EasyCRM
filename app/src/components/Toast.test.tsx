import {act, render, screen} from '@testing-library/react';
import {ToastProvider, useToast} from './Toast';

function Trigger() {
  const toast = useToast();
  return <button onClick={() => toast('Sparat')}>spara</button>;
}

test('a message is shown as a status and disappears after a while', () => {
  jest.useFakeTimers();
  render(<ToastProvider><Trigger /></ToastProvider>);
  act(() => screen.getByText('spara').click());
  expect(screen.getByRole('status').textContent).toMatch('Sparat');
  act(() => { jest.advanceTimersByTime(3000); });
  expect(screen.getByRole('status').textContent).toBe('');
  jest.useRealTimers();
});

test('the status region is always there (empty without a message), so screen readers announce new messages', () => {
  render(<ToastProvider><p>x</p></ToastProvider>);
  expect(screen.getByRole('status').textContent).toBe('');
});
