/* Moving data between environments: GET /export gives everything in one JSON format, POST /import writes it back
 * (all or nothing, nothing is removed), with a dry run that only shows what would change. */
import {json, testApi} from './helpers';

let t: ReturnType<typeof testApi>;
beforeEach(() => { t = testApi(); });
afterEach(() => t.close());

const req = (p: string, init?: RequestInit) => t.app.request(`/api/v1${p}`, init);
const FILE = {
  format: 'crm-export', version: 1, exportedAt: '2026-10-19T08:00:00.000Z',
  collections: {
    customers: {
      c1: {company: 'Exempelbolaget AB', status: 'kund', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-02-01T00:00:00.000Z',
        comms: [{id: 'm1', kind: 'mail_ut', date: '2026-02-01'}], agentField: {x: 1}, ext: {'next-step': 'Ring'}},
      c2: {company: 'Andra Exempel AB', status: 'potentiell'}
    },
    skipped: {'exempel.se': {company: 'Exempel', website: 'https://exempel.se', at: '2026-03-01T00:00:00.000Z'}},
    sync: {busy: {items: [{date: '2026-10-20', time: '10:00'}]}}
  }
};

describe('GET /export', () => {
  test('an empty database gives the format with empty collections', async () => {
    const body = await (await req('/export')).json();
    expect(body).toMatchObject({format: 'crm-export', version: 1, collections: {customers: {}, skipped: {}, sync: {}}});
    expect(typeof body.exportedAt).toBe('string');
  });
});

describe('POST /import', () => {
  test('a dry run shows what would be created and writes nothing', async () => {
    const res = await req('/import?dryRun=1', json('POST', FILE));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({dryRun: true, create: {customers: ['c1', 'c2'], skipped: ['exempel.se'], sync: ['busy']}, update: {customers: [], skipped: [], sync: []}, unchanged: 0});
    expect(await (await req('/customers')).json()).toEqual([]);
  });

  test('import writes every document exactly as in the file; export gives it back with all fields', async () => {
    const res = await req('/import', json('POST', FILE));
    expect((await res.json()).dryRun).toBe(false);
    const out = await (await req('/export')).json();
    expect(out.collections).toEqual(FILE.collections);
  });

  test('a second import of the same file changes nothing; a changed document is an update', async () => {
    await req('/import', json('POST', FILE));
    const again = await (await req('/import?dryRun=1', json('POST', FILE))).json();
    expect(again).toMatchObject({create: {customers: []}, update: {customers: []}, unchanged: 4});
    const changed = structuredClone(FILE);
    changed.collections.customers.c2.status = 'kund';
    const plan = await (await req('/import?dryRun=1', json('POST', changed))).json();
    expect(plan.update.customers).toEqual(['c2']);
  });

  test('nothing is removed: a customer that is not in the file stays', async () => {
    await req('/customers/own', json('PUT', {company: 'Egen'}));
    await req('/import', json('POST', FILE));
    expect((await req('/customers/own')).status).toBe(200);
  });

  test('an invalid customer stops the whole import (nothing is written) with the paths in details', async () => {
    const bad = structuredClone(FILE) as typeof FILE & {collections: {customers: Record<string, object>}};
    bad.collections.customers.c3 = {status: 'gammal'};
    const res = await req('/import', json('POST', bad));
    expect(res.status).toBe(400);
    expect((await res.json()).error.details).toEqual([{path: 'customers/c3: status', message: 'must be one of: kund, potentiell'}]);
    expect(await (await req('/customers')).json()).toEqual([]);
  });

  test('a file in another format, version or with unknown collections is refused', async () => {
    for (const body of [{...FILE, format: 'x'}, {...FILE, version: 2}, {...FILE, collections: {other: {}}}, {...FILE, collections: {customers: []}}]) {
      expect((await req('/import', json('POST', body))).status).toBe(400);
    }
  });

  test('a sync document that is not busy, calendar or gmail is refused', async () => {
    const res = await req('/import', json('POST', {...FILE, collections: {sync: {other: {}}}}));
    expect(res.status).toBe(400);
  });

  test('an import may be larger than 1 MB (up to 32 MB)', async () => {
    const big = {format: 'crm-export', version: 1, collections: {customers: {} as Record<string, object>}};
    for (let i = 0; i < 12; i++) big.collections.customers[`c${i}`] = {company: `Exempel ${i}`, notes: 'a'.repeat(100 * 1024)};
    const res = await req('/import', json('POST', big));
    expect(res.status).toBe(200);
    expect((await (await req('/customers')).json()).length).toBe(12);
  });
});
