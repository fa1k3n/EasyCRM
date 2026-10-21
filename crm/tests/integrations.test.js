/* Unit tests for an integration plugin's state on the integrations page: switched off, never run, working, failed
 * once or twice (a warning), or not working (3 failed runs in a row). */
(function () {
  const L = window.CRMLogic;
  const info = (over = {}) => Object.assign({id: 'test-invoices', name: 'Testfakturor', cron: '0 5 * * *', enabled: true, failures: 0, lastRun: {ok: true}}, over);

  describe('integrationStatus', () => {
    test('off, never run and working', () => {
      eq(L.integrationStatus(info({enabled: false, failures: 5})), 'off');
      eq(L.integrationStatus(info({lastRun: null})), 'never');
      eq(L.integrationStatus(info()), 'ok');
    });
    test('one or two failures in a row are a warning, three or more mean it does not work', () => {
      eq(L.integrationStatus(info({failures: 1, lastRun: {ok: false}})), 'warn');
      eq(L.integrationStatus(info({failures: 2, lastRun: {ok: false}})), 'warn');
      eq(L.integrationStatus(info({failures: 3, lastRun: {ok: false}})), 'broken');
      eq(L.INTEGRATION_BROKEN_AFTER, 3);
    });
    test('a failed latest run without a count is a warning', () => eq(L.integrationStatus(info({failures: undefined, lastRun: {ok: false}})), 'warn'));
  });

  describe('brokenIntegrations', () => {
    test('only those that are on and do not work', () => {
      const list = [info({id: 'a', failures: 3}), info({id: 'b', failures: 3, enabled: false}), info({id: 'c', failures: 1}), info({id: 'd'})];
      eq(L.brokenIntegrations(list).map(i => i.id), ['a']);
      eq(L.brokenIntegrations(null), []);
    });
  });
})();
