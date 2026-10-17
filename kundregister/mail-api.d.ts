/* Kontraktet för ett mailtillägg (window.CRM_MAIL).
 * Ett företags tillägg (t.ex. i en privat varumärkesmapp) byggs mot den här filen, så att det typkontrolleras mot appen.
 * Appen använder tillägget bara om checkMailModule (logic.ts) godkänner det; annars loggas erbjudanden utan färdig text. */

/** Det tillägget får veta om kunden */
interface CrmMailCustomer { name?: string; status?: string; type?: string; types?: string[]; jobs?: unknown[]; comms?: unknown[]; }
/** Det tillägget får veta om eventet */
interface CrmMailEvent { id?: string; title?: string; date?: string; endDate?: string; location?: string; }
/** Ett färdigt mail: ämne, text och en kort anteckning till kontaktloggen; tags (valfritt) visas som etiketter, hint (valfritt) som tips under texten */
interface CrmMailText { subject: string; body: string; note: string; kind?: string; tags?: string[]; hint?: string; }
/** Det appen kräver av ett mailtillägg */
interface CrmMailModule {
  buildOffer(c: CrmMailCustomer, e: CrmMailEvent): CrmMailText;
  buildEventFollowUp(c: CrmMailCustomer, e: CrmMailEvent): CrmMailText;
}
/** Hjälpfunktionerna i logiken (window.CRMLogic) som ett tillägg får använda */
interface CrmLogicForMail {
  fmtDate(iso?: string | null): string;
  dayMonth(iso: string): string;
  signature(c: CrmMailCustomer): string;
  customerTypes(c: CrmMailCustomer): string[];
}
