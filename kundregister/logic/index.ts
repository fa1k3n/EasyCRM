/* The customer register's logic: pure functions without the DOM or a database, in modules by area. tools/build.js
 * type-checks them and bundles them into one script, kundregister/logic.js, which sets window.CRMLogic in a browser
 * (and module.exports in Node). This object is that public API; the apps and the tests only use these names.
 * Never edit logic.js by hand. */
import {BOOKING_KINDS, addBookingPatch, calendarItems, hasBooking, nextBooking, pastBookings, removeBookingPatch, upcomingBookings} from './bookings';
import {
  EXAMPLE_BRAND, OWN_ICONS, brandFonts, customerTypes, getBrand, googleFontsUrl, legacyType, senderFor, senderHint, serviceTypes,
  setBrand, typeColors, typeIcon, validateBrand
} from './brand';
import {addCommPatch, addJobPatch, customerFormPatch, removeCommPatch, removeJobPatch, statusPatch} from './card';
import {contrastRatio, deriveColors} from './colors';
import {INV_STATUS, KINDS, LIMIT, WARN, contactDeadline, contactScore, daysLabel, lastTouch, latestMail, needsContact, status} from './contact';
import {
  addEventPatch, dismissEventPatch, eventBadge, eventConflicts, eventOpen, eventSoon, eventWhen, eventsToFollowUp, hasEvent,
  hiddenEvents, isNewEvent, nextEvent, openEvents, upcomingEvents
} from './events';
import {filterCustomers, segmentCounts, skipKey} from './list';
import {checkMailModule, draftSentPatch, logOnlyEntry, normalizeMailText, sentPatch, signature} from './mail';
import {esc, hostOf, safeUrl} from './text';
import {MONTHS, addDays, dayMonth, daysSince, daysUntil, fmtDate, setClock, todayISO} from './time';

export default {
  KINDS, LIMIT, WARN, INV_STATUS, MONTHS,
  setClock, todayISO, daysSince, fmtDate, dayMonth,
  esc, safeUrl, hostOf,
  lastTouch, status, needsContact, latestMail, daysLabel,
  upcomingEvents, openEvents, hasEvent, hiddenEvents, isNewEvent,
  signature, checkMailModule, logOnlyEntry, normalizeMailText, sentPatch, addEventPatch, dismissEventPatch, draftSentPatch,
  contactScore, filterCustomers, skipKey,
  BOOKING_KINDS, addDays, upcomingBookings, nextBooking, hasBooking, contactDeadline, calendarItems,
  segmentCounts, eventWhen, eventOpen,
  addCommPatch, removeCommPatch, addJobPatch, removeJobPatch,
  pastBookings, addBookingPatch, removeBookingPatch,
  statusPatch, customerFormPatch, OWN_ICONS, typeIcon,
  daysUntil, nextEvent, eventSoon, eventsToFollowUp, eventConflicts,
  eventBadge, customerTypes, legacyType,
  EXAMPLE_BRAND, setBrand, getBrand, validateBrand, senderHint, brandFonts, googleFontsUrl, senderFor, typeColors, deriveColors, contrastRatio,
  // {id: name} for the current brand's customer types (worked out again when the brand changes)
  get SERVICE_TYPES() { return serviceTypes(); }
};
