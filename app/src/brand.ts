/* The brand (brand.js sets window.BRAND when publishing): checked by the shared logic, then turned into CSS variables
 * for light and dark mode, fonts and customer type colours. Tailwind's theme points at these variables. */
import {logic} from './logic';
import {setLanguage, t} from './i18n';

const STACK = 'ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif';

export interface AppliedBrand { brand: Brand; error: string }

/* CSS for the brand. Values are stripped of characters that could end the rule, since a brand may pass a raw value
 * (e.g. a shadow) through. */
export function brandCss(b: Brand): string {
  const L = logic();
  const fonts = L.brandFonts(b.fonts || {});
  const family = (f: string) => (f ? `"${f}",${STACK}` : STACK);
  const colors = L.deriveColors(b.colors);
  if (colors.warnings.length) console.warn('Brand colours:', colors.warnings.join(' · '));
  const vars = (p: Record<string, string>) => Object.entries(p).map(([k, v]) => `--${k}:${String(v).replace(/[;{}<>]/g, '')}`).join(';');
  const types = Object.entries(L.typeColors()).filter(([id]) => /^[a-z0-9_-]+$/i.test(id));
  const typeVars = (mode: 'light' | 'dark') => types.map(([id, v]) => `--t-${id}:${v[mode]}`).join(';');
  return `:root{${vars(colors.light)};${typeVars('light')};--f-display:${family(fonts.display)};--f-body:${family(fonts.body)}}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){${vars(colors.dark)};${typeVars('dark')}}}
:root[data-theme="dark"]{${vars(colors.dark)};${typeVars('dark')}}`;
}

/* Reads window.BRAND, applies it to the page and returns it. A broken brand never gives an empty page: the example
 * company is used instead and the error is returned so the app can show it. */
export function applyBrand(): AppliedBrand {
  const L = logic();
  let error = '';
  try { L.setBrand((window.BRAND as Brand | undefined) || null); }
  catch (e) { error = e instanceof Error ? e.message : String(e); L.setBrand(null); }
  const brand = L.getBrand();
  document.getElementById('brand-style')?.remove();
  const style = document.createElement('style');
  style.id = 'brand-style';
  style.textContent = brandCss(brand);
  document.head.appendChild(style);
  const href = L.googleFontsUrl(L.brandFonts(brand.fonts || {}));
  if (href && !document.querySelector(`link[href="${href}"]`)) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  }
  setLanguage(brand.language);
  document.title = brand.company.name + t('titleSuffix');
  return {brand, error};
}
