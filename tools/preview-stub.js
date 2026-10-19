/* Låtsasdatabas för lokal förhandsvisning av kundregistret (tools/preview.js).
 * Ersätter window.claude så att appen kan visas utan claude.ai. Alla kunder är påhittade exempel. */
(function () {
  const iso = n => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
  const ahead = n => iso(-n);
  let seq = 0;
  const m = (n, subject, kind = 'mail_ut') => ({id: 'm' + (++seq), kind, date: iso(n), subject, note: ''});
  const rows = [
    {id: 'x1', company: 'Exempel Advokatbyrå', name: 'Karin Lund', role: 'Marknadschef', types: ['konsultation', 'projekt'], status: 'kund', email: 'karin@exempel.se', phone: '070-000 00 01', comms: [m(140, 'Porträtt nya medarbetare')], jobs: [{id: 'j1', title: 'Porträtt 12 medarbetare', date: iso(150), amount: '18 000', invoiceNumber: '7', invoiceStatus: 'overdue'}], createdAt: '2026-01-01',
      bookings: [{id: 'bk1', kind: 'mote', title: 'Kaffe med Karin', date: ahead(5), time: '14:00', location: 'Kontoret, Stureplan', source: 'app', gcalEventId: 'x'},
                 {id: 'bk2', kind: 'jobb', title: 'Porträtt nyanställda', date: ahead(19), time: '09:00', source: 'app'},
                 {id: 'bk3', kind: 'samtal', title: 'Avstämning', date: iso(20), time: '10:00', source: 'gcal', gcalEventId: 'y'}],
      followUp: {date: ahead(12), note: 'Fråga om julfotografering'},
      events: [{id: 'e9', title: 'Höstmingel för kunder', date: iso(4), location: 'Kontoret'}, {id: 'e8', title: 'Frukostseminarium om AI', date: ahead(19), location: 'Stureplan', offeredAt: iso(2)}]},
    {id: 'x2', company: 'Exempel Simklubb', name: 'Per Ek', role: 'Ordförande', types: ['event'], status: 'kund', email: 'per@exempel.se', comms: [m(200, 'Livesändning DM')], events: [{id: 'e1', title: 'Distriktsmästerskap', date: ahead(20), location: 'Eriksdalsbadet, Stockholm', foundAt: iso(2)}], createdAt: '2026-02-01'},
    {id: 'x3', company: 'Exempel Revision AB', name: 'Sara Holm', status: 'kund', email: 'sara@exempel.se', comms: [m(70, 'Bokslutsbilder', 'mail_in')], createdAt: '2026-03-01'},
    {id: 'x4', company: 'Exempel Konsult', name: 'Ali Nordin', role: 'HR-chef', types: ['projekt', 'event'], status: 'kund', comms: [m(12, 'Inspelning frukostseminarium')], events: [{id: 'e2', title: 'Höstseminarium', date: ahead(9), location: 'Online'}, {id: 'e3', title: 'Julfrukost', date: ahead(40), location: 'Kontoret'}], createdAt: '2026-04-01'},
    {id: 'x5', company: 'Exempel Fastigheter', name: 'Lena Berg', role: 'Kommunikationsansvarig', status: 'potentiell', source: 'agent', email: 'lena@exempel.se', why: 'Växer och har en medarbetarsida där bilderna har olika stil.', draft: {subject: 'Porträtt till Exempel Fastigheter', body: 'Hej Lena,\n\nExempeltext.'}, createdAt: '2026-10-12'},
    {id: 'x6', company: 'Exempel Arkitekter', status: 'potentiell', createdAt: '2026-10-10'},
    {id: 'x7', company: 'Exempel Rekrytering', name: 'Omar Said', status: 'kund', comms: [m(3, 'Tack för senast')], createdAt: '2026-05-01'},
    {id: 'x8', company: 'Exempel Event & Gala', name: 'Eva Ström', status: 'kund', comms: [m(95, 'Offert gala')], createdAt: '2026-06-01'}
  ];
  const docs = new Map(rows.map(r => [r.id, r]));
  const listeners = new Set();
  const emit = () => { const snap = {docs: [...docs.values()].map(d => ({id: d.id, data: () => d}))}; listeners.forEach(fn => fn(snap)); };
  const ref = id => ({
    id,
    set: async data => { docs.set(id, Object.assign({}, data, {id})); emit(); },
    update: async data => { docs.set(id, Object.assign({}, docs.get(id), data)); emit(); },
    delete: async () => { docs.delete(id); emit(); }
  });
  const collection = () => ({
    doc: id => ref(id || 'n' + Math.random().toString(36).slice(2, 8)),
    onSnapshot: next => { listeners.add(next); setTimeout(emit, 0); return () => listeners.delete(next); }
  });
  // Påhittade upptagna tider i Google Kalender (sync/busy skrivs annars av en kalenderagent)
  const busyDoc = {items: [{date: ahead(9), time: '08:30', title: 'Tandläkare'}], updatedAt: new Date().toISOString()};
  const doc = p => Object.assign(ref(p.split('/').pop()), {
    onSnapshot: next => { setTimeout(() => next(p === 'sync/busy' ? {exists: true, data: () => busyDoc} : {exists: false, data: () => undefined}), 0); return () => {}; }
  });
  const db = {collection, doc};
  const user = {can: async () => true, isOwner: () => true};
  window.claude = {use: async name => (name === 'db' ? db : name === 'user' ? user : null)};
})();
