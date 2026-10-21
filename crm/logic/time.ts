/* Time: today's date and date formats. The clock can be replaced with setClock(), so the tests get a fixed "today". */
import {tx} from './i18n';

let clock: () => Date = () => new Date();
export const setClock = (fn?: (() => Date) | null): void => { clock = fn || (() => new Date()); };
const pad = (n: number): string => String(n).padStart(2,'0');
const toISO = (d: Date): ISODate => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
export const todayISO = (): ISODate => toISO(clock());
export const daysSince = (iso: ISODate): number => { const t = new Date(todayISO()+'T00:00'); const d = new Date(iso+'T00:00'); return Math.round((t.getTime() - d.getTime())/864e5); };
export const daysUntil = (iso: ISODate): number => -daysSince(iso);
export const fmtDate = (iso?: ISODate | null): string => { if (!iso) return ''; const [y,m,d] = iso.split('-'); return `${d}/${m} ${y}`; };
export const dayMonth = (iso: ISODate): string => { const [,m,d] = iso.split('-'); return `${+d} ${tx('months').split(',')[+m-1]}`; };
// Counts at 12:00 local time, so that daylight saving time never moves the date
export const addDays = (iso: ISODate, n: number): ISODate => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return toISO(d); };
// The same day n months later, or the last day of that month if the day does not exist (31 January + 1 = 28/29 February)
export const addMonths = (iso: ISODate, n: number): ISODate => {
  const [y, m, day] = iso.split('-').map(Number);
  const last = new Date(y, m - 1 + n + 1, 0, 12);
  return toISO(new Date(last.getFullYear(), last.getMonth(), Math.min(day, last.getDate()), 12));
};
