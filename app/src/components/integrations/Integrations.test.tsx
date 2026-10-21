import {act, fireEvent, render, screen, within} from '@testing-library/react';
import type {CustomerDoc, Store} from '../../data/store';
import {StoreProvider} from '../../data/StoreContext';
import {ApiRequestError} from '../../data/restStore';
import {ToastProvider} from '../Toast';
import {IntegrationsAlert, IntegrationsButton, IntegrationsPage} from './Integrations';

// The integrations page: every built-in plugin with its schedule, latest run, Kör nu and an on/off switch; red when it
// does not work (3 failed runs in a row); the header button and the alert above the list. The store is a small fake;
// all data is made up.
const RUN = {at: '2026-10-21T10:00:00.000Z', ok: true, trigger: 'cron', counts: {customers: 1, created: 2, updated: 1, linked: 0}, remaining: 3,
  notes: ['12 fakturor lästa'], unmatched: ['Okänd Kund AB']};
const FAILED = {at: '2026-10-21T10:00:00.000Z', ok: false, trigger: 'cron', error: 'The service did not answer'};
const plugin = (over: Partial<IntegrationInfo> = {}): IntegrationInfo =>
  ({id: 'test-invoices', name: 'Testfakturor', cron: '0 5 * * *', enabled: true, failures: 0, lastRun: RUN, ...over});

function fakeStore(list: IntegrationInfo[] | null | 'error', over: Partial<Store> = {}) {
  const calls: string[] = [];
  const store: Store = {
    canWrite: true,
    watchCustomers: next => { next([] as CustomerDoc[]); return () => {}; },
    watchBusy: next => { next(null); return () => {}; },
    watchIntegrations: (next, fail) => { if (list === 'error') fail(new Error('down')); else next(list); return () => {}; },
    runIntegration: async id => { calls.push(`run ${id}`); return RUN; },
    setIntegrationEnabled: async (id, enabled) => { calls.push(`${enabled ? 'on' : 'off'} ${id}`); },
    createCustomer: async () => '', updateCustomer: async () => {}, deleteCustomer: async () => {}, skipCustomer: async () => {},
    ...over
  };
  return {store, calls};
}
async function show(list: IntegrationInfo[] | null | 'error', over: Partial<Store> = {}) {
  const f = fakeStore(list, over);
  const opened: string[] = [];
  render(<ToastProvider><StoreProvider store={f.store}>
    <IntegrationsButton onOpen={() => opened.push('page')} /><IntegrationsAlert onOpen={() => opened.push('alert')} /><IntegrationsPage onBack={() => opened.push('back')} />
  </StoreProvider></ToastProvider>);
  await act(() => new Promise(r => setTimeout(r, 0)));
  return {...f, opened};
}
const item = (name: string) => screen.getByRole('listitem', {name});

test('every plugin with its schedule and latest run: when, how, how much, its notes and what was not connected', async () => {
  await show([plugin()]);
  const text = item('Testfakturor').textContent!;
  expect(text).toMatch('0 5 * * * (UTC)');
  expect(text).toMatch('Fungerar');
  expect(text).toMatch(/Senast 21\/10 2026 \d\d:\d\d · schemalagd/);
  expect(text).toMatch('1 ny kund · 2 nya jobb · 1 ändrat jobb · 0 kopplingar');
  expect(text).toMatch('3 ändringar kvar till nästa körning');
  expect(text).toMatch('12 fakturor lästa');
  expect(text).toMatch('Inte kopplade till någon kund: Okänd Kund AB');
});

test('one or two failures in a row are a warning; three mean it does not work: red, the alert and a red header button', async () => {
  const {opened} = await show([plugin({id: 'a', name: 'Varning', failures: 1, lastRun: FAILED}), plugin({id: 'b', name: 'Trasig', failures: 3, lastRun: FAILED})]);
  expect(item('Varning').textContent).toMatch('Misslyckades senast');
  expect(item('Varning').dataset.status).toBe('warn');
  expect(item('Trasig').textContent).toMatch('Fungerar inte: 3 misslyckade körningar i rad');
  expect(item('Trasig').textContent).toMatch('The service did not answer');
  expect(item('Trasig').dataset.status).toBe('broken');
  const alert = screen.getByRole('alert');
  expect(alert.textContent).toMatch('Integrationen Trasig fungerar inte (3 misslyckade körningar i rad).');
  expect(alert.textContent).not.toMatch('Varning');
  fireEvent.click(within(alert).getByRole('button', {name: 'Visa integrationerna'}));
  fireEvent.click(screen.getByRole('button', {name: 'Integrationer (en fungerar inte)'}));
  expect(opened).toEqual(['alert', 'page']);
});

test('a single failure gives no alert and a plain header button', async () => {
  await show([plugin({failures: 2, lastRun: FAILED})]);
  expect(screen.queryByRole('alert')).toBeNull();
  expect(screen.getByRole('button', {name: 'Integrationer'})).toBeTruthy();
});

test('Kör nu runs it and shows the result; it is off while running', async () => {
  let finish: () => void = () => {};
  const {calls} = await show([plugin()], {runIntegration: async id => { calls.push(`run ${id}`); await new Promise<void>(r => { finish = r; }); return RUN; }});
  const button = within(item('Testfakturor')).getByRole('button', {name: 'Kör nu'}) as HTMLButtonElement;
  fireEvent.click(button);
  expect(button.disabled).toBe(true);
  await act(async () => { finish(); await new Promise(r => setTimeout(r, 0)); });
  expect(calls).toEqual(['run test-invoices']);
  expect(screen.getByRole('status').textContent).toMatch('Testfakturor körd: 1 ny kund · 2 nya jobb · 1 ändrat jobb · 0 kopplingar');
});

test('a refused run shows why (e.g. less than a minute since the last one)', async () => {
  await show([plugin()], {runIntegration: async () => { throw new ApiRequestError(429, 'too_many_runs', 'wait'); }});
  fireEvent.click(within(item('Testfakturor')).getByRole('button', {name: 'Kör nu'}));
  await act(() => new Promise(r => setTimeout(r, 0)));
  expect(screen.getByRole('status').textContent).toMatch('Vänta en minut mellan körningarna.');
});

test('the switch turns it off and on; when off it is marked and Kör nu cannot be used', async () => {
  const {calls} = await show([plugin({id: 'on'}), plugin({id: 'off', name: 'Avstängd plugin', enabled: false})]);
  fireEvent.click(within(item('Testfakturor')).getByRole('switch', {name: 'Aktiv'}));
  await act(() => new Promise(r => setTimeout(r, 0)));
  const off = item('Avstängd plugin');
  expect(within(off).getByRole('switch', {name: 'Aktiv'}).getAttribute('aria-checked')).toBe('false');
  expect(off.textContent).toMatch('Avstängd');
  expect((within(off).getByRole('button', {name: 'Kör nu'}) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(within(off).getByRole('switch', {name: 'Aktiv'}));
  await act(() => new Promise(r => setTimeout(r, 0)));
  expect(calls).toEqual(['off on', 'on off']);
});

test('the page has a way back to the customers', async () => {
  const {opened} = await show([plugin()]);
  fireEvent.click(screen.getByRole('button', {name: '← Alla kunder'}));
  expect(opened).toEqual(['back']);
});

test('empty, not here, and error states', async () => {
  await show([]);
  expect(screen.getByText('Inga integrationer är inbyggda än.')).toBeTruthy();
});

test('where integrations do not run (claude.ai, the local server): no header button, the page says why', async () => {
  await show(null);
  expect(screen.queryByRole('button', {name: /^Integrationer/})).toBeNull();
  expect(screen.getByText(/Integrationer körs i molnet/)).toBeTruthy();
});

test('the list cannot be read: an error state', async () => {
  await show('error');
  expect(screen.getByText('Kunde inte läsa integrationerna.')).toBeTruthy();
});

test('a run that went through but failed shows the error', async () => {
  await show([plugin()], {runIntegration: async () => ({at: '2026-10-21T10:00:00.000Z', ok: false, trigger: 'manual', error: 'The service did not answer'})});
  fireEvent.click(within(item('Testfakturor')).getByRole('button', {name: 'Kör nu'}));
  await act(() => new Promise(r => setTimeout(r, 0)));
  expect(screen.getByRole('status').textContent).toMatch('Testfakturor misslyckades: The service did not answer');
});
