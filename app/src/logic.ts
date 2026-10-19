/* Typed access to the shared logic (crm/logic/), which the page loads as a plain script before the app
 * (window.CRMLogic). The data model types (Brand, Customer, ...) are global types declared in logic/. */

export interface CleanFonts { display: string; body: string; google: boolean }

export interface CRMLogicApi {
  EXAMPLE_BRAND: Brand;
  setBrand(b?: Brand | null): void;
  brandFonts(f?: Brand['fonts']): CleanFonts;
  googleFontsUrl(f: CleanFonts): string;
  typeColors(): Record<string, {light: string; dark: string}>;
  deriveColors(colors: BrandColors): DerivedColors;
  validateBrand(b: Brand): string[];
  setClock(fn?: (() => Date) | null): void;
  readonly SERVICE_TYPES: Record<string, string>;
  KINDS: Record<string, string>;
  BOOKING_KINDS: Record<string, string>;
  fmtDate(iso?: string | null): string;
  dayMonth(iso: string): string;
  signature(c: Customer): string;
  daysUntil(iso: string): number;
  status(c: Customer): ContactStatus;
  needsContact(c: Customer): boolean;
  daysLabel(st: ContactStatus): string;
  latestMail(c: Customer): Comm | null;
  upcomingEvents(c: Customer): CustomerEvent[];
  nextEvent(c: Customer): CustomerEvent | null;
  eventBadge(c: Customer): EventBadge | null;
  eventsToFollowUp(c: Customer): CustomerEvent[];
  nextBooking(c: Customer): Booking | null;
  hasBooking(c: Customer): boolean;
  customerTypes(c: Customer): string[];
  filterCustomers<T extends Customer>(customers: T[], view: View): T[];
  segmentCounts(customers: Customer[]): Record<'alla' | 'kontakta' | 'bokat' | 'kunder' | 'potentiella', number>;
  eventWhen(e: CustomerEvent): {kind: 'ongoing' | 'today' | 'tomorrow' | 'days'; days: number};
  eventOpen(c: Customer, e: CustomerEvent | null | undefined): boolean;
  contrastRatio(a: string, b: string): number;
  LIMIT: number;
  INV_STATUS: Record<string, string>;
  todayISO(): string;
  safeUrl(u?: string | null): string | null;
  addCommPatch(c: Customer, m: Comm): Partial<Customer>;
  removeCommPatch(c: Customer, id: string): Partial<Customer>;
  addJobPatch(c: Customer, j: Job): Partial<Customer>;
  removeJobPatch(c: Customer, id: string): Partial<Customer>;
  upcomingBookings(c: Customer): Booking[];
  pastBookings(c: Customer): Booking[];
  addBookingPatch(c: Customer, b: Booking): Partial<Customer>;
  removeBookingPatch(c: Customer, id: string): Partial<Customer>;
  statusPatch(status: 'kund' | 'potentiell'): Partial<Customer>;
  customerFormPatch(f: CustomerFormFields): {patch: Partial<Customer>; errors: string[]};
  senderHint(): string;
  skipKey(c: Customer): string;
  getBrand(): Brand;
  OWN_ICONS: string[];
  hiddenEvents(c: Customer): CustomerEvent[];
  isNewEvent(e: CustomerEvent): boolean;
  hostOf(u: string): string;
  eventConflicts(e: CustomerEvent, customers?: Customer[] | null, busy?: BusyItem[] | null): Conflict[];
  checkMailModule(m: unknown): string[];
  normalizeMailText(o: unknown): MailText;
  sentPatch(c: Customer, eventId: string, kind: 'offer' | 'eventfu', m: Comm): Partial<Customer>;
  logOnlyEntry(e: CustomerEvent, kind: 'offer' | 'eventfu'): {subject: string; note: string};
  addEventPatch(c: Customer, e: CustomerEvent): Partial<Customer>;
  dismissEventPatch(c: Customer, id: string, dismissed: boolean): Partial<Customer>;
  draftSentPatch(c: Customer, id: string): Partial<Customer>;
  typeIcon(id: string): TypeIconSpec;
}

export interface MailText { subject: string; body: string; note: string; tags: string[]; hint: string }

export type TypeIconSpec = {kind: 'svg'; svg: string} | {kind: 'own' | 'lucide'; name: string};

export interface CustomerFormFields {
  company?: string; name?: string; role?: string; email?: string; phone?: string; website?: string; city?: string; notes?: string;
  status: 'kund' | 'potentiell'; types: string[];
}

declare global {
  interface Window {
    CRMLogic: CRMLogicApi;
    /** Set by brand.js when publishing; missing means the example company */
    BRAND?: unknown;
  }
}

export const logic = (): CRMLogicApi => window.CRMLogic;
