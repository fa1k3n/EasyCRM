import {applyBrand, brandCss} from './brand';

const BRAND = {
  company: {name: 'Testbolaget AB'},
  logo: 'logga.png',
  colors: {accent: '#0f766e', ink: '#1f2933', bg: '#f6f7f7'},
  fonts: {display: 'Manrope', body: 'Poppins', googleFonts: true},
  senders: [{id: 's1', signature: ['Test']}],
  defaultSender: 's1',
  customerTypes: [{id: 'a', label: 'A', color: '#b4532a'}]
};

afterEach(() => {
  document.head.querySelectorAll('link, style').forEach(el => el.remove());
  delete window.BRAND;
});

describe('brandCss', () => {
  test('gives the colour variables for light and dark mode, the fonts and the customer type colours', () => {
    window.CRMLogic.setBrand(BRAND);
    const css = brandCss(window.CRMLogic.getBrand());
    expect(css).toMatch(/:root\{[^}]*--accent:#0f766e/);
    expect(css).toMatch('@media (prefers-color-scheme: dark)');
    expect(css).toMatch(':root[data-theme="dark"]');
    expect(css).toMatch('--f-display:"Manrope"');
    expect(css).toMatch('--t-a:#b4532a');
  });
  test('values cannot break out of the CSS rule', () => {
    window.CRMLogic.setBrand({...BRAND, colors: {...BRAND.colors, overrides: {light: {shadow: 'none;}body{display:none'}}}});
    expect(brandCss(window.CRMLogic.getBrand())).not.toMatch('body{display:none');
  });
});

describe('applyBrand', () => {
  test('uses window.BRAND, adds the style element and the Google Fonts link', () => {
    window.BRAND = BRAND;
    const r = applyBrand();
    expect(r.error).toBe('');
    expect(r.brand.company.name).toBe('Testbolaget AB');
    expect(document.getElementById('brand-style')?.textContent).toMatch('--accent');
    expect(document.querySelector('link[href*="fonts.googleapis.com"]')).not.toBeNull();
  });
  test('without window.BRAND the example company is used, without error', () => {
    const r = applyBrand();
    expect(r.error).toBe('');
    expect(r.brand.company.name).toBe('Exempelstudion AB');
  });
  test('a broken brand never gives an empty page: the example company is used and the error is returned', () => {
    window.BRAND = {company: {}};
    const r = applyBrand();
    expect(r.error).not.toBe('');
    expect(r.brand.company.name).toBe('Exempelstudion AB');
  });
});
