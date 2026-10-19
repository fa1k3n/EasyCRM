/* Unit tests for logic.js. "Today" is fixed to 2026-10-15, so the results do not depend on when the tests run. */
const L = window.CRMLogic;
const TODAY = '2026-10-15';
L.setClock(() => new Date(TODAY + 'T12:00:00'));

// Helpers that build test customers
const daysAgo = n => { const d = new Date(TODAY + 'T12:00:00'); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
const mail = (date, kind = 'mail_ut', subject = 'Hej') => ({id: 'm' + date + kind, kind, date, subject});
const cust = (over = {}) => Object.assign({id: 'c1', company: 'Testbolaget AB', name: 'Anna Berg', type: 'headshot', status: 'kund', comms: [], jobs: [], events: []}, over);

describe('Dates', () => {
  test('todayISO follows the injected clock', () => eq(L.todayISO(), TODAY));
  test('daysSince counts whole days', () => {
    eq(L.daysSince(TODAY), 0);
    eq(L.daysSince('2026-10-14'), 1);
    eq(L.daysSince('2026-07-17'), 90);
  });
  test('daysSince copes with the end of summer time (25 October)', () => {
    L.setClock(() => new Date('2026-10-26T12:00:00'));
    eq(L.daysSince('2026-10-24'), 2);
    L.setClock(() => new Date(TODAY + 'T12:00:00'));
  });
  test('daysSince is negative for future dates', () => eq(L.daysSince('2026-10-20'), -5));
  test('fmtDate shows dd/mm yyyy', () => eq(L.fmtDate('2026-03-07'), '07/03 2026'));
  test('fmtDate gives an empty string for a missing date', () => { eq(L.fmtDate(''), ''); eq(L.fmtDate(undefined), ''); });
  test('dayMonth writes the month in Swedish', () => { eq(L.dayMonth('2026-01-05'), '5 januari'); eq(L.dayMonth('2026-12-24'), '24 december'); });
});

describe('safeUrl', () => {
  test('http and https are left as they are', () => {
    eq(L.safeUrl('https://exempelstudion.example'), 'https://exempelstudion.example');
    eq(L.safeUrl('HTTP://exempel.se/a'), 'HTTP://exempel.se/a');
  });
  test('a domain without a protocol gets https://', () => eq(L.safeUrl('www.exempelstudion.example'), 'https://www.exempelstudion.example'));
  test('javascript: and data: are blocked', () => {
    eq(L.safeUrl('javascript:alert(1)'), null);
    eq(L.safeUrl('data:text/html,<script>alert(1)</script>'), null);
  });
  test('empty and junk give null', () => { eq(L.safeUrl(''), null); eq(L.safeUrl(undefined), null); eq(L.safeUrl('inte en länk'), null); });
  test('hostOf removes www.', () => eq(L.hostOf('https://www.exempelbolaget.se/sv/event'), 'exempelbolaget.se'));
  test('hostOf gives "Källa" (source) for an invalid link', () => eq(L.hostOf('trasig'), 'Källa'));
});

describe('Contact status', () => {
  test('lastTouch takes the latest of mails and jobs', () => {
    const c = cust({comms: [mail('2026-05-01')], jobs: [{id: 'j', title: 'Jobb', date: '2026-06-10'}]});
    eq(L.lastTouch(c), '2026-06-10');
  });
  test('lastTouch ignores dates in the future', () => {
    const c = cust({comms: [mail('2026-09-01'), mail('2026-11-01')], jobs: [{id: 'j', date: '2026-12-24'}]});
    eq(L.lastTouch(c), '2026-09-01');
  });
  test('lastTouch copes with a customer without comms and jobs', () => eq(L.lastTouch({}), null));
  test('lastTouch skips entries without a date', () => eq(L.lastTouch(cust({comms: [{kind: 'samtal'}, mail('2026-10-01')]})), '2026-10-01'));
  test('no contact gives the level "never"', () => eq(L.status(cust()).level, 'never'));
  test('59 days is ok, 60 is a warning', () => {
    eq(L.status(cust({comms: [mail(daysAgo(59))]})).level, 'ok');
    eq(L.status(cust({comms: [mail(daysAgo(60))]})).level, 'warn');
  });
  test('89 days is a warning, 90 is red', () => {
    eq(L.status(cust({comms: [mail(daysAgo(89))]})).level, 'warn');
    eq(L.status(cust({comms: [mail(daysAgo(90))]})).level, 'over');
  });
  test('status returns the number of days and the date', () => eq(L.status(cust({comms: [mail('2026-10-05')]})), {level: 'ok', days: 10, d: '2026-10-05'}));
  test('needsContact covers red and never contacted', () => {
    ok(L.needsContact(cust()), 'never contacted');
    ok(L.needsContact(cust({comms: [mail(daysAgo(120))]})), 'over 90 days');
    ok(!L.needsContact(cust({comms: [mail(daysAgo(70))]})), 'yellow does not count');
    ok(!L.needsContact(cust({comms: [mail(daysAgo(3))]})), 'just contacted');
  });
  test('daysLabel', () => {
    eq(L.daysLabel({level: 'never'}), 'Ej kontaktad');
    eq(L.daysLabel({level: 'ok', days: 0}), 'Idag');
    eq(L.daysLabel({level: 'over', days: 140}), '140 d sedan');
  });
});

describe('latestMail', () => {
  test('picks the latest mail, sent or received', () => {
    const c = cust({comms: [mail('2026-09-08', 'mail_ut', 'A'), mail('2026-09-20', 'mail_in', 'B'), mail('2026-09-10', 'mail_ut', 'C')]});
    eq(L.latestMail(c).subject, 'B');
  });
  test('calls and meetings do not count as mail', () => {
    const c = cust({comms: [mail('2026-09-08', 'mail_ut', 'Mail'), {id: 's', kind: 'samtal', date: '2026-10-01', subject: 'Samtal'}]});
    eq(L.latestMail(c).subject, 'Mail');
  });
  test('gives null when there are no mails', () => eq(L.latestMail(cust()), null));
});

describe('Event', () => {
  const ev = (over = {}) => Object.assign({id: 'e1', title: 'Höstseminarium', date: '2026-11-05'}, over);
  test('upcomingEvents shows upcoming events sorted by date', () => {
    const c = cust({events: [ev({id: 'b', date: '2026-12-01'}), ev({id: 'a', date: '2026-10-20'}), ev({id: 'old', date: '2026-09-01'})]});
    eq(L.upcomingEvents(c).map(e => e.id), ['a', 'b']);
  });
  test('a multi-day event going on today counts as upcoming', () => {
    eq(L.upcomingEvents(cust({events: [ev({date: '2026-10-13', endDate: '2026-10-16'})]})).length, 1);
  });
  test('an event today counts, yesterday does not', () => {
    eq(L.upcomingEvents(cust({events: [ev({date: TODAY})]})).length, 1);
    eq(L.upcomingEvents(cust({events: [ev({date: '2026-10-14'})]})).length, 0);
  });
  test('hidden events only show in hiddenEvents', () => {
    const c = cust({events: [ev({dismissed: true})]});
    eq(L.upcomingEvents(c).length, 0);
    eq(L.hiddenEvents(c).length, 1);
  });
  test('openEvents leaves out events where an offer has been sent', () => {
    const c = cust({events: [ev({id: 'a'}), ev({id: 'b', offeredAt: '2026-10-10'})]});
    eq(L.openEvents(c).map(e => e.id), ['a']);
    ok(L.hasEvent(c));
  });
  test('potential customers never have open events', () => {
    const c = cust({status: 'potentiell', events: [ev()]});
    eq(L.openEvents(c), []);
    ok(!L.hasEvent(c));
  });
  test('isNewEvent: found within 7 days', () => {
    ok(L.isNewEvent({foundAt: '2026-10-08T07:00:00Z'}), '7 days ago');
    ok(!L.isNewEvent({foundAt: '2026-10-07T07:00:00Z'}), '8 days ago');
    ok(!L.isNewEvent({}), 'no foundAt');
  });
});

describe('The customer list', () => {
  const list = [
    cust({id: 'red', company: 'Röda AB', comms: [mail(daysAgo(200))], createdAt: '2026-01-01'}),
    cust({id: 'red2', company: 'Rödare AB', comms: [mail(daysAgo(300))], createdAt: '2026-02-01'}),
    cust({id: 'never', company: 'Aldrig AB', status: 'potentiell', createdAt: '2026-10-01'}),
    cust({id: 'warn', company: 'Gula AB', comms: [mail(daysAgo(70))], types: ['sport'], createdAt: '2026-03-01'}),
    cust({id: 'fresh', company: 'Bo AB', name: 'Ella Exempelsson', email: 'ella@exempelbolaget.se', comms: [mail(daysAgo(2))], createdAt: '2026-04-01'})
  ];
  const ids = view => L.filterCustomers(list, Object.assign({seg: 'alla', type: 'alla', q: '', sort: 'kontakt'}, view)).map(c => c.id);

  test('sorting "kontakt": red (most days first), never contacted, yellow, ok', () => eq(ids({}), ['red2', 'red', 'never', 'warn', 'fresh']));
  test('sorting "namn" in alphabetical order', () => eq(ids({sort: 'namn'}), ['never', 'fresh', 'warn', 'red', 'red2']));
  test('sorting "nyast" by createdAt', () => eq(ids({sort: 'nyast'}), ['never', 'fresh', 'warn', 'red2', 'red']));
  test('the filter "kontakta" shows red and never contacted', () => eq(ids({seg: 'kontakta'}).sort(), ['never', 'red', 'red2']));
  test('the filters customers and potential', () => {
    eq(ids({seg: 'potentiella'}), ['never']);
    ok(!ids({seg: 'kunder'}).includes('never'));
  });
  test('the filter on customer type', () => eq(ids({type: 'sport'}), ['warn']));
  test('search matches name and email, regardless of case', () => {
    eq(ids({q: 'ELLA'}), ['fresh']);
    eq(ids({q: 'exempelbolaget.se'}), ['fresh']);
    eq(ids({q: '  rödare  '}), ['red2']);
  });
  test('search matches parts of words', () => eq(ids({q: 'röd'}), ['red2', 'red']));
  test('a search that does not match gives an empty list', () => eq(ids({q: 'finns inte'}), []));
  test('Swedish sorting: Å, Ä and Ö come after Z', () => {
    const names = ['Örebro AB', 'Zeta AB', 'Åkeri AB', 'Ängel AB', 'Alfa AB'].map((company, i) => cust({id: 'n' + i, company}));
    eq(L.filterCustomers(names, {sort: 'namn'}).map(c => c.company), ['Alfa AB', 'Zeta AB', 'Åkeri AB', 'Ängel AB', 'Örebro AB']);
  });
  test('the original list is not changed', () => { ids({sort: 'namn'}); eq(list[0].id, 'red'); });
});

describe('skipKey', () => {
  test('uses the domain without www', () => eq(L.skipKey({website: 'https://www.Exempelbolaget.se/sv'}), 'exempelbolaget.se'));
  test('a domain without a protocol works', () => eq(L.skipKey({website: 'exempeladvokaterna.se'}), 'exempeladvokaterna.se'));
  test('without a website the company name is used', () => eq(L.skipKey({company: 'Exempel Advokatbyrå AB'}), 'exempel-advokatbyr-ab'));
  test('the key has only allowed characters and is at most 120 characters', () => {
    const k = L.skipKey({company: 'Ä'.repeat(10) + ' / & ' + 'x'.repeat(200)});
    ok(/^[a-z0-9.-]+$/.test(k), 'allowed characters: ' + k);
    ok(k.length <= 120, 'length ' + k.length);
  });
  test('falls back to the id when there is nothing else', () => eq(L.skipKey({id: 'p8x2k'}), 'p8x2k'));
});

/* ---------- Calendar (added 2026-10-15): bookings, follow-up, the 90-day limit and invoices ---------- */
describe('Date helpers for the calendar', () => {
  test('addDays counts forwards and backwards, also across months and years', () => {
    eq(L.addDays('2026-10-15', 1), '2026-10-16');
    eq(L.addDays('2026-10-31', 1), '2026-11-01');
    eq(L.addDays('2026-12-31', 1), '2027-01-01');
    eq(L.addDays('2026-10-15', -15), '2026-09-30');
    eq(L.addDays('2026-10-15', 90), '2027-01-13');
  });
  test('addDays is not affected by the change to winter time', () => eq(L.addDays('2026-10-24', 2), '2026-10-26'));
  test('BOOKING_KINDS has job, meeting and call', () => eq(L.BOOKING_KINDS, {jobb: 'Jobb', mote: 'Möte', samtal: 'Samtal'}));
});

describe('Bookings', () => {
  const bk = (id, date, time, over = {}) => Object.assign({id, kind: 'mote', title: 'Kaffe', date, time}, over);
  test('upcomingBookings shows today and later, sorted by date and time', () => {
    const c = cust({bookings: [bk('c', '2026-10-20', '09:00'), bk('a', TODAY, '15:00'), bk('old', '2026-10-14', '10:00'), bk('b', '2026-10-20', '08:00')]});
    eq(L.upcomingBookings(c).map(b => b.id), ['a', 'b', 'c']);
  });
  test('a booking without a time sorts before bookings with a time on the same day', () => {
    const c = cust({bookings: [bk('t', '2026-10-20', '08:00'), bk('heldag', '2026-10-20', '')]});
    eq(L.upcomingBookings(c).map(b => b.id), ['heldag', 't']);
  });
  test('nextBooking gives the first upcoming booking, otherwise null', () => {
    eq(L.nextBooking(cust({bookings: [bk('x', '2026-11-01', '10:00'), bk('y', '2026-10-28', '14:00')]})).id, 'y');
    eq(L.nextBooking(cust()), null);
    eq(L.nextBooking(cust({bookings: [bk('gammal', '2026-01-01', '10:00')]})), null);
  });
  test('hasBooking', () => {
    ok(L.hasBooking(cust({bookings: [bk('x', '2026-11-01', '10:00')]})));
    ok(!L.hasBooking(cust()), 'without bookings');
  });
  test('the filter "bokat" shows customers with an upcoming booking', () => {
    const list = [cust({id: 'med', bookings: [bk('x', '2026-11-01', '10:00')]}), cust({id: 'utan'})];
    eq(L.filterCustomers(list, {seg: 'bokat', type: 'alla', q: '', sort: 'kontakt'}).map(c => c.id), ['med']);
  });
});

describe('The 90-day limit', () => {
  test('contactDeadline is the latest contact plus 90 days', () => eq(L.contactDeadline(cust({comms: [mail('2026-09-08')]})), '2026-12-07'));
  test('contactDeadline is null without contact', () => eq(L.contactDeadline(cust()), null));
  test('future contacts do not count', () => eq(L.contactDeadline(cust({comms: [mail('2026-09-08'), mail('2026-12-24')]})), '2026-12-07'));
});

describe('calendarItems', () => {
  const byKey = items => Object.fromEntries(items.map(i => [i.key, i]));
  const base = (over = {}) => cust(Object.assign({id: 'adv', company: 'Exempelbolaget AB', comms: [mail('2026-09-08')]}, over));

  test('a booking with a time becomes an event with start, time, duration and place', () => {
    const items = L.calendarItems([base({bookings: [{id: 'b1', kind: 'mote', title: 'Kaffe med Ella', date: '2026-10-28', time: '14:00', location: 'Kontoret'}]})]);
    eq(byKey(items)['booking:adv:b1'], {key: 'booking:adv:b1', kind: 'booking', customerId: 'adv', title: 'Möte: Exempelbolaget AB – Kaffe med Ella',
      date: '2026-10-28', time: '14:00', allDay: false, durationMin: 60, location: 'Kontoret'});
  });
  test('a booking without a time is all day, and without a title only the kind and the company are used', () => {
    const it = byKey(L.calendarItems([base({bookings: [{id: 'b2', kind: 'jobb', date: '2026-11-04'}]})]))['booking:adv:b2'];
    eq(it.allDay, true);
    eq(it.title, 'Jobb: Exempelbolaget AB');
  });
  test('the booking’s own duration is used if it has one', () => {
    const it = byKey(L.calendarItems([base({bookings: [{id: 'b3', kind: 'jobb', title: 'Porträtt', date: '2026-11-04', time: '09:00', durationMin: 240}]})]))['booking:adv:b3'];
    eq(it.durationMin, 240);
  });
  test('bookings older than 7 days and bookings that came from Google Calendar are not sent', () => {
    const items = L.calendarItems([base({bookings: [
      {id: 'gammal', kind: 'mote', date: '2026-10-07', time: '10:00'},
      {id: 'nyligen', kind: 'mote', date: '2026-10-08', time: '10:00'},
      {id: 'fran-gcal', kind: 'mote', date: '2026-10-30', time: '10:00', source: 'gcal', gcalEventId: 'abc'}
    ]})]);
    const keys = items.map(i => i.key);
    ok(!keys.includes('booking:adv:gammal'), 'older than 7 days');
    ok(keys.includes('booking:adv:nyligen'), 'within 7 days');
    ok(!keys.includes('booking:adv:fran-gcal'), 'from Google Calendar');
  });
  test('a follow-up becomes an all-day reminder with the note', () => {
    const it = byKey(L.calendarItems([base({followUp: {date: '2026-10-27', note: 'Skicka uppföljningen'}})]))['followup:adv'];
    eq(it.title, 'Följ upp: Exempelbolaget AB');
    eq(it.date, '2026-10-27');
    eq(it.allDay, true);
    eq(it.note, 'Skicka uppföljningen');
  });
  test('a past follow-up is not sent', () => ok(!L.calendarItems([base({followUp: {date: '2026-10-01'}})]).some(i => i.kind === 'followup')));
  test('the 90-day limit becomes an all-day reminder for customers', () => {
    const it = byKey(L.calendarItems([base()]))['deadline:adv'];
    eq(it.title, '90 dagar utan kontakt: Exempelbolaget AB');
    eq(it.date, '2026-12-07');
    eq(it.allDay, true);
  });
  test('no 90-day reminder for potential customers, limits already passed or when a meeting is booked', () => {
    eq(L.calendarItems([base({status: 'potentiell'})]).filter(i => i.kind === 'deadline').length, 0);
    eq(L.calendarItems([base({comms: [mail('2026-05-01')]})]).filter(i => i.kind === 'deadline').length, 0);
    eq(L.calendarItems([base({bookings: [{id: 'b', kind: 'mote', date: '2026-11-01', time: '10:00'}]})]).filter(i => i.kind === 'deadline').length, 0);
  });
  test('unpaid invoices with a due date become all-day events; paid and credited ones are not sent', () => {
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
    ok(!inv['invoice:adv:j7'] && !inv['invoice:adv:j8'] && !inv['invoice:adv:j9'], 'paid, credited and without a due date are not sent');
  });
  test('example customers are never included', () => eq(L.calendarItems([base({example: true, followUp: {date: '2026-10-27'}})]), []));
  test('the contact person’s name is used if the company name is missing', () => eq(byKey(L.calendarItems([base({company: '', name: 'Anna Berg', followUp: {date: '2026-10-27'}})]))['followup:adv'].title, 'Följ upp: Anna Berg'));
  test('the events are sorted by date and have unique keys', () => {
    const items = L.calendarItems([
      base({followUp: {date: '2026-11-20'}, bookings: [{id: 'b', kind: 'mote', date: '2026-10-28', time: '14:00'}]}),
      cust({id: 'tb', company: 'Testbyrån', status: 'potentiell', followUp: {date: '2026-10-27'}})
    ]);
    eq(items.map(i => i.date), [...items.map(i => i.date)].sort());
    eq(new Set(items.map(i => i.key)).size, items.length);
  });
});

/* ---------- Events in the customer list, conflicts and follow-up after events (added 2026-10-15) ---------- */
describe('The next event and "soon"', () => {
  const ev = (id, date, over = {}) => Object.assign({id, title: 'Event ' + id, date}, over);
  test('daysUntil counts the days until a date', () => {
    eq(L.daysUntil(TODAY), 0);
    eq(L.daysUntil('2026-10-29'), 14);
    eq(L.daysUntil('2026-10-14'), -1);
  });
  test('nextEvent includes events where an offer has been sent, but not hidden or past ones', () => {
    const c = cust({events: [ev('dolt', '2026-10-20', {dismissed: true}), ev('gammalt', '2026-10-01'), ev('erbjudet', '2026-11-03', {offeredAt: '2026-10-13'}), ev('senare', '2026-12-01')]});
    eq(L.nextEvent(c).id, 'erbjudet');
    eq(L.nextEvent(cust()), null);
  });
  test('eventSoon covers events within 14 days, offered or not', () => {
    ok(L.eventSoon(cust({events: [ev('a', '2026-10-29', {offeredAt: '2026-10-10'})]})), '14 days ahead');
    ok(L.eventSoon(cust({events: [ev('idag', TODAY)]})), 'today');
    ok(!L.eventSoon(cust({events: [ev('b', '2026-10-30')]})), '15 days ahead');
    ok(!L.eventSoon(cust()), 'no events');
  });
  test('eventSoon counts an ongoing multi-day event as soon', () => ok(L.eventSoon(cust({events: [ev('p', '2026-10-14', {endDate: '2026-10-16'})]}))));
});

describe('Events to follow up after', () => {
  const ev = (id, date, over = {}) => Object.assign({id, title: 'Event ' + id, date}, over);
  test('events that ended within 30 days are to be followed up, the latest first', () => {
    const c = cust({events: [ev('igar', '2026-10-14'), ev('forra', '2026-10-01'), ev('gammal', '2026-09-14'), ev('framtid', '2026-10-20')]});
    eq(L.eventsToFollowUp(c).map(e => e.id), ['igar', 'forra']);
  });
  test('exactly 30 days ago counts', () => eq(L.eventsToFollowUp(cust({events: [ev('x', '2026-09-15')]})).length, 1));
  test('a multi-day event is followed up only when its last day has passed', () => {
    eq(L.eventsToFollowUp(cust({events: [ev('p', '2026-10-13', {endDate: TODAY})]})).length, 0);
    eq(L.eventsToFollowUp(cust({events: [ev('p', '2026-10-12', {endDate: '2026-10-14'})]})).length, 1);
  });
  test('hidden events and events whose follow-up was sent are not followed up', () => {
    eq(L.eventsToFollowUp(cust({events: [ev('d', '2026-10-10', {dismissed: true}), ev('s', '2026-10-10', {followUpSentAt: '2026-10-13'})]})).length, 0);
  });
  test('potential customers are not followed up on events', () => eq(L.eventsToFollowUp(cust({status: 'potentiell', events: [ev('x', '2026-10-10')]})).length, 0));
});

describe('Conflicts between customer events and what is booked', () => {
  const others = [
    cust({id: 'adv', company: 'Exempelbolaget AB', bookings: [{id: 'b1', kind: 'jobb', title: 'Porträtt', date: '2026-11-03', time: '09:00'}, {id: 'b2', kind: 'mote', date: '2026-11-10', time: '14:00'}]}),
    cust({id: 'tb', company: 'Testbyrån', bookings: [{id: 'b3', kind: 'samtal', title: 'Avstämning', date: '2026-11-04', time: ''}]})
  ];
  test('a booking on the same day at any customer is a conflict', () => {
    eq(L.eventConflicts({date: '2026-11-03'}, others), [{date: '2026-11-03', time: '09:00', title: 'Jobb: Exempelbolaget AB – Porträtt', source: 'bokning', customerId: 'adv'}]);
  });
  test('a multi-day event conflicts with everything in the period, sorted by date', () => {
    eq(L.eventConflicts({date: '2026-11-03', endDate: '2026-11-04'}, others).map(k => k.title), ['Jobb: Exempelbolaget AB – Porträtt', 'Samtal: Testbyrån – Avstämning']);
  });
  test('events in Google Calendar count too', () => {
    const busy = [{date: '2026-11-03', time: '18:00', title: 'Tandläkare'}, {date: '2026-11-05', time: '10:00', title: 'Annat'}];
    const k = L.eventConflicts({date: '2026-11-03'}, [], busy);
    eq(k, [{date: '2026-11-03', time: '18:00', title: 'Tandläkare', source: 'kalender'}]);
  });
  test('no conflicts give an empty list', () => {
    eq(L.eventConflicts({date: '2026-11-20'}, others, []), []);
    eq(L.eventConflicts({date: '2026-11-20'}, [], undefined), []);
  });
  test('bookings from Google Calendar are counted only once', () => {
    const c = [cust({id: 'x', company: 'X', bookings: [{id: 'g', kind: 'mote', title: 'Möte', date: '2026-11-03', time: '10:00', source: 'gcal', gcalEventId: 'abc'}]})];
    const busy = [{date: '2026-11-03', time: '10:00', title: 'Möte', eventId: 'abc'}];
    eq(L.eventConflicts({date: '2026-11-03'}, c, busy).length, 1);
  });
});

/* ---------- Event badges in the customer list and several customer types (added 2026-10-15) ---------- */
describe('eventBadge – the badge in the customer list', () => {
  const ev = (id, date, over = {}) => Object.assign({id, title: 'Event ' + id, date}, over);
  test('unhandled events (not hidden, no offer) give "to offer" with a count', () => {
    eq(L.eventBadge(cust({events: [ev('a', '2026-11-03'), ev('b', '2026-12-01'), ev('c', '2026-11-10', {offeredAt: '2026-10-13'}), ev('d', '2026-11-20', {dismissed: true})]})), {kind: 'offer', count: 2});
  });
  test('an unhandled event more than 14 days ahead still gives "to offer"', () => eq(L.eventBadge(cust({events: [ev('a', '2027-02-01')]})), {kind: 'offer', count: 1}));
  test('all handled but an event within 14 days gives "soon"', () => eq(L.eventBadge(cust({events: [ev('a', '2026-10-20', {offeredAt: '2026-10-10'})]})), {kind: 'soon', count: 0}));
  test('all handled and nothing within 14 days gives no badge', () => eq(L.eventBadge(cust({events: [ev('a', '2026-12-20', {offeredAt: '2026-10-10'})]})), null));
  test('past and hidden events give no badge', () => eq(L.eventBadge(cust({events: [ev('a', '2026-10-01'), ev('b', '2026-11-01', {dismissed: true})]})), null));
  test('potential customers get no event badge', () => eq(L.eventBadge(cust({status: 'potentiell', events: [ev('a', '2026-11-03')]})), null));
});

describe('Customer types: CV, Foto, Video, Live, Sport (several per customer)', () => {
  test('SERVICE_TYPES in the order CV, Foto, Video, Live, Sport', () => eq(L.SERVICE_TYPES, {cv: 'CV', foto: 'Foto', video: 'Video', live: 'Live', sport: 'Sport'}));
  test('customerTypes reads the types list in a fixed order, without duplicates and unknown values', () => {
    eq(L.customerTypes(cust({types: ['sport', 'live', 'cv', 'live', 'okand']})), ['cv', 'live', 'sport']);
  });
  test('an empty types list means no types, even with an old type field', () => eq(L.customerTypes({type: 'headshot', types: []}), []));
  test('the filter on the new types uses all of the customer’s types', () => {
    const list = [cust({id: 'a', types: ['cv', 'video']}), cust({id: 'b', types: ['live']}), cust({id: 'c', types: ['live']}), cust({id: 'd', types: ['live', 'sport']})];
    eq(L.filterCustomers(list, {seg: 'alla', type: 'video', q: '', sort: 'namn'}).map(c => c.id), ['a']);
    eq(L.filterCustomers(list, {seg: 'alla', type: 'live', q: '', sort: 'namn'}).map(c => c.id).sort(), ['b', 'c', 'd']);
    eq(L.filterCustomers(list, {seg: 'alla', type: 'sport', q: '', sort: 'namn'}).map(c => c.id), ['d']);
  });
});

describe('calendarItems: a reminder to follow up after an event', () => {
  const byKey = items => Object.fromEntries(items.map(i => [i.key, i]));
  const base = (events, over = {}) => cust(Object.assign({id: 'adv', company: 'Exempelbolaget AB', comms: [mail('2026-10-13')], events}, over));
  test('a reminder three days after the event’s last day', () => {
    const it = byKey(L.calendarItems([base([{id: 'e1', title: 'Kunddagen', date: '2026-11-03'}])]))['eventfu:adv:e1'];
    eq(it.title, 'Följ upp event: Exempelbolaget AB – Kunddagen');
    eq(it.date, '2026-11-06');
    eq(it.allDay, true);
    eq(it.kind, 'eventfu');
  });
  test('a multi-day event counts from its last day', () => eq(byKey(L.calendarItems([base([{id: 'e2', title: 'Mässa', date: '2026-11-03', endDate: '2026-11-05'}])]))['eventfu:adv:e2'].date, '2026-11-08'));
  test('no reminder for hidden events, events already followed up, past reminders or potential customers', () => {
    const items = L.calendarItems([
      base([{id: 'd', title: 'D', date: '2026-11-03', dismissed: true}, {id: 's', title: 'S', date: '2026-11-03', followUpSentAt: '2026-11-04'}, {id: 'p', title: 'P', date: '2026-10-01'}]),
      cust({id: 'pot', company: 'Pot', status: 'potentiell', events: [{id: 'x', title: 'X', date: '2026-11-03'}]})
    ]);
    eq(items.filter(i => i.kind === 'eventfu'), []);
  });
});

describe('The customer list: the removed event filter', () => {
  const list = [
    cust({id: 'utan', company: 'Utan event AB', comms: [mail('2026-10-01')]}),
    cust({id: 'med', company: 'Med event AB', comms: [mail('2026-10-01')], events: [{id: 'e1', title: 'Seminarium', date: '2026-11-03'}]})
  ];
  test('an old filter value "event" filters out no customer', () => eq(L.filterCustomers(list, {seg: 'event', type: 'alla', q: '', sort: 'namn'}).map(c => c.id), ['med', 'utan']));
});

describe('Old type names removed', () => {
  test('the old constant TYPES is no longer exported', () => eq(L.TYPES, undefined));
});