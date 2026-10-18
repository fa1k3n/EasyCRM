/* The data model: the documents in the "customers" collection and the brand (brand.json). These are global types
 * (this file is a script, not a module), so the logic's modules, the React app and an extension's type check all see
 * them without imports. The types are also the documentation of the data model. */

/** A date as text "YYYY-MM-DD" */
type ISODate = string;
/** A customer type's id, e.g. "konsultation"; which ones exist is decided by the brand */
type ServiceType = string;
/** An old type value written for older agents, if the brand has rules for it */
type LegacyType = string;

/* ---------- The brand (brand.json) ---------- */
interface Sender { id: string; name?: string; company?: string; phone?: string; email?: string; web?: string; /** the lines of the mail signature */ signature: string[]; }
interface CustomerTypeDef { id: string; label: string; color: string; colorDark?: string; /** a name in the app's own icon set (OWN_ICONS) or a lucide name, e.g. calendar-days */ icon?: string; /** own icon: SVG content for viewBox 0 0 16 16 */ svg?: string; /** the sender's id */ sender?: string; }
interface BrandColors { accent: string; ink: string; bg: string; accentHover?: string; overrides?: { light?: Record<string, string>; dark?: Record<string, string> }; }
interface DerivedColors { light: Record<string, string>; dark: Record<string, string>; warnings: string[]; }
interface Brand {
  company: { name: string; short?: string };
  logo?: string;
  colors: BrandColors;
  /** heading and body fonts; googleFonts true loads them from Google Fonts */
  fonts?: { display?: string; body?: string; googleFonts?: boolean };
  senders: Sender[];
  defaultSender: string;
  customerTypes: CustomerTypeDef[];
  /** old type values → type ids */
  legacyTypes?: Record<string, string[]>;
  /** rules for which old type value is written: the first rule where the customer has any of the types ('*' = any) */
  legacyWrite?: { type: string; ifAny: string[] }[];
  legacyDefault?: string;
  /** the app's language, a language code like "sv" (optional; Swedish if missing or unknown) */
  language?: string;
}
type BookingKind = 'jobb' | 'mote' | 'samtal';

/* ---------- The customer ---------- */
interface Comm { id?: string; kind?: string; date?: ISODate; subject?: string; note?: string; body?: string; gmailId?: string; bookingId?: string; }
/** Agents may store their own fields on jobs and customers (e.g. ids in an accounting system); they are kept but not used by the logic */
interface Job { id?: string; title?: string; date?: ISODate; amount?: string; invoiceUrl?: string; invoiceNumber?: string | number; invoiceStatus?: string; dueDate?: ISODate; }
interface CustomerEvent {
  id?: string; title?: string; date?: ISODate; endDate?: ISODate; location?: string; url?: string; sourceLabel?: string; why?: string;
  source?: string; foundAt?: string; dismissed?: boolean; offeredAt?: string | null; followUpSentAt?: string | null;
}
interface Booking { id?: string; kind?: string; title?: string; date?: ISODate; time?: string; durationMin?: number; location?: string; source?: string; gcalEventId?: string; }
interface FollowUp { date?: ISODate; note?: string; }
/** A mail draft that has not been sent; kind "eventfu" = follow-up after an event, otherwise an offer or a first mail */
interface Draft { subject?: string; body?: string; summary?: string; eventId?: string; kind?: string; }
interface Customer {
  id?: string; company?: string; name?: string; role?: string; email?: string; phone?: string; website?: string; city?: string; notes?: string;
  /** the extensions' own fields: ext[<extension id>] = any JSON, written only by that extension */
  ext?: Record<string, unknown>;
  /** "kund" | "potentiell" */
  status?: string;
  /** Old type field from older data; translated via the brand's legacyTypes, and written via legacyType if the brand has legacyWrite */
  type?: string;
  types?: string[]; example?: boolean; createdAt?: string; updatedAt?: string; addedAt?: ISODate;
  comms?: Comm[]; jobs?: Job[]; events?: CustomerEvent[]; bookings?: Booking[]; followUp?: FollowUp | null;
  /** Stored by the app and the agents; the logic works out the last contact itself with lastTouch */
  lastContact?: ISODate | null; lastMail?: { date?: ISODate; subject?: string }; lastJob?: { title?: string; date?: ISODate };
  draft?: Draft | null; eventsCheckedAt?: string;
  /** Potential customers suggested by an agent */
  source?: string; why?: string; contactSource?: string; emailConfidence?: 'publicerad' | 'gissad';
}
/** A busy time in Google Calendar (sync/busy, written by the calendar agent) */
interface BusyItem { date?: ISODate; time?: string; endTime?: string; title?: string; eventId?: string; }

/* ---------- What the logic returns ---------- */
interface View { seg?: string; type?: string; q?: string; sort?: string; }
interface ContactStatus { level: 'never' | 'over' | 'warn' | 'ok'; days: number | null; d: ISODate | null; }
interface EventBadge { kind: 'offer' | 'soon'; count: number; }
interface Conflict { date: ISODate; time: string; title: string; source: 'bokning' | 'kalender'; customerId?: string; }
interface CalendarItem {
  key: string; kind: 'booking' | 'followup' | 'deadline' | 'eventfu' | 'invoice'; customerId?: string; title: string; date: ISODate;
  time?: string | null; allDay: boolean; durationMin?: number; location?: string; note?: string;
}
