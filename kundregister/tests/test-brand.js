/* Varumärke för de befintliga testerna i logic.test.js: samma kundtyper, gamla typvärden och avsändare som tidigare
 * var inbyggda i logiken, så att testerna prövar exakt samma sak som förut.
 * Avsändare och färger är påhittade; tester för ett riktigt företags signaturer och mail hör hemma i dess privata mapp. */
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
  ],
  legacyTypes: {headshot: ['cv'], liveprod: ['live'], sport: ['live', 'sport'], ovrigt: []},
  legacyWrite: [{type: 'sport', ifAny: ['sport']}, {type: 'liveprod', ifAny: ['live', 'video']}, {type: 'headshot', ifAny: ['*']}],
  legacyDefault: 'ovrigt'
};
window.CRMLogic.setBrand(window.TEST_BRAND);
