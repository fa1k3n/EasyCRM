/* The logic's texts in Swedish and English. The language follows the brand (setBrand sets it from brand.json's
 * "language"); a missing or unknown language gives Swedish, and a text missing in a language is taken from Swedish.
 * {name} in a text is replaced by the parameter with that name. */

const sv = {
  'kind.mail_ut': 'Mail skickat', 'kind.mail_in': 'Mail mottaget', 'kind.samtal': 'Samtal', 'kind.mote': 'Möte', 'kind.ovrigt': 'Övrigt',
  'inv.published': 'Skickad', 'inv.paid': 'Betald', 'inv.overPaid': 'Överbetald', 'inv.underPaid': 'Delbetald', 'inv.overdue': 'Förfallen',
  'inv.credited': 'Krediterad', 'inv.credit': 'Kreditnota',
  'booking.jobb': 'Jobb', 'booking.mote': 'Möte', 'booking.samtal': 'Samtal',
  neverContacted: 'Ej kontaktad', today: 'Idag', daysAgo: '{days} d sedan',
  months: 'januari,februari,mars,april,maj,juni,juli,augusti,september,oktober,november,december',
  unnamed: 'Namnlös', busy: 'Upptagen', source: 'Källa',
  'cal.booking': '{kind}: {who}', 'cal.bookingTitle': '{kind}: {who} – {title}',
  'cal.followUp': 'Följ upp: {who}', 'cal.deadline': '{days} dagar utan kontakt: {who}', 'cal.eventFollowUp': 'Följ upp event: {who} – {title}',
  'cal.invoice': 'Förfaller: faktura #{number} {who}', 'cal.invoiceAmount': ' ({amount} kr)',
  'mail.offerSubject': 'Erbjudande inför {title}', 'mail.offerNote': 'Erbjudande inför {title} ({when}) loggat som skickat.',
  'mail.followUpSubject': 'Uppföljning efter {title}', 'mail.followUpNote': 'Uppföljning efter {title} ({when}) loggad som skickad.',
  'mail.theEvent': 'eventet', 'mail.draftSent': 'Mail skickat från utkast',
  'mail.notObject': 'mailtillägget saknas eller är inte ett objekt', 'mail.missingFunction': 'mailtillägget saknar funktionen {name}',
  'mail.noAnswer': 'mailtillägget gav inget svar', 'mail.noText': 'mailtillägget gav ingen text i {field}',
  senderHint: '{label} ger avsändaren {sender} i mailsignaturen.',
  'brand.invalid': 'Varumärket är felaktigt: {errors}',
  'brand.companyName': 'company.name saknas (företagets namn)', 'brand.colors': 'colors saknas',
  'brand.logo': 'logo måste vara ett filnamn (t.ex. logo.png) eller en https-adress: "{logo}"',
  'brand.language': 'language måste vara en språkkod med två små bokstäver, t.ex. "sv": "{value}"',
  'brand.senders': 'senders saknas (minst en avsändare)', 'brand.senderId': 'senders[{i}].id saknas',
  'brand.senderSignature': 'senders[{i}].signature saknas (lista med rader)', 'brand.defaultSender': 'defaultSender saknas',
  'brand.defaultSenderUnknown': 'defaultSender "{id}" finns inte bland senders', 'brand.types': 'customerTypes saknas (lista, får vara tom)',
  'brand.typeId': 'customerTypes[{i}].id "{id}" får bara innehålla a–z, 0–9, - och _', 'brand.typeIdUnique': 'customerTypes: id "{id}" är inte unikt',
  'brand.typeLabel': 'customerTypes[{i}].label saknas',
  'brand.typeIcon': 'customerTypes[{i}].icon "{icon}" ska vara ett ikonnamn med a–z, 0–9 och bindestreck, t.ex. kamera eller calendar-days',
  'svg.urls': 'får inte innehålla url(), javascript: eller teckenkoder', 'svg.text': 'får bara innehålla SVG-element, ingen text',
  'svg.element': 'elementet <{element}> är inte tillåtet (tillåtna: {allowed})', 'svg.attribute': 'attributet {attribute} är inte tillåtet',
  'color.invalid': 'Ogiltig färg i {field}: "{value}" (ange #rrggbb)', 'color.field': 'färg', 'color.typeField': 'kundtyp {id}',
  'color.ink': 'huvudtexten (ink)', 'color.text': 'brödtexten (text)', 'color.muted': 'den dämpade texten (muted)',
  'color.accentInk': 'texten på accentfärgen (accent-ink)', 'color.light': 'ljust läge', 'color.dark': 'mörkt läge',
  'color.onBg': 'bakgrunden', 'color.onAccent': 'accentfärgen',
  'color.lowContrast': '{mode}: {label} har för låg kontrast mot {against} ({ratio}:1, minst {min}:1)'
};
export type LogicTextKey = keyof typeof sv;

const en: Record<LogicTextKey, string> = {
  'kind.mail_ut': 'Mail sent', 'kind.mail_in': 'Mail received', 'kind.samtal': 'Call', 'kind.mote': 'Meeting', 'kind.ovrigt': 'Other',
  'inv.published': 'Sent', 'inv.paid': 'Paid', 'inv.overPaid': 'Overpaid', 'inv.underPaid': 'Partly paid', 'inv.overdue': 'Overdue',
  'inv.credited': 'Credited', 'inv.credit': 'Credit note',
  'booking.jobb': 'Job', 'booking.mote': 'Meeting', 'booking.samtal': 'Call',
  neverContacted: 'Not contacted', today: 'Today', daysAgo: '{days} d ago',
  months: 'January,February,March,April,May,June,July,August,September,October,November,December',
  unnamed: 'Unnamed', busy: 'Busy', source: 'Source',
  'cal.booking': '{kind}: {who}', 'cal.bookingTitle': '{kind}: {who} – {title}',
  'cal.followUp': 'Follow up: {who}', 'cal.deadline': '{days} days without contact: {who}', 'cal.eventFollowUp': 'Follow up event: {who} – {title}',
  'cal.invoice': 'Due: invoice #{number} {who}', 'cal.invoiceAmount': ' ({amount} SEK)',
  'mail.offerSubject': 'Offer before {title}', 'mail.offerNote': 'Offer before {title} ({when}) logged as sent.',
  'mail.followUpSubject': 'Follow-up after {title}', 'mail.followUpNote': 'Follow-up after {title} ({when}) logged as sent.',
  'mail.theEvent': 'the event', 'mail.draftSent': 'Mail sent from a draft',
  'mail.notObject': 'the mail extension is missing or is not an object', 'mail.missingFunction': 'the mail extension lacks the function {name}',
  'mail.noAnswer': 'the mail extension gave no answer', 'mail.noText': 'the mail extension gave no text in {field}',
  senderHint: '{label} gives the sender {sender} in the mail signature.',
  'brand.invalid': 'The brand is invalid: {errors}',
  'brand.companyName': 'company.name is missing (the company name)', 'brand.colors': 'colors is missing',
  'brand.logo': 'logo must be a file name (e.g. logo.png) or an https address: "{logo}"',
  'brand.language': 'language must be a language code of two lower-case letters, e.g. "en": "{value}"',
  'brand.senders': 'senders is missing (at least one sender)', 'brand.senderId': 'senders[{i}].id is missing',
  'brand.senderSignature': 'senders[{i}].signature is missing (a list of lines)', 'brand.defaultSender': 'defaultSender is missing',
  'brand.defaultSenderUnknown': 'defaultSender "{id}" is not among senders', 'brand.types': 'customerTypes is missing (a list, may be empty)',
  'brand.typeId': 'customerTypes[{i}].id "{id}" may only contain a–z, 0–9, - and _', 'brand.typeIdUnique': 'customerTypes: id "{id}" is not unique',
  'brand.typeLabel': 'customerTypes[{i}].label is missing',
  'brand.typeIcon': 'customerTypes[{i}].icon "{icon}" should be an icon name with a–z, 0–9 and hyphens, e.g. kamera or calendar-days',
  'svg.urls': 'may not contain url(), javascript: or character references', 'svg.text': 'may only contain SVG elements, no text',
  'svg.element': 'the element <{element}> is not allowed (allowed: {allowed})', 'svg.attribute': 'the attribute {attribute} is not allowed',
  'color.invalid': 'Invalid colour in {field}: "{value}" (use #rrggbb)', 'color.field': 'colour', 'color.typeField': 'customer type {id}',
  'color.ink': 'the main text (ink)', 'color.text': 'the body text (text)', 'color.muted': 'the muted text (muted)',
  'color.accentInk': 'the text on the accent colour (accent-ink)', 'color.light': 'light mode', 'color.dark': 'dark mode',
  'color.onBg': 'the background', 'color.onAccent': 'the accent colour',
  'color.lowContrast': '{mode}: {label} has too low contrast against {against} ({ratio}:1, at least {min}:1)'
};

export const TEXTS: Record<string, Record<LogicTextKey, string>> = {sv, en};
const DEFAULT = 'sv';
let current = DEFAULT;

// The language a language code gives: a known one, otherwise the default
export const languageOf = (lang?: unknown): string => typeof lang === 'string' && TEXTS[lang] ? lang : DEFAULT;
export const setLanguage = (lang?: unknown): void => { current = languageOf(lang); };
export const language = (): string => current;

// A text in the current language (or in lang), with its {placeholders} filled in
export function tx(key: LogicTextKey, params: Record<string, string | number> = {}, lang: string = current): string {
  const text = (TEXTS[lang] || sv)[key] ?? sv[key];
  return text.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m));
}
