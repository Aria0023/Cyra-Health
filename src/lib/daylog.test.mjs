/* Unit tests for lib/daylog.js (L6: her symptom list per stage and the day note), plus the library, scoring,
   insights, weekly-counts and Ask pieces L6 touches. Run with `npm run test:unit`. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  STAGE_LIB, borrowable, cleanSymPrefs, prefsFor, trackedIds, chipLayout, moveSym, hideSym, showSym, addSym,
  loggedEver, canRemove, removeSym, resetSyms, NOTE_MAX, cleanNote,
} from "./daylog.js";
import { SYM, SYMS, PSYM, GSYM, ALL_SYM, SCORE_SCALE, OTHER_LIST, ENERGY_ID, SYM_FAMILY, QUICK_MAP, famColor } from "./constants.js";
import { dayScore, symBurden, insights, localDay } from "./engine.js";
import { INSIGHT_STARTERS } from "./askStarters.js";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(SRC, p), "utf8");
const deepFreeze = (o) => { if (o && typeof o === "object") { Object.values(o).forEach(deepFreeze); Object.freeze(o); } return o; };
const iso = (n) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - n); return localDay(d); };
const PRE_L6_SYM = ["hf", "ns", "fog", "mood", "slp", "ach", "dry", "pal", "hda", "lib", "anx", "itc"];
const PRE_L6_PSYM = ["crm", "hda", "blo", "mood", "ten", "acn", "bak", "nau", "cra", "lib"];
const PERIODS_BORROW = ["hf", "ns", "fog", "slp", "ach", "dry", "pal", "anx", "itc"];
const PERI_BORROW = ["crm", "blo", "ten", "acn", "bak", "nau", "cra"];
/* lib/pulse.js imports lib/api.js, which reads Vite's import.meta.env, so the pieces under test are lifted from the
   real source text (as pots.test.mjs does). */
function lift(src, start) {
  const i = src.indexOf(start);
  assert.ok(i >= 0, `${start} not found in pulse.js`);
  const j = start.startsWith("export function") ? src.indexOf(") {", i) + 2 : src.indexOf("{", i);
  let depth = 0, k = j;
  for (; k < src.length; k++) { if (src[k] === "{") depth++; else if (src[k] === "}" && --depth === 0) break; }
  return src.slice(i, k + 1).replace(/^export /, "");
}
const pulseSrc = read("lib/pulse.js");
const { PULSE_EVENTS, FLAG_WORDS, eventsForDay } = await import("data:text/javascript," + encodeURIComponent(`${lift(pulseSrc, "export const PULSE_EVENTS = {")};\n${lift(pulseSrc, "export const FLAG_WORDS = {")};\n${lift(pulseSrc, "export function eventsForDay(")}\nexport { PULSE_EVENTS, FLAG_WORDS, eventsForDay };`));

/* ---------- libraries and families ---------- */

test("Low energy is the last key of both check-in libraries, in the Sleep family", () => {
  assert.equal(ENERGY_ID, "eng");
  assert.equal(SYM.eng, "Low energy");
  assert.equal(PSYM.eng, "Low energy");
  assert.equal(Object.keys(SYM).slice(-1)[0], "eng");
  assert.equal(Object.keys(PSYM).slice(-1)[0], "eng");
  assert.deepEqual(Object.keys(SYM), [...PRE_L6_SYM, "eng"]);
  assert.deepEqual(Object.keys(PSYM), [...PRE_L6_PSYM, "eng"]);
  assert.deepEqual(SYMS, Object.keys(SYM));
  assert.equal(SYM_FAMILY.eng, "sleep");
  assert.ok(famColor("eng"), "famColor('eng') is defined");
  for (const id of [...Object.keys(SYM), ...Object.keys(PSYM)]) assert.equal(ALL_SYM[id], SYM[id] || PSYM[id], id);
  assert.equal(Object.keys(GSYM).length, 8, "pregnancy library unchanged");
  assert.ok(!("eng" in GSYM));
  // QUICK_MAP is unchanged and still points at library keys.
  assert.deepEqual(QUICK_MAP, { periods: { q1: "crm", q2: "hda", q3: "mood" }, peri: { q1: "hf", q2: "slp", q3: "fog" } });
  for (const id of Object.values(QUICK_MAP.periods)) assert.ok(id in PSYM);
  for (const id of Object.values(QUICK_MAP.peri)) assert.ok(id in SYM);
  // Low energy is never a weekly-counts flag.
  for (const list of Object.values(PULSE_EVENTS)) assert.ok(!list.some(([id]) => id === "eng"));
  assert.ok(!("eng" in FLAG_WORDS));
  assert.deepEqual(OTHER_LIST, { periods: "perimenopause list", peri: "cycle list" });
});

test("borrowable: the other library's ids this one lacks, never its own", () => {
  assert.deepEqual(borrowable("periods"), PERIODS_BORROW);
  assert.deepEqual(borrowable("peri"), PERI_BORROW);
  for (const id of borrowable("periods")) assert.ok(!(id in PSYM), id);
  for (const id of borrowable("peri")) assert.ok(!(id in SYM), id);
  assert.deepEqual(borrowable("preg"), []);
  assert.deepEqual(borrowable("x"), []);
  assert.deepEqual(borrowable(undefined), []);
  assert.equal(STAGE_LIB.periods, PSYM); assert.equal(STAGE_LIB.peri, SYM); assert.equal(STAGE_LIB.preg, GSYM);
});

/* ---------- cleanSymPrefs ---------- */

test("cleanSymPrefs: {} for anything but a plain object; keeps the stage keys, clean lists, input order", () => {
  for (const x of [null, undefined, [], "x", 42, true]) assert.deepEqual(cleanSymPrefs(x), {});
  const out = cleanSymPrefs({
    peri: { order: ["eng", "eng", 7, "Hot flashes", "hf", "constructor", "x".repeat(17), "zz_new"], hidden: ["itc", null], added: ["crm"], extra: 1 },
    periods: { order: [], hidden: [], added: [] },
    other: { order: ["eng"], hidden: [], added: [] },
    preg: { order: "nope", hidden: ["brx"] },
  });
  assert.deepEqual(Object.keys(out), ["peri", "preg"], "an empty stage and unknown keys are dropped, order kept");
  assert.deepEqual(out.peri, { order: ["eng", "hf", "constructor", "zz_new"], hidden: ["itc"], added: ["crm"] });
  assert.deepEqual(out.preg, { order: [], hidden: ["brx"], added: [] });
  const many = Array.from({ length: 60 }, (_, i) => `s${i}`);
  assert.equal(cleanSymPrefs({ peri: { order: many, hidden: many, added: many } }).peri.order.length, 40);
  // A clean record comes back byte-identical (RULES.symPrefs relies on it).
  const clean = { periods: { order: ["eng", "crm"], hidden: ["acn"], added: ["hf"] }, peri: { order: [], hidden: ["itc"], added: [] } };
  assert.equal(JSON.stringify(cleanSymPrefs(clean)), JSON.stringify(clean));
  // Unknown but well-formed ids are kept and ignored by every reader.
  const fut = cleanSymPrefs({ peri: { order: ["zz", "eng"], hidden: ["zz2"], added: ["zz3", "crm"] } });
  assert.deepEqual(fut.peri.added, ["zz3", "crm"]);
  assert.deepEqual(trackedIds("peri", fut), [...Object.keys(SYM), "crm"]);
  const lay = chipLayout("peri", fut);
  assert.equal(lay.first[0], "eng");
  assert.ok(!lay.first.includes("zz") && !lay.more.includes("zz2"));
});

test("prefsFor: defaults to three empty lists", () => {
  assert.deepEqual(prefsFor({}, "peri"), { order: [], hidden: [], added: [] });
  assert.deepEqual(prefsFor(null, "periods"), { order: [], hidden: [], added: [] });
  assert.deepEqual(prefsFor({ peri: { order: ["eng"] } }, "peri"), { order: ["eng"], hidden: [], added: [] });
});

/* ---------- layout ---------- */

test("chipLayout: Heard Health's order by default; tracked = library + added borrowable ids", () => {
  const p = chipLayout("periods", {});
  assert.deepEqual(p.first, Object.keys(PSYM));
  assert.equal(p.first.slice(-1)[0], "eng");
  assert.deepEqual(p.more, []);
  const q = chipLayout("peri", {});
  assert.deepEqual(q.first, Object.keys(SYM));
  assert.equal(q.first[0], "hf"); assert.equal(q.first.slice(-1)[0], "eng");
  assert.deepEqual(chipLayout("preg", {}).first, Object.keys(GSYM));
  assert.deepEqual(trackedIds("preg", {}), Object.keys(GSYM));
  assert.deepEqual(trackedIds("x", {}), []);
  const prefs = { periods: { order: [], hidden: ["acn"], added: ["hf", "crm", "zz", "ns"] } };
  assert.deepEqual(trackedIds("periods", prefs), [...Object.keys(PSYM), "hf", "ns"], "native and unknown added ids are ignored");
  assert.ok(trackedIds("periods", prefs).includes("acn"), "hidden ids stay tracked");
  assert.deepEqual(chipLayout("periods", prefs).more, ["acn"]);
  assert.ok(!chipLayout("periods", prefs).first.includes("acn"));
  // preg: nothing can be added
  assert.deepEqual(trackedIds("preg", { preg: { order: [], hidden: [], added: ["hf"] } }), Object.keys(GSYM));
});

/* ---------- editors ---------- */

test("moveSym swaps neighbours and stores the whole first list; no change at the ends", () => {
  const p0 = deepFreeze({ peri: { order: [], hidden: ["itc"], added: [] } });
  const p1 = moveSym(p0, "periods", "eng", -1);
  assert.deepEqual(p1.periods.order, [...PRE_L6_PSYM.slice(0, -1), "eng", "lib"]);
  assert.equal(p1.peri, p0.peri, "the other stage is the same object");
  assert.equal(moveSym(p0, "periods", "crm", -1), p0, "first row can't move up");
  assert.equal(moveSym(p0, "periods", "eng", 1), p0, "last row can't move down");
  assert.equal(moveSym(p0, "periods", "hf", 1), p0, "not shown");
  assert.equal(moveSym(p0, "peri", "itc", 1), p0, "hidden ids don't move");
  assert.equal(moveSym(p0, "periods", "hda", 2), p0, "only ±1");
  let p = {};
  for (let i = 0; i < 10; i++) p = moveSym(p, "periods", "eng", -1);
  assert.equal(chipLayout("periods", p).first[0], "eng");
  assert.equal(p.periods.order[0], "eng");
  // Moving back to Heard Health's order stores no order: undoing every change leaves {}.
  assert.deepEqual(moveSym(moveSym({}, "peri", "eng", -1), "peri", "eng", 1), {});
});

test("hideSym / showSym: hidden moves to more (tracked order); show appends to first", () => {
  const p0 = deepFreeze({});
  const h = hideSym(p0, "periods", "acn");
  assert.deepEqual(h.periods.hidden, ["acn"]);
  assert.deepEqual(chipLayout("periods", h).more, ["acn"]);
  const h2 = hideSym(h, "periods", "crm");
  assert.deepEqual(chipLayout("periods", h2).more, ["crm", "acn"], "more is in tracked order");
  assert.equal(hideSym(h, "periods", "acn"), h, "already hidden");
  assert.equal(hideSym(h, "periods", "hf"), h, "not tracked");
  const s = showSym(h2, "periods", "acn");
  assert.equal(chipLayout("periods", s).first.slice(-1)[0], "acn");
  assert.deepEqual(s.periods.hidden, ["crm"]);
  assert.equal(showSym(h2, "periods", "eng"), h2, "not hidden");
  // refuses to hide the last one shown
  let only = {};
  for (const id of Object.keys(GSYM).slice(1)) only = hideSym(only, "preg", id);
  assert.deepEqual(chipLayout("preg", only).first, ["nau"]);
  assert.equal(hideSym(only, "preg", "nau"), only);
});

test("addSym: only borrowable ids not added yet; appended to added and the end of first; idempotent", () => {
  const p0 = deepFreeze({ peri: { order: ["eng"], hidden: [], added: [] } });
  const a = addSym(p0, "periods", "hf");
  assert.deepEqual(a.periods.added, ["hf"]);
  assert.deepEqual(chipLayout("periods", a).first, [...Object.keys(PSYM), "hf"]);
  assert.equal(a.peri, p0.peri);
  assert.equal(addSym(a, "periods", "hf"), a, "idempotent");
  assert.equal(addSym(p0, "periods", "crm"), p0, "native id");
  assert.equal(addSym(p0, "periods", "zz"), p0, "unknown id");
  assert.equal(addSym(p0, "preg", "hf"), p0, "nothing borrows into pregnancy");
  const b = addSym(a, "periods", "ns");
  assert.deepEqual(chipLayout("periods", b).first.slice(-2), ["hf", "ns"]);
  // with a custom order, the added one still lands last
  const c = addSym(moveSym({}, "peri", "eng", -1), "peri", "crm");
  assert.equal(chipLayout("peri", c).first.slice(-1)[0], "crm");
});

test("canRemove / removeSym: only an added symptom never logged; resetSyms keeps what she added", () => {
  const p0 = deepFreeze(hideSym(addSym({}, "periods", "hf"), "periods", "hf"));
  const none = deepFreeze([{ date: iso(1), sym: { crm: 2, hf: 0 } }]);
  const logged = deepFreeze([{ date: iso(1), sym: { crm: 2 } }, { date: iso(3), sym: { hf: 1 } }]);
  assert.equal(loggedEver(none, "hf"), false);
  assert.equal(loggedEver(logged, "hf"), true);
  assert.equal(loggedEver(null, "hf"), false);
  assert.equal(canRemove(p0, "periods", "hf", none), true);
  const r = removeSym(p0, "periods", "hf", none);
  assert.deepEqual(r, {}, "nothing left, the stage key goes");
  assert.equal(canRemove(p0, "periods", "hf", logged), false);
  assert.equal(removeSym(p0, "periods", "hf", logged), p0, "once logged, the same object");
  assert.equal(canRemove(p0, "periods", "crm", none), false, "native ids are never removable");
  assert.equal(removeSym(p0, "periods", "crm", none), p0);
  // reset
  const mixed = deepFreeze(hideSym(moveSym(addSym({}, "periods", "hf"), "periods", "eng", -1), "periods", "acn"));
  const z = resetSyms(mixed, "periods");
  assert.deepEqual(z.periods, { order: [], hidden: [], added: ["hf"] });
  assert.deepEqual(chipLayout("periods", z).first, [...Object.keys(PSYM), "hf"]);
  assert.deepEqual(resetSyms(moveSym({}, "peri", "eng", -1), "peri"), {}, "drops the stage key when nothing is left");
  assert.equal(resetSyms(z, "periods"), z, "nothing to reset");
});

/* ---------- the day note ---------- */

test("cleanNote: text only, LF line ends, at most 280 units, never half an emoji, trimmed", () => {
  assert.equal(NOTE_MAX, 280);
  for (const x of [undefined, null, 42, {}, [], true]) assert.equal(cleanNote(x), "");
  assert.equal(cleanNote("  hello \n"), "hello");
  assert.equal(cleanNote("a\r\nb\rc"), "a\nb\nc");
  assert.equal(cleanNote("x".repeat(280)), "x".repeat(280));
  assert.equal(cleanNote("y".repeat(300)), "y".repeat(280));
  const e = cleanNote("a".repeat(279) + "😀");
  assert.equal(e, "a".repeat(279));
  assert.ok(!/[\uD800-\uDBFF]$/.test(e));
  assert.equal(cleanNote("   "), "");
  assert.equal(cleanNote("a".repeat(278) + "😀"), "a".repeat(278) + "😀");
});

/* ---------- scoring ---------- */

test("SCORE_SCALE: a past day's score never moves with Low energy or her list", () => {
  assert.deepEqual({ ...SCORE_SCALE }, { peri: 12, periods: 10, preg: 8 });
  const e = { sym: { hf: 2, ns: 1, fog: 3, slp: 2, itc: 1 }, scales: { fatigue: 4, pain: 2, moodq: 6 } };
  const before = dayScore(e, PRE_L6_SYM);
  assert.equal(dayScore(e, trackedIds("peri", {}), SCORE_SCALE.peri), before);
  const withCrm = trackedIds("peri", { peri: { order: [], hidden: [], added: ["crm"] } });
  assert.equal(dayScore(e, withCrm, SCORE_SCALE.peri), before, "a borrowed id doesn't move a day without it");
  assert.ok(dayScore({ ...e, sym: { ...e.sym, crm: 2 } }, withCrm, SCORE_SCALE.peri) < before, "a day that logged it scores lower");
  const c = { sym: { crm: 3, blo: 1, mood: 2 }, scales: {} };
  assert.equal(dayScore(c, trackedIds("periods", {}), SCORE_SCALE.periods), dayScore(c, PRE_L6_PSYM));
  assert.equal(dayScore(c, trackedIds("periods", { periods: { order: [], hidden: ["crm"], added: ["hf", "ns"] } }), SCORE_SCALE.periods), dayScore(c, PRE_L6_PSYM), "hiding or adding never rescales");
  const g = { sym: { nau: 2, swl: 1 }, kicks: 3 };
  assert.equal(dayScore(g, trackedIds("preg", {}), SCORE_SCALE.preg), dayScore(g, Object.keys(GSYM)));
  // 2-arg backward compatibility
  assert.equal(symBurden({ hf: 3, ns: 3 }, ["hf", "ns"]), Math.min(1, 6 / (2 * 1.6)));
  assert.equal(symBurden({ hf: 1 }, ["hf", "ns", "fog", "mood"]), 1 / (4 * 1.6));
  assert.equal(symBurden({ hf: 1 }, ["hf", "ns", "fog", "mood"], 12), 1 / (12 * 1.6));
  assert.equal(symBurden({ hf: 1 }, [], 12), 0);
  assert.equal(dayScore(null, PRE_L6_SYM, 12), null);
});

test("insights() counts added and hidden symptoms", () => {
  const ids = trackedIds("periods", { periods: { order: [], hidden: ["acn"], added: ["hf"] } });
  const days = [0, 1, 2, 3].map((n) => ({ date: iso(n), sleepQ: "fair", sym: { hf: n < 3 ? 2 : 0, acn: n < 3 ? 1 : 0, crm: 1 } }));
  const ins = insights(days, ids);
  const c = (id) => ins.counts.find((x) => x.id === id);
  assert.equal(c("hf").days, 3); assert.equal(c("hf").strong, 3); assert.equal(c("hf").label, "Hot flashes");
  assert.equal(c("acn").days, 3); assert.equal(c("acn").label, "Skin breakouts");
  assert.equal(c("eng").label, "Low energy");
});

/* ---------- privacy: weekly counts and the note ---------- */

test("weekly counts: Low energy, a borrowed symptom and the note are never flags", () => {
  assert.deepEqual(eventsForDay("periods", { sym: { hf: 3, ns: 2, eng: 3 }, note: "x" }), []);
  assert.deepEqual(eventsForDay("peri", { sym: { crm: 3, eng: 2, blo: 1 } }), []);
  const entries = {
    periods: { sym: { crm: 2, mood: 1, eng: 3 }, sleepQ: "poor", flow: "heavy", phase: "luteal", late: 0 },
    peri: { sym: { hf: 1, ns: 2, eng: 1 }, sleepQ: "poor" },
    preg: { sym: { nau: 2, swl: 1 }, kicks: 4 },
  };
  for (const [stage, e] of Object.entries(entries)) assert.deepEqual(eventsForDay(stage, { ...e, note: "secret" }), eventsForDay(stage, e), stage);
  // No contribute( call in Today or Pregnancy Today names the note.
  for (const f of ["screens/TodayScreen.jsx", "screens/PregTodayScreen.jsx"]) {
    const src = read(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
    const calls = [...src.matchAll(/\bcontribute\(\{[^;]*;/g)].map((m) => m[0]);
    assert.ok(calls.length >= 1, `${f} calls contribute(`);
    for (const c of calls) assert.ok(!/note|dayNote/i.test(c), `${f}: contribute(${c}`);
  }
});

test("askStarters: Low energy hands Ask a question the library answers", () => {
  assert.equal(INSIGHT_STARTERS[ENERGY_ID], "Why am I so tired?");
  assert.equal(INSIGHT_STARTERS.eng, "Why am I so tired?");
});

test("daylog.js is pure and imports only constants.js", () => {
  const src = read("lib/daylog.js").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
  const imports = [...src.matchAll(/^\s*import\b[^;]*?\bfrom\s*["']([^"']+)["']/gm)].map((m) => m[1]);
  assert.deepEqual(imports, ["./constants.js"]);
  for (const w of ["fetch", "XMLHttpRequest", "sendBeacon", "indexedDB", "localStorage", "record.js", "structuredClone", ".at(", "findLast", "Object.hasOwn("]) assert.ok(!src.includes(w), `daylog.js mentions ${w}`);
});
