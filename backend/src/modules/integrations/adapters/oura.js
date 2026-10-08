// Oura API v2 → Cyra's per-day row { date, temp (°C deviation), rhr, hrv, sleep (0-100) }.
// Sources: daily_readiness.temperature_deviation, daily_sleep.score,
// sleep.average_hrv and sleep.lowest_heart_rate (the long sleep of the night).
export function normalize({ readiness = [], dailySleep = [], sleep = [] }) {
  const byDay = new Map();
  const row = (day) => { if (!byDay.has(day)) byDay.set(day, { date: day, temp: null, rhr: null, hrv: null, sleep: null }); return byDay.get(day); };
  for (const d of readiness) if (d?.day && d.temperature_deviation != null) row(d.day).temp = +(+d.temperature_deviation).toFixed(2);
  for (const d of dailySleep) if (d?.day && d.score != null) row(d.day).sleep = Math.round(d.score);
  for (const s of sleep) {
    if (!s?.day || (s.type && s.type !== "long_sleep")) continue;
    const r = row(s.day);
    if (s.average_hrv != null) r.hrv = Math.round(s.average_hrv);
    if (s.lowest_heart_rate != null) r.rhr = Math.round(s.lowest_heart_rate);
  }
  return [...byDay.values()].filter((r) => r.temp != null || r.rhr != null || r.hrv != null || r.sleep != null).sort((a, b) => a.date.localeCompare(b.date));
}
