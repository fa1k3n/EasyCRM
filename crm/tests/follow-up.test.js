/* Unit tests for the reminder to get in touch: when it is due, the list's "kontakta" segment and sorting,
 * and addMonths for the quick choices. "Today" is 2026-10-15. */
(function () {
  const L = window.CRMLogic;
  const at = fn => { L.setClock(() => new Date('2026-10-15T12:00:00')); try { fn(); } finally { L.setClock(null); } };
  const call = date => ({id: 'm' + date, kind: 'samtal', date});
  const c = (over = {}) => Object.assign({id: 'c1', company: 'Exempelbolaget AB', status: 'kund', comms: [call('2026-10-01')], jobs: []}, over);

  describe('followUpDue: a reminder whose day has come', () => {
    test('due today and when the day has passed', () => at(() => {
      ok(L.followUpDue(c({followUp: {date: '2026-10-15'}})));
      ok(L.followUpDue(c({followUp: {date: '2026-10-14', note: 'Höras efter mötet'}})));
    }));
    test('not due before the day', () => at(() => ok(!L.followUpDue(c({followUp: {date: '2026-10-16'}})))));
    test('done when a contact or a job is logged on the day or later', () => at(() => {
      ok(!L.followUpDue(c({followUp: {date: '2026-10-01'}})));
      ok(!L.followUpDue(c({followUp: {date: '2026-09-20'}, comms: [], jobs: [{id: 'j1', date: '2026-10-02'}]})));
      ok(L.followUpDue(c({followUp: {date: '2026-10-02'}})));
    }));
    test('due without any contact at all', () => at(() => ok(L.followUpDue(c({comms: [], followUp: {date: '2026-10-10'}})))));
    test('no reminder, null or no date is never due', () => at(() => {
      ok(!L.followUpDue(c()));
      ok(!L.followUpDue(c({followUp: null})));
      ok(!L.followUpDue(c({followUp: {note: 'Utan datum'}})));
    }));
    test('potential customers too', () => at(() => ok(L.followUpDue(c({status: 'potentiell', followUp: {date: '2026-10-10'}})))));
  });

  describe('The customer list with due reminders', () => {
    const list = () => [
      c({id: 'green', company: 'Gröna AB'}),
      c({id: 'due', company: 'Påminnelse AB', followUp: {date: '2026-10-10'}}),
      c({id: 'older', company: 'Äldre påminnelse AB', followUp: {date: '2026-10-05'}}),
      c({id: 'later', company: 'Senare AB', followUp: {date: '2026-11-15'}}),
      c({id: 'red', company: 'Röda AB', comms: [call('2026-01-01')]})
    ];
    const ids = view => L.filterCustomers(list(), Object.assign({seg: 'alla', type: 'alla', q: '', sort: 'kontakt'}, view)).map(x => x.id);
    test('"kontakta" includes customers with a due reminder, not one ahead', () => at(() => eq(ids({seg: 'kontakta'}).sort(), ['due', 'older', 'red'])));
    test('the count for "kontakta" includes them', () => at(() => eq(L.segmentCounts(list()).kontakta, 3)));
    test('sorting "kontakt" puts due reminders first, the oldest first, before red', () => at(() => eq(ids({}).slice(0, 3), ['older', 'due', 'red'])));
  });

  describe('addMonths: the quick choices', () => {
    test('the same day of the month', () => { eq(L.addMonths('2026-10-15', 1), '2026-11-15'); eq(L.addMonths('2026-10-15', 2), '2026-12-15'); });
    test('over the turn of the year', () => eq(L.addMonths('2026-11-20', 3), '2027-02-20'));
    test('the last day of the month when the day does not exist', () => {
      eq(L.addMonths('2027-01-31', 1), '2027-02-28');
      eq(L.addMonths('2028-01-31', 1), '2028-02-29');
      eq(L.addMonths('2026-08-31', 1), '2026-09-30');
    });
  });
})();
