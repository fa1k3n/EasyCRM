/* Shared by the card's small forms and dialogs. */
import {t} from '../../i18n';
import {useToast} from '../Toast';

/** A short random id for a new contact, job or booking (unique within the customer) */
export const newId = () => Math.random().toString(36).slice(2, 10);

/** The look of the card's input fields */
export const inputClass = 'min-w-0 w-full rounded-md border border-line bg-bg px-2.5 py-2';

/** Copies text to the clipboard, with a toast whether it worked or not */
export function useCopy() {
  const toast = useToast();
  return async (text: string) => {
    try { await navigator.clipboard.writeText(text); toast(t('copied')); } catch { toast(t('copyFailed')); }
  };
}
