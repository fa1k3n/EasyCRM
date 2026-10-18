import {fakeClaude} from '../../test/fakeDb';
import {createArtifactStore} from './artifactStore';

const tick = () => new Promise(r => setTimeout(r, 0));
const CUSTOMERS = {a1: {company: 'Exempelbolaget AB', status: 'kund'}, a2: {company: 'Exempel Konsult', status: 'potentiell'}};

test('without a database (outside claude.ai) there is no store', async () => {
  expect(await createArtifactStore(fakeClaude({db: false}).claude)).toBeNull();
  expect(await createArtifactStore(undefined)).toBeNull();
});

test('watchCustomers delivers all customers with their id, and again after each change', async () => {
  const {claude} = fakeClaude({customers: CUSTOMERS});
  const store = (await createArtifactStore(claude))!;
  const seen: string[][] = [];
  store.watchCustomers(cs => seen.push(cs.map(c => `${c.id}:${c.company}`).sort()), () => {});
  await tick();
  expect(seen[0]).toEqual(['a1:Exempelbolaget AB', 'a2:Exempel Konsult']);
  await store.updateCustomer('a1', {company: 'Nytt namn AB'});
  expect(seen[seen.length - 1]).toContain('a1:Nytt namn AB');
});

test('updateCustomer merges the fields and stamps updatedAt', async () => {
  const {claude, collections} = fakeClaude({customers: CUSTOMERS});
  const store = (await createArtifactStore(claude))!;
  await store.updateCustomer('a1', {notes: 'Ringt'});
  const doc = collections.get('customers')!.get('a1')!;
  expect(doc.company).toBe('Exempelbolaget AB');
  expect(doc.notes).toBe('Ringt');
  expect(typeof doc.updatedAt).toBe('string');
});

test('createCustomer returns the new id and stamps createdAt and updatedAt; deleteCustomer removes it', async () => {
  const {claude, collections} = fakeClaude();
  const store = (await createArtifactStore(claude))!;
  const id = await store.createCustomer({company: 'Exempel Ny AB', status: 'kund'});
  const doc = collections.get('customers')!.get(id)!;
  expect(doc.company).toBe('Exempel Ny AB');
  expect(typeof doc.createdAt).toBe('string');
  expect(typeof doc.updatedAt).toBe('string');
  await store.deleteCustomer(id);
  expect(collections.get('customers')!.has(id)).toBe(false);
});

test('skipCustomer writes to the skipped collection, so agents do not suggest the company again', async () => {
  const {claude, collections} = fakeClaude();
  const store = (await createArtifactStore(claude))!;
  await store.skipCustomer('exempel.se', {company: 'Exempel AB', website: 'https://exempel.se'});
  expect(collections.get('skipped')!.get('exempel.se')).toMatchObject({company: 'Exempel AB', website: 'https://exempel.se'});
});

test('canWrite follows the user permission', async () => {
  expect((await createArtifactStore(fakeClaude().claude))!.canWrite).toBe(true);
  expect((await createArtifactStore(fakeClaude({canWrite: false}).claude))!.canWrite).toBe(false);
});

test('watchBusy gives the busy times, or null when the calendar has not been synced', async () => {
  const withBusy = (await createArtifactStore(fakeClaude({busy: {items: [{date: '2026-10-20', time: '09:00', title: 'Upptagen'}]}}).claude))!;
  const got: unknown[] = [];
  withBusy.watchBusy(items => got.push(items));
  const without = (await createArtifactStore(fakeClaude().claude))!;
  without.watchBusy(items => got.push(items));
  await tick();
  expect(got).toContainEqual([{date: '2026-10-20', time: '09:00', title: 'Upptagen'}]);
  expect(got).toContainEqual(null);
});

test('a lost connection is reported to the error callback; a failed write rejects', async () => {
  const fake = fakeClaude();
  fake.failing.snapshot = true;
  const store = (await createArtifactStore(fake.claude))!;
  const errors: unknown[] = [];
  store.watchCustomers(() => {}, e => errors.push(e));
  await tick();
  expect(errors).toHaveLength(1);
  fake.failing.write = {code: 'quota_exceeded'};
  await expect(store.updateCustomer('x', {})).rejects.toMatchObject({code: 'quota_exceeded'});
});

test('a new customer gets the same starting values as before: empty jobs and comms, no last contact', async () => {
  const {claude, collections} = fakeClaude();
  const store = (await createArtifactStore(claude))!;
  const id = await store.createCustomer({company: 'Exempel Ny AB'});
  expect(collections.get('customers')!.get(id)).toMatchObject({jobs: [], comms: [], lastContact: null, company: 'Exempel Ny AB'});
});

test('an unreadable sync/busy gives null instead of stopping the app', async () => {
  const fake = fakeClaude();
  fake.failing.busy = true;
  const store = (await createArtifactStore(fake.claude))!;
  const got: unknown[] = [];
  store.watchBusy(items => got.push(items));
  await tick();
  expect(got).toEqual([null]);
});

test('a broken permission check does not stop the register: it is read-only instead', async () => {
  const {claude} = fakeClaude({customers: {a1: {company: 'Exempelbolaget AB'}}});
  const broken = {use: async (name: string) => (name === 'user' ? {can: async () => { throw new Error('no'); }} : claude.use(name))};
  const store = (await createArtifactStore(broken))!;
  expect(store.canWrite).toBe(false);
  const seen: number[] = [];
  store.watchCustomers(cs => seen.push(cs.length), () => {});
  await tick();
  expect(seen).toEqual([1]);
});
