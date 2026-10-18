/* Tests for the parts of the shared logic (kundregister/logic.ts) that came with the React list: counts per segment,
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
  test('customerFormPatch writes the old type field only when the brand asks for it (legacyWrite)', () => {
    L().setBrand({company: {name: 'X'}, colors: {accent: '#0f766e', ink: '#1f2933', bg: '#f6f7f7'}, senders: [{id: 's', signature: ['X']}], defaultSender: 's',
      customerTypes: [{id: 'a', label: 'A', color: '#111111'}], legacyWrite: [{type: 'gammal', ifAny: ['a']}]} as unknown as Brand);
    expect(L().customerFormPatch({company: 'X', status: 'kund', types: ['a']}).patch.type).toBe('gammal');
    L().setBrand(null);
    expect('type' in L().customerFormPatch({company: 'X', status: 'kund', types: []}).patch).toBe(false);
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
