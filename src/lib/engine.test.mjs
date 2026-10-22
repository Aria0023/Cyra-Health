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
