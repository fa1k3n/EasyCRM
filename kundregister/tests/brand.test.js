/* Enhetstester för varumärket: standardvarumärke, kundtyper, avsändare och färger från konfiguration.
 * Varje test som byter varumärke återställer testvarumärket efteråt, så att testerna inte påverkar varandra. */
(function () {
  const L = window.CRMLogic;
  const withBrand = (brand, fn) => { L.setBrand(brand); try { fn(); } finally { L.setBrand(window.TEST_BRAND); } };
  const B2 = {
    company: {name: 'Andra AB'},
    colors: {accent: '#0f766e', ink: '#1f2933', bg: '#f6f7f7'},
    senders: [{id: 's1', signature: ['Ett', 'Två']}, {id: 's2', signature: ['Tre']}],
    defaultSender: 's1',
    customerTypes: [{id: 'a', label: 'A', color: '#111111'}, {id: 'b', label: 'B', color: '#222222', sender: 's2'}, {id: 'c', label: 'C', color: '#333333', sender: 'finns-inte'}],
    legacyTypes: {gammal: ['b']},
    legacyWrite: [{type: 'x', ifAny: ['a']}],
    legacyDefault: 'y'
  };
  const HEX = /^#[0-9a-f]{6}$/;

  describe('Varumärke: standard och byte', () => {
    test('utan varumärke används exempelföretaget Exempelstudion AB', () => withBrand(null, () => {
      eq(L.getBrand().company.name, 'Exempelstudion AB');
      eq(Object.keys(L.SERVICE_TYPES), ['konsultation', 'projekt', 'event']);
    }));
    test('exempelföretaget har bara påhittade kontaktuppgifter (nollor som telefon, adresser på .example)', () => withBrand(null, () => {
      for (const s of L.getBrand().senders) {
        const text = [s.phone, s.email, s.web, ...s.signature].filter(Boolean).join(' · ');
        ok(!/[1-9]/.test(text), `bara nollor som siffror: ${text}`);
        for (const host of text.match(/[\w-]+(\.[\w-]+)+/g) || []) ok(host.endsWith('.example'), `påhittad adress: ${host}`);
      }
    }));
    test('SERVICE_TYPES speglar varumärkets kundtyper', () => withBrand(B2, () => eq(L.SERVICE_TYPES, {a: 'A', b: 'B', c: 'C'})));
  });

  describe('Varumärke: kundtyper', () => {
    test('typerna följer varumärkets ordning, utan dubbletter och okända värden', () => withBrand(B2, () => eq(L.customerTypes({types: ['b', 'x', 'a', 'b']}), ['a', 'b'])));
    test('gamla type-värden översätts med varumärkets legacyTypes', () => withBrand(B2, () => {
      eq(L.customerTypes({type: 'gammal'}), ['b']);
      eq(L.customerTypes({type: 'okand'}), []);
    }));
    test('utan legacyTypes ger gamla type-värden inga typer', () => withBrand(null, () => eq(L.customerTypes({type: 'headshot'}), [])));
    test('legacyType följer varumärkets regler och standardvärde', () => withBrand(B2, () => {
      eq(L.legacyType({types: ['a']}), 'x');
      eq(L.legacyType({types: ['b']}), 'y');
    }));
    test('utan legacyWrite skrivs inget gammalt typvärde', () => withBrand(null, () => eq(L.legacyType({types: ['projekt']}), undefined)));
    test('filtret på kundtyp använder varumärkets typer', () => withBrand(B2, () => {
      const list = [{id: '1', types: ['a']}, {id: '2', types: ['b']}, {id: '3', type: 'gammal'}];
      eq(L.filterCustomers(list, {seg: 'alla', type: 'b', q: '', sort: 'namn'}).map(c => c.id).sort(), ['2', '3']);
    }));
    test('typeColors ger ljus och mörk färg per typ', () => withBrand(B2, () => {
      const t = L.typeColors();
      eq(Object.keys(t), ['a', 'b', 'c']);
      eq(t.a.light, '#111111');
      ok(HEX.test(t.a.dark) && t.a.dark !== t.a.light, 'mörk färg räknas fram');
    }));
    test('colorDark används om den anges', () => withBrand(Object.assign({}, B2, {customerTypes: [{id: 'a', label: 'A', color: '#111111', colorDark: '#eeeeee'}]}), () => eq(L.typeColors().a.dark, '#eeeeee')));
  });

  describe('Varumärke: avsändare', () => {
    test('kundtypens avsändare används, i varumärkets typordning', () => withBrand(B2, () => {
      eq(L.senderFor({types: ['b', 'a']}).id, 's2');
      eq(L.senderFor({types: ['a']}).id, 's1');
      eq(L.senderFor({}).id, 's1');
    }));
    test('en okänd avsändare i en kundtyp faller tillbaka på standardavsändaren', () => withBrand(B2, () => eq(L.senderFor({types: ['c']}).id, 's1')));
    test('signaturen är avsändarens rader', () => withBrand(B2, () => {
      eq(L.signature({types: ['a']}), 'Ett\nTvå');
      eq(L.signature({types: ['b']}), 'Tre');
    }));
  });

  describe('Varumärke: kontroll av brand.json', () => {
    const errs = b => L.validateBrand(b);
    test('ett komplett varumärke har inga fel, inte heller exempelföretaget', () => { eq(errs(B2), []); eq(errs(L.EXAMPLE_BRAND), []); });
    test('saknade obligatoriska fält namnges', () => {
      const e = errs({colors: B2.colors});
      for (const f of ['company.name', 'senders', 'defaultSender', 'customerTypes']) ok(e.some(x => x.includes(f)), `${f}: ${JSON.stringify(e)}`);
    });
    test('en ogiltig färg namnges', () => ok(errs(Object.assign({}, B2, {colors: {accent: 'blå', ink: '#000000', bg: '#ffffff'}})).some(x => x.includes('colors.accent'))));
    test('defaultSender måste finnas bland avsändarna', () => ok(errs(Object.assign({}, B2, {defaultSender: 'saknas'})).some(x => x.includes('defaultSender'))));
    test('kundtyp-id måste vara unika och bara innehålla a–z, 0–9, - och _', () => {
      const e = errs(Object.assign({}, B2, {customerTypes: [{id: 'a', label: 'A', color: '#111111'}, {id: 'a', label: 'A2', color: '#111111'}, {id: 'ö"x', label: 'X', color: '#111111'}]}));
      ok(e.some(x => x.includes('unik')) && e.some(x => x.includes('ö"x')), JSON.stringify(e));
    });
    test('loggan måste vara ett filnamn eller en https-adress', () => {
      eq(errs(Object.assign({}, B2, {logo: 'logo.png'})), []);
      eq(errs(Object.assign({}, B2, {logo: 'https://exempel.se/logo.png'})), []);
      ok(errs(Object.assign({}, B2, {logo: 'javascript:alert(1)'})).some(x => x.includes('logo')));
    });
    test('en egen SVG-ikon får inte innehålla skript, händelser eller länkar', () => {
      eq(errs(Object.assign({}, B2, {customerTypes: [{id: 'a', label: 'A', color: '#111111', svg: '<circle cx="8" cy="8" r="4" fill="currentColor"/>'}]})), []);
      for (const bad of ['<script>alert(1)</script>', '<circle onload="x()"/>', '<a href="https://x.se"><circle/></a>']) {
        ok(errs(Object.assign({}, B2, {customerTypes: [{id: 'a', label: 'A', color: '#111111', svg: bad}]})).some(x => x.includes('svg')), bad);
      }
    });
    test('SVG-spärren är en vitlista: händelser bakom snedstreck, okända element och url()/javascript stoppas', () => {
      const svgErr = svg => errs(Object.assign({}, B2, {customerTypes: [{id: 'a', label: 'A', color: '#111111', svg}]})).some(x => x.includes('svg'));
      for (const bad of ['<circle/onload="x()"/>', '<animate/onbegin=alert(1) attributeName=x dur=1s/>', '<image href="x.png"/>', '<use xlink:href="#a"/>',
        '<path d="M0 0" fill="url(javascript:x)"/>', '<style>circle{fill:red}</style>', '<svg><circle/></svg>', '<circle r="4"></circle><foreignObject/>']) ok(svgErr(bad), bad);
      for (const good of ['<path d="M2 3h11v7H2z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>',
        '<g transform="translate(1 1)"><rect x="1" y="2" width="10" height="9" rx="2" fill="none" stroke="currentColor"/><line x1="1" y1="5" x2="11" y2="5" stroke="currentColor"/></g>']) ok(!svgErr(good), good);
    });
    test('setBrand vägrar ett trasigt varumärke och behåller det tidigare', () => withBrand(B2, () => {
      let msg = '';
      try { L.setBrand({colors: B2.colors}); } catch (e) { msg = e.message; }
      includes(msg, 'company.name');
      eq(L.getBrand().company.name, 'Andra AB');
    }));
  });

  describe('Varumärke: typsnitt och avsändartips', () => {
    test('typsnittsnamn tvättas och system-ui betyder inget eget typsnitt', () => {
      eq(L.brandFonts({display: 'Inter', body: 'system-ui', googleFonts: true}), {display: 'Inter', body: '', google: true});
      eq(L.brandFonts({display: 'Evil"};x{', body: 'Open Sans'}), {display: 'Evilx', body: 'Open Sans', google: false});
      eq(L.brandFonts({}), {display: '', body: '', google: false});
    });
    test('Google Fonts-adressen byggs av unika namn, och bara när googleFonts är satt', () => {
      eq(L.googleFontsUrl({display: 'Open Sans', body: 'Open Sans', google: true}), 'https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;500;600;700&display=swap');
      eq(L.googleFontsUrl({display: 'A', body: 'B', google: true}), 'https://fonts.googleapis.com/css2?family=A:wght@400;500;600;700&family=B:wght@400;500;600;700&display=swap');
      eq(L.googleFontsUrl({display: 'A', body: '', google: false}), '');
      eq(L.googleFontsUrl({display: '', body: '', google: true}), '');
    });
    test('avsändartipset nämner kundtyper med annan avsändare än standard', () => withBrand(Object.assign({}, B2, {senders: [{id: 's1', signature: []}, {id: 's2', company: 'Andra varumärket', signature: []}]}), () =>
      eq(L.senderHint(), 'B ger avsändaren Andra varumärket i mailsignaturen.')));
    test('inget avsändartips när alla typer använder standardavsändaren', () => withBrand(null, () => eq(L.senderHint(), '')));
  });

  describe('Varumärke: färger', () => {
    const KEYS = ['bg', 'surface', 'sunk', 'ink', 'text', 'muted', 'line', 'accent', 'accent-hover', 'accent-ink', 'brand-soft', 'focus'];
    const base = {accent: '#0f766e', ink: '#1f2933', bg: '#f6f7f7'};
    test('alla färger för ljust och mörkt läge räknas fram som #rrggbb', () => {
      const d = L.deriveColors(base);
      for (const mode of ['light', 'dark']) for (const k of KEYS) ok(HEX.test(d[mode][k]), `${mode}.${k} = ${d[mode][k]}`);
      ok(typeof d.light.shadow === 'string' && typeof d.dark.shadow === 'string', 'skugga');
    });
    test('de angivna färgerna används som de är i ljust läge', () => {
      const d = L.deriveColors(base);
      eq([d.light.bg, d.light.ink, d.light.accent], ['#f6f7f7', '#1f2933', '#0f766e']);
    });
    test('mörkt läge har mörk bakgrund och ljus text', () => {
      const d = L.deriveColors(base);
      ok(L.contrastRatio(d.dark.bg, '#000000') < L.contrastRatio(d.light.bg, '#000000'), 'mörkare bakgrund');
      ok(L.contrastRatio(d.dark.ink, d.dark.bg) >= 7, 'god kontrast i mörkt läge');
    });
    test('texten på accentfärgen blir vit eller mörk beroende på vad som syns bäst', () => {
      eq(L.deriveColors(base).light['accent-ink'], '#ffffff');
      eq(L.deriveColors({accent: '#f5d000', ink: '#1f2933', bg: '#ffffff'}).light['accent-ink'], '#1f2933');
    });
    test('accentHover används om den anges', () => eq(L.deriveColors(Object.assign({accentHover: '#0a5b55'}, base)).light['accent-hover'], '#0a5b55'));
    test('enskilda färger kan skrivas över per läge', () => {
      const d = L.deriveColors(Object.assign({overrides: {light: {focus: '#123456'}, dark: {accent: '#abcdef'}}}, base));
      eq([d.light.focus, d.dark.accent], ['#123456', '#abcdef']);
    });
    test('för låg kontrast ger en varning, bra färger ger ingen', () => {
      eq(L.deriveColors(base).warnings, []);
      const w = L.deriveColors({accent: '#0f766e', ink: '#aaaaaa', bg: '#ffffff'}).warnings;
      ok(w.length > 0 && w.some(x => x.includes('text')), JSON.stringify(w));
    });
    test('text på accentfärgen kontrolleras mot WCAG AA (4.5:1)', () => {
      const w = L.deriveColors({accent: '#e07a3a', ink: '#1f2933', bg: '#ffffff', overrides: {light: {'accent-ink': '#ffffff'}}}).warnings;
      ok(w.some(x => x.includes('accentfärgen')), JSON.stringify(w));
    });
    test('mörkt läge väljer en accentfärg där texten på knappen klarar 4.5:1', () => {
      for (const accent of ['#0f766e', '#c2410c', '#7c3aed', '#1d4ed8']) {
        const d = L.deriveColors({accent, ink: '#1f2933', bg: '#f6f7f7'}).dark;
        ok(L.contrastRatio(d['accent-ink'], d.accent) >= 4.5, `${accent}: ${L.contrastRatio(d['accent-ink'], d.accent).toFixed(2)}`);
      }
    });
    test('brödtext och dämpad text kontrolleras också', () => {
      const w = L.deriveColors({accent: '#0f766e', ink: '#1f2933', bg: '#f6f7f7', overrides: {light: {muted: '#c0c0c0'}}}).warnings;
      ok(w.some(x => x.includes('dämpad')), JSON.stringify(w));
    });
    test('en ogiltig färg ger ett fel som namnger fältet', () => {
      let msg = '';
      try { L.deriveColors({accent: 'blå', ink: '#000000', bg: '#ffffff'}); } catch (e) { msg = e.message; }
      includes(msg, 'accent');
    });
    test('contrastRatio: svart mot vitt är 21, samma färg är 1', () => {
      eq(Math.round(L.contrastRatio('#000000', '#ffffff')), 21);
      eq(L.contrastRatio('#123456', '#123456'), 1);
    });
  });
})();
