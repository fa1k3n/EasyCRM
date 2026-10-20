/* The logic's rules run by the server: the latest contact, the latest mail and job, the event marks when an offer or
 * a follow-up is logged, the calendar, and the brand (language) the server runs with. "Today" is fixed. */
import fs from 'node:fs';
import path from 'node:path';
import {calendarItems, upcomingBookings} from '../../crm/logic/bookings';
import {EXAMPLE_BRAND, setBrand} from '../../crm/logic/brand';
import {eventConflicts, upcomingEvents} from '../../crm/logic/events';
import {setClock} from '../../crm/logic/time';
import {loadBrand, start} from '../src/node';
import {json, tempDir, testApi} from './helpers';

const TODAY = '2026-10-15';
let t: ReturnType<typeof testApi>;
beforeEach(() => { t = testApi(); setClock(() => new Date(TODAY + 'T12:00:00')); setBrand(null); });
afterEach(() => { t.close(); setClock(null); setBrand(null); });

const req = (p: string, init?: RequestInit) => t.app.request(`/api/v1${p}`, init);
const read = async (id = 'c1') => (await req(`/customers/${id}`)).json();
const put = (id: string, body: object) => req(`/customers/${id}`, json('PUT', body));

describe('the latest contact (lastTouch) after a change in comms or jobs', () => {
  test('a logged mail sets lastContact and lastMail', async () => {
    await put('c1', {company: 'A', status: 'kund', lastContact: '2026-01-01'});
    await req('/customers/c1/comms', json('POST', {id: 'm1', kind: 'mail_ut', date: '2026-10-10', subject: 'Hej'}));
    const c = await read();
    expect(c.lastContact).toBe('2026-10-10');
    expect(c.lastMail).toEqual({date: '2026-10-10', subject: 'Hej'});
  });
  test('a call sets lastContact but not lastMail; a contact in the future does not count', async () => {
    await put('c1', {company: 'A', comms: [{id: 'm0', kind: 'mail_ut', date: '2026-09-01', subject: 'S'}]});
    await req('/customers/c1/comms', json('POST', {id: 'm1', kind: 'samtal', date: '2026-10-01'}));
    await req('/customers/c1/comms', json('POST', {id: 'm2', kind: 'mote', date: '2026-11-01'}));
    const c = await read();
    expect(c.lastContact).toBe('2026-10-01');
    expect(c.lastMail).toBeUndefined();
  });
  test('a job sets lastJob and counts as a contact; removing it works the latest contact out again', async () => {
    await put('c1', {company: 'A', comms: [{id: 'm0', kind: 'samtal', date: '2026-08-01'}]});
    await req('/customers/c1/jobs', json('POST', {id: 'j1', title: 'Jobb', date: '2026-10-05'}));
    let c = await read();
    expect(c.lastContact).toBe('2026-10-05');
    expect(c.lastJob).toEqual({title: 'Jobb', date: '2026-10-05'});
    await req('/customers/c1/jobs/j1', {method: 'DELETE'});
    c = await read();
    expect(c.lastContact).toBe('2026-08-01');
  });
  test('changing the date of a contact works the latest contact out again', async () => {
    await put('c1', {company: 'A'});
    await req('/customers/c1/comms', json('POST', {id: 'm1', kind: 'samtal', date: '2026-10-01'}));
    await req('/customers/c1/comms/m1', json('PATCH', {date: '2026-09-01'}));
    expect((await read()).lastContact).toBe('2026-09-01');
  });
  test('removing the only contact gives lastContact null', async () => {
    await put('c1', {company: 'A'});
    await req('/customers/c1/comms', json('POST', {id: 'm1', kind: 'samtal', date: '2026-10-01'}));
    await req('/customers/c1/comms/m1', {method: 'DELETE'});
    expect((await read()).lastContact).toBeNull();
  });
});

describe('an offer or a follow-up logged as a mail (?event=<id>&mark=offer|eventfu)', () => {
  const events = [{id: 'e1', title: 'Mässa', date: '2026-11-10'}, {id: 'e2', title: 'Fest', date: '2026-10-01'}];
  test('offer sets offeredAt on the event to the mail\'s date', async () => {
    await put('c1', {company: 'A', status: 'kund', events});
    const res = await req('/customers/c1/comms?event=e1&mark=offer', json('POST', {id: 'm1', kind: 'mail_ut', date: '2026-10-15', subject: 'Erbjudande'}));
    expect(res.status).toBe(201);
    const c = await read();
    expect(c.events.map((e: {offeredAt?: string}) => e.offeredAt ?? null)).toEqual(['2026-10-15', null]);
    expect(c.lastContact).toBe('2026-10-15');
    expect(c.lastMail).toEqual({date: '2026-10-15', subject: 'Erbjudande'});
  });
  test('eventfu sets followUpSentAt', async () => {
    await put('c1', {company: 'A', status: 'kund', events});
    await req('/customers/c1/comms?event=e2&mark=eventfu', json('POST', {id: 'm1', kind: 'mail_ut', date: '2026-10-14', subject: 'Tack'}));
    expect((await read()).events[1].followUpSentAt).toBe('2026-10-14');
  });
  test('an unknown event or mark gives 400 and logs nothing', async () => {
    await put('c1', {company: 'A', events});
    for (const q of ['event=nope&mark=offer', 'event=e1&mark=other', 'event=e1', 'mark=offer']) {
      const res = await req(`/customers/c1/comms?${q}`, json('POST', {id: 'm1', kind: 'mail_ut', date: '2026-10-15'}));
      expect(res.status).toBe(400);
    }
    expect((await read()).comms).toBeUndefined();
  });
  test('event and mark only work on comms', async () => {
    await put('c1', {company: 'A', events});
    expect((await req('/customers/c1/jobs?event=e1&mark=offer', json('POST', {id: 'j1'}))).status).toBe(400);
  });
});

describe('GET /calendar', () => {
  const customers = {
    c1: {company: 'Exempelbolaget AB', status: 'kund', comms: [{id: 'm', kind: 'samtal', date: '2026-09-01'}],
      bookings: [{id: 'b1', kind: 'mote', date: '2026-11-10', time: '10:00'}], events: [{id: 'e1', title: 'Mässa', date: '2026-11-10'}],
      followUp: {date: '2026-10-20', note: 'Ring'}, jobs: [{id: 'j1', invoiceNumber: 7, invoiceStatus: 'overdue', dueDate: '2026-10-01', amount: '100'}]},
    c2: {company: 'Andra Exempel AB', status: 'kund', events: [{id: 'e2', title: 'Lugn', date: '2026-12-01'}]},
    c3: {company: 'Påhittat', status: 'kund', example: true, followUp: {date: '2026-10-20'}}
  };
  const busy = [{date: '2026-11-10', time: '14:00', title: 'Upptagen'}];

  test('gives the same calendar items and event conflicts as the logic in the app', async () => {
    for (const [id, c] of Object.entries(customers)) await put(id, c);
    await req('/sync/busy', json('PUT', {items: busy}));
    const res = await req('/calendar');
    expect(res.status).toBe(200);
    const body = await res.json();
    const stored = await (await req('/customers')).json();
    expect(body.items).toEqual(calendarItems(stored));
    expect(body.items.length).toBeGreaterThan(2);
    const e1 = stored.find((c: {id: string}) => c.id === 'c1').events[0];
    expect(body.conflicts).toEqual([{customerId: 'c1', eventId: 'e1', conflicts: eventConflicts(e1, stored, busy)}]);
    expect(body.conflicts[0].conflicts.length).toBe(2);
    expect(upcomingEvents(stored[0]).length + upcomingBookings(stored[0]).length).toBeGreaterThan(0);
  });

  test('without sync/busy the conflicts only come from the bookings', async () => {
    await put('c1', customers.c1);
    const body = await (await req('/calendar')).json();
    expect(body.conflicts[0].conflicts.map((k: {source: string}) => k.source)).toEqual(['bokning']);
  });
});

describe('the brand in the server', () => {
  const brandDir = (brand: object) => {
    const dir = tempDir();
    fs.writeFileSync(path.join(dir, 'brand.json'), JSON.stringify(brand));
    return dir;
  };

  test('loadBrand reads brand.json, sets it and gives the language; the calendar titles follow it', async () => {
    const dir = brandDir({...EXAMPLE_BRAND, language: 'en'});
    expect(loadBrand(dir)).toMatchObject({language: 'en'});
    await put('c1', {company: 'Example Ltd', status: 'kund', followUp: {date: '2026-10-20'}});
    const body = await (await req('/calendar')).json();
    expect(body.items.find((i: {kind: string}) => i.kind === 'followup').title).toMatch(/Follow up/i);
    fs.rmSync(dir, {recursive: true, force: true});
  });

  test('a brand that does not pass validateBrand stops the start with a message', () => {
    const dir = brandDir({company: {name: ''}});
    expect(() => loadBrand(dir)).toThrow(/brand\.json/);
    fs.rmSync(dir, {recursive: true, force: true});
  });

  test('a folder without brand.json gives the built-in example brand', () => {
    const dir = tempDir();
    expect(loadBrand(dir)).toBe(null);
    fs.rmSync(dir, {recursive: true, force: true});
  });

  test('start() with a brand folder uses it', async () => {
    const dir = brandDir({...EXAMPLE_BRAND, language: 'en'});
    const server = await start({port: 0, dbFile: path.join(dir, 'crm.sqlite'), brandDir: dir});
    try {
      await fetch(`http://127.0.0.1:${server.port}/api/v1/customers/c1`, json('PUT', {company: 'X', status: 'kund', followUp: {date: '2026-10-20'}}));
      const body = await (await fetch(`http://127.0.0.1:${server.port}/api/v1/calendar`)).json();
      expect(body.items[0].title).toMatch(/Follow up/i);
    } finally {
      await server.close();
      fs.rmSync(dir, {recursive: true, force: true});
    }
  });
});
