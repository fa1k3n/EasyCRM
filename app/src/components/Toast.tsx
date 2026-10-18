import {createContext, useCallback, useContext, useRef, useState, type ReactNode} from 'react';

/* Short messages at the bottom of the screen ("Sparat", errors). useToast() gives a function that shows one. */
const ToastContext = createContext<(message: string) => void>(() => {});
const SHOW_MS = 2200;

export function ToastProvider({children}: {children: ReactNode}) {
  const [message, setMessage] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const show = useCallback((m: string) => {
    setMessage(m);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(''), SHOW_MS);
  }, []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      {/* The live region is always present, so screen readers announce each new message */}
      <div role="status" className={message ? 'fixed bottom-5 left-1/2 z-30 -translate-x-1/2 rounded-lg bg-ink px-4 py-2 text-sm text-bg shadow-lg' : 'sr-only'}>
        {message}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
