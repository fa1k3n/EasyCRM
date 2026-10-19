/* The logic's language files (crm/logic/i18n.ts): every Swedish text has an English one, with the same
 * {placeholders}. */
import {TEXTS} from '../../../crm/logic/i18n';

const holes = (s: string) => (s.match(/\{\w+\}/g) || []).sort();

test('the logic has the same keys in Swedish and English', () => {
  expect(Object.keys(TEXTS.en).sort()).toEqual(Object.keys(TEXTS.sv).sort());
});
test('the English texts have the same placeholders as the Swedish ones', () => {
  for (const [k, sv] of Object.entries(TEXTS.sv)) expect([k, holes((TEXTS.en as Record<string, string>)[k] ?? '')]).toEqual([k, holes(sv)]);
});
