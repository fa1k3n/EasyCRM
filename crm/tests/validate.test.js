/* Unit tests for validateCustomer: the check of a customer document that the REST API runs before every write.
 * Known fields are type-checked (issues in the document's field order), unknown fields and ext are kept, null counts
 * as missing. */
(function () {
  const L = window.CRMLogic;
  const paths = issues => issues.map(i => i.path);
  const full = {
    company: 'Exempelbolaget AB', name: 'Anna Exempel', email: 'anna@exempel.se', status: 'kund', types: ['konsultation'],
    lastContact: '2026-10-01', comms: [{id: 'm1', kind: 'mail_ut', date: '2026-10-01', subject: 'Hej'}],
    jobs: [{id: 'j1', title: 'Jobb', invoiceNumber: 12, dueDate: '2026-11-01'}],
    events: [{id: 'e1', title: 'Mässa', date: '2026-11-10', dismissed: false, offeredAt: null}],
    bookings: [{id: 'b1', kind: 'mote', date: '2026-10-20', time: '10:00', durationMin: 60}],
    followUp: {date: '2026-10-30', note: 'Ring'}, draft: null, ext: {'next-step': {text: 'x', n: 1}},
    agentField: {anything: true}
  };

  describe('validateCustomer: valid documents', () => {
    test('a full document has no issues', () => eq(L.validateCustomer(full), []));
    test('an empty document has no issues', () => eq(L.validateCustomer({}), []));
    test('null counts as a missing field', () => eq(L.validateCustomer({company: null, comms: null, followUp: null, lastContact: null}), []));
    test('a date with a time after it is accepted', () => eq(L.validateCustomer({lastContact: '2026-10-01T10:00:00Z'}), []));
  });

  describe('validateCustomer: invalid documents', () => {
    test('the document must be an object', () => {
      for (const bad of [null, [], 'x', 3]) eq(paths(L.validateCustomer(bad)), ['']);
    });
    test('text fields must be text', () => eq(paths(L.validateCustomer({company: 1, email: true})), ['company', 'email']));
    test('status must be kund or potentiell', () => {
      eq(paths(L.validateCustomer({status: 'gammal'})), ['status']);
      eq(L.validateCustomer({status: 'potentiell'}), []);
    });
    test('types must be a list of texts', () => {
      eq(paths(L.validateCustomer({types: 'konsultation'})), ['types']);
      eq(paths(L.validateCustomer({types: ['a', 2]})), ['types[1]']);
    });
    test('dates must start with YYYY-MM-DD', () => eq(paths(L.validateCustomer({lastContact: '1/10 2026', addedAt: '2026-1-1'})), ['lastContact', 'addedAt']));
    test('the lists must be lists of objects', () => {
      eq(paths(L.validateCustomer({comms: {}, jobs: [1]})), ['comms', 'jobs[0]']);
    });
    test('the fields of list elements are checked', () => {
      eq(paths(L.validateCustomer({
        comms: [{date: 'igår'}], jobs: [{invoiceNumber: true}], events: [{dismissed: 'ja', offeredAt: 5}], bookings: [{durationMin: '60'}]
      })), ['comms[0].date', 'jobs[0].invoiceNumber', 'events[0].dismissed', 'events[0].offeredAt', 'bookings[0].durationMin']);
    });
    test('followUp, draft, lastMail and lastJob must be objects', () => {
      eq(paths(L.validateCustomer({followUp: 'x', draft: [], lastMail: 1, lastJob: 'y'})), ['followUp', 'draft', 'lastMail', 'lastJob']);
      eq(paths(L.validateCustomer({followUp: {date: 'snart'}})), ['followUp.date']);
    });
    test('ext must be an object; its contents are the extensions\' own', () => {
      eq(paths(L.validateCustomer({ext: []})), ['ext']);
      eq(L.validateCustomer({ext: {a: [1, 'x', null]}}), []);
    });
    test('emailConfidence must be publicerad or gissad, example a boolean', () => {
      eq(paths(L.validateCustomer({emailConfidence: 'kanske', example: 'ja'})), ['emailConfidence', 'example']);
    });
    test('every issue has a message', () => ok(L.validateCustomer({status: 1}).every(i => typeof i.message === 'string' && i.message)));
  });
})();
