/* Colours: the whole palette for light and dark mode is worked out from 3–4 brand colours, with WCAG contrast checks.
 * The error and warning texts are in lang (the current language if not given). */
import {language, tx} from './i18n';

function rgb(c: string, field: string, lang = language()): [number, number, number] {
  const m = /^#([0-9a-f]{6})$/i.exec(String(c || '').trim());
  if (!m) throw new Error(tx('color.invalid', {field, value: String(c)}, lang));
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export const hex = (c: string, field: string, lang?: string): string => '#' + rgb(c, field, lang).map(v => v.toString(16).padStart(2, '0')).join('');
export const mix = (a: string, b: string, t: number): string => {
  const x = rgb(a, tx('color.field')), y = rgb(b, tx('color.field'));
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('');
};
const luminance = (c: string): number => {
  const [r, g, b] = rgb(c, tx('color.field')).map(v => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
// Contrast ratio according to WCAG: 1 (none) to 21 (black on white)
export const contrastRatio = (a: string, b: string): number => { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const bestOn = (bg: string, options: string[]): string => options.reduce((best, o) => contrastRatio(o, bg) > contrastRatio(best, bg) ? o : best);
const MIN_TEXT = 4.5;

export function deriveColors(colors: BrandColors, lang = language()): DerivedColors {
  const accent = hex(colors.accent, 'colors.accent', lang), ink = hex(colors.ink, 'colors.ink', lang), bg = hex(colors.bg, 'colors.bg', lang);
  const hover = colors.accentHover ? hex(colors.accentHover, 'colors.accentHover', lang) : mix(accent, '#000000', 0.16);
  const [ir, ig, ib] = rgb(ink, 'colors.ink');
  const light: Record<string, string> = {
    bg, surface: '#ffffff', sunk: mix(bg, ink, 0.08), ink, text: mix(ink, bg, 0.22), muted: mix(ink, bg, 0.32), line: mix(bg, ink, 0.13),
    accent, 'accent-hover': hover, 'accent-ink': bestOn(accent, ['#ffffff', ink]), 'brand-soft': mix(bg, accent, 0.18), focus: accent,
    shadow: `0 1px 2px rgba(${ir},${ig},${ib},.05),0 10px 28px rgba(${ir},${ig},${ib},.08)`
  };
  const dbg = mix(ink, '#000000', 0.35), dink = mix(bg, '#ffffff', 0.6);
  // Dark mode: the accent is lightened as little as possible, but until the text on it (white or dark) passes WCAG AA
  let daccent = mix(accent, '#ffffff', 0.18);
  for (let t = 0.18; t <= 0.7 && contrastRatio(bestOn(daccent, ['#ffffff', dbg]), daccent) < MIN_TEXT; t += 0.04) daccent = mix(accent, '#ffffff', t);
  const dark: Record<string, string> = {
    bg: dbg, surface: mix(dbg, '#ffffff', 0.05), sunk: mix(dbg, '#ffffff', 0.09), ink: dink, text: mix(dink, dbg, 0.18), muted: mix(dink, dbg, 0.38),
    line: mix(dbg, '#ffffff', 0.12), accent: daccent, 'accent-hover': mix(accent, '#ffffff', 0.3), 'accent-ink': bestOn(daccent, ['#ffffff', dbg]),
    'brand-soft': mix(dbg, accent, 0.22), focus: daccent, shadow: '0 1px 2px rgba(0,0,0,.3),0 10px 28px rgba(0,0,0,.35)'
  };
  for (const [mode, target] of [['light', light], ['dark', dark]] as const) {
    const o = (colors.overrides || {})[mode] || {};
    for (const k of Object.keys(o)) target[k] = k === 'shadow' ? o[k] : hex(o[k], `colors.overrides.${mode}.${k}`, lang);
  }
  const warnings: string[] = [];
  // WCAG AA for normal text (4.5:1): main text, body text, muted text and text on the accent colour (buttons, labels)
  const checks = [['color.ink', 'ink', 'bg'], ['color.text', 'text', 'bg'], ['color.muted', 'muted', 'bg'], ['color.accentInk', 'accent-ink', 'accent']] as const;
  for (const [name, p] of [['color.light', light], ['color.dark', dark]] as const) {
    for (const [label, fg, back] of checks) {
      const c = contrastRatio(p[fg], p[back]);
      if (c < MIN_TEXT) warnings.push(tx('color.lowContrast', {mode: tx(name, {}, lang), label: tx(label, {}, lang), against: tx(back === 'bg' ? 'color.onBg' : 'color.onAccent', {}, lang), ratio: c.toFixed(1), min: MIN_TEXT}, lang));
    }
  }
  return {light, dark, warnings};
}
