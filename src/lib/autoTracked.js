/* The "Today's auto-tracked" card's model and the per-render signals bundle (passive tracking S2, plan §2.1, §2.2,
   §2.5). Pure: no React, no storage, no network, no Date.now (the caller passes nowMs and todayIso); it composes
   lib/signals.js and lib/sources.js over the record, so App.jsx and the unit tests build the same model.
   Nothing here is saved or sent; App.jsx writes her taps (confirmations, nightSkips, trackStats) itself. */
import { daysBetween } from "./engine.js";
import { cyclesFrom } from "./record.js";
import { buildNightly, baselines, cycleOvulations, readinessWords, lhPositiveDays, riseWords, riseDetail, validNights, RECENT_HOURS, SKIP_REASONS, hrvBeforeRise, reviewSentence, cycleTable, skippedSummary } from "./signals.js";
import { preferredSources, syncedRecently, latestRow, sourceMeta, isConfirmed, contestedMetrics, statsView, STATS_KEPT_LINE } from "./sources.js";

/** The reminder body while a source synced in the last 36 h (plan §2.5): the daily promise becomes "confirm in 10 s". */
export const CONFIRM_BODY = "Confirm today (10 s)";

/**
 * Everything the screens read from the wearable nights, computed once per render: { cycles, nightly, base, ovulations,
 * hasTemps, marks: { [start]: { text, detail, luteal, status } } | null, table, skipped, review }.
 * rows: wearData (demo rows included only when `demo`); sources: wearSources; skips: nightSkips; days: her day entries.
 */
export function signalsFor({ rows = [], sources = {}, skips = {}, days = [], demo = false } = {}) {
  const use = (Array.isArray(rows) ? rows : []).filter((r) => r && (demo || !r.demo));
  const cycles = cyclesFrom(days);
  const nightly = buildNightly(use, { prefer: preferredSources(sources), skips });
  const opk = lhPositiveDays(days);
  const ovulations = cycleOvulations(cycles, nightly.temp, { opk });
  const base = baselines(nightly, cycles, ovulations);
  const hasTemps = validNights(nightly.temp).length > 0;
  const marks = hasTemps ? Object.fromEntries(Object.entries(ovulations).map(([start, ov]) => [start, { text: riseWords(ov), detail: riseDetail(ov), luteal: ov.lutealDays, status: ov.status }])) : null;
  const table = hasTemps ? cycleTable(cycles, nightly.temp, days, { opk }) : [];
  const skipped = skippedSummary(skips);
  // The weekly review's sentence (plan §7): the most recent cycle with a rise, with HRV in the five nights before it.
  let review = null;
  for (const c of [...cycles].sort((a, b) => b.start.localeCompare(a.start))) {
    const ov = ovulations[c.start];
    if (ov && ov.status === "rise-seen") { review = reviewSentence(ov, hrvBeforeRise(ov, nightly, base)); break; }
  }
  return { cycles, nightly, base, ovulations, hasTemps, marks, table, skipped, review };
}

/** The reason label for a nightSkips value. */
export const skipLabel = (id) => (SKIP_REASONS.find(([k]) => k === id) || [null, "Other"])[1];

/**
 * The Home card's model, or null when there is nothing to show: a non-demo source synced in the last RECENT_HOURS hours
 * (or any rows in a demo build), and a night to talk about. platform: "ios" | "android" | "web".
 * { sourceId, sourceName, onDevice, syncedAt (ms | null), day (the night's wake day), fresh (that night is yesterday's or
 *   today's), rows: readinessWords(), confirmed, skipped (reason | null), demo, platform }
 */
export function autoCardModel({ signals, rows = [], sources = {}, skips = {}, confirmations = {}, todayIso, nowMs, demo = false, platform = "web", hours = RECENT_HOURS } = {}) {
  if (!signals || !todayIso) return null;
  const liveId = syncedRecently(sources, nowMs, { hours, demo });
  const night = latestRow(rows, todayIso, { demo });
  if (!night || (!liveId && !demo)) return null;
  const sourceId = liveId || night.sourceId || "healthkit";
  const meta = sourceMeta(sourceId, platform);
  const st = (sources && sources[sourceId]) || {};
  const syncedAt = typeof st.lastSync === "number" ? st.lastSync : typeof st.connectedAt === "number" ? st.connectedAt : null;
  const fresh = daysBetween(night.day, todayIso) <= 1;
  const words = fresh ? readinessWords(night.day, signals.nightly, signals.base, signals.cycles, signals.ovulations) : [];
  const isDemo = demo && rows.some((r) => r && r.date === night.day && r.demo);
  return { sourceId, sourceName: meta.name, onDevice: !!meta.onDevice, syncedAt, day: night.day, fresh, rows: words, confirmed: isConfirmed(confirmations, night.day), skipped: skips && typeof skips[night.day] === "string" ? skips[night.day] : null, demo: isDemo, platform };
}

/* ---------- You → Data sources (plan §2.4, S3) ---------- */
/** The metric labels the preferred-source picker uses. */
export const METRIC_WORDS = Object.freeze({ temp: "Temperature", rhr: "Resting HR", hrv: "HRV", sleep: "Sleep" });
/**
 * One row per source this build offers plus any connected source the record still holds:
 * { id, name, what, where, viaServer, onDevice, offered, connected, pending, paused, demo, lastSync (ms | null), nights (rows from it),
 *   status: "connected" | "paused" | "pending" | "off" }. offered: [{ id }] (lib/wearables.js SOURCES); sources: wearSources; rows: wearData.
 */
export function sourceRows({ offered = [], sources = {}, rows = [], platform = "web" } = {}) {
  const ids = [...new Set([...offered.map((s) => s.id), ...Object.keys(sources || {}).filter((id) => sources[id] && typeof sources[id] === "object")])];
  return ids.map((id) => {
    const meta = sourceMeta(id, platform);
    const st = (sources && sources[id]) || null;
    const connected = !!st && !st.pending;
    const nights = (Array.isArray(rows) ? rows : []).filter((r) => r && r.sourceId === id).length;
    const status = !st ? "off" : st.pending ? "pending" : st.paused ? "paused" : "connected";
    return { id, name: meta.name, what: meta.what, where: meta.where, viaServer: !!meta.viaServer, onDevice: !!meta.onDevice, offered: offered.some((s) => s.id === id), connected, pending: !!(st && st.pending), paused: !!(st && st.paused), demo: !!(st && st.demo), lastSync: st && typeof st.lastSync === "number" ? st.lastSync : st && typeof st.connectedAt === "number" ? st.connectedAt : null, nights, status };
  });
}
/** The preferred-source picker's rows: only metrics two connected sources both cover. [{ metric, label, options: [id], chosen: id | null }]. */
export function preferRows({ sources = {}, rows = [] } = {}) {
  const prefer = preferredSources(sources);
  return contestedMetrics(rows).map((m) => ({ metric: m, label: METRIC_WORDS[m], options: [...new Set((rows || []).filter((r) => r && r[m] != null && typeof r.sourceId === "string").map((r) => r.sourceId))].sort(), chosen: prefer[m] }));
}
/** "How this is going": statsView's lines and the one sentence that must stay literally true. */
export const howGoing = (stats, todayIso) => ({ ...statsView(stats, todayIso), kept: STATS_KEPT_LINE });
