// Terra webhook payload (daily / sleep / body events) → Cyra per-day rows.
// Terra normalizes dozens of wearables into one schema; field paths below follow
// the Terra v2 data models (heart_rate_data.summary, temperature_data,
// sleep_durations_data). Unknown shapes simply produce no row.
// Temperature comes only from a Sleep payload's temperature_data.delta (deviation from
// the person's baseline, like Oura's temperature_deviation). Body payloads carry absolute
// °C samples, which are not deltas, so they are left out. A night of sleep is filed under
// the day it ends (the wake day, as Oura, Apple Health and Health Connect do); daily and
// body payloads under the day they start. Naps are skipped, so a nap can't overwrite the
// night's values.
export function normalize(body) {
  const rows = new Map();
  const row = (day) => { if (!rows.has(day)) rows.set(day, { date: day, temp: null, rhr: null, hrv: null, sleep: null }); return rows.get(day); };
  const isSleep = body?.type === "sleep";
  for (const d of body?.data || []) {
    const m = d?.metadata || {};
    if (isSleep && m.is_nap === true) continue;
    // Slicing the ISO string keeps Terra's local-offset date (no conversion to UTC).
    const day = String((isSleep ? m.end_time || m.start_time : m.start_time || m.end_time) || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
    const r = row(day);
    const hr = d.heart_rate_data?.summary || d.heart_rate_data || {};
    if (hr.resting_hr_bpm != null) r.rhr = Math.round(hr.resting_hr_bpm);
    if (hr.avg_hrv_rmssd != null) r.hrv = Math.round(hr.avg_hrv_rmssd);
    const t = d.temperature_data || {};
    if (typeof t.delta === "number" && Number.isFinite(t.delta)) r.temp = +t.delta.toFixed(2);
    const sl = d.sleep_durations_data || {};
    if (sl.sleep_efficiency != null) r.sleep = Math.round(sl.sleep_efficiency <= 1 ? sl.sleep_efficiency * 100 : sl.sleep_efficiency);
    else if ((d.scores?.sleep_score ?? d.scores?.sleep) != null) r.sleep = Math.round(d.scores.sleep_score ?? d.scores.sleep);
  }
  return [...rows.values()].filter((r) => r.temp != null || r.rhr != null || r.hrv != null || r.sleep != null).sort((a, b) => a.date.localeCompare(b.date));
}
