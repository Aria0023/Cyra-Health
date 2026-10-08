import { SYM, PSYM } from "./constants.js";

/* Deterministic demo data, cycle detection, prediction and scoring. Pure
   functions only — no React, no state, no side effects. */

export function seed() {
  let s = 42;
  const rnd = () => ((s = (s * 1664525 + 1013904223) % 4294967296), s / 4294967296);
  const days = []; let prevPoor = false, since = 12, len = 27, pl = 0;
  for (let i = 75; i >= 1; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    if (since >= len) { pl = 4; since = 0; len = 23 + Math.floor(rnd() * 15); }
    const period = pl > 0; if (pl > 0) pl--; since++;
    const poor = rnd() < 0.32;
    const sleepQ = poor ? "poor" : rnd() < 0.4 ? "fair" : "good";
    const sev = (b) => { const r = rnd(), p = prevPoor ? b + 0.26 : b; return r < p * 0.45 ? 3 : r < p ? 2 : r < p + 0.2 ? 1 : 0; };
    days.push({ date: d.toISOString().slice(0, 10), sleepQ, period, sym: { hf: sev(0.42), ns: prevPoor ? sev(0.4) : sev(0.22), fog: sev(prevPoor ? 0.5 : 0.3), mood: sev(0.3), slp: sleepQ === "poor" ? 2 + (rnd() < 0.4 ? 1 : 0) : sleepQ === "fair" ? (rnd() < 0.5 ? 1 : 0) : 0, ach: sev(0.24), crm: period ? sev(0.8) : sev(0.1), hda: sev(0.25), blo: sev(0.3), eng: sev(0.3) } });
    prevPoor = poor;
  }
  return days;
}
export function seedMetrics(sourceId, offset) {
  const out = [];
  for (let i = 14; i >= 1; i--) {
    const d = new Date(); d.setDate(d.getDate() - i - offset);
    const date = d.toISOString().slice(0, 10); const wave = Math.sin(i / 2.3);
    out.push({ date, type: "temp_deviation", value: +(0.12 + 0.18 * Math.abs(wave)).toFixed(2), sourceId });
    out.push({ date, type: "sleep_score", value: Math.round(64 - 9 * wave), sourceId });
    out.push({ date, type: "hrv", value: Math.round(34 + 6 * wave), sourceId });
  }
  return out;
}
export const loadOf = (day, ids) => Math.min(1, ids.reduce((a, k) => a + (day.sym[k] || 0), 0) / (ids.length * 2));
export function stripeColor(v, hot, calm, mid) {
  const lerp = (a, b, u) => a.map((c, i) => Math.round(c + (b[i] - c) * u));
  const c = v < 0.5 ? lerp(calm || [187, 203, 191], mid || [221, 138, 78], v * 2) : lerp(mid || [221, 138, 78], hot, (v - 0.5) * 2);
  return `rgb(${c})`;
}
export const fmt = (iso) => new Date(iso + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
export const hex2rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

export function insights(days, ids) {
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
  const last30 = sorted.slice(-30);
  const lib = { ...SYM, ...PSYM };
  const counts = ids.map((id) => ({ id, label: lib[id], days: last30.filter((d) => d.sym[id] > 0).length, strong: last30.filter((d) => d.sym[id] >= 2).length })).sort((a, b) => b.days - a.days);
  const ap = [], ao = [];
  for (let i = 1; i < sorted.length; i++) (sorted[i - 1].sleepQ === "poor" ? ap : ao).push(sorted[i]);
  const rate = (arr, id) => (arr.length ? arr.filter((d) => d.sym[id] >= 2).length / arr.length : 0);
  const hfMult = rate(ao, "hf") > 0 ? rate(ap, "hf") / rate(ao, "hf") : null;
  const pset = new Set(sorted.filter((d) => d.period).map((d) => d.date));
  const starts = [];
  pset.forEach((iso) => {
    let st = true;
    for (let k = 1; k <= 5; k++) { const p = new Date(iso + "T12:00:00"); p.setDate(p.getDate() - k); if (pset.has(p.toISOString().slice(0, 10))) st = false; }
    if (st) starts.push(iso);
  });
  starts.sort();
  const lens = [];
  for (let i = 1; i < starts.length; i++) { const g = Math.round((new Date(starts[i]) - new Date(starts[i - 1])) / 86400000); if (g >= 15 && g <= 120) lens.push(g); }
  const variability = lens.length >= 2 ? Math.max(...lens) - Math.min(...lens) : null;
  return { sorted, last30, counts, hfMult, lens: lens.slice(-6), variability, starts };
}
export function predict(ins) {
  if (!ins.starts.length) return null;
  const lastStart = new Date(ins.starts[ins.starts.length - 1] + "T12:00:00");
  const avgLen = ins.lens.length ? Math.round(ins.lens.reduce((a, b) => a + b, 0) / ins.lens.length) : 28;
  const today = new Date(); today.setHours(12, 0, 0, 0);
  const cycleDay = Math.round((today - lastStart) / 86400000) + 1;
  const nextStart = new Date(lastStart); nextStart.setDate(nextStart.getDate() + avgLen);
  const late = Math.round((today - nextStart) / 86400000);
  const ovu = new Date(nextStart); ovu.setDate(ovu.getDate() - 14);
  const fertileFrom = new Date(ovu); fertileFrom.setDate(fertileFrom.getDate() - 3);
  const fertileTo = new Date(ovu); fertileTo.setDate(fertileTo.getDate() + 1);
  const daysTo = Math.round((nextStart - today) / 86400000);
  const phase = cycleDay <= 5 ? "menstrual" : today >= fertileFrom && today <= fertileTo ? "fertile" : today < fertileFrom ? "follicular" : "luteal";
  return { cycleDay, avgLen, nextStart, daysTo, late, ovu, fertileFrom, fertileTo, phase };
}
export const inRange = (d, a, b) => d >= new Date(a.toDateString()) && d <= new Date(b.toDateString());

/* ---------- day score: 0 (rough) .. 1 (great) ---------- */
export const symBurden = (symObj, ids) => {
  const vals = ids.map((k) => symObj[k] || 0);
  return vals.length ? Math.min(1, vals.reduce((a, b) => a + b, 0) / (ids.length * 1.6)) : 0;
};
export const scoreLabel = (s) => s > 0.82 ? "A really good day" : s > 0.64 ? "A good day" : s > 0.46 ? "A mixed day" : s > 0.28 ? "A hard day" : "A rough day";
export const dayScore = (entry, ids) => {
  if (!entry) return null;
  const sc = entry.scales || {};
  return 1 - Math.min(1, symBurden(entry.sym || {}, ids) * 0.5 + ((sc.fatigue || 0) / 10) * 0.2 + ((sc.pain || 0) / 10) * 0.2 + ((10 - (sc.moodq ?? 5)) / 10) * 0.1);
};
export const sevDots = (n) => "●".repeat(n) + "○".repeat(3 - n);
