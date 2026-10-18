import {CalendarDays} from 'lucide-react';
import {useState} from 'react';
import type {CustomerDoc} from '../../data/store';
import {useStore, useWrite} from '../../data/StoreContext';
import {t} from '../../i18n';
import {logic} from '../../logic';
import {useToast} from '../Toast';
import {inputClass as input, newId} from './forms';
import RemoveButton from './RemoveButton';

/* One booking: date and time (or all day), kind, title, place and whether it is in the calendar yet. */
function BookingItem({b, onRemove, canWrite, pending}: {b: Booking; onRemove: () => void; canWrite: boolean; pending: boolean}) {
  const L = logic();
  return (
    <li className="grid grid-cols-[92px_1fr_auto] items-start gap-x-3 gap-y-0.5 border-t border-line py-2.5 first:border-t-0">
      <div className="font-display text-[13px]">{L.fmtDate(b.date)}<br />{b.time ? <span className="text-info">{b.time}</span> : <span className="text-muted">{t('allDay')}</span>}</div>
      <div className="min-w-0">
        <div className="font-medium [overflow-wrap:anywhere]">
          <span className="mr-1.5 text-[11px] font-semibold uppercase tracking-wider text-info">{L.BOOKING_KINDS[b.kind || ''] || L.BOOKING_KINDS.mote}</span>{b.title}
        </div>
        {b.location && <div className="text-[13px] text-muted">{b.location}</div>}
        <div className="text-[13px] text-muted">{b.source === 'gcal' ? t('fromCalendar') : b.gcalEventId ? t('inCalendar') : t('calendarNextSync')}</div>
      </div>
      {/* A booking without an id cannot be removed: removing by id would take every booking without one */}
      {canWrite && b.id ? <RemoveButton disabled={pending} onRemove={onRemove} /> : <span />}
    </li>
  );
}

/* The follow-up reminder: a date and a note. A reminder without a date counts as none. */
function FollowUp({c, canWrite}: {c: CustomerDoc; canWrite: boolean}) {
  const L = logic();
  const store = useStore();
  const toast = useToast();
  const {run, pending} = useWrite();
  const current = c.followUp?.date ? c.followUp : null;
  const [date, setDate] = useState(current?.date || '');
  const [note, setNote] = useState(current?.note || '');
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!date) { toast(t('followUpNeedsDate')); return; }
    run(() => store!.updateCustomer(c.id, {followUp: {date, note: note.trim()}}), t('followUpSaved'));
  };
  if (!canWrite) {
    return current ? <p className="mt-3 border-t border-dashed border-line pt-3 text-[13px] text-muted">{t('followUpLabel')}: {L.fmtDate(current.date)}{current.note ? ` – ${current.note}` : ''}</p> : null;
  }
  return (
    <form onSubmit={save} className="mt-3 flex flex-wrap items-center gap-2 border-t border-dashed border-line pt-3">
      <span className="basis-full text-[11px] font-semibold uppercase tracking-wider text-muted">{t('followUpLabel')}</span>
      <input type="date" aria-label={t('followUpDate')} value={date} onChange={e => setDate(e.target.value)} className="min-w-0 rounded-md border border-line bg-bg px-2.5 py-1.5" />
      <input aria-label={t('followUpNote')} placeholder={t('followUpNotePlaceholder')} value={note} onChange={e => setNote(e.target.value)}
        className="min-w-0 flex-[1_1_200px] rounded-md border border-line bg-bg px-2.5 py-1.5" />
      <button type="submit" disabled={pending} className="rounded-full border border-line bg-surface px-2.5 py-1 text-[13px] font-medium disabled:opacity-60">{t('save')}</button>
      {current && <button type="button" disabled={pending} aria-label={t('removeFollowUp')} onClick={() => run(() => store!.updateCustomer(c.id, {followUp: null}), t('followUpRemoved'))}
        className="rounded-full px-2.5 py-1 text-[13px] text-muted hover:bg-sunk hover:text-ink">{t('remove')}</button>}
    </form>
  );
}

/* Bookings (meetings, jobs, calls) and the follow-up reminder. A calendar agent syncs them with the calendar. */
export default function Bookings({c}: {c: CustomerDoc}) {
  const L = logic();
  const store = useStore();
  const {run, pending} = useWrite();
  const canWrite = !!store?.canWrite;
  const [kind, setKind] = useState('mote');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [title, setTitle] = useState('');
  const [place, setPlace] = useState('');
  const upcoming = L.upcomingBookings(c), past = L.pastBookings(c);

  const book = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date) return;
    const b = {id: newId(), kind, date, time, title: title.trim(), location: place.trim(), source: 'app', createdAt: new Date().toISOString()};
    if (await run(() => store!.updateCustomer(c.id, L.addBookingPatch(c, b)), t('booked'))) { setDate(''); setTime(''); setTitle(''); setPlace(''); }
  };
  const remove = (id: string) => run(() => store!.updateCustomer(c.id, L.removeBookingPatch(c, id)), t('bookingRemoved'));

  return (
    <section className="mt-5 rounded-2xl border border-line bg-surface px-4 py-3.5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h3 className="flex items-center gap-1.5 font-display text-[13px] font-semibold uppercase tracking-wider text-info">
          <CalendarDays size={14} aria-hidden /> {t('bookings')} <span className="text-[13px]">{upcoming.length}</span>
        </h3>
        <span className="text-[13px] text-muted">{t('syncedWithCalendar')}</span>
      </div>
      {upcoming.length ? (
        <ul aria-label={t('bookings')} className="mt-2.5">
          {upcoming.map((b, i) => <BookingItem key={b.id || `${b.date}-${b.time}-${i}`} b={b} canWrite={canWrite} pending={pending} onRemove={() => remove(b.id!)} />)}
        </ul>
      ) : <p className="mt-2 text-[13px] text-muted">{t('nothingBooked')}</p>}
      {past.length > 0 && (
        <details className="mt-2.5">
          <summary className="w-fit cursor-pointer rounded-md text-[13px] font-medium text-info">{t('pastBookings', {count: past.length})}</summary>
          <ul className="mt-1">{past.map((b, i) => <BookingItem key={b.id || `${b.date}-${b.time}-${i}`} b={b} canWrite={canWrite} pending={pending} onRemove={() => remove(b.id!)} />)}</ul>
        </details>
      )}
      {canWrite && (
        <form onSubmit={book} className="mt-2.5 grid grid-cols-2 gap-2 rounded-2xl bg-bg p-3 sm:grid-cols-[auto_auto_1fr]">
          <select aria-label={t('bookingKind')} value={kind} onChange={e => setKind(e.target.value)} className={input}>
            {Object.entries(L.BOOKING_KINDS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
          <input type="date" aria-label={t('bookingDate')} required value={date} onChange={e => setDate(e.target.value)} className={input} />
          <input type="time" aria-label={t('bookingTime')} value={time} onChange={e => setTime(e.target.value)} className={`${input} col-span-2 sm:col-span-1`} />
          <input aria-label={t('bookingTitle')} placeholder={t('bookingTitlePlaceholder')} value={title} onChange={e => setTitle(e.target.value)} className={`${input} col-span-full`} />
          <input aria-label={t('bookingPlace')} placeholder={t('bookingPlacePlaceholder')} value={place} onChange={e => setPlace(e.target.value)} className={`${input} col-span-full`} />
          <div className="col-span-full flex justify-end">
            <button type="submit" disabled={pending} className="rounded-full bg-accent px-3 py-1 text-[13px] font-bold text-accent-ink hover:bg-accent-hover disabled:opacity-60">{t('book')}</button>
          </div>
        </form>
      )}
      {/* Keyed by the stored reminder, so the fields follow the database when it changes elsewhere */}
      <FollowUp key={`${c.followUp?.date}|${c.followUp?.note}`} c={c} canWrite={canWrite} />
    </section>
  );
}
