// Terra webhook payload (daily / sleep / body events) → Cyra per-day rows.
// Terra normalizes dozens of wearables into one schema; field paths below follow
// the Terra v2 data models (heart_rate_data.summary, temperature_data,
// sleep_durations_data). Unknown shapes simply produce no row.
export function normalize(body) {
  const rows = new Map();
  const row = (day) => { if (!rows.has(day)) rows.set(day, { date: day, temp: null, rhr: null, hrv: null, sleep: null }); return rows.get(day); };
  for (const d of body?.data || []) {
    const day = String(d?.metadata?.start_time || d?.metadata?.end_time || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
    const r = row(day);
    const hr = d.heart_rate_data?.summary || d.heart_rate_data || {};
    if (hr.resting_hr_bpm != null) r.rhr = Math.round(hr.resting_hr_bpm);
    if (hr.avg_hrv_rmssd != null) r.hrv = Math.round(hr.avg_hrv_rmssd);
    const t = d.temperature_data || {};
    if (t.body_temperature_delta != null) r.temp = +(+t.body_temperature_delta).toFixed(2);
    else if (t.skin_temperature_delta != null) r.temp = +(+t.skin_temperature_delta).toFixed(2);
    const sl = d.sleep_durations_data || {};
    if (sl.sleep_efficiency != null) r.sleep = Math.round(sl.sleep_efficiency <= 1 ? sl.sleep_efficiency * 100 : sl.sleep_efficiency);
    else if (d.scores?.sleep != null) r.sleep = Math.round(d.scores.sleep);
  }
  return [...rows.values()].filter((r) => r.temp != null || r.rhr != null || r.hrv != null || r.sleep != null).sort((a, b) => a.date.localeCompare(b.date));
}
