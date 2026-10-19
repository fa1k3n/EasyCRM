/* Mail: the signature, the check of a mail plugin's texts, and what is saved when a mail is logged as sent. Mail is
 * never sent by the app or the logic. */
import {senderFor} from './brand';
import {lastTouch} from './contact';
import {tx} from './i18n';
import {fmtDate, todayISO} from './time';

// The mail signature comes from the customer's sender in the brand
export const signature = (c: Customer): string => senderFor(c).signature.join('\n');
// Ready mail texts come from an extension's mail (app/src/extensions/api.ts); this checks it is complete.
export function checkMailModule(m: unknown): string[] {
  if (!m || typeof m !== 'object') return [tx('mail.notObject')];
  const mod = m as Record<string, unknown>;
  return ['buildOffer', 'buildEventFollowUp'].filter(k => typeof mod[k] !== 'function').map(k => tx('mail.missingFunction', {name: k}));
}
// A plugin's answer is made safe to show: subject and body are required, tags and hint are optional and always become text
export function normalizeMailText(o: unknown): {subject: string; body: string; note: string; tags: string[]; hint: string} {
  if (!o || typeof o !== 'object') throw new Error(tx('mail.noAnswer'));
  const r = o as Record<string, unknown>;
  for (const f of ['subject', 'body']) if (typeof r[f] !== 'string' || !(r[f] as string).trim()) throw new Error(tx('mail.noText', {field: f}));
  return {subject: String(r.subject), body: String(r.body), note: typeof r.note === 'string' ? r.note : '',
    tags: Array.isArray(r.tags) ? r.tags.map(t => String(t)) : [], hint: typeof r.hint === 'string' ? r.hint : ''};
}
// What is saved when a mail (ready or only logged) is marked as sent: the contact log, the event's mark and the latest contact
export function sentPatch(c: Customer, eventId: string, kind: 'offer' | 'eventfu', m: Comm) {
  const comms = [...(c.comms||[]), m];
  const field = kind === 'eventfu' ? 'followUpSentAt' : 'offeredAt';
  const events = (c.events||[]).map(x => x.id === eventId ? {...x, [field]: m.date} : x);
  return {comms, events, lastContact: lastTouch({comms, jobs: c.jobs || []}), lastMail: {date: m.date, subject: m.subject}};
}
// A draft marked as sent: logged as a mail, the draft is removed and the event it was about is marked
export function draftSentPatch(c: Customer, id: string): Partial<Customer> {
  const d = c.draft || {};
  const m: Comm = {id, kind: 'mail_ut', date: todayISO(), subject: d.subject || '', note: d.summary || tx('mail.draftSent'), body: d.body || ''};
  const comms = [...(c.comms || []), m];
  const patch: Partial<Customer> = {comms, draft: null, lastContact: lastTouch({comms, jobs: c.jobs || []}), lastMail: {date: m.date, subject: m.subject}};
  if (d.eventId) {
    const field = d.kind === 'eventfu' ? 'followUpSentAt' : 'offeredAt';
    patch.events = (c.events || []).map(e => e.id === d.eventId ? {...e, [field]: m.date} : e);
  }
  return patch;
}
// Without a mail plugin only the fact that an offer or a follow-up was sent is logged, with the event's name and date
export function logOnlyEntry(e: CustomerEvent, kind: 'offer' | 'eventfu'): {subject: string; note: string} {
  const title = String(e.title || '').trim() || tx('mail.theEvent'), when = fmtDate(e.date);
  return kind === 'eventfu'
    ? {subject: tx('mail.followUpSubject', {title}), note: tx('mail.followUpNote', {title, when})}
    : {subject: tx('mail.offerSubject', {title}), note: tx('mail.offerNote', {title, when})};
}
