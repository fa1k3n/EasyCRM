import {render} from '@testing-library/react';
import TypeIcon from './TypeIcon';

const L = () => window.CRMLogic;
const BRAND = {company: {name: 'X'}, colors: {accent: '#0f766e', ink: '#1f2933', bg: '#f6f7f7'}, senders: [{id: 's', signature: ['X']}], defaultSender: 's',
  customerTypes: [
    {id: 'own', label: 'Egen', color: '#111111', icon: 'kamera'},
    {id: 'luc', label: 'Lucide', color: '#111111', icon: 'calendar-days'},
    {id: 'unknown', label: 'Okänd', color: '#111111', icon: 'finns-inte-alls'},
    {id: 'svg', label: 'Svg', color: '#111111', svg: '<rect x="2" y="2" width="12" height="12"/>'}
  ]};
beforeEach(() => L().setBrand(BRAND as unknown as Brand));
afterEach(() => L().setBrand(null));
const draw = (id: string) => render(<TypeIcon id={id} />).container;

test('an icon of the own set is drawn in the 16×16 box, with the type name for screen readers', () => {
  const c = draw('own');
  expect(c.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 16 16');
  expect(c.querySelector('svg rect')).not.toBeNull();
  expect(c.textContent).toBe('Egen');
  expect(c.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
});
test('a lucide name gives the lucide icon', () => {
  expect(draw('luc').querySelector('svg.lucide-calendar-days')).not.toBeNull();
});
test('an unknown name gives the dot', () => {
  expect(draw('unknown').querySelector('svg circle[r="4"]')).not.toBeNull();
});
test("the brand's own svg is drawn as it is (validated by validateBrand)", () => {
  expect(draw('svg').querySelector('svg rect[width="12"]')).not.toBeNull();
});
