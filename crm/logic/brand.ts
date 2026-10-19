/* The brand: company name, colours, fonts, senders and customer types come from brand.json. The current brand is
 * module state, changed with setBrand(). */
import {deriveColors, hex, mix} from './colors';
import {languageOf, setLanguage, tx} from './i18n';

// The default brand when no other is set. A made-up example company: nothing here may come from a real company.
export const EXAMPLE_BRAND: Brand = {
  company: {name: 'Exempelstudion AB'},
  logo: 'logo.svg',
  colors: {accent: '#0f766e', ink: '#1f2933', bg: '#f6f7f7'},
  fonts: {display: 'system-ui', body: 'system-ui'},
  senders: [{id: 'standard', name: 'Förnamn Efternamn', company: 'Exempelstudion AB', phone: '000-000 00 00', web: 'www.exempelstudion.example',
    signature: ['Förnamn Efternamn', 'Exempelstudion AB', '000-000 00 00 · www.exempelstudion.example']}],
  defaultSender: 'standard',
  customerTypes: [
    {id: 'konsultation', label: 'Konsultation', color: '#0f766e', icon: 'pratbubbla'},
    {id: 'projekt', label: 'Projekt', color: '#7c3aed', icon: 'portfolj'},
    {id: 'event', label: 'Event', color: '#b45309', icon: 'stjarna'}
  ]
};
let brand: Brand = EXAMPLE_BRAND;

// A customer type's own SVG icon is inserted as HTML, so only simple drawing elements and attributes get through
// (a whitelist). Events (on…), links, images, styles, scripts and url()/javascript: are stopped however they are written.
const SVG_ELEMENTS = ['path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'ellipse', 'g'];
const SVG_ATTRS = ['d', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'width', 'height', 'points', 'fill', 'stroke', 'stroke-width',
  'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray', 'fill-rule', 'clip-rule', 'transform', 'opacity', 'fill-opacity', 'stroke-opacity'];
function unsafeSvg(svg: string, lang: string): string {
  if (/javascript:|url\s*\(|&#|\\/i.test(svg)) return tx('svg.urls', {}, lang);
  const withoutTags = svg.replace(/<[^>]*>/g, '');
  if (/[<>]/.test(withoutTags) || withoutTags.trim()) return tx('svg.text', {}, lang);
  for (const m of svg.matchAll(/<\s*\/?\s*([^\s/>]+)([^>]*)>/g)) {
    const el = m[1].toLowerCase();
    if (!SVG_ELEMENTS.includes(el)) return tx('svg.element', {element: m[1], allowed: SVG_ELEMENTS.join(', ')}, lang);
    // Every attribute name, also those separated by / instead of a space
    for (const a of m[2].matchAll(/([^\s=/"']+)\s*(=\s*("[^"]*"|'[^']*'|[^\s/>]+))?/g)) {
      if (!SVG_ATTRS.includes(a[1].toLowerCase())) return tx('svg.attribute', {attribute: a[1]}, lang);
    }
  }
  return '';
}

// Checks a brand (brand.json) and returns the errors in the brand's own language (brand.json's "language"); an empty list = valid
export function validateBrand(b: Brand): string[] {
  const e: string[] = [], x = (b || {}) as Partial<Brand>;
  const l = languageOf(x.language);
  const t = (key: Parameters<typeof tx>[0], params: Record<string, string | number> = {}) => tx(key, params, l);
  if (!x.company || !x.company.name) e.push(t('brand.companyName'));
  if (!x.colors) e.push(t('brand.colors'));
  else { try { deriveColors(x.colors, l); } catch (err) { e.push((err as Error).message); } }
  if (x.logo && !/^[\w.-]+\.(png|svg|jpe?g|webp)$/i.test(x.logo) && !/^https:\/\/[^\s"'<>]+$/i.test(x.logo)) e.push(t('brand.logo', {logo: x.logo}));
  if (x.language !== undefined && (typeof x.language !== 'string' || !/^[a-z]{2}$/.test(x.language))) e.push(t('brand.language', {value: String(x.language)}));
  if (!Array.isArray(x.senders) || !x.senders.length) e.push(t('brand.senders'));
  else x.senders.forEach((s, i) => { if (!s.id) e.push(t('brand.senderId', {i})); if (!Array.isArray(s.signature)) e.push(t('brand.senderSignature', {i})); });
  if (!x.defaultSender) e.push(t('brand.defaultSender'));
  else if (Array.isArray(x.senders) && !x.senders.some(s => s.id === x.defaultSender)) e.push(t('brand.defaultSenderUnknown', {id: x.defaultSender}));
  if (!Array.isArray(x.customerTypes)) e.push(t('brand.types'));
  else {
    const seen = new Set<string>();
    x.customerTypes.forEach((ct, i) => {
      if (!/^[a-z0-9_-]+$/.test(ct.id || '')) e.push(t('brand.typeId', {i, id: String(ct.id)}));
      else if (seen.has(ct.id)) e.push(t('brand.typeIdUnique', {id: ct.id}));
      seen.add(ct.id);
      if (!ct.label) e.push(t('brand.typeLabel', {i}));
      try { hex(ct.color, `customerTypes[${i}].color`, l); if (ct.colorDark) hex(ct.colorDark, `customerTypes[${i}].colorDark`, l); } catch (err) { e.push((err as Error).message); }
      if (ct.icon !== undefined && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(ct.icon)) e.push(t('brand.typeIcon', {i, icon: ct.icon}));
      const svgErr = ct.svg ? unsafeSvg(ct.svg, l) : '';
      if (svgErr) e.push(`customerTypes[${i}].svg: ${svgErr}`);
    });
  }
  return e;
}

// Changes the brand; null gives the example company. A broken brand is refused with an error, and the previous one is kept.
export const setBrand = (b?: Brand | null): void => {
  if (!b) { brand = EXAMPLE_BRAND; setLanguage(undefined); return; }
  const errors = validateBrand(b);
  if (errors.length) throw new Error(tx('brand.invalid', {errors: errors.join('; ')}, languageOf(b.language)));
  brand = b;
  setLanguage(b.language);
};
export const getBrand = (): Brand => brand;
// {id: name} for the brand's customer types, in the brand's order
export const serviceTypes = (): Record<string, string> => Object.fromEntries(brand.customerTypes.map(t => [t.id, t.label]));

// Customer types (several per customer), in the brand's order, without unknown ids
export function customerTypes(c: Customer): ServiceType[] {
  const src: string[] = Array.isArray(c.types) ? c.types : [];
  return brand.customerTypes.map(t => t.id).filter(id => src.includes(id));
}
// The sender for a customer: the first of the customer's types (in the brand's order) with a valid sender, otherwise the default
export function senderFor(c: Customer): Sender {
  const byId = (id?: string) => brand.senders.find(s => s.id === id);
  for (const id of customerTypes(c)) {
    const s = byId(brand.customerTypes.find(t => t.id === id)?.sender);
    if (s) return s;
  }
  return byId(brand.defaultSender) || brand.senders[0];
}
// A tip in the customer form about customer types that give another sender than the default
export const senderHint = (): string => brand.customerTypes.map(t => {
  const s = brand.senders.find(x => x.id === t.sender);
  return s && s.id !== brand.defaultSender ? tx('senderHint', {label: t.label, sender: s.company || s.name || s.id}) : '';
}).filter(Boolean).join(' ');

// Fonts: the names end up in CSS and in an address, so only letters, digits, spaces and - get through; "system-ui" = none of its own
interface CleanFonts { display: string; body: string; google: boolean; }
export const brandFonts = (f: Brand['fonts'] = {}): CleanFonts => {
  const clean = (n?: string) => n && !/^system-ui$/i.test(n) ? String(n).replace(/[^\w\s-]/g, '') : '';
  return {display: clean(f.display), body: clean(f.body), google: !!f.googleFonts};
};
export const googleFontsUrl = (f: CleanFonts): string => {
  const families = [...new Set([f.display, f.body].filter(Boolean))];
  return f.google && families.length ? 'https://fonts.googleapis.com/css2?' + families.map(n => 'family=' + encodeURIComponent(n).replace(/%20/g, '+') + ':wght@400;500;600;700').join('&') + '&display=swap' : '';
};
// A light and a dark colour per customer type; the dark one is worked out if it is not given
export const typeColors = (): Record<string, {light: string; dark: string}> =>
  Object.fromEntries(brand.customerTypes.map(t => [t.id, {light: hex(t.color, tx('color.typeField', {id: t.id})), dark: t.colorDark ? hex(t.colorDark, tx('color.typeField', {id: t.id})) : mix(t.color, '#ffffff', 0.35)}]));

// A customer type's icon: the brand's own svg, otherwise a name from the app's own set (the old names), otherwise a
// lucide name; without an icon it is a dot. Whether a lucide name exists is decided by the app, which has the icons.
export const OWN_ICONS = ['person', 'kamera', 'film', 'sandning', 'pokal', 'pratbubbla', 'portfolj', 'stjarna', 'kalender', 'prick'];
type TypeIconSpec = {kind: 'svg'; svg: string} | {kind: 'own' | 'lucide'; name: string};
export const typeIcon = (id: string): TypeIconSpec => {
  const d = brand.customerTypes.find(t => t.id === id);
  if (d?.svg) return {kind: 'svg', svg: d.svg};
  if (!d?.icon) return {kind: 'own', name: 'prick'};
  return OWN_ICONS.includes(d.icon) ? {kind: 'own', name: d.icon} : {kind: 'lucide', name: d.icon};
};
