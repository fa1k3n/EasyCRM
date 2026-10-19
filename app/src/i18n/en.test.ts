/* The app's English language file: every Swedish key has an English text with the same {placeholders}, and a brand
 * with language "en" gives the English texts. */
import {applyBrand} from '../brand';
import {en} from './en';
import {language, setLanguage, t} from './index';
import {sv} from './sv';

afterEach(() => { setLanguage('sv'); delete window.BRAND; });
const holes = (s: string) => (s.match(/\{\w+\}/g) || []).sort();

test('every Swedish key has an English text', () => {
  expect(Object.keys(en).sort()).toEqual(Object.keys(sv).sort());
});
test('the English texts have the same placeholders as the Swedish ones', () => {
  for (const [k, text] of Object.entries(sv)) expect([k, holes((en as Record<string, string>)[k] ?? '')]).toEqual([k, holes(text)]);
});
test('a brand with language "en" gives the English texts, also in plural', () => {
  window.BRAND = {company: {name: 'X'}, colors: {accent: '#0f766e', ink: '#1f2933', bg: '#f6f7f7'}, senders: [{id: 's', signature: ['X']}], defaultSender: 's', customerTypes: [], language: 'en'};
  applyBrand();
  expect(language()).toBe('en');
  expect(t('newCustomer')).toBe('+ New customer');
  expect(t('customerCount', {count: 1})).toBe('1 customer');
  expect(t('customerCount', {count: 3})).toBe('3 customers');
});
