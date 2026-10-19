/* Unit tests for the brand: the default brand, customer types, senders and colours from the configuration.
 * Every test that changes the brand restores the test brand afterwards, so the tests do not affect each other. */
(function () {
  const L = window.CRMLogic;
  const withBrand = (brand, fn) => { L.setBrand(brand); try { fn(); } finally { L.setBrand(window.TEST_BRAND); } };
  const B2 = {
    company: {name: 'Andra AB'},
    colors: {accent: '#0f766e', ink: '#1f2933', bg: '#f6f7f7'},
    senders: [{id: 's1', signature: ['Ett', 'Två']}, {id: 's2', signature: ['Tre']}],
    defaultSender: 's1',
    customerTypes: [{id: 'a', label: 'A', color: '#111111'}, {id: 'b', label: 'B', color: '#222222', sender: 's2'}, {id: 'c', label: 'C', color: '#333333', sender: 'finns-inte'}]
  };
  const HEX = /^#[0-9a-f]{6}$/;

  describe('Brand: default and change', () => {
    test('without a brand the example company Exempelstudion AB is used', () => withBrand(null, () => {
      eq(L.getBrand().company.name, 'Exempelstudion AB');
      eq(Object.keys(L.SERVICE_TYPES), ['konsultation', 'projekt', 'event']);
    }));
    test('the example company has only made-up contact details (zeros as phone, addresses on .example)', () => withBrand(null, () => {
      for (const s of L.getBrand().senders) {
        const text = [s.phone, s.email, s.web, ...s.signature].filter(Boolean).join(' · ');
        ok(!/[1-9]/.test(text), `bara nollor som siffror: ${text}`);
        for (const host of text.match(/[\w-]+(\.[\w-]+)+/g) || []) ok(host.endsWith('.example'), `made-up address: ${host}`);
      }
    }));
    test('SERVICE_TYPES mirrors the brand’s customer types', () => withBrand(B2, () => eq(L.SERVICE_TYPES, {a: 'A', b: 'B', c: 'C'})));
  });

  describe('Brand: customer types', () => {
    test('the types follow the brand’s order, without duplicates and unknown values', () => withBrand(B2, () => eq(L.customerTypes({types: ['b', 'x', 'a', 'b']}), ['a', 'b'])));
    test('the filter on customer type uses the brand’s types', () => withBrand(B2, () => {
      const list = [{id: '1', types: ['a']}, {id: '2', types: ['b']}, {id: '3', types: ['b']}];
      eq(L.filterCustomers(list, {seg: 'alla', type: 'b', q: '', sort: 'namn'}).map(c => c.id).sort(), ['2', '3']);
    }));
    test('typeColors gives a light and a dark colour per type', () => withBrand(B2, () => {
      const t = L.typeColors();
      eq(Object.keys(t), ['a', 'b', 'c']);
      eq(t.a.light, '#111111');
      ok(HEX.test(t.a.dark) && t.a.dark !== t.a.light, 'a dark colour is worked out');
    }));
    test('colorDark is used if it is given', () => withBrand(Object.assign({}, B2, {customerTypes: [{id: 'a', label: 'A', color: '#111111', colorDark: '#eeeeee'}]}), () => eq(L.typeColors().a.dark, '#eeeeee')));
  });

  describe('Brand: senders', () => {
    test('the customer type’s sender is used, in the brand’s type order', () => withBrand(B2, () => {
      eq(L.senderFor({types: ['b', 'a']}).id, 's2');
      eq(L.senderFor({types: ['a']}).id, 's1');
      eq(L.senderFor({}).id, 's1');
    }));
    test('an unknown sender in a customer type falls back to the default sender', () => withBrand(B2, () => eq(L.senderFor({types: ['c']}).id, 's1')));
    test('the signature is the sender’s lines', () => withBrand(B2, () => {
      eq(L.signature({types: ['a']}), 'Ett\nTvå');
      eq(L.signature({types: ['b']}), 'Tre');
    }));
  });

  describe('Brand: the check of brand.json', () => {
    const errs = b => L.validateBrand(b);
    test('a complete brand has no errors, nor has the example company', () => { eq(errs(B2), []); eq(errs(L.EXAMPLE_BRAND), []); });
    test('missing required fields are named', () => {
      const e = errs({colors: B2.colors});
      for (const f of ['company.name', 'senders', 'defaultSender', 'customerTypes']) ok(e.some(x => x.includes(f)), `${f}: ${JSON.stringify(e)}`);
    });
    test('an invalid colour is named', () => ok(errs(Object.assign({}, B2, {colors: {accent: 'blå', ink: '#000000', bg: '#ffffff'}})).some(x => x.includes('colors.accent'))));
    test('defaultSender must be among the senders', () => ok(errs(Object.assign({}, B2, {defaultSender: 'saknas'})).some(x => x.includes('defaultSender'))));
    test('customer type ids must be unique and contain only a–z, 0–9, - and _', () => {
      const e = errs(Object.assign({}, B2, {customerTypes: [{id: 'a', label: 'A', color: '#111111'}, {id: 'a', label: 'A2', color: '#111111'}, {id: 'ö"x', label: 'X', color: '#111111'}]}));
      ok(e.some(x => x.includes('unik')) && e.some(x => x.includes('ö"x')), JSON.stringify(e));
    });
    test('the logo must be a file name or an https address', () => {
      eq(errs(Object.assign({}, B2, {logo: 'logo.png'})), []);
      eq(errs(Object.assign({}, B2, {logo: 'https://exempel.se/logo.png'})), []);
      ok(errs(Object.assign({}, B2, {logo: 'javascript:alert(1)'})).some(x => x.includes('logo')));
    });
    test('an own SVG icon may not contain scripts, events or links', () => {
      eq(errs(Object.assign({}, B2, {customerTypes: [{id: 'a', label: 'A', color: '#111111', svg: '<circle cx="8" cy="8" r="4" fill="currentColor"/>'}]})), []);
      for (const bad of ['<script>alert(1)</script>', '<circle onload="x()"/>', '<a href="https://x.se"><circle/></a>']) {
        ok(errs(Object.assign({}, B2, {customerTypes: [{id: 'a', label: 'A', color: '#111111', svg: bad}]})).some(x => x.includes('svg')), bad);
      }
    });
    test('the SVG check is a whitelist: events behind a slash, unknown elements and url()/javascript are stopped', () => {
      const svgErr = svg => errs(Object.assign({}, B2, {customerTypes: [{id: 'a', label: 'A', color: '#111111', svg}]})).some(x => x.includes('svg'));
      for (const bad of ['<circle/onload="x()"/>', '<animate/onbegin=alert(1) attributeName=x dur=1s/>', '<image href="x.png"/>', '<use xlink:href="#a"/>',
        '<path d="M0 0" fill="url(javascript:x)"/>', '<style>circle{fill:red}</style>', '<svg><circle/></svg>', '<circle r="4"></circle><foreignObject/>']) ok(svgErr(bad), bad);
      for (const good of ['<path d="M2 3h11v7H2z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>',
        '<g transform="translate(1 1)"><rect x="1" y="2" width="10" height="9" rx="2" fill="none" stroke="currentColor"/><line x1="1" y1="5" x2="11" y2="5" stroke="currentColor"/></g>']) ok(!svgErr(good), good);
    });
    test('setBrand refuses a broken brand and keeps the previous one', () => withBrand(B2, () => {
      let msg = '';
      try { L.setBrand({colors: B2.colors}); } catch (e) { msg = e.message; }
      includes(msg, 'company.name');
      eq(L.getBrand().company.name, 'Andra AB');
    }));
  });

  describe('Brand: fonts and the sender hint', () => {
    test('font names are cleaned and system-ui means no font of its own', () => {
      eq(L.brandFonts({display: 'Inter', body: 'system-ui', googleFonts: true}), {display: 'Inter', body: '', google: true});
      eq(L.brandFonts({display: 'Evil"};x{', body: 'Open Sans'}), {display: 'Evilx', body: 'Open Sans', google: false});
      eq(L.brandFonts({}), {display: '', body: '', google: false});
    });
    test('the Google Fonts address is built from unique names, and only when googleFonts is set', () => {
      eq(L.googleFontsUrl({display: 'Open Sans', body: 'Open Sans', google: true}), 'https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;500;600;700&display=swap');
      eq(L.googleFontsUrl({display: 'A', body: 'B', google: true}), 'https://fonts.googleapis.com/css2?family=A:wght@400;500;600;700&family=B:wght@400;500;600;700&display=swap');
      eq(L.googleFontsUrl({display: 'A', body: '', google: false}), '');
      eq(L.googleFontsUrl({display: '', body: '', google: true}), '');
    });
    test('the sender hint names customer types with a sender other than the default', () => withBrand(Object.assign({}, B2, {senders: [{id: 's1', signature: []}, {id: 's2', company: 'Andra varumärket', signature: []}]}), () =>
      eq(L.senderHint(), 'B ger avsändaren Andra varumärket i mailsignaturen.')));
    test('no sender hint when all types use the default sender', () => withBrand(null, () => eq(L.senderHint(), '')));
  });

  describe('Brand: colours', () => {
    const KEYS = ['bg', 'surface', 'sunk', 'ink', 'text', 'muted', 'line', 'accent', 'accent-hover', 'accent-ink', 'brand-soft', 'focus'];
    const base = {accent: '#0f766e', ink: '#1f2933', bg: '#f6f7f7'};
    test('all colours for light and dark mode are worked out as #rrggbb', () => {
      const d = L.deriveColors(base);
      for (const mode of ['light', 'dark']) for (const k of KEYS) ok(HEX.test(d[mode][k]), `${mode}.${k} = ${d[mode][k]}`);
      ok(typeof d.light.shadow === 'string' && typeof d.dark.shadow === 'string', 'shadow');
    });
    test('the given colours are used as they are in light mode', () => {
      const d = L.deriveColors(base);
      eq([d.light.bg, d.light.ink, d.light.accent], ['#f6f7f7', '#1f2933', '#0f766e']);
    });
    test('dark mode has a dark background and light text', () => {
      const d = L.deriveColors(base);
      ok(L.contrastRatio(d.dark.bg, '#000000') < L.contrastRatio(d.light.bg, '#000000'), 'a darker background');
      ok(L.contrastRatio(d.dark.ink, d.dark.bg) >= 7, 'good contrast in dark mode');
    });
    test('the text on the accent colour is white or dark, whichever shows best', () => {
      eq(L.deriveColors(base).light['accent-ink'], '#ffffff');
      eq(L.deriveColors({accent: '#f5d000', ink: '#1f2933', bg: '#ffffff'}).light['accent-ink'], '#1f2933');
    });
    test('accentHover is used if it is given', () => eq(L.deriveColors(Object.assign({accentHover: '#0a5b55'}, base)).light['accent-hover'], '#0a5b55'));
    test('single colours can be overridden per mode', () => {
      const d = L.deriveColors(Object.assign({overrides: {light: {focus: '#123456'}, dark: {accent: '#abcdef'}}}, base));
      eq([d.light.focus, d.dark.accent], ['#123456', '#abcdef']);
    });
    test('too low contrast gives a warning, good colours give none', () => {
      eq(L.deriveColors(base).warnings, []);
      const w = L.deriveColors({accent: '#0f766e', ink: '#aaaaaa', bg: '#ffffff'}).warnings;
      ok(w.length > 0 && w.some(x => x.includes('text')), JSON.stringify(w));
    });
    test('text on the accent colour is checked against WCAG AA (4.5:1)', () => {
      const w = L.deriveColors({accent: '#e07a3a', ink: '#1f2933', bg: '#ffffff', overrides: {light: {'accent-ink': '#ffffff'}}}).warnings;
      ok(w.some(x => x.includes('accentfärgen')), JSON.stringify(w));
    });
    test('dark mode picks an accent colour where the text on the button passes 4.5:1', () => {
      for (const accent of ['#0f766e', '#c2410c', '#7c3aed', '#1d4ed8']) {
        const d = L.deriveColors({accent, ink: '#1f2933', bg: '#f6f7f7'}).dark;
        ok(L.contrastRatio(d['accent-ink'], d.accent) >= 4.5, `${accent}: ${L.contrastRatio(d['accent-ink'], d.accent).toFixed(2)}`);
      }
    });
    test('body text and muted text are checked too', () => {
      const w = L.deriveColors({accent: '#0f766e', ink: '#1f2933', bg: '#f6f7f7', overrides: {light: {muted: '#c0c0c0'}}}).warnings;
      ok(w.some(x => x.includes('dämpad')), JSON.stringify(w));
    });
    test('an invalid colour gives an error that names the field', () => {
      let msg = '';
      try { L.deriveColors({accent: 'blå', ink: '#000000', bg: '#ffffff'}); } catch (e) { msg = e.message; }
      includes(msg, 'accent');
    });
    test('contrastRatio: black on white is 21, the same colour is 1', () => {
      eq(Math.round(L.contrastRatio('#000000', '#ffffff')), 21);
      eq(L.contrastRatio('#123456', '#123456'), 1);
    });
  });

  describe('Brand: language', () => {
    const base = {company: {name: 'X'}, colors: {accent: '#0f766e', ink: '#1f2933', bg: '#f6f7f7'}, senders: [{id: 's', signature: ['X']}], defaultSender: 's', customerTypes: []};
    test('language is optional', () => eq(L.validateBrand(base).filter(e => /language/.test(e)), []));
    test('a language code of two lower-case letters is accepted', () => eq(L.validateBrand({...base, language: 'en'}).filter(e => /language/.test(e)), []));
    test('anything else gives an error that names language', () => {
      ok(L.validateBrand({...base, language: 'Svenska'}).some(e => /language/.test(e)), 'Svenska');
      ok(L.validateBrand({...base, language: 5}).some(e => /language/.test(e)), '5');
    });
  });
})();
