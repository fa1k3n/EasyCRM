/* Built by tools/build.js from the TypeScript modules next to this file (crmBundle in tsconfig.json). Never edit by hand. */
(function(global, factory) {
	typeof exports === "object" && typeof module !== "undefined" ? module.exports = factory() : typeof define === "function" && define.amd ? define([], factory) : (global = typeof globalThis !== "undefined" ? globalThis : global || self, global.CRMLogic = factory());
})(this, function() {
	var sv = {
		"kind.mail_ut": "Mail skickat",
		"kind.mail_in": "Mail mottaget",
		"kind.samtal": "Samtal",
		"kind.mote": "Möte",
		"kind.ovrigt": "Övrigt",
		"inv.published": "Skickad",
		"inv.paid": "Betald",
		"inv.overPaid": "Överbetald",
		"inv.underPaid": "Delbetald",
		"inv.overdue": "Förfallen",
		"inv.credited": "Krediterad",
		"inv.credit": "Kreditnota",
		"booking.jobb": "Jobb",
		"booking.mote": "Möte",
		"booking.samtal": "Samtal",
		neverContacted: "Ej kontaktad",
		today: "Idag",
		daysAgo: "{days} d sedan",
		months: "januari,februari,mars,april,maj,juni,juli,augusti,september,oktober,november,december",
		unnamed: "Namnlös",
		busy: "Upptagen",
		source: "Källa",
		"cal.booking": "{kind}: {who}",
		"cal.bookingTitle": "{kind}: {who} – {title}",
		"cal.followUp": "Följ upp: {who}",
		"cal.deadline": "{days} dagar utan kontakt: {who}",
		"cal.eventFollowUp": "Följ upp event: {who} – {title}",
		"cal.invoice": "Förfaller: faktura #{number} {who}",
		"cal.invoiceAmount": " ({amount} kr)",
		"mail.offerSubject": "Erbjudande inför {title}",
		"mail.offerNote": "Erbjudande inför {title} ({when}) loggat som skickat.",
		"mail.followUpSubject": "Uppföljning efter {title}",
		"mail.followUpNote": "Uppföljning efter {title} ({when}) loggad som skickad.",
		"mail.theEvent": "eventet",
		"mail.draftSent": "Mail skickat från utkast",
		"mail.notObject": "mailtillägget saknas eller är inte ett objekt",
		"mail.missingFunction": "mailtillägget saknar funktionen {name}",
		"mail.noAnswer": "mailtillägget gav inget svar",
		"mail.noText": "mailtillägget gav ingen text i {field}",
		senderHint: "{label} ger avsändaren {sender} i mailsignaturen.",
		"brand.invalid": "Varumärket är felaktigt: {errors}",
		"brand.companyName": "company.name saknas (företagets namn)",
		"brand.colors": "colors saknas",
		"brand.logo": "logo måste vara ett filnamn (t.ex. logo.png) eller en https-adress: \"{logo}\"",
		"brand.language": "language måste vara en språkkod med två små bokstäver, t.ex. \"sv\": \"{value}\"",
		"brand.senders": "senders saknas (minst en avsändare)",
		"brand.senderId": "senders[{i}].id saknas",
		"brand.senderSignature": "senders[{i}].signature saknas (lista med rader)",
		"brand.defaultSender": "defaultSender saknas",
		"brand.defaultSenderUnknown": "defaultSender \"{id}\" finns inte bland senders",
		"brand.types": "customerTypes saknas (lista, får vara tom)",
		"brand.typeId": "customerTypes[{i}].id \"{id}\" får bara innehålla a–z, 0–9, - och _",
		"brand.typeIdUnique": "customerTypes: id \"{id}\" är inte unikt",
		"brand.typeLabel": "customerTypes[{i}].label saknas",
		"brand.typeIcon": "customerTypes[{i}].icon \"{icon}\" ska vara ett ikonnamn med a–z, 0–9 och bindestreck, t.ex. kamera eller calendar-days",
		"svg.urls": "får inte innehålla url(), javascript: eller teckenkoder",
		"svg.text": "får bara innehålla SVG-element, ingen text",
		"svg.element": "elementet <{element}> är inte tillåtet (tillåtna: {allowed})",
		"svg.attribute": "attributet {attribute} är inte tillåtet",
		"color.invalid": "Ogiltig färg i {field}: \"{value}\" (ange #rrggbb)",
		"color.field": "färg",
		"color.typeField": "kundtyp {id}",
		"color.ink": "huvudtexten (ink)",
		"color.text": "brödtexten (text)",
		"color.muted": "den dämpade texten (muted)",
		"color.accentInk": "texten på accentfärgen (accent-ink)",
		"color.light": "ljust läge",
		"color.dark": "mörkt läge",
		"color.onBg": "bakgrunden",
		"color.onAccent": "accentfärgen",
		"color.lowContrast": "{mode}: {label} har för låg kontrast mot {against} ({ratio}:1, minst {min}:1)"
	};
	var TEXTS = {
		sv,
		en: {
			"kind.mail_ut": "Mail sent",
			"kind.mail_in": "Mail received",
			"kind.samtal": "Call",
			"kind.mote": "Meeting",
			"kind.ovrigt": "Other",
			"inv.published": "Sent",
			"inv.paid": "Paid",
			"inv.overPaid": "Overpaid",
			"inv.underPaid": "Partly paid",
			"inv.overdue": "Overdue",
			"inv.credited": "Credited",
			"inv.credit": "Credit note",
			"booking.jobb": "Job",
			"booking.mote": "Meeting",
			"booking.samtal": "Call",
			neverContacted: "Not contacted",
			today: "Today",
			daysAgo: "{days} d ago",
			months: "January,February,March,April,May,June,July,August,September,October,November,December",
			unnamed: "Unnamed",
			busy: "Busy",
			source: "Source",
			"cal.booking": "{kind}: {who}",
			"cal.bookingTitle": "{kind}: {who} – {title}",
			"cal.followUp": "Follow up: {who}",
			"cal.deadline": "{days} days without contact: {who}",
			"cal.eventFollowUp": "Follow up event: {who} – {title}",
			"cal.invoice": "Due: invoice #{number} {who}",
			"cal.invoiceAmount": " ({amount} SEK)",
			"mail.offerSubject": "Offer before {title}",
			"mail.offerNote": "Offer before {title} ({when}) logged as sent.",
			"mail.followUpSubject": "Follow-up after {title}",
			"mail.followUpNote": "Follow-up after {title} ({when}) logged as sent.",
			"mail.theEvent": "the event",
			"mail.draftSent": "Mail sent from a draft",
			"mail.notObject": "the mail extension is missing or is not an object",
			"mail.missingFunction": "the mail extension lacks the function {name}",
			"mail.noAnswer": "the mail extension gave no answer",
			"mail.noText": "the mail extension gave no text in {field}",
			senderHint: "{label} gives the sender {sender} in the mail signature.",
			"brand.invalid": "The brand is invalid: {errors}",
			"brand.companyName": "company.name is missing (the company name)",
			"brand.colors": "colors is missing",
			"brand.logo": "logo must be a file name (e.g. logo.png) or an https address: \"{logo}\"",
			"brand.language": "language must be a language code of two lower-case letters, e.g. \"en\": \"{value}\"",
			"brand.senders": "senders is missing (at least one sender)",
			"brand.senderId": "senders[{i}].id is missing",
			"brand.senderSignature": "senders[{i}].signature is missing (a list of lines)",
			"brand.defaultSender": "defaultSender is missing",
			"brand.defaultSenderUnknown": "defaultSender \"{id}\" is not among senders",
			"brand.types": "customerTypes is missing (a list, may be empty)",
			"brand.typeId": "customerTypes[{i}].id \"{id}\" may only contain a–z, 0–9, - and _",
			"brand.typeIdUnique": "customerTypes: id \"{id}\" is not unique",
			"brand.typeLabel": "customerTypes[{i}].label is missing",
			"brand.typeIcon": "customerTypes[{i}].icon \"{icon}\" should be an icon name with a–z, 0–9 and hyphens, e.g. kamera or calendar-days",
			"svg.urls": "may not contain url(), javascript: or character references",
			"svg.text": "may only contain SVG elements, no text",
			"svg.element": "the element <{element}> is not allowed (allowed: {allowed})",
			"svg.attribute": "the attribute {attribute} is not allowed",
			"color.invalid": "Invalid colour in {field}: \"{value}\" (use #rrggbb)",
			"color.field": "colour",
			"color.typeField": "customer type {id}",
			"color.ink": "the main text (ink)",
			"color.text": "the body text (text)",
			"color.muted": "the muted text (muted)",
			"color.accentInk": "the text on the accent colour (accent-ink)",
			"color.light": "light mode",
			"color.dark": "dark mode",
			"color.onBg": "the background",
			"color.onAccent": "the accent colour",
			"color.lowContrast": "{mode}: {label} has too low contrast against {against} ({ratio}:1, at least {min}:1)"
		}
	};
	var DEFAULT = "sv";
	var current = DEFAULT;
	var languageOf = (lang) => typeof lang === "string" && TEXTS[lang] ? lang : DEFAULT;
	var setLanguage = (lang) => {
		current = languageOf(lang);
	};
	var language = () => current;
	function tx(key, params = {}, lang = current) {
		return ((TEXTS[lang] || sv)[key] ?? sv[key]).replace(/\{(\w+)\}/g, (m, k) => k in params ? String(params[k]) : m);
	}
	var clock = () => /* @__PURE__ */ new Date();
	var setClock = (fn) => {
		clock = fn || (() => /* @__PURE__ */ new Date());
	};
	var pad = (n) => String(n).padStart(2, "0");
	var toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
	var todayISO = () => toISO(clock());
	var daysSince = (iso) => {
		const t = /* @__PURE__ */ new Date(todayISO() + "T00:00");
		const d = /* @__PURE__ */ new Date(iso + "T00:00");
		return Math.round((t.getTime() - d.getTime()) / 864e5);
	};
	var daysUntil = (iso) => -daysSince(iso);
	var fmtDate = (iso) => {
		if (!iso) return "";
		const [y, m, d] = iso.split("-");
		return `${d}/${m} ${y}`;
	};
	var dayMonth = (iso) => {
		const [, m, d] = iso.split("-");
		return `${+d} ${tx("months").split(",")[+m - 1]}`;
	};
	var addDays = (iso, n) => {
		const d = /* @__PURE__ */ new Date(iso + "T12:00:00");
		d.setDate(d.getDate() + n);
		return toISO(d);
	};
	var addMonths = (iso, n) => {
		const [y, m, day] = iso.split("-").map(Number);
		const last = new Date(y, m - 1 + n + 1, 0, 12);
		return toISO(new Date(last.getFullYear(), last.getMonth(), Math.min(day, last.getDate()), 12));
	};
	var labels = (prefix, ids) => Object.fromEntries(ids.map((id) => [id, tx(`${prefix}.${id}`)]));
	var kinds = () => labels("kind", [
		"mail_ut",
		"mail_in",
		"samtal",
		"mote",
		"ovrigt"
	]);
	var WARN = 60;
	var invoiceStatuses = () => labels("inv", [
		"published",
		"paid",
		"overPaid",
		"underPaid",
		"overdue",
		"credited",
		"credit"
	]);
	function lastTouch(c) {
		let d = null;
		const t = todayISO();
		for (const m of c.comms || []) if (m.date && m.date <= t && (!d || m.date > d)) d = m.date;
		for (const j of c.jobs || []) if (j.date && j.date <= t && (!d || j.date > d)) d = j.date;
		return d;
	}
	function status(c) {
		const d = lastTouch(c);
		if (!d) return {
			level: "never",
			days: null,
			d
		};
		const days = daysSince(d);
		return {
			level: days >= 90 ? "over" : days >= WARN ? "warn" : "ok",
			days,
			d
		};
	}
	var needsContact = (c) => {
		const l = status(c).level;
		return l === "over" || l === "never";
	};
	function followUpDue(c) {
		const date = c.followUp?.date;
		if (!date || date > todayISO()) return false;
		const last = lastTouch(c);
		return !last || last < date;
	}
	function latestMail(c) {
		let best = null;
		for (const m of c.comms || []) if ((m.kind === "mail_ut" || m.kind === "mail_in") && (!best || m.date > best.date)) best = m;
		return best;
	}
	function daysLabel(st) {
		if (st.level === "never") return tx("neverContacted");
		if (st.days === 0) return tx("today");
		return tx("daysAgo", { days: st.days });
	}
	var contactScore = (c) => {
		if (followUpDue(c)) return 4e6 + daysSince(c.followUp.date);
		const s = status(c);
		return s.level === "over" ? 3e6 + s.days : s.level === "never" ? 2e6 : s.level === "warn" ? 1e6 + s.days : s.days;
	};
	var contactDeadline = (c) => {
		const d = lastTouch(c);
		return d ? addDays(d, 90) : null;
	};
	var SOON_DAYS = 14;
	var EVENT_FOLLOWUP_WINDOW = 30;
	var byDate = (a, b) => (a.date || "").localeCompare(b.date || "");
	var eventEnd = (e) => e.endDate || e.date;
	var upcomingEvents = (c) => (c.events || []).filter((e) => !e.dismissed && (e.endDate || e.date) >= todayISO()).sort(byDate);
	var eventOpen = (c, e) => !!e && !e.offeredAt && c.status !== "potentiell";
	var openEvents = (c) => upcomingEvents(c).filter((e) => eventOpen(c, e));
	var hasEvent = (c) => openEvents(c).length > 0;
	var hiddenEvents = (c) => (c.events || []).filter((e) => e.dismissed && (e.endDate || e.date) >= todayISO()).sort(byDate);
	var isNewEvent = (e) => !!e.foundAt && daysSince(String(e.foundAt).slice(0, 10)) <= 7;
	var nextEvent = (c) => upcomingEvents(c)[0] || null;
	var eventSoon = (c) => {
		const e = nextEvent(c);
		return !!e && daysUntil(e.date) <= SOON_DAYS;
	};
	function eventBadge(c) {
		if (c.status === "potentiell") return null;
		const open = openEvents(c).length;
		if (open) return {
			kind: "offer",
			count: open
		};
		return eventSoon(c) ? {
			kind: "soon",
			count: 0
		} : null;
	}
	var eventsToFollowUp = (c) => c.status === "potentiell" ? [] : (c.events || []).filter((e) => !e.dismissed && !e.followUpSentAt && e.date && eventEnd(e) < todayISO() && daysSince(eventEnd(e)) <= EVENT_FOLLOWUP_WINDOW).sort((a, b) => eventEnd(b).localeCompare(eventEnd(a)));
	var eventWhen = (e) => {
		const days = daysUntil(e.date || todayISO()) + 0;
		return {
			kind: days < 0 ? "ongoing" : days === 0 ? "today" : days === 1 ? "tomorrow" : "days",
			days
		};
	};
	function eventConflicts(e, customers, busy) {
		const from = e.date, to = eventEnd(e), out = [], seenGcal = /* @__PURE__ */ new Set();
		for (const c of customers || []) {
			const who = c.company || c.name || tx("unnamed");
			for (const b of c.bookings || []) {
				if (!b.date || b.date < from || b.date > to) continue;
				if (b.gcalEventId && b.source === "gcal") seenGcal.add(b.gcalEventId);
				out.push({
					date: b.date,
					time: b.time || "",
					title: bookingTitle(b, who),
					source: "bokning",
					customerId: c.id
				});
			}
		}
		for (const x of busy || []) {
			if (!x.date || x.date < from || x.date > to || x.eventId && seenGcal.has(x.eventId)) continue;
			out.push({
				date: x.date,
				time: x.time || "",
				title: x.title || tx("busy"),
				source: "kalender"
			});
		}
		return out.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
	}
	var addEventPatch = (c, e) => ({ events: [...c.events || [], e] });
	var dismissEventPatch = (c, id, dismissed) => ({ events: (c.events || []).map((e) => e.id === id ? {
		...e,
		dismissed
	} : e) });
	function calendarConflicts(customers, busy) {
		const out = [];
		for (const c of customers) for (const e of upcomingEvents(c)) {
			const conflicts = e.id ? eventConflicts(e, customers, busy) : [];
			if (conflicts.length) out.push({
				customerId: c.id,
				eventId: e.id,
				conflicts
			});
		}
		return out;
	}
	var KIND_IDS = [
		"jobb",
		"mote",
		"samtal"
	];
	var bookingKinds = () => Object.fromEntries(KIND_IDS.map((k) => [k, tx(`booking.${k}`)]));
	var bookingTitle = (b, who) => tx(b.title ? "cal.bookingTitle" : "cal.booking", {
		kind: bookingKinds()[b.kind] || tx("booking.mote"),
		who,
		title: b.title || ""
	});
	var bookingSortKey = (b) => (b.date || "") + " " + (b.time || "");
	var upcomingBookings = (c) => (c.bookings || []).filter((b) => b.date && b.date >= todayISO()).sort((a, b) => bookingSortKey(a).localeCompare(bookingSortKey(b)));
	var nextBooking = (c) => upcomingBookings(c)[0] || null;
	var hasBooking = (c) => upcomingBookings(c).length > 0;
	var pastBookings = (c) => (c.bookings || []).filter((b) => b.date && b.date < todayISO()).sort((a, b) => bookingSortKey(b).localeCompare(bookingSortKey(a)));
	var addBookingPatch = (c, b) => ({ bookings: [...c.bookings || [], b] });
	var removeBookingPatch = (c, id) => ({ bookings: (c.bookings || []).filter((b) => b.id !== id) });
	var OPEN_INVOICE = [
		"published",
		"overdue",
		"underPaid"
	];
	function calendarItems(customers) {
		const today = todayISO(), from = addDays(today, -7);
		const items = [];
		for (const c of customers) {
			if (c.example) continue;
			const who = c.company || c.name || tx("unnamed");
			for (const b of c.bookings || []) {
				if (!b.date || b.date < from || b.source === "gcal") continue;
				items.push({
					key: `booking:${c.id}:${b.id}`,
					kind: "booking",
					customerId: c.id,
					title: bookingTitle(b, who),
					date: b.date,
					time: b.time || null,
					allDay: !b.time,
					durationMin: b.durationMin || 60,
					location: b.location || ""
				});
			}
			if (c.followUp && c.followUp.date && c.followUp.date >= today) items.push({
				key: `followup:${c.id}`,
				kind: "followup",
				customerId: c.id,
				title: tx("cal.followUp", { who }),
				date: c.followUp.date,
				allDay: true,
				note: c.followUp.note || ""
			});
			const deadline = contactDeadline(c);
			if (c.status !== "potentiell" && deadline && deadline >= today && !hasBooking(c)) items.push({
				key: `deadline:${c.id}`,
				kind: "deadline",
				customerId: c.id,
				title: tx("cal.deadline", {
					days: 90,
					who
				}),
				date: deadline,
				allDay: true
			});
			if (c.status !== "potentiell") for (const e of c.events || []) {
				if (e.dismissed || e.followUpSentAt || !e.date) continue;
				const date = addDays(eventEnd(e), 3);
				if (date < today) continue;
				items.push({
					key: `eventfu:${c.id}:${e.id}`,
					kind: "eventfu",
					customerId: c.id,
					title: tx("cal.eventFollowUp", {
						who,
						title: e.title || ""
					}),
					date,
					allDay: true
				});
			}
			for (const j of c.jobs || []) {
				if (!j.dueDate || !OPEN_INVOICE.includes(j.invoiceStatus)) continue;
				items.push({
					key: `invoice:${c.id}:${j.id}`,
					kind: "invoice",
					customerId: c.id,
					title: tx("cal.invoice", {
						number: j.invoiceNumber || "",
						who
					}) + (j.amount ? tx("cal.invoiceAmount", { amount: j.amount }) : ""),
					date: j.dueDate,
					allDay: true
				});
			}
		}
		return items.sort((a, b) => a.date.localeCompare(b.date) || a.key.localeCompare(b.key));
	}
	function rgb(c, field, lang = language()) {
		const m = /^#([0-9a-f]{6})$/i.exec(String(c || "").trim());
		if (!m) throw new Error(tx("color.invalid", {
			field,
			value: String(c)
		}, lang));
		const n = parseInt(m[1], 16);
		return [
			n >> 16 & 255,
			n >> 8 & 255,
			n & 255
		];
	}
	var hex = (c, field, lang) => "#" + rgb(c, field, lang).map((v) => v.toString(16).padStart(2, "0")).join("");
	var mix = (a, b, t) => {
		const x = rgb(a, tx("color.field")), y = rgb(b, tx("color.field"));
		return "#" + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, "0")).join("");
	};
	var luminance = (c) => {
		const [r, g, b] = rgb(c, tx("color.field")).map((v) => {
			const s = v / 255;
			return s <= .03928 ? s / 12.92 : Math.pow((s + .055) / 1.055, 2.4);
		});
		return .2126 * r + .7152 * g + .0722 * b;
	};
	var contrastRatio = (a, b) => {
		const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
		return (x + .05) / (y + .05);
	};
	var bestOn = (bg, options) => options.reduce((best, o) => contrastRatio(o, bg) > contrastRatio(best, bg) ? o : best);
	var MIN_TEXT = 4.5;
	function deriveColors(colors, lang = language()) {
		const accent = hex(colors.accent, "colors.accent", lang), ink = hex(colors.ink, "colors.ink", lang), bg = hex(colors.bg, "colors.bg", lang);
		const hover = colors.accentHover ? hex(colors.accentHover, "colors.accentHover", lang) : mix(accent, "#000000", .16);
		const [ir, ig, ib] = rgb(ink, "colors.ink");
		const light = {
			bg,
			surface: "#ffffff",
			sunk: mix(bg, ink, .08),
			ink,
			text: mix(ink, bg, .22),
			muted: mix(ink, bg, .32),
			line: mix(bg, ink, .13),
			accent,
			"accent-hover": hover,
			"accent-ink": bestOn(accent, ["#ffffff", ink]),
			"brand-soft": mix(bg, accent, .18),
			focus: accent,
			shadow: `0 1px 2px rgba(${ir},${ig},${ib},.05),0 10px 28px rgba(${ir},${ig},${ib},.08)`
		};
		const dbg = mix(ink, "#000000", .35), dink = mix(bg, "#ffffff", .6);
		let daccent = mix(accent, "#ffffff", .18);
		for (let t = .18; t <= .7 && contrastRatio(bestOn(daccent, ["#ffffff", dbg]), daccent) < MIN_TEXT; t += .04) daccent = mix(accent, "#ffffff", t);
		const dark = {
			bg: dbg,
			surface: mix(dbg, "#ffffff", .05),
			sunk: mix(dbg, "#ffffff", .09),
			ink: dink,
			text: mix(dink, dbg, .18),
			muted: mix(dink, dbg, .38),
			line: mix(dbg, "#ffffff", .12),
			accent: daccent,
			"accent-hover": mix(accent, "#ffffff", .3),
			"accent-ink": bestOn(daccent, ["#ffffff", dbg]),
			"brand-soft": mix(dbg, accent, .22),
			focus: daccent,
			shadow: "0 1px 2px rgba(0,0,0,.3),0 10px 28px rgba(0,0,0,.35)"
		};
		for (const [mode, target] of [["light", light], ["dark", dark]]) {
			const o = (colors.overrides || {})[mode] || {};
			for (const k of Object.keys(o)) target[k] = k === "shadow" ? o[k] : hex(o[k], `colors.overrides.${mode}.${k}`, lang);
		}
		const warnings = [];
		const checks = [
			[
				"color.ink",
				"ink",
				"bg"
			],
			[
				"color.text",
				"text",
				"bg"
			],
			[
				"color.muted",
				"muted",
				"bg"
			],
			[
				"color.accentInk",
				"accent-ink",
				"accent"
			]
		];
		for (const [name, p] of [["color.light", light], ["color.dark", dark]]) for (const [label, fg, back] of checks) {
			const c = contrastRatio(p[fg], p[back]);
			if (c < MIN_TEXT) warnings.push(tx("color.lowContrast", {
				mode: tx(name, {}, lang),
				label: tx(label, {}, lang),
				against: tx(back === "bg" ? "color.onBg" : "color.onAccent", {}, lang),
				ratio: c.toFixed(1),
				min: MIN_TEXT
			}, lang));
		}
		return {
			light,
			dark,
			warnings
		};
	}
	var EXAMPLE_BRAND = {
		company: { name: "Exempelstudion AB" },
		logo: "logo.svg",
		colors: {
			accent: "#0f766e",
			ink: "#1f2933",
			bg: "#f6f7f7"
		},
		fonts: {
			display: "system-ui",
			body: "system-ui"
		},
		senders: [{
			id: "standard",
			name: "Förnamn Efternamn",
			company: "Exempelstudion AB",
			phone: "000-000 00 00",
			web: "www.exempelstudion.example",
			signature: [
				"Förnamn Efternamn",
				"Exempelstudion AB",
				"000-000 00 00 · www.exempelstudion.example"
			]
		}],
		defaultSender: "standard",
		customerTypes: [
			{
				id: "konsultation",
				label: "Konsultation",
				color: "#0f766e",
				icon: "pratbubbla"
			},
			{
				id: "projekt",
				label: "Projekt",
				color: "#7c3aed",
				icon: "portfolj"
			},
			{
				id: "event",
				label: "Event",
				color: "#b45309",
				icon: "stjarna"
			}
		]
	};
	var brand = EXAMPLE_BRAND;
	var SVG_ELEMENTS = [
		"path",
		"circle",
		"rect",
		"line",
		"polyline",
		"polygon",
		"ellipse",
		"g"
	];
	var SVG_ATTRS = [
		"d",
		"cx",
		"cy",
		"r",
		"rx",
		"ry",
		"x",
		"y",
		"x1",
		"y1",
		"x2",
		"y2",
		"width",
		"height",
		"points",
		"fill",
		"stroke",
		"stroke-width",
		"stroke-linecap",
		"stroke-linejoin",
		"stroke-dasharray",
		"fill-rule",
		"clip-rule",
		"transform",
		"opacity",
		"fill-opacity",
		"stroke-opacity"
	];
	function unsafeSvg(svg, lang) {
		if (/javascript:|url\s*\(|&#|\\/i.test(svg)) return tx("svg.urls", {}, lang);
		const withoutTags = svg.replace(/<[^>]*>/g, "");
		if (/[<>]/.test(withoutTags) || withoutTags.trim()) return tx("svg.text", {}, lang);
		for (const m of svg.matchAll(/<\s*\/?\s*([^\s/>]+)([^>]*)>/g)) {
			const el = m[1].toLowerCase();
			if (!SVG_ELEMENTS.includes(el)) return tx("svg.element", {
				element: m[1],
				allowed: SVG_ELEMENTS.join(", ")
			}, lang);
			for (const a of m[2].matchAll(/([^\s=/"']+)\s*(=\s*("[^"]*"|'[^']*'|[^\s/>]+))?/g)) if (!SVG_ATTRS.includes(a[1].toLowerCase())) return tx("svg.attribute", { attribute: a[1] }, lang);
		}
		return "";
	}
	function validateBrand(b) {
		const e = [], x = b || {};
		const l = languageOf(x.language);
		const t = (key, params = {}) => tx(key, params, l);
		if (!x.company || !x.company.name) e.push(t("brand.companyName"));
		if (!x.colors) e.push(t("brand.colors"));
		else try {
			deriveColors(x.colors, l);
		} catch (err) {
			e.push(err.message);
		}
		if (x.logo && !/^[\w.-]+\.(png|svg|jpe?g|webp)$/i.test(x.logo) && !/^https:\/\/[^\s"'<>]+$/i.test(x.logo)) e.push(t("brand.logo", { logo: x.logo }));
		if (x.language !== void 0 && (typeof x.language !== "string" || !/^[a-z]{2}$/.test(x.language))) e.push(t("brand.language", { value: String(x.language) }));
		if (!Array.isArray(x.senders) || !x.senders.length) e.push(t("brand.senders"));
		else x.senders.forEach((s, i) => {
			if (!s.id) e.push(t("brand.senderId", { i }));
			if (!Array.isArray(s.signature)) e.push(t("brand.senderSignature", { i }));
		});
		if (!x.defaultSender) e.push(t("brand.defaultSender"));
		else if (Array.isArray(x.senders) && !x.senders.some((s) => s.id === x.defaultSender)) e.push(t("brand.defaultSenderUnknown", { id: x.defaultSender }));
		if (!Array.isArray(x.customerTypes)) e.push(t("brand.types"));
		else {
			const seen = /* @__PURE__ */ new Set();
			x.customerTypes.forEach((ct, i) => {
				if (!/^[a-z0-9_-]+$/.test(ct.id || "")) e.push(t("brand.typeId", {
					i,
					id: String(ct.id)
				}));
				else if (seen.has(ct.id)) e.push(t("brand.typeIdUnique", { id: ct.id }));
				seen.add(ct.id);
				if (!ct.label) e.push(t("brand.typeLabel", { i }));
				try {
					hex(ct.color, `customerTypes[${i}].color`, l);
					if (ct.colorDark) hex(ct.colorDark, `customerTypes[${i}].colorDark`, l);
				} catch (err) {
					e.push(err.message);
				}
				if (ct.icon !== void 0 && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(ct.icon)) e.push(t("brand.typeIcon", {
					i,
					icon: ct.icon
				}));
				const svgErr = ct.svg ? unsafeSvg(ct.svg, l) : "";
				if (svgErr) e.push(`customerTypes[${i}].svg: ${svgErr}`);
			});
		}
		return e;
	}
	var setBrand = (b) => {
		if (!b) {
			brand = EXAMPLE_BRAND;
			setLanguage(void 0);
			return;
		}
		const errors = validateBrand(b);
		if (errors.length) throw new Error(tx("brand.invalid", { errors: errors.join("; ") }, languageOf(b.language)));
		brand = b;
		setLanguage(b.language);
	};
	var getBrand = () => brand;
	var serviceTypes = () => Object.fromEntries(brand.customerTypes.map((t) => [t.id, t.label]));
	function customerTypes(c) {
		const src = Array.isArray(c.types) ? c.types : [];
		return brand.customerTypes.map((t) => t.id).filter((id) => src.includes(id));
	}
	function senderFor(c) {
		const byId = (id) => brand.senders.find((s) => s.id === id);
		for (const id of customerTypes(c)) {
			const s = byId(brand.customerTypes.find((t) => t.id === id)?.sender);
			if (s) return s;
		}
		return byId(brand.defaultSender) || brand.senders[0];
	}
	var senderHint = () => brand.customerTypes.map((t) => {
		const s = brand.senders.find((x) => x.id === t.sender);
		return s && s.id !== brand.defaultSender ? tx("senderHint", {
			label: t.label,
			sender: s.company || s.name || s.id
		}) : "";
	}).filter(Boolean).join(" ");
	var brandFonts = (f = {}) => {
		const clean = (n) => n && !/^system-ui$/i.test(n) ? String(n).replace(/[^\w\s-]/g, "") : "";
		return {
			display: clean(f.display),
			body: clean(f.body),
			google: !!f.googleFonts
		};
	};
	var googleFontsUrl = (f) => {
		const families = [...new Set([f.display, f.body].filter(Boolean))];
		return f.google && families.length ? "https://fonts.googleapis.com/css2?" + families.map((n) => "family=" + encodeURIComponent(n).replace(/%20/g, "+") + ":wght@400;500;600;700").join("&") + "&display=swap" : "";
	};
	var typeColors = () => Object.fromEntries(brand.customerTypes.map((t) => [t.id, {
		light: hex(t.color, tx("color.typeField", { id: t.id })),
		dark: t.colorDark ? hex(t.colorDark, tx("color.typeField", { id: t.id })) : mix(t.color, "#ffffff", .35)
	}]));
	var OWN_ICONS = [
		"person",
		"kamera",
		"film",
		"sandning",
		"pokal",
		"pratbubbla",
		"portfolj",
		"stjarna",
		"kalender",
		"prick"
	];
	var typeIcon = (id) => {
		const d = brand.customerTypes.find((t) => t.id === id);
		if (d?.svg) return {
			kind: "svg",
			svg: d.svg
		};
		if (!d?.icon) return {
			kind: "own",
			name: "prick"
		};
		return OWN_ICONS.includes(d.icon) ? {
			kind: "own",
			name: d.icon
		} : {
			kind: "lucide",
			name: d.icon
		};
	};
	var addCommPatch = (c, m) => {
		const comms = [...c.comms || [], m];
		const p = {
			comms,
			lastContact: lastTouch({
				comms,
				jobs: c.jobs || []
			})
		};
		if (m.kind === "mail_ut" || m.kind === "mail_in") p.lastMail = {
			date: m.date,
			subject: m.subject
		};
		return p;
	};
	var removeCommPatch = (c, id) => {
		const comms = (c.comms || []).filter((m) => m.id !== id);
		return {
			comms,
			lastContact: lastTouch({
				comms,
				jobs: c.jobs || []
			})
		};
	};
	var addJobPatch = (c, j) => {
		const jobs = [...c.jobs || [], j];
		return {
			jobs,
			lastJob: {
				title: j.title,
				date: j.date
			},
			lastContact: lastTouch({
				comms: c.comms || [],
				jobs
			})
		};
	};
	var removeJobPatch = (c, id) => {
		const jobs = (c.jobs || []).filter((j) => j.id !== id);
		return {
			jobs,
			lastContact: lastTouch({
				comms: c.comms || [],
				jobs
			})
		};
	};
	var statusPatch = (status) => ({ status });
	var customerFormPatch = (f) => {
		const v = (x) => (x || "").trim();
		const patch = {
			company: v(f.company),
			name: v(f.name),
			role: v(f.role),
			email: v(f.email),
			phone: v(f.phone),
			website: v(f.website),
			city: v(f.city),
			notes: v(f.notes),
			status: f.status,
			types: [...f.types]
		};
		return {
			patch,
			errors: patch.company || patch.name ? [] : ["companyOrName"]
		};
	};
	var addItemPatch = (c, list, item) => list === "comms" ? addCommPatch(c, item) : list === "jobs" ? addJobPatch(c, item) : list === "bookings" ? addBookingPatch(c, item) : addEventPatch(c, item);
	var replaceItemPatch = (c, list, item) => {
		const items = (c[list] || []).map((x) => x.id === item.id ? item : x);
		if (list !== "comms" && list !== "jobs") return { [list]: items };
		const comms = list === "comms" ? items : c.comms || [], jobs = list === "jobs" ? items : c.jobs || [];
		return {
			[list]: items,
			lastContact: lastTouch({
				comms,
				jobs
			})
		};
	};
	var removeItemPatch = (c, list, id) => list === "comms" ? removeCommPatch(c, id) : list === "jobs" ? removeJobPatch(c, id) : list === "bookings" ? removeBookingPatch(c, id) : { events: (c.events || []).filter((e) => e.id !== id) };
	var newCustomerDefaults = (at) => ({
		jobs: [],
		comms: [],
		lastContact: null,
		createdAt: at,
		updatedAt: at
	});
	var safeUrl = (u) => /^https?:\/\//i.test(u || "") ? u : u && /^[\w.-]+\.[a-z]{2,}/i.test(u) ? "https://" + u : null;
	var hostOf = (u) => {
		try {
			return new URL(u).hostname.replace(/^www\./, "");
		} catch {
			return tx("source");
		}
	};
	var SEGMENTS = [
		"alla",
		"kontakta",
		"bokat",
		"kunder",
		"kontaktade",
		"potentiella"
	];
	var statusOf = (c) => c.status === "kontaktad" || c.status === "potentiell" ? c.status : "kund";
	var inSegment = (c, seg) => seg === "kontakta" ? needsContact(c) || followUpDue(c) : seg === "bokat" ? hasBooking(c) : seg === "kunder" ? statusOf(c) === "kund" : seg === "kontaktade" ? statusOf(c) === "kontaktad" : seg === "potentiella" ? statusOf(c) === "potentiell" : true;
	var inFilters = (c, view) => (!view.status?.length || view.status.includes(statusOf(c))) && (!view.flags?.length || view.flags.some((f) => inSegment(c, f)));
	var segmentCounts = (customers) => Object.fromEntries(SEGMENTS.map((s) => [s, customers.filter((c) => inSegment(c, s)).length]));
	function filterCustomers(customers, view) {
		const q = (view.q || "").trim().toLowerCase();
		const items = customers.filter((c) => {
			if (view.type && view.type !== "alla" && !customerTypes(c).includes(view.type)) return false;
			if (view.seg && !inSegment(c, view.seg)) return false;
			if (!inFilters(c, view)) return false;
			if (q) {
				if (![
					c.company,
					c.name,
					c.email,
					c.phone,
					c.notes
				].join(" ").toLowerCase().includes(q)) return false;
			}
			return true;
		});
		const label = (c) => (c.company || c.name || "").toLowerCase();
		if (view.sort === "namn") items.sort((a, b) => label(a).localeCompare(label(b), "sv"));
		else if (view.sort === "nyast") items.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
		else items.sort((a, b) => contactScore(b) - contactScore(a) || label(a).localeCompare(label(b), "sv"));
		return items;
	}
	function skipKey(c) {
		let key = "";
		try {
			key = new URL(safeUrl(c.website)).hostname.replace(/^www\./, "");
		} catch {}
		return (key || c.company || c.name || c.id || "").toLowerCase().replace(/[^a-z0-9.-]+/g, "-").slice(0, 120) || c.id;
	}
	var signature = (c) => senderFor(c).signature.join("\n");
	function checkMailModule(m) {
		if (!m || typeof m !== "object") return [tx("mail.notObject")];
		const mod = m;
		return ["buildOffer", "buildEventFollowUp"].filter((k) => typeof mod[k] !== "function").map((k) => tx("mail.missingFunction", { name: k }));
	}
	function normalizeMailText(o) {
		if (!o || typeof o !== "object") throw new Error(tx("mail.noAnswer"));
		const r = o;
		for (const f of ["subject", "body"]) if (typeof r[f] !== "string" || !r[f].trim()) throw new Error(tx("mail.noText", { field: f }));
		return {
			subject: String(r.subject),
			body: String(r.body),
			note: typeof r.note === "string" ? r.note : "",
			tags: Array.isArray(r.tags) ? r.tags.map((t) => String(t)) : [],
			hint: typeof r.hint === "string" ? r.hint : ""
		};
	}
	function sentPatch(c, eventId, kind, m) {
		const comms = [...c.comms || [], m];
		const { events } = markEventPatch(c, eventId, kind, m.date);
		return {
			comms,
			events,
			lastContact: lastTouch({
				comms,
				jobs: c.jobs || []
			}),
			lastMail: {
				date: m.date,
				subject: m.subject
			}
		};
	}
	function markEventPatch(c, eventId, kind, date) {
		const field = kind === "eventfu" ? "followUpSentAt" : "offeredAt";
		return { events: (c.events || []).map((x) => x.id === eventId ? {
			...x,
			[field]: date
		} : x) };
	}
	function draftSentPatch(c, id) {
		const d = c.draft || {};
		const m = {
			id,
			kind: "mail_ut",
			date: todayISO(),
			subject: d.subject || "",
			note: d.summary || tx("mail.draftSent"),
			body: d.body || ""
		};
		const comms = [...c.comms || [], m];
		const patch = {
			comms,
			draft: null,
			lastContact: lastTouch({
				comms,
				jobs: c.jobs || []
			}),
			lastMail: {
				date: m.date,
				subject: m.subject
			}
		};
		if (d.eventId) {
			const field = d.kind === "eventfu" ? "followUpSentAt" : "offeredAt";
			patch.events = (c.events || []).map((e) => e.id === d.eventId ? {
				...e,
				[field]: m.date
			} : e);
		}
		return patch;
	}
	function logOnlyEntry(e, kind) {
		const title = String(e.title || "").trim() || tx("mail.theEvent"), when = fmtDate(e.date);
		return kind === "eventfu" ? {
			subject: tx("mail.followUpSubject", { title }),
			note: tx("mail.followUpNote", {
				title,
				when
			})
		} : {
			subject: tx("mail.offerSubject", { title }),
			note: tx("mail.offerNote", {
				title,
				when
			})
		};
	}
	var isObject = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
	var DATE = /^\d{4}-\d{2}-\d{2}/;
	var text = (v, path, issues) => {
		if (typeof v !== "string") issues.push({
			path,
			message: "must be text"
		});
	};
	var bool = (v, path, issues) => {
		if (typeof v !== "boolean") issues.push({
			path,
			message: "must be true or false"
		});
	};
	var num = (v, path, issues) => {
		if (typeof v !== "number" || !Number.isFinite(v)) issues.push({
			path,
			message: "must be a number"
		});
	};
	var date = (v, path, issues) => {
		if (typeof v !== "string" || !DATE.test(v)) issues.push({
			path,
			message: "must be a date YYYY-MM-DD"
		});
	};
	var textOrNumber = (v, path, issues) => {
		if (typeof v !== "string" && (typeof v !== "number" || !Number.isFinite(v))) issues.push({
			path,
			message: "must be text or a number"
		});
	};
	var oneOf = (...allowed) => (v, path, issues) => {
		if (!allowed.includes(v)) issues.push({
			path,
			message: `must be one of: ${allowed.join(", ")}`
		});
	};
	var anyObject = (v, path, issues) => {
		if (!isObject(v)) issues.push({
			path,
			message: "must be an object"
		});
	};
	var object = (fields) => (v, path, issues) => {
		if (!isObject(v)) {
			issues.push({
				path,
				message: "must be an object"
			});
			return;
		}
		for (const [key, value] of Object.entries(v)) {
			if (value === null || value === void 0 || !Object.prototype.hasOwnProperty.call(fields, key)) continue;
			fields[key](value, path ? `${path}.${key}` : key, issues);
		}
	};
	var list = (item) => (v, path, issues) => {
		if (!Array.isArray(v)) {
			issues.push({
				path,
				message: "must be a list"
			});
			return;
		}
		v.forEach((x, i) => item(x, `${path}[${i}]`, issues));
	};
	var COMM = object({
		id: text,
		kind: text,
		date,
		subject: text,
		note: text,
		body: text,
		gmailId: text,
		bookingId: text
	});
	var JOB = object({
		id: text,
		title: text,
		date,
		amount: textOrNumber,
		invoiceUrl: text,
		invoiceNumber: textOrNumber,
		invoiceStatus: text,
		dueDate: date
	});
	var EVENT = object({
		id: text,
		title: text,
		date,
		endDate: date,
		location: text,
		url: text,
		sourceLabel: text,
		why: text,
		source: text,
		foundAt: text,
		dismissed: bool,
		offeredAt: text,
		followUpSentAt: text
	});
	var BOOKING = object({
		id: text,
		kind: text,
		title: text,
		date,
		time: text,
		durationMin: num,
		location: text,
		source: text,
		gcalEventId: text
	});
	var CUSTOMER = object({
		id: text,
		company: text,
		name: text,
		role: text,
		email: text,
		phone: text,
		website: text,
		city: text,
		notes: text,
		ext: anyObject,
		status: oneOf("kund", "kontaktad", "potentiell"),
		types: list(text),
		example: bool,
		createdAt: text,
		updatedAt: text,
		addedAt: date,
		comms: list(COMM),
		jobs: list(JOB),
		events: list(EVENT),
		bookings: list(BOOKING),
		followUp: object({
			date,
			note: text
		}),
		lastContact: date,
		lastMail: object({
			date,
			subject: text
		}),
		lastJob: object({
			title: text,
			date
		}),
		draft: object({
			subject: text,
			body: text,
			summary: text,
			eventId: text,
			kind: text
		}),
		eventsCheckedAt: text,
		source: text,
		why: text,
		contactSource: text,
		emailConfidence: oneOf("publicerad", "gissad")
	});
	/** The issues in a customer document, in the document's field order; an empty list = valid. path "" = the document itself */
	function validateCustomer(doc) {
		const issues = [];
		CUSTOMER(doc, "", issues);
		return issues;
	}
	return {
		LIMIT: 90,
		setClock,
		todayISO,
		daysSince,
		fmtDate,
		dayMonth,
		safeUrl,
		hostOf,
		lastTouch,
		status,
		needsContact,
		latestMail,
		daysLabel,
		upcomingEvents,
		openEvents,
		hasEvent,
		hiddenEvents,
		isNewEvent,
		signature,
		checkMailModule,
		logOnlyEntry,
		normalizeMailText,
		sentPatch,
		addEventPatch,
		dismissEventPatch,
		draftSentPatch,
		filterCustomers,
		skipKey,
		addDays,
		upcomingBookings,
		nextBooking,
		hasBooking,
		contactDeadline,
		calendarItems,
		segmentCounts,
		eventWhen,
		eventOpen,
		addCommPatch,
		removeCommPatch,
		addJobPatch,
		removeJobPatch,
		pastBookings,
		addBookingPatch,
		removeBookingPatch,
		statusPatch,
		customerFormPatch,
		OWN_ICONS,
		typeIcon,
		daysUntil,
		nextEvent,
		eventSoon,
		eventsToFollowUp,
		eventConflicts,
		eventBadge,
		customerTypes,
		followUpDue,
		addMonths,
		statusOf,
		validateCustomer,
		newCustomerDefaults,
		calendarConflicts,
		addItemPatch,
		replaceItemPatch,
		removeItemPatch,
		markEventPatch,
		EXAMPLE_BRAND,
		setBrand,
		getBrand,
		validateBrand,
		senderHint,
		brandFonts,
		googleFontsUrl,
		senderFor,
		typeColors,
		deriveColors,
		contrastRatio,
		get SERVICE_TYPES() {
			return serviceTypes();
		},
		get KINDS() {
			return kinds();
		},
		get BOOKING_KINDS() {
			return bookingKinds();
		},
		get INV_STATUS() {
			return invoiceStatuses();
		}
	};
});
