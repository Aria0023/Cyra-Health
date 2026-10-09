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
export const loadOf = (day, ids) => Math.min(1, ids.reduce((a, k) => a + (day.sym[k] || 0), 0) / (ids.length * 2));
export function stripeColor(v, hot, calm, mid) {
  const lerp = (a, b, u) => a.map((c, i) => Math.round(c + (b[i] - c) * u));
  const c = v < 0.5 ? lerp(calm || [187, 203, 191], mid || [221, 138, 78], v * 2) : lerp(mid || [221, 138, 78], hot, (v - 0.5) * 2);
  return `rgb(${c})`;
}
export const fmt = (iso) => new Date(iso + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
export const hex2rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

/* ISO date n days before `today`, the same way the app keys its days (App.jsx isoDaysAgo). */
const isoBefore = (today, n) => { const d = new Date(today); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
const cycleStarts = (sorted) => {
  const pset = new Set(sorted.filter((d) => d.period).map((d) => d.date));
  const starts = [];
  pset.forEach((iso) => {
    let st = true;
    for (let k = 1; k <= 5; k++) { const p = new Date(iso + "T12:00:00"); p.setDate(p.getDate() - k); if (pset.has(p.toISOString().slice(0, 10))) st = false; }
    if (st) starts.push(iso);
  });
  return starts.sort();
};
const cycleLens = (starts) => {
  const lens = [];
  for (let i = 1; i < starts.length; i++) { const g = Math.round((new Date(starts[i]) - new Date(starts[i - 1])) / 86400000); if (g >= 15 && g <= 120) lens.push(g); }
  return lens;
};
const hfRatio = (pairs) => {
  const ap = [], ao = [];
  for (const [prev, day] of pairs) (prev.sleepQ === "poor" ? ap : ao).push(day);
  const rate = (arr, id) => (arr.length ? arr.filter((d) => d.sym[id] >= 2).length / arr.length : 0);
  return rate(ao, "hf") > 0 ? rate(ap, "hf") / rate(ao, "hf") : null;
};

/* Counts cover the last 30 CALENDAR days (today and the 29 before), so "N of the last 30
   days" means exactly that; last30 holds the days actually logged in that window. The
   *30 values (hfMult30, lens30, variability30) use only that same window — what the
   doctor email summarizes. hfMult, lens and variability use everything logged. */
export function insights(days, ids, today = new Date()) {
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
  const from = isoBefore(today, 29);
  const last30 = sorted.filter((d) => d.date >= from);
  const lib = { ...SYM, ...PSYM };
  const counts = ids.map((id) => ({ id, label: lib[id], days: last30.filter((d) => d.sym[id] > 0).length, strong: last30.filter((d) => d.sym[id] >= 2).length })).sort((a, b) => b.days - a.days);
  const roughNights = last30.filter((d) => d.sleepQ === "poor").length;
  const pairs = sorted.slice(1).map((d, i) => [sorted[i], d]);
  const hfMult = hfRatio(pairs);
  const hfMult30 = hfRatio(pairs.filter(([prev]) => prev.date >= from));
  const starts = cycleStarts(sorted);
  const lens = cycleLens(starts);
  const variability = lens.length >= 2 ? Math.max(...lens) - Math.min(...lens) : null;
  const lens30 = cycleLens(starts.filter((d) => d >= from));
  const variability30 = lens30.length >= 2 ? Math.max(...lens30) - Math.min(...lens30) : null;
  return { sorted, last30, counts, roughNights, hfMult, hfMult30, lens: lens.slice(-6), variability, lens30, variability30, starts };
}

/* Registration answers that can seed a prediction before two cycles are logged. */
export const TOLD_CYCLE_LEN = { "Under 24 days": 23, "24–31 days": 28, "Over 31 days": 34 };
const UNSURE_CYCLE = ["Irregular", "Not sure"];
/** Why there's no prediction yet when registration said cycles are irregular / unknown. */
export const predictionWaits = (ins, prior) => !!prior && UNSURE_CYCLE.includes(prior.cycleLen) && ins.lens.length < 2;

/** Next period, fertile window and phase. `prior` is the registration record (regAnswers):
    with no logged period yet, its lastPeriod is the first start; until two cycles are
    logged, its cycleLen sets the average (Under 24 → 23, 24–31 → 28, Over 31 → 34;
    Irregular / Not sure → no prediction until two cycles are logged). Without a prior,
    the average comes from logged cycles, or 28. */
export function predict(ins, prior = null) {
  const told = prior ? TOLD_CYCLE_LEN[prior.cycleLen] : undefined;
  let lastIso = ins.starts[ins.starts.length - 1], seeded = false;
  if (!lastIso) {
    const lp = prior?.lastPeriod;
    if (!told || !/^\d{4}-\d{2}-\d{2}$/.test(lp || "") || new Date(lp + "T12:00:00") > new Date()) return null;
    lastIso = lp; seeded = true;
  }
  if (predictionWaits(ins, prior)) return null;
  const mean = (a) => Math.round(a.reduce((x, y) => x + y, 0) / a.length);
  const avgLen = ins.lens.length >= 2 ? mean(ins.lens) : told || (ins.lens.length ? mean(ins.lens) : 28);
  const basis = ins.lens.length >= 2 ? "logged" : told ? "told" : ins.lens.length ? "logged" : "default";
  const lastStart = new Date(lastIso + "T12:00:00");
  const today = new Date(); today.setHours(12, 0, 0, 0);
  const cycleDay = Math.round((today - lastStart) / 86400000) + 1;
  const nextStart = new Date(lastStart); nextStart.setDate(nextStart.getDate() + avgLen);
  const late = Math.round((today - nextStart) / 86400000);
  const ovu = new Date(nextStart); ovu.setDate(ovu.getDate() - 14);
  const fertileFrom = new Date(ovu); fertileFrom.setDate(fertileFrom.getDate() - 3);
  const fertileTo = new Date(ovu); fertileTo.setDate(fertileTo.getDate() + 1);
  const daysTo = Math.round((nextStart - today) / 86400000);
  const phase = cycleDay <= 5 ? "menstrual" : today >= fertileFrom && today <= fertileTo ? "fertile" : today < fertileFrom ? "follicular" : "luteal";
  return { cycleDay, avgLen, nextStart, daysTo, late, ovu, fertileFrom, fertileTo, phase, seeded, basis };
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
