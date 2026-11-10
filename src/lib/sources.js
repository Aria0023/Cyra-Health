/* Sources (passive tracking S1, plan §1.1, §1.4, §2.4): the one adapter seam every reading comes through, and the
   small record keys around it. Pure: no React, no storage, no network, no Date.now; it imports engine.js and
   signalsFixtures.js only (never wearables.js, which reads build-time env at load, and never record.js, which imports this
   file for its clean functions).

   The seam: an adapter is { id, name, viaServer, onDevice, read({ fromIso, toIso, state }) → { rows: WearRow[], state } }.
   makeAdapters({ sync, platform, demo }) builds the four this build has — demo (the deterministic fixtures), healthkit
   (the phone's CyraHealth plugin), oura and terra (through Solia Health's server) — around the `sync(id, state)`
   function App.jsx passes (lib/wearables.js syncSource); a future source adds one entry here and nothing elsewhere.
   Every adapter yields the same row: { date, temp (°C deviation), rhr, hrv, sleep, sourceId }.

   Record keys (record.js PERSISTED; docs/ARCHITECTURE.md §4):
   - nightSkips  { [day]: "fever" | "alcohol" | "travel" | "other" } — "Skip this night"; record, in backups.
   - confirmations { [day]: { at: iso, took?: ms, via: "app" | "notification" } } — "Looks right"; record, in backups.
   - trackStats  { confirmed, fast, tooks: [ms…], sourceSince, firstConfirm } — the spike's numbers (plan §8); device-only,
                 NEVER in any backup, never sent. "Kept on this device, never sent."
   - wearSources[id].prefer: string[] — the metrics this source is the preferred one for (plan §1.6 rule 3);
     wearSources[id].paused: true — a paused source is not synced; wearSources[id].lastSync: ms — its last good sync. */
import { addDays, localDay } from "./engine.js";
import { demoRows } from "./signalsFixtures.js";

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
export const METRICS = Object.freeze(["temp", "rhr", "hrv", "sleep"]);
export const SKIP_IDS = Object.freeze(["fever", "alcohol", "travel", "other"]);
export const VIA = Object.freeze(["app", "notification"]);

/* ---------- source metadata ---------- */
/** What each source is called and reads, by platform ("ios" | "android" | "web"). onDevice sources never touch a server. */
export function sourceMeta(id, platform = "web") {
  if (id === "healthkit") {
    return platform === "android"
      ? { id, name: "Health Connect", what: "skin temperature, resting heart rate, HRV, sleep · read on this phone", viaServer: false, onDevice: true, where: "This phone only. Read by the Solia Health app from Health Connect; never sent anywhere." }
      : { id, name: "Apple Watch · Health app", what: "wrist temperature, resting heart rate, HRV, sleep · read on this phone", viaServer: false, onDevice: true, where: "This phone only. Read by the Solia Health app from the Health app; never sent anywhere." };
  }
  if (id === "oura") return { id, name: "Oura Ring", what: "temperature, resting heart rate, HRV, sleep score · passes through Solia Health's server, readings not stored", viaServer: true, onDevice: false, where: "Through Solia Health's server: each sync it fetches your readings from Oura and passes them to this device without keeping them." };
  if (id === "terra") return { id, name: "Fitbit · Garmin · Whoop", what: "through Terra, a health-data service · waits on Solia Health's server up to 7 days", viaServer: true, onDevice: false, where: "Through Solia Health's server: Terra sends your daily readings there, where they wait in memory (at most 7 days) until this device collects them." };
  if (id === "demo") return { id, name: "Demo readings", what: "illustrative readings shaped to your stage · not a device", viaServer: false, onDevice: true, where: "Nowhere: made up on this device for the demo build." };
  return { id, name: id, what: "", viaServer: false, onDevice: true, where: "This device." };
}

/* ---------- the adapter seam ---------- */
/**
 * The adapters this build can offer. sync(id, state) → Promise<{ rows, state, notice? }> is lib/wearables.js
 * syncSource (injected, so this file stays pure and testable); platform picks the on-phone source's name; demo
 * ({ stage, isMeno }) makes the demo adapter shape its readings to her stage. Each adapter's read() resolves
 * { rows, state, notice? } with every row carrying sourceId (the demo rows also demo: true).
 */
export function makeAdapters({ sync = async (id, state) => ({ rows: [], state }), platform = "web", demo = { stage: "periods", isMeno: false } } = {}) {
  const wrap = (id) => ({ ...sourceMeta(id, platform), read: async ({ state = null } = {}) => { const r = await sync(id, state); return { rows: (r?.rows || []).map((x) => ({ ...x, sourceId: id })), state: r?.state ?? state, notice: r?.notice ?? null }; } });
  return {
    demo: { ...sourceMeta("demo", platform), read: async ({ fromIso, toIso, state = null, sourceId = "healthkit", starts = null } = {}) => ({ rows: demoRows({ fromIso, toIso, sourceId, stage: demo?.stage || "periods", isMeno: !!demo?.isMeno, starts }), state: state || { connectedAt: 0, demo: true } }) },
    healthkit: wrap("healthkit"),
    oura: wrap("oura"),
    terra: wrap("terra"),
  };
}
/** Merge per-day rows; later rows win field by field, per source (a second source for the same day keeps its own row).
    A real reading clears the demo mark. The same shape lib/wearables.js mergeRows kept, now keyed by day AND source. */
export function mergeSourceRows(existing, incoming) {
  const key = (r) => `${r.date}|${r.sourceId || ""}`;
  const by = new Map((Array.isArray(existing) ? existing : []).filter(isObj).map((r) => [key(r), { ...r }]));
  for (const r of Array.isArray(incoming) ? incoming : []) {
    if (!isObj(r) || !ISO.test(String(r.date))) continue;
    const cur = by.get(key(r)) || { date: r.date, temp: null, rhr: null, hrv: null, sleep: null, sourceId: r.sourceId };
    for (const k of METRICS) if (r[k] != null) cur[k] = r[k];
    cur.sourceId = r.sourceId || cur.sourceId;
    if (r.demo) cur.demo = true; else delete cur.demo;
    by.set(key(r), cur);
  }
  return [...by.values()].sort((a, b) => a.date.localeCompare(b.date) || String(a.sourceId).localeCompare(String(b.sourceId)));
}
/** The rows without a source's (Disconnect with "Delete readings too"). */
export const dropSourceRows = (rows, id) => (Array.isArray(rows) ? rows : []).filter((r) => !(isObj(r) && r.sourceId === id));
/** Rows from the last `days` days up to `todayIso` (the window a sync asks for and the card reads). */
export const recentRows = (rows, todayIso, days = 90) => { const from = addDays(todayIso, -(days - 1)); return (Array.isArray(rows) ? rows : []).filter((r) => isObj(r) && typeof r.date === "string" && r.date >= from && r.date <= todayIso); };

/* ---------- wearSources: preferred source, pause, last sync ---------- */
/** { [metric]: sourceId | null } from wearSources[id].prefer (the first source naming a metric wins). */
export function preferredSources(wearSources) {
  const out = Object.fromEntries(METRICS.map((m) => [m, null]));
  for (const [id, st] of Object.entries(isObj(wearSources) ? wearSources : {}).sort(([a], [b]) => a.localeCompare(b))) {
    if (!isObj(st) || !Array.isArray(st.prefer)) continue;
    for (const m of st.prefer) if (METRICS.includes(m) && out[m] == null) out[m] = id;
  }
  return out;
}
/** wearSources with `id` the preferred source for `metric` (and no other source for it). A new object; null id clears. */
export function setPreferred(wearSources, metric, id) {
  if (!METRICS.includes(metric)) return wearSources;
  const out = {};
  for (const [k, st] of Object.entries(isObj(wearSources) ? wearSources : {})) {
    if (!isObj(st)) { out[k] = st; continue; }
    const prefer = (Array.isArray(st.prefer) ? st.prefer : []).filter((m) => m !== metric && METRICS.includes(m));
    if (k === id) prefer.push(metric);
    const next = { ...st };
    if (prefer.length) next.prefer = prefer; else delete next.prefer;
    out[k] = next;
  }
  return out;
}
/** Every metric that has a reading from at least two sources in the rows (the picker shows only those). */
export function contestedMetrics(rows) {
  const by = Object.fromEntries(METRICS.map((m) => [m, new Set()]));
  for (const r of Array.isArray(rows) ? rows : []) { if (!isObj(r)) continue; for (const m of METRICS) if (r[m] != null && typeof r.sourceId === "string") by[m].add(r.sourceId); }
  return METRICS.filter((m) => by[m].size >= 2);
}
/** A clean wearSources entry's extra fields: prefer (metric ids), paused (true only), lastSync (ms). Other fields untouched. */
export function cleanSourceExtras(st) {
  if (!isObj(st)) return st;
  const out = { ...st };
  const prefer = Array.isArray(st.prefer) ? [...new Set(st.prefer.filter((m) => METRICS.includes(m)))] : [];
  if (prefer.length) out.prefer = prefer; else delete out.prefer;
  if (st.paused === true) out.paused = true; else delete out.paused;
  if (typeof st.lastSync === "number" && Number.isFinite(st.lastSync) && st.lastSync > 0) out.lastSync = st.lastSync; else delete out.lastSync;
  return out;
}
/** Sources that count as connected (not pending, not paused, not demo unless `demo`). */
export const liveSources = (wearSources, { demo = false } = {}) => Object.entries(isObj(wearSources) ? wearSources : {}).filter(([, st]) => isObj(st) && !st.pending && !st.paused && (demo || !st.demo)).map(([id]) => id).sort();
/** The source that synced most recently within `hours` of `nowMs`, or null. Reads lastSync (ms); connectedAt counts as a sync for a source that never synced again. */
export function syncedRecently(wearSources, nowMs, { hours = 36, demo = false } = {}) {
  let best = null;
  for (const id of liveSources(wearSources, { demo })) {
    const st = wearSources[id];
    const t = typeof st.lastSync === "number" ? st.lastSync : typeof st.connectedAt === "number" ? st.connectedAt : 0;
    if (t > 0 && nowMs - t <= hours * 3600000 && (!best || t > best.t)) best = { id, t };
  }
  return best ? best.id : null;
}
/** The most recent night (row day) a non-demo source holds on or before todayIso, and that source: { day, sourceId } | null. */
export function latestRow(rows, todayIso, { demo = false } = {}) {
  let best = null;
  for (const r of Array.isArray(rows) ? rows : []) {
    if (!isObj(r) || typeof r.date !== "string" || r.date > todayIso || (!demo && r.demo)) continue;
    if (!METRICS.some((m) => r[m] != null)) continue;
    if (!best || r.date > best.day) best = { day: r.date, sourceId: r.sourceId || null };
  }
  return best;
}

/* ---------- nightSkips ---------- */
/** { [day]: reason } with only real days and known reasons, at most 400 (newest kept). */
export function cleanNightSkips(v) {
  const out = {};
  for (const k of Object.keys(isObj(v) ? v : {}).sort().slice(-400)) if (ISO.test(k) && SKIP_IDS.includes(v[k])) out[k] = v[k];
  return out;
}
export const skipNight = (skips, day, reason) => (SKIP_IDS.includes(reason) && ISO.test(String(day)) ? cleanNightSkips({ ...(isObj(skips) ? skips : {}), [day]: reason }) : cleanNightSkips(skips));
export const unskipNight = (skips, day) => { const out = cleanNightSkips(skips); delete out[day]; return out; };

/* ---------- confirmations ---------- */
const isoTime = (s) => typeof s === "string" && !Number.isNaN(Date.parse(s));
/** { [day]: { at, took?, via } } with only well-formed entries, at most 400 (newest kept). */
export function cleanConfirmations(v) {
  const out = {};
  for (const k of Object.keys(isObj(v) ? v : {}).sort().slice(-400)) {
    const c = v[k];
    if (!ISO.test(k) || !isObj(c) || !isoTime(c.at) || !VIA.includes(c.via)) continue;
    const e = { at: c.at };
    if (typeof c.took === "number" && Number.isFinite(c.took) && c.took >= 0) e.took = Math.round(c.took);
    e.via = c.via;
    out[k] = e;
  }
  return out;
}
/** confirmations with `day` confirmed ({ at: iso, took?: ms, via }); a day already confirmed keeps its first entry. */
export function confirmDay(confirmations, day, { at, took = null, via = "app" } = {}) {
  const cur = cleanConfirmations(confirmations);
  if (!ISO.test(String(day)) || cur[day]) return cur;
  return cleanConfirmations({ ...cur, [day]: { at, ...(took != null ? { took } : {}), via: VIA.includes(via) ? via : "app" } });
}
export const isConfirmed = (confirmations, day) => !!(isObj(confirmations) && isObj(confirmations[day]));

/* ---------- trackStats (device-only, never in backups, never sent) ---------- */
export const FAST_MS = 15000;
export const EMPTY_STATS = Object.freeze({ confirmed: 0, fast: 0, tooks: Object.freeze([]), sourceSince: null, firstConfirm: null });
const TOOKS_MAX = 200;
export function cleanTrackStats(v) {
  const o = isObj(v) ? v : {};
  const n = (x) => (Number.isInteger(x) && x >= 0 ? x : 0);
  const tooks = (Array.isArray(o.tooks) ? o.tooks : []).filter((x) => typeof x === "number" && Number.isFinite(x) && x >= 0).map(Math.round).slice(-TOOKS_MAX);
  return { confirmed: n(o.confirmed), fast: Math.min(n(o.fast), n(o.confirmed)), tooks, sourceSince: typeof o.sourceSince === "string" && ISO.test(o.sourceSince) ? o.sourceSince : null, firstConfirm: typeof o.firstConfirm === "string" && ISO.test(o.firstConfirm) ? o.firstConfirm : null };
}
/** After a "Looks right" on `day` that took `took` ms (null when unknown, e.g. from the notification). */
export function noteConfirmation(stats, { day, took = null } = {}) {
  const s = cleanTrackStats(stats);
  const fast = took != null && took < FAST_MS ? 1 : 0;
  return { ...s, confirmed: s.confirmed + 1, fast: s.fast + fast, tooks: took != null ? [...s.tooks, Math.round(took)].slice(-TOOKS_MAX) : s.tooks, firstConfirm: s.firstConfirm || (ISO.test(String(day)) ? day : null) };
}
/** The day a real source was first connected on this device (kept once; cleared when none is connected). */
export function noteSource(stats, connectedIso) {
  const s = cleanTrackStats(stats);
  if (connectedIso == null) return { ...s, sourceSince: null };
  return s.sourceSince ? s : { ...s, sourceSince: ISO.test(String(connectedIso)) ? connectedIso : s.sourceSince };
}
const median = (xs) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b), m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
/** What "How this is going" shows: { confirmed, medianSec | null, fastShare | null (0–1), sourceSince, lines: [] }. */
export function statsView(stats, todayIso = localDay()) {
  const s = cleanTrackStats(stats);
  const med = median(s.tooks);
  const medianSec = med == null ? null : Math.round(med / 100) / 10;
  const fastShare = s.confirmed ? s.fast / s.confirmed : null;
  const lines = [
    s.confirmed ? `${s.confirmed} ${s.confirmed === 1 ? "night" : "nights"} confirmed with Looks right${s.firstConfirm ? ` since ${s.firstConfirm}` : ""}.` : "No night confirmed yet.",
    medianSec != null ? `Typically ${medianSec} seconds from the card appearing to the tap${fastShare != null ? ` (${Math.round(fastShare * 100)}% under 15 seconds)` : ""}.` : "No timing yet.",
    s.sourceSince ? `A source has been connected since ${s.sourceSince}${todayIso ? ` (${Math.max(0, Math.round((Date.parse(todayIso) - Date.parse(s.sourceSince)) / 86400000))} days)` : ""}.` : "No source connected on this device yet.",
  ];
  return { confirmed: s.confirmed, medianSec, fastShare, sourceSince: s.sourceSince, lines };
}
export const STATS_KEPT_LINE = "Kept on this device, never sent.";
