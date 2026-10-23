/* Fertility signs (local-first L7, decision D6; spec A14.7): cervical mucus, an ovulation (LH) test and basal body
   temperature, optional fields on a day entry (cm, opk, bbt), plus who sees them and every sentence Cyra says about
   them. Pure: no React, no network, no storage, no weekly counts; it imports only ./engine.js and ./constants.js and
   never ./record.js (record.js imports this file to validate the fields).
   What it never does: these fields never enter the day score, insights, predictions, weekly counts (contribute() gets
   { sym, sleepQ, flow }), Cyra's AI (the request body is { question }) or a POTS export. Guidance only: nothing here
   says ovulation happened or was confirmed (FERT_BANNED is unit-tested over every output), a temperature rise is
   worded as an observation, and nothing is ever offered as contraception. */
import { fmt, fmtRange, daysBetween, addDays } from "./engine.js";
import { CERVICAL_MUCUS, OVULATION_TEST, TTC_NAME } from "./constants.js";

export { TTC_NAME };

/* ---------- who sees it ---------- */
/** Trying to conceive is stage "periods" with this exact label (record.js PHASES.ttc). */
export const isTTC = (stage, stageName) => stage === "periods" && stageName === TTC_NAME;
/** The one gate for every fertility element: stage "periods" only; her Settings choice `on` (true / false), or with
    none yet (null) the stage default: on for Trying to conceive, off for My Cycle. Never in pregnancy,
    perimenopause or menopause, whatever `on` or a restored record says. */
export const fertShown = (stage, stageName, on) => stage === "periods" && (typeof on === "boolean" ? on : stageName === TTC_NAME);

/** fertSigns, as stored: { on: true|false|null, unit: "C"|"F"|null }; anything else becomes null. */
export const cleanFertPrefs = (v) => {
  const o = v && typeof v === "object" && !Array.isArray(v) ? v : {};
  return { on: typeof o.on === "boolean" ? o.on : null, unit: o.unit === "C" || o.unit === "F" ? o.unit : null };
};
/** A restore is literal: a backup with fertSigns brings it back; one without resets `on` to the stage default and
    keeps this device's unit. */
export const restoredFertPrefs = (savedPrefs, currentPrefs) => (savedPrefs ? cleanFertPrefs(savedPrefs) : { on: null, unit: cleanFertPrefs(currentPrefs).unit });
/** The starting unit from the device's locale: °F where Fahrenheit is the everyday scale, else °C. */
export const defaultTempUnit = (locale) => (/-(US|LR|MM|BS|KY|PW|FM|MH)\b/i.test(locale || "") ? "F" : "C");

/* ---------- the day-entry fields ---------- */
export const CM_IDS = CERVICAL_MUCUS.map(([id]) => id); // dry, sticky, creamy, watery, eggwhite
export const OPK_IDS = OVULATION_TEST.map(([id]) => id).filter((id) => id !== "none"); // neg, pos
const BBT_MIN = 34, BBT_MAX = 40; // °C, what a stored bbt may hold
const isBbt = (n) => typeof n === "number" && Number.isFinite(n) && n >= BBT_MIN && n <= BBT_MAX;
/** { cm, opk, bbt } from a day entry, each null when missing or not valid (bbt: a °C number from 34 to 40). */
export const cleanFert = (entry) => {
  const e = entry && typeof entry === "object" ? entry : {};
  return { cm: CM_IDS.includes(e.cm) ? e.cm : null, opk: OPK_IDS.includes(e.opk) ? e.opk : null, bbt: isBbt(e.bbt) ? e.bbt : null };
};

/* ---------- temperature ----------
   Stored in °C to 3 decimals: 2 decimals would not survive a °F round trip (a reading typed in °F must come back
   as typed). */
const round3 = (x) => Math.round(x * 1000) / 1000;
const RANGES = { C: [34, 40], F: [93.2, 104] };
const inUnit = (x, u) => x >= RANGES[u][0] && x <= RANGES[u][1];
/** Her typed reading → { ok: true, c: null } (empty), { ok: true, c } (°C, 3 decimals) or { ok: false, why }:
    "format" (not like 36.45), "otherUnit" (a reading in the other unit's range) or "range". A comma reads as a
    decimal point. */
export function parseBbt(text, unit) {
  const t = String(text == null ? "" : text).trim();
  if (!t) return { ok: true, c: null };
  if (!/^\d{2,3}(?:[.,]\d{1,2})?$/.test(t)) return { ok: false, why: "format" };
  const u = unit === "F" ? "F" : "C", other = u === "F" ? "C" : "F";
  const x = Number(t.replace(",", "."));
  if (inUnit(x, u)) return { ok: true, c: round3(u === "F" ? ((x - 32) * 5) / 9 : x) };
  return { ok: false, why: inUnit(x, other) ? "otherUnit" : "range" };
}
/** A stored °C reading as text in `unit` (at most 2 decimals, no trailing zeros): 36.5 → "36.5" / "97.7". */
export const bbtToText = (c, unit) => String(Number((unit === "F" ? (c * 9) / 5 + 32 : c).toFixed(2)));
/** "36.5 °C" / "97.7 °F". */
export const fmtTemp = (c, unit) => `${bbtToText(c, unit)} °${unit === "F" ? "F" : "C"}`;

/* ---------- the check-in form ----------
   The form holds the typed temperature as text in the unit it was typed in (bbtUnit), so switching the unit converts
   it and a half-typed value is never lost. */
export const FERT_FORM_EMPTY = Object.freeze({ cm: null, opk: null, bbtText: "", bbtUnit: null });
/** The form for a saved entry, the temperature shown in `unit`. */
export const fertFormFrom = (entry, unit) => {
  const f = cleanFert(entry);
  return { cm: f.cm, opk: f.opk, bbtText: f.bbt != null ? bbtToText(f.bbt, unit) : "", bbtUnit: unit };
};
const formUnit = (f, unit) => (f && (f.bbtUnit === "C" || f.bbtUnit === "F") ? f.bbtUnit : unit);
/** For comparing forms: [cm, opk, the parsed °C reading, "bad:<text>" for an invalid one, or null]. "36.5" and "36.50"
    compare equal. */
export const fertFormKey = (f, unit) => {
  const g = f || FERT_FORM_EMPTY, p = parseBbt(g.bbtText, formUnit(g, unit));
  return [g.cm || null, g.opk || null, p.ok ? p.c : `bad:${String(g.bbtText).trim()}`];
};
/** Something is set in the fertility group (the live meter's "touched"). */
export const fertTouched = (f) => !!f && (!!f.cm || !!f.opk || !!String(f.bbtText || "").trim());
/** What the save writes on the entry: { ok, fields } with only the keys that are set (cm, opk, bbt in °C to 3
    decimals). ok is false while the typed temperature isn't a reading; the save then stops. */
export function fertEntryFields(f, unit) {
  const g = f || FERT_FORM_EMPTY;
  const p = parseBbt(g.bbtText, formUnit(g, unit));
  if (!p.ok) return { ok: false, fields: {} };
  const fields = {};
  if (CM_IDS.includes(g.cm)) fields.cm = g.cm;
  if (OPK_IDS.includes(g.opk)) fields.opk = g.opk;
  if (p.c != null) fields.bbt = p.c;
  return { ok: true, fields };
}

/* ---------- words ---------- */
export const CM_WORDS = Object.freeze({ dry: "dry (no mucus)", sticky: "sticky mucus", creamy: "creamy mucus", watery: "watery mucus", eggwhite: "egg-white mucus" });
export const OPK_WORDS = Object.freeze({ neg: "negative ovulation test", pos: "positive ovulation test" });

/** Every fixed sentence fertility signs show (FERT_BANNED and contraOk are tested over all of them). */
export const FERT_COPY = Object.freeze({
  readNone: "Today: nothing logged yet.",
  clauseBest: "your most fertile signs",
  clauseSurge: "a surge, which usually comes a day or two before ovulation",
  clauseEggwhite: "the most fertile kind of mucus",
  clauseWatery: "a fertile kind of mucus",
  clauseCreamy: "often seen on the days around the most fertile ones",
  clauseLow: "usually a less fertile day",
  clauseNeg: "no surge in this test",
  winBefore: "Fertile window likely {range}",
  winIn: "In your estimated fertile window, until {date}",
  winSub: "An estimate, not contraception · Calendar →",
  title: "Fertility signs",
  sub: "All optional. Tap a choice again to clear it.",
  bbtHelp: "Taken on waking, before you get up.",
  foot: "A guide to timing, not a confirmation of ovulation — and not contraception.",
  errFormatC: "Type a reading like 36.45.",
  errFormatF: "Type a reading like 97.61.",
  errOtherC: "That looks like a °F reading. Switch the unit?",
  errOtherF: "That looks like a °C reading. Switch the unit?",
  errRange: "That looks unusual. Check the number?",
  saveBlocked: "Check the temperature: it doesn't look like a reading. Fix it or clear it, then save.",
  dischNote: "Mucus changes through your cycle go under Fertility signs above. Use this if something seems unusual.",
  sumHeadCycle: "Fertility signs this cycle",
  sumHead35: "Fertility signs · last 35 days",
  sumFoot: "Mucus and test results point to your most fertile days; on their own they can't show that ovulation happened. Not contraception.",
  noShift: "No sustained temperature rise in these readings yet.",
  sumEmpty: "Nothing logged here yet. Fertility signs are optional and take a few seconds on Today.",
  sumLog: "Log today's signs →",
  shift: "From {date}, your temperature stayed above the six readings before it (highest {temp}) for three days in a row. A rise like this is often seen after ovulation: an observation from your own readings, not a confirmation.",
  settingTitle: "Track fertility signs",
  settingTtc: "Cervical mucus, ovulation tests and basal temperature on Today, marked on your Calendar, with your fertile-window read on Home.",
  settingCycle: "Cervical mucus, ovulation tests and basal temperature on Today, marked on your Calendar.",
  countsLi: "Fertility signs (mucus, ovulation tests and temperature) are never part of weekly counts.",
  todayCountsLi: "Fertility signs are never part of weekly counts.",
  toastOn: "Fertility signs on. Find them on Today and your Calendar",
  toastOff: "Fertility signs hidden. What you logged stays in your record",
});
const fill = (s, vars) => s.replace(/\{(\w+)\}/g, (_, k) => vars[k]);
const nDays = (n) => `${n} day${n === 1 ? "" : "s"}`;

/** The words for what an entry has: ["egg-white mucus", "positive ovulation test", "36.5 °C"]. */
export const fertParts = (entry, unit) => {
  const f = cleanFert(entry);
  return [f.cm && CM_WORDS[f.cm], f.opk && OPK_WORDS[f.opk], f.bbt != null && fmtTemp(f.bbt, unit)].filter(Boolean);
};
/** Today's read in one line: { logged, text }. A temperature alone gets no clause (one reading says nothing). */
export function fertRead(entry, unit) {
  const f = cleanFert(entry), parts = fertParts(entry, unit);
  if (!parts.length) return { logged: false, text: FERT_COPY.readNone };
  const fertileCm = f.cm === "eggwhite" || f.cm === "watery";
  const clause = f.opk === "pos" && fertileCm ? FERT_COPY.clauseBest
    : f.opk === "pos" ? FERT_COPY.clauseSurge
    : f.cm === "eggwhite" ? FERT_COPY.clauseEggwhite
    : f.cm === "watery" ? FERT_COPY.clauseWatery
    : f.cm === "creamy" ? FERT_COPY.clauseCreamy
    : f.cm === "sticky" || f.cm === "dry" ? FERT_COPY.clauseLow
    : f.opk === "neg" ? FERT_COPY.clauseNeg
    : null;
  return { logged: true, text: `Today: ${parts.join(" · ")}${clause ? ` — ${clause}` : ""}.` };
}

/** Home's Coming up head for Trying to conceive (L5's ISO window, inclusive): before the window "Fertile window likely
    Oct 14 – Oct 18", inside it "In your estimated fertile window, until Oct 18", else null (no row: once the window
    has passed, or with no upcoming prediction, her period row says what is next). Its sub is FERT_COPY.winSub. */
export function fertWindow(pred, todayIso) {
  if (!pred || pred.state !== "upcoming" || !pred.fertileFromIso || !pred.fertileToIso || todayIso > pred.fertileToIso) return null;
  return todayIso < pred.fertileFromIso ? fill(FERT_COPY.winBefore, { range: fmtRange(pred.fertileFromIso, pred.fertileToIso) }) : fill(FERT_COPY.winIn, { date: fmt(pred.fertileToIso) });
}

/* ---------- summaries (Patterns, Report, the doctor email) ---------- */
const monthOf = (iso) => iso.slice(0, 7);
const fmtRun = (a, b) => (a === b ? fmt(a) : monthOf(a) === monthOf(b) ? `${fmt(a)}–${fmt(b).replace(/^\D+/, "")}` : `${fmt(a)}–${fmt(b)}`);
/** Days as runs: ["2026-10-12", "2026-10-13", "2026-10-14", "2026-10-16"] → "Oct 12–14, Oct 16"; past 4 runs
    "… and {k} more". */
export function fmtDays(isos) {
  const ds = [...new Set((isos || []).filter((x) => typeof x === "string"))].sort();
  const runs = [];
  for (const d of ds) {
    const last = runs[runs.length - 1];
    if (last && daysBetween(last[1], d) === 1) last[1] = d; else runs.push([d, d]);
  }
  const shown = runs.slice(0, 4).map(([a, b]) => fmtRun(a, b));
  return runs.length > 4 ? `${shown.join(", ")} and ${runs.length - 4} more` : shown.join(", ");
}
/** The Patterns window: from her last period start when it is 45 days ago or less (anchored), else the last 35 days. */
export function cycleWindow(starts, todayIso) {
  const last = Array.isArray(starts) && starts.length ? starts[starts.length - 1] : null;
  if (last && last <= todayIso && daysBetween(last, todayIso) <= 45) return { from: last, to: todayIso, anchored: true };
  return { from: addDays(todayIso, -34), to: todayIso, anchored: false };
}
const inWindow = (days, { from, to }) => (Array.isArray(days) ? days : []).filter((d) => d && typeof d.date === "string" && d.date >= from && d.date <= to);

/** The 3-over-6 rule, as an observation: in date order, the first reading i (with 6 readings before it, all within the
    10 calendar days before it) where readings i, i+1 and i+2 fall on 3 consecutive days, all three above the highest
    of those six (the cover), and the third at least 0.2 °C above it. Compared in whole thousandths of a degree.
    { rise, cover, through } or null. */
export function bbtShift(days, win) {
  const rs = inWindow(days, win).map((d) => ({ date: d.date, t: cleanFert(d).bbt })).filter((r) => r.t != null)
    .sort((a, b) => a.date.localeCompare(b.date)).map((r) => ({ date: r.date, k: Math.round(r.t * 1000) }));
  for (let i = 6; i + 2 < rs.length; i++) {
    const six = rs.slice(i - 6, i);
    if (daysBetween(six[0].date, rs[i].date) > 10) continue;
    if (daysBetween(rs[i].date, rs[i + 1].date) !== 1 || daysBetween(rs[i + 1].date, rs[i + 2].date) !== 1) continue;
    const cover = Math.max(...six.map((r) => r.k));
    if (rs[i].k > cover && rs[i + 1].k > cover && rs[i + 2].k > cover && rs[i + 2].k >= cover + 200) return { rise: rs[i].date, cover: cover / 1000, through: rs[i + 2].date };
  }
  return null;
}
export const bbtShiftSentence = (shift, unit) => fill(FERT_COPY.shift, { date: fmt(shift.rise), temp: fmtTemp(shift.cover, unit) });

/** What a window holds: { logged (days with any sign), cm: { eggwhite: [iso], watery: [iso] }, opk: { pos: [iso], neg },
    bbt: { n, shift } }. Bounds inclusive. */
export function fertSummary(days, win) {
  const out = { logged: 0, cm: { eggwhite: [], watery: [] }, opk: { pos: [], neg: 0 }, bbt: { n: 0, shift: null } };
  for (const d of inWindow(days, win)) {
    const f = cleanFert(d);
    if (!f.cm && !f.opk && f.bbt == null) continue;
    out.logged++;
    if (f.cm === "eggwhite" || f.cm === "watery") out.cm[f.cm].push(d.date);
    if (f.opk === "pos") out.opk.pos.push(d.date); else if (f.opk === "neg") out.opk.neg++;
    if (f.bbt != null) out.bbt.n++;
  }
  for (const k of ["eggwhite", "watery"]) out.cm[k].sort();
  out.opk.pos.sort();
  out.bbt.shift = bbtShift(days, win);
  return out;
}
/** Patterns' list: [{ icon, text }]. */
export function fertSummaryLines(sum) {
  const out = [];
  if (sum.cm.eggwhite.length) out.push({ icon: "drop", text: `Egg-white mucus on ${nDays(sum.cm.eggwhite.length)}: ${fmtDays(sum.cm.eggwhite)}` });
  if (sum.cm.watery.length) out.push({ icon: "drop", text: `Watery mucus on ${nDays(sum.cm.watery.length)}: ${fmtDays(sum.cm.watery)}` });
  if (sum.opk.pos.length) out.push({ icon: "teststrip", text: `Positive ovulation test on ${nDays(sum.opk.pos.length)}: ${fmtDays(sum.opk.pos)}` });
  else if (sum.opk.neg) out.push({ icon: "teststrip", text: `Ovulation tests: ${sum.opk.neg} negative, no positive yet` });
  if (sum.bbt.n) out.push({ icon: "thermometer", text: `Temperature logged on ${nDays(sum.bbt.n)}` });
  // Only drier mucus types logged: still say something, so the list is never empty.
  if (!out.length && sum.logged) out.push({ icon: "drop", text: `Fertility signs logged on ${nDays(sum.logged)}` });
  return out;
}
const countParts = (sum) => [
  sum.cm.eggwhite.length && `egg-white mucus on ${nDays(sum.cm.eggwhite.length)}`,
  sum.opk.pos.length && `positive ovulation test on ${nDays(sum.opk.pos.length)}`,
  sum.bbt.n && `temperature on ${nDays(sum.bbt.n)}`,
].filter(Boolean);
const andWords = (a) => (a.length < 2 ? a.join("") : `${a.slice(0, -1).join(", ")} and ${a[a.length - 1]}`);
/** The Report finding's sentence (30-day window), plus the shift sentence when there is one. */
export function fertReportSentence(sum, unit) {
  const parts = countParts(sum);
  const head = parts.length ? andWords(parts) : `fertility signs on ${nDays(sum.logged)}`;
  const s = `${head.charAt(0).toUpperCase()}${head.slice(1)} in the last 30 days.`;
  return sum.bbt.shift ? `${s} ${bbtShiftSentence(sum.bbt.shift, unit)}` : s;
}
/** The doctor email's line, or null when nothing was logged in the 30 days. */
export function fertEmailLine(sum) {
  if (!sum || !sum.logged) return null;
  const parts = countParts(sum);
  const shift = sum.bbt.shift ? ` My temperature stayed higher from ${fmt(sum.bbt.shift.rise)} (three days above the six readings before).` : "";
  return `• Fertility signs in these 30 days: ${parts.length ? parts.join(", ") : `logged on ${nDays(sum.logged)}`}.${shift}`;
}

/* ---------- copy safety ---------- */
/** Words fertility signs must never say: a confirmation of ovulation, a guarantee, "safe days", birth control. */
export const FERT_BANNED = /\bovulation (?:is |was |has been )?confirmed\b|\bconfirm(?:s|ed|ing)?\b[^.]{0,40}\bovulat|\byou(?:'ve| have)? ovulated\b|\byou(?:'re| are) ovulating\b|\bguarantee|\bsafe (?:day|days|time)\b|\bbirth control\b|\bcan(?:'t|not) get pregnant\b|\bwon't get pregnant\b/i;
/** Contraception is mentioned only as "not contraception". */
export const contraOk = (t) => !/contracept/i.test(String(t).replace(/\bnot contraception\b/gi, ""));
