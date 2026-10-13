import { useState } from "react";
import { dayScore, isPeriodDay, fmt, localDay, loadOf, sevDots } from "../lib/engine.js";
import { FAMILIES, SYM_FAMILY } from "../lib/constants.js";

/* "Your last 60 days" (Home and the Patterns tab, cycle and perimenopause/menopause stages).
   The original stripe field, kept and extended: one stripe per calendar day, coloured by the
   day's strongest symptom family and stronger the heavier the day, a period mark under it,
   and (on Patterns) one row per most-logged symptom underneath, sharing the same columns.
   Tap or arrow through days to see what was logged. Below the chart, one or two plain lines:
   the hardest stretch, and with two logged periods the cycle days that are usually hardest.
   Everything is computed from the on-device record; nothing here is stored or sent. */

const FAM = Object.fromEntries(FAMILIES.map((f) => [f.id, f]));
const addDays = (iso, n) => { const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + n); return localDay(d); };
const daysBetween = (a, b) => Math.round((new Date(b + "T12:00:00") - new Date(a + "T12:00:00")) / 86400000);
const wkday = (iso) => new Date(iso + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" });

/* The family of the day's strongest symptom (ties go to the first symptom in the stage's list);
   a rough night with nothing else logged counts as Sleep. */
export function dominantFamily(entry, ids) {
  if (!entry) return null;
  let best = null, bv = 0;
  for (const k of ids) { const v = entry.sym?.[k] || 0; if (v > bv) { bv = v; best = k; } }
  if (best) return SYM_FAMILY[best] || "body";
  return entry.sleepQ === "poor" ? "sleep" : null;
}

/* The last `n` calendar days ending today, with the entry, score, load and family for each. */
export function windowDays(sorted, ids, todayIso, n = 60) {
  const by = new Map(sorted.map((d) => [d.date, d]));
  return Array.from({ length: n }, (_, i) => {
    const iso = addDays(todayIso, i - (n - 1));
    const e = by.get(iso) || null;
    return { iso, e, score: e ? dayScore(e, ids) : null, load: e ? loadOf(e, ids) : null, fam: dominantFamily(e, ids) };
  });
}

/* Cycle day for an ISO date from the sorted list of logged period starts (null before the first). */
const cycleDayOf = (starts, iso) => { let s = null; for (const st of starts) { if (st <= iso) s = st; else break; } return s ? daysBetween(s, iso) + 1 : null; };

/* The 5-day window of cycle days that is usually hardest, from the last 4 logged cycles. Needs
   two cycles and six rated days in the window; null otherwise. */
export function hardestCycleDays(sorted, ids, starts, todayIso) {
  if (!starts || starts.length < 2) return null;
  const by = new Map(sorted.map((d) => [d.date, d]));
  const per = {};
  starts.slice(-4).forEach((s, i, arr) => {
    const next = starts[starts.indexOf(s) + 1], end = next ? addDays(next, -1) : todayIso, len = Math.min(45, daysBetween(s, end) + 1);
    for (let k = 0; k < len; k++) { const e = by.get(addDays(s, k)); if (e) (per[k + 1] = per[k + 1] || []).push({ ci: i, v: 1 - dayScore(e, ids) }); }
    return arr;
  });
  let hs = null, hv = -1;
  for (let s = 1; s <= 41; s++) {
    const vals = [0, 1, 2, 3, 4].flatMap((k) => per[s + k] || []);
    if (vals.length < 6 || new Set(vals.map((p) => p.ci)).size < 2) continue;
    const v = vals.reduce((a, p) => a + p.v, 0) / vals.length;
    if (v > hv) { hv = v; hs = s; }
  }
  return hs == null ? null : { from: hs, to: hs + 4, cycles: Math.min(4, starts.length) };
}

export function DayCard({ day, ids, labels, starts, empty }) {
  if (!day) return <div className="pday" aria-live="polite"><span className="hint">{empty}</span></div>;
  const cd = starts?.length ? cycleDayOf(starts, day.iso) : null;
  const e = day.e;
  const syms = e ? ids.filter((k) => (e.sym?.[k] || 0) > 0).sort((a, b) => e.sym[b] - e.sym[a]) : [];
  return (
    <div className="pday" aria-live="polite">
      <div className="pday-h">{wkday(day.iso)}, {fmt(day.iso)}{cd ? ` · cycle day ${cd}` : ""}{e && isPeriodDay(e) ? " · period" : ""}</div>
      {!e ? <div>Nothing logged that day.</div> : (
        <>
          <div>Day score <b>{Math.round(day.score * 100)}</b>{e.sleepQ ? `. Slept ${e.sleepQ}` : ""}.</div>
          {syms.length ? (
            <ul className="pday-s">
              {syms.slice(0, 6).map((k) => (
                <li key={k}><i className="fdot" style={{ background: FAM[SYM_FAMILY[k] || "body"].color }} aria-hidden="true" />{labels[k] || k} <span className="sevd" aria-label={`${e.sym[k]} of 3`}>{sevDots(e.sym[k])}</span></li>
              ))}
            </ul>
          ) : <div>No symptoms logged.</div>}
        </>
      )}
    </div>
  );
}

/* detail: add the symptom rows under the field (Patterns tab). onMore: a "See patterns" link (Home). */
export function SixtyDays({ days, ids, labels, starts, sorted, todayIso, detail = false, onMore = null }) {
  const [sel, setSel] = useState(null);
  const n = days.length;
  const logged = days.filter((d) => d.e);
  if (logged.length < 3) return null;
  // rows (Patterns only): rough nights, then the most-logged symptoms
  const count = (k) => days.filter((d) => (d.e?.sym?.[k] || 0) > 0).length;
  const nights = days.filter((d) => d.e?.sleepQ === "poor").length;
  const rows = detail ? [
    ...(nights ? [{ k: "_poor", label: "Rough nights", fam: "sleep", c: nights, v: (d) => (d.e?.sleepQ === "poor" ? 2 : 0) }] : []),
    ...ids.map((k) => ({ k, c: count(k) })).filter((o) => o.c > 0).sort((a, b) => b.c - a.c).slice(0, 6)
      .map((o) => ({ k: o.k, label: labels[o.k] || o.k, fam: SYM_FAMILY[o.k] || "body", c: o.c, v: (d) => d.e?.sym?.[o.k] || 0 })),
  ] : [];
  const W = 360, L = detail ? 88 : 0, R = detail ? 24 : 0, FH = 88, DOT = 7, RH = 15;
  const top = 0, rowsTop = FH + DOT + 8, H = rowsTop + rows.length * RH + (rows.length ? 4 : 0) + 14;
  const cw = (W - L - R) / n, x = (i) => L + i * cw;
  const pick = (ev) => { const r = ev.currentTarget.getBoundingClientRect(); const px = ((ev.clientX - r.left) / r.width) * W; return px < L - 2 ? null : Math.max(0, Math.min(n - 1, Math.floor((px - L) / cw))); };
  const onKeyDown = (ev) => {
    if (ev.key !== "ArrowLeft" && ev.key !== "ArrowRight") return;
    ev.preventDefault();
    const cur = sel == null ? n - 1 : sel;
    setSel(Math.max(0, Math.min(n - 1, cur + (ev.key === "ArrowRight" ? 1 : -1))));
  };
  // hardest 4-day stretch (3 logged days in it) and the usual hardest cycle days
  const win = 4; let worst = null, wv = 2;
  for (let i = 0; i <= n - win; i++) {
    const w = days.slice(i, i + win).filter((d) => d.score != null);
    if (w.length < 3) continue;
    const m = w.reduce((a, d) => a + d.score, 0) / w.length;
    if (m < wv) { wv = m; worst = i; }
  }
  const cyc = hardestCycleDays(sorted, ids, starts, todayIso);
  const fams = new Set(days.map((d) => d.fam).filter(Boolean));
  const hasPeriod = days.some((d) => d.e && isPeriodDay(d.e));
  const fill = (d) => {
    if (!d.e) return { fill: "currentColor", opacity: 0.04 };
    if (!d.fam || !d.load) return { fill: "currentColor", opacity: 0.09 };
    return { fill: FAM[d.fam].color, opacity: 0.22 + 0.78 * Math.min(1, d.load * 1.6) };
  };
  const summary = `Your last 60 days: ${logged.length} days logged, each coloured by its strongest symptom and stronger the heavier the day.${worst != null ? ` Hardest stretch from ${fmt(days[worst].iso)}.` : ""}${cyc ? ` Hardest days usually fall around cycle days ${cyc.from} to ${cyc.to}.` : ""}${detail && rows.length ? ` Rows: ${rows.map((r) => `${r.label} on ${r.c} days`).join(", ")}.` : ""} Use the left and right arrow keys to step through days.`;
  return (
    <div className="pchart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={summary} tabIndex={0} className="psvg"
        onPointerMove={(ev) => { const i = pick(ev); if (i != null) setSel(i); }} onPointerDown={(ev) => { const i = pick(ev); if (i != null) setSel(i); }} onKeyDown={onKeyDown}>
        <g style={{ color: "var(--ink)" }}>
          <clipPath id="sfclip"><rect x={L} y={top} width={W - L - R} height={FH} rx={10} /></clipPath>
          <g clipPath="url(#sfclip)">
            {days.map((d, i) => { const f = fill(d); return <rect key={d.iso} x={x(i)} y={top} width={cw + 0.4} height={FH} fill={f.fill} fillOpacity={f.opacity} />; })}
          </g>
          {days.map((d, i) => d.e && isPeriodDay(d.e) && <rect key={`p${i}`} x={x(i)} y={FH + 2} width={cw + 0.4} height={5} rx={1} fill="var(--primary)" />)}
          {rows.map((r, ri) => {
            const yy = rowsTop + ri * RH;
            return (
              <g key={r.k}>
                <text x={0} y={yy + RH / 2 + 3.5} className="prow">{r.label}</text>
                <text x={W} y={yy + RH / 2 + 3.5} textAnchor="end" className="ptick">{r.c}d</text>
                {days.map((d, i) => { const v = r.v(d); return v ? <rect key={i} x={x(i) + 0.5} y={yy + 2} width={Math.max(cw - 1, 1.5)} height={RH - 4} rx={1} fill={FAM[r.fam].color} fillOpacity={v >= 3 ? 1 : v === 2 ? 0.62 : 0.32} /> : null; })}
              </g>
            );
          })}
          {sel != null && <rect x={x(sel) - 0.5} y={top - 1} width={cw + 1.4} height={(rows.length ? rowsTop + rows.length * RH + 2 : FH + DOT + 2) + 2} rx={2} fill="none" stroke="currentColor" strokeWidth={1.5} pointerEvents="none" />}
          <text x={L} y={H - 2} className="ptick">{fmt(days[0].iso)}</text>
          <text x={L + (W - L - R) / 2} y={H - 2} textAnchor="middle" className="ptick">{fmt(days[Math.floor(n / 2)].iso)}</text>
          <text x={W - R} y={H - 2} textAnchor="end" className="ptick">Today</text>
        </g>
      </svg>
      <div className="flegend">
        {FAMILIES.filter((f) => fams.has(f.id)).map((f) => <span key={f.id}><i className="fdot" style={{ background: f.color }} aria-hidden="true" />{f.label}</span>)}
        <span><i className="fshade" aria-hidden="true" />pale = light day, strong = heavy day</span>
        {hasPeriod && <span><i className="fper" aria-hidden="true" />period</span>}
      </div>
      <DayCard day={sel != null ? days[sel] : null} ids={ids} labels={labels} starts={starts} empty={detail ? "Tap a day, or a square in a row, to see everything you logged that day." : "Tap a day to see what you logged."} />
      {(worst != null || cyc) && (
        <p className="pline">
          {worst != null && <span>Hardest stretch: <b>{fmt(days[worst].iso)}–{fmt(days[Math.min(n - 1, worst + win - 1)].iso)}</b>.</span>}
          {cyc && <span> Across your last {cyc.cycles} cycles, your hardest days usually fall around <b>cycle days {cyc.from}–{cyc.to}</b>.</span>}
          {onMore && <> <button type="button" className="linkbtn" onClick={onMore}>See patterns →</button></>}
        </p>
      )}
      {!(worst != null || cyc) && onMore && <p className="pline"><button type="button" className="linkbtn" onClick={onMore}>See patterns →</button></p>}
    </div>
  );
}
