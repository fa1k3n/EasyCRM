import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import {useState} from 'react';
import Dialog, {ConfirmDialog} from './Dialog';

function Opener() {
  const [open, setOpen] = useState(false);
  return <>
    <button onClick={() => setOpen(true)}>öppna</button>
    {open && <Dialog title="Rubrik" onClose={() => setOpen(false)}><input aria-label="Fält" /></Dialog>}
  </>;
}

test('a dialog is a labelled modal, the focus moves into it, Escape closes it and the focus returns', () => {
  render(<Opener />);
  const opener = screen.getByText('öppna');
  opener.focus();
  fireEvent.click(opener);
  const dialog = screen.getByRole('dialog', {name: 'Rubrik'});
  expect(dialog.getAttribute('aria-modal')).toBe('true');
  expect(document.activeElement).toBe(screen.getByRole('textbox', {name: 'Fält'}));
  fireEvent.keyDown(document.activeElement!, {key: 'Escape'});
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(document.activeElement).toBe(opener);
});

test('a click outside the dialog closes it, a click inside does not', () => {
  render(<Opener />);
  fireEvent.click(screen.getByText('öppna'));
  fireEvent.click(screen.getByRole('textbox', {name: 'Fält'}));
  expect(screen.getByRole('dialog')).toBeTruthy();
  fireEvent.click(screen.getByTestId('dialog-overlay'));
  expect(screen.queryByRole('dialog')).toBeNull();
});

test('ConfirmDialog: Avbryt does nothing; confirming runs the action and closes; an error stays visible in the dialog', async () => {
  const done: string[] = [];
  const {rerender} = render(<ConfirmDialog text="Ta bort?" okLabel="Ta bort" onConfirm={async () => { done.push('x'); }} onClose={() => done.push('closed')} />);
  fireEvent.click(screen.getByRole('button', {name: 'Avbryt'}));
  expect(done).toEqual(['closed']);
  done.length = 0;
  rerender(<ConfirmDialog text="Ta bort?" okLabel="Ta bort" onConfirm={async () => { done.push('x'); }} onClose={() => done.push('closed')} />);
  fireEvent.click(screen.getByRole('button', {name: 'Ta bort'}));
  await screen.findByRole('dialog');
  await new Promise(r => setTimeout(r, 0));
  expect(done).toEqual(['x', 'closed']);
  cleanup();
  render(<ConfirmDialog text="Ta bort?" okLabel="Ta bort" onConfirm={async () => { throw Object.assign(new Error('x'), {code: 'quota_exceeded'}); }} onClose={() => done.push('closed2')} />);
  fireEvent.click(screen.getByRole('button', {name: 'Ta bort'}));
  expect((await screen.findByRole('alert')).textContent).toMatch('fullt');
  expect(done).not.toContain('closed2');
});

test('while busy (a save in progress) the dialog cannot be closed, so an error is never lost', () => {
  const closed: string[] = [];
  render(<Dialog title="Sparar" busy onClose={() => closed.push('x')}><button>Avbryt</button></Dialog>);
  fireEvent.keyDown(screen.getByRole('button', {name: 'Avbryt'}), {key: 'Escape'});
  fireEvent.click(screen.getByTestId('dialog-overlay'));
  expect(closed).toEqual([]);
});

test('Tab from the last element wraps to the first, and Shift+Tab from the first to the last', () => {
  render(<Dialog title="Fälla" onClose={() => {}}><button>Första</button><button>Sista</button></Dialog>);
  const first = screen.getByRole('button', {name: 'Första'}), last = screen.getByRole('button', {name: 'Sista'});
  last.focus();
  fireEvent.keyDown(last, {key: 'Tab'});
  expect(document.activeElement).toBe(first);
  fireEvent.keyDown(first, {key: 'Tab', shiftKey: true});
  expect(document.activeElement).toBe(last);
});
