import {render, screen} from '@testing-library/react';
import App from './App';
import {applyBrand} from './brand';

const BRAND = {
  company: {name: 'Testbolaget AB'}, logo: 'logga.png',
  colors: {accent: '#0f766e', ink: '#1f2933', bg: '#f6f7f7'},
  senders: [{id: 's1', signature: ['Test']}], defaultSender: 's1',
  customerTypes: [{id: 'a', label: 'A', color: '#b4532a'}]
};
afterEach(() => { delete window.BRAND; });

test('the header shows the company name and the logo from the brand', () => {
  window.BRAND = BRAND;
  const {container} = render(<App brand={applyBrand()} />);
  expect(screen.getByRole('heading', {level: 1}).textContent).toMatch('Testbolaget AB');
  // The logo is decorative (alt=""), the company name is the heading
  expect(container.querySelector('header img')?.getAttribute('src')).toBe('logga.png');
});

test('the list shows the loading state and the card asks to choose a customer', () => {
  render(<App brand={applyBrand()} />);
  expect(screen.getByText('Laddar kundregistret…')).toBeTruthy();
  expect(screen.getByText('Välj en kund')).toBeTruthy();
});

test('a broken brand shows an error banner, and the example company', () => {
  window.BRAND = {company: {}};
  render(<App brand={applyBrand()} />);
  expect(screen.getByRole('alert').textContent).toMatch('Varumärket kunde inte läsas');
  expect(screen.getByRole('heading', {level: 1}).textContent).toMatch('Exempelstudion AB');
});

test('without the shared logic (logic.js missing) the page shows an error instead of staying empty', () => {
  const {renderApp} = require('./main') as typeof import('./main');
  const root = document.createElement('div');
  document.body.appendChild(root);
  const logic = window.CRMLogic;
  // @ts-expect-error simulate a page where logic.js did not load
  delete window.CRMLogic;
  try {
    renderApp(root);
    expect(root.textContent).toMatch('logic.js');
  } finally {
    window.CRMLogic = logic;
    root.remove();
  }
});

describe('the shell with the data layer', () => {
  const {act} = require('@testing-library/react') as typeof import('@testing-library/react');
  const {fakeClaude} = require('../test/fakeDb') as typeof import('../test/fakeDb');
  const {createArtifactStore} = require('./data/artifactStore') as typeof import('./data/artifactStore');
  const settle = () => act(() => new Promise(r => setTimeout(r, 0)));

  test('outside claude.ai (no database) the list says the register is not available here', () => {
    render(<App brand={applyBrand()} store={null} />);
    expect(screen.getByText('Kundregistret är inte tillgängligt här')).toBeTruthy();
  });
  test('an empty register says so', async () => {
    render(<App brand={applyBrand()} store={await createArtifactStore(fakeClaude().claude)} />);
    await settle();
    expect(screen.getByText('Inga kunder ännu')).toBeTruthy();
  });
  test('with customers the list shows how many (the list itself comes in the next step)', async () => {
    render(<App brand={applyBrand()} store={await createArtifactStore(fakeClaude({customers: {a1: {company: 'Exempelbolaget AB'}, a2: {}}}).claude)} />);
    await settle();
    expect(screen.getByText('2 kunder')).toBeTruthy();
  });
  test('a lost connection shows an error, not an endless loading text', async () => {
    const fake = fakeClaude();
    fake.failing.snapshot = true;
    render(<App brand={applyBrand()} store={await createArtifactStore(fake.claude)} />);
    await settle();
    expect(screen.getByText('Anslutningen bröts')).toBeTruthy();
  });
});

test('a failed connection to the database (inside claude.ai) shows the connection error, not "not available here"', () => {
  render(<App brand={applyBrand()} store={null} connectFailed />);
  expect(screen.getByText('Anslutningen bröts')).toBeTruthy();
});

test('a red lamp on the logo shows when some customer is waiting for contact', async () => {
  const {act} = require('@testing-library/react') as typeof import('@testing-library/react');
  const {fakeClaude} = require('../test/fakeDb') as typeof import('../test/fakeDb');
  const {createArtifactStore} = require('./data/artifactStore') as typeof import('./data/artifactStore');
  const {container} = render(<App brand={applyBrand()} store={await createArtifactStore(fakeClaude({customers: {a1: {company: 'Exempel AB'}}}).claude)} />);
  await act(() => new Promise(r => setTimeout(r, 0)));
  expect(container.querySelector('[data-lamp]')?.getAttribute('title')).toBe('Någon kund väntar på kontakt');
});

test('no lamp when nobody is waiting', async () => {
  const {act} = require('@testing-library/react') as typeof import('@testing-library/react');
  const {fakeClaude} = require('../test/fakeDb') as typeof import('../test/fakeDb');
  const {createArtifactStore} = require('./data/artifactStore') as typeof import('./data/artifactStore');
  const {container} = render(<App brand={applyBrand()} store={await createArtifactStore(fakeClaude().claude)} />);
  await act(() => new Promise(r => setTimeout(r, 0)));
  expect(container.querySelector('[data-lamp]')).toBeNull();
});

test('if the chosen customer disappears (removed elsewhere), the card says so and there is a way back', async () => {
  const {act, fireEvent} = require('@testing-library/react') as typeof import('@testing-library/react');
  const {fakeClaude} = require('../test/fakeDb') as typeof import('../test/fakeDb');
  const {createArtifactStore} = require('./data/artifactStore') as typeof import('./data/artifactStore');
  const store = (await createArtifactStore(fakeClaude({customers: {a1: {company: 'Exempel AB'}}}).claude))!;
  render(<App brand={applyBrand()} store={store} />);
  await act(() => new Promise(r => setTimeout(r, 0)));
  fireEvent.click(screen.getByRole('button', {name: /^Exempel AB/}));
  await act(() => store.deleteCustomer('a1'));
  expect(screen.getByText('Kunden finns inte längre i registret.')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', {name: '← Alla kunder'}));
  expect(screen.queryByText('Kunden finns inte längre i registret.')).toBeNull();
});

test('choosing a customer moves the focus to the card, and going back moves it to the row (keyboard and screen readers)', async () => {
  const {act, fireEvent} = require('@testing-library/react') as typeof import('@testing-library/react');
  const {fakeClaude} = require('../test/fakeDb') as typeof import('../test/fakeDb');
  const {createArtifactStore} = require('./data/artifactStore') as typeof import('./data/artifactStore');
  render(<App brand={applyBrand()} store={await createArtifactStore(fakeClaude({customers: {a1: {company: 'Exempel AB'}}}).claude)} />);
  await act(() => new Promise(r => setTimeout(r, 0)));
  fireEvent.click(screen.getByRole('button', {name: /^Exempel AB/}));
  expect(document.activeElement?.textContent).toBe('Exempel AB');
  fireEvent.click(screen.getByRole('button', {name: '← Alla kunder'}));
  expect((document.activeElement as HTMLElement).dataset.id).toBe('a1');
});

test('the lamp has a text for screen readers', async () => {
  const {act} = require('@testing-library/react') as typeof import('@testing-library/react');
  const {fakeClaude} = require('../test/fakeDb') as typeof import('../test/fakeDb');
  const {createArtifactStore} = require('./data/artifactStore') as typeof import('./data/artifactStore');
  const {container} = render(<App brand={applyBrand()} store={await createArtifactStore(fakeClaude({customers: {a1: {}}}).claude)} />);
  await act(() => new Promise(r => setTimeout(r, 0)));
  expect(container.querySelector('[data-lamp]')?.textContent).toBe('Någon kund väntar på kontakt');
});

test('"+ Ny kund" opens the form; the new customer is shown on the card; read-only has no such button', async () => {
  const {act, fireEvent, cleanup} = require('@testing-library/react') as typeof import('@testing-library/react');
  const {fakeClaude} = require('../test/fakeDb') as typeof import('../test/fakeDb');
  const {createArtifactStore} = require('./data/artifactStore') as typeof import('./data/artifactStore');
  render(<App brand={applyBrand()} store={await createArtifactStore(fakeClaude().claude)} />);
  await act(() => new Promise(r => setTimeout(r, 0)));
  fireEvent.click(screen.getByRole('button', {name: '+ Ny kund'}));
  fireEvent.change(screen.getByRole('textbox', {name: 'Företag / organisation'}), {target: {value: 'Exempel Ny AB'}});
  fireEvent.click(screen.getByRole('button', {name: 'Lägg till'}));
  await act(() => new Promise(r => setTimeout(r, 0)));
  expect(screen.getByRole('heading', {level: 2}).textContent).toBe('Exempel Ny AB');
  cleanup();
  render(<App brand={applyBrand()} store={await createArtifactStore(fakeClaude({canWrite: false}).claude)} />);
  await act(() => new Promise(r => setTimeout(r, 0)));
  expect(screen.queryByRole('button', {name: '+ Ny kund'})).toBeNull();
});

test('after removing the chosen customer the focus goes to the search field', async () => {
  const {act, fireEvent} = require('@testing-library/react') as typeof import('@testing-library/react');
  const {fakeClaude} = require('../test/fakeDb') as typeof import('../test/fakeDb');
  const {createArtifactStore} = require('./data/artifactStore') as typeof import('./data/artifactStore');
  render(<App brand={applyBrand()} store={await createArtifactStore(fakeClaude({customers: {a1: {company: 'Exempel AB'}, a2: {company: 'Exempel Två AB'}}}).claude)} />);
  await act(() => new Promise(r => setTimeout(r, 0)));
  fireEvent.click(screen.getByRole('button', {name: /^Exempel AB/}));
  fireEvent.click(screen.getByRole('button', {name: 'Ta bort kunden'}));
  fireEvent.click(screen.getByRole('button', {name: 'Ta bort kund'}));
  await act(() => new Promise(r => setTimeout(r, 0)));
  expect(document.activeElement).toBe(screen.getByRole('searchbox'));
});

test('an extension with the wrong apiVersion gives a clear error, and the app still works', () => {
  render(<App brand={applyBrand()} store={null} extensions={[{id: 'framtid', apiVersion: 2, name: 'Framtid'}]} />);
  expect(screen.getByRole('alert').textContent).toMatch('framtid');
  expect(screen.getByRole('heading', {level: 1})).toBeTruthy();
});
