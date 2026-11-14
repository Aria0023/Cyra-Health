/* Blood glucose through the phone (2026-11-14, docs/plans/partner-learn-glucose-shop.md Task B): readings a CGM app
   (Dexcom, FreeStyle Libre) or a meter app writes to Apple Health or Health Connect, read ON THE PHONE by the app's own
   CyraHealth plugin (readGlucose) and kept on this device. Never sent to a server. Pure: no React, storage or network.

   Record key glucoseLog (record, in backups):
     { apps: ["dexcom" | "libre"], connectedAt: ms | null, lastSync: ms | null, demo?: true,
       days: { [YYYY-MM-DD]: { n, min, max, mean, last, lastAt } } }  (mg/dL, rounded; lastAt "HH:MM" local)
   One summary per day, never the raw series: enough for "latest, the day's range, how many readings" and a 7-day line.
   At most DAYS_MAX days are kept (newest).

   What it never does: no targets, no "high"/"low" verdicts, no colours that judge, no alerts, no dosing. The words
   describe her readings and nothing else. */

export const GLUCOSE_APPS = Object.freeze(["dexcom", "libre"]);
export const DAYS_MAX = 120;
export const MMOL = 18.016; // mg/dL per mmol/L for glucose
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const HM = /^\d{2}:\d{2}$/;
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const num = (v) => typeof v === "number" && Number.isFinite(v);

export const EMPTY_GLUCOSE = Object.freeze({ apps: Object.freeze([]), connectedAt: null, lastSync: null, days: Object.freeze({}) });

function cleanDay(d) {
  if (!isObj(d)) return null;
  const n = Number.isInteger(d.n) && d.n > 0 ? d.n : 0;
  if (!n || ![d.min, d.max, d.mean, d.last].every((x) => num(x) && x > 0 && x < 1000)) return null;
  return { n, min: Math.round(d.min), max: Math.round(d.max), mean: Math.round(d.mean), last: Math.round(d.last), lastAt: typeof d.lastAt === "string" && HM.test(d.lastAt) ? d.lastAt : null };
}
/** glucoseLog as stored. */
export function cleanGlucoseLog(v) {
  const o = isObj(v) ? v : {};
  const apps = Array.isArray(o.apps) ? GLUCOSE_APPS.filter((a) => o.apps.includes(a)) : [];
  const days = {};
  const src = isObj(o.days) ? o.days : {};
  const good = Object.keys(src).filter((k) => ISO.test(k)).sort().map((k) => [k, cleanDay(src[k])]).filter(([, d]) => d);
  for (const [k, d] of good.slice(-DAYS_MAX)) days[k] = d;
  const ms = (x) => (num(x) && x > 0 ? x : null);
  return { apps, connectedAt: ms(o.connectedAt), lastSync: ms(o.lastSync), ...(o.demo === true ? { demo: true } : {}), days };
}

const pad = (n) => String(n).padStart(2, "0");
const localIso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
/** Raw readings from the plugin ([{ at: ISO time or ms, mgdl }]) → per-day summaries in local time. Bad readings are dropped. */
export function summarize(readings) {
  const by = new Map();
  for (const r of Array.isArray(readings) ? readings : []) {
    if (!isObj(r) || !num(r.mgdl) || r.mgdl <= 0 || r.mgdl >= 1000) continue;
    const t = typeof r.at === "number" ? new Date(r.at) : new Date(String(r.at));
    if (Number.isNaN(t.getTime())) continue;
    const k = localIso(t);
    const list = by.get(k) || [];
    list.push({ t: t.getTime(), v: r.mgdl, hm: `${pad(t.getHours())}:${pad(t.getMinutes())}` });
    by.set(k, list);
  }
  const days = {};
  for (const [k, list] of [...by.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    list.sort((a, b) => a.t - b.t);
    const vs = list.map((x) => x.v), last = list[list.length - 1];
    days[k] = { n: vs.length, min: Math.round(Math.min(...vs)), max: Math.round(Math.max(...vs)), mean: Math.round(vs.reduce((a, b) => a + b, 0) / vs.length), last: Math.round(last.v), lastAt: last.hm };
  }
  return days;
}
/** The log with freshly read days replacing the same days (a re-read of a day is the whole day again). */
export const mergeGlucose = (log, days) => cleanGlucoseLog({ ...cleanGlucoseLog(log), days: { ...cleanGlucoseLog(log).days, ...(isObj(days) ? days : {}) } });

/** A value in her unit, as text: "104 mg/dL" or "5.8 mmol/L". */
export function fmtGlucose(mgdl, unit = "mg/dL") {
  if (!num(mgdl)) return "";
  return unit === "mmol/L" ? `${(Math.round((mgdl / MMOL) * 10) / 10).toFixed(1)} mmol/L` : `${Math.round(mgdl)} mg/dL`;
}
const bare = (mgdl, unit) => fmtGlucose(mgdl, unit).replace(/ .*$/, "");

/** The Body card's model, or null when there are no readings in the last 7 days.
    → { day, latest, at, range, count, words, week: [{ date, mean|null, min|null, max|null }] (7 days, oldest first), unit, demo } */
export function glucoseCard(log, todayIso, unit = "mg/dL") {
  const g = cleanGlucoseLog(log);
  const week = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(`${todayIso}T12:00:00`); d.setDate(d.getDate() - i);
    const k = localIso(d), x = g.days[k];
    week.push({ date: k, mean: x ? x.mean : null, min: x ? x.min : null, max: x ? x.max : null });
  }
  const latestDay = [...week].reverse().find((w) => w.mean != null);
  if (!latestDay) return null;
  const x = g.days[latestDay.date];
  const isToday = latestDay.date === todayIso;
  const range = x.min === x.max ? fmtGlucose(x.min, unit) : `${bare(x.min, unit)} to ${fmtGlucose(x.max, unit)}`;
  const count = `${x.n} reading${x.n === 1 ? "" : "s"}`;
  const words = `${isToday ? "Today" : "On the last day with readings"}: ${count}, from ${range}.`;
  return { day: latestDay.date, today: isToday, latest: fmtGlucose(x.last, unit), at: x.lastAt, range, count, words, week, unit, demo: !!g.demo };
}

/** Illustrative readings for the demo build: a calm day curve, the same for a given day. [{ at: ms, mgdl }] */
export function demoReadings(fromIso, toIso) {
  const out = [];
  const d = new Date(`${fromIso}T00:00:00`), end = new Date(`${toIso}T23:59:59`);
  const now = Date.now();
  for (; d <= end; d.setDate(d.getDate() + 1)) {
    const seed = d.getDate() * 7 + d.getMonth();
    for (let m = 0; m < 24 * 60; m += 60) {
      const t = new Date(d); t.setMinutes(m);
      if (t.getTime() > now) break;
      const h = m / 60;
      const meal = [8, 13, 19].reduce((a, mh) => a + Math.max(0, 28 - Math.abs(h - mh - 1) * 18), 0);
      out.push({ at: t.getTime(), mgdl: Math.round(92 + meal + ((seed + m) % 9) - 4) });
    }
  }
  return out;
}
