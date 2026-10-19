/* The brand for the tests in logic.test.js: the same customer types and senders that were once built into the logic,
 * so that the tests check exactly the same thing as before.
 * Senders and colours are made up; tests of a real company's signatures and mails belong in its private folder. */
window.TEST_BRAND = {
  company: {name: 'Testföretaget'},
  colors: {accent: '#0f766e', ink: '#1f2933', bg: '#f6f7f7'},
  senders: [
    {id: 'standard', signature: ['Förnamn Efternamn', 'Testföretaget', '000-000 00 00 · www.test.example']},
    {id: 'sport', signature: ['Förnamn Efternamn', 'Testföretaget och Testsporten', '000-000 00 00 · info@testsporten.example', 'www.testsporten.example']}
  ],
  defaultSender: 'standard',
  customerTypes: [
    {id: 'cv', label: 'CV', color: '#b4532a', icon: 'person'},
    {id: 'foto', label: 'Foto', color: '#b45309', icon: 'kamera'},
    {id: 'video', label: 'Video', color: '#6d28d9', icon: 'film'},
    {id: 'live', label: 'Live', color: '#1d4ed8', icon: 'sandning'},
    {id: 'sport', label: 'Sport', color: '#15803d', icon: 'pokal', sender: 'sport'}
  ]
};
window.CRMLogic.setBrand(window.TEST_BRAND);
