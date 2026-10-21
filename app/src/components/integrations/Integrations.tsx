import {useId, useState} from 'react';
import {useIntegrations, useStore} from '../../data/StoreContext';
import {ApiRequestError} from '../../data/restStore';
import {t, type TextKey} from '../../i18n';
import {logic} from '../../logic';
import {useToast} from '../Toast';

/* The integration plugins that run in the cloud's Worker: a page with every plugin (schedule, latest run, Kör nu and
 * an on/off switch), the button to it in the header, and an alert above the customer list when one does not work
 * (its latest runs failed several times in a row; the logic's integrationStatus decides). */

const pad = (n: number) => String(n).padStart(2, '0');
// The run's time in the viewer's own time zone
function when(iso: string) {
  const d = new Date(iso);
  return `${logic().fmtDate(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "1 ny kund · 2 nya jobb · 1 ändrat jobb · 0 kopplingar" */
function countsText(run: IntegrationRun) {
  const c = run.counts ?? {customers: 0, created: 0, updated: 0, linked: 0};
  return [...(c.customers ? [t('integrationCustomers', {count: c.customers})] : []), t('integrationCreated', {count: c.created}),
    t('integrationUpdated', {count: c.updated}), t('integrationLinked', {count: c.linked})].join(' · ');
}

const STATUS: Record<IntegrationStatus, {text: TextKey; className: string}> = {
  ok: {text: 'integrationOk', className: 'border-ok bg-ok-soft text-ok'},
  warn: {text: 'integrationWarn', className: 'border-amber bg-amber-soft text-amber'},
  broken: {text: 'integrationBroken', className: 'border-tally bg-tally text-tally-ink'},
  off: {text: 'integrationOff', className: 'border-line bg-sunk text-muted'},
  never: {text: 'integrationNever', className: 'border-line bg-surface text-muted'}
};

const REFUSED: Record<string, TextKey> = {too_many_runs: 'integrationTooSoon', integration_running: 'integrationRunning', integration_disabled: 'integrationDisabled'};
const refusal = (e: unknown) => t(e instanceof ApiRequestError && REFUSED[e.code] ? REFUSED[e.code] : 'errorSave');

/* One plugin on the page */
function Integration({i}: {i: IntegrationInfo}) {
  const store = useStore();
  const toast = useToast();
  const id = useId();
  const [pending, setPending] = useState(false);
  const status = logic().integrationStatus(i);
  const run = i.lastRun;
  const canWrite = !!store?.canWrite;
  const act = async (work: () => Promise<string>) => {
    setPending(true);
    try { toast(await work()); } catch (e) { toast(refusal(e)); } finally { setPending(false); }
  };
  const runNow = () => act(async () => {
    const r = await store!.runIntegration(i.id);
    return r.ok ? t('integrationRan', {name: i.name, counts: countsText(r)}) : t('integrationRunFailed', {name: i.name, error: r.error ?? ''});
  });
  const toggle = () => act(async () => {
    await store!.setIntegrationEnabled(i.id, !i.enabled);
    return t(i.enabled ? 'integrationSwitchedOff' : 'integrationSwitchedOn', {name: i.name});
  });
  return (
    <li aria-labelledby={id} data-status={status}
      className={`rounded-2xl border bg-surface px-4 py-3.5 ${status === 'broken' ? 'border-tally bg-tally-soft' : 'border-line'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id={id} className="font-display text-[17px] font-semibold">{i.name}</h3>
          <p className="text-[13px] text-muted">{i.id} · {t('integrationSchedule', {cron: i.cron})}</p>
        </div>
        <span className={`rounded-full border px-2.5 py-0.5 text-[12px] font-semibold ${STATUS[status].className}`}>
          {t(STATUS[status].text, {count: i.failures ?? 0})}
        </span>
      </div>
      {run && (
        <div className="mt-2.5 space-y-1 text-[13px]">
          <p className="text-muted">{t('integrationLast', {when: when(run.at), trigger: t(run.trigger === 'manual' ? 'integrationTriggerManual' : 'integrationTriggerCron')})}</p>
          {run.ok ? <p>{countsText(run)}</p> : <p className="font-medium text-tally [overflow-wrap:anywhere]">{run.error}</p>}
          {!!run.remaining && <p className="text-muted">{t('integrationRemaining', {count: run.remaining})}</p>}
          {(run.notes ?? []).map((n, k) => <p key={k} className="text-muted [overflow-wrap:anywhere]">{n}</p>)}
          {!!run.unmatched?.length && <p className="text-muted [overflow-wrap:anywhere]">{t('integrationUnmatched', {list: run.unmatched.join(', ')})}</p>}
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" onClick={runNow} disabled={pending || !i.enabled || !canWrite}
          className="rounded-full bg-accent px-3.5 py-1.5 text-[13px] font-bold text-accent-ink hover:bg-accent-hover disabled:opacity-50">{t('integrationRunNow')}</button>
        <button type="button" role="switch" aria-checked={i.enabled} aria-label={t('integrationEnabled')} onClick={toggle} disabled={pending || !canWrite}
          className="flex items-center gap-2 rounded-full px-1 py-1 text-[13px] text-muted disabled:opacity-50">
          <span aria-hidden className={`relative h-5 w-9 rounded-full transition-colors ${i.enabled ? 'bg-ok' : 'bg-line'}`}>
            <span className={`absolute top-0.5 size-4 rounded-full bg-surface shadow transition-all ${i.enabled ? 'left-[18px]' : 'left-0.5'}`} />
          </span>
          {t('integrationEnabled')}
        </button>
      </div>
    </li>
  );
}

/* The integrations page, with a way back to the customers */
export function IntegrationsPage({onBack}: {onBack: () => void}) {
  const {state, list} = useIntegrations();
  return (
    <section className="mx-auto w-full max-w-3xl py-2">
      <button type="button" onClick={onBack} className="mb-2 rounded-full px-3 py-1.5 text-muted hover:bg-sunk hover:text-ink">{t('backToList')}</button>
      <h2 className="font-display text-2xl font-semibold tracking-tight">{t('integrationsTitle')}</h2>
      <p className="mb-4 text-[14px] text-muted">{t('integrationsIntro')}</p>
      {state === 'error' && <p className="mb-3 rounded-lg border border-tally bg-tally-soft px-3 py-2 text-[14px] text-tally">{t('integrationsError')}</p>}
      {state === 'loading' && <p className="text-muted">{t('integrationsLoading')}</p>}
      {state === 'unavailable' && <p className="text-muted">{t('integrationsNotHere')}</p>}
      {list && (list.length
        ? <ul className="space-y-3">{list.map(i => <Integration key={i.id} i={i} />)}</ul>
        : <p className="text-muted">{t('integrationsNone')}</p>)}
    </section>
  );
}

/* The header's button to the page: red when a plugin does not work; hidden where no integrations run */
export function IntegrationsButton({onOpen}: {onOpen: () => void}) {
  const {state, list} = useIntegrations();
  if (state === 'unavailable') return null;
  const broken = logic().brokenIntegrations(list).length > 0;
  return (
    <button type="button" onClick={onOpen} aria-label={broken ? t('integrationsButtonBroken') : t('integrationsButton')}
      className={`rounded-full border px-3.5 py-1.5 text-[13px] font-medium ${broken ? 'border-tally bg-tally text-tally-ink' : 'border-line bg-surface text-muted hover:text-ink'}`}>
      {t('integrationsButton')}
    </button>
  );
}

/* Above the customer list: the plugins that do not work, with a way to the page */
export function IntegrationsAlert({onOpen}: {onOpen: () => void}) {
  const broken = logic().brokenIntegrations(useIntegrations().list);
  if (!broken.length) return null;
  return (
    <div role="alert" className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-tally bg-tally-soft px-3 py-2 text-[14px] text-tally">
      <span className="min-w-0 flex-1">{broken.map(i => t('integrationAlert', {name: i.name, count: i.failures ?? 0})).join(' ')}</span>
      <button type="button" onClick={onOpen} className="rounded-full px-2 py-0.5 font-semibold underline">{t('integrationAlertShow')}</button>
    </div>
  );
}
