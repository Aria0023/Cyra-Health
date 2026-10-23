/* Unit tests for lib/fertility.js (local-first L7, decision D6: fertility signs). Run with `npm run test:unit`. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  TTC_NAME, isTTC, fertShown, cleanFertPrefs, restoredFertPrefs, defaultTempUnit, CM_IDS, OPK_IDS, cleanFert, parseBbt, bbtToText, fmtTemp,
  FERT_FORM_EMPTY, fertFormFrom, fertFormKey, fertTouched, fertEntryFields, CM_WORDS, OPK_WORDS, fertParts, fertRead, fertWindow, fmtDays,
  cycleWindow, fertSummary, bbtShift, bbtShiftSentence, fertSummaryLines, fertReportSentence, fertEmailLine, FERT_COPY, FERT_BANNED, contraOk,
} from "./fertility.js";
import { fertPrivacyLine } from "./disclosures.js";
import { parseFeatures } from "./features.js";
import { PHASES, phaseOf } from "./record.js";
import { CERVICAL_MUCUS, OVULATION_TEST } from "./constants.js";
import { addDays, fmtRange } from "./engine.js";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(SRC, p), "utf8");
/* lib/pulse.js imports lib/api.js (Vite's import.meta.env), so eventsForDay and FLAG_WORDS are lifted from its source
   text, as daylog.test.mjs does. */
function lift(src, start) {
  const i = src.indexOf(start);
  assert.ok(i >= 0, `${start} not found in pulse.js`);
  const j = start.startsWith("export function") ? src.indexOf(") {", i) + 2 : src.indexOf("{", i);
  let depth = 0, k = j;
  for (; k < src.length; k++) { if (src[k] === "{") depth++; else if (src[k] === "}" && --depth === 0) break; }
  return src.slice(i, k + 1).replace(/^export /, "");
}
const pulseSrc = read("lib/pulse.js");
const { FLAG_WORDS, eventsForDay } = await import("data:text/javascript," + encodeURIComponent(`${lift(pulseSrc, "export const FLAG_WORDS = {")};\n${lift(pulseSrc, "export function eventsForDay(")}\nexport { FLAG_WORDS, eventsForDay };`));
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");

/* ---------- gating ---------- */
test("fertShown / isTTC: on by default for Trying to conceive, opt-in for My Cycle, never in other stages", () => {
  assert.equal(fertShown("periods", "Trying to Conceive", null), true);
  assert.equal(fertShown("periods", "My Cycle", null), false);
  assert.equal(fertShown("periods", "My Cycle", true), true);
  assert.equal(fertShown("periods", "Trying to Conceive", false), false);
  for (const [s, n] of [["peri", "Menopause"], ["peri", "Perimenopause"], ["preg", "Pregnancy"]]) {
    for (const on of [true, false, null]) assert.equal(fertShown(s, n, on), false, `${n} ${on}`);
    assert.equal(isTTC(s, n), false);
  }
  assert.equal(fertShown(null, "", true), false);
  assert.equal(isTTC("periods", "Trying to Conceive"), true);
  assert.equal(isTTC("periods", "My Cycle"), false);
  assert.equal(TTC_NAME, PHASES.ttc.stageName);
  for (const { stage, stageName } of Object.values(PHASES)) assert.equal(isTTC(stage, stageName), phaseOf(stage, stageName) === "ttc", stageName);
});

test("cleanFertPrefs / restoredFertPrefs / defaultTempUnit", () => {
  assert.deepEqual(cleanFertPrefs(undefined), { on: null, unit: null });
  assert.deepEqual(cleanFertPrefs({ on: "yes", unit: "K" }), { on: null, unit: null });
  assert.deepEqual(cleanFertPrefs([]), { on: null, unit: null });
  assert.deepEqual(cleanFertPrefs({ on: false, unit: "F" }), { on: false, unit: "F" });
  assert.deepEqual(cleanFertPrefs({ on: true, unit: "C", x: 1 }), { on: true, unit: "C" });
  assert.deepEqual(restoredFertPrefs(undefined, { on: true, unit: "F" }), { on: null, unit: "F" });
  assert.deepEqual(restoredFertPrefs({ on: false, unit: "C" }, { on: true, unit: "F" }), { on: false, unit: "C" });
  assert.equal(defaultTempUnit("en-US"), "F");
  assert.equal(defaultTempUnit("en-GB"), "C");
  assert.equal(defaultTempUnit("de-DE"), "C");
  assert.equal(defaultTempUnit(""), "C");
  assert.equal(defaultTempUnit(undefined), "C");
});

test("option lists: mucus and test ids match the constants", () => {
  assert.deepEqual(CM_IDS, ["dry", "sticky", "creamy", "watery", "eggwhite"]);
  assert.deepEqual(OPK_IDS, ["neg", "pos"]);
  assert.deepEqual(CERVICAL_MUCUS.map(([, l]) => l), ["Dry", "Sticky", "Creamy", "Watery", "Egg-white"]);
  assert.deepEqual(OVULATION_TEST.map(([, l]) => l), ["Not tested", "Negative", "Positive"]);
  for (const id of CM_IDS) assert.ok(CM_WORDS[id]);
  for (const id of OPK_IDS) assert.ok(OPK_WORDS[id]);
});

/* ---------- temperature ---------- */
test("parseBbt: formats, units and ranges", () => {
  assert.deepEqual(parseBbt("36.45", "C"), { ok: true, c: 36.45 });
  assert.deepEqual(parseBbt("36,45", "C"), { ok: true, c: 36.45 });
  assert.deepEqual(parseBbt(" 36.45 ", "C"), { ok: true, c: 36.45 });
  assert.deepEqual(parseBbt("97.7", "F"), { ok: true, c: 36.5 });
  assert.deepEqual(parseBbt("", "C"), { ok: true, c: null });
  assert.deepEqual(parseBbt("   ", "F"), { ok: true, c: null });
  assert.deepEqual(parseBbt("abc", "C"), { ok: false, why: "format" });
  assert.deepEqual(parseBbt("36.455", "C"), { ok: false, why: "format" });
  assert.deepEqual(parseBbt("3", "C"), { ok: false, why: "format" });
  assert.deepEqual(parseBbt("98.6", "C"), { ok: false, why: "otherUnit" });
  assert.deepEqual(parseBbt("36.5", "F"), { ok: false, why: "otherUnit" });
  assert.deepEqual(parseBbt("45", "C"), { ok: false, why: "range" });
  assert.deepEqual(parseBbt("120", "F"), { ok: false, why: "range" });
  assert.deepEqual(parseBbt("98.6", "F"), { ok: true, c: 37 });
});

test("bbtToText round trip: every °F reading 93.00–104.00 and every °C reading 34.00–40.00 comes back as typed", () => {
  // Stored to 3 decimals, a °F reading always comes back exactly (2 decimals would change hundreds of them).
  for (let h = 9300; h <= 10400; h++) {
    const typed = (h / 100).toFixed(2);
    const c = Math.round((((h / 100) - 32) * 5) / 9 * 1000) / 1000;
    assert.equal(bbtToText(c, "F"), String(Number(typed)), typed);
    const p = parseBbt(typed, "F");
    if (h >= 9320) { assert.equal(p.ok, true, typed); assert.equal(p.c, c, typed); assert.equal(bbtToText(p.c, "F"), String(Number(typed))); }
  }
  for (let h = 3400; h <= 4000; h++) {
    const typed = (h / 100).toFixed(2);
    const p = parseBbt(typed, "C");
    assert.equal(p.ok, true, typed);
    assert.equal(p.c, Number(typed), typed);
    assert.equal(bbtToText(p.c, "C"), String(Number(typed)));
  }
  assert.equal(fmtTemp(36.5, "C"), "36.5 °C");
  assert.equal(fmtTemp(36.5, "F"), "97.7 °F");
});

/* ---------- form helpers ---------- */
test("form helpers: round trip, empty form, keys, touched, cleanFert", () => {
  assert.deepEqual(fertEntryFields(FERT_FORM_EMPTY, "C"), { ok: true, fields: {} });
  const entry = { date: "2026-10-12", cm: "eggwhite", opk: "pos", bbt: 36.5 };
  for (const u of ["C", "F"]) {
    const f = fertFormFrom(entry, u);
    assert.deepEqual(f, { cm: "eggwhite", opk: "pos", bbtText: u === "C" ? "36.5" : "97.7", bbtUnit: u });
    assert.deepEqual(fertEntryFields(f, u), { ok: true, fields: { cm: "eggwhite", opk: "pos", bbt: 36.5 } });
    // The form remembers the unit it was typed in, whatever unit is now current.
    assert.deepEqual(fertEntryFields(f, u === "C" ? "F" : "C"), { ok: true, fields: { cm: "eggwhite", opk: "pos", bbt: 36.5 } });
  }
  assert.deepEqual(fertFormFrom({}, "C"), { cm: null, opk: null, bbtText: "", bbtUnit: "C" });
  assert.deepEqual(fertEntryFields({ ...FERT_FORM_EMPTY, bbtText: "98.6", bbtUnit: "C" }, "C"), { ok: false, fields: {} });
  assert.deepEqual(fertEntryFields({ ...FERT_FORM_EMPTY, opk: "none" }, "C"), { ok: true, fields: {} });
  assert.deepEqual(fertFormKey({ ...FERT_FORM_EMPTY, bbtText: "36.5", bbtUnit: "C" }, "C"), fertFormKey({ ...FERT_FORM_EMPTY, bbtText: "36.50", bbtUnit: "C" }, "C"));
  assert.deepEqual(fertFormKey({ ...FERT_FORM_EMPTY, bbtText: "97.7", bbtUnit: "F" }, "C"), fertFormKey({ ...FERT_FORM_EMPTY, bbtText: "36.5", bbtUnit: "C" }, "F"));
  assert.deepEqual(fertFormKey({ ...FERT_FORM_EMPTY, bbtText: " x ", bbtUnit: "C" }, "C"), [null, null, "bad:x"]);
  assert.deepEqual(fertFormKey(FERT_FORM_EMPTY, "C"), [null, null, null]);
  assert.equal(fertTouched(FERT_FORM_EMPTY), false);
  assert.equal(fertTouched({ ...FERT_FORM_EMPTY, bbtText: "  " }), false);
  assert.equal(fertTouched({ ...FERT_FORM_EMPTY, cm: "dry" }), true);
  assert.equal(fertTouched({ ...FERT_FORM_EMPTY, opk: "neg" }), true);
  assert.equal(fertTouched({ ...FERT_FORM_EMPTY, bbtText: "36" }), true);
  assert.deepEqual(cleanFert({ cm: "foo", opk: "maybe", bbt: "hot" }), { cm: null, opk: null, bbt: null });
  assert.deepEqual(cleanFert({ bbt: 60 }), { cm: null, opk: null, bbt: null });
  assert.deepEqual(cleanFert({ bbt: NaN }), { cm: null, opk: null, bbt: null });
  assert.deepEqual(cleanFert(null), { cm: null, opk: null, bbt: null });
  assert.deepEqual(cleanFert(entry), { cm: "eggwhite", opk: "pos", bbt: 36.5 });
});

/* ---------- wording ---------- */
test("fertRead: exact strings", () => {
  assert.deepEqual(fertRead({}, "C"), { logged: false, text: "Today: nothing logged yet." });
  assert.equal(fertRead({ cm: "eggwhite", opk: "pos", bbt: 36.5 }, "C").text, "Today: egg-white mucus · positive ovulation test · 36.5 °C — your most fertile signs.");
  assert.equal(fertRead({ cm: "eggwhite", opk: "pos", bbt: 36.5 }, "F").text, "Today: egg-white mucus · positive ovulation test · 97.7 °F — your most fertile signs.");
  assert.equal(fertRead({ opk: "pos" }, "C").text, "Today: positive ovulation test — a surge, which usually comes a day or two before ovulation.");
  assert.equal(fertRead({ cm: "sticky" }, "C").text, "Today: sticky mucus — usually a less fertile day.");
  assert.equal(fertRead({ opk: "neg" }, "C").text, "Today: negative ovulation test — no surge in this test.");
  assert.equal(fertRead({ bbt: 36.5 }, "F").text, "Today: 97.7 °F.");
  assert.equal(fertRead({ cm: "watery", opk: "pos" }, "C").text, "Today: watery mucus · positive ovulation test — your most fertile signs.");
  assert.equal(fertRead({ cm: "eggwhite" }, "C").text, "Today: egg-white mucus — the most fertile kind of mucus.");
  assert.equal(fertRead({ cm: "watery", opk: "neg" }, "C").text, "Today: watery mucus · negative ovulation test — a fertile kind of mucus.");
  assert.equal(fertRead({ cm: "creamy" }, "C").text, "Today: creamy mucus — often seen on the days around the most fertile ones.");
  assert.equal(fertRead({ cm: "dry" }, "C").text, "Today: dry (no mucus) — usually a less fertile day.");
  assert.deepEqual(fertParts({ cm: "eggwhite", opk: "pos", bbt: 36.5 }, "F"), ["egg-white mucus", "positive ovulation test", "97.7 °F"]);
});

const PRED = { state: "upcoming", fertileFromIso: "2026-10-14", fertileToIso: "2026-10-18" };
test("fertWindow: the Coming up head, or null", () => {
  assert.equal(fertWindow(null, "2026-10-10"), null);
  assert.equal(fertWindow(PRED, "2026-10-10"), `Fertile window likely ${fmtRange("2026-10-14", "2026-10-18")}`);
  assert.equal(fertWindow(PRED, "2026-10-10"), "Fertile window likely Oct 14 – Oct 18");
  assert.equal(fertWindow(PRED, "2026-10-14"), "In your estimated fertile window, until Oct 18");
  assert.equal(fertWindow(PRED, "2026-10-18"), "In your estimated fertile window, until Oct 18");
  assert.equal(fertWindow(PRED, "2026-10-19"), null);
  assert.equal(fertWindow({ ...PRED, state: "window" }, "2026-10-10"), null);
  assert.equal(fertWindow({ ...PRED, state: "later" }, "2026-10-10"), null);
  assert.equal(FERT_COPY.winSub, "An estimate, not contraception · Calendar →");
});

/* ---------- temperature shift ---------- */
const FIX = [36.3, 36.35, 36.2, 36.3, 36.4, 36.25, 36.3, 36.35, 36.3, 36.4, 36.35, 36.3, 36.45, 36.7, 36.75, 36.8, 36.75];
const fixDays = (vals = FIX, start = "2026-09-28") => vals.map((v, i) => ({ date: addDays(start, i), sym: {}, ...(v == null ? {} : { bbt: v }) }));
const WIN = { from: "2026-09-01", to: "2026-10-31" };
test("bbtShift: the 3-over-6 rule", () => {
  assert.deepEqual(bbtShift(fixDays(), WIN), { rise: "2026-10-10", cover: 36.4, through: "2026-10-12" });
  // Without the 2026-10-11 reading the three after 10-10 aren't consecutive days: through 10-12 there is no shift.
  const gap = fixDays().filter((d) => d.date !== "2026-10-11");
  assert.equal(bbtShift(gap.filter((d) => d.date <= "2026-10-12"), WIN), null);
  // With the later readings, the first run that qualifies starts on 10-12 instead (never 10-10).
  assert.equal(bbtShift(gap, WIN).rise, "2026-10-12");
  // Fewer than 6 earlier readings.
  assert.equal(bbtShift(fixDays([36.3, 36.35, 36.2, 36.3, 36.4, 36.7, 36.75, 36.8]), WIN), null);
  // The third reading below cover + 0.2.
  const low = [...FIX]; low[14] = 36.55;
  assert.equal(bbtShift(fixDays(low.slice(0, 15)), WIN), null);
  // Exactly cover + 0.2 counts (whole thousandths, so 36.6 − 36.4 isn't 0.1999…).
  const eq = [...FIX]; eq[14] = 36.6;
  assert.deepEqual(bbtShift(fixDays(eq.slice(0, 15)), WIN), { rise: "2026-10-10", cover: 36.4, through: "2026-10-12" });
  // Earlier readings more than 10 days before the rise don't count as "the six before".
  const spread = fixDays().map((d, i) => (i < 6 ? { ...d, date: addDays("2026-09-01", i * 3) } : d)).filter((d, i) => i < 6 || i >= 12);
  assert.equal(bbtShift(spread, WIN), null);
  // The window bounds.
  assert.equal(bbtShift(fixDays(), { from: "2026-10-07", to: "2026-10-31" }), null);
  assert.equal(bbtShift(fixDays(), { from: "2026-09-01", to: "2026-10-11" }), null);
  const s = bbtShiftSentence({ rise: "2026-10-10", cover: 36.4, through: "2026-10-12" }, "C");
  assert.ok(s.includes("an observation from your own readings, not a confirmation"));
  assert.equal(s, "From Oct 10, your temperature stayed above the six readings before it (highest 36.4 °C) for three days in a row. A rise like this is often seen after ovulation: an observation from your own readings, not a confirmation.");
  assert.ok(bbtShiftSentence({ rise: "2026-10-10", cover: 36.4 }, "F").includes("(highest 97.52 °F)"));
});

/* ---------- summaries ---------- */
test("fmtDays, cycleWindow, fertSummary, lines, report sentence and email line", () => {
  assert.equal(fmtDays(["2026-10-12", "2026-10-13", "2026-10-14", "2026-10-16", "2026-10-31", "2026-11-01", "2026-11-02"]), "Oct 12–14, Oct 16, Oct 31–Nov 2");
  assert.equal(fmtDays(["2026-10-01", "2026-10-03", "2026-10-05", "2026-10-07", "2026-10-09", "2026-10-11"]), "Oct 1, Oct 3, Oct 5, Oct 7 and 2 more");
  assert.equal(fmtDays([]), "");
  assert.equal(fmtDays(["2026-10-13", "2026-10-12"]), "Oct 12–13");
  assert.deepEqual(cycleWindow(["2026-08-01", "2026-09-10"], "2026-10-25"), { from: "2026-09-10", to: "2026-10-25", anchored: true });
  assert.deepEqual(cycleWindow(["2026-09-09"], "2026-10-24"), { from: "2026-09-09", to: "2026-10-24", anchored: true }); // 45 days
  assert.deepEqual(cycleWindow(["2026-09-08"], "2026-10-24"), { from: "2026-09-20", to: "2026-10-24", anchored: false }); // 46 days
  assert.deepEqual(cycleWindow([], "2026-10-24"), { from: "2026-09-20", to: "2026-10-24", anchored: false });

  const days = [
    { date: "2026-10-01", sym: {}, cm: "eggwhite", opk: "pos", bbt: 36.5 },
    { date: "2026-10-02", sym: {}, cm: "eggwhite", opk: "neg" },
    { date: "2026-10-03", sym: {}, cm: "watery" },
    { date: "2026-10-04", sym: {}, cm: "creamy", bbt: 36.6 },
    { date: "2026-10-05", sym: {} },
    { date: "2026-10-06", sym: {}, cm: "bogus", bbt: 99 },
    { date: "2026-10-31", sym: {}, cm: "eggwhite" },
  ];
  const sum = fertSummary(days, { from: "2026-10-01", to: "2026-10-30" });
  assert.deepEqual(sum, { logged: 4, cm: { eggwhite: ["2026-10-01", "2026-10-02"], watery: ["2026-10-03"] }, opk: { pos: ["2026-10-01"], neg: 1 }, bbt: { n: 2, shift: null } });
  // Inclusive bounds.
  assert.equal(fertSummary(days, { from: "2026-10-01", to: "2026-10-31" }).cm.eggwhite.length, 3);
  assert.equal(fertSummary(days, { from: "2026-10-02", to: "2026-10-02" }).logged, 1);
  assert.deepEqual(fertSummaryLines(sum), [
    { icon: "drop", text: "Egg-white mucus on 2 days: Oct 1–2" },
    { icon: "drop", text: "Watery mucus on 1 day: Oct 3" },
    { icon: "teststrip", text: "Positive ovulation test on 1 day: Oct 1" },
    { icon: "thermometer", text: "Temperature logged on 2 days" },
  ]);
  const negOnly = fertSummary([{ date: "2026-10-02", sym: {}, opk: "neg" }, { date: "2026-10-03", sym: {}, opk: "neg" }], { from: "2026-10-01", to: "2026-10-30" });
  assert.deepEqual(fertSummaryLines(negOnly), [{ icon: "teststrip", text: "Ovulation tests: 2 negative, no positive yet" }]);
  const dryOnly = fertSummary([{ date: "2026-10-02", sym: {}, cm: "dry" }], { from: "2026-10-01", to: "2026-10-30" });
  assert.deepEqual(fertSummaryLines(dryOnly), [{ icon: "drop", text: "Fertility signs logged on 1 day" }]);
  assert.equal(fertReportSentence(sum, "C"), "Egg-white mucus on 2 days, positive ovulation test on 1 day and temperature on 2 days in the last 30 days.");
  assert.equal(fertEmailLine(sum), "• Fertility signs in these 30 days: egg-white mucus on 2 days, positive ovulation test on 1 day, temperature on 2 days.");
  const one = fertSummary([{ date: "2026-10-02", sym: {}, cm: "eggwhite", opk: "pos", bbt: 36.5 }], { from: "2026-10-01", to: "2026-10-30" });
  assert.equal(fertEmailLine(one), "• Fertility signs in these 30 days: egg-white mucus on 1 day, positive ovulation test on 1 day, temperature on 1 day.");
  assert.equal(fertEmailLine(fertSummary([], { from: "2026-10-01", to: "2026-10-30" })), null);
  assert.equal(fertEmailLine(fertSummary(days, { from: "2026-10-05", to: "2026-10-05" })), null);
  assert.equal(fertReportSentence(dryOnly, "C"), "Fertility signs on 1 day in the last 30 days.");
  const shifted = fertSummary(fixDays(), WIN);
  assert.deepEqual(shifted.bbt.shift, { rise: "2026-10-10", cover: 36.4, through: "2026-10-12" });
  assert.equal(fertEmailLine(shifted), "• Fertility signs in these 30 days: temperature on 17 days. My temperature stayed higher from Oct 10 (three days above the six readings before).");
  assert.ok(fertReportSentence(shifted, "F").endsWith("not a confirmation."));
});

/* ---------- copy safety ---------- */
test("copy safety: nothing claims ovulation happened, nothing offers contraception", () => {
  for (const bad of ["Ovulation confirmed", "this confirms you ovulated", "safe days", "birth control", "You've ovulated", "you are ovulating", "guaranteed", "you can't get pregnant"]) assert.ok(FERT_BANNED.test(bad), bad);
  assert.equal(contraOk("An estimate, not contraception."), true);
  assert.equal(contraOk("Use as contraception."), false);
  const texts = [...Object.values(FERT_COPY)];
  const grid = [{}, { cm: "eggwhite" }, { cm: "watery", opk: "pos" }, { opk: "pos" }, { opk: "neg" }, { cm: "creamy", bbt: 36.6 }, { cm: "sticky" }, { cm: "dry", opk: "neg", bbt: 36.2 }, { bbt: 37.1 }];
  for (const e of grid) for (const u of ["C", "F"]) texts.push(fertRead(e, u).text, ...fertParts(e, u));
  for (const t of ["2026-10-01", "2026-10-14", "2026-10-16", "2026-10-18", "2026-10-30"]) for (const st of ["upcoming", "window", "later"]) texts.push(fertWindow({ ...PRED, state: st }, t));
  const sums = [fertSummary(fixDays(), WIN), fertSummary([{ date: "2026-10-02", sym: {}, opk: "neg" }], WIN), fertSummary([{ date: "2026-10-02", sym: {}, cm: "eggwhite", opk: "pos", bbt: 36.5 }], WIN), fertSummary([{ date: "2026-10-02", sym: {}, cm: "dry" }], WIN)];
  for (const s of sums) for (const u of ["C", "F"]) {
    texts.push(...fertSummaryLines(s).map((l) => l.text), fertReportSentence(s, u), fertEmailLine(s));
    if (s.bbt.shift) texts.push(bbtShiftSentence(s.bbt.shift, u));
  }
  for (const counts of [true, false]) for (const ai of [true, false]) texts.push(fertPrivacyLine({ ...parseFeatures("none"), counts, ai }));
  const all = texts.filter((t) => t != null);
  assert.ok(all.length > 80);
  for (const t of all) { assert.ok(!FERT_BANNED.test(t), t); assert.ok(contraOk(t), t); }
});

/* ---------- never sent ---------- */
test("never sent: weekly counts take nothing from the fertility fields", () => {
  assert.deepEqual(eventsForDay("periods", { sym: {}, sleepQ: "fair", flow: null, cm: "eggwhite", opk: "pos", bbt: 36.7 }), []);
  for (const k of Object.keys(FLAG_WORDS)) assert.ok(!/mucus|ovulat|temperat|bbt|opk|cm/i.test(`${k} ${FLAG_WORDS[k]}`), k);
});

test("source grep: no network, storage or contribute path reads the fertility fields", () => {
  const files = ["lib/fertility.js", ...readdirSync(join(SRC, "components")).filter((f) => /^Fertility.*\.jsx$/.test(f)).map((f) => `components/${f}`)];
  assert.ok(files.length >= 2, files.join());
  for (const f of files) {
    const code = stripComments(read(f));
    for (const w of ["fetch(", "apiPost", "apiFetch", "contribute(", "localStorage", "sessionStorage", "indexedDB"]) assert.ok(!code.includes(w), `${f} mentions ${w}`);
  }
  const app = read("App.jsx");
  assert.equal(app.split('apiPost("/api/ai/ask", { question })').length - 1, 1, "the AI request body is { question }");
  const today = stripComments(read("screens/TodayScreen.jsx"));
  const calls = [...today.matchAll(/contribute\(([^;]*?)\);/g)].map((m) => m[1]);
  assert.equal(calls.length, 1, "one contribute( call");
  for (const w of ["cm", "opk", "bbt", "fert"]) assert.ok(!new RegExp(`\\b${w}\\b`).test(calls[0]), `contribute( gets ${w}`);
  for (const f of ["lib/potsReport.js", "lib/potsPatterns.js"]) assert.ok(!/\.(cm|opk|bbt)\b/.test(stripComments(read(f))), `${f} reads a fertility field`);
});
