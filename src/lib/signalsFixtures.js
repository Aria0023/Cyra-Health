/* Synthetic cycles for the signals library (passive tracking S1): deterministic rows shaped like what the plugins
   return (one row per wake day: { date, temp (°C deviation), rhr, hrv, sleep, sourceId }), so the rules in
   lib/signals.js can be proven on known cycles before any real device, and so demo builds and the dev gallery show
   the same illustrative readings every time. Pure: no Date.now, no Math.random (a small hash gives the noise), no
   imports but engine.js. Nothing here is real data. */
import { addDays, daysBetween } from "./engine.js";

/* A unit-interval number from (i, seed, salt): the same every run, different per night and channel. */
const noise = (i, seed, salt) => { const x = Math.sin(i * 12.9898 + seed * 78.233 + salt * 37.719) * 43758.5453; return (x - Math.floor(x)) * 2 - 1; };
const r2 = (x) => Math.round(x * 100) / 100;

/**
 * One cycle's rows: `length` nights from `start`, a temperature rise of `rise` °C from cycle day `riseDay` on (null for
 * an anovulatory cycle), ± `jitter` of noise on every channel. RHR runs a few beats higher and HRV a little lower in
 * the luteal half once a rise has happened (the usual luteal signature). `fever`: cycle days given +1.3 °C.
 * `missing`: cycle days with no row at all (no watch worn). sourceId marks every row.
 */
export function syntheticCycle({ start, length = 28, riseDay = 15, rise = 0.35, jitter = 0.05, fever = [], missing = [], sourceId = "demo", seed = 1, demo = false } = {}) {
  const rows = [];
  for (let cd = 1; cd <= length; cd++) {
    if (missing.includes(cd)) continue;
    const luteal = riseDay != null && cd >= riseDay;
    const i = daysBetween("2026-01-01", start) + cd; // a global night index, so neighbouring cycles don't repeat each other's noise
    const temp = (luteal ? rise : 0) + noise(i, seed, 1) * jitter + (fever.includes(cd) ? 1.3 : 0);
    const rhr = 61 + (luteal ? 3 : 0) + noise(i, seed, 2) * 2;
    const hrv = 46 - (luteal ? 6 : 0) + noise(i, seed, 3) * 4;
    const sleep = 76 + noise(i, seed, 4) * 7;
    rows.push({ date: addDays(start, cd - 1), temp: r2(temp), rhr: Math.round(rhr), hrv: Math.round(hrv), sleep: Math.round(sleep), sourceId, ...(demo ? { demo: true } : {}) });
  }
  return rows;
}
/** Period day entries for a cycle start: `bleed` days with period: true, flow "med" (what engine cycleStarts reads). */
export const periodDays = (start, bleed = 4) => Array.from({ length: bleed }, (_, k) => ({ date: addDays(start, k), sym: {}, period: true, flow: "med" }));

/** Several cycles back to back from `start`: { rows, days, cycles: [{ start, next, length }] }. `shape(i)` gives each
    cycle's options (length, riseDay, …); the last cycle can be left running with `running: true` (no next start). */
export function syntheticLog({ start = "2026-07-06", n = 3, shape = () => ({}), running = false, sourceId = "demo", seed = 1, demo = false } = {}) {
  const rows = [], days = [], cycles = [];
  let s = start;
  for (let i = 0; i < n; i++) {
    const o = { length: 28, riseDay: 15, bleed: 4, ...shape(i) };
    rows.push(...syntheticCycle({ ...o, start: s, sourceId, seed: seed + i, demo }));
    days.push(...periodDays(s, o.bleed));
    const next = addDays(s, o.length);
    const last = i === n - 1;
    cycles.push({ start: s, next: last && running ? null : next, length: last && running ? null : o.length });
    s = next;
  }
  if (!running) days.push(...periodDays(s, 4)); // the next start, so the last cycle is finished
  return { rows, days, cycles, nextStart: running ? null : s };
}

/* ---------- the named fixtures the unit tests read ---------- */
export const FIXTURES = Object.freeze({
  /** Three regular 28-day cycles, a rise on day 15 each. */
  regular28: () => syntheticLog({ n: 3 }),
  /** One irregular 45-day cycle with a late rise on day 31, between two 28s. */
  irregular45: () => syntheticLog({ n: 3, shape: (i) => (i === 1 ? { length: 45, riseDay: 31 } : {}) }),
  /** A cycle with no rise at all (anovulatory), 30 days. */
  anovulatory: () => syntheticLog({ n: 1, shape: () => ({ length: 30, riseDay: null }) }),
  /** A regular cycle with four nights she asks to skip (cycle days 8, 9, 10 and 20): { …, skips }. */
  withSkips: () => { const f = syntheticLog({ n: 1 }); const s = f.cycles[0].start; return { ...f, skips: Object.fromEntries([8, 9, 10, 20].map((cd) => [addDays(s, cd - 1), cd === 20 ? "travel" : "fever"])) }; },
  /** A regular cycle with a fever-like night on cycle day 9 (+1.3 °C). */
  feverNight: () => syntheticLog({ n: 1, shape: () => ({ fever: [9] }) }),
  /** Two sources for every night: a watch (healthkit) and a ring (oura) whose ring reads 0.1 °C warmer. */
  twoSources: () => {
    const a = syntheticLog({ n: 1, sourceId: "healthkit" });
    const ring = a.rows.map((r) => ({ ...r, sourceId: "oura", temp: r2(r.temp + 0.1), hrv: r.hrv - 8 }));
    return { ...a, rows: [...a.rows, ...ring] };
  },
  /** Rows that carry a timestamp instead of a day, around a wake-day boundary across a time zone (UTC+14 vs UTC). */
  tzBoundary: () => ({
    rows: [
      { at: "2026-10-08T07:30:00+14:00", temp: 0.1, rhr: 60, hrv: 44, sleep: 80, sourceId: "healthkit" }, // 07:30 in Kiribati = 2026-10-07T17:30Z
      { at: "2026-10-07T17:30:00Z", temp: 0.3, rhr: 60, hrv: 44, sleep: 80, sourceId: "oura" },           // the same moment, in UTC
      { at: "2026-10-08T21:10:00+02:00", temp: 0.12, rhr: 59, hrv: 45, sleep: 78, sourceId: "healthkit" }, // an evening reading: the next morning's night
    ],
  }),
});

/* ---------- demo readings (demo builds, the dev gallery) ---------- */
/** Illustrative rows for [fromIso, toIso], shaped to the stage: cycle stages get 28-day cycles with a rise on day 15,
    the current cycle 20 days old at `toIso` (so the last rise is visible); perimenopause gets 35-day cycles with a
    rise some cycles and none others; pregnancy and menopause get a flat run. Every row is marked demo. */
export function demoRows({ fromIso, toIso, sourceId = "healthkit", stage = "periods", isMeno = false, starts = null } = {}) {
  const span = daysBetween(fromIso, toIso) + 1;
  let rows = [];
  const own = Array.isArray(starts) ? [...new Set(starts.filter((d) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)))].sort() : [];
  if ((stage === "periods" || (stage === "peri" && !isMeno)) && own.length) {
    // S2: shaped to HER logged period starts, so the cycle markers and the table read the same cycles as Body → Cycles.
    // Each cycle runs from its start to the next start (the running one to toIso); a rise on day 15 (perimenopause: every
    // other cycle has none), nothing before 10 nights; the lead-in before her first start is a flat run.
    const first = own[0];
    if (first > fromIso) rows.push(...syntheticCycle({ start: fromIso, length: daysBetween(fromIso, first), riseDay: null, rise: 0, jitter: 0.05, sourceId, seed: 5, demo: true }));
    own.forEach((st, i) => {
      const next = own[i + 1] || addDays(toIso, 1);
      const length = daysBetween(st, next);
      if (length <= 0) return;
      const riseDay = stage === "peri" && i % 2 ? null : 15;
      rows.push(...syntheticCycle({ start: st, length, riseDay: length > riseDay + 2 || riseDay == null ? riseDay : null, sourceId, seed: 7 + i, demo: true }));
    });
  } else if (stage === "periods") {
    const len = 28, curStart = addDays(toIso, -19);
    const first = addDays(curStart, -len * Math.ceil(span / len));
    rows = syntheticLog({ start: first, n: Math.ceil(span / len) + 1, sourceId, demo: true, seed: 7 }).rows;
  } else if (stage === "peri" && !isMeno) {
    const len = 35, curStart = addDays(toIso, -12);
    const first = addDays(curStart, -len * Math.ceil(span / len));
    rows = syntheticLog({ start: first, n: Math.ceil(span / len) + 1, shape: (i) => ({ length: len, riseDay: i % 2 ? null : 22 }), sourceId, demo: true, seed: 11 }).rows;
  } else {
    rows = syntheticCycle({ start: addDays(fromIso, -2), length: span + 4, riseDay: null, rise: 0, jitter: 0.06, sourceId, seed: 13, demo: true });
  }
  return rows.filter((r) => r.date >= fromIso && r.date <= toIso);
}
/** The period starts that go with demoRows for a cycle stage (so the demo cycles list carries markers): [iso]. */
export function demoStarts({ toIso, stage = "periods", isMeno = false, back = 120 } = {}) {
  if (stage === "preg" || isMeno) return [];
  const len = stage === "peri" ? 35 : 28, cur = addDays(toIso, stage === "peri" ? -12 : -19);
  const out = [];
  for (let s = cur; daysBetween(s, toIso) <= back; s = addDays(s, -len)) out.unshift(s);
  return out;
}
