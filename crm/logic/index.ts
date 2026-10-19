/* The customer register's logic: pure functions without the DOM or a database, in modules by area. tools/build.js
 * type-checks them and bundles them into one script, crm/logic.js, which sets window.CRMLogic in a browser
 * (and module.exports in Node). This object is that public API; the apps and the tests only use these names.
 * Never edit logic.js by hand. */
import {addBookingPatch, bookingKinds, calendarItems, hasBooking, nextBooking, pastBookings, removeBookingPatch, upcomingBookings} from './bookings';
import {
  EXAMPLE_BRAND, OWN_ICONS, brandFonts, customerTypes, getBrand, googleFontsUrl, senderFor, senderHint, serviceTypes,
  setBrand, typeColors, typeIcon, validateBrand
} from './brand';
import {addCommPatch, addJobPatch, customerFormPatch, removeCommPatch, removeJobPatch, statusPatch} from './card';
import {contrastRatio, deriveColors} from './colors';
import {LIMIT, contactDeadline, daysLabel, invoiceStatuses, kinds, lastTouch, latestMail, needsContact, status} from './contact';
import {
  addEventPatch, dismissEventPatch, eventBadge, eventConflicts, eventOpen, eventSoon, eventWhen, eventsToFollowUp, hasEvent,
  hiddenEvents, isNewEvent, nextEvent, openEvents, upcomingEvents
} from './events';
import {filterCustomers, segmentCounts, skipKey} from './list';
import {checkMailModule, draftSentPatch, logOnlyEntry, normalizeMailText, sentPatch, signature} from './mail';
import {hostOf, safeUrl} from './text';
import {addDays, dayMonth, daysSince, daysUntil, fmtDate, setClock, todayISO} from './time';

export default {
  LIMIT,
  setClock, todayISO, daysSince, fmtDate, dayMonth,
  safeUrl, hostOf,
  lastTouch, status, needsContact, latestMail, daysLabel,
  upcomingEvents, openEvents, hasEvent, hiddenEvents, isNewEvent,
  signature, checkMailModule, logOnlyEntry, normalizeMailText, sentPatch, addEventPatch, dismissEventPatch, draftSentPatch,
  filterCustomers, skipKey,
  addDays, upcomingBookings, nextBooking, hasBooking, contactDeadline, calendarItems,
  segmentCounts, eventWhen, eventOpen,
  addCommPatch, removeCommPatch, addJobPatch, removeJobPatch,
  pastBookings, addBookingPatch, removeBookingPatch,
  statusPatch, customerFormPatch, OWN_ICONS, typeIcon,
  daysUntil, nextEvent, eventSoon, eventsToFollowUp, eventConflicts,
  eventBadge, customerTypes,
  EXAMPLE_BRAND, setBrand, getBrand, validateBrand, senderHint, brandFonts, googleFontsUrl, senderFor, typeColors, deriveColors, contrastRatio,
  // {id: name} for the current brand's customer types (worked out again when the brand changes)
  get SERVICE_TYPES() { return serviceTypes(); },
  // {id: text} in the brand's language: kinds of contact, kinds of booking and invoice statuses
  get KINDS() { return kinds(); },
  get BOOKING_KINDS() { return bookingKinds(); },
  get INV_STATUS() { return invoiceStatuses(); }
};
