import {Copy} from 'lucide-react';
import type {CustomerDoc} from '../../data/store';
import {t} from '../../i18n';
import {logic} from '../../logic';
import {useToast} from '../Toast';

function CopyButton({value}: {value: string}) {
  const toast = useToast();
  const copy = async () => {
    try { await navigator.clipboard.writeText(value); toast(t('copied')); } catch { toast(t('copyFailed')); }
  };
  return (
    <button type="button" onClick={copy} aria-label={`${t('copy')} ${value}`} title={t('copy')}
      className="flex-none rounded p-1 text-muted hover:bg-sunk hover:text-ink"><Copy size={14} aria-hidden /></button>
  );
}

/* E-mail, phone, website/city and latest mail. Links only for mailto and http(s) addresses (safeUrl). */
export default function ContactDetails({c}: {c: CustomerDoc}) {
  const L = logic();
  const web = L.safeUrl(c.website);
  const lm = L.latestMail(c);
  const cell = (label: string, content: React.ReactNode) => (
    <div className="min-w-0 bg-surface px-3.5 py-2.5">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</div>
      <div className="flex min-w-0 items-center gap-2">{content}</div>
    </div>
  );
  const none = <span className="text-muted">–</span>;
  return (
    <div className="mt-5 grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2">
      {cell(t('email'), c.email ? <><a href={`mailto:${c.email}`} className="truncate">{c.email}</a><CopyButton value={c.email} /></> : none)}
      {cell(t('phone'), c.phone ? <><span className="truncate font-display">{c.phone}</span><CopyButton value={c.phone} /></> : none)}
      {cell(t('webCity'), web || c.city ? <>
        {web && <a href={web} target="_blank" rel="noopener" className="truncate">{c.website}</a>}
        {web && c.city && <span aria-hidden className="text-muted">·</span>}
        {c.city && <span className="truncate text-muted">{c.city}</span>}
      </> : none)}
      {cell(t('latestMail'), lm ? <span className="truncate">{L.fmtDate(lm.date)} · {lm.subject || L.KINDS[lm.kind || '']}</span> : <span className="text-muted">{t('noMailLogged')}</span>)}
    </div>
  );
}

/* Why an agent suggested this potential customer, and where the contact details were found. */
export function Why({c}: {c: CustomerDoc}) {
  if (c.source !== 'agent' || !(c.why || c.contactSource)) return null;
  const src = logic().safeUrl(c.contactSource);
  return (
    <div className="mt-5 rounded-2xl bg-sunk px-3.5 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">{t('whyTheyFit')}</div>
      {c.why && <p className="mt-1 max-w-[70ch]">{c.why}</p>}
      {(src || c.emailConfidence === 'gissad') && (
        <p className="mt-1 text-[13px] text-muted">
          {src && <>{t('contactFoundAt')} <a href={src} target="_blank" rel="noopener" className="underline">{c.contactSource}</a></>}
          {c.emailConfidence === 'gissad' && <strong className="ml-1 font-semibold text-amber">{t('emailGuessed')}</strong>}
        </p>
      )}
    </div>
  );
}
