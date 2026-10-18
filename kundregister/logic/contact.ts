/* Contact status: when a customer was last in touch (a mail, a call, a meeting or a job), yellow from 60 days and red
 * from 90 days. */
import {addDays, daysSince, todayISO} from './time';

export const KINDS: Record<string, string> = {mail_ut:'Mail skickat', mail_in:'Mail mottaget', samtal:'Samtal', mote:'Möte', ovrigt:'Övrigt'};
export const LIMIT = 90, WARN = 60;
export const INV_STATUS: Record<string, string> = {published:'Skickad', paid:'Betald', overPaid:'Överbetald', underPaid:'Delbetald', overdue:'Förfallen', credited:'Krediterad', credit:'Kreditnota'};

// The latest contact up to today: the newest logged contact or job
export function lastTouch(c: Customer): ISODate | null {
  let d: ISODate | null = null; const t = todayISO();
  for (const m of c.comms||[]) if (m.date && m.date <= t && (!d || m.date > d)) d = m.date;
  for (const j of c.jobs||[]) if (j.date && j.date <= t && (!d || j.date > d)) d = j.date;
  return d;
}
export function status(c: Customer): ContactStatus {
  const d = lastTouch(c);
  if (!d) return {level:'never', days:null, d};
  const days = daysSince(d);
  return {level: days >= LIMIT ? 'over' : days >= WARN ? 'warn' : 'ok', days, d};
}
export const needsContact = (c: Customer): boolean => { const l = status(c).level; return l === 'over' || l === 'never'; };
export function latestMail(c: Customer): Comm | null {
  let best: Comm | null = null;
  for (const m of c.comms||[]) if ((m.kind === 'mail_ut' || m.kind === 'mail_in') && (!best || m.date! > best.date!)) best = m;
  return best;
}
export function daysLabel(st: ContactStatus): string {
  if (st.level === 'never') return 'Ej kontaktad';
  if (st.days === 0) return 'Idag';
  return st.days + ' d sedan';
}
// The sort order "longest since contact": red first, then never contacted, then yellow, then the rest by days
export const contactScore = (c: Customer): number => { const s = status(c); return s.level==='over' ? 3e6+s.days! : s.level==='never' ? 2e6 : s.level==='warn' ? 1e6+s.days! : s.days!; };
// The day the customer turns red (90 days after the latest contact), or null if never contacted
export const contactDeadline = (c: Customer): ISODate | null => { const d = lastTouch(c); return d ? addDays(d, LIMIT) : null; };
