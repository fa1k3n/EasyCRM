/* Enhetstester för logic.js. "Idag" är fast satt till 2026-10-15 så att resultaten inte beror på när testerna körs. */
const L = window.CRMLogic;
const TODAY = '2026-10-15';
L.setClock(() => new Date(TODAY + 'T12:00:00'));

// Hjälpare för att bygga testkunder
const daysAgo = n => { const d = new Date(TODAY + 'T12:00:00'); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
const mail = (date, kind = 'mail_ut', subject = 'Hej') => ({id: 'm' + date + kind, kind, date, subject});
const cust = (over = {}) => Object.assign({id: 'c1', company: 'Testbolaget AB', name: 'Anna Berg', type: 'headshot', status: 'kund', comms: [], jobs: [], events: []}, over);

describe('Datum', () => {
  test('todayISO följer den injicerade klockan', () => eq(L.todayISO(), TODAY));
  test('daysSince räknar hela dagar', () => {
    eq(L.daysSince(TODAY), 0);
    eq(L.daysSince('2026-10-14'), 1);
    eq(L.daysSince('2026-07-17'), 90);
  });
  test('daysSince klarar övergången från sommartid (25 oktober)', () => {
    L.setClock(() => new Date('2026-10-26T12:00:00'));
    eq(L.daysSince('2026-10-24'), 2);
    L.setClock(() => new Date(TODAY + 'T12:00:00'));
  });
  test('daysSince är negativ för framtida datum', () => eq(L.daysSince('2026-10-20'), -5));
  test('fmtDate visar dd/mm åååå', () => eq(L.fmtDate('2026-03-07'), '07/03 2026'));
  test('fmtDate ger tom sträng för saknat datum', () => { eq(L.fmtDate(''), ''); eq(L.fmtDate(undefined), ''); });
  test('dayMonth skriver ut månaden på svenska', () => { eq(L.dayMonth('2026-01-05'), '5 januari'); eq(L.dayMonth('2026-12-24'), '24 december'); });
});

describe('esc', () => {
  test('escapar HTML-tecken', () => eq(L.esc('<a href="x">\'&</a>'), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&lt;/a&gt;'));
  test('null och undefined blir tom sträng', () => { eq(L.esc(null), ''); eq(L.esc(undefined), ''); });
  test('siffror blir text', () => eq(L.esc(42), '42'));
  test('åäö lämnas orörda', () => eq(L.esc('Åsa Öberg'), 'Åsa Öberg'));
});

describe('safeUrl', () => {
  test('http och https lämnas som de är', () => {
    eq(L.safeUrl('https://exempelstudion.example'), 'https://exempelstudion.example');
    eq(L.safeUrl('HTTP://exempel.se/a'), 'HTTP://exempel.se/a');
  });
  test('domän utan protokoll får https://', () => eq(L.safeUrl('www.exempelstudion.example'), 'https://www.exempelstudion.example'));
  test('javascript: och data: blockeras', () => {
    eq(L.safeUrl('javascript:alert(1)'), null);
    eq(L.safeUrl('data:text/html,<script>alert(1)</script>'), null);
  });
  test('tomt och skräp ger null', () => { eq(L.safeUrl(''), null); eq(L.safeUrl(undefined), null); eq(L.safeUrl('inte en länk'), null); });
  test('hostOf tar bort www.', () => eq(L.hostOf('https://www.exempelbolaget.se/sv/event'), 'exempelbolaget.se'));
  test('hostOf ger "Källa" för ogiltig länk', () => eq(L.hostOf('trasig'), 'Källa'));
});

describe('Kontaktstatus', () => {
  test('lastTouch tar senaste av mail och jobb', () => {
    const c = cust({comms: [mail('2026-05-01')], jobs: [{id: 'j', title: 'Jobb', date: '2026-06-10'}]});
    eq(L.lastTouch(c), '2026-06-10');
  });
  test('lastTouch ignorerar datum i framtiden', () => {
    const c = cust({comms: [mail('2026-09-01'), mail('2026-11-01')], jobs: [{id: 'j', date: '2026-12-24'}]});
    eq(L.lastTouch(c), '2026-09-01');
  });
  test('lastTouch klarar kund utan comms och jobs', () => eq(L.lastTouch({}), null));
  test('lastTouch hoppar över poster utan datum', () => eq(L.lastTouch(cust({comms: [{kind: 'samtal'}, mail('2026-10-01')]})), '2026-10-01'));
  test('ingen kontakt ger nivån "never"', () => eq(L.status(cust()).level, 'never'));
  test('59 dagar är ok, 60 är varning', () => {
    eq(L.status(cust({comms: [mail(daysAgo(59))]})).level, 'ok');
    eq(L.status(cust({comms: [mail(daysAgo(60))]})).level, 'warn');
  });
  test('89 dagar är varning, 90 är rött', () => {
    eq(L.status(cust({comms: [mail(daysAgo(89))]})).level, 'warn');
    eq(L.status(cust({comms: [mail(daysAgo(90))]})).level, 'over');
  });
  test('status returnerar antal dagar och datum', () => eq(L.status(cust({comms: [mail('2026-10-05')]})), {level: 'ok', days: 10, d: '2026-10-05'}));
  test('needsContact gäller röda och aldrig kontaktade', () => {
    ok(L.needsContact(cust()), 'aldrig kontaktad');
    ok(L.needsContact(cust({comms: [mail(daysAgo(120))]})), 'över 90 dagar');
    ok(!L.needsContact(cust({comms: [mail(daysAgo(70))]})), 'gul räknas inte');
    ok(!L.needsContact(cust({comms: [mail(daysAgo(3))]})), 'nyss kontaktad');
  });
  test('daysLabel', () => {
    eq(L.daysLabel({level: 'never'}), 'Ej kontaktad');
    eq(L.daysLabel({level: 'ok', days: 0}), 'Idag');
    eq(L.daysLabel({level: 'over', days: 140}), '140 d sedan');
  });
});

describe('latestMail', () => {
  test('väljer senaste mailet, skickat eller mottaget', () => {
    const c = cust({comms: [mail('2026-09-08', 'mail_ut', 'A'), mail('2026-09-20', 'mail_in', 'B'), mail('2026-09-10', 'mail_ut', 'C')]});
    eq(L.latestMail(c).subject, 'B');
  });
  test('samtal och möten räknas inte som mail', () => {
    const c = cust({comms: [mail('2026-09-08', 'mail_ut', 'Mail'), {id: 's', kind: 'samtal', date: '2026-10-01', subject: 'Samtal'}]});
    eq(L.latestMail(c).subject, 'Mail');
  });
  test('ger null när inga mail finns', () => eq(L.latestMail(cust()), null));
});

describe('Event', () => {
  const ev = (over = {}) => Object.assign({id: 'e1', title: 'Höstseminarium', date: '2026-11-05'}, over);
  test('upcomingEvents visar kommande och sorterar på datum', () => {
    const c = cust({events: [ev({id: 'b', date: '2026-12-01'}), ev({id: 'a', date: '2026-10-20'}), ev({id: 'old', date: '2026-09-01'})]});
    eq(L.upcomingEvents(c).map(e => e.id), ['a', 'b']);
  });
  test('flerdagarsevent som pågår idag räknas som kommande', () => {
    eq(L.upcomingEvents(cust({events: [ev({date: '2026-10-13', endDate: '2026-10-16'})]})).length, 1);
  });
  test('event idag räknas, igår gör det inte', () => {
    eq(L.upcomingEvents(cust({events: [ev({date: TODAY})]})).length, 1);
    eq(L.upcomingEvents(cust({events: [ev({date: '2026-10-14'})]})).length, 0);
  });
  test('dolda event syns bara i hiddenEvents', () => {
    const c = cust({events: [ev({dismissed: true})]});
    eq(L.upcomingEvents(c).length, 0);
    eq(L.hiddenEvents(c).length, 1);
  });
  test('openEvents utesluter event där erbjudande redan skickats', () => {
    const c = cust({events: [ev({id: 'a'}), ev({id: 'b', offeredAt: '2026-10-10'})]});
    eq(L.openEvents(c).map(e => e.id), ['a']);
    ok(L.hasEvent(c));
  });
  test('potentiella kunder har aldrig öppna event', () => {
    const c = cust({status: 'potentiell', events: [ev()]});
    eq(L.openEvents(c), []);
    ok(!L.hasEvent(c));
  });
  test('isNewEvent: hittat inom 7 dagar', () => {
    ok(L.isNewEvent({foundAt: '2026-10-08T07:00:00Z'}), '7 dagar sedan');
    ok(!L.isNewEvent({foundAt: '2026-10-07T07:00:00Z'}), '8 dagar sedan');
    ok(!L.isNewEvent({}), 'saknar foundAt');
  });
});

describe('Kundlistan', () => {
  const list = [
    cust({id: 'red', company: 'Röda AB', comms: [mail(daysAgo(200))], createdAt: '2026-01-01'}),
    cust({id: 'red2', company: 'Rödare AB', comms: [mail(daysAgo(300))], createdAt: '2026-02-01'}),
    cust({id: 'never', company: 'Aldrig AB', status: 'potentiell', createdAt: '2026-10-01'}),
    cust({id: 'warn', company: 'Gula AB', comms: [mail(daysAgo(70))], type: 'sport', createdAt: '2026-03-01'}),
    cust({id: 'fresh', company: 'Bo AB', name: 'Ella Exempelsson', email: 'ella@exempelbolaget.se', comms: [mail(daysAgo(2))], createdAt: '2026-04-01'})
  ];
  const ids = view => L.filterCustomers(list, Object.assign({seg: 'alla', type: 'alla', q: '', sort: 'kontakt'}, view)).map(c => c.id);

  test('sortering "kontakt": rött (flest dagar först), aldrig kontaktad, gult, ok', () => eq(ids({}), ['red2', 'red', 'never', 'warn', 'fresh']));
  test('sortering "namn" i bokstavsordning', () => eq(ids({sort: 'namn'}), ['never', 'fresh', 'warn', 'red', 'red2']));
  test('sortering "nyast" på createdAt', () => eq(ids({sort: 'nyast'}), ['never', 'fresh', 'warn', 'red2', 'red']));
  test('filtret "Att kontakta" visar röda och aldrig kontaktade', () => eq(ids({seg: 'kontakta'}).sort(), ['never', 'red', 'red2']));
  test('filtren kunder och potentiella', () => {
    eq(ids({seg: 'potentiella'}), ['never']);
    ok(!ids({seg: 'kunder'}).includes('never'));
  });
  test('filtret på kundtyp', () => eq(ids({type: 'sport'}), ['warn']));
  test('sökning matchar namn och e-post, oberoende av skiftläge', () => {
    eq(ids({q: 'ELLA'}), ['fresh']);
    eq(ids({q: 'exempelbolaget.se'}), ['fresh']);
    eq(ids({q: '  rödare  '}), ['red2']);
  });
  test('sökning matchar delar av ord', () => eq(ids({q: 'röd'}), ['red2', 'red']));
  test('sökning som inte matchar ger tom lista', () => eq(ids({q: 'finns inte'}), []));
  test('svensk sortering: Å, Ä och Ö kommer efter Z', () => {
    const names = ['Örebro AB', 'Zeta AB', 'Åkeri AB', 'Ängel AB', 'Alfa AB'].map((company, i) => cust({id: 'n' + i, company}));
    eq(L.filterCustomers(names, {sort: 'namn'}).map(c => c.company), ['Alfa AB', 'Zeta AB', 'Åkeri AB', 'Ängel AB', 'Örebro AB']);
  });
  test('originallistan ändras inte', () => { ids({sort: 'namn'}); eq(list[0].id, 'red'); });
});

describe('skipKey', () => {
  test('använder domänen utan www', () => eq(L.skipKey({website: 'https://www.Exempelbolaget.se/sv'}), 'exempelbolaget.se'));
  test('domän utan protokoll fungerar', () => eq(L.skipKey({website: 'exempeladvokaterna.se'}), 'exempeladvokaterna.se'));
  test('utan webbplats används företagsnamnet', () => eq(L.skipKey({company: 'Exempel Advokatbyrå AB'}), 'exempel-advokatbyr-ab'));
  test('nyckeln innehåller bara tillåtna tecken och är högst 120 tecken', () => {
    const k = L.skipKey({company: 'Ä'.repeat(10) + ' / & ' + 'x'.repeat(200)});
    ok(/^[a-z0-9.-]+$/.test(k), 'tillåtna tecken: ' + k);
    ok(k.length <= 120, 'längd ' + k.length);
  });
  test('faller tillbaka på id när inget annat finns', () => eq(L.skipKey({id: 'p8x2k'}), 'p8x2k'));
});

/* ---------- Kalender (tillagt 2026-10-15): bokningar, uppföljning, 90-dagarsgräns och fakturor ---------- */
describe('Datumhjälp för kalendern', () => {
  test('addDays räknar fram och bakåt, även över månad och år', () => {
    eq(L.addDays('2026-10-15', 1), '2026-10-16');
    eq(L.addDays('2026-10-31', 1), '2026-11-01');
    eq(L.addDays('2026-12-31', 1), '2027-01-01');
    eq(L.addDays('2026-10-15', -15), '2026-09-30');
    eq(L.addDays('2026-10-15', 90), '2027-01-13');
  });
  test('addDays påverkas inte av övergången till vintertid', () => eq(L.addDays('2026-10-24', 2), '2026-10-26'));
  test('BOOKING_KINDS har jobb, möte och samtal', () => eq(L.BOOKING_KINDS, {jobb: 'Jobb', mote: 'Möte', samtal: 'Samtal'}));
});

describe('Bokningar', () => {
  const bk = (id, date, time, over = {}) => Object.assign({id, kind: 'mote', title: 'Kaffe', date, time}, over);
  test('upcomingBookings visar idag och framåt, sorterat på datum och tid', () => {
    const c = cust({bookings: [bk('c', '2026-10-20', '09:00'), bk('a', TODAY, '15:00'), bk('old', '2026-10-14', '10:00'), bk('b', '2026-10-20', '08:00')]});
    eq(L.upcomingBookings(c).map(b => b.id), ['a', 'b', 'c']);
  });
  test('bokning utan tid sorteras före bokningar med tid samma dag', () => {
    const c = cust({bookings: [bk('t', '2026-10-20', '08:00'), bk('heldag', '2026-10-20', '')]});
    eq(L.upcomingBookings(c).map(b => b.id), ['heldag', 't']);
  });
  test('nextBooking ger första kommande bokning, annars null', () => {
    eq(L.nextBooking(cust({bookings: [bk('x', '2026-11-01', '10:00'), bk('y', '2026-10-28', '14:00')]})).id, 'y');
    eq(L.nextBooking(cust()), null);
    eq(L.nextBooking(cust({bookings: [bk('gammal', '2026-01-01', '10:00')]})), null);
  });
  test('hasBooking', () => {
    ok(L.hasBooking(cust({bookings: [bk('x', '2026-11-01', '10:00')]})));
    ok(!L.hasBooking(cust()), 'utan bokningar');
  });
  test('filtret "bokat" visar kunder med kommande bokning', () => {
    const list = [cust({id: 'med', bookings: [bk('x', '2026-11-01', '10:00')]}), cust({id: 'utan'})];
    eq(L.filterCustomers(list, {seg: 'bokat', type: 'alla', q: '', sort: 'kontakt'}).map(c => c.id), ['med']);
  });
});

describe('90-dagarsgräns', () => {
  test('contactDeadline är senaste kontakt plus 90 dagar', () => eq(L.contactDeadline(cust({comms: [mail('2026-09-08')]})), '2026-12-07'));
  test('contactDeadline är null utan kontakt', () => eq(L.contactDeadline(cust()), null));
  test('framtida kontakter räknas inte', () => eq(L.contactDeadline(cust({comms: [mail('2026-09-08'), mail('2026-12-24')]})), '2026-12-07'));
});

describe('calendarItems', () => {
  const byKey = items => Object.fromEntries(items.map(i => [i.key, i]));
  const base = (over = {}) => cust(Object.assign({id: 'adv', company: 'Exempelbolaget AB', comms: [mail('2026-09-08')]}, over));

  test('bokning med tid blir en händelse med start, tid, längd och plats', () => {
    const items = L.calendarItems([base({bookings: [{id: 'b1', kind: 'mote', title: 'Kaffe med Ella', date: '2026-10-28', time: '14:00', location: 'Kontoret'}]})]);
    eq(byKey(items)['booking:adv:b1'], {key: 'booking:adv:b1', kind: 'booking', customerId: 'adv', title: 'Möte: Exempelbolaget AB – Kaffe med Ella',
      date: '2026-10-28', time: '14:00', allDay: false, durationMin: 60, location: 'Kontoret'});
  });
  test('bokning utan tid blir heldag, och utan titel används bara typ och företag', () => {
    const it = byKey(L.calendarItems([base({bookings: [{id: 'b2', kind: 'jobb', date: '2026-11-04'}]})]))['booking:adv:b2'];
    eq(it.allDay, true);
    eq(it.title, 'Jobb: Exempelbolaget AB');
  });
  test('bokningens egen längd används om den finns', () => {
    const it = byKey(L.calendarItems([base({bookings: [{id: 'b3', kind: 'jobb', title: 'Porträtt', date: '2026-11-04', time: '09:00', durationMin: 240}]})]))['booking:adv:b3'];
    eq(it.durationMin, 240);
  });
  test('bokningar äldre än 7 dagar och bokningar som kom från Google Kalender skickas inte', () => {
    const items = L.calendarItems([base({bookings: [
      {id: 'gammal', kind: 'mote', date: '2026-10-07', time: '10:00'},
      {id: 'nyligen', kind: 'mote', date: '2026-10-08', time: '10:00'},
      {id: 'fran-gcal', kind: 'mote', date: '2026-10-30', time: '10:00', source: 'gcal', gcalEventId: 'abc'}
    ]})]);
    const keys = items.map(i => i.key);
    ok(!keys.includes('booking:adv:gammal'), 'äldre än 7 dagar');
    ok(keys.includes('booking:adv:nyligen'), 'inom 7 dagar');
    ok(!keys.includes('booking:adv:fran-gcal'), 'från Google Kalender');
  });
  test('uppföljning blir en heldagspåminnelse med anteckningen', () => {
    const it = byKey(L.calendarItems([base({followUp: {date: '2026-10-27', note: 'Skicka uppföljningen'}})]))['followup:adv'];
    eq(it.title, 'Följ upp: Exempelbolaget AB');
    eq(it.date, '2026-10-27');
    eq(it.allDay, true);
    eq(it.note, 'Skicka uppföljningen');
  });
  test('passerad uppföljning skickas inte', () => ok(!L.calendarItems([base({followUp: {date: '2026-10-01'}})]).some(i => i.kind === 'followup')));
  test('90-dagarsgränsen blir en heldagspåminnelse för kunder', () => {
    const it = byKey(L.calendarItems([base()]))['deadline:adv'];
    eq(it.title, '90 dagar utan kontakt: Exempelbolaget AB');
    eq(it.date, '2026-12-07');
    eq(it.allDay, true);
  });
  test('ingen 90-dagarspåminnelse för potentiella kunder, redan passerade gränser eller när ett möte är bokat', () => {
    eq(L.calendarItems([base({status: 'potentiell'})]).filter(i => i.kind === 'deadline').length, 0);
    eq(L.calendarItems([base({comms: [mail('2026-05-01')]})]).filter(i => i.kind === 'deadline').length, 0);
    eq(L.calendarItems([base({bookings: [{id: 'b', kind: 'mote', date: '2026-11-01', time: '10:00'}]})]).filter(i => i.kind === 'deadline').length, 0);
  });
  test('obetalda fakturor med förfallodag blir heldagshändelser, betalda och krediterade skickas inte', () => {
    const items = L.calendarItems([base({jobs: [
      {id: 'j5', title: 'Fotografering uppstart', date: '2026-05-22', amount: '19 500', invoiceNumber: '5', invoiceStatus: 'overdue', dueDate: '2026-06-21'},
      {id: 'j6', title: 'Porträtt', date: '2026-10-01', invoiceNumber: '6', invoiceStatus: 'published', dueDate: '2026-10-31'},
      {id: 'j7', title: 'Event', date: '2026-09-01', invoiceNumber: '7', invoiceStatus: 'paid', dueDate: '2026-10-01'},
      {id: 'j8', title: 'Kredit', date: '2026-09-01', invoiceNumber: '8', invoiceStatus: 'credited', dueDate: '2026-10-01'},
      {id: 'j9', title: 'Utan förfallodag', date: '2026-09-01', invoiceNumber: '9', invoiceStatus: 'published'}
    ]})]);
    const inv = byKey(items);
    eq(inv['invoice:adv:j5'].title, 'Förfaller: faktura #5 Exempelbolaget AB (19 500 kr)');
    eq(inv['invoice:adv:j5'].date, '2026-06-21');
    eq(inv['invoice:adv:j6'].title, 'Förfaller: faktura #6 Exempelbolaget AB');
    ok(!inv['invoice:adv:j7'] && !inv['invoice:adv:j8'] && !inv['invoice:adv:j9'], 'betald, krediterad och utan förfallodag skickas inte');
  });
  test('exempelkunder tas aldrig med', () => eq(L.calendarItems([base({example: true, followUp: {date: '2026-10-27'}})]), []));
  test('kontaktpersonens namn används om företagsnamn saknas', () => eq(byKey(L.calendarItems([base({company: '', name: 'Anna Berg', followUp: {date: '2026-10-27'}})]))['followup:adv'].title, 'Följ upp: Anna Berg'));
  test('händelserna sorteras på datum och har unika nycklar', () => {
    const items = L.calendarItems([
      base({followUp: {date: '2026-11-20'}, bookings: [{id: 'b', kind: 'mote', date: '2026-10-28', time: '14:00'}]}),
      cust({id: 'tb', company: 'Testbyrån', status: 'potentiell', followUp: {date: '2026-10-27'}})
    ]);
    eq(items.map(i => i.date), [...items.map(i => i.date)].sort());
    eq(new Set(items.map(i => i.key)).size, items.length);
  });
});

/* ---------- Event i kundlistan, krockar och uppföljning efter event (tillagt 2026-10-15) ---------- */
describe('Nästa event och "snart"', () => {
  const ev = (id, date, over = {}) => Object.assign({id, title: 'Event ' + id, date}, over);
  test('daysUntil räknar dagar fram till ett datum', () => {
    eq(L.daysUntil(TODAY), 0);
    eq(L.daysUntil('2026-10-29'), 14);
    eq(L.daysUntil('2026-10-14'), -1);
  });
  test('nextEvent tar med event där erbjudande redan skickats, men inte dolda eller passerade', () => {
    const c = cust({events: [ev('dolt', '2026-10-20', {dismissed: true}), ev('gammalt', '2026-10-01'), ev('erbjudet', '2026-11-03', {offeredAt: '2026-10-13'}), ev('senare', '2026-12-01')]});
    eq(L.nextEvent(c).id, 'erbjudet');
    eq(L.nextEvent(cust()), null);
  });
  test('eventSoon gäller event inom 14 dagar, oavsett om det är erbjudet eller inte', () => {
    ok(L.eventSoon(cust({events: [ev('a', '2026-10-29', {offeredAt: '2026-10-10'})]})), '14 dagar bort');
    ok(L.eventSoon(cust({events: [ev('idag', TODAY)]})), 'idag');
    ok(!L.eventSoon(cust({events: [ev('b', '2026-10-30')]})), '15 dagar bort');
    ok(!L.eventSoon(cust()), 'inga event');
  });
  test('eventSoon räknar ett pågående flerdagarsevent som snart', () => ok(L.eventSoon(cust({events: [ev('p', '2026-10-14', {endDate: '2026-10-16'})]}))));
});

describe('Event att följa upp efter', () => {
  const ev = (id, date, over = {}) => Object.assign({id, title: 'Event ' + id, date}, over);
  test('avslutade event inom 30 dagar ska följas upp, senast avslutade först', () => {
    const c = cust({events: [ev('igar', '2026-10-14'), ev('forra', '2026-10-01'), ev('gammal', '2026-09-14'), ev('framtid', '2026-10-20')]});
    eq(L.eventsToFollowUp(c).map(e => e.id), ['igar', 'forra']);
  });
  test('exakt 30 dagar sedan räknas med', () => eq(L.eventsToFollowUp(cust({events: [ev('x', '2026-09-15')]})).length, 1));
  test('flerdagarsevent följs upp först när sista dagen har passerat', () => {
    eq(L.eventsToFollowUp(cust({events: [ev('p', '2026-10-13', {endDate: TODAY})]})).length, 0);
    eq(L.eventsToFollowUp(cust({events: [ev('p', '2026-10-12', {endDate: '2026-10-14'})]})).length, 1);
  });
  test('dolda event och event där uppföljningen redan skickats följs inte upp', () => {
    eq(L.eventsToFollowUp(cust({events: [ev('d', '2026-10-10', {dismissed: true}), ev('s', '2026-10-10', {followUpSentAt: '2026-10-13'})]})).length, 0);
  });
  test('potentiella kunder följs inte upp på event', () => eq(L.eventsToFollowUp(cust({status: 'potentiell', events: [ev('x', '2026-10-10')]})).length, 0));
});

describe('Krockar mellan kundevent och det som är bokat', () => {
  const others = [
    cust({id: 'adv', company: 'Exempelbolaget AB', bookings: [{id: 'b1', kind: 'jobb', title: 'Porträtt', date: '2026-11-03', time: '09:00'}, {id: 'b2', kind: 'mote', date: '2026-11-10', time: '14:00'}]}),
    cust({id: 'tb', company: 'Testbyrån', bookings: [{id: 'b3', kind: 'samtal', title: 'Avstämning', date: '2026-11-04', time: ''}]})
  ];
  test('en bokning samma dag hos vilken kund som helst är en krock', () => {
    eq(L.eventConflicts({date: '2026-11-03'}, others), [{date: '2026-11-03', time: '09:00', title: 'Jobb: Exempelbolaget AB – Porträtt', source: 'bokning', customerId: 'adv'}]);
  });
  test('flerdagarsevent krockar med allt inom perioden, sorterat på datum', () => {
    eq(L.eventConflicts({date: '2026-11-03', endDate: '2026-11-04'}, others).map(k => k.title), ['Jobb: Exempelbolaget AB – Porträtt', 'Samtal: Testbyrån – Avstämning']);
  });
  test('händelser i Google Kalender räknas också', () => {
    const busy = [{date: '2026-11-03', time: '18:00', title: 'Tandläkare'}, {date: '2026-11-05', time: '10:00', title: 'Annat'}];
    const k = L.eventConflicts({date: '2026-11-03'}, [], busy);
    eq(k, [{date: '2026-11-03', time: '18:00', title: 'Tandläkare', source: 'kalender'}]);
  });
  test('inga krockar ger tom lista', () => {
    eq(L.eventConflicts({date: '2026-11-20'}, others, []), []);
    eq(L.eventConflicts({date: '2026-11-20'}, [], undefined), []);
  });
  test('bokningar från Google Kalender räknas bara en gång', () => {
    const c = [cust({id: 'x', company: 'X', bookings: [{id: 'g', kind: 'mote', title: 'Möte', date: '2026-11-03', time: '10:00', source: 'gcal', gcalEventId: 'abc'}]})];
    const busy = [{date: '2026-11-03', time: '10:00', title: 'Möte', eventId: 'abc'}];
    eq(L.eventConflicts({date: '2026-11-03'}, c, busy).length, 1);
  });
});

/* ---------- Eventmarkering i kundlistan och flera kundtyper (tillagt 2026-10-15) ---------- */
describe('eventBadge – markering i kundlistan', () => {
  const ev = (id, date, over = {}) => Object.assign({id, title: 'Event ' + id, date}, over);
  test('ohanterade event (inte dolda, inget erbjudande) ger "att erbjuda" med antal', () => {
    eq(L.eventBadge(cust({events: [ev('a', '2026-11-03'), ev('b', '2026-12-01'), ev('c', '2026-11-10', {offeredAt: '2026-10-13'}), ev('d', '2026-11-20', {dismissed: true})]})), {kind: 'offer', count: 2});
  });
  test('ohanterat event längre fram än 14 dagar ger ändå "att erbjuda"', () => eq(L.eventBadge(cust({events: [ev('a', '2027-02-01')]})), {kind: 'offer', count: 1}));
  test('allt hanterat men ett event inom 14 dagar ger "snart"', () => eq(L.eventBadge(cust({events: [ev('a', '2026-10-20', {offeredAt: '2026-10-10'})]})), {kind: 'soon', count: 0}));
  test('allt hanterat och inget inom 14 dagar ger ingen etikett', () => eq(L.eventBadge(cust({events: [ev('a', '2026-12-20', {offeredAt: '2026-10-10'})]})), null));
  test('passerade och dolda event ger ingen etikett', () => eq(L.eventBadge(cust({events: [ev('a', '2026-10-01'), ev('b', '2026-11-01', {dismissed: true})]})), null));
  test('potentiella kunder får ingen eventetikett', () => eq(L.eventBadge(cust({status: 'potentiell', events: [ev('a', '2026-11-03')]})), null));
});

describe('Kundtyper: CV, Foto, Video, Live, Sport (flera per kund)', () => {
  test('SERVICE_TYPES i ordningen CV, Foto, Video, Live, Sport', () => eq(L.SERVICE_TYPES, {cv: 'CV', foto: 'Foto', video: 'Video', live: 'Live', sport: 'Sport'}));
  test('customerTypes läser types-listan i fast ordning, utan dubbletter och okända värden', () => {
    eq(L.customerTypes(cust({types: ['sport', 'live', 'cv', 'live', 'okand']})), ['cv', 'live', 'sport']);
  });
  test('gamla kunder översätts från type: headshot → cv, liveprod → live, sport → live + sport, ovrigt → inget', () => {
    eq(L.customerTypes({type: 'headshot'}), ['cv']);
    eq(L.customerTypes({type: 'liveprod'}), ['live']);
    eq(L.customerTypes({type: 'sport'}), ['live', 'sport']);
    eq(L.customerTypes({type: 'ovrigt'}), []);
    eq(L.customerTypes({}), []);
  });
  test('en tom types-lista betyder inga typer, även om gammalt type finns', () => eq(L.customerTypes({type: 'headshot', types: []}), []));
  test('filtret på de nya typerna använder alla kundens typer', () => {
    const list = [cust({id: 'a', types: ['cv', 'video']}), cust({id: 'b', types: ['live']}), cust({id: 'c', type: 'liveprod'}), cust({id: 'd', types: ['live', 'sport']})];
    eq(L.filterCustomers(list, {seg: 'alla', type: 'video', q: '', sort: 'namn'}).map(c => c.id), ['a']);
    eq(L.filterCustomers(list, {seg: 'alla', type: 'live', q: '', sort: 'namn'}).map(c => c.id).sort(), ['b', 'c', 'd']);
    eq(L.filterCustomers(list, {seg: 'alla', type: 'sport', q: '', sort: 'namn'}).map(c => c.id), ['d']);
  });
  test('legacyType ger ett gammalt typvärde för agenter som fortfarande läser type', () => {
    eq(L.legacyType({types: ['live', 'sport']}), 'sport');
    eq(L.legacyType({types: ['video', 'live']}), 'liveprod');
    eq(L.legacyType({types: ['cv', 'foto']}), 'headshot');
    eq(L.legacyType({types: []}), 'ovrigt');
  });
});

describe('calendarItems: påminnelse om uppföljning efter event', () => {
  const byKey = items => Object.fromEntries(items.map(i => [i.key, i]));
  const base = (events, over = {}) => cust(Object.assign({id: 'adv', company: 'Exempelbolaget AB', comms: [mail('2026-10-13')], events}, over));
  test('påminnelse tre dagar efter eventets sista dag', () => {
    const it = byKey(L.calendarItems([base([{id: 'e1', title: 'Kunddagen', date: '2026-11-03'}])]))['eventfu:adv:e1'];
    eq(it.title, 'Följ upp event: Exempelbolaget AB – Kunddagen');
    eq(it.date, '2026-11-06');
    eq(it.allDay, true);
    eq(it.kind, 'eventfu');
  });
  test('flerdagarsevent räknas från sista dagen', () => eq(byKey(L.calendarItems([base([{id: 'e2', title: 'Mässa', date: '2026-11-03', endDate: '2026-11-05'}])]))['eventfu:adv:e2'].date, '2026-11-08'));
  test('ingen påminnelse för dolda event, redan uppföljda event, passerade påminnelser eller potentiella kunder', () => {
    const items = L.calendarItems([
      base([{id: 'd', title: 'D', date: '2026-11-03', dismissed: true}, {id: 's', title: 'S', date: '2026-11-03', followUpSentAt: '2026-11-04'}, {id: 'p', title: 'P', date: '2026-10-01'}]),
      cust({id: 'pot', company: 'Pot', status: 'potentiell', events: [{id: 'x', title: 'X', date: '2026-11-03'}]})
    ]);
    eq(items.filter(i => i.kind === 'eventfu'), []);
  });
});

describe('Kundlistan: borttaget eventfilter', () => {
  const list = [
    cust({id: 'utan', company: 'Utan event AB', comms: [mail('2026-10-01')]}),
    cust({id: 'med', company: 'Med event AB', comms: [mail('2026-10-01')], events: [{id: 'e1', title: 'Seminarium', date: '2026-11-03'}]})
  ];
  test('ett gammalt filtervärde "event" filtrerar inte bort någon kund', () => eq(L.filterCustomers(list, {seg: 'event', type: 'alla', q: '', sort: 'namn'}).map(c => c.id), ['med', 'utan']));
});

describe('Gamla typnamn borttagna', () => {
  test('den gamla konstanten TYPES exporteras inte längre', () => eq(L.TYPES, undefined));
  test('gamla type-värden översätts fortfarande via customerTypes', () => eq(L.customerTypes({type: 'liveprod'}), ['live']));
});