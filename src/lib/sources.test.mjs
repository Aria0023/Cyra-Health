// Passive tracking S1: the adapter seam and the record helpers (lib/sources.js).
// Run: node --test src/lib/sources.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import {
  METRICS, SKIP_IDS, sourceMeta, makeAdapters, mergeSourceRows, dropSourceRows, recentRows, preferredSources, setPreferred, contestedMetrics, cleanSourceExtras,
  liveSources, syncedRecently, latestRow, cleanNightSkips, skipNight, unskipNight, cleanConfirmations, confirmDay, isConfirmed,
  EMPTY_STATS, FAST_MS, cleanTrackStats, noteConfirmation, noteSource, statsView, STATS_KEPT_LINE,
} from "./sources.js";
import { readFileSync } from "node:fs";

const T = "2026-11-04";

test("sourceMeta: names per platform, where each one's readings go, viaServer only for Oura and Terra", () => {
  assert.equal(sourceMeta("healthkit", "ios").name, "Apple Watch · Health app");
  assert.equal(sourceMeta("healthkit", "android").name, "Health Connect");
  assert.ok(!sourceMeta("healthkit", "ios").viaServer && sourceMeta("healthkit", "ios").onDevice);
  assert.match(sourceMeta("healthkit", "android").where, /This phone only/);
  assert.ok(sourceMeta("oura").viaServer && sourceMeta("terra").viaServer && !sourceMeta("demo").viaServer);
  assert.match(sourceMeta("terra").where, /at most 7 days/);
  assert.equal(sourceMeta("future").name, "future");
});

test("makeAdapters: the seam wraps the injected sync; every row carries its sourceId; the demo adapter is deterministic", async () => {
  const calls = [];
  const sync = async (id, state) => { calls.push([id, state]); return { rows: [{ date: T, temp: 0.1, rhr: 60, hrv: 40, sleep: 80 }], state: { ...state, synced: true }, notice: id === "oura" ? "n" : null }; };
  const a = makeAdapters({ sync, platform: "ios", demo: { stage: "periods", isMeno: false } });
  assert.deepEqual(Object.keys(a), ["demo", "healthkit", "oura", "terra"]);
  for (const id of ["healthkit", "oura", "terra"]) assert.equal(typeof a[id].read, "function");
  const r = await a.oura.read({ fromIso: "2026-10-06", toIso: T, state: { tokens: {} } });
  assert.deepEqual(r.rows, [{ date: T, temp: 0.1, rhr: 60, hrv: 40, sleep: 80, sourceId: "oura" }]);
  assert.deepEqual(r.state, { tokens: {}, synced: true }); assert.equal(r.notice, "n");
  assert.deepEqual(calls, [["oura", { tokens: {} }]]);
  const d1 = await a.demo.read({ fromIso: "2026-10-06", toIso: T }), d2 = await a.demo.read({ fromIso: "2026-10-06", toIso: T });
  assert.deepEqual(d1.rows, d2.rows);
  assert.equal(d1.rows.length, 30); assert.ok(d1.rows.every((x) => x.demo && x.sourceId === "healthkit"));
  assert.deepEqual(d1.state, { connectedAt: 0, demo: true });
  const none = makeAdapters();
  assert.deepEqual(await none.healthkit.read({ state: null }), { rows: [], state: null, notice: null });
});

test("sources.js is pure: it imports only engine.js and the fixtures, never wearables.js or record.js", () => {
  const src = readFileSync(new URL("./sources.js", import.meta.url), "utf8");
  const imports = [...src.matchAll(/^import .* from "([^"]+)";/gm)].map((m) => m[1]);
  assert.deepEqual(imports.sort(), ["./engine.js", "./signalsFixtures.js"]);
  assert.ok(!/import\.meta\.env|fetch\(|localStorage|indexedDB/.test(src));
});

test("mergeSourceRows: keyed by day AND source, later fields win, a real row clears the demo mark", () => {
  const a = [{ date: T, temp: 0.1, rhr: null, hrv: null, sleep: 70, sourceId: "healthkit", demo: true }];
  const m = mergeSourceRows(a, [{ date: T, temp: 0.2, rhr: 61, sourceId: "healthkit" }, { date: T, temp: 0.3, sourceId: "oura" }, { date: "bad" }, null]);
  assert.deepEqual(m, [{ date: T, temp: 0.2, rhr: 61, hrv: null, sleep: 70, sourceId: "healthkit" }, { date: T, temp: 0.3, rhr: null, hrv: null, sleep: null, sourceId: "oura" }]);
  assert.deepEqual(dropSourceRows(m, "oura").map((r) => r.sourceId), ["healthkit"]);
  assert.equal(recentRows([{ date: "2026-08-06", temp: 1 }, { date: "2026-08-07", temp: 1 }, { date: "2026-11-05", temp: 1 }], T, 90).length, 1, "the last 90 days up to today");
});

test("preferredSources / setPreferred: one preferred source per metric, the choice kept inside wearSources", () => {
  const ws = { healthkit: { connectedAt: 1 }, oura: { connectedAt: 2 } };
  assert.deepEqual(preferredSources(ws), { temp: null, rhr: null, hrv: null, sleep: null });
  const w2 = setPreferred(ws, "temp", "oura");
  assert.deepEqual(w2.oura.prefer, ["temp"]); assert.ok(!("prefer" in w2.healthkit));
  assert.equal(preferredSources(w2).temp, "oura");
  const w3 = setPreferred(w2, "temp", "healthkit");
  assert.deepEqual(w3.healthkit.prefer, ["temp"]); assert.ok(!("prefer" in w3.oura), "the other source loses it");
  assert.equal(setPreferred(w3, "glucose", "oura"), w3, "an unknown metric changes nothing");
  assert.equal(preferredSources(setPreferred(w3, "temp", null)).temp, null, "null clears");
  assert.deepEqual(contestedMetrics([{ date: T, temp: 1, sourceId: "a" }, { date: T, temp: 2, hrv: 3, sourceId: "b" }]), ["temp"]);
  assert.deepEqual(cleanSourceExtras({ connectedAt: 1, prefer: ["temp", "temp", "x"], paused: "yes", lastSync: -3 }), { connectedAt: 1, prefer: ["temp"] });
  assert.deepEqual(cleanSourceExtras({ connectedAt: 1, paused: true, lastSync: 7 }), { connectedAt: 1, paused: true, lastSync: 7 });
  assert.equal(cleanSourceExtras(null), null);
});

test("liveSources / syncedRecently / latestRow: what counts as connected and as synced in the last 36 h", () => {
  const now = Date.parse("2026-11-04T09:00:00Z");
  const h = (k) => now - k * 3600000;
  const ws = { healthkit: { connectedAt: h(100), lastSync: h(10) }, oura: { connectedAt: h(5), pending: true }, terra: { connectedAt: h(2), paused: true }, demo: { connectedAt: h(1), demo: true } };
  assert.deepEqual(liveSources(ws), ["healthkit"]);
  assert.deepEqual(liveSources(ws, { demo: true }), ["demo", "healthkit"]);
  assert.equal(syncedRecently(ws, now), "healthkit");
  assert.equal(syncedRecently({ healthkit: { connectedAt: h(100), lastSync: h(37) } }, now), null, "37 h ago is too old");
  assert.equal(syncedRecently({ healthkit: { connectedAt: h(30) } }, now), "healthkit", "connectedAt counts for a source that never re-synced");
  assert.equal(syncedRecently(ws, now, { demo: true }), "demo");
  assert.deepEqual(latestRow([{ date: "2026-11-03", temp: 0.1, sourceId: "healthkit" }, { date: "2026-11-04", temp: null, rhr: null, hrv: null, sleep: null, sourceId: "healthkit" }, { date: "2026-11-04", temp: 0.2, sourceId: "x", demo: true }], T), { day: "2026-11-03", sourceId: "healthkit" });
  assert.equal(latestRow([{ date: "2026-11-05", temp: 1, sourceId: "a" }], T), null, "never a day after today");
});

test("nightSkips: only real days and the four reasons; skip and unskip", () => {
  assert.deepEqual([...SKIP_IDS], ["fever", "alcohol", "travel", "other"]);
  assert.deepEqual(cleanNightSkips({ "2026-11-01": "fever", "2026-11-02": "hangover", bad: "fever", "2026-11-03": 3 }), { "2026-11-01": "fever" });
  const s = skipNight({}, "2026-11-01", "travel");
  assert.deepEqual(s, { "2026-11-01": "travel" });
  assert.deepEqual(skipNight(s, "2026-11-02", "nope"), s);
  assert.deepEqual(unskipNight(s, "2026-11-01"), {});
  const many = Object.fromEntries(Array.from({ length: 405 }, (_, i) => [`2025-${String(1 + (i % 12)).padStart(2, "0")}-${String(1 + (i % 28)).padStart(2, "0")}`, "other"]));
  assert.ok(Object.keys(cleanNightSkips(many)).length <= 400);
});

test("confirmations: { at, took?, via } per day, the first tap kept, bad entries dropped", () => {
  const at = "2026-11-04T07:12:00.000Z";
  const c = confirmDay({}, T, { at, took: 8400.6, via: "app" });
  assert.deepEqual(c, { [T]: { at, took: 8401, via: "app" } });
  assert.deepEqual(confirmDay(c, T, { at: "2026-11-04T09:00:00Z", via: "notification" }), c, "already confirmed: unchanged");
  assert.deepEqual(confirmDay(c, "2026-11-03", { at, via: "notification" }), { "2026-11-03": { at, via: "notification" }, ...c });
  assert.deepEqual(confirmDay(c, "2026-11-03", { at, via: "x" })["2026-11-03"].via, "app", "an unknown via reads as app");
  assert.deepEqual(cleanConfirmations({ [T]: { at: "no", via: "app" }, "2026-11-02": { at, via: "sms" }, "2026-11-01": { at, took: -1, via: "app" }, bad: { at, via: "app" } }), { "2026-11-01": { at, via: "app" } });
  assert.ok(isConfirmed(c, T) && !isConfirmed(c, "2026-11-03") && !isConfirmed(null, T));
});

test("trackStats: counts and timings on this device; the view speaks in nights and seconds", () => {
  assert.deepEqual(cleanTrackStats(null), { ...EMPTY_STATS, tooks: [] });
  assert.deepEqual(cleanTrackStats({ confirmed: 2, fast: 5, tooks: [100, "x", -1, 2.4], sourceSince: "2026-10-01", firstConfirm: "nope" }), { confirmed: 2, fast: 2, tooks: [100, 2], sourceSince: "2026-10-01", firstConfirm: null });
  let s = noteConfirmation(EMPTY_STATS, { day: "2026-11-01", took: 9000 });
  s = noteConfirmation(s, { day: "2026-11-02", took: 21000 });
  s = noteConfirmation(s, { day: "2026-11-03", took: null });
  assert.deepEqual(s, { confirmed: 3, fast: 1, tooks: [9000, 21000], sourceSince: null, firstConfirm: "2026-11-01" });
  assert.equal(FAST_MS, 15000);
  s = noteSource(s, "2026-10-20"); s = noteSource(s, "2026-10-25");
  assert.equal(s.sourceSince, "2026-10-20", "the first connection day is kept");
  assert.equal(noteSource(s, null).sourceSince, null);
  const v = statsView(s, T);
  assert.deepEqual([v.confirmed, v.medianSec, v.fastShare, v.sourceSince], [3, 15, 1 / 3, "2026-10-20"]);
  assert.equal(v.lines[0], "3 nights confirmed with Looks right since 2026-11-01.");
  assert.equal(v.lines[1], "Typically 15 seconds from the card appearing to the tap (33% under 15 seconds).");
  assert.equal(v.lines[2], "A source has been connected since 2026-10-20 (15 days).");
  assert.deepEqual(statsView(EMPTY_STATS, T).lines, ["No night confirmed yet.", "No timing yet.", "No source connected on this device yet."]);
  assert.equal(STATS_KEPT_LINE, "Kept on this device, never sent.");
  const tooks = Array.from({ length: 250 }, (_, i) => i);
  assert.equal(cleanTrackStats({ confirmed: 250, fast: 0, tooks }).tooks.length, 200);
  assert.deepEqual([...METRICS], ["temp", "rhr", "hrv", "sleep"]);
});
