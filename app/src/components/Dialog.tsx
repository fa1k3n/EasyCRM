import {useEffect, useId, useRef, useState, type ReactNode} from 'react';
import {writeErrorMessage} from '../data/StoreContext';
import {t} from '../i18n';

const FOCUSABLE = 'input, select, textarea, button, a[href], [tabindex]:not([tabindex="-1"])';

/* A modal dialog: labelled by its title, the focus moves into it and stays there (Tab wraps), Escape or a click
 * outside closes it, and the focus returns to where it was. Keys are handled with React's own handlers. busy: a save is
 * in progress, so the dialog stays open (an error from the save would otherwise be lost). */
export default function Dialog({title, onClose, children, wide = false, busy = false}: {title: string; onClose: () => void; children: ReactNode; wide?: boolean; busy?: boolean}) {
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    box.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    return () => before?.focus();
  }, []);
  const keys = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.stopPropagation(); if (!busy) onClose(); return; }
    if (e.key !== 'Tab' || !box.current) return;
    const items = [...box.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(el => !(el as HTMLButtonElement).disabled);
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  return (
    <div data-testid="dialog-overlay" onClick={e => { if (e.target === e.currentTarget && !busy) onClose(); }} onKeyDown={keys}
      className="fixed inset-0 z-20 grid place-items-center bg-black/45 p-4">
      <div ref={box} role="dialog" aria-modal="true" aria-labelledby={id}
        className={`max-h-[calc(100%-32px)] w-full overflow-auto rounded-[20px] bg-surface p-5 text-ink shadow-xl ${wide ? 'max-w-[720px]' : 'max-w-[560px]'}`}>
        <h3 id={id} className="mb-4 font-display text-[22px] font-semibold tracking-tight [text-wrap:balance]">{title}</h3>
        {children}
      </div>
    </div>
  );
}

/* A question before something that cannot be undone. The action runs on "OK"; if it fails, the error is shown in the
 * dialog and it stays open. */
export function ConfirmDialog({text, okLabel, onConfirm, onClose}: {text: string; okLabel: string; onConfirm: () => Promise<unknown>; onClose: () => void}) {
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const confirm = async () => {
    setPending(true);
    setError('');
    try { await onConfirm(); onClose(); } catch (e) { setError(writeErrorMessage(e)); setPending(false); }
  };
  return (
    <Dialog title={text} onClose={onClose} busy={pending}>
      {error && <p role="alert" className="text-[13px] text-tally">{error}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} disabled={pending} className="rounded-full border border-line bg-surface px-4 py-2 font-medium disabled:opacity-60">{t('cancel')}</button>
        <button type="button" onClick={confirm} disabled={pending} className="rounded-full bg-accent px-4 py-2 font-bold text-accent-ink hover:bg-accent-hover disabled:opacity-60">{okLabel}</button>
      </div>
    </Dialog>
  );
}
