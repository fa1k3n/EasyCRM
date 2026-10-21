/* The integration plugins built into the Worker: running them (on their schedule or now), switching them off and on,
 * and /api/v1/integrations. Each plugin's state is its entry in sync/integrations: {enabled, lastRun, failures,
 * running, manualAt}. A run marks the entry as running first (with If-Match), so two runs of one plugin never overlap;
 * a mark older than 5 minutes is a run that died and is ignored. The local server has no plugins and no routes here. */
import {Hono} from 'hono';
import type {ValidationIssue} from '../../crm/logic/validate';
import type {IntegrationManifest, Json} from '../../tools/integration-api';
import {recordRun, runOnce, updateIntegration, type IntegrationCall, type LastRun} from '../../tools/integration-core.js';
import type {Env} from './app';
import {ApiError} from './errors';

export interface BuiltInIntegration { manifest: IntegrationManifest; settings: Record<string, Json>; cron: string }
interface Entry { enabled?: boolean; lastRun?: LastRun; failures?: number; running?: {startedAt: string}; manualAt?: string }
type Refusal = 'unknown' | 'disabled' | 'running' | 'too_soon';

export interface Integrations {
  list(): Promise<IntegrationInfo[]>;
  setEnabled(id: string, enabled: boolean): Promise<IntegrationInfo | null>;
  /** Runs the plugin now (trigger "manual") or on its schedule ("cron"); a refusal says why it did not run */
  run(id: string, trigger: 'manual' | 'cron'): Promise<{lastRun: LastRun} | {refused: Refusal}>;
  /** The plugins with this schedule, one after the other */
  runDue(cron: string): Promise<void>;
}

const HUNG = 5 * 60 * 1000;
const MANUAL_GAP = 60 * 1000;

export function createIntegrations({integrations, call, env, clock, validateCustomer}: {
  integrations: BuiltInIntegration[]; call: IntegrationCall; env: Record<string, string>; clock: () => Date;
  validateCustomer: (doc: unknown) => ValidationIssue[];
}): Integrations {
  const find = (id: string) => integrations.find(i => i.manifest.id === id);
  const read = async () => {
    const r = await call('GET', '/sync/integrations');
    const {id: _, ...doc} = (r.status === 200 && r.data ? r.data : {}) as Record<string, Entry>;
    return doc as Record<string, Entry>;
  };
  const update = (id: string, change: (entry: Entry) => Entry | null) => updateIntegration<Entry & Record<string, unknown>>(call, id, change as never);
  const info = (i: BuiltInIntegration, e: Entry = {}): IntegrationInfo =>
    ({id: i.manifest.id, name: i.manifest.name, cron: i.cron, enabled: e.enabled !== false, failures: e.failures ?? 0, lastRun: e.lastRun ?? null});

  const api: Integrations = {
    async list() {
      const doc = await read();
      return integrations.map(i => info(i, doc[i.manifest.id]));
    },
    async setEnabled(id, enabled) {
      const i = find(id);
      if (!i) return null;
      return info(i, (await update(id, e => ({...e, enabled})))!);
    },
    async run(id, trigger) {
      const i = find(id);
      if (!i) return {refused: 'unknown'};
      const now = clock();
      let refused: Refusal | null = null;
      await update(id, e => {
        if (e.enabled === false) refused = 'disabled';
        else if (e.running && now.getTime() - Date.parse(e.running.startedAt) < HUNG) refused = 'running';
        else if (trigger === 'manual' && e.manualAt && now.getTime() - Date.parse(e.manualAt) < MANUAL_GAP) refused = 'too_soon';
        if (refused) return null;
        return {...e, running: {startedAt: now.toISOString()}, ...(trigger === 'manual' ? {manualAt: now.toISOString()} : {})};
      });
      if (refused) return {refused};
      const {lastRun} = await runOnce(i.manifest, {validateCustomer, call, env, settings: i.settings, trigger, fetchImpl: noRedirects, now: clock});
      await recordRun(call, id, lastRun, e => ({...e, failures: lastRun.ok ? 0 : Number(e.failures ?? 0) + 1}));
      // Only the id and the counts: an error message or a note may hold customer data (design rule 9)
      console.log(`[integration] ${id} (${trigger}): ${lastRun.ok ? `ok ${JSON.stringify(lastRun.counts)}, ${lastRun.remaining} left` : 'failed (see sync/integrations)'}`);
      return {lastRun};
    },
    async runDue(cron) {
      for (const i of integrations.filter(x => x.cron === cron)) {
        // A run never throws for the plugin's own errors; this catches the rare database error, so the next one still runs
        try { await api.run(i.manifest.id, 'cron'); } catch { console.error(`[integration] ${i.manifest.id}: the run could not be recorded`); }
      }
    }
  };
  return api;
}

// Workers' fetch cannot refuse redirects itself: they are not followed, and an answer that is one is an error
const noRedirects: typeof fetch = async (url, init) => {
  const res = await fetch(url, {...init, redirect: 'manual'});
  if (res.status >= 300 && res.status < 400) throw new Error('The service answered with a redirect, which is not followed');
  return res;
};

const REFUSALS: Record<Refusal, ApiError> = {
  unknown: new ApiError(404, 'not_found', 'Not found'),
  disabled: new ApiError(409, 'integration_disabled', 'The integration is switched off'),
  running: new ApiError(409, 'integration_running', 'The integration is already running'),
  too_soon: new ApiError(429, 'too_many_runs', 'The integration was run less than a minute ago')
};

/** /api/v1/integrations: GET the list, PUT /{id} with {enabled}, POST /{id}/run */
export function integrationRoutes(integrations: Integrations) {
  const r = new Hono<Env>();
  r.get('/', async c => c.json(await integrations.list()));
  r.put('/:id', async c => {
    const body = c.get('body') as {enabled?: unknown} | null;
    if (!body || typeof body.enabled !== 'boolean') throw new ApiError(400, 'validation', 'The data is not valid', [{path: 'enabled', message: 'must be true or false'}]);
    const result = await integrations.setEnabled(c.req.param('id'), body.enabled);
    if (!result) throw REFUSALS.unknown;
    return c.json(result);
  });
  r.post('/:id/run', async c => {
    const result = await integrations.run(c.req.param('id'), 'manual');
    if ('refused' in result) throw REFUSALS[result.refused];
    return c.json(result.lastRun);
  });
  return r;
}
