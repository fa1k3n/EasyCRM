import {applyBrand} from '../brand';
import {addCatalog, language, setLanguage, t} from './index';

afterEach(() => { setLanguage('sv'); delete window.BRAND; });

test('t gives the Swedish text for a key', () => {
  expect(t('chooseCustomer')).toBe('Välj en kund');
});

test('a count picks the singular or plural form', () => {
  expect(t('customerCount', {count: 1})).toBe('1 kund');
  expect(t('customerCount', {count: 8})).toBe('8 kunder');
});

test('named parameters are filled in; a parameter that is not given stays as it is', () => {
  addCatalog('zz', {chooseCustomer: 'Hej {name}, välj {what}'});
  setLanguage('zz');
  expect(t('chooseCustomer', {name: 'Anna'})).toBe('Hej Anna, välj {what}');
});

test('a key the language lacks falls back to Swedish', () => {
  addCatalog('zz', {chooseCustomer: 'X'});
  setLanguage('zz');
  expect(t('loading')).toBe('Laddar kundregistret…');
});

test('an unknown language falls back to Swedish; the page language follows', () => {
  setLanguage('xx');
  expect(language()).toBe('sv');
  expect(document.documentElement.lang).toBe('sv');
  expect(t('loading')).toBe('Laddar kundregistret…');
});

test('the language is taken from the brand (language in brand.json)', () => {
  addCatalog('zz', {chooseCustomer: 'Choose'});
  window.BRAND = {company: {name: 'X'}, colors: {accent: '#0f766e', ink: '#1f2933', bg: '#f6f7f7'}, senders: [{id: 's', signature: ['X']}], defaultSender: 's', customerTypes: [], language: 'zz'};
  applyBrand();
  expect(language()).toBe('zz');
  expect(document.documentElement.lang).toBe('zz');
  expect(t('chooseCustomer')).toBe('Choose');
});
