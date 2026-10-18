/* Loads the brand's extensions: each manifest is checked, and one that is wrong (another apiVersion, a bad id, wrong
 * places) is left out with a clear error, so that the rest of the app and the other extensions still work. */
import {t} from '../i18n';
import {logic} from '../logic';
import {API_VERSION, type ExtensionManifest} from './api';

export interface LoadedExtensions { extensions: ExtensionManifest[]; errors: string[] }

const isObject = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

// What is wrong with a manifest, or '' if nothing
function problem(m: Record<string, unknown>, seen: Set<string>): string {
  if (typeof m.id !== 'string' || !/^[a-z0-9_-]+$/.test(m.id)) return t('extBadId');
  if (seen.has(m.id)) return t('extDuplicateId');
  if (m.apiVersion !== API_VERSION) return t('extApiVersion', {got: String(m.apiVersion), want: API_VERSION});
  if (typeof m.name !== 'string' || !m.name) return t('extNoName');
  const sections = m.customerSections, badges = m.listBadges;
  if (sections !== undefined && (!Array.isArray(sections) || !sections.every(s => isObject(s) && typeof s.id === 'string' && typeof s.title === 'string' && typeof s.Component === 'function'))) return t('extBadSections');
  if (badges !== undefined && (!Array.isArray(badges) || !badges.every(b => typeof b === 'function'))) return t('extBadBadges');
  if (m.mail !== undefined) { const why = logic().checkMailModule(m.mail); if (why.length) return t('extBadMail', {why: why.join('; ')}); }
  return '';
}

export function loadExtensions(list: unknown[] | undefined): LoadedExtensions {
  const extensions: ExtensionManifest[] = [], errors: string[] = [], seen = new Set<string>();
  (list || []).forEach((m, i) => {
    const name = isObject(m) && typeof m.id === 'string' ? m.id : `#${i + 1}`;
    const why = isObject(m) ? problem(m, seen) : t('extNotManifest');
    if (why) { errors.push(t('extError', {name, why})); return; }
    seen.add((m as {id: string}).id);
    extensions.push(m as unknown as ExtensionManifest);
  });
  return {extensions, errors};
}
