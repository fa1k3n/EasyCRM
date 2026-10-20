/* The customer's lists (comms, jobs, events, bookings), the removed suggestions (skipped) and the sync documents. */
import {json, testApi} from './helpers';

let t: ReturnType<typeof testApi>;
beforeEach(() => { t = testApi(); });
afterEach(() => t.close());

const req = (path: string, init?: RequestInit) => t.app.request(`/api/v1${path}`, init);
const customer = async (body: object = {company: 'Exempelbolaget AB', status: 'kund'}) => {
  await req('/customers/c1', json('PUT', body));
  return 'c1';
};
const read = async (id = 'c1') => (await req(`/customers/${id}`)).json();

describe('the lists of a customer', () => {
  for (const list of ['comms', 'jobs', 'events', 'bookings']) {
    test(`${list}: add, list, change and remove an element`, async () => {
      await customer();
      const added = await req(`/customers/c1/${list}`, json('POST', {id: 'x1', title: 'Första', date: '2026-10-20'}));
      expect(added.status).toBe(201);
      expect(await added.json()).toMatchObject({id: 'x1', title: 'Första'});
      expect(added.headers.get('ETag')).toBe('"2"');
      const listed = await req(`/customers/c1/${list}`);
      expect(await listed.json()).toEqual([{id: 'x1', title: 'Första', date: '2026-10-20'}]);
      expect(listed.headers.get('ETag')).toBe('"2"');
      const changed = await req(`/customers/c1/${list}/x1`, json('PATCH', {title: 'Ändrad', id: 'annat'}));
      expect(changed.status).toBe(200);
      expect(await changed.json()).toEqual({id: 'x1', title: 'Ändrad', date: '2026-10-20'});
      expect((await req(`/customers/c1/${list}/x1`, {method: 'DELETE'})).status).toBe(204);
      expect((await read())[list]).toEqual([]);
    });
  }

  test('POST twice with the same id replaces the element instead of adding another (safe retries)', async () => {
    await customer();
    await req('/customers/c1/comms', json('POST', {id: 'm1', kind: 'mail_ut', date: '2026-10-01', subject: 'A'}));
    const again = await req('/customers/c1/comms', json('POST', {id: 'm1', kind: 'mail_ut', date: '2026-10-01', subject: 'B'}));
    expect(again.status).toBe(200);
    expect((await read()).comms).toEqual([{id: 'm1', kind: 'mail_ut', date: '2026-10-01', subject: 'B'}]);
  });

  test('an element without an id gets one from the server', async () => {
    await customer();
    const item = await (await req('/customers/c1/jobs', json('POST', {title: 'Jobb'}))).json();
    expect(item.id).toMatch(/^[0-9a-f-]{36}$/);
    expect((await read()).jobs).toEqual([item]);
  });

  test('a customer without the list gets it; elements without an id that were there are kept', async () => {
    await customer({company: 'A', events: [{title: 'Gammalt utan id'}]});
    await req('/customers/c1/events', json('POST', {id: 'e1', title: 'Nytt'}));
    await req('/customers/c1/bookings', json('POST', {id: 'b1', date: '2026-10-20'}));
    const c = await read();
    expect(c.events).toEqual([{title: 'Gammalt utan id'}, {id: 'e1', title: 'Nytt'}]);
    expect(c.bookings).toEqual([{id: 'b1', date: '2026-10-20'}]);
  });

  test('every change updates the customer\'s updatedAt', async () => {
    await customer();
    const before = (await read()).updatedAt;
    // Only the clock is faked (a minute later); everything else runs as usual
    jest.useFakeTimers({now: new Date(Date.parse(before) + 60000), doNotFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
      'setImmediate', 'clearImmediate', 'nextTick', 'queueMicrotask', 'hrtime', 'performance']});
    try {
      await req('/customers/c1/comms', json('POST', {id: 'm1'}));
    } finally {
      jest.useRealTimers();
    }
    expect((await read()).updatedAt > before).toBe(true);
  });

  test('an invalid element gives 400 with the path in the list', async () => {
    await customer();
    const res = await req('/customers/c1/bookings', json('POST', {id: 'b1', durationMin: '60'}));
    expect(res.status).toBe(400);
    expect((await res.json()).error.details).toEqual([{path: 'bookings[0].durationMin', message: 'must be a number'}]);
    const patch = await req('/customers/c1/bookings/b1', json('PATCH', {date: 'snart'}));
    expect(patch.status).toBe(404);
  });

  test('an unknown list, customer or element gives 404', async () => {
    await customer();
    expect((await req('/customers/c1/notes', json('POST', {id: 'x'}))).status).toBe(404);
    expect((await req('/customers/nope/comms', json('POST', {id: 'x'}))).status).toBe(404);
    expect((await req('/customers/nope/comms')).status).toBe(404);
    expect((await req('/customers/c1/comms/nope', json('PATCH', {kind: 'x'}))).status).toBe(404);
    expect((await req('/customers/c1/comms/nope', {method: 'DELETE'})).status).toBe(404);
  });

  test('If-Match is the customer\'s version: a wrong one gives 412 and changes nothing', async () => {
    await customer();
    const res = await req('/customers/c1/comms', json('POST', {id: 'm1'}, {'If-Match': '"9"'}));
    expect(res.status).toBe(412);
    expect((await read()).comms).toBeUndefined();
    expect((await req('/customers/c1/comms', json('POST', {id: 'm1'}, {'If-Match': '"1"'}))).status).toBe(201);
  });
});

describe('/skipped', () => {
  test('put, list, read and remove a removed suggestion; the key may be a company name with spaces', async () => {
    const key = encodeURIComponent('Exempel Bolaget AB');
    const put = await req(`/skipped/${key}`, json('PUT', {company: 'Exempel Bolaget AB', website: ''}));
    expect(put.status).toBe(201);
    const doc = await put.json();
    expect(doc).toMatchObject({id: 'Exempel Bolaget AB', company: 'Exempel Bolaget AB', website: ''});
    expect(typeof doc.at).toBe('string');
    await req('/skipped/exempel.se', json('PUT', {company: 'Exempel', website: 'https://exempel.se', at: '2026-01-01T00:00:00.000Z'}));
    const list = await (await req('/skipped')).json();
    expect(list.map((d: {id: string}) => d.id).sort()).toEqual(['Exempel Bolaget AB', 'exempel.se']);
    expect((await (await req('/skipped/exempel.se')).json()).at).toBe('2026-01-01T00:00:00.000Z');
    expect((await req('/skipped/exempel.se', {method: 'DELETE'})).status).toBe(204);
    expect((await req('/skipped/exempel.se')).status).toBe(404);
  });
  test('company and website must be text', async () => {
    const res = await req('/skipped/x', json('PUT', {company: 1}));
    expect(res.status).toBe(400);
    expect((await res.json()).error.details).toEqual([{path: 'company', message: 'must be text'}]);
  });
});

describe('/sync', () => {
  test('busy, calendar and gmail can be written and read; a missing one gives 404', async () => {
    expect((await req('/sync/busy')).status).toBe(404);
    const items = [{date: '2026-10-20', time: '10:00', endTime: '11:00', title: 'Upptagen'}];
    for (const doc of ['busy', 'calendar', 'gmail']) {
      const put = await req(`/sync/${doc}`, json('PUT', {items, syncedAt: '2026-10-19T08:00:00Z'}));
      expect([200, 201]).toContain(put.status);
      const got = await req(`/sync/${doc}`);
      expect(await got.json()).toEqual({id: doc, items, syncedAt: '2026-10-19T08:00:00Z'});
      expect(got.headers.get('ETag')).toBe('"1"');
    }
  });
  test('an unknown sync document gives 404', async () => {
    expect((await req('/sync/other', json('PUT', {}))).status).toBe(404);
    expect((await req('/sync/other')).status).toBe(404);
  });
  test('busy.items must be a list', async () => {
    const res = await req('/sync/busy', json('PUT', {items: 'x'}));
    expect(res.status).toBe(400);
  });
  test('If-Match works on the sync documents', async () => {
    await req('/sync/calendar', json('PUT', {}));
    expect((await req('/sync/calendar', json('PUT', {}, {'If-Match': '"5"'}))).status).toBe(412);
  });
});
