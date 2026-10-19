/* Unit tests for the mail texts: the check of an extension's mail (checkMailModule) and the log entries written when
 * the app has no mail extension. The extensions here are made up. */
(function () {
  const L = window.CRMLogic;
  const mod = (over = {}) => Object.assign({buildOffer: () => ({subject: 's', body: 'b', note: 'n'}), buildEventFollowUp: () => ({subject: 's', body: 'b', note: 'n'})}, over);

  describe('Mail extension: the check', () => {
    test('an extension with buildOffer and buildEventFollowUp is accepted', () => eq(L.checkMailModule(mod()), []));
    test('a missing extension, or one that is not an object, gives errors', () => {
      ok(L.checkMailModule(undefined).length > 0, 'undefined');
      ok(L.checkMailModule('text').length > 0, 'string');
    });
    test('missing functions are named', () => {
      const e = L.checkMailModule(mod({buildEventFollowUp: 'inte en funktion'}));
      eq(e.length, 1);
      includes(e[0], 'buildEventFollowUp');
    });
  });

  describe('Mail extension: logging without an extension', () => {
    const e = {id: 'e1', title: 'Höstseminarium', date: '2026-11-05'};
    test('an offer is logged with the event’s name and date', () => eq(L.logOnlyEntry(e, 'offer'), {subject: 'Erbjudande inför Höstseminarium', note: 'Erbjudande inför Höstseminarium (05/11 2026) loggat som skickat.'}));
    test('a follow-up is logged with the event’s name and date', () => eq(L.logOnlyEntry(e, 'eventfu'), {subject: 'Uppföljning efter Höstseminarium', note: 'Uppföljning efter Höstseminarium (05/11 2026) loggad som skickad.'}));
    test('an event without a name gets a neutral name', () => includes(L.logOnlyEntry({date: '2026-11-05'}, 'offer').subject, 'eventet'));
  });

  describe('Mail extension: the mail text from an extension', () => {
    test('optional fields get default values (tags an empty list, hint an empty text)', () =>
      eq(L.normalizeMailText({subject: 'Ämne', body: 'Text', note: 'Anteckning'}), {subject: 'Ämne', body: 'Text', note: 'Anteckning', tags: [], hint: ''}));
    test('tags and hint from the extension are kept, only as text', () =>
      eq(L.normalizeMailText({subject: 'Ä', body: 'T', note: 'A', tags: ['Ett', 2], hint: 'Tips'}), {subject: 'Ä', body: 'T', note: 'A', tags: ['Ett', '2'], hint: 'Tips'}));
    test('an answer without a subject or text gives an error that names the field', () => {
      for (const [bad, field] of [[{body: 'T', note: 'A'}, 'subject'], [{subject: 'Ä', note: 'A'}, 'body'], [null, 'svar']]) {
        let msg = '';
        try { L.normalizeMailText(bad); } catch (e) { msg = e.message; }
        includes(msg, field);
      }
    });
  });

  describe('Mail extension: what is saved when a mail is logged as sent', () => {
    const c = {comms: [{id: 'm0', kind: 'samtal', date: '2026-09-01'}], jobs: [{id: 'j', date: '2026-09-20'}], events: [{id: 'e1', title: 'X', date: '2026-11-05'}, {id: 'e2', title: 'Y', date: '2026-12-01'}]};
    const m = {id: 'm1', kind: 'mail_ut', date: '2026-10-15', subject: 'Ämne', note: 'Anteckning'};
    test('offer: the mail is added, the event gets offeredAt and the latest contact is worked out again', () => {
      const p = L.sentPatch(c, 'e1', 'offer', m);
      eq(p.comms.map(x => x.id), ['m0', 'm1']);
      eq(p.events.map(e => e.offeredAt || null), ['2026-10-15', null]);
      eq(p.lastContact, '2026-10-15');
      eq(p.lastMail, {date: '2026-10-15', subject: 'Ämne'});
    });
    test('a follow-up sets followUpSentAt instead', () => eq(L.sentPatch(c, 'e2', 'eventfu', m).events.map(e => e.followUpSentAt || null), [null, '2026-10-15']));
    test('the customer is not changed', () => { L.sentPatch(c, 'e1', 'offer', m); eq(c.comms.length, 1); eq(c.events[0].offeredAt, undefined); });
  });
})();
