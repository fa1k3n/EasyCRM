/* The extension API, version 1: the types an extension is written against. An extension is a module that exports a
 * manifest. It can add sections to the customer card and badges to the list rows. It reads the whole customer
 * (read-only) and saves only in its own field, customer.ext[<its id>], which holds any JSON.
 * A breaking change needs a new apiVersion; the app refuses an extension written for another version. */
import type {ComponentType} from 'react';

export const API_VERSION = 1;

/** Plain JSON: what an extension can save */
export type Json = string | number | boolean | null | Json[] | {[key: string]: Json};

/** The customer as an extension sees it: frozen, so changing it throws */
export type ReadonlyCustomer = Readonly<Customer & {id: string}>;

export interface CustomerSectionProps<T = Json> {
  /** The customer (read-only) */
  customer: ReadonlyCustomer;
  /** What the extension saved for this customer last time (customer.ext[<id>]), or undefined */
  data: T | undefined;
  /** Saves data in customer.ext[<id>]; rejects if it is not JSON or the write fails */
  save: (data: T) => Promise<void>;
  /** false when the signed-in user may only read; save then rejects */
  canWrite: boolean;
}

/** A section on the customer card, under its own heading */
export interface CustomerSection {
  id: string;
  title: string;
  // any: each section chooses its own data type (CustomerSectionProps<T>)
  Component: ComponentType<CustomerSectionProps<any>>;
}

/** A badge on a customer's row in the list, or null for no badge. Called for every row, so keep it quick. */
export type ListBadge = (customer: ReadonlyCustomer) => {text: string; title?: string} | null;

export interface MailText { subject: string; body: string; note: string; kind?: string; tags?: string[]; hint?: string }
export interface MailTexts {
  buildOffer(customer: ReadonlyCustomer, event: CustomerEvent): MailText;
  buildEventFollowUp(customer: ReadonlyCustomer, event: CustomerEvent): MailText;
}

export interface ExtensionManifest {
  /** a–z, 0–9, - and _; also the key in customer.ext; never change it once customers have data */
  id: string;
  apiVersion: number;
  name: string;
  customerSections?: CustomerSection[];
  listBadges?: ListBadge[];
  /** Ready mail texts for offers before a customer's event and follow-ups after it (the mail plugin's contract,
   * kundregister/mail-api.d.ts). The app logs a sent mail itself; the extension only writes the text. */
  mail?: MailTexts;
}
