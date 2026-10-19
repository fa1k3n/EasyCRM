/* A fake database for the local preview of the customer register (tools/preview.js).
 * Replaces window.claude so that the app can be shown without claude.ai. All customers are made-up examples. */
(function () {
  const iso = n => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
  const ahead = n => iso(-n);
  let seq = 0;
  const m = (n, subject, kind = 'mail_ut') => ({id: 'm' + (++seq), kind, date: iso(n), subject, note: ''});
  const rows = [
    {id: 'x1', company: 'Example Law Firm', name: 'Karen Lund', role: 'Head of marketing', types: ['konsultation', 'projekt'], status: 'kund', email: 'karen@example.com', phone: '070-000 00 01', comms: [m(140, 'Portraits of new staff')], jobs: [{id: 'j1', title: 'Portraits of 12 staff', date: iso(150), amount: '18 000', invoiceNumber: '7', invoiceStatus: 'overdue'}], createdAt: '2026-01-01',
      bookings: [{id: 'bk1', kind: 'mote', title: 'Coffee with Karen', date: ahead(5), time: '14:00', location: 'The office, Main Street', source: 'app', gcalEventId: 'x'},
                 {id: 'bk2', kind: 'jobb', title: 'Portraits of new hires', date: ahead(19), time: '09:00', source: 'app'},
                 {id: 'bk3', kind: 'samtal', title: 'Check-in', date: iso(20), time: '10:00', source: 'gcal', gcalEventId: 'y'}],
      followUp: {date: ahead(12), note: 'Ask about Christmas photos'},
      events: [{id: 'e9', title: 'Autumn mingle for clients', date: iso(4), location: 'The office'}, {id: 'e8', title: 'Breakfast seminar on AI', date: ahead(19), location: 'Main Street', offeredAt: iso(2)}]},
    {id: 'x2', company: 'Example Swim Club', name: 'Peter Oak', role: 'Chair', types: ['event'], status: 'kund', email: 'peter@example.com', comms: [m(200, 'Live stream of the championship')], events: [{id: 'e1', title: 'District championship', date: ahead(20), location: 'City Pool, Example Town', foundAt: iso(2)}], createdAt: '2026-02-01'},
    {id: 'x3', company: 'Example Accounting Ltd', name: 'Sarah Holm', status: 'kund', email: 'sarah@example.com', comms: [m(70, 'Annual report photos', 'mail_in')], createdAt: '2026-03-01'},
    {id: 'x4', company: 'Example Consulting', name: 'Ali North', role: 'Head of HR', types: ['projekt', 'event'], status: 'kund', comms: [m(12, 'Recording of the breakfast seminar')], events: [{id: 'e2', title: 'Autumn seminar', date: ahead(9), location: 'Online'}, {id: 'e3', title: 'Christmas breakfast', date: ahead(40), location: 'The office'}], createdAt: '2026-04-01'},
    {id: 'x5', company: 'Example Property', name: 'Lena Berg', role: 'Head of communications', status: 'potentiell', source: 'agent', email: 'lena@example.com', why: 'Growing, and the staff page has photos in different styles.', draft: {subject: 'Portraits for Example Property', body: 'Hi Lena,\n\nExample text.'}, createdAt: '2026-10-12'},
    {id: 'x6', company: 'Example Architects', status: 'potentiell', createdAt: '2026-10-10'},
    {id: 'x7', company: 'Example Recruitment', name: 'Omar Said', status: 'kund', comms: [m(3, 'Thanks for last time')], createdAt: '2026-05-01'},
    {id: 'x8', company: 'Example Events & Galas', name: 'Eve Stream', status: 'kund', comms: [m(95, 'Quote for the gala')], createdAt: '2026-06-01'}
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
  // Made-up busy times in Google Calendar (sync/busy is otherwise written by a calendar agent)
  const busyDoc = {items: [{date: ahead(9), time: '08:30', title: 'Dentist'}], updatedAt: new Date().toISOString()};
  const doc = p => Object.assign(ref(p.split('/').pop()), {
    onSnapshot: next => { setTimeout(() => next(p === 'sync/busy' ? {exists: true, data: () => busyDoc} : {exists: false, data: () => undefined}), 0); return () => {}; }
  });
  const db = {collection, doc};
  const user = {can: async () => true, isOwner: () => true};
  window.claude = {use: async name => (name === 'db' ? db : name === 'user' ? user : null)};
})();
