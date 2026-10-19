/* The app with an English brand (brand.json "language": "en") shows English texts. */
import {render, screen} from '@testing-library/react';
import App from '../App';
import {applyBrand} from '../brand';
import {setLanguage} from './index';

afterEach(() => { setLanguage('sv'); delete window.BRAND; window.CRMLogic.setBrand(null); });

test('the app with an English brand shows English texts', () => {
  window.BRAND = {company: {name: 'Example Ltd'}, colors: {accent: '#0f766e', ink: '#1f2933', bg: '#f6f7f7'}, senders: [{id: 's', signature: ['X']}],
    defaultSender: 's', customerTypes: [], language: 'en'};
  render(<App brand={applyBrand()} />);
  expect(screen.getByText('Loading the customer register…')).toBeTruthy();
  expect(screen.getByText('Choose a customer')).toBeTruthy();
  expect(screen.queryByText('Välj en kund')).toBeNull();
});
