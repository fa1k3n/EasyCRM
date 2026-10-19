/* Text and links: only http(s) links, and a link's host name. */
import {tx} from './i18n';

export const safeUrl = (u?: string | null): string | null => /^https?:\/\//i.test(u||'') ? u as string : (u && /^[\w.-]+\.[a-z]{2,}/i.test(u) ? 'https://'+u : null);
export const hostOf = (u: string): string => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return tx('source'); } };
