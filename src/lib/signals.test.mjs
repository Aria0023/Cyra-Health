// Passive tracking S1: the signals library (lib/signals.js) on synthetic cycles (lib/signalsFixtures.js).
// Run: node --test src/lib/signals.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import {
  METRICS, CARD_ORDER, SKIP_REASONS, RISE, BASELINE, OUTLIER, PHASES, RECENT_HOURS, wakeDay, nightlyValues, nightlyTemps, excludeOutliers, validNights, nightNote,
  cycleDayOf, cycleOf, lhPositiveDays, ovulationFor, cycleOvulations, riseWords, riseDetail, phaseOf, baselines, wordFor, buildNightly, readinessWords, FEW_NIGHTS,
  bleedingDays, cycleTable, skippedSummary, hrvBeforeRise, reviewSentence, latestNight, SIGNAL_COPY,
} from "./signals.js";
import { FIXTURES, syntheticCycle, syntheticLog, demoRows, demoStarts } from "./signalsFixtures.js";
import { FERT_BANNED, contraOk } from "./fertility.js";
import { addDays } from "./engine.js";
import { cyclesFrom } from "./record.js";

const reg = FIXTURES.regular28();
const temps = (f, o = {}) => nightlyTemps(f.rows, o);

test("constants: the rules are named, numeric and frozen", () => {
  assert.deepEqual({ ...RISE }, { delta: 0.2, nights: 3, before: 6, minNights: 10, span: 14, lhWindow: 2 });
  assert.deepEqual({ ...BASELINE }, { minN: 7, sdK: 1 });
  assert.equal(OUTLIER.above, 1.0);
  assert.equal(RECENT_HOURS, 36);
  assert.deepEqual([...METRICS], ["temp", "rhr", "hrv", "sleep"]);
  assert.deepEqual([...CARD_ORDER], ["sleep", "temp", "hrv", "rhr"]);
  assert.deepEqual(SKIP_REASONS.map(([id]) => id), ["fever", "alcohol", "travel", "other"]);
  assert.deepEqual([...PHASES], ["menstrual", "follicular", "ovulatory", "luteal"]);
  for (const x of [RISE, BASELINE, OUTLIER, SKIP_REASONS]) assert.ok(Object.isFrozen(x));
});

test("fixtures: the synthetic cycles are deterministic and shaped like plugin rows", () => {
  const a = syntheticCycle({ start: "2026-07-06" }), b = syntheticCycle({ start: "2026-07-06" });
  assert.deepEqual(a, b);
  assert.equal(a.length, 28);
  for (const r of a) { assert.deepEqual(Object.keys(r), ["date", "temp", "rhr", "hrv", "sleep", "sourceId"]); for (const m of METRICS) assert.equal(typeof r[m], "number"); }
  assert.ok(a.slice(0, 14).every((r) => r.temp < 0.1) && a.slice(14).every((r) => r.temp > 0.25), "a rise from day 15");
  assert.equal(reg.cycles.length, 3);
  assert.deepEqual(cyclesFrom(reg.days).map((c) => c.length), [28, 28, 28, null]);
});

test("wakeDay: a night belongs to the local day it ends on, across time zones", () => {
  assert.equal(wakeDay("2026-10-08"), "2026-10-08");
  assert.equal(wakeDay("2026-10-08T07:30:00+14:00"), "2026-10-08", "wall clock in Kiribati, not the UTC date (10-07)");
  assert.equal(wakeDay("2026-10-07T17:30:00Z", 14 * 60), "2026-10-08", "the same UTC instant moved by the device's offset");
  assert.equal(wakeDay("2026-10-07T17:30:00Z"), "2026-10-07", "no offset given: UTC");
  assert.equal(wakeDay("2026-10-08T21:10:00+02:00"), "2026-10-09", "an evening reading is the next morning's night");
  assert.equal(wakeDay("2026-10-08T19:59:00+02:00"), "2026-10-08");
  assert.equal(wakeDay("nonsense"), null); assert.equal(wakeDay(null), null); assert.equal(wakeDay("2026-13-40"), null);
  const f = FIXTURES.tzBoundary();
  const t = nightlyValues(f.rows, "temp", { tzOffsetMin: 14 * 60 });
  assert.deepEqual(t.map((n) => n.day), ["2026-10-08", "2026-10-09"]);
  assert.equal(t[0].also.length, 1, "the watch and the ring landed on the same night");
});

test("nightlyValues: one value per night, the preferred source first, the others 'also from', skips never valid", () => {
  const f = FIXTURES.twoSources();
  const def = nightlyValues(f.rows, "temp");
  assert.equal(def.length, 28);
  assert.equal(def[0].sourceId, "healthkit", "no preference: sorted by source id");
  assert.deepEqual(def[0].also.map((a) => a.sourceId), ["oura"]);
  const ring = nightlyValues(f.rows, "temp", { prefer: { temp: "oura" } });
  assert.equal(ring[0].sourceId, "oura"); assert.ok(Math.abs(ring[0].value - def[0].value - 0.1) < 1e-9);
  assert.deepEqual(ring[0].also.map((a) => a.sourceId), ["healthkit"]);
  const hrv = nightlyValues(f.rows, "hrv", { prefer: { temp: "oura" } });
  assert.equal(hrv[0].sourceId, "healthkit", "a preference is per metric");
  const day = f.rows[3].date;
  const sk = nightlyValues(f.rows, "temp", { skips: { [day]: "alcohol" } });
  assert.equal(sk[3].skipped, "alcohol"); assert.equal(sk[3].valid, false); assert.equal(validNights(sk).length, 27);
  assert.equal(nightNote(sk[3]), "Skipped: alcohol");
  assert.deepEqual(nightlyValues([{ date: "2026-01-01", temp: "0.2" }, { date: "bad", temp: 0.1 }, null], "temp"), []);
});

test("excludeOutliers: a fever-like night (> 1.0 °C over the other nights) is left out with a note", () => {
  const f = FIXTURES.feverNight();
  const t = temps(f);
  const hot = t.find((n) => cycleDayOf(f.cycles[0].start, n.day) === 9);
  assert.ok(hot.outlier && !hot.valid, "cycle day 9 is the fever");
  assert.equal(t.filter((n) => n.outlier).length, 1, "only that one");
  assert.equal(nightNote(hot), "Left out: much higher than your other nights");
  assert.equal(excludeOutliers(nightlyValues(reg.rows, "temp")).filter((n) => n.outlier).length, 0, "a normal rise (0.35) is never an outlier");
  assert.equal(excludeOutliers([{ day: "2026-01-01", value: 2, skipped: null }]).filter((n) => n.outlier).length, 0, "one night alone is never an outlier");
});

test("ovulationFor: three nights ≥ 0.2 °C over the mean of the six before → rise seen on the first of them", () => {
  const ov = ovulationFor(reg.cycles[0], temps(reg));
  assert.equal(ov.status, "rise-seen"); assert.equal(ov.day, 15); assert.equal(ov.date, addDays(reg.cycles[0].start, 14));
  assert.equal(ov.confidence, "possible"); assert.equal(ov.lutealDays, 14); assert.equal(ov.nights, 28);
  assert.ok(ov.cover < 0.1);
  const all = cycleOvulations(reg.cycles, temps(reg));
  assert.deepEqual(Object.values(all).map((o) => [o.status, o.day]), [["rise-seen", 15], ["rise-seen", 15], ["rise-seen", 15]]);
});

test("ovulationFor: an irregular 45-day cycle with a late rise reads day 31 and a 15-day luteal phase", () => {
  const f = FIXTURES.irregular45();
  const ov = ovulationFor(f.cycles[1], temps(f));
  assert.equal(f.cycles[1].length, 45);
  assert.deepEqual([ov.status, ov.day, ov.lutealDays], ["rise-seen", 31, 15]);
  assert.equal(ovulationFor(f.cycles[2], temps(f)).day, 15, "the next regular cycle is read on its own");
});

test("ovulationFor: an anovulatory cycle reads 'no sustained rise', never a day", () => {
  const f = FIXTURES.anovulatory();
  const ov = ovulationFor(f.cycles[0], temps(f));
  assert.deepEqual([ov.status, ov.day, ov.lutealDays, ov.nights], ["no-rise-seen", null, null, 30]);
  assert.equal(riseWords(ov), "No sustained rise seen this cycle");
});

test("ovulationFor: fewer than 10 valid nights, or no 6 nights before a candidate, is 'not enough nights'", () => {
  const f = FIXTURES.regular28();
  const few = ovulationFor(f.cycles[0], temps(f).slice(0, 9));
  assert.equal(few.status, "not-enough-nights"); assert.equal(few.nights, 9);
  const running = syntheticLog({ n: 1, running: true, shape: () => ({ length: 8 }) });
  assert.equal(ovulationFor(running.cycles[0], temps(running)).status, "not-enough-nights", "a running cycle 8 nights old");
  const sparse = syntheticCycle({ start: "2026-07-06", missing: [2, 4, 6, 8, 10, 12] });
  const ov = ovulationFor({ start: "2026-07-06", next: "2026-08-03" }, nightlyTemps(sparse));
  assert.equal(ov.status, "rise-seen", "22 valid nights: the six before the rise exist even with gaps");
  assert.equal(riseWords({ status: "not-enough-nights" }), "Not enough nights");
  assert.equal(ovulationFor(null, []).status, "not-enough-nights");
});

test("skips: four skipped nights are left out of the rise test and the count; a skip over the rise moves it", () => {
  const f = FIXTURES.withSkips();
  const t = temps(f, { skips: f.skips });
  assert.equal(validNights(t).length, 24);
  const ov = ovulationFor(f.cycles[0], t);
  assert.equal(ov.status, "rise-seen"); assert.equal(ov.day, 15); assert.equal(ov.nights, 24);
  const s = f.cycles[0].start;
  const overRise = temps(f, { skips: { [addDays(s, 14)]: "fever" } });
  const ov2 = ovulationFor(f.cycles[0], overRise);
  assert.equal(ov2.day, 16, "with day 15 skipped the first three consecutive valid nights start on day 16");
  assert.deepEqual(skippedSummary(f.skips), { n: 4, byReason: { fever: 3, travel: 1 }, text: "Nights she marked as not usable: 4 (fever or illness 3, travel 1)." });
  assert.equal(skippedSummary({}).text, "No nights marked as not usable.");
});

test("the three nights must be consecutive calendar nights; a fever night does not count as a rise", () => {
  const s = "2026-07-06";
  const broken = syntheticCycle({ start: s, missing: [16] }); // the rise's second night is missing
  const ov = ovulationFor({ start: s, next: "2026-08-03" }, nightlyTemps(broken));
  assert.equal(ov.day, 17, "the run restarts after the gap");
  const f = FIXTURES.feverNight();
  const t = temps(f);
  const hot = t.find((n) => cycleDayOf(f.cycles[0].start, n.day) === 9);
  assert.ok(hot.outlier);
  assert.equal(ovulationFor(f.cycles[0], t).day, 15, "the rise is still day 15, not the fever on day 9");
});

test("LH: a positive ovulation test within 2 days of the rise makes the confidence 'clear'", () => {
  const s = reg.cycles[0].start;
  const days = [...reg.days, { date: addDays(s, 13), sym: {}, opk: "pos" }];
  assert.deepEqual(lhPositiveDays(days), [addDays(s, 13)]);
  assert.equal(ovulationFor(reg.cycles[0], temps(reg), { opk: lhPositiveDays(days) }).confidence, "clear");
  assert.equal(ovulationFor(reg.cycles[0], temps(reg), { opk: [addDays(s, 9)] }).confidence, "possible", "5 days before: not within the window");
  assert.equal(ovulationFor(reg.cycles[0], temps(reg), { opk: [addDays(s, 16)] }).confidence, "clear", "2 days after still counts");
});

test("phases: from the cycle starts and the detected rise; textbook luteal without one", () => {
  const ovs = cycleOvulations(reg.cycles, temps(reg));
  const s = reg.cycles[0].start;
  assert.equal(phaseOf(addDays(s, 0), reg.cycles, ovs), "menstrual");
  assert.equal(phaseOf(addDays(s, 4), reg.cycles, ovs), "menstrual");
  assert.equal(phaseOf(addDays(s, 5), reg.cycles, ovs), "follicular");
  assert.equal(phaseOf(addDays(s, 11), reg.cycles, ovs), "follicular");
  assert.equal(phaseOf(addDays(s, 12), reg.cycles, ovs), "ovulatory", "rise day 15 − 2 = day 13");
  assert.equal(phaseOf(addDays(s, 15), reg.cycles, ovs), "ovulatory", "day 16 = rise + 1");
  assert.equal(phaseOf(addDays(s, 16), reg.cycles, ovs), "luteal");
  assert.equal(phaseOf(addDays(s, -1), reg.cycles, ovs), null);
  const an = FIXTURES.anovulatory();
  assert.equal(phaseOf(addDays(an.cycles[0].start, 10), an.cycles, {}), "follicular");
  assert.equal(phaseOf(addDays(an.cycles[0].start, 20), an.cycles, {}), "luteal", "the last 14 days of a finished cycle");
  assert.deepEqual(cycleOf(reg.cycles, addDays(s, 30)), { start: reg.cycles[1].start, next: reg.cycles[2].start, length: 28 });
});

test("baselines: overall and by phase, from valid nights only; words need 7 nights and ±1 SD", () => {
  const nightly = buildNightly(reg.rows);
  const ovs = cycleOvulations(reg.cycles, nightly.temp);
  const b = baselines(nightly, reg.cycles, ovs);
  assert.equal(b.temp.overall.n, 84);
  assert.ok(b.temp.byPhase.luteal.mean > b.temp.byPhase.follicular.mean + 0.25, "luteal temperature runs higher");
  assert.ok(b.hrv.byPhase.luteal.mean < b.hrv.byPhase.follicular.mean, "luteal HRV runs lower");
  assert.ok(b.rhr.byPhase.luteal.mean > b.rhr.byPhase.follicular.mean, "luteal resting HR runs higher");
  assert.equal(b.temp.byPhase.menstrual.n, 15);
  const bucket = { mean: 45, sd: 4, n: 10 };
  assert.equal(wordFor(45, bucket), "usual"); assert.equal(wordFor(49, bucket), "usual"); assert.equal(wordFor(49.5, bucket), "higher"); assert.equal(wordFor(40, bucket), "lower");
  assert.equal(wordFor(45, { mean: 45, sd: 4, n: 6 }), null, "fewer than 7 nights say nothing");
  assert.equal(wordFor(null, bucket), null);
  const skipped = baselines(buildNightly(reg.rows, { skips: { [reg.rows[0].date]: "fever" } }), reg.cycles, ovs);
  assert.equal(skipped.temp.overall.n, 83, "a skipped night is out of every baseline");
});

test("readinessWords: words only, against the phase baseline, 'lower, usual for your luteal days'", () => {
  const nightly = buildNightly(reg.rows);
  const ovs = cycleOvulations(reg.cycles, nightly.temp);
  const b = baselines(nightly, reg.cycles, ovs);
  const day = addDays(reg.cycles[2].start, 20); // luteal
  const w = readinessWords(day, nightly, b, reg.cycles, ovs);
  assert.deepEqual(w.map((x) => x.metric), ["sleep", "temp", "hrv", "rhr"]);
  assert.ok(w.every((x) => x.present && x.phase === "luteal"));
  for (const x of w) assert.ok(!/\d/.test(x.phrase), `no number in "${x.phrase}"`);
  const hrv = w.find((x) => x.metric === "hrv"), tmp = w.find((x) => x.metric === "temp");
  assert.ok(["lower, usual for your luteal days", "at your usual", "lower than usual"].includes(hrv.phrase), hrv.phrase);
  assert.ok(["higher, usual for your luteal days", "at your usual", "higher than usual"].includes(tmp.phrase), tmp.phrase);
  const few = readinessWords(reg.rows[2].date, buildNightly(reg.rows.slice(0, 5)), baselines(buildNightly(reg.rows.slice(0, 5)), reg.cycles, {}), reg.cycles, {});
  assert.ok(few.every((x) => x.phrase === FEW_NIGHTS), "under 7 nights: a few more nights");
  const none = readinessWords("2020-01-01", nightly, b, reg.cycles, ovs);
  assert.ok(none.every((x) => !x.present && x.phrase === "no reading"));
  const sk = readinessWords(day, buildNightly(reg.rows, { skips: { [day]: "travel" } }), b, reg.cycles, ovs);
  assert.ok(sk.every((x) => x.phrase === "left out" && x.note === "Skipped: travel"));
  const two = FIXTURES.twoSources();
  const tw = readinessWords(two.rows[20].date, buildNightly(two.rows), baselines(buildNightly(two.rows), two.cycles, {}), two.cycles, {});
  assert.deepEqual(tw.find((x) => x.metric === "temp").also, ["oura"], "the other source shows as also from");
});

test("cycleTable: newest first, at most 12, length · bleeding days · rise · luteal; a running cycle has no length", () => {
  const f = syntheticLog({ n: 14, running: true });
  const rows = cycleTable(cyclesFrom(f.days), temps(f), f.days);
  assert.equal(rows.length, 12);
  assert.ok(rows[0].start > rows[1].start, "newest first");
  assert.equal(rows[0].running, true); assert.equal(rows[0].length, null);
  assert.equal(rows[1].length, 28); assert.equal(rows[1].bleeding, 4); assert.equal(rows[1].riseText, "seen, day 15"); assert.equal(rows[1].luteal, 14);
  const an = FIXTURES.anovulatory();
  assert.equal(cycleTable(an.cycles, temps(an), an.days)[0].riseText, "no sustained rise");
  assert.equal(cycleTable(reg.cycles, [], reg.days)[0].riseText, "not enough nights");
  const lh = cycleTable(reg.cycles, temps(reg), reg.days, { opk: [addDays(reg.cycles[0].start, 13)] });
  assert.equal(lh[2].riseText, "seen, day 15 (LH)");
  assert.equal(bleedingDays(reg.days, reg.cycles[0]), 4);
});

test("review sentence: the rise, and HRV lower in the 5 days before only when at least 3 of them read lower", () => {
  const nightly = buildNightly(reg.rows);
  const ovs = cycleOvulations(reg.cycles, nightly.temp);
  const b = baselines(nightly, reg.cycles, ovs);
  const ov = ovs[reg.cycles[2].start];
  const hb = hrvBeforeRise(ov, nightly, b);
  assert.equal(hb.n, 5);
  assert.equal(reviewSentence(ov, { n: 5, lower: 3 }), "Temperature rose on day 15; HRV was lower in the 5 days before.");
  assert.equal(reviewSentence(ov, { n: 5, lower: 2 }), "Temperature rose on day 15.");
  assert.equal(reviewSentence({ status: "no-rise-seen" }, hb), null);
  assert.equal(reviewSentence(null), null);
  assert.deepEqual(hrvBeforeRise({ status: "no-rise-seen" }, nightly, b), { n: 0, lower: 0 });
});

test("latestNight and demo rows: the card's night; the demo adapter is deterministic and marked demo", () => {
  const nightly = buildNightly(reg.rows);
  assert.equal(latestNight(nightly, "2030-01-01"), reg.rows[reg.rows.length - 1].date);
  assert.equal(latestNight(nightly, "2000-01-01"), null);
  const a = demoRows({ fromIso: "2026-08-07", toIso: "2026-11-04" }), b = demoRows({ fromIso: "2026-08-07", toIso: "2026-11-04" });
  assert.deepEqual(a, b);
  assert.equal(a.length, 90); assert.ok(a.every((r) => r.demo === true && r.sourceId === "healthkit"));
  const starts = demoStarts({ toIso: "2026-11-04" });
  assert.equal(starts[starts.length - 1], addDays("2026-11-04", -19));
  const ovs = cycleOvulations(starts.map((s, i) => ({ start: s, next: starts[i + 1] || null })), nightlyTemps(a));
  assert.ok(Object.values(ovs).some((o) => o.status === "rise-seen" && o.day === 15), "the demo cycles show a rise on day 15");
  assert.equal(demoRows({ fromIso: "2026-10-06", toIso: "2026-11-04", stage: "preg" }).length, 30);
  assert.deepEqual(demoStarts({ toIso: "2026-11-04", stage: "preg" }), []);
});

test("wording: guidance only — never 'confirmed', never contraception as anything but 'not'", () => {
  const texts = [...Object.values(SIGNAL_COPY), riseDetail({ status: "rise-seen", day: 31, confidence: "clear" }), riseWords({ status: "rise-seen", day: 31 })];
  for (const t of texts) {
    assert.ok(!FERT_BANNED.test(t), `banned words in: ${t}`);
    assert.ok(contraOk(t) || /not a contraceptive/.test(t), `contraception in: ${t}`);
    assert.ok(!/\bconfirmed\b|\bscore\b|\/100|out of 100/i.test(t), `no confirmation or score in: ${t}`);
  }
  assert.match(SIGNAL_COPY.riseDetail, /consistent with ovulation/);
  assert.match(SIGNAL_COPY.riseDetail, /not a confirmation/);
});
