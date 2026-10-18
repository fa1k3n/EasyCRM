/* Text and links: escaping for HTML, and only http(s) links. */

export const esc = (s: unknown): string => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'} as Record<string, string>)[c]);
export const safeUrl = (u?: string | null): string | null => /^https?:\/\//i.test(u||'') ? u as string : (u && /^[\w.-]+\.[a-z]{2,}/i.test(u) ? 'https://'+u : null);
export const hostOf = (u: string): string => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return 'Källa'; } };
