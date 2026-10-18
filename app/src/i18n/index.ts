/* The app's texts: t(key, params) looks the key up in the current language, then in Swedish. The language comes from
 * brand.json ("language", e.g. "sv"); an unknown language falls back to Swedish. A new language is a catalog with
 * the same keys (Catalog), registered with addCatalog; keys it lacks are taken from Swedish. */
import {sv} from './sv';

type SvKey = keyof typeof sv;
/** The base of a key with plural forms, e.g. "customerCount" for "customerCount.one" / "customerCount.other" */
type PluralBase = SvKey extends infer K ? (K extends `${infer B}.${'one' | 'other'}` ? B : never) : never;
export type TextKey = Exclude<SvKey, `${string}.${'one' | 'other'}`> | PluralBase;
export type Catalog = Record<SvKey, string>;
export type Params = Record<string, string | number>;

const catalogs: Record<string, Partial<Catalog>> = {sv};
let current = 'sv';

/* Registers (or extends) the texts of a language. */
export function addCatalog(lang: string, texts: Partial<Catalog>) {
  catalogs[lang] = {...catalogs[lang], ...texts};
}

/* Sets the language; an unknown one gives Swedish. The page's lang attribute follows (screen readers, hyphenation). */
export function setLanguage(lang: string | undefined) {
  current = lang && catalogs[lang] ? lang : 'sv';
  document.documentElement.lang = current;
}
export const language = () => current;

const fill = (text: string, params: Params) => text.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m));

export function t(key: TextKey, params: Params = {}): string {
  const lookup = (k: string) => (catalogs[current] as Record<string, string>)[k] ?? (sv as Record<string, string>)[k];
  let text: string | undefined;
  if (typeof params.count === 'number') {
    const form = new Intl.PluralRules(current).select(params.count) === 'one' ? 'one' : 'other';
    text = lookup(`${key}.${form}`);
  }
  text ??= lookup(key);
  return text === undefined ? key : fill(text, params);
}
