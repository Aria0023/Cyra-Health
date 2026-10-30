/* Unit tests for lib/engine.js helpers used by Home. Run with `npm run test:unit`. */
import test from "node:test";
import assert from "node:assert/strict";
import { trimesterOf, foldQuick, insights, predict, relDay, fmt, scoreRgb, scoreColorOf, inkOn } from "./engine.js";
import { QUICK_Q, QUICK_MAP, SYM, PSYM, RAMPS, RAMPS_DARK, PALETTES, rampOf } from "./constants.js";

test("trimesterOf: week 9 is the first trimester, 22 the second, 34 the third", () => {
  assert.equal(trimesterOf(9), "first");
  assert.equal(trimesterOf(12), "first");
  assert.equal(trimesterOf(13), "second");
  assert.equal(trimesterOf(22), "second");
  assert.equal(trimesterOf(27), "second");
  assert.equal(trimesterOf(28), "third");
  assert.equal(trimesterOf(34), "third");
});

test("QUICK_Q (UI T1): three {q, a} questions per stage, four answers each, values 0-3 fold onto hero symptoms", () => {
  for (const stage of ["periods", "peri", "preg"]) {
    assert.equal(QUICK_Q[stage].length, 3);
    for (const { q, a } of QUICK_Q[stage]) { assert.ok(q.endsWith("?")); assert.equal(a.length, 4); assert.equal(new Set(a).size, 4); }
  }
  assert.deepEqual(QUICK_Q.peri[1].a, ["Slept well", "So-so", "Rough night", "Barely slept"]);
  assert.deepEqual(QUICK_Q.peri[2].a, ["Sharp", "A bit foggy", "Foggy", "Can't think"]);
  assert.deepEqual(QUICK_Q.periods[2].a, ["Steady", "A bit off", "Low", "Really low"]);
  assert.equal(QUICK_Q.peri[0].a[2], "Yes"); // the native suite clicks "Yes" on the first peri question
  // the fold is unchanged: "Rough night" (index 2) on q2 lands on slp as 2, listed under __q
  assert.deepEqual(foldQuick({ q1: 3, q2: 2 }, "peri"), { hf: 3, slp: 2, __q: { hf: 3, slp: 2 } });
  for (const [stage, syms] of [["peri", SYM], ["periods", PSYM]]) for (const sid of Object.values(QUICK_MAP[stage])) assert.ok(sid in syms, `${stage} ${sid}`);
});

test("Calendar (UI C1): back-filling a period day from the Calendar re-runs predict() the same whatever order the days were saved in", () => {
  const iso = (n) => { const d = new Date(); d.setDate(d.getDate() - n); d.setHours(12, 0, 0, 0); return d.toISOString().slice(0, 10); };
  const day = (n, period) => ({ date: iso(n), period, flow: period ? "med" : null, sleepQ: "fair", sym: {} });
  // Two cycles logged in order: starts 60 and 32 days ago, then today's entry.
  const inOrder = [day(60, true), day(59, true), day(32, true), day(31, true), day(0, false)];
  // The same record when the older period was logged last, from the Calendar ("Log this day" on a past date).
  const backFilled = [day(32, true), day(31, true), day(0, false), day(60, true), day(59, true)];
  const a = insights(inOrder, ["crm"]), b = insights(backFilled, ["crm"]);
  assert.deepEqual(b.starts, a.starts);
  assert.deepEqual(b.lens, [28]);
  const pa = predict(a), pb = predict(b);
  assert.equal(pb.nextStart.getTime(), pa.nextStart.getTime());
  assert.equal(pb.cycleDay, pa.cycleDay);
  assert.equal(pb.basis, "logged");
  // Adding a third, earlier start out of order moves the average onto the logged mean.
  const c = insights([...backFilled, day(90, true)], ["crm"]);
  assert.deepEqual(c.lens, [30, 28]);
  assert.equal(predict(c).avgLen, 29);
});

test("relDay (UI S1): today / yesterday / N days ago inside a week, the short date beyond it or for a future day", () => {
  assert.equal(relDay("2026-10-16", "2026-10-16"), "today");
  assert.equal(relDay("2026-10-15", "2026-10-16"), "yesterday");
  assert.equal(relDay("2026-10-12", "2026-10-16"), "4 days ago");
  assert.equal(relDay("2026-10-09", "2026-10-16"), fmt("2026-10-09"));
  assert.equal(relDay("2026-10-20", "2026-10-16"), fmt("2026-10-20"));
});

/* ---------- day-score colour (L2: moved out of App.jsx; dark ramps) ---------- */
const lumOf = ([r, g, b]) => { const l = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }; return 0.2126 * l(r) + 0.7152 * l(g) + 0.0722 * l(b); };
const crOf = (a, b) => { const x = lumOf(a), y = lumOf(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
// The formula App.jsx used before L2, kept here to prove the light output is unchanged.
const oldScoreColor = (s, { good, mid, rough }) => {
  const lerp = (a, b, u) => a.map((c, i) => Math.round(c + (b[i] - c) * u));
  return `rgb(${s > 0.5 ? lerp(mid, good, (s - 0.5) * 2) : lerp(rough, mid, s * 2)})`;
};
const STEPS = [0, 0.25, 0.5, 0.75, 1];

test("scoreColorOf / scoreRgb (L2): light output equals the old App.jsx formula; dark peri uses its own anchors", () => {
  for (const st of ["peri", "preg", "periods"]) for (let i = 0; i <= 100; i++) assert.equal(scoreColorOf(i / 100, RAMPS[st]), oldScoreColor(i / 100, RAMPS[st]), `${st} ${i}`);
  assert.deepEqual(STEPS.map((s) => scoreColorOf(s, RAMPS.peri)), ["rgb(140,74,168)", "rgb(193,132,121)", "rgb(246,189,74)", "rgb(136,179,111)", "rgb(26,168,148)"]);
  assert.deepEqual(STEPS.map((s) => scoreColorOf(s, RAMPS.preg)), ["rgb(222,84,112)", "rgb(236,130,108)", "rgb(249,176,104)", "rgb(146,176,131)", "rgb(42,176,158)"]);
  assert.deepEqual(STEPS.map((s) => scoreColorOf(s, RAMPS.periods)), ["rgb(226,88,74)", "rgb(238,137,78)", "rgb(250,186,82)", "rgb(148,170,140)", "rgb(46,154,198)"]);
  assert.deepEqual(STEPS.map((s) => scoreColorOf(s, rampOf("peri", "dark"))), ["rgb(150,83,178)", "rgb(170,110,89)", "rgb(189,137,0)", "rgb(95,148,70)", "rgb(0,159,139)"]);
  assert.deepEqual(scoreRgb(1, RAMPS.peri), [26, 168, 148]);
});

test("inkOn (L2): the score ink is >= 4.5:1 on every fill, both schemes; dark fills stay >= 3:1 on that stage's dark cards", () => {
  let minInk = 99, minFill = 99;
  for (const st of ["peri", "preg", "periods"]) {
    for (const R of [RAMPS, RAMPS_DARK]) for (let i = 0; i <= 100; i++) {
      const c = scoreRgb(i / 100, R[st]);
      const ink = inkOn(c);
      assert.ok(ink === "#000000" || ink === "#FFFFFF");
      minInk = Math.min(minInk, crOf(hexRgb(ink), c));
    }
    for (const p of PALETTES[st]) for (let i = 0; i <= 100; i++) minFill = Math.min(minFill, crOf(scoreRgb(i / 100, RAMPS_DARK[st]), hexRgb(p.dark.card)));
  }
  assert.ok(minInk >= 4.5, `score ink ${minInk.toFixed(2)}`);
  assert.ok(minFill >= 3, `dark fill on dark card ${minFill.toFixed(2)}`);
  assert.equal(inkOn([255, 255, 255]), "#000000");
  assert.equal(inkOn([0, 0, 0]), "#FFFFFF");
});

/* ---------- routeIntake (moved from App.jsx rulesRoute in L7) ---------- */
import { routeIntake } from "./engine.js";
test("routeIntake: the old branches are unchanged; 'Trying to be' routes to Trying to Conceive", () => {
  const W = {
    preg: "Your pregnancy space is ready — week tracking, kick counts, and gentle guidance.",
    meno: "Welcome — this space tracks symptoms and builds the record your doctor can act on, no period tracking in your way.",
    periIrr: "Changing cycles are the story here — this space is built to read them, not fight them.",
    periVms: "Hot flashes and sleep changes front and center — with honest guidance on what's treatable.",
    cycle: "Your cycle space is ready — predictions, patterns, and zero judgment.",
    ttc: "Your trying-to-conceive space is ready — your estimated fertile window, the signs that matter, and honest uncertainty.",
  };
  assert.deepEqual(routeIntake({ preg: "yes" }), { stage: "preg", label: "Pregnancy", welcome: W.preg });
  assert.deepEqual(routeIntake({ preg: "ttc", age: "u35", per: "regular", vms: "no" }), { stage: "periods", label: "Trying to Conceive", welcome: W.ttc });
  assert.deepEqual(routeIntake({ preg: "ttc", per: "none12" }), { stage: "periods", label: "Trying to Conceive", welcome: W.ttc });
  assert.deepEqual(routeIntake({ preg: "ttc", age: "45p", per: "irregular", vms: "yes" }).label, "Trying to Conceive");
  assert.deepEqual(routeIntake({ preg: "no", per: "none12" }), { stage: "peri", label: "Menopause", welcome: W.meno });
  assert.deepEqual(routeIntake({ preg: "no", age: "45p", per: "irregular" }), { stage: "peri", label: "Perimenopause", welcome: W.periIrr });
  assert.deepEqual(routeIntake({ preg: "no", age: "45p", vms: "yes" }), { stage: "peri", label: "Perimenopause", welcome: W.periVms });
  assert.deepEqual(routeIntake({ preg: "no", age: "u35", per: "regular", vms: "no" }), { stage: "periods", label: "My Cycle", welcome: W.cycle });
  assert.deepEqual(routeIntake({ preg: "no", age: "u35", per: "irregular", vms: "no" }), { stage: "periods", label: "My Cycle", welcome: W.cycle });
  assert.deepEqual(routeIntake({ preg: "no", age: "u35", per: "irregular", vms: "yes" }).label, "Perimenopause");
});

/* ---------- L8: nights, sleep links, insights() hfMult, the demo seed ---------- */
import { nightOf, isRoughNight, sleepLink, SLEEP_LINK, seed, addDays as addD, localDay as todayOf } from "./engine.js";
import { readFileSync } from "node:fs";
/* lib/pulse.js imports lib/api.js (Vite's import.meta.env), so eventsForDay is lifted from its source text, as
   daylog.test.mjs and fertility.test.mjs do. */
const pulseSrc = readFileSync(new URL("./pulse.js", import.meta.url), "utf8");
const liftFn = (src, start) => {
  const i = src.indexOf(start), j = src.indexOf(") {", i) + 2;
  let depth = 0, k = j;
  for (; k < src.length; k++) { if (src[k] === "{") depth++; else if (src[k] === "}" && --depth === 0) break; }
  return src.slice(i, k + 1).replace(/^export /, "");
};
const { eventsForDay } = await import("data:text/javascript," + encodeURIComponent(`${liftFn(pulseSrc, "export function eventsForDay(")}\nexport { eventsForDay };`));

test("nightOf / isRoughNight (L8): poor or Sleep disruption ≥ 2 is rough, Slept well is good, fair / none is unknown", () => {
  assert.equal(nightOf({ sleepQ: "poor", sym: {} }), "rough");
  assert.equal(nightOf({ sleepQ: "fair", sym: { slp: 2 } }), "rough");
  assert.equal(nightOf({ sleepQ: "fair", sym: { slp: 3 } }), "rough");
  assert.equal(nightOf({ sleepQ: "good", sym: { slp: 0 } }), "good");
  assert.equal(nightOf({ sleepQ: "good", sym: { slp: 2 } }), "rough");
  assert.equal(nightOf({ sleepQ: "good" }), "good");
  assert.equal(nightOf({ sleepQ: "fair", sym: { slp: 1 } }), null);
  assert.equal(nightOf({ sym: {} }), null);
  assert.equal(nightOf(undefined), null);
  assert.equal(nightOf(null), null);
  assert.equal(isRoughNight({ sleepQ: "fair", sym: { slp: 2 } }), true);
  assert.equal(isRoughNight({ sleepQ: "good", sym: {} }), false);
  assert.equal(isRoughNight(null), false);
});

// n rough days with `rh` hits and m good days with `gh` hits for symptom fog (dates from 2026-01-01).
const linkDays = (n, rh, m, gh, id = "fog", level = 2) => {
  const out = []; let i = 0;
  for (let k = 0; k < n; k++) out.push({ date: addD("2026-01-01", i++), sleepQ: "poor", sym: { [id]: k < rh ? level : 0 } });
  for (let k = 0; k < m; k++) out.push({ date: addD("2026-01-01", i++), sleepQ: "good", sym: { [id]: k < gh ? level : 0 } });
  return out;
};

test("sleepLink pairs a day with its OWN Last night answer", () => {
  // R, G, R, G … 20 days; fog 2 on the day AFTER each rough night (the G days): no link (reversed).
  const after = Array.from({ length: 20 }, (_, i) => ({ date: addD("2026-03-01", i), sleepQ: i % 2 ? "good" : "poor", sym: { fog: i % 2 ? 2 : 0 } }));
  const a = sleepLink(after, "fog");
  assert.deepEqual([a.rough, a.good, a.ok, a.why], [{ n: 10, hits: 0 }, { n: 10, hits: 10 }, false, "no-link"]);
  // The same fog shifted onto the rough days themselves: a link with exact counts.
  const same = after.map((d, i) => ({ ...d, sym: { fog: i % 2 ? 0 : 2 } }));
  const b = sleepLink(same, "fog");
  assert.deepEqual([b.rough, b.good, b.ok, b.why, b.ratio], [{ n: 10, hits: 10 }, { n: 10, hits: 0 }, true, null, null]);
});

test("sleepLink thresholds at their boundaries, each rule isolated", () => {
  assert.equal(sleepLink(linkDays(4, 4, 10, 0), "fog").why, "few-nights");
  assert.equal(sleepLink(linkDays(5, 4, 10, 0), "fog").ok, true);
  assert.equal(sleepLink(linkDays(10, 4, 4, 0), "fog").why, "few-nights");
  assert.equal(sleepLink(linkDays(5, 3, 5, 0), "fog").why, "few-hits");
  assert.equal(sleepLink(linkDays(5, 4, 5, 0), "fog").ok, true);
  const free = { minEach: 0, minHits: 0 };
  assert.equal(sleepLink(linkDays(1000, 387, 1000, 300), "fog", { ...free, minDiff: 0 }).why, "no-link"); // 1.29×
  assert.equal(sleepLink(linkDays(1000, 390, 1000, 300), "fog", { ...free, minDiff: 0 }).ok, true); // 1.30×
  assert.equal(sleepLink(linkDays(100, 59, 100, 40), "fog", { ...free, minRatio: 0 }).why, "no-link"); // gap 0.19
  assert.equal(sleepLink(linkDays(100, 60, 100, 40), "fog", { ...free, minRatio: 0 }).ok, true); // gap 0.20
  // A severity of 1 is not a hit at level 2.
  const mild = sleepLink(linkDays(10, 10, 10, 0, "fog", 1), "fog");
  assert.deepEqual([mild.rough.hits, mild.why], [0, "few-hits"]);
  assert.deepEqual(SLEEP_LINK, { minEach: 5, minHits: 4, minRatio: 1.3, minDiff: 0.2, level: 2 });
});

test("sleepLink edge cases: zero base, reverse direction, ignored days", () => {
  const zero = sleepLink(linkDays(6, 5, 6, 0), "fog");
  assert.deepEqual([zero.ratio, zero.ok, zero.goodRate], [null, true, 0]);
  const rev = sleepLink(linkDays(6, 0, 6, 6), "fog");
  assert.deepEqual([rev.ok, rev.why], [false, "no-link"]);
  const base = linkDays(6, 5, 6, 1);
  const ref = sleepLink(base, "fog");
  const noisy = [
    ...base,
    { date: "2026-02-01", sleepQ: "fair", sym: { fog: 3 } }, // unknown night
    { date: "2026-02-02", sym: { fog: 3 } }, // no answer
    { date: "2026-02-03", sleepQ: "poor", sym: { hf: 3 } }, // fog not on that day's form
    { date: "2025-12-01", sleepQ: "poor", sym: { fog: 3 } }, // before from
    { date: "2026-03-01", sleepQ: "poor", sym: { fog: 3 } }, // after to
  ];
  const got = sleepLink(noisy, "fog", { from: "2026-01-01", to: "2026-02-28" });
  assert.deepEqual([got.rough, got.good, got.ratio], [ref.rough, ref.good, ref.ratio]);
  assert.equal(got.strength, ref.strength);
});

test("insights() L8: hfMult is the 60-day sleepLink('hf') ratio, hfMult30 the 30-day one; roughNights counts Sleep disruption ≥ 2", () => {
  const today = "2026-10-22";
  const days = [];
  // Days 59..30 before today: 8 rough (hf 2 on 6), 8 good (hf 2 on 1). Days 29..0: 8 rough (hf 2 on 7), 8 good (hf 2 on 2).
  const put = (ago, sleepQ, hf, extra = {}) => days.push({ date: addD(today, -ago), sleepQ, sym: { hf, slp: 0, ...extra } });
  for (let k = 0; k < 8; k++) { put(59 - k, "poor", k < 6 ? 2 : 0); put(50 - k, "good", k < 1 ? 2 : 0); }
  for (let k = 0; k < 8; k++) { put(29 - k, "poor", k < 7 ? 2 : 0); put(20 - k, "good", k < 2 ? 2 : 0); }
  put(3, "fair", 0, { slp: 2 }); // a quick-card Rough night: rough, counted in roughNights and in the 30-day link
  const ins = insights(days, ["hf", "slp"], new Date(today + "T12:00:00"));
  const l60 = sleepLink(ins.sorted, "hf", { from: addD(today, -59) });
  const l30 = sleepLink(ins.sorted, "hf", { from: addD(today, -29) });
  assert.ok(l60.ok && l30.ok);
  assert.equal(ins.hfMult, l60.ratio);
  assert.equal(ins.hfMult30, l30.ratio);
  assert.equal(ins.roughNights, days.filter((d) => d.date >= addD(today, -29) && (d.sleepQ === "poor" || d.sym.slp >= 2)).length);
  // The old tiny-sample case (two consecutive days) and a below-1 ratio: both null.
  const tiny = insights([{ date: "2026-10-20", sleepQ: "poor", sym: { hf: 2 } }, { date: "2026-10-21", sleepQ: "good", sym: { hf: 2 } }], ["hf"], new Date(today + "T12:00:00"));
  assert.deepEqual([tiny.hfMult, tiny.hfMult30], [null, null]);
  const below = insights(linkDays(10, 2, 10, 8, "hf").map((d, i) => ({ ...d, date: addD(today, -i) })), ["hf"], new Date(today + "T12:00:00"));
  assert.deepEqual([below.hfMult, below.hfMult30], [null, null]);
  // Weekly counts unchanged: a quick-card Rough night (slp 2, sleepQ fair) is no rough_night flag.
  assert.ok(!eventsForDay("peri", { sym: { slp: 2 }, sleepQ: "fair" }).includes("rough_night"));
  assert.ok(eventsForDay("peri", { sym: {}, sleepQ: "poor" }).includes("rough_night"));
});

test("seed() L8: deterministic, 75 days, and same-day pairing gives sleep links for ns and fog", () => {
  const a = seed(), b = seed();
  assert.deepEqual(a, b);
  assert.equal(a.length, 75);
  const from = addD(todayOf(), -59);
  for (const id of ["ns", "fog"]) assert.equal(sleepLink(a, id, { from }).ok, true, id);
});
