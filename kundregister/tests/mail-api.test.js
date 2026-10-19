/* Enhetstester för mailtexterna: kontrollen av ett tilläggs mail (checkMailModule) och
 * loggposterna som skrivs när appen saknar mailtillägg. Tilläggen här är påhittade. */
(function () {
  const L = window.CRMLogic;
  const mod = (over = {}) => Object.assign({buildOffer: () => ({subject: 's', body: 'b', note: 'n'}), buildEventFollowUp: () => ({subject: 's', body: 'b', note: 'n'})}, over);

  describe('Mailtillägg: kontroll', () => {
    test('ett tillägg med buildOffer och buildEventFollowUp godtas', () => eq(L.checkMailModule(mod()), []));
    test('saknat tillägg, eller ett som inte är ett objekt, ger fel', () => {
      ok(L.checkMailModule(undefined).length > 0, 'undefined');
      ok(L.checkMailModule('text').length > 0, 'sträng');
    });
    test('funktioner som saknas namnges', () => {
      const e = L.checkMailModule(mod({buildEventFollowUp: 'inte en funktion'}));
      eq(e.length, 1);
      includes(e[0], 'buildEventFollowUp');
    });
  });

  describe('Mailtillägg: loggning utan tillägg', () => {
    const e = {id: 'e1', title: 'Höstseminarium', date: '2026-11-05'};
    test('erbjudande loggas med eventets namn och datum', () => eq(L.logOnlyEntry(e, 'offer'), {subject: 'Erbjudande inför Höstseminarium', note: 'Erbjudande inför Höstseminarium (05/11 2026) loggat som skickat.'}));
    test('uppföljning loggas med eventets namn och datum', () => eq(L.logOnlyEntry(e, 'eventfu'), {subject: 'Uppföljning efter Höstseminarium', note: 'Uppföljning efter Höstseminarium (05/11 2026) loggad som skickad.'}));
    test('event utan namn får ett neutralt namn', () => includes(L.logOnlyEntry({date: '2026-11-05'}, 'offer').subject, 'eventet'));
  });

  describe('Mailtillägg: mailtexten från ett tillägg', () => {
    test('valfria fält får standardvärden (tags tom lista, hint tom text)', () =>
      eq(L.normalizeMailText({subject: 'Ämne', body: 'Text', note: 'Anteckning'}), {subject: 'Ämne', body: 'Text', note: 'Anteckning', tags: [], hint: ''}));
    test('tags och hint från tillägget behålls, bara som text', () =>
      eq(L.normalizeMailText({subject: 'Ä', body: 'T', note: 'A', tags: ['Ett', 2], hint: 'Tips'}), {subject: 'Ä', body: 'T', note: 'A', tags: ['Ett', '2'], hint: 'Tips'}));
    test('ett svar utan ämne eller text ger ett fel som namnger fältet', () => {
      for (const [bad, field] of [[{body: 'T', note: 'A'}, 'subject'], [{subject: 'Ä', note: 'A'}, 'body'], [null, 'svar']]) {
        let msg = '';
        try { L.normalizeMailText(bad); } catch (e) { msg = e.message; }
        includes(msg, field);
      }
    });
  });

  describe('Mailtillägg: det som sparas när ett mail loggas som skickat', () => {
    const c = {comms: [{id: 'm0', kind: 'samtal', date: '2026-09-01'}], jobs: [{id: 'j', date: '2026-09-20'}], events: [{id: 'e1', title: 'X', date: '2026-11-05'}, {id: 'e2', title: 'Y', date: '2026-12-01'}]};
    const m = {id: 'm1', kind: 'mail_ut', date: '2026-10-15', subject: 'Ämne', note: 'Anteckning'};
    test('erbjudande: mailet läggs till, eventet får offeredAt och senaste kontakt räknas om', () => {
      const p = L.sentPatch(c, 'e1', 'offer', m);
      eq(p.comms.map(x => x.id), ['m0', 'm1']);
      eq(p.events.map(e => e.offeredAt || null), ['2026-10-15', null]);
      eq(p.lastContact, '2026-10-15');
      eq(p.lastMail, {date: '2026-10-15', subject: 'Ämne'});
    });
    test('uppföljning sätter followUpSentAt i stället', () => eq(L.sentPatch(c, 'e2', 'eventfu', m).events.map(e => e.followUpSentAt || null), [null, '2026-10-15']));
    test('kunden ändras inte', () => { L.sentPatch(c, 'e1', 'offer', m); eq(c.comms.length, 1); eq(c.events[0].offeredAt, undefined); });
  });
})();
