/* Integration plugins on the integrations page: whether one works. A plugin does not work when its latest 3 runs in a
 * row failed (e.g. the service did not answer); one or two failures in a row are a warning. */

export const INTEGRATION_BROKEN_AFTER = 3;

export function integrationStatus(i: IntegrationInfo): IntegrationStatus {
  if (!i.enabled) return 'off';
  if (!i.lastRun) return 'never';
  const failures = i.failures ?? (i.lastRun.ok ? 0 : 1);
  if (failures >= INTEGRATION_BROKEN_AFTER) return 'broken';
  return failures > 0 || !i.lastRun.ok ? 'warn' : 'ok';
}

// The plugins that are switched on and do not work
export const brokenIntegrations = (list: IntegrationInfo[] | null | undefined): IntegrationInfo[] =>
  (list || []).filter(i => integrationStatus(i) === 'broken');
