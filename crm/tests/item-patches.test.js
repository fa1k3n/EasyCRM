/* Unit tests for the list patches the REST API uses (the same rules as the app's own patches): adding, replacing or
 * changing an element in place, removing it, and marking an event as offered or followed up. "Today" is 2026-10-15. */
(function () {
  const L = window.CRMLogic;
  const at = fn => { L.setClock(() => new Date('2026-10-15T12:00:00')); try { fn(); } finally { L.setClock(null); } };
  const c = () => ({company: 'Exempelbolaget AB', comms: [{id: 'm1', kind: 'samtal', date: '2026-09-01'}], jobs: [{id: 'j1', title: 'A', date: '2026-08-01'}],
    events: [{id: 'e1', title: 'Mässa', date: '2026-11-10'}], bookings: [{id: 'b1', date: '2026-10-20'}]});

  describe('addItemPatch: the app\'s rules per list', () => {
    test('comms is addCommPatch (latest contact, latest mail)', () => at(() => {
      const m = {id: 'm2', kind: 'mail_ut', date: '2026-10-01', subject: 'Hej'};
      eq(L.addItemPatch(c(), 'comms', m), L.addCommPatch(c(), m));
    }));
    test('jobs is addJobPatch, bookings addBookingPatch, events addEventPatch', () => at(() => {
      const j = {id: 'j2', title: 'B', date: '2026-10-02'};
      eq(L.addItemPatch(c(), 'jobs', j), L.addJobPatch(c(), j));
      eq(L.addItemPatch(c(), 'bookings', {id: 'b2'}), L.addBookingPatch(c(), {id: 'b2'}));
      eq(L.addItemPatch(c(), 'events', {id: 'e2'}), L.addEventPatch(c(), {id: 'e2'}));
    }));
  });

  describe('replaceItemPatch: an element replaced in place by its id', () => {
    test('the element keeps its place; for comms the latest contact is worked out again', () => at(() => {
      const p = L.replaceItemPatch({...c(), comms: [{id: 'm1', kind: 'samtal', date: '2026-09-01'}, {id: 'm2', kind: 'samtal', date: '2026-07-01'}]},
        'comms', {id: 'm1', kind: 'samtal', date: '2026-06-01'});
      eq(p.comms.map(m => m.id), ['m1', 'm2']);
      eq(p.lastContact, '2026-08-01');   // the job on 2026-08-01 is now the latest contact
    }));
    test('for jobs too; events and bookings get no latest contact', () => at(() => {
      eq(L.replaceItemPatch(c(), 'jobs', {id: 'j1', title: 'A', date: '2026-10-10'}).lastContact, '2026-10-10');
      eq(Object.keys(L.replaceItemPatch(c(), 'events', {id: 'e1', title: 'Ny'})), ['events']);
      eq(L.replaceItemPatch(c(), 'bookings', {id: 'b1', date: '2026-10-21'}).bookings, [{id: 'b1', date: '2026-10-21'}]);
    }));
  });

  describe('removeItemPatch', () => {
    test('comms and jobs are removeCommPatch and removeJobPatch; bookings removeBookingPatch; events are filtered', () => at(() => {
      eq(L.removeItemPatch(c(), 'comms', 'm1'), L.removeCommPatch(c(), 'm1'));
      eq(L.removeItemPatch(c(), 'jobs', 'j1'), L.removeJobPatch(c(), 'j1'));
      eq(L.removeItemPatch(c(), 'bookings', 'b1'), L.removeBookingPatch(c(), 'b1'));
      eq(L.removeItemPatch(c(), 'events', 'e1'), {events: []});
    }));
  });

  describe('markEventPatch', () => {
    test('offer sets offeredAt, eventfu followUpSentAt, on that event only', () => {
      const two = {events: [{id: 'e1'}, {id: 'e2'}]};
      eq(L.markEventPatch(two, 'e1', 'offer', '2026-10-15'), {events: [{id: 'e1', offeredAt: '2026-10-15'}, {id: 'e2'}]});
      eq(L.markEventPatch(two, 'e2', 'eventfu', '2026-10-15'), {events: [{id: 'e1'}, {id: 'e2', followUpSentAt: '2026-10-15'}]});
    });
    test('sentPatch marks the event the same way', () => at(() => {
      const m = {id: 'm9', kind: 'mail_ut', date: '2026-10-15', subject: 'S'};
      eq(L.sentPatch(c(), 'e1', 'offer', m).events, L.markEventPatch(c(), 'e1', 'offer', '2026-10-15').events);
    }));
  });
})();

(function () {
  const L = window.CRMLogic;
  describe('newCustomerDefaults: the starting values of a new customer (the app and the REST API)', () => {
    test('empty jobs and comms, no latest contact, created and updated now', () => {
      eq(L.newCustomerDefaults('2026-10-20T08:00:00.000Z'), {jobs: [], comms: [], lastContact: null, createdAt: '2026-10-20T08:00:00.000Z', updatedAt: '2026-10-20T08:00:00.000Z'});
    });
  });

  describe('calendarConflicts: what is booked during every upcoming event', () => {
    test('one entry per upcoming event with an id that has conflicts, with eventConflicts\' answer', () => {
      L.setClock(() => new Date('2026-10-15T12:00:00'));
      try {
        const cs = [
          {id: 'c1', company: 'A', events: [{id: 'e1', title: 'Mässa', date: '2026-11-10'}, {title: 'Utan id', date: '2026-11-10'}], bookings: [{id: 'b1', kind: 'mote', date: '2026-11-10'}]},
          {id: 'c2', company: 'B', events: [{id: 'e2', title: 'Lugn', date: '2026-12-01'}, {id: 'e3', title: 'Förbi', date: '2026-01-01'}]}
        ];
        const busy = [{date: '2026-11-10', time: '14:00', title: 'Upptagen'}];
        eq(L.calendarConflicts(cs, busy), [{customerId: 'c1', eventId: 'e1', conflicts: L.eventConflicts(cs[0].events[0], cs, busy)}]);
        eq(L.calendarConflicts(cs, null)[0].conflicts.length, 1);
      } finally {
        L.setClock(null);
      }
    });
  });
})();
