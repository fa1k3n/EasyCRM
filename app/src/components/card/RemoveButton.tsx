import {X} from 'lucide-react';
import {useEffect, useState} from 'react';
import {t} from '../../i18n';

/* A remove button that needs a second click within a few seconds ("Ta bort?"), as in the old app. */
export default function RemoveButton({onRemove, disabled}: {onRemove: () => void; disabled?: boolean}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(timer);
  }, [armed]);
  return (
    <button type="button" disabled={disabled} aria-label={armed ? t('removeConfirm') : t('remove')}
      onClick={() => { if (armed) { setArmed(false); onRemove(); } else setArmed(true); }}
      className="flex-none self-start rounded p-1 text-muted hover:bg-sunk hover:text-ink disabled:opacity-50">
      {armed ? <span className="text-[13px] text-tally">{t('removeConfirm')}</span> : <X size={14} aria-hidden />}
    </button>
  );
}
