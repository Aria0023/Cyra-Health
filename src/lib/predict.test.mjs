/* Unit tests for the L5 cycle maths in lib/engine.js: kept cycles, honest ranges, long cycles, her cycle flags and
   the wording helpers. Run with `npm run test:unit`. Every prediction is computed against a fixed today, so nothing
   here depends on the clock. */
import test from "node:test";
import assert from "node:assert/strict";
import {
  insights, predict, whyNoPrediction, predictionWaits, median, mad, unusualCycles, cleanCycleFlags, flagKey, isExcluded,
  toggleExclude, cycleSpans, cycleStarts, cycleSummary, fmtRange, periodHead, basisLine, lensLabel, daysBetween, addDays,
  fmt, RANGE, CYCLE_MIN, CYCLE_MAX, CYCLE_FLAGS_MAX, TOLD_CYCLE_LEN,
} from "./engine.js";
import { PSYM } from "./constants.js";

const TODAY = "2026-10-22";
const IDS = Object.keys(PSYM);
const TOLD = { cycleLen: "24–31 days", lastPeriod: "" };

/* Day entries for cycles of the given lengths (oldest first), each start with 3 period days of medium flow, the last
   start `cycleDay - 1` days before `today` (so today is that day of the running cycle). */
function build(lengths, cycleDay = 15, today = TODAY) {
  const last = addDays(today, -(cycleDay - 1));
  const starts = [last];
  for (let i = lengths.length - 1; i >= 0; i--) starts.unshift(addDays(starts[0], -lengths[i]));
  const days = [];
  for (const s of starts) for (let k = 0; k < 3; k++) days.push({ date: addDays(s, k), period: true, flow: "med", sleepQ: "fair", sym: {} });
  return { days, starts, ins: insights(days, IDS, new Date(today + "T12:00:00")) };
}
const opts = (o = {}) => ({ today: TODAY, ...o });
const P = (fx, prior = null, o = {}) => predict(fx.ins, prior, opts(o));
const W = (fx, prior = null, o = {}) => whyNoPrediction(fx.ins, prior, opts(o));
const ex = (...starts) => Object.fromEntries(starts.map((s) => [s, { exclude: true }]));
const A = [28, 29, 27, 30, 61, 28];

/* ---------- small maths ---------- */

test("median / mad", () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([1, 2, 3, 4]), 2.5);
  assert.equal(median([]), null);
  assert.equal(mad([28, 29, 30, 60]), 1);
  const input = [3, 1, 2];
  median(input);
  assert.deepEqual(input, [3, 1, 2], "sorts a copy");
  assert.equal(daysBetween("2026-10-01", "2026-11-01"), 31);
  assert.equal(addDays("2026-10-30", 3), "2026-11-02");
  assert.equal(addDays("2026-03-08", 1), "2026-03-09", "across a daylight-saving change");
});

test("unusualCycles: a suggestion outside median ± max(7, 2.5 × MAD), at least 3 cycles", () => {
  assert.deepEqual(unusualCycles([28, 60]), [null, null]);
  assert.deepEqual(unusualCycles([]), []);
  assert.deepEqual(unusualCycles([28, 29, 30, 60]), [null, null, null, "long"]);
  assert.deepEqual(unusualCycles([29, 30, 28, 16]), [null, null, null, "short"]);
  assert.deepEqual(unusualCycles([28, 28, 28, 36]), [null, null, null, "long"], "MAD 0, band 7, 36 > 35");
  assert.deepEqual(unusualCycles([27, 28, 29, 35]), [null, null, null, null], "35 is not > 28.5 + 7");
  assert.deepEqual(unusualCycles([21, 35, 22, 36, 23, 34]), [null, null, null, null, null, null], "wide but steady");
  assert.deepEqual(unusualCycles(A), [null, null, null, null, "long", null]);
});

/* ---------- her cycle flags ---------- */

test("cleanCycleFlags", () => {
  for (const bad of [null, undefined, "x", 3, [], [{ exclude: true }], true]) assert.deepEqual(cleanCycleFlags(bad), {});
  assert.deepEqual(cleanCycleFlags({ "2026-10-01": { exclude: true }, "2026-1-1": { exclude: true }, junk: { exclude: true }, "2026-09-01": true, "2026-08-01": null, "2026-07-01": [1] }), { "2026-10-01": { exclude: true } });
  assert.deepEqual(cleanCycleFlags({ "2026-10-01": { exclude: false }, "2026-09-01": {} }), {}, "nothing left in them");
  assert.deepEqual(cleanCycleFlags({ "2026-10-01": { exclude: 1 }, "2026-09-01": { exclude: false, note: "x" }, "2026-08-01": { exclude: "", later: [1, 2] } }),
    { "2026-10-01": { exclude: true }, "2026-09-01": { exclude: false, note: "x" }, "2026-08-01": { exclude: false, later: [1, 2] } });
  const many = {};
  for (let i = 0; i <= CYCLE_FLAGS_MAX; i++) many[addDays("2020-01-01", i * 7)] = { exclude: true };
  const cleaned = cleanCycleFlags(many);
  assert.equal(Object.keys(many).length, 401);
  assert.equal(Object.keys(cleaned).length, 400);
  assert.ok(!("2020-01-01" in cleaned), "the oldest goes");
  assert.ok(addDays("2020-01-01", 400 * 7) in cleaned, "the newest stays");
  // Clean in, the same JSON out (record.js RULES relies on this), and the input is never changed.
  const ok = { "2026-09-01": { exclude: true }, "2026-03-01": { exclude: true } };
  assert.equal(JSON.stringify(cleanCycleFlags(ok)), JSON.stringify(ok));
  assert.notEqual(cleanCycleFlags(ok), ok);
});

test("flagKey / isExcluded / toggleExclude", () => {
  const s = "2026-10-10";
  assert.equal(flagKey(s, { [s]: { exclude: true } }), s);
  assert.equal(flagKey(s, { "2026-10-12": { exclude: true } }), "2026-10-12", "2 days away applies");
  assert.equal(flagKey(s, { "2026-10-08": { exclude: true } }), "2026-10-08");
  assert.equal(flagKey(s, { "2026-10-13": { exclude: true } }), null, "3 days away does not");
  assert.equal(flagKey(s, { "2026-10-09": { exclude: true }, "2026-10-12": { exclude: true } }), "2026-10-09", "the nearest");
  assert.equal(isExcluded(s, { "2026-10-12": { exclude: true } }), true);
  assert.equal(isExcluded(s, { "2026-10-13": { exclude: true } }), false);
  assert.equal(isExcluded(s, { [s]: { exclude: false, note: 1 } }), false);
  assert.equal(isExcluded(s, {}), false);
  assert.equal(isExcluded(s, null), false);
  const f = { "2026-10-11": { exclude: true, note: "kept" }, "2026-06-01": { exclude: true } };
  const before = JSON.stringify(f);
  const on = toggleExclude(f, s, true);
  assert.deepEqual(on, { "2026-06-01": { exclude: true }, [s]: { note: "kept", exclude: true } }, "the near key is replaced, its extra field carried");
  const off = toggleExclude(on, s, false);
  assert.deepEqual(off, { "2026-06-01": { exclude: true }, [s]: { note: "kept", exclude: false } }, "an extra field keeps the entry, with exclude false");
  assert.deepEqual(toggleExclude({ [s]: { exclude: true }, "2026-06-01": { exclude: true } }, s, false), { "2026-06-01": { exclude: true } }, "removed");
  assert.deepEqual(toggleExclude({}, s, true), { [s]: { exclude: true } });
  assert.equal(JSON.stringify(f), before, "the input is never changed");
  assert.notEqual(toggleExclude(f, "2025-01-01", false), f, "always a new object");
});

/* ---------- predict ---------- */

test("predict centre: Fixture A, then with the 61-day cycle left out", () => {
  const fx = build(A);
  const p = P(fx);
  assert.equal(p.center, 29, "median 28.5 rounded");
  assert.equal(p.avgLen, 29);
  assert.equal(p.half, 10, "cap");
  assert.equal(p.basis, "logged");
  assert.equal(p.used, 6);
  assert.equal(p.left, 0);
  assert.equal(p.cycleDay, 15);
  assert.equal(p.state, "upcoming");
  const S = fx.starts[fx.starts.length - 1];
  assert.equal(p.lastStart, S);
  assert.equal(p.fromIso, addDays(S, 19));
  assert.equal(p.toIso, addDays(S, 39));
  const q = P(fx, null, { flags: ex(fx.starts[4]) });
  assert.equal(q.center, 28);
  assert.equal(q.half, 2);
  assert.equal(q.used, 5);
  assert.equal(q.left, 1);
  assert.deepEqual(q.usedLens, [28, 29, 27, 30, 28]);
  assert.ok(!q.usedStarts.includes(fx.starts[4]));
  assert.equal(q.fromIso, addDays(S, 26));
  assert.equal(q.toIso, addDays(S, 30));
  // A flag 2 days off the start (a moved first period day) still applies.
  assert.equal(P(fx, null, { flags: ex(addDays(fx.starts[4], 2)) }).center, 28);
});

test("predict uses the last up-to-6 KEPT cycles", () => {
  const fx = build([26, 27, 28, 29, 30, 28, 27, 40]);
  const newest = fx.starts[7];
  const p = P(fx, null, { flags: ex(newest) });
  assert.deepEqual(p.usedStarts, fx.starts.slice(1, 7), "an older cycle is pulled in");
  assert.deepEqual(p.usedLens, [27, 28, 29, 30, 28, 27]);
  assert.equal(p.left, 1);
  // Left out further back than the cycles in use: not counted in `left`.
  assert.equal(P(fx, null, { flags: ex(fx.starts[0]) }).left, 0);
});

test("predict: her sign-up answer until two cycles are kept", () => {
  const one = build([31]);
  const t = P(one, TOLD);
  assert.equal(t.basis, "told"); assert.equal(t.center, 28); assert.equal(t.half, 4); assert.equal(t.oneLogged, 31); assert.equal(t.used, 0);
  const three = build([30, 32, 26]);
  const t2 = P(three, TOLD, { flags: ex(three.starts[0], three.starts[2]) });
  assert.equal(t2.basis, "told"); assert.equal(t2.left, 2); assert.equal(t2.oneLogged, 32);
  const l1 = P(one);
  assert.equal(l1.basis, "logged"); assert.equal(l1.used, 1); assert.equal(l1.half, 4); assert.equal(l1.center, 31);
  const none = build([]);
  const d = P(none);
  assert.equal(d.basis, "default"); assert.equal(d.center, 28); assert.equal(d.half, 4); assert.equal(d.used, 0);
  assert.equal(P(none, null, { stage: "peri" }).half, 6, "peri few");
  assert.equal(P(one, TOLD, { stage: "peri" }).half, 6);
  assert.equal(TOLD_CYCLE_LEN["Over 31 days"], 34);
});

test("predict: range clamps", () => {
  assert.equal(P(build([28, 28, 28])).half, 2);
  assert.equal(P(build([26, 28, 33])).half, 5);
  assert.equal(P(build([21, 28, 45])).half, 10);
  assert.equal(P(build([21, 28, 45]), null, { stage: "peri" }).half, 17);
  assert.equal(P(build([28, 28]), null, { stage: "peri" }).half, 4);
  const short = build([15, 20, 30], 5);
  const s = P(short);
  assert.equal(s.center, 20); assert.equal(s.half, 10);
  assert.equal(daysBetween(s.lastStart, s.fromIso), CYCLE_MIN, "never before day 15");
  const long = build([100, 115, 120], 5);
  const l = P(long, null, { stage: "peri" });
  assert.equal(l.center, 115); assert.equal(l.half, 15);
  assert.equal(daysBetween(l.lastStart, l.toIso), CYCLE_MAX, "never after day 120");
  assert.deepEqual(RANGE, { cycle: { min: 2, max: 10, few: 4 }, peri: { min: 4, max: 20, few: 6 } });
});

test("predict states at the exact boundaries", () => {
  const fx = build([28, 28, 28]);
  const S = fx.starts[fx.starts.length - 1];
  const at = (d) => predict(fx.ins, null, { today: addDays(S, d) });
  // center 28, half 2: from day 26 to day 30
  assert.equal(at(25).state, "upcoming");
  assert.equal(at(26).state, "window");
  assert.equal(at(30).state, "window");
  const later = at(31);
  assert.equal(later.state, "later"); assert.equal(later.pastRange, 1);
  for (const d of [3, 25, 26, 30, 31, 60]) { const p = at(d); assert.equal(p.daysTo, 28 - d); assert.equal(p.late, d - 28); assert.equal(p.cycleDay, d + 1); }
  // A Date works as today too.
  assert.equal(predict(fx.ins, null, { today: new Date(addDays(S, 26) + "T09:00:00") }).state, "window");
});

test("long cycles: 120 counts, 121 doesn't; over 120 days since the last start, no prediction", () => {
  const ok = build([28, 120], 5);
  assert.deepEqual(ok.ins.lens, [28, 120]);
  assert.equal(ok.ins.cycles[1].counted, true);
  const no = build([28, 121], 5);
  assert.deepEqual(no.ins.lens, [28]);
  assert.equal(no.ins.cycles[1].counted, false);
  assert.equal(no.ins.cycles[1].len, 121);
  const fx = build([28, 29, 30]);
  const S = fx.starts[fx.starts.length - 1];
  const p120 = predict(fx.ins, null, { today: addDays(S, 120) });
  assert.equal(p120.state, "later");
  assert.equal(predict(fx.ins, null, { today: addDays(S, 121) }), null);
  assert.deepEqual(whyNoPrediction(fx.ins, null, { today: addDays(S, 121) }), { kind: "long", days: 121 });
});

test("stages: no period prediction in pregnancy or menopause", () => {
  const fx = build(A);
  assert.equal(P(fx, TOLD, { stage: "preg" }), null);
  assert.equal(W(fx, TOLD, { stage: "preg" }), null);
  assert.equal(P(fx, null, { stage: "peri", isMeno: true }), null);
  assert.deepEqual(W(fx, null, { stage: "peri", isMeno: true }), { kind: "meno" });
  assert.ok(P(fx, null, { stage: "peri" }).wide);
  assert.ok(!P(fx).wide);
});

test("waits: unsure, excluded and none", () => {
  const irr = { cycleLen: "Irregular" }, unsure = { cycleLen: "Not sure" };
  const one = build([29]);
  assert.deepEqual(W(one, irr), { kind: "unsure" });
  const two = build([29, 31]);
  assert.ok(P(two, irr), "two kept: a prediction");
  assert.deepEqual(W(two, irr, { flags: ex(two.starts[0]) }), { kind: "excluded", kept: 1 }, "irregular, 1 of 2 left out: one still in use");
  assert.deepEqual(W(two, irr, { flags: ex(two.starts[0], two.starts[1]) }), { kind: "excluded", kept: 0 }, "irregular, every cycle left out");
  const three = build([29, 33, 31]);
  assert.deepEqual(W(three, unsure, { flags: ex(three.starts[0], three.starts[2]) }), { kind: "excluded", kept: 1 }, "not sure, 2 of 3 left out");
  assert.ok(P(three, unsure, { flags: ex(three.starts[0]) }), "not sure, two still in use: a prediction");
  assert.deepEqual(W(build([29]), irr, { flags: ex(build([29]).starts[0]) }), { kind: "excluded", kept: 0 }, "irregular, the only cycle left out");
  assert.deepEqual(W(two, null, { flags: ex(two.starts[0], two.starts[1]) }), { kind: "excluded", kept: 0 }, "every counted cycle left out, no told length");
  assert.ok(P(two, TOLD, { flags: ex(two.starts[0], two.starts[1]) }), "a told length still predicts");
  assert.equal(P(two, TOLD, { flags: ex(two.starts[0], two.starts[1]) }).left, 2);
  const nothing = { starts: [], cycles: [] };
  assert.deepEqual(whyNoPrediction(nothing, null, opts()), { kind: "none" });
  assert.deepEqual(whyNoPrediction(nothing, unsure, opts()), { kind: "unsure" });
  assert.deepEqual(whyNoPrediction(nothing, { cycleLen: "24–31 days", lastPeriod: "" }, opts()), { kind: "none" });
  assert.equal(predictionWaits(one.ins, irr), true);
  assert.equal(predictionWaits(two.ins, irr, ex(two.starts[0])), false, "excluded is not the wait");
  assert.equal(predictionWaits(nothing, null), false);
  assert.equal(predictionWaits(nothing, unsure), true);
});

test("predict and whyNoPrediction agree (exactly one is non-null) over every fixture", () => {
  const fixtures = [build(A), build([28, 29, 30]), build([29]), build([]), build([28, 121], 5), build([26, 27, 28, 29, 30, 28, 27, 40]), { ins: { starts: [], cycles: [] }, starts: [] }];
  const priors = [null, TOLD, { cycleLen: "Irregular" }, { cycleLen: "Not sure" }, { cycleLen: "Over 31 days", lastPeriod: addDays(TODAY, -10) }];
  let n = 0;
  for (const fx of fixtures) for (const prior of priors) for (const stage of ["periods", "peri"]) for (const d of [0, 14, 40, 125]) {
    const flagSets = [{}, ex(...fx.starts), fx.starts.length ? ex(fx.starts[0]) : {}];
    for (const flags of flagSets) {
      const o = { flags, stage, today: fx.starts.length ? addDays(fx.starts[fx.starts.length - 1], d) : TODAY };
      const p = predict(fx.ins, prior, o), w = whyNoPrediction(fx.ins, prior, o);
      assert.ok((p === null) !== (w === null), JSON.stringify({ starts: fx.starts, prior, stage, d, flags, p: !!p, w }));
      n++;
    }
  }
  assert.ok(n > 500);
});

test("fertile window: anchored on the kept-cycle centre, widening by up to 3 days each side", () => {
  const span = (p) => daysBetween(p.fertileFromIso, p.fertileToIso) + 1;
  const h2 = P(build([28, 28, 28]));
  assert.equal(h2.half, 2);
  assert.equal(h2.ovuIso, addDays(h2.lastStart, 28 - 14));
  assert.equal(h2.fertileFromIso, addDays(h2.ovuIso, -3));
  assert.equal(h2.fertileToIso, addDays(h2.ovuIso, 1));
  assert.equal(span(h2), 5);
  const h5 = P(build([26, 28, 33]));
  assert.equal(h5.half, 5); assert.equal(span(h5), 11);
  const h10 = P(build(A));
  assert.equal(h10.half, 10); assert.equal(span(h10), 11);
  for (const p of [h2, h5, h10]) {
    const e = Math.min(3, Math.max(0, p.half - 2));
    assert.equal(p.fertileDay, daysBetween(p.lastStart, p.fertileFromIso) + 1);
    assert.equal(p.fertileDay, p.center - 16 - e);
    assert.equal(p.fertileFrom.getTime(), new Date(p.fertileFromIso + "T12:00:00").getTime());
  }
  const fx = build(A);
  const moved = P(fx, null, { flags: ex(fx.starts[4]) });
  assert.equal(moved.ovuIso, addDays(moved.lastStart, 28 - 14), "moves with the kept-cycle centre");
  assert.notEqual(moved.ovuIso, h10.ovuIso);
  // Phase uses the window: today inside it is fertile.
  const inWin = predict(fx.ins, null, { flags: ex(fx.starts[4]), today: moved.ovuIso });
  assert.equal(inWin.phase, "fertile");
  assert.equal(predict(fx.ins, null, { today: addDays(moved.lastStart, 2) }).phase, "menstrual");
});

test("seeded prediction from the sign-up answer", () => {
  const nothing = { starts: [], cycles: [] };
  const p = predict(nothing, { cycleLen: "24–31 days", lastPeriod: addDays(TODAY, -10) }, opts());
  assert.equal(p.seeded, true); assert.equal(p.basis, "told"); assert.equal(p.cycleDay, 11);
  assert.equal(predict(nothing, { cycleLen: "24–31 days", lastPeriod: addDays(TODAY, 1) }, opts()), null);
  assert.deepEqual(whyNoPrediction(nothing, { cycleLen: "24–31 days", lastPeriod: addDays(TODAY, -130) }, opts()), { kind: "long", days: 130 });
  assert.equal(predict(nothing, { cycleLen: "24–31 days", lastPeriod: "10/02/2026" }, opts()), null);
});

/* ---------- wording ---------- */

test("copy helpers", () => {
  assert.equal(fmtRange("2026-10-26", "2026-11-01"), "Oct 26 – Nov 1");
  assert.equal(fmtRange("2026-10-23", "2026-10-31"), "Oct 23 – Oct 31");
  const base = { fromIso: "2026-10-26", toIso: "2026-11-01" };
  assert.equal(periodHead({ ...base, state: "upcoming" }), "Period likely Oct 26 – Nov 1");
  assert.equal(periodHead({ ...base, state: "window" }), "Period likely any day now, by Nov 1");
  assert.equal(periodHead({ ...base, state: "later" }), "Period later than your usual range");
  assert.equal(basisLine({ basis: "logged", used: 5, left: 1 }), "Based on your last 5 cycles · 1 left out");
  assert.equal(basisLine({ basis: "logged", used: 1, left: 0 }), "Based on your last cycle");
  assert.equal(basisLine({ basis: "told", used: 0, left: 0 }), "Based on your sign-up answer");
  assert.equal(basisLine({ basis: "default", used: 0, left: 0 }), "Based on a typical 28-day cycle");
  assert.equal(lensLabel({ len: 61, excluded: true }), "61 (left out of predictions)");
  assert.equal(lensLabel({ len: 28, excluded: false }), "28");
  assert.equal(fmt("2026-11-01"), "Nov 1");
});

/* ---------- Your cycles ---------- */

test("cycleSummary", () => {
  const fx = build(A);
  const S = fx.starts[fx.starts.length - 1];
  const p = P(fx);
  const c = cycleSummary(fx.ins, {}, TODAY, p.usedStarts);
  assert.deepEqual(c.rows.map((r) => r.len), [28, 61, 30, 27, 29, 28], "newest first");
  assert.deepEqual(c.current, { start: S, day: 15 });
  assert.equal(c.rows[1].unusual, "long");
  assert.deepEqual(c.rows[1].usual, [27, 30]);
  assert.ok(c.rows.every((r) => r.counted && !r.excluded && r.used));
  assert.equal(c.pending, 1);
  assert.equal(c.excludedCount, 0);
  assert.equal(c.more, false);
  assert.deepEqual(c.lens6.map((x) => x.len), fx.ins.lens);
  const flags = ex(fx.starts[4]);
  const q = P(fx, null, { flags });
  const c2 = cycleSummary(fx.ins, flags, TODAY, q.usedStarts);
  assert.equal(c2.rows[1].excluded, true);
  assert.equal(c2.rows[1].used, false);
  assert.equal(c2.pending, 0, "no longer affects the prediction");
  assert.equal(c2.excludedCount, 1);
  assert.deepEqual(c2.lens6, fx.ins.lens.map((len, i) => ({ start: fx.starts[i], len, excluded: i === 4 })));
  // Uncounted spans, the 12-row cap and all-time exclusions.
  const many = build([28, 10, 29, 27, 30, 28, 29, 27, 28, 29, 30, 28, 27, 29, 130, 28], 3);
  const flagsOld = ex(many.starts[0]);
  const m = cycleSummary(many.ins, flagsOld, TODAY, []);
  assert.equal(m.rows.length, 12); assert.equal(m.more, true);
  const ten = cycleSummary(build([28, 10, 29]).ins, {}, TODAY, []);
  assert.deepEqual(ten.rows.map((r) => [r.len, r.counted, r.unusual]), [[29, true, null], [10, false, null], [28, true, null]]);
  const longRow = m.rows.find((r) => r.len === 130);
  assert.equal(longRow.counted, false); assert.equal(longRow.unusual, null); assert.equal(longRow.excluded, false);
  assert.equal(m.excludedCount, 1, "counts a left-out cycle older than the 12 shown");
  assert.equal(cycleSummary({ starts: [], cycles: [] }, {}, TODAY).current, null);
});

test("clinical markers ignore cycleFlags (insights takes no flags)", () => {
  const fx = build(A);
  const before = insights(fx.days, IDS, new Date(TODAY + "T12:00:00"));
  assert.equal(before.variability, 34);
  const flags = ex(fx.starts[4]);
  P(fx, null, { flags });
  cycleSummary(fx.ins, flags, TODAY, []);
  const after = insights(fx.days, IDS, new Date(TODAY + "T12:00:00"));
  for (const k of ["lens", "variability", "lens30", "variability30", "starts"]) assert.deepEqual(after[k], before[k], k);
  assert.equal(insights.length, 2, "insights(days, ids, today = new Date()) has no flags parameter");
  assert.deepEqual(before.cycles, cycleSpans(cycleStarts(fx.days)));
});
