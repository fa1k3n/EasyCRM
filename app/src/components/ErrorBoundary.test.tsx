import {render, screen} from '@testing-library/react';
import ErrorBoundary from './ErrorBoundary';

function Broken(): never { throw new Error('boom'); }

test('an error in a part of the page shows a message instead of an empty page', () => {
  const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
  render(<ErrorBoundary><Broken /></ErrorBoundary>);
  expect(screen.getByRole('alert').textContent).toMatch('Något gick fel');
  spy.mockRestore();
});

test('without errors the children are shown', () => {
  render(<ErrorBoundary><p>innehåll</p></ErrorBoundary>);
  expect(screen.getByText('innehåll')).toBeTruthy();
});
