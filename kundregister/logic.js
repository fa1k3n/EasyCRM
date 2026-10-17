"use strict";
/* Kundregister – ren logik utan DOM och databas.
 * Används av index.html (window.CRMLogic) och av enhetstesterna i tests/.
 * Klockan går att byta ut med setClock() så att testerna får ett fast "idag".
 * Källkoden är logic.ts. logic.js byggs från den med tools\tsc.ps1 (körs av run-tests.ps1) – ändra aldrig logic.js för hand. */
(function (root, factory) {
    if (typeof module === 'object' && module.exports)
        module.exports = factory();
    else
        root.CRMLogic = factory();
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';
    /* ---------- Varumärke: företagsnamn, färger, avsändare och kundtyper kommer från brand.json ---------- */
    // Standardvarumärket när inget annat är satt. Påhittat exempelföretag – inget här får komma från ett riktigt företag.
    const EXAMPLE_BRAND = {
        company: { name: 'Exempelstudion AB' },
        logo: 'logo.svg',
        colors: { accent: '#0f766e', ink: '#1f2933', bg: '#f6f7f7' },
        fonts: { display: 'system-ui', body: 'system-ui' },
        senders: [{ id: 'standard', name: 'Förnamn Efternamn', company: 'Exempelstudion AB', phone: '000-000 00 00', web: 'www.exempelstudion.example',
                signature: ['Förnamn Efternamn', 'Exempelstudion AB', '000-000 00 00 · www.exempelstudion.example'] }],
        defaultSender: 'standard',
        customerTypes: [
            { id: 'konsultation', label: 'Konsultation', color: '#0f766e', icon: 'pratbubbla' },
            { id: 'projekt', label: 'Projekt', color: '#7c3aed', icon: 'portfolj' },
            { id: 'event', label: 'Event', color: '#b45309', icon: 'stjarna' }
        ]
    };
    let brand = EXAMPLE_BRAND;
    // En kundtyps egen SVG-ikon sätts in som HTML, så bara enkla ritelement och ritattribut släpps igenom (vitlista).
    // Händelser (on…), länkar, bilder, stilar, skript och url()/javascript: stoppas oavsett hur de skrivs.
    const SVG_ELEMENTS = ['path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'ellipse', 'g'];
    const SVG_ATTRS = ['d', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'width', 'height', 'points', 'fill', 'stroke', 'stroke-width',
        'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray', 'fill-rule', 'clip-rule', 'transform', 'opacity', 'fill-opacity', 'stroke-opacity'];
    function unsafeSvg(svg) {
        if (/javascript:|url\s*\(|&#|\\/i.test(svg))
            return 'får inte innehålla url(), javascript: eller teckenkoder';
        const withoutTags = svg.replace(/<[^>]*>/g, '');
        if (/[<>]/.test(withoutTags) || withoutTags.trim())
            return 'får bara innehålla SVG-element, ingen text';
        for (const m of svg.matchAll(/<\s*\/?\s*([^\s/>]+)([^>]*)>/g)) {
            const el = m[1].toLowerCase();
            if (!SVG_ELEMENTS.includes(el))
                return `elementet <${m[1]}> är inte tillåtet (tillåtna: ${SVG_ELEMENTS.join(', ')})`;
            // Alla attributnamn, även de som skiljs åt med / i stället för mellanslag
            for (const a of m[2].matchAll(/([^\s=/"']+)\s*(=\s*("[^"]*"|'[^']*'|[^\s/>]+))?/g)) {
                if (!SVG_ATTRS.includes(a[1].toLowerCase()))
                    return `attributet ${a[1]} är inte tillåtet`;
            }
        }
        return '';
    }
    // Kontrollerar ett varumärke (brand.json) och returnerar felen på svenska; tom lista = giltigt
    function validateBrand(b) {
        const e = [], x = (b || {});
        if (!x.company || !x.company.name)
            e.push('company.name saknas (företagets namn)');
        if (!x.colors)
            e.push('colors saknas');
        else {
            try {
                deriveColors(x.colors);
            }
            catch (err) {
                e.push(err.message);
            }
        }
        if (x.logo && !/^[\w.-]+\.(png|svg|jpe?g|webp)$/i.test(x.logo) && !/^https:\/\/[^\s"'<>]+$/i.test(x.logo))
            e.push(`logo måste vara ett filnamn (t.ex. logo.png) eller en https-adress: "${x.logo}"`);
        if (!Array.isArray(x.senders) || !x.senders.length)
            e.push('senders saknas (minst en avsändare)');
        else
            x.senders.forEach((s, i) => { if (!s.id)
                e.push(`senders[${i}].id saknas`); if (!Array.isArray(s.signature))
                e.push(`senders[${i}].signature saknas (lista med rader)`); });
        if (!x.defaultSender)
            e.push('defaultSender saknas');
        else if (Array.isArray(x.senders) && !x.senders.some(s => s.id === x.defaultSender))
            e.push(`defaultSender "${x.defaultSender}" finns inte bland senders`);
        if (!Array.isArray(x.customerTypes))
            e.push('customerTypes saknas (lista, får vara tom)');
        else {
            const seen = new Set();
            x.customerTypes.forEach((t, i) => {
                if (!/^[a-z0-9_-]+$/.test(t.id || ''))
                    e.push(`customerTypes[${i}].id "${t.id}" får bara innehålla a–z, 0–9, - och _`);
                else if (seen.has(t.id))
                    e.push(`customerTypes: id "${t.id}" är inte unikt`);
                seen.add(t.id);
                if (!t.label)
                    e.push(`customerTypes[${i}].label saknas`);
                try {
                    hex(t.color, `customerTypes[${i}].color`);
                    if (t.colorDark)
                        hex(t.colorDark, `customerTypes[${i}].colorDark`);
                }
                catch (err) {
                    e.push(err.message);
                }
                const svgErr = t.svg ? unsafeSvg(t.svg) : '';
                if (svgErr)
                    e.push(`customerTypes[${i}].svg: ${svgErr}`);
            });
        }
        return e;
    }
    // Byter varumärke; null ger exempelföretaget. Ett trasigt varumärke vägras med ett fel, och det tidigare behålls.
    const setBrand = (b) => {
        if (!b) {
            brand = EXAMPLE_BRAND;
            return;
        }
        const errors = validateBrand(b);
        if (errors.length)
            throw new Error('Varumärket är felaktigt: ' + errors.join('; '));
        brand = b;
    };
    const getBrand = () => brand;
    // {id: namn} för varumärkets kundtyper, i varumärkets ordning
    const serviceTypes = () => Object.fromEntries(brand.customerTypes.map(t => [t.id, t.label]));
    // Kundtyper (flera per kund). Gamla kunder utan types översätts från fältet type via varumärkets legacyTypes.
    function customerTypes(c) {
        const src = Array.isArray(c.types) ? c.types : ((brand.legacyTypes || {})[c.type] || []);
        return brand.customerTypes.map(t => t.id).filter(id => src.includes(id));
    }
    // Gammalt typvärde för agenter som fortfarande läser fältet type; bara om varumärket har regler för det
    function legacyType(c) {
        if (!brand.legacyWrite)
            return undefined;
        const t = customerTypes(c);
        for (const r of brand.legacyWrite)
            if (r.ifAny.includes('*') ? t.length > 0 : r.ifAny.some(x => t.includes(x)))
                return r.type;
        return brand.legacyDefault;
    }
    // Avsändaren för en kund: den första av kundens typer (i varumärkets ordning) som har en giltig avsändare, annars standard
    function senderFor(c) {
        const byId = (id) => brand.senders.find(s => s.id === id);
        for (const id of customerTypes(c)) {
            const s = byId(brand.customerTypes.find(t => t.id === id)?.sender);
            if (s)
                return s;
        }
        return byId(brand.defaultSender) || brand.senders[0];
    }
    // Tips i kundformuläret om kundtyper som ger en annan avsändare än standard
    const senderHint = () => brand.customerTypes.map(t => {
        const s = brand.senders.find(x => x.id === t.sender);
        return s && s.id !== brand.defaultSender ? `${t.label} ger avsändaren ${s.company || s.name || s.id} i mailsignaturen.` : '';
    }).filter(Boolean).join(' ');
    const brandFonts = (f = {}) => {
        const clean = (n) => n && !/^system-ui$/i.test(n) ? String(n).replace(/[^\w\s-]/g, '') : '';
        return { display: clean(f.display), body: clean(f.body), google: !!f.googleFonts };
    };
    const googleFontsUrl = (f) => {
        const families = [...new Set([f.display, f.body].filter(Boolean))];
        return f.google && families.length ? 'https://fonts.googleapis.com/css2?' + families.map(n => 'family=' + encodeURIComponent(n).replace(/%20/g, '+') + ':wght@400;500;600;700').join('&') + '&display=swap' : '';
    };
    // Ljus och mörk färg per kundtyp; den mörka räknas fram om den inte anges
    const typeColors = () => Object.fromEntries(brand.customerTypes.map(t => [t.id, { light: hex(t.color, `kundtyp ${t.id}`), dark: t.colorDark ? hex(t.colorDark, `kundtyp ${t.id}`) : mix(t.color, '#ffffff', 0.35) }]));
    /* ---------- Färger: hela paletten för ljust och mörkt läge räknas fram från 3–4 färger ---------- */
    function rgb(c, field) {
        const m = /^#([0-9a-f]{6})$/i.exec(String(c || '').trim());
        if (!m)
            throw new Error(`Ogiltig färg i ${field}: "${c}" (ange #rrggbb)`);
        const n = parseInt(m[1], 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    const hex = (c, field) => '#' + rgb(c, field).map(v => v.toString(16).padStart(2, '0')).join('');
    const mix = (a, b, t) => {
        const x = rgb(a, 'färg'), y = rgb(b, 'färg');
        return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('');
    };
    const luminance = (c) => {
        const [r, g, b] = rgb(c, 'färg').map(v => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    // Kontrastförhållande enligt WCAG: 1 (ingen) till 21 (svart mot vitt)
    const contrastRatio = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
    const bestOn = (bg, options) => options.reduce((best, o) => contrastRatio(o, bg) > contrastRatio(best, bg) ? o : best);
    const MIN_TEXT = 4.5;
    function deriveColors(colors) {
        const accent = hex(colors.accent, 'colors.accent'), ink = hex(colors.ink, 'colors.ink'), bg = hex(colors.bg, 'colors.bg');
        const hover = colors.accentHover ? hex(colors.accentHover, 'colors.accentHover') : mix(accent, '#000000', 0.16);
        const [ir, ig, ib] = rgb(ink, 'colors.ink');
        const light = {
            bg, surface: '#ffffff', sunk: mix(bg, ink, 0.08), ink, text: mix(ink, bg, 0.22), muted: mix(ink, bg, 0.32), line: mix(bg, ink, 0.13),
            accent, 'accent-hover': hover, 'accent-ink': bestOn(accent, ['#ffffff', ink]), 'brand-soft': mix(bg, accent, 0.18), focus: accent,
            shadow: `0 1px 2px rgba(${ir},${ig},${ib},.05),0 10px 28px rgba(${ir},${ig},${ib},.08)`
        };
        const dbg = mix(ink, '#000000', 0.35), dink = mix(bg, '#ffffff', 0.6);
        // Mörkt läge: accentfärgen ljusas upp så lite som möjligt men tills texten på den (vit eller mörk) klarar WCAG AA
        let daccent = mix(accent, '#ffffff', 0.18);
        for (let t = 0.18; t <= 0.7 && contrastRatio(bestOn(daccent, ['#ffffff', dbg]), daccent) < MIN_TEXT; t += 0.04)
            daccent = mix(accent, '#ffffff', t);
        const dark = {
            bg: dbg, surface: mix(dbg, '#ffffff', 0.05), sunk: mix(dbg, '#ffffff', 0.09), ink: dink, text: mix(dink, dbg, 0.18), muted: mix(dink, dbg, 0.38),
            line: mix(dbg, '#ffffff', 0.12), accent: daccent, 'accent-hover': mix(accent, '#ffffff', 0.3), 'accent-ink': bestOn(daccent, ['#ffffff', dbg]),
            'brand-soft': mix(dbg, accent, 0.22), focus: daccent, shadow: '0 1px 2px rgba(0,0,0,.3),0 10px 28px rgba(0,0,0,.35)'
        };
        for (const [mode, target] of [['light', light], ['dark', dark]]) {
            const o = (colors.overrides || {})[mode] || {};
            for (const k of Object.keys(o))
                target[k] = k === 'shadow' ? o[k] : hex(o[k], `colors.overrides.${mode}.${k}`);
        }
        const warnings = [];
        // WCAG AA för vanlig text (4.5:1): huvudtext, brödtext, dämpad text och text på accentfärgen (knappar, etiketter)
        const checks = [['huvudtexten (ink)', 'ink', 'bg'], ['brödtexten (text)', 'text', 'bg'], ['den dämpade texten (muted)', 'muted', 'bg'], ['texten på accentfärgen (accent-ink)', 'accent-ink', 'accent']];
        for (const [name, p] of [['ljust läge', light], ['mörkt läge', dark]]) {
            for (const [label, fg, back] of checks) {
                const c = contrastRatio(p[fg], p[back]);
                if (c < MIN_TEXT)
                    warnings.push(`${name}: ${label} har för låg kontrast mot ${back === 'bg' ? 'bakgrunden' : 'accentfärgen'} (${c.toFixed(1)}:1, minst ${MIN_TEXT}:1)`);
            }
        }
        return { light, dark, warnings };
    }
    const KINDS = { mail_ut: 'Mail skickat', mail_in: 'Mail mottaget', samtal: 'Samtal', mote: 'Möte', ovrigt: 'Övrigt' };
    const LIMIT = 90, WARN = 60;
    const INV_STATUS = { published: 'Skickad', paid: 'Betald', overPaid: 'Överbetald', underPaid: 'Delbetald', overdue: 'Förfallen', credited: 'Krediterad', credit: 'Kreditnota' };
    const MONTHS = ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti', 'september', 'oktober', 'november', 'december'];
    /* ---------- Tid ---------- */
    let clock = () => new Date();
    const setClock = (fn) => { clock = fn || (() => new Date()); };
    const pad = (n) => String(n).padStart(2, '0');
    const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const todayISO = () => toISO(clock());
    const daysSince = (iso) => { const t = new Date(todayISO() + 'T00:00'); const d = new Date(iso + 'T00:00'); return Math.round((t.getTime() - d.getTime()) / 864e5); };
    const fmtDate = (iso) => { if (!iso)
        return ''; const [y, m, d] = iso.split('-'); return `${d}/${m} ${y}`; };
    const dayMonth = (iso) => { const [, m, d] = iso.split('-'); return `${+d} ${MONTHS[+m - 1]}`; };
    /* ---------- Text och länkar ---------- */
    const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const safeUrl = (u) => /^https?:\/\//i.test(u || '') ? u : (u && /^[\w.-]+\.[a-z]{2,}/i.test(u) ? 'https://' + u : null);
    const hostOf = (u) => { try {
        return new URL(u).hostname.replace(/^www\./, '');
    }
    catch {
        return 'Källa';
    } };
    /* ---------- Kontaktstatus ---------- */
    function lastTouch(c) {
        let d = null;
        const t = todayISO();
        for (const m of c.comms || [])
            if (m.date && m.date <= t && (!d || m.date > d))
                d = m.date;
        for (const j of c.jobs || [])
            if (j.date && j.date <= t && (!d || j.date > d))
                d = j.date;
        return d;
    }
    function status(c) {
        const d = lastTouch(c);
        if (!d)
            return { level: 'never', days: null, d };
        const days = daysSince(d);
        return { level: days >= LIMIT ? 'over' : days >= WARN ? 'warn' : 'ok', days, d };
    }
    const needsContact = (c) => { const l = status(c).level; return l === 'over' || l === 'never'; };
    function latestMail(c) {
        let best = null;
        for (const m of c.comms || [])
            if ((m.kind === 'mail_ut' || m.kind === 'mail_in') && (!best || m.date > best.date))
                best = m;
        return best;
    }
    function daysLabel(st) {
        if (st.level === 'never')
            return 'Ej kontaktad';
        if (st.days === 0)
            return 'Idag';
        return st.days + ' d sedan';
    }
    /* ---------- Event ---------- */
    const byDate = (a, b) => (a.date || '').localeCompare(b.date || '');
    const upcomingEvents = (c) => (c.events || []).filter(e => !e.dismissed && (e.endDate || e.date) >= todayISO()).sort(byDate);
    // Ett event är hanterat när erbjudande skickats (offeredAt) eller det dolts (dismissed)
    const openEvents = (c) => c.status === 'potentiell' ? [] : upcomingEvents(c).filter(e => !e.offeredAt);
    const hasEvent = (c) => openEvents(c).length > 0;
    const hiddenEvents = (c) => (c.events || []).filter(e => e.dismissed && (e.endDate || e.date) >= todayISO()).sort(byDate);
    const isNewEvent = (e) => !!e.foundAt && daysSince(String(e.foundAt).slice(0, 10)) <= 7;
    const daysUntil = (iso) => -daysSince(iso);
    const SOON_DAYS = 14, EVENT_FOLLOWUP_WINDOW = 30, EVENT_FOLLOWUP_AFTER = 3;
    // Nästa event visas i kundlistan oavsett om erbjudande redan skickats
    const nextEvent = (c) => upcomingEvents(c)[0] || null;
    const eventSoon = (c) => { const e = nextEvent(c); return !!e && daysUntil(e.date) <= SOON_DAYS; };
    const eventEnd = (e) => e.endDate || e.date;
    // Etikett i kundlistan: ohanterade event ("att erbjuda", med antal) går före "snart"
    function eventBadge(c) {
        if (c.status === 'potentiell')
            return null;
        const open = openEvents(c).length;
        if (open)
            return { kind: 'offer', count: open };
        return eventSoon(c) ? { kind: 'soon', count: 0 } : null;
    }
    // Avslutade event inom 30 dagar där uppföljningsmail inte skickats, senast avslutade först
    const eventsToFollowUp = (c) => c.status === 'potentiell' ? [] : (c.events || [])
        .filter(e => !e.dismissed && !e.followUpSentAt && e.date && eventEnd(e) < todayISO() && daysSince(eventEnd(e)) <= EVENT_FOLLOWUP_WINDOW)
        .sort((a, b) => eventEnd(b).localeCompare(eventEnd(a)));
    /* ---------- Mail: signatur, mailtillägg och loggning utan tillägg ---------- */
    // Mailsignaturen kommer från kundens avsändare i varumärket
    const signature = (c) => senderFor(c).signature.join('\n');
    // Färdiga mailtexter är ett tillägg (window.CRM_MAIL) som laddas vid publicering om varumärket har ett; här kontrolleras att det är komplett.
    // Kontraktet (typerna) som tillägget byggs mot finns i mail-api.d.ts.
    function checkMailModule(m) {
        if (!m || typeof m !== 'object')
            return ['mailtillägget saknas eller är inte ett objekt'];
        const mod = m;
        return ['buildOffer', 'buildEventFollowUp'].filter(k => typeof mod[k] !== 'function').map(k => `mailtillägget saknar funktionen ${k}`);
    }
    // Ett tilläggs svar görs säkert att visa: ämne och text krävs, tags och hint är valfria och blir alltid text
    function normalizeMailText(o) {
        if (!o || typeof o !== 'object')
            throw new Error('mailtillägget gav inget svar');
        const r = o;
        for (const f of ['subject', 'body'])
            if (typeof r[f] !== 'string' || !r[f].trim())
                throw new Error(`mailtillägget gav ingen text i ${f}`);
        return { subject: String(r.subject), body: String(r.body), note: typeof r.note === 'string' ? r.note : '',
            tags: Array.isArray(r.tags) ? r.tags.map(t => String(t)) : [], hint: typeof r.hint === 'string' ? r.hint : '' };
    }
    // Det som sparas när ett mail (färdigt eller bara loggat) markeras som skickat: kontaktloggen, eventets markering och senaste kontakt
    function sentPatch(c, eventId, kind, m) {
        const comms = [...(c.comms || []), m];
        const field = kind === 'eventfu' ? 'followUpSentAt' : 'offeredAt';
        const events = (c.events || []).map(x => x.id === eventId ? { ...x, [field]: m.date } : x);
        return { comms, events, lastContact: lastTouch({ comms, jobs: c.jobs || [] }), lastMail: { date: m.date, subject: m.subject } };
    }
    // Utan mailtillägg loggas bara att ett erbjudande eller en uppföljning skickats, med eventets namn och datum
    function logOnlyEntry(e, kind) {
        const title = String(e.title || '').trim() || 'eventet', when = fmtDate(e.date);
        return kind === 'eventfu'
            ? { subject: `Uppföljning efter ${title}`, note: `Uppföljning efter ${title} (${when}) loggad som skickad.` }
            : { subject: `Erbjudande inför ${title}`, note: `Erbjudande inför ${title} (${when}) loggat som skickat.` };
    }
    // Det som redan är bokat under eventets dag(ar): bokningar hos alla kunder och händelser i Google Kalender
    function eventConflicts(e, customers, busy) {
        // Utan datum jämförs mot undefined, precis som i den ursprungliga JavaScript-koden
        const from = e.date, to = eventEnd(e), out = [], seenGcal = new Set();
        for (const c of customers || []) {
            const who = c.company || c.name || 'Namnlös';
            for (const b of c.bookings || []) {
                if (!b.date || b.date < from || b.date > to)
                    continue;
                if (b.gcalEventId && b.source === 'gcal')
                    seenGcal.add(b.gcalEventId);
                out.push({ date: b.date, time: b.time || '', title: `${BOOKING_KINDS[b.kind] || 'Möte'}: ${who}${b.title ? ' – ' + b.title : ''}`, source: 'bokning', customerId: c.id });
            }
        }
        for (const x of busy || []) {
            if (!x.date || x.date < from || x.date > to || (x.eventId && seenGcal.has(x.eventId)))
                continue;
            out.push({ date: x.date, time: x.time || '', title: x.title || 'Upptagen', source: 'kalender' });
        }
        return out.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    }
    /* ---------- Lista: filter och sortering ---------- */
    const contactScore = (c) => { const s = status(c); return s.level === 'over' ? 3e6 + s.days : s.level === 'never' ? 2e6 : s.level === 'warn' ? 1e6 + s.days : s.days; };
    function filterCustomers(customers, view) {
        const q = (view.q || '').trim().toLowerCase();
        const items = customers.filter(c => {
            if (view.type && view.type !== 'alla') {
                if (serviceTypes()[view.type] ? !customerTypes(c).includes(view.type) : c.type !== view.type)
                    return false;
            }
            if (view.seg === 'kontakta' && !needsContact(c))
                return false;
            if (view.seg === 'kunder' && c.status === 'potentiell')
                return false;
            if (view.seg === 'potentiella' && c.status !== 'potentiell')
                return false;
            if (view.seg === 'bokat' && !hasBooking(c))
                return false;
            if (q) {
                const hay = [c.company, c.name, c.email, c.phone, c.notes].join(' ').toLowerCase();
                if (!hay.includes(q))
                    return false;
            }
            return true;
        });
        const label = (c) => (c.company || c.name || '').toLowerCase();
        if (view.sort === 'namn')
            items.sort((a, b) => label(a).localeCompare(label(b), 'sv'));
        else if (view.sort === 'nyast')
            items.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
        else
            items.sort((a, b) => contactScore(b) - contactScore(a) || label(a).localeCompare(label(b), 'sv'));
        return items;
    }
    /* ---------- Bokningar och kalender ---------- */
    const BOOKING_KINDS = { jobb: 'Jobb', mote: 'Möte', samtal: 'Samtal' };
    // Räknar på kl. 12 lokal tid så att sommar-/vintertid aldrig flyttar datumet
    const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return toISO(d); };
    const bookingSortKey = (b) => (b.date || '') + ' ' + (b.time || '');
    const upcomingBookings = (c) => (c.bookings || []).filter(b => b.date && b.date >= todayISO()).sort((a, b) => bookingSortKey(a).localeCompare(bookingSortKey(b)));
    const nextBooking = (c) => upcomingBookings(c)[0] || null;
    const hasBooking = (c) => upcomingBookings(c).length > 0;
    const contactDeadline = (c) => { const d = lastTouch(c); return d ? addDays(d, LIMIT) : null; };
    const OPEN_INVOICE = ['published', 'overdue', 'underPaid'];
    // Allt som ska finnas i Google-kalendern som molnagenten synkar till. Nyckeln är stabil så att agenten
    // kan skapa, uppdatera och ta bort rätt händelse.
    function calendarItems(customers) {
        const today = todayISO(), from = addDays(today, -7);
        const items = [];
        for (const c of customers) {
            if (c.example)
                continue;
            const who = c.company || c.name || 'Namnlös';
            for (const b of c.bookings || []) {
                if (!b.date || b.date < from || b.source === 'gcal')
                    continue;
                items.push({ key: `booking:${c.id}:${b.id}`, kind: 'booking', customerId: c.id,
                    title: `${BOOKING_KINDS[b.kind] || 'Möte'}: ${who}${b.title ? ' – ' + b.title : ''}`,
                    date: b.date, time: b.time || null, allDay: !b.time, durationMin: b.durationMin || 60, location: b.location || '' });
            }
            if (c.followUp && c.followUp.date && c.followUp.date >= today) {
                items.push({ key: `followup:${c.id}`, kind: 'followup', customerId: c.id, title: `Följ upp: ${who}`,
                    date: c.followUp.date, allDay: true, note: c.followUp.note || '' });
            }
            const deadline = contactDeadline(c);
            if (c.status !== 'potentiell' && deadline && deadline >= today && !hasBooking(c)) {
                items.push({ key: `deadline:${c.id}`, kind: 'deadline', customerId: c.id, title: `90 dagar utan kontakt: ${who}`, date: deadline, allDay: true });
            }
            if (c.status !== 'potentiell') {
                for (const e of c.events || []) {
                    if (e.dismissed || e.followUpSentAt || !e.date)
                        continue;
                    const date = addDays(eventEnd(e), EVENT_FOLLOWUP_AFTER);
                    if (date < today)
                        continue;
                    items.push({ key: `eventfu:${c.id}:${e.id}`, kind: 'eventfu', customerId: c.id, title: `Följ upp event: ${who} – ${e.title}`, date, allDay: true });
                }
            }
            for (const j of c.jobs || []) {
                if (!j.dueDate || !OPEN_INVOICE.includes(j.invoiceStatus))
                    continue;
                items.push({ key: `invoice:${c.id}:${j.id}`, kind: 'invoice', customerId: c.id,
                    title: `Förfaller: faktura #${j.invoiceNumber} ${who}${j.amount ? ` (${j.amount} kr)` : ''}`, date: j.dueDate, allDay: true });
            }
        }
        return items.sort((a, b) => a.date.localeCompare(b.date) || a.key.localeCompare(b.key));
    }
    /* ---------- Bortvalda förslag från agenten ---------- */
    // Nyckel i samlingen "skipped": webbdomänen om den finns, annars företagsnamnet
    function skipKey(c) {
        let key = '';
        try {
            key = new URL(safeUrl(c.website)).hostname.replace(/^www\./, '');
        }
        catch { }
        return (key || c.company || c.name || c.id || '').toLowerCase().replace(/[^a-z0-9.-]+/g, '-').slice(0, 120) || c.id;
    }
    return {
        KINDS, LIMIT, WARN, INV_STATUS, MONTHS,
        setClock, todayISO, daysSince, fmtDate, dayMonth,
        esc, safeUrl, hostOf,
        lastTouch, status, needsContact, latestMail, daysLabel,
        upcomingEvents, openEvents, hasEvent, hiddenEvents, isNewEvent,
        signature, checkMailModule, logOnlyEntry, normalizeMailText, sentPatch,
        contactScore, filterCustomers, skipKey,
        BOOKING_KINDS, addDays, upcomingBookings, nextBooking, hasBooking, contactDeadline, calendarItems,
        daysUntil, nextEvent, eventSoon, eventsToFollowUp, eventConflicts,
        eventBadge, customerTypes, legacyType,
        EXAMPLE_BRAND, setBrand, getBrand, validateBrand, senderHint, brandFonts, googleFontsUrl, senderFor, typeColors, deriveColors, contrastRatio,
        // {id: namn} för det aktuella varumärkets kundtyper (räknas om när varumärket byts)
        get SERVICE_TYPES() { return serviceTypes(); }
    };
});
