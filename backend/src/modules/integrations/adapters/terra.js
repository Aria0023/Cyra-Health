// Terra-style aggregator payload: one adapter covers every wearable Terra supports.
export function normalize(body, source) {
  const out = [];
  const u = body.reference_id; // Terra echoes back your opaque userRef
  (body.data || []).forEach((d) => {
    const day = (d.metadata?.start_time || "").slice(0, 10);
    if (d.temperature_data?.body_temperature_delta != null)
      out.push({ userRef: u, date: day, type: "temp_deviation", value: d.temperature_data.body_temperature_delta });
    if (d.heart_rate_data?.avg_hrv_rmssd != null)
      out.push({ userRef: u, date: day, type: "hrv", value: d.heart_rate_data.avg_hrv_rmssd });
    if (d.sleep_durations_data?.sleep_efficiency != null)
      out.push({ userRef: u, date: day, type: "sleep_score", value: Math.round(d.sleep_durations_data.sleep_efficiency * 100) });
  });
  return out.filter((m) => m.userRef && m.date && m.value != null);
}
