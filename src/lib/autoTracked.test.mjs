// Passive tracking S2: the signals bundle and the Home card's model (lib/autoTracked.js). Run: npm run test:unit
import test from "node:test";
import assert from "node:assert/strict";
import { signalsFor, autoCardModel, skipLabel, CONFIRM_BODY } from "./autoTracked.js";
import { FIXTURES, demoRows } from "./signalsFixtures.js";
import { FERT_BANNED, contraOk } from "./fertility.js";
import { addDays } from "./engine.js";

const reg = FIXTURES.regular28();
const today = reg.nextStart; // the day after the third cycle: a fourth cycle starts today
const NOW = Date.parse(`${today}T08:00:00`);
const sources = { healthkit: { connectedAt: NOW - 86400000 * 30, lastSync: NOW - 3600000 } };

test("signalsFor: cycles, nightly words, a marker per cycle, the table and the review sentence", () => {
  const s = signalsFor({ rows: reg.rows, sources, skips: {}, days: reg.days });
  assert.equal(s.cycles.length, 4, "three finished cycles and the running one");
  assert.ok(s.hasTemps);
  assert.deepEqual(reg.cycles.map((c) => s.marks[c.start].text), ["Temperature rise seen · day 15", "Temperature rise seen · day 15", "Temperature rise seen · day 15"]);
  assert.deepEqual(reg.cycles.map((c) => s.marks[c.start].luteal), [14, 14, 14]);
  assert.equal(s.marks[today].text, "Not enough nights", "the running cycle has no nights yet");
  assert.equal(s.table.length, 4);
  assert.equal(s.table[0].start, today, "newest first");
  assert.equal(s.table[1].riseText, "seen, day 15");
  assert.match(s.review, /^Temperature rose on day 15/);
  assert.equal(s.skipped.n, 0);
  for (const m of Object.values(s.marks)) { assert.ok(!FERT_BANNED.test(m.text) && !FERT_BANNED.test(m.detail), m.text); assert.ok(contraOk(m.text)); }
});

test("signalsFor: skipped nights are left out; demo rows count only when asked; no temps → no marks", () => {
  const sk = FIXTURES.withSkips();
  const s = signalsFor({ rows: sk.rows, sources, skips: sk.skips, days: sk.days });
  assert.equal(s.skipped.n, 4);
  assert.match(s.skipped.text, /4 \(fever or illness 3, travel 1\)/);
  const demo = reg.rows.map((r) => ({ ...r, demo: true }));
  assert.equal(signalsFor({ rows: demo, sources, days: reg.days }).hasTemps, false, "demo rows are not real nights");
  assert.equal(signalsFor({ rows: demo, sources, days: reg.days, demo: true }).hasTemps, true, "unless the build is a demo build");
  const noTemps = reg.rows.map(({ temp: _t, ...r }) => r);
  const n = signalsFor({ rows: noTemps, sources, days: reg.days });
  assert.equal(n.hasTemps, false); assert.equal(n.marks, null); assert.deepEqual(n.table, []); assert.equal(n.review, null);
});

test("autoCardModel: a recently synced source and a fresh night make the card; otherwise null or 'no readings since'", () => {
  const s = signalsFor({ rows: reg.rows, sources, days: reg.days });
  const m = autoCardModel({ signals: s, rows: reg.rows, sources, skips: {}, confirmations: {}, todayIso: today, nowMs: NOW, platform: "ios" });
  assert.ok(m);
  assert.equal(m.sourceId, "healthkit"); assert.equal(m.sourceName, "Apple Watch · Health app"); assert.equal(m.onDevice, true);
  assert.equal(m.day, addDays(today, -1), "the last night is yesterday's wake day");
  assert.equal(m.fresh, true);
  assert.deepEqual(m.rows.map((r) => r.metric), ["sleep", "temp", "hrv", "rhr"]);
  for (const r of m.rows) assert.ok(/^(at your usual|lower than usual|higher than usual|lower, usual for your [a-z]+ days|higher, usual for your [a-z]+ days|a few more nights will show your usual|no reading|left out)$/.test(r.phrase), r.phrase);
  assert.equal(m.confirmed, false); assert.equal(m.skipped, null); assert.equal(m.demo, false); assert.equal(m.platform, "ios");
  // no sync in 36 h → no card (unless demo)
  const stale = { healthkit: { connectedAt: NOW - 86400000 * 30, lastSync: NOW - 40 * 3600000 } };
  assert.equal(autoCardModel({ signals: s, rows: reg.rows, sources: stale, todayIso: today, nowMs: NOW }), null);
  // a sync, but the last night is older than yesterday → the "no readings since" state
  const later = addDays(today, 5);
  const old = autoCardModel({ signals: s, rows: reg.rows, sources, todayIso: later, nowMs: NOW });
  assert.equal(old.fresh, false); assert.deepEqual(old.rows, []); assert.equal(old.day, addDays(today, -1));
  // her taps show on the model
  const done = autoCardModel({ signals: s, rows: reg.rows, sources, skips: { [m.day]: "alcohol" }, confirmations: { [m.day]: { at: "2026-10-05T08:00:00Z", via: "app" } }, todayIso: today, nowMs: NOW });
  assert.equal(done.confirmed, true); assert.equal(done.skipped, "alcohol");
  assert.equal(skipLabel("alcohol"), "Alcohol"); assert.equal(skipLabel("nope"), "Other");
  assert.equal(CONFIRM_BODY, "Confirm today (10 s)");
});

test("autoCardModel: a demo build shows the card from demo rows without a live sync, marked demo", () => {
  const rows = demoRows({ fromIso: addDays(today, -89), toIso: today, stage: "periods", starts: reg.cycles.map((c) => c.start).concat([today]) });
  assert.ok(rows.every((r) => r.demo));
  const s = signalsFor({ rows, sources: { oura: { connectedAt: NOW, lastSync: NOW, demo: true } }, days: reg.days, demo: true });
  const m = autoCardModel({ signals: s, rows, sources: { oura: { connectedAt: NOW, lastSync: NOW, demo: true } }, todayIso: today, nowMs: NOW, demo: true });
  assert.ok(m); assert.equal(m.demo, true); assert.equal(m.day, today); assert.equal(m.fresh, true);
  // the demo rows are shaped to her starts: a rise on day 15 of each finished cycle
  assert.deepEqual(reg.cycles.map((c) => s.marks[c.start].text), ["Temperature rise seen · day 15", "Temperature rise seen · day 15", "Temperature rise seen · day 15"]);
  assert.equal(signalsFor({ rows, sources: {}, days: reg.days }).hasTemps, false, "a production build never reads demo rows");
});

/* Passive tracking S3: You → Data sources. */
test("sourceRows / preferRows / howGoing: a row per offered or connected source, the picker only for contested metrics, the stats lines", async () => {
  const { sourceRows, preferRows, howGoing, METRIC_WORDS } = await import("./autoTracked.js");
  const offered = [{ id: "healthkit" }, { id: "oura" }, { id: "terra" }];
  const two = FIXTURES.twoSources();
  const sources = { healthkit: { connectedAt: NOW - 86400000, lastSync: NOW - 3600000 }, oura: { connectedAt: NOW - 86400000, paused: true }, terra: { pending: true, key: "k" } };
  const rows = sourceRows({ offered, sources, rows: two.rows, platform: "ios" });
  assert.deepEqual(rows.map((r) => [r.id, r.status, r.onDevice, r.viaServer, r.nights]), [["healthkit", "connected", true, false, 28], ["oura", "paused", false, true, 28], ["terra", "pending", false, true, 0]]);
  assert.equal(rows[0].name, "Apple Watch · Health app"); assert.match(rows[0].where, /^This phone only/); assert.match(rows[1].where, /^Through Solia Health's server/);
  assert.equal(rows[0].lastSync, NOW - 3600000); assert.equal(rows[1].lastSync, NOW - 86400000, "connectedAt stands in for a source that never synced again");
  // a source the record holds but this build no longer offers still gets a row (so it can be disconnected), marked not offered
  const legacy = sourceRows({ offered: [{ id: "healthkit" }], sources: { oura: { connectedAt: NOW } }, rows: [], platform: "web" });
  assert.deepEqual(legacy.map((r) => [r.id, r.status, r.offered]), [["healthkit", "off", true], ["oura", "connected", false]]);
  assert.deepEqual(sourceRows({ offered: [], sources: {}, rows: [] }), []);
  // the picker: every metric both sources read, with her choice
  const pr = preferRows({ sources: { ...sources, oura: { ...sources.oura, prefer: ["temp"] } }, rows: two.rows });
  assert.deepEqual(pr.map((p) => [p.metric, p.label, p.options, p.chosen]), [["temp", "Temperature", ["healthkit", "oura"], "oura"], ["rhr", "Resting HR", ["healthkit", "oura"], null], ["hrv", "HRV", ["healthkit", "oura"], null], ["sleep", "Sleep", ["healthkit", "oura"], null]]);
  assert.deepEqual(preferRows({ sources, rows: reg.rows }), [], "one source: nothing to pick");
  assert.deepEqual(METRIC_WORDS, { temp: "Temperature", rhr: "Resting HR", hrv: "HRV", sleep: "Sleep" });
  const g = howGoing({ confirmed: 3, fast: 2, tooks: [4000, 9000, 20000], sourceSince: "2026-10-01", firstConfirm: "2026-10-02" }, "2026-10-31");
  assert.equal(g.kept, "Kept on this device, never sent.");
  assert.deepEqual(g.lines, ["3 nights confirmed with Looks right since 2026-10-02.", "Typically 9 seconds from the card appearing to the tap (67% under 15 seconds).", "A source has been connected since 2026-10-01 (30 days)."]);
});
