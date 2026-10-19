/* Tests for the parts of the shared logic (crm/logic/) that came with the React list: counts per segment,
 * when an event is, and whether an event is open. "Today" is fixed. All customers are made up. */
const TODAY = '2026-10-15';
const daysAgo = (n: number) => { const d = new Date(TODAY + 'T12:00:00'); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
const L = () => window.CRMLogic;

beforeEach(() => L().setClock(() => new Date(TODAY + 'T12:00:00')));
afterEach(() => L().setClock(null));

test('segmentCounts counts all, to contact, booked, customers and potential customers', () => {
  const cs = [
    {status: 'kund', comms: [{kind: 'mail_ut', date: daysAgo(140)}]},
    {status: 'kund', comms: [{kind: 'mail_ut', date: daysAgo(5)}], bookings: [{id: 'b', date: '2026-10-20'}]},
    {status: 'potentiell'}
  ];
  expect(L().segmentCounts(cs)).toEqual({alla: 3, kontakta: 2, bokat: 1, kunder: 2, potentiella: 1});
});

test('eventWhen: ongoing, today, tomorrow or a number of days', () => {
  expect(L().eventWhen({date: '2026-10-14'})).toEqual({kind: 'ongoing', days: -1});
  expect(L().eventWhen({date: TODAY})).toEqual({kind: 'today', days: 0});
  expect(L().eventWhen({date: '2026-10-16'})).toEqual({kind: 'tomorrow', days: 1});
  expect(L().eventWhen({date: '2026-10-27'})).toEqual({kind: 'days', days: 12});
});

test('eventOpen: an event at a customer (not potential) with no offer sent', () => {
  expect(L().eventOpen({status: 'kund'}, {date: '2026-10-27'})).toBe(true);
  expect(L().eventOpen({status: 'kund'}, {date: '2026-10-27', offeredAt: '2026-10-01'})).toBe(false);
  expect(L().eventOpen({status: 'potentiell'}, {date: '2026-10-27'})).toBe(false);
  expect(L().eventOpen({status: 'kund'}, null)).toBe(false);
});

describe('the customer card writes (pure patches, written with update on the customer)', () => {
  test('addCommPatch adds the contact, updates the last contact, and the last mail for a mail', () => {
    const c = {comms: [{id: 'a', kind: 'samtal', date: daysAgo(30)}], jobs: []};
    const p = L().addCommPatch(c, {id: 'b', kind: 'mail_ut', date: TODAY, subject: 'Offert'});
    expect(p.comms!.map(m => m.id)).toEqual(['a', 'b']);
    expect(p.lastContact).toBe(TODAY);
    expect(p.lastMail).toEqual({date: TODAY, subject: 'Offert'});
    expect(L().addCommPatch(c, {id: 'c', kind: 'samtal', date: TODAY}).lastMail).toBeUndefined();
  });
  test('removeCommPatch removes the contact and recalculates the last contact from what is left', () => {
    const c = {comms: [{id: 'a', kind: 'samtal', date: daysAgo(30)}, {id: 'b', kind: 'samtal', date: TODAY}], jobs: []};
    const p = L().removeCommPatch(c, 'b');
    expect(p.comms!.map(m => m.id)).toEqual(['a']);
    expect(p.lastContact).toBe(daysAgo(30));
  });
  test('addJobPatch adds the job, sets lastJob and counts the job as contact; removeJobPatch takes it away', () => {
    const c = {comms: [], jobs: []};
    const p = L().addJobPatch(c, {id: 'j', title: 'Porträtt', date: TODAY});
    expect(p.jobs!.map(j => j.id)).toEqual(['j']);
    expect(p.lastJob).toEqual({title: 'Porträtt', date: TODAY});
    expect(p.lastContact).toBe(TODAY);
    const r = L().removeJobPatch({...c, jobs: p.jobs}, 'j');
    expect(r.jobs).toEqual([]);
    expect(r.lastContact).toBeNull();
  });
});

test('an incoming mail also counts as the last mail; removing a job keeps the last contact from what is left', () => {
  expect(L().addCommPatch({comms: []}, {id: 'x', kind: 'mail_in', date: TODAY, subject: 'Svar'}).lastMail).toEqual({date: TODAY, subject: 'Svar'});
  const c = {comms: [{id: 'a', kind: 'samtal', date: daysAgo(20)}], jobs: [{id: 'j', title: 'Jobb', date: TODAY}]};
  expect(L().removeJobPatch(c, 'j').lastContact).toBe(daysAgo(20));
});

describe('bookings on the customer card', () => {
  const c = {bookings: [
    {id: 'b1', kind: 'mote', date: daysAgo(10), time: '09:00'},
    {id: 'b2', kind: 'jobb', date: daysAgo(3), time: '14:00'},
    {id: 'b3', kind: 'samtal', date: daysAgo(3), time: '10:00'},
    {id: 'b4', kind: 'mote', date: daysAgo(-4)}
  ]};
  test('pastBookings: bookings before today, the latest first', () => {
    expect(L().pastBookings(c).map(b => b.id)).toEqual(['b2', 'b3', 'b1']);
  });
  test('addBookingPatch and removeBookingPatch', () => {
    expect(L().addBookingPatch(c, {id: 'b5', date: TODAY}).bookings!.map(b => b.id)).toEqual(['b1', 'b2', 'b3', 'b4', 'b5']);
    expect(L().removeBookingPatch(c, 'b2').bookings!.map(b => b.id)).toEqual(['b1', 'b3', 'b4']);
  });
});

describe('the customer form and the status change', () => {
  test('statusPatch changes only the status (nothing else in the document)', () => {
    expect(L().statusPatch('kund')).toEqual({status: 'kund'});
    expect(L().statusPatch('potentiell')).toEqual({status: 'potentiell'});
  });
  test('customerFormPatch trims the fields, keeps the types and needs a company or a contact person', () => {
    const r = L().customerFormPatch({company: '  Exempel AB ', name: '', role: ' VD ', email: ' a@exempel.se ', phone: '', website: '', city: '', notes: ' Hej ', status: 'kund', types: ['x']});
    expect(r.errors).toEqual([]);
    expect(r.patch).toMatchObject({company: 'Exempel AB', name: '', role: 'VD', email: 'a@exempel.se', notes: 'Hej', status: 'kund', types: ['x']});
    expect(L().customerFormPatch({company: ' ', name: '', status: 'kund', types: []}).errors).toEqual(['companyOrName']);
  });
  test('customerFormPatch never writes type, even for a brand.json with the old legacyWrite', () => {
    L().setBrand({company: {name: 'X'}, colors: {accent: '#0f766e', ink: '#1f2933', bg: '#f6f7f7'}, senders: [{id: 's', signature: ['X']}], defaultSender: 's',
      customerTypes: [{id: 'a', label: 'A', color: '#111111'}], legacyWrite: [{type: 'gammal', ifAny: ['a']}]} as unknown as Brand);
    expect('type' in L().customerFormPatch({company: 'X', status: 'kund', types: ['a']}).patch).toBe(false);
    L().setBrand(null);
  });
});

describe('icons for customer types (step 2.9)', () => {
  const brand = (types: unknown[]) => ({company: {name: 'X'}, colors: {accent: '#0f766e', ink: '#1f2933', bg: '#f6f7f7'},
    senders: [{id: 's', signature: ['X']}], defaultSender: 's', customerTypes: types} as unknown as Brand);
  afterEach(() => L().setBrand(null));
  test('typeIcon: own svg first, then an icon of the own set, then a lucide name, otherwise the dot', () => {
    L().setBrand(brand([
      {id: 'a', label: 'A', color: '#111111', svg: '<circle cx="8" cy="8" r="3"/>', icon: 'kamera'},
      {id: 'b', label: 'B', color: '#111111', icon: 'kamera'},
      {id: 'c', label: 'C', color: '#111111', icon: 'briefcase-business'},
      {id: 'd', label: 'D', color: '#111111'}
    ]));
    expect(L().typeIcon('a')).toEqual({kind: 'svg', svg: '<circle cx="8" cy="8" r="3"/>'});
    expect(L().typeIcon('b')).toEqual({kind: 'own', name: 'kamera'});
    expect(L().typeIcon('c')).toEqual({kind: 'lucide', name: 'briefcase-business'});
    expect(L().typeIcon('d')).toEqual({kind: 'own', name: 'prick'});
    expect(L().typeIcon('finns-inte')).toEqual({kind: 'own', name: 'prick'});
  });
  test('all the old icon names are still the own set', () => {
    expect(L().OWN_ICONS).toEqual(['person', 'kamera', 'film', 'sandning', 'pokal', 'pratbubbla', 'portfolj', 'stjarna', 'kalender', 'prick']);
  });
  test('validateBrand accepts old names and lucide names (kebab-case), not other text', () => {
    expect(L().validateBrand(brand([{id: 'a', label: 'A', color: '#111111', icon: 'stjarna'}, {id: 'b', label: 'B', color: '#111111', icon: 'calendar-days'}]))).toEqual([]);
    expect(L().validateBrand(brand([{id: 'a', label: 'A', color: '#111111', icon: 'Calendar Days'}])).join()).toMatch('customerTypes[0].icon');
  });
});

describe('events and drafts (step 2.12)', () => {
  const ev = (id: string, x = {}) => ({id, title: `Event ${id}`, date: '2026-11-01', ...x});
  test('addEventPatch adds the event last; dismissEventPatch hides and shows one event, the others unchanged', () => {
    const c = {events: [ev('a'), ev('b')]};
    expect(L().addEventPatch(c, ev('c')).events!.map(e => e.id)).toEqual(['a', 'b', 'c']);
    expect(L().dismissEventPatch(c, 'b', true).events).toEqual([ev('a'), ev('b', {dismissed: true})]);
    expect(L().dismissEventPatch({events: [ev('a', {dismissed: true})]}, 'a', false).events).toEqual([ev('a', {dismissed: false})]);
  });
  test('draftSentPatch logs the draft as a sent mail, removes the draft and marks its event', () => {
    const c = {comms: [], jobs: [], events: [ev('e1')], draft: {subject: 'Hej', body: 'Text', summary: 'Erbjudande', eventId: 'e1', kind: 'offer'}};
    const p = L().draftSentPatch(c, 'm1');
    expect(p.draft).toBeNull();
    expect(p.comms).toEqual([{id: 'm1', kind: 'mail_ut', date: TODAY, subject: 'Hej', note: 'Erbjudande', body: 'Text'}]);
    expect(p.lastContact).toBe(TODAY);
    expect(p.lastMail).toEqual({date: TODAY, subject: 'Hej'});
    expect(p.events![0].offeredAt).toBe(TODAY);
  });
  test('draftSentPatch for a follow-up draft marks followUpSentAt; without an event no events are written', () => {
    const fu = L().draftSentPatch({events: [ev('e1')], draft: {subject: 'S', body: 'B', eventId: 'e1', kind: 'eventfu'}}, 'm');
    expect(fu.events![0].followUpSentAt).toBe(TODAY);
    const plain = L().draftSentPatch({draft: {subject: 'S', body: 'B'}}, 'm');
    expect('events' in plain).toBe(false);
    expect(plain.comms![0].note).toBe('Mail skickat från utkast');
  });
});

test('the public API has no exports that nothing uses', () => {
  for (const name of ['esc', 'WARN', 'MONTHS', 'contactScore']) expect(name in L()).toBe(false);
});

test('customerTypes reads only types: the old field type gives no types, and legacyType is gone', () => {
  L().setBrand({company: {name: 'X'}, colors: {accent: '#0f766e', ink: '#1f2933', bg: '#f6f7f7'}, senders: [{id: 's', signature: ['X']}], defaultSender: 's',
    customerTypes: [{id: 'a', label: 'A', color: '#111111'}], legacyTypes: {gammal: ['a']}} as unknown as Brand);
  try {
    expect(L().customerTypes({type: 'gammal'} as unknown as Customer)).toEqual([]);
    expect(L().customerTypes({types: ['a']})).toEqual(['a']);
    expect('legacyType' in L()).toBe(false);
  } finally {
    L().setBrand(null);
  }
});

describe('the logic in English (brand.json language "en")', () => {
  const en = {company: {name: 'Example Ltd'}, language: 'en', colors: {accent: '#0f766e', ink: '#1f2933', bg: '#f6f7f7'}, senders: [{id: 's', signature: ['X']}],
    defaultSender: 's', customerTypes: [{id: 'a', label: 'A', color: '#111111'}]} as unknown as Brand;
  beforeEach(() => L().setBrand(en));
  afterEach(() => L().setBrand(null));

  test('contact status, kinds, booking kinds and invoice statuses', () => {
    expect(L().daysLabel({level: 'never', days: null, d: null})).toBe('Not contacted');
    expect(L().daysLabel({level: 'ok', days: 0, d: TODAY})).toBe('Today');
    expect(L().daysLabel({level: 'ok', days: 5, d: daysAgo(5)})).toBe('5 d ago');
    expect(L().KINDS.mote).toBe('Meeting');
    expect(L().BOOKING_KINDS.jobb).toBe('Job');
    expect(L().INV_STATUS.overdue).toBe('Overdue');
    expect(L().dayMonth('2026-11-05')).toBe('5 November');
  });
  test('log entries without a mail extension, and calendar items', () => {
    expect(L().logOnlyEntry({title: 'The fair', date: '2026-11-05'}, 'offer')).toEqual({subject: 'Offer before The fair', note: 'Offer before The fair (05/11 2026) logged as sent.'});
    expect(L().logOnlyEntry({date: '2026-11-05'}, 'eventfu').subject).toBe('Follow-up after the event');
    const items = L().calendarItems([{id: 'c', company: 'Example Ltd', status: 'kund', followUp: {date: '2026-10-20'},
      jobs: [{id: 'j', invoiceNumber: '7', invoiceStatus: 'overdue', dueDate: '2026-10-25', amount: '100'}]} as Customer]);
    expect(items.map(i => i.title)).toEqual(['Follow up: Example Ltd', 'Due: invoice #7 Example Ltd (100 SEK)']);
  });
  test('validateBrand answers in the language of the brand it checks', () => {
    L().setBrand(null);
    const broken = {...en, company: {}} as unknown as Brand;
    expect(L().validateBrand(broken)).toContain('company.name is missing (the company name)');
    expect(L().validateBrand({...broken, language: 'sv'} as unknown as Brand)).toContain('company.name saknas (företagets namn)');
  });
  test('Swedish when the brand has no language', () => {
    L().setBrand(null);
    expect(L().KINDS.mote).toBe('Möte');
    expect(L().daysLabel({level: 'never', days: null, d: null})).toBe('Ej kontaktad');
  });
});

test('the example brand (example/brand.json) is in English and passes validateBrand', () => {
  const example = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'example', 'brand.json'), 'utf8'));
  expect(example.language).toBe('en');
  expect(L().validateBrand(example)).toEqual([]);
});

describe('the logic’s tables follow the brand language, in full', () => {
  const brand = (language: string) => ({company: {name: 'X'}, language, colors: {accent: '#0f766e', ink: '#1f2933', bg: '#f6f7f7'}, senders: [{id: 's', signature: ['X']}],
    defaultSender: 's', customerTypes: [{id: 'a', label: 'A', color: '#111111'}]} as unknown as Brand);
  afterEach(() => L().setBrand(null));

  test('with language "sv" (explicitly) everything is Swedish', () => {
    L().setBrand(brand('sv'));
    expect(L().KINDS).toEqual({mail_ut: 'Mail skickat', mail_in: 'Mail mottaget', samtal: 'Samtal', mote: 'Möte', ovrigt: 'Övrigt'});
    expect(L().BOOKING_KINDS).toEqual({jobb: 'Jobb', mote: 'Möte', samtal: 'Samtal'});
    expect(L().INV_STATUS).toEqual({published: 'Skickad', paid: 'Betald', overPaid: 'Överbetald', underPaid: 'Delbetald', overdue: 'Förfallen', credited: 'Krediterad', credit: 'Kreditnota'});
    expect(L().daysLabel({level: 'ok', days: 5, d: daysAgo(5)})).toBe('5 d sedan');
  });
  test('with language "en" everything is English', () => {
    L().setBrand(brand('en'));
    expect(L().KINDS).toEqual({mail_ut: 'Mail sent', mail_in: 'Mail received', samtal: 'Call', mote: 'Meeting', ovrigt: 'Other'});
    expect(L().BOOKING_KINDS).toEqual({jobb: 'Job', mote: 'Meeting', samtal: 'Call'});
    expect(L().INV_STATUS).toEqual({published: 'Sent', paid: 'Paid', overPaid: 'Overpaid', underPaid: 'Partly paid', overdue: 'Overdue', credited: 'Credited', credit: 'Credit note'});
  });
  test('an invalid colour is named in the brand language', () => {
    L().setBrand(brand('sv'));
    expect(() => L().deriveColors({accent: 'x', ink: '#000000', bg: '#ffffff'})).toThrow('Ogiltig färg');
    L().setBrand(brand('en'));
    expect(() => L().deriveColors({accent: 'x', ink: '#000000', bg: '#ffffff'})).toThrow('Invalid colour');
  });
  test('typeColors names a broken customer type colour in the brand language', () => {
    // setBrand checks the colours, so the colour is broken afterwards, in the brand object the logic keeps
    for (const [language, field] of [['sv', 'kundtyp a'], ['en', 'customer type a']]) {
      const b = brand(language);
      L().setBrand(b);
      (b.customerTypes[0] as {colorDark?: string}).colorDark = 'not-a-colour';
      expect(() => L().typeColors()).toThrow(field);
    }
  });
});
