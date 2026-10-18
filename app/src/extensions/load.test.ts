import {loadExtensions} from './load';

const ok = (id: string) => ({id, apiVersion: 1, name: `Tillägg ${id}`});

test('valid extensions are loaded in their order', () => {
  const r = loadExtensions([ok('a'), {...ok('b'), customerSections: [{id: 's', title: 'S', Component: () => null}], listBadges: [() => null]}]);
  expect(r.errors).toEqual([]);
  expect(r.extensions.map(e => e.id)).toEqual(['a', 'b']);
});

test('another apiVersion is refused with a clear error, and the other extensions are still loaded', () => {
  const r = loadExtensions([{...ok('gammal'), apiVersion: 2}, ok('bra')]);
  expect(r.extensions.map(e => e.id)).toEqual(['bra']);
  expect(r.errors).toHaveLength(1);
  expect(r.errors[0]).toMatch('gammal');
  expect(r.errors[0]).toMatch('apiVersion 2');
});

test('a missing or invalid id, a duplicate id, a missing name or wrong places are refused', () => {
  const r = loadExtensions([null, {apiVersion: 1, name: 'X'}, {...ok('Stora Bokstäver')}, ok('dubbel'), ok('dubbel'), {id: 'utan-namn', apiVersion: 1},
    {...ok('fel-plats'), customerSections: 'nej'}, {...ok('fel-sektion'), customerSections: [{id: 's', title: 'S'}]}, {...ok('fel-marke'), listBadges: ['x']}]);
  expect(r.extensions.map(e => e.id)).toEqual(['dubbel']);
  expect(r.errors).toHaveLength(8);
});

test('no extensions at all is fine', () => {
  expect(loadExtensions(undefined)).toEqual({extensions: [], errors: []});
});

test('mail: an extension with mail texts must have buildOffer and buildEventFollowUp', () => {
  const good = {...ok('mail'), mail: {buildOffer: () => ({}), buildEventFollowUp: () => ({})}};
  const bad = {...ok('halv'), mail: {buildOffer: () => ({})}};
  const r = loadExtensions([good, bad]);
  expect(r.extensions.map(e => e.id)).toEqual(['mail']);
  expect(r.errors[0]).toMatch('buildEventFollowUp');
});
