/* The contract for a mail plugin (window.CRM_MAIL, from mail.js). A company's plugin (e.g. in its brand folder) is
 * built against this file, so it is type-checked against the app. The app only uses the plugin if checkMailModule
 * (kundregister/logic/mail.ts) accepts it; otherwise offers are logged without text. In the React app the same texts
 * can also come from an extension's `mail` (exempel/extensions/README.md). */

/** What the plugin is told about the customer */
interface CrmMailCustomer { name?: string; status?: string; type?: string; types?: string[]; jobs?: unknown[]; comms?: unknown[]; }
/** What the plugin is told about the event */
interface CrmMailEvent { id?: string; title?: string; date?: string; endDate?: string; location?: string; }
/** A finished mail: subject, body and a short note for the contact log; tags (optional) are shown as labels, hint (optional) as a tip under the text */
interface CrmMailText { subject: string; body: string; note: string; kind?: string; tags?: string[]; hint?: string; }
/** What the app requires of a mail plugin */
interface CrmMailModule {
  buildOffer(c: CrmMailCustomer, e: CrmMailEvent): CrmMailText;
  buildEventFollowUp(c: CrmMailCustomer, e: CrmMailEvent): CrmMailText;
}
/** The logic's helpers (window.CRMLogic) a plugin may use */
interface CrmLogicForMail {
  fmtDate(iso?: string | null): string;
  dayMonth(iso: string): string;
  signature(c: CrmMailCustomer): string;
  customerTypes(c: CrmMailCustomer): string[];
}
