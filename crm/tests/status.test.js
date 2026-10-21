/* Unit tests for the status "kontaktad": validation, the rules that apply to customers, and the list's quick
 * filters (status and flags, combined). "Today" is 2026-10-15. */
(function () {
  const L = window.CRMLogic;
  const at = fn => { L.setClock(() => new Date('2026-10-15T12:00:00')); try { fn(); } finally { L.setClock(null); } };
  const call = date => ({id: 'm' + date, kind: 'samtal', date});
  const c = (over = {}) => Object.assign({id: 'c1', company: 'Exempelbolaget AB', status: 'kontaktad', comms: [call('2026-10-01')], jobs: [], events: []}, over);

  describe('The status kontaktad: data and rules', () => {
    test('validateCustomer accepts kontaktad and still refuses an unknown status', () => {
      eq(L.validateCustomer(c()), []);
      ok(L.validateCustomer(c({status: 'okänd'})).length === 1);
    });
    test('statusPatch sets kontaktad', () => eq(L.statusPatch('kontaktad'), {status: 'kontaktad'}));
    test('events are offered and followed up as for customers', () => at(() => {
      const e = {id: 'e1', title: 'Mässa', date: '2026-10-25'};
      ok(L.eventOpen(c({events: [e]}), e));
      eq(L.eventBadge(c({events: [e]})).kind, 'offer');
      eq(L.eventsToFollowUp(c({events: [{id: 'e2', title: 'Seminarium', date: '2026-10-10'}]})).length, 1);
    }));
    test('the 90-day limit and the event follow-up are in the calendar as for customers', () => at(() => {
      const keys = L.calendarItems([c({events: [{id: 'e2', title: 'Seminarium', date: '2026-10-14'}]})]).map(i => i.key);
      ok(keys.includes('deadline:c1'), keys.join());
      ok(keys.includes('eventfu:c1:e2'), keys.join());
    }));
  });

  describe('statusOf: the status as the list and the app see it', () => {
    test('kontaktad and potentiell as they are; missing or unknown is kund', () => {
      eq(['kund', 'kontaktad', 'potentiell', undefined, 'gammal'].map(status => L.statusOf({status})), ['kund', 'kontaktad', 'potentiell', 'kund', 'kund']);
    });
  });

  describe('The list: status filters, flags and the segment kontaktade', () => {
    const list = () => [
      c({id: 'kund', status: 'kund', comms: [call('2026-01-01')]}),
      c({id: 'nostatus', status: undefined}),
      c({id: 'kontaktad'}),
      c({id: 'kontaktad-red', comms: [call('2026-01-01')]}),
      c({id: 'prospekt', status: 'potentiell', comms: []}),
      c({id: 'booked', status: 'kund', bookings: [{id: 'b1', date: '2026-10-20'}]})
    ];
    const ids = view => L.filterCustomers(list(), Object.assign({type: 'alla', q: '', sort: 'namn'}, view)).map(x => x.id).sort();
    test('no filter shows everybody', () => at(() => eq(ids({}).length, 6)));
    test('one status', () => at(() => {
      eq(ids({status: ['kund']}), ['booked', 'kund', 'nostatus']);
      eq(ids({status: ['kontaktad']}), ['kontaktad', 'kontaktad-red']);
      eq(ids({status: ['potentiell']}), ['prospekt']);
    }));
    test('several statuses: either', () => at(() => eq(ids({status: ['kontaktad', 'potentiell']}), ['kontaktad', 'kontaktad-red', 'prospekt'])));
    test('flags: either within the group', () => at(() => {
      eq(ids({flags: ['kontakta']}), ['kontaktad-red', 'kund', 'prospekt']);
      eq(ids({flags: ['kontakta', 'bokat']}), ['booked', 'kontaktad-red', 'kund', 'prospekt']);
    }));
    test('status and flags: both must hold', () => at(() => eq(ids({status: ['kontaktad', 'potentiell'], flags: ['kontakta']}), ['kontaktad-red', 'prospekt'])));
    test('an empty list is no filter', () => at(() => eq(ids({status: [], flags: []}).length, 6)));
    test('the segment "kunder" no longer includes kontaktad; "kontaktade" is only kontaktad', () => at(() => {
      eq(ids({seg: 'kunder'}), ['booked', 'kund', 'nostatus']);
      eq(ids({seg: 'kontaktade'}), ['kontaktad', 'kontaktad-red']);
      eq(ids({seg: 'potentiella'}), ['prospekt']);
    }));
    test('segmentCounts has kontaktade', () => at(() => {
      const n = L.segmentCounts(list());
      eq([n.kunder, n.kontaktade, n.potentiella, n.kontakta, n.bokat], [3, 2, 1, 3, 1]);
    }));
  });
})();
