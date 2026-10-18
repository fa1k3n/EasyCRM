/* Built by tools/build.js from the TypeScript modules next to this file (crmBundle in tsconfig.json). Never edit by hand. */
(function(global, factory) {
	typeof exports === "object" && typeof module !== "undefined" ? module.exports = factory() : typeof define === "function" && define.amd ? define([], factory) : (global = typeof globalThis !== "undefined" ? globalThis : global || self, global.CRMLogic = factory());
})(this, function() {
	var MONTHS = [
		"januari",
		"februari",
		"mars",
		"april",
		"maj",
		"juni",
		"juli",
		"augusti",
		"september",
		"oktober",
		"november",
		"december"
	];
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
		return `${+d} ${MONTHS[+m - 1]}`;
	};
	var addDays = (iso, n) => {
		const d = /* @__PURE__ */ new Date(iso + "T12:00:00");
		d.setDate(d.getDate() + n);
		return toISO(d);
	};
	var KINDS = {
		mail_ut: "Mail skickat",
		mail_in: "Mail mottaget",
		samtal: "Samtal",
		mote: "Möte",
		ovrigt: "Övrigt"
	};
	var INV_STATUS = {
		published: "Skickad",
		paid: "Betald",
		overPaid: "Överbetald",
		underPaid: "Delbetald",
		overdue: "Förfallen",
		credited: "Krediterad",
		credit: "Kreditnota"
	};
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
			level: days >= 90 ? "over" : days >= 60 ? "warn" : "ok",
			days,
			d
		};
	}
	var needsContact = (c) => {
		const l = status(c).level;
		return l === "over" || l === "never";
	};
	function latestMail(c) {
		let best = null;
		for (const m of c.comms || []) if ((m.kind === "mail_ut" || m.kind === "mail_in") && (!best || m.date > best.date)) best = m;
		return best;
	}
	function daysLabel(st) {
		if (st.level === "never") return "Ej kontaktad";
		if (st.days === 0) return "Idag";
		return st.days + " d sedan";
	}
	var contactScore = (c) => {
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
			const who = c.company || c.name || "Namnlös";
			for (const b of c.bookings || []) {
				if (!b.date || b.date < from || b.date > to) continue;
				if (b.gcalEventId && b.source === "gcal") seenGcal.add(b.gcalEventId);
				out.push({
					date: b.date,
					time: b.time || "",
					title: `${BOOKING_KINDS[b.kind] || "Möte"}: ${who}${b.title ? " – " + b.title : ""}`,
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
				title: x.title || "Upptagen",
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
	var BOOKING_KINDS = {
		jobb: "Jobb",
		mote: "Möte",
		samtal: "Samtal"
	};
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
			const who = c.company || c.name || "Namnlös";
			for (const b of c.bookings || []) {
				if (!b.date || b.date < from || b.source === "gcal") continue;
				items.push({
					key: `booking:${c.id}:${b.id}`,
					kind: "booking",
					customerId: c.id,
					title: `${BOOKING_KINDS[b.kind] || "Möte"}: ${who}${b.title ? " – " + b.title : ""}`,
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
				title: `Följ upp: ${who}`,
				date: c.followUp.date,
				allDay: true,
				note: c.followUp.note || ""
			});
			const deadline = contactDeadline(c);
			if (c.status !== "potentiell" && deadline && deadline >= today && !hasBooking(c)) items.push({
				key: `deadline:${c.id}`,
				kind: "deadline",
				customerId: c.id,
				title: `90 dagar utan kontakt: ${who}`,
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
					title: `Följ upp event: ${who} – ${e.title}`,
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
					title: `Förfaller: faktura #${j.invoiceNumber} ${who}${j.amount ? ` (${j.amount} kr)` : ""}`,
					date: j.dueDate,
					allDay: true
				});
			}
		}
		return items.sort((a, b) => a.date.localeCompare(b.date) || a.key.localeCompare(b.key));
	}
	function rgb(c, field) {
		const m = /^#([0-9a-f]{6})$/i.exec(String(c || "").trim());
		if (!m) throw new Error(`Ogiltig färg i ${field}: "${c}" (ange #rrggbb)`);
		const n = parseInt(m[1], 16);
		return [
			n >> 16 & 255,
			n >> 8 & 255,
			n & 255
		];
	}
	var hex = (c, field) => "#" + rgb(c, field).map((v) => v.toString(16).padStart(2, "0")).join("");
	var mix = (a, b, t) => {
		const x = rgb(a, "färg"), y = rgb(b, "färg");
		return "#" + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, "0")).join("");
	};
	var luminance = (c) => {
		const [r, g, b] = rgb(c, "färg").map((v) => {
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
	function deriveColors(colors) {
		const accent = hex(colors.accent, "colors.accent"), ink = hex(colors.ink, "colors.ink"), bg = hex(colors.bg, "colors.bg");
		const hover = colors.accentHover ? hex(colors.accentHover, "colors.accentHover") : mix(accent, "#000000", .16);
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
			for (const k of Object.keys(o)) target[k] = k === "shadow" ? o[k] : hex(o[k], `colors.overrides.${mode}.${k}`);
		}
		const warnings = [];
		const checks = [
			[
				"huvudtexten (ink)",
				"ink",
				"bg"
			],
			[
				"brödtexten (text)",
				"text",
				"bg"
			],
			[
				"den dämpade texten (muted)",
				"muted",
				"bg"
			],
			[
				"texten på accentfärgen (accent-ink)",
				"accent-ink",
				"accent"
			]
		];
		for (const [name, p] of [["ljust läge", light], ["mörkt läge", dark]]) for (const [label, fg, back] of checks) {
			const c = contrastRatio(p[fg], p[back]);
			if (c < MIN_TEXT) warnings.push(`${name}: ${label} har för låg kontrast mot ${back === "bg" ? "bakgrunden" : "accentfärgen"} (${c.toFixed(1)}:1, minst ${MIN_TEXT}:1)`);
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
	function unsafeSvg(svg) {
		if (/javascript:|url\s*\(|&#|\\/i.test(svg)) return "får inte innehålla url(), javascript: eller teckenkoder";
		const withoutTags = svg.replace(/<[^>]*>/g, "");
		if (/[<>]/.test(withoutTags) || withoutTags.trim()) return "får bara innehålla SVG-element, ingen text";
		for (const m of svg.matchAll(/<\s*\/?\s*([^\s/>]+)([^>]*)>/g)) {
			const el = m[1].toLowerCase();
			if (!SVG_ELEMENTS.includes(el)) return `elementet <${m[1]}> är inte tillåtet (tillåtna: ${SVG_ELEMENTS.join(", ")})`;
			for (const a of m[2].matchAll(/([^\s=/"']+)\s*(=\s*("[^"]*"|'[^']*'|[^\s/>]+))?/g)) if (!SVG_ATTRS.includes(a[1].toLowerCase())) return `attributet ${a[1]} är inte tillåtet`;
		}
		return "";
	}
	function validateBrand(b) {
		const e = [], x = b || {};
		if (!x.company || !x.company.name) e.push("company.name saknas (företagets namn)");
		if (!x.colors) e.push("colors saknas");
		else try {
			deriveColors(x.colors);
		} catch (err) {
			e.push(err.message);
		}
		if (x.logo && !/^[\w.-]+\.(png|svg|jpe?g|webp)$/i.test(x.logo) && !/^https:\/\/[^\s"'<>]+$/i.test(x.logo)) e.push(`logo måste vara ett filnamn (t.ex. logo.png) eller en https-adress: "${x.logo}"`);
		if (x.language !== void 0 && (typeof x.language !== "string" || !/^[a-z]{2}$/.test(x.language))) e.push(`language måste vara en språkkod med två små bokstäver, t.ex. "sv": "${String(x.language)}"`);
		if (!Array.isArray(x.senders) || !x.senders.length) e.push("senders saknas (minst en avsändare)");
		else x.senders.forEach((s, i) => {
			if (!s.id) e.push(`senders[${i}].id saknas`);
			if (!Array.isArray(s.signature)) e.push(`senders[${i}].signature saknas (lista med rader)`);
		});
		if (!x.defaultSender) e.push("defaultSender saknas");
		else if (Array.isArray(x.senders) && !x.senders.some((s) => s.id === x.defaultSender)) e.push(`defaultSender "${x.defaultSender}" finns inte bland senders`);
		if (!Array.isArray(x.customerTypes)) e.push("customerTypes saknas (lista, får vara tom)");
		else {
			const seen = /* @__PURE__ */ new Set();
			x.customerTypes.forEach((t, i) => {
				if (!/^[a-z0-9_-]+$/.test(t.id || "")) e.push(`customerTypes[${i}].id "${t.id}" får bara innehålla a–z, 0–9, - och _`);
				else if (seen.has(t.id)) e.push(`customerTypes: id "${t.id}" är inte unikt`);
				seen.add(t.id);
				if (!t.label) e.push(`customerTypes[${i}].label saknas`);
				try {
					hex(t.color, `customerTypes[${i}].color`);
					if (t.colorDark) hex(t.colorDark, `customerTypes[${i}].colorDark`);
				} catch (err) {
					e.push(err.message);
				}
				if (t.icon !== void 0 && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(t.icon)) e.push(`customerTypes[${i}].icon "${t.icon}" ska vara ett ikonnamn med a–z, 0–9 och bindestreck, t.ex. kamera eller calendar-days`);
				const svgErr = t.svg ? unsafeSvg(t.svg) : "";
				if (svgErr) e.push(`customerTypes[${i}].svg: ${svgErr}`);
			});
		}
		return e;
	}
	var setBrand = (b) => {
		if (!b) {
			brand = EXAMPLE_BRAND;
			return;
		}
		const errors = validateBrand(b);
		if (errors.length) throw new Error("Varumärket är felaktigt: " + errors.join("; "));
		brand = b;
	};
	var getBrand = () => brand;
	var serviceTypes = () => Object.fromEntries(brand.customerTypes.map((t) => [t.id, t.label]));
	function customerTypes(c) {
		const src = Array.isArray(c.types) ? c.types : (brand.legacyTypes || {})[c.type] || [];
		return brand.customerTypes.map((t) => t.id).filter((id) => src.includes(id));
	}
	function legacyType(c) {
		if (!brand.legacyWrite) return void 0;
		const t = customerTypes(c);
		for (const r of brand.legacyWrite) if (r.ifAny.includes("*") ? t.length > 0 : r.ifAny.some((x) => t.includes(x))) return r.type;
		return brand.legacyDefault;
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
		return s && s.id !== brand.defaultSender ? `${t.label} ger avsändaren ${s.company || s.name || s.id} i mailsignaturen.` : "";
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
		light: hex(t.color, `kundtyp ${t.id}`),
		dark: t.colorDark ? hex(t.colorDark, `kundtyp ${t.id}`) : mix(t.color, "#ffffff", .35)
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
		const legacy = legacyType({ types: f.types });
		if (legacy) patch.type = legacy;
		return {
			patch,
			errors: patch.company || patch.name ? [] : ["companyOrName"]
		};
	};
	var esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({
		"&": "&amp;",
		"<": "&lt;",
		">": "&gt;",
		"\"": "&quot;",
		"'": "&#39;"
	})[c]);
	var safeUrl = (u) => /^https?:\/\//i.test(u || "") ? u : u && /^[\w.-]+\.[a-z]{2,}/i.test(u) ? "https://" + u : null;
	var hostOf = (u) => {
		try {
			return new URL(u).hostname.replace(/^www\./, "");
		} catch {
			return "Källa";
		}
	};
	var SEGMENTS = [
		"alla",
		"kontakta",
		"bokat",
		"kunder",
		"potentiella"
	];
	var inSegment = (c, seg) => seg === "kontakta" ? needsContact(c) : seg === "bokat" ? hasBooking(c) : seg === "kunder" ? c.status !== "potentiell" : seg === "potentiella" ? c.status === "potentiell" : true;
	var segmentCounts = (customers) => Object.fromEntries(SEGMENTS.map((s) => [s, customers.filter((c) => inSegment(c, s)).length]));
	function filterCustomers(customers, view) {
		const q = (view.q || "").trim().toLowerCase();
		const items = customers.filter((c) => {
			if (view.type && view.type !== "alla") {
				if (serviceTypes()[view.type] ? !customerTypes(c).includes(view.type) : c.type !== view.type) return false;
			}
			if (view.seg && !inSegment(c, view.seg)) return false;
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
		if (!m || typeof m !== "object") return ["mailtillägget saknas eller är inte ett objekt"];
		const mod = m;
		return ["buildOffer", "buildEventFollowUp"].filter((k) => typeof mod[k] !== "function").map((k) => `mailtillägget saknar funktionen ${k}`);
	}
	function normalizeMailText(o) {
		if (!o || typeof o !== "object") throw new Error("mailtillägget gav inget svar");
		const r = o;
		for (const f of ["subject", "body"]) if (typeof r[f] !== "string" || !r[f].trim()) throw new Error(`mailtillägget gav ingen text i ${f}`);
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
		const field = kind === "eventfu" ? "followUpSentAt" : "offeredAt";
		return {
			comms,
			events: (c.events || []).map((x) => x.id === eventId ? {
				...x,
				[field]: m.date
			} : x),
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
	function draftSentPatch(c, id) {
		const d = c.draft || {};
		const m = {
			id,
			kind: "mail_ut",
			date: todayISO(),
			subject: d.subject || "",
			note: d.summary || "Mail skickat från utkast",
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
		const title = String(e.title || "").trim() || "eventet", when = fmtDate(e.date);
		return kind === "eventfu" ? {
			subject: `Uppföljning efter ${title}`,
			note: `Uppföljning efter ${title} (${when}) loggad som skickad.`
		} : {
			subject: `Erbjudande inför ${title}`,
			note: `Erbjudande inför ${title} (${when}) loggat som skickat.`
		};
	}
	return {
		KINDS,
		LIMIT: 90,
		WARN: 60,
		INV_STATUS,
		MONTHS,
		setClock,
		todayISO,
		daysSince,
		fmtDate,
		dayMonth,
		esc,
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
		contactScore,
		filterCustomers,
		skipKey,
		BOOKING_KINDS,
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
		legacyType,
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
		}
	};
});
