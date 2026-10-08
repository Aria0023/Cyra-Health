// Oura API v2 shapes (user-OAuth'd, pushed by your sync worker or Oura webhook)
export function normalize(body, source) {
  const out = [];
  const u = body.userRef;
  (body.daily_readiness || []).forEach((d) =>
    out.push({ userRef: u, date: d.day, type: "temp_deviation", value: d.temperature_deviation })
  );
  (body.daily_sleep || []).forEach((d) => {
    out.push({ userRef: u, date: d.day, type: "sleep_score", value: d.score });
    if (d.average_hrv != null) out.push({ userRef: u, date: d.day, type: "hrv", value: d.average_hrv });
  });
  return out.filter((m) => m.value != null);
}
