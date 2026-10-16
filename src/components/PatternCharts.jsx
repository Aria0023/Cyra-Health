import { useState } from "react";
import { dayScore, isPeriodDay, fmt, localDay, sevDots } from "../lib/engine.js";
import { FAMILIES, SYM_FAMILY } from "../lib/constants.js";

/* "Your patterns" card (Home and the Patterns tab; cycle and perimenopause/menopause stages).
   One card, two views behind a switch:
   - Day by day: the day score for the last 60 calendar days, each day a dot in the colour of
     its strongest symptom family, the 7-day average as a line, period days shaded, the best and
     hardest 4-day stretches labelled; under it, on the same columns, one row per most-logged
     symptom (plus rough nights) with a dot per day sized by severity.
   - By cycle (two logged period starts, not in menopause): one ring per logged cycle, day 1 at
     the top, clockwise; dot size = how hard the day was, dot colour = strongest symptom family;
     the cycle days that are usually hardest are highlighted and named.
   Both views share one selection: tap or arrow through days and the day card names what was
   logged, so colour is never the only way to read it. Everything is computed from the on-device
   record; nothing here is stored or sent. */

const FAM = Object.fromEntries(FAMILIES.map((f) => [f.id, f]));
const NONE = "var(--line)";
const addDays = (iso, n) => { const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + n); return localDay(d); };
const daysBetween = (a, b) => Math.round((new Date(b + "T12:00:00") - new Date(a + "T12:00:00")) / 86400000);
const wkday = (iso) => new Date(iso + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" });
const mean = (w) => w.reduce((a, d) => a + d.score, 0) / w.length;

/* The family of the day's strongest symptom (ties go to the first symptom in the stage's list);
   a rough night with nothing else logged counts as Sleep. */
export function dominantFamily(entry, ids) {
  if (!entry) return null;
  let best = null, bv = 0;
  for (const k of ids) { const v = entry.sym?.[k] || 0; if (v > bv) { bv = v; best = k; } }
  if (best) return SYM_FAMILY[best] || "body";
  return entry.sleepQ === "poor" ? "sleep" : null;
}

/* The last `n` calendar days ending today, with the entry, score and family for each. */
export function windowDays(sorted, ids, todayIso, n = 60) {
  const by = new Map(sorted.map((d) => [d.date, d]));
  return Array.from({ length: n }, (_, i) => {
    const iso = addDays(todayIso, i - (n - 1));
    const e = by.get(iso) || null;
    return { iso, e, score: e ? dayScore(e, ids) : null, fam: dominantFamily(e, ids) };
  });
}

/* Cycle day for an ISO date from the sorted list of logged period starts (null before the first). */
const cycleDayOf = (starts, iso) => { let s = null; for (const st of starts) { if (st <= iso) s = st; else break; } return s ? daysBetween(s, iso) + 1 : null; };

/* Arrow keys step through `count` items from the current index (from the end when nothing is picked). */
const stepKey = (ev, count, cur, go) => {
  if (ev.key !== "ArrowLeft" && ev.key !== "ArrowRight") return;
  ev.preventDefault();
  const from = cur == null || cur < 0 ? count - 1 : cur;
  go(Math.max(0, Math.min(count - 1, from + (ev.key === "ArrowRight" ? 1 : -1))));
};

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

function FamilyLegend({ fams, extra }) {
  return (
    <div className="flegend">
      {FAMILIES.filter((f) => fams.has(f.id)).map((f) => <span key={f.id}><i className="fdot" style={{ background: f.color }} aria-hidden="true" />{f.label}</span>)}
      {extra}
    </div>
  );
}

/* ---------------- Day by day: the day-score line with the symptom rows under it ---------------- */

/* Rough nights, then the `max` most-logged symptoms, each with a per-day value for its dots. */
function symptomRows(days, ids, labels, max) {
  const count = (k) => days.filter((d) => (d.e?.sym?.[k] || 0) > 0).length;
  const nights = days.filter((d) => d.e?.sleepQ === "poor").length;
  return [
    ...(nights ? [{ k: "_poor", label: "Rough nights", fam: "sleep", c: nights, v: (d) => (d.e?.sleepQ === "poor" ? 2 : 0) }] : []),
    ...ids.map((k) => ({ k, c: count(k) })).filter((o) => o.c > 0).sort((a, b) => b.c - a.c).slice(0, max)
      .map((o) => ({ k: o.k, label: labels[o.k] || o.k, fam: SYM_FAMILY[o.k] || "body", c: o.c, v: (d) => d.e?.sym?.[o.k] || 0 })),
  ];
}

/* 7-day average, best and hardest 4-day stretches, and the first-week to last-week change. */
function dayStats(days) {
  const n = days.length;
  const avg = days.map((_, i) => { const w = days.slice(Math.max(0, i - 6), i + 1).filter((d) => d.score != null); return w.length >= 3 ? mean(w) : null; });
  const win = 4; let best = null, worst = null, bv = -1, wv = 2;
  for (let i = 0; i <= n - win; i++) {
    const w = days.slice(i, i + win).filter((d) => d.score != null);
    if (w.length < 3) continue;
    const m = mean(w);
    if (m > bv) { bv = m; best = i; }
    if (m < wv) { wv = m; worst = i; }
  }
  const showStretches = best != null && worst != null && bv - wv >= 0.08;
  const weekMean = (from, to) => { const w = days.slice(from, to).filter((d) => d.score != null); return w.length >= 3 ? mean(w) : null; };
  const first = weekMean(0, 7), last = weekMean(n - 7, n);
  const diff = first != null && last != null ? Math.round((last - first) * 100) : null;
  return { avg, win, best, worst, showStretches, diff };
}

function DayField({ days, rows, stats, sel, setSel, compact = false, popIso = null }) {
  const { avg, win, best, worst, showStretches, diff } = stats;
  // Home's compact card draws the same line, dots and bands on a shorter plot
  const W = 360, LH = compact ? 150 : 206, L = 28, R = 10, T = 26, B = 16, n = days.length;
  const RH = 30, rowsTop = LH + 8, rowsH = rows.length * RH, H = rowsTop + rowsH + 16;
  const x = (i) => L + (i / (n - 1)) * (W - L - R), step = (W - L - R) / (n - 1);
  // the scale starts a little below her lowest logged day (in tens), so the ups and downs are readable
  const minScore = Math.min(...days.filter((d) => d.score != null).map((d) => d.score), 1);
  const lo = Math.max(0, Math.floor((minScore - 0.1) * 10) / 10), span = 1 - lo;
  const y = (v) => T + (1 - (v - lo) / span) * (LH - T - B);
  const ticks = [lo, lo + span / 2, 1].map((v) => Math.round(v * 100) / 100);
  let path = "", pen = false;
  avg.forEach((v, i) => { if (v == null) { pen = false; return; } path += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`; pen = true; });
  const logged = days.filter((d) => d.score != null);
  const pick = (ev) => { const r = ev.currentTarget.getBoundingClientRect(); const px = ((ev.clientX - r.left) / r.width) * W; return Math.max(0, Math.min(n - 1, Math.round((px - L) / step))); };
  const label = (i, above) => {
    const cx = x(i + (win - 1) / 2), anchor = cx > W - 70 ? "end" : cx < L + 60 ? "start" : "middle";
    return { x: Math.min(W - R, Math.max(L, cx)), anchor, y: above ? 12 : LH - 4 };
  };
  const bl = best != null ? label(best, true) : null, wl = worst != null ? label(worst, false) : null;
  const selBottom = rows.length ? rowsTop + rowsH : LH - B;
  const summary = `Day score for the last 60 days, ${logged.length} days logged.${diff != null ? ` Weekly average ${diff >= 0 ? "up" : "down"} ${Math.abs(diff)} points since the first week.` : ""}${showStretches ? ` Best stretch from ${fmt(days[best].iso)}, hardest from ${fmt(days[worst].iso)}.` : ""}${rows.length ? ` Underneath: ${rows.map((r) => `${r.label} on ${r.c} days`).join(", ")}.` : ""} Use the left and right arrow keys to step through days.`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={summary} tabIndex={0} className="psvg"
      onPointerMove={(ev) => setSel(pick(ev))} onPointerDown={(ev) => setSel(pick(ev))} onKeyDown={(ev) => stepKey(ev, n, sel, setSel)}>
      <g style={{ color: "var(--ink)" }}>
        {days.map((d, i) => d.e && isPeriodDay(d.e) && (
          <g key={`p${i}`} fill="currentColor" fillOpacity={0.07}>
            <rect x={x(i) - step / 2} y={T} width={step} height={LH - T - B} />
            {rows.length > 0 && <rect x={x(i) - step / 2} y={rowsTop} width={step} height={rowsH} />}
          </g>
        ))}
        {ticks.map((v) => (
          <g key={v}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeWidth={1} /><text x={L - 6} y={y(v) + 3.5} textAnchor="end" className="ptick">{Math.round(v * 100)}</text></g>
        ))}
        {showStretches && [[best, bl, "Best stretch"], [worst, wl, "Hardest"]].map(([i, lb, t]) => (
          <g key={t}>
            <rect x={x(i) - 3} y={T} width={x(i + win - 1) - x(i) + 6} height={LH - T - B} rx={4} fill="none" stroke="var(--soft)" strokeDasharray="3 3" />
            <text x={lb.x} y={lb.y} textAnchor={lb.anchor} className="pnote">{t} · {fmt(days[i].iso)}</text>
          </g>
        ))}
        {path && <path d={path} fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" opacity={0.85} />}
        {days.map((d, i) => d.score != null && (
          // the day just saved (App justSaved, set by the save handler only) pops once on this mount
          d.iso === popIso
            ? <g key={`d${i}`} className="dot-new"><circle cx={x(i)} cy={y(d.score)} r={3.4} fill={d.fam ? FAM[d.fam].color : NONE} stroke="var(--card)" strokeWidth={1.2} /></g>
            : <circle key={`d${i}`} cx={x(i)} cy={y(d.score)} r={3.4} fill={d.fam ? FAM[d.fam].color : NONE} stroke="var(--card)" strokeWidth={1.2} />
        ))}
        {rows.length > 0 && <line x1={L} x2={W - R} y1={LH + 1} y2={LH + 1} stroke="var(--line)" strokeWidth={1} />}
        {rows.map((r, ri) => {
          const ry = rowsTop + ri * RH, yy = ry + 21;
          return (
            <g key={r.k}>
              <text x={L} y={ry + 9} className="prow">{r.label}</text>
              <text x={W - R} y={ry + 9} textAnchor="end" className="ptick">{r.c} days</text>
              <line x1={L} x2={W - R} y1={yy} y2={yy} stroke="var(--line)" strokeWidth={1} />
              {days.map((d, i) => { const v = r.v(d); return v ? <circle key={i} cx={x(i)} cy={yy} r={1.3 + v * 1.25} fill={FAM[r.fam].color} /> : null; })}
            </g>
          );
        })}
        {sel != null && sel >= 0 && (
          <g pointerEvents="none">
            <line x1={x(sel)} x2={x(sel)} y1={T} y2={selBottom} stroke="currentColor" strokeOpacity={0.35} />
            {days[sel].score != null && <circle cx={x(sel)} cy={y(days[sel].score)} r={6} fill="none" stroke="currentColor" strokeWidth={2} />}
          </g>
        )}
        <text x={L} y={H - 4} className="ptick">{fmt(days[0].iso)}</text>
        <text x={L + (W - L - R) / 2} y={H - 4} textAnchor="middle" className="ptick">{fmt(days[Math.floor(n / 2)].iso)}</text>
        <text x={W - R} y={H - 4} textAnchor="end" className="ptick">Today</text>
      </g>
    </svg>
  );
}

/* ---------------- By cycle: one ring per logged cycle ---------------- */

/* The last 4 cycles that began with a logged start (the newest runs to today), every day placed on
   its ring, and the 5-day window of cycle days that is usually hardest (needs 2 cycles and 6 rated
   days in the window; null otherwise). */
function ringModel(sorted, ids, starts, todayIso) {
  const by = new Map(sorted.map((d) => [d.date, d]));
  const cyc = starts.slice(-4).map((s) => {
    const next = starts[starts.indexOf(s) + 1];
    const end = next ? addDays(next, -1) : todayIso;
    const len = Math.min(45, daysBetween(s, end) + 1);
    return { start: s, days: Array.from({ length: len }, (_, k) => { const iso = addDays(s, k), e = by.get(iso) || null; return { iso, cd: k + 1, e, score: e ? dayScore(e, ids) : null, fam: dominantFamily(e, ids) }; }) };
  });
  const S = 340, cx = S / 2, cy = S / 2;
  const MAXD = Math.max(35, ...cyc.map((c) => c.days.length));
  const r0 = 70, gap = cyc.length > 1 ? Math.min(26, 62 / (cyc.length - 1)) : 0;
  const ang = (cd) => ((cd - 1) / MAXD) * Math.PI * 2 - Math.PI / 2;
  const pts = [];
  cyc.forEach((c, ci) => c.days.forEach((d) => { const r = r0 + gap * ci, a = ang(d.cd); pts.push({ ...d, ci, px: cx + Math.cos(a) * r, py: cy + Math.sin(a) * r }); }));
  const per = {}; pts.forEach((p) => { if (p.score != null) (per[p.cd] = per[p.cd] || []).push(p); });
  let hs = null, hv = -1;
  for (let s = 1; s <= MAXD - 4; s++) {
    const vals = [0, 1, 2, 3, 4].flatMap((k) => per[s + k] || []);
    if (vals.length < 6 || new Set(vals.map((p) => p.ci)).size < 2) continue;
    const v = vals.reduce((a, p) => a + (1 - p.score), 0) / vals.length;
    if (v > hv) { hv = v; hs = s; }
  }
  const outer = r0 + gap * (cyc.length - 1);
  let wedge = null;
  if (hs != null) {
    const a0 = ang(hs - 0.5), a1 = ang(hs + 4.5), ro = outer + 13, ri = r0 - 13;
    const P = (a, r) => `${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r).toFixed(1)}`;
    wedge = `M${P(a0, ri)} L${P(a0, ro)} A${ro},${ro} 0 0 1 ${P(a1, ro)} L${P(a1, ri)} A${ri},${ri} 0 0 0 ${P(a0, ri)}Z`;
  }
  return { cyc, pts, hs, S, cx, cy, r0, gap, outer, wedge, MAXD, ang };
}

function CycleRings({ model, sel, setSel }) {
  const { cyc, pts, hs, S, cx, cy, r0, gap, outer, wedge, MAXD, ang } = model;
  const pick = (ev) => {
    const r = ev.currentTarget.getBoundingClientRect(), px = ((ev.clientX - r.left) / r.width) * S, py = ((ev.clientY - r.top) / r.height) * S;
    let bi = null, bd = 24 * 24;
    pts.forEach((p, i) => { const dd = (p.px - px) ** 2 + (p.py - py) ** 2; if (dd < bd) { bd = dd; bi = i; } });
    return bi;
  };
  const summary = `${cyc.length} cycles drawn as rings, day 1 at the top.${hs != null ? ` Your hardest days usually fall around cycle days ${hs} to ${hs + 4}.` : ""} Use the left and right arrow keys to step through days.`;
  return (
    <svg viewBox={`0 0 ${S} ${S}`} role="img" aria-label={summary} tabIndex={0} className="psvg"
      onPointerMove={(ev) => { const i = pick(ev); if (i != null) setSel(i); }} onPointerDown={(ev) => { const i = pick(ev); if (i != null) setSel(i); }} onKeyDown={(ev) => stepKey(ev, pts.length, sel, setSel)}>
      <g style={{ color: "var(--ink)" }}>
        {wedge && <path d={wedge} fill="currentColor" fillOpacity={0.07} />}
        {cyc.map((c, ci) => <circle key={c.start} cx={cx} cy={cy} r={r0 + gap * ci} fill="none" stroke="var(--line)" strokeWidth={1} />)}
        {[1, 7, 14, 21, 28, 35].filter((d) => d <= MAXD).map((d) => { const a = ang(d), rr = outer + 24; return <text key={d} x={cx + Math.cos(a) * rr} y={cy + Math.sin(a) * rr + 3.5} textAnchor="middle" className="ptick">{d === 1 ? "Day 1" : d}</text>; })}
        {pts.map((p, i) => {
          if (p.score == null) return <circle key={i} cx={p.px} cy={p.py} r={1.3} fill="currentColor" fillOpacity={0.25} />;
          const rad = 2 + (1 - p.score) * 6.5;
          return (
            <g key={i}>
              {isPeriodDay(p.e) && <circle cx={p.px} cy={p.py} r={Math.max(rad, 3.5) + 2} fill="none" stroke="currentColor" strokeWidth={1.2} />}
              <circle cx={p.px} cy={p.py} r={rad} fill={p.fam ? FAM[p.fam].color : NONE} stroke="var(--card)" strokeWidth={1.2} />
            </g>
          );
        })}
        {sel != null && pts[sel] && <circle cx={pts[sel].px} cy={pts[sel].py} r={8} fill="none" stroke="currentColor" strokeWidth={2} pointerEvents="none" />}
        <text x={cx} y={cy - 2} textAnchor="middle" className="pnote">{cyc.length} cycles</text>
        <text x={cx} y={cy + 12} textAnchor="middle" className="ptick">inner = oldest</text>
      </g>
    </svg>
  );
}

/* ---------------- The card ---------------- */

/* days: windowDays(); starts: logged period starts ([] in menopause); maxRows: how many symptom
   rows to draw under the line (Home shows fewer); onMore: a link to the Patterns tab (Home);
   compact (Home): no hint line, the callout sentence above the plot as its headline, a shorter
   plot, at most maxRows rows in all (rough nights included), and the day card only once a day
   is picked. The view switch and the legend stay in both variants. popIso: the day just saved
   (App.jsx justSaved, 1.2 s after a save of today); its dot pops once (.dot-new).
   Renders nothing until 3 days are logged. */
export function PatternsCard({ days, ids, labels, starts = [], sorted, todayIso, maxRows = 6, onMore = null, compact = false, popIso = null }) {
  const [view, setView] = useState("days");
  const [selIso, setSelIso] = useState(null);
  const logged = days.filter((d) => d.e);
  if (logged.length < 3) return null;
  const canCycle = starts.length >= 2;
  const cycleView = canCycle && view === "cycle";
  const allRows = symptomRows(days, ids, labels, maxRows);
  const rows = compact ? allRows.slice(0, maxRows) : allRows;
  const stats = dayStats(days);
  const model = cycleView ? ringModel(sorted, ids, starts, todayIso) : null;
  // one selection for both views, kept by date so switching views keeps the day when it is drawn
  const daySel = selIso == null ? null : days.findIndex((d) => d.iso === selIso);
  const ringSel = model && selIso != null ? model.pts.findIndex((p) => p.iso === selIso) : null;
  const picked = cycleView ? (ringSel != null && ringSel >= 0 ? model.pts[ringSel] : null) : (daySel != null && daySel >= 0 ? days[daySel] : null);
  const fams = new Set((cycleView ? model.pts : days).map((d) => d.fam).filter(Boolean));
  if (!cycleView) rows.forEach((r) => fams.add(r.fam));
  const hasPeriod = (cycleView ? model.pts : days).some((d) => d.e && isPeriodDay(d.e));
  const { diff, showStretches, worst, win } = stats;
  const hs = model?.hs;
  // the one-sentence reading of the view: under the plot on Patterns, above it (as the headline) on Home
  const callout = cycleView ? (
    <div className={`pcallout ${compact ? "top" : ""}`}>
      {hs != null && <b>Days {hs}–{hs + 4}</b>}
      <p>{hs != null ? `Across your last ${model.cyc.length} cycles, your hardest days usually fall around cycle days ${hs}–${hs + 4}. Worth planning a lighter week around them.` : "Keep logging through your next period and Cyra can show which cycle days are usually hardest for you."}</p>
    </div>
  ) : (diff != null || showStretches) ? (
    <div className={`pcallout ${compact ? "top" : ""}`}>
      {diff != null && <b>{diff > 0 ? "+" : ""}{diff}</b>}
      <p>{diff != null ? (Math.abs(diff) < 3 ? "Your weekly average is about where it was 8 weeks ago." : `Your weekly average is ${Math.abs(diff)} points ${diff > 0 ? "better" : "lower"} than 8 weeks ago.`) : ""}{showStretches ? ` Hardest stretch: ${fmt(days[worst].iso)}–${fmt(days[worst + win - 1].iso)}.` : ""}</p>
    </div>
  ) : null;
  return (
    <div className="pchart">
      {canCycle && (
        <div className="mcrow pswitch seg" role="group" aria-label="Chart view">
          <button type="button" className={`mc ${!cycleView ? "on" : ""}`} aria-pressed={!cycleView} onClick={() => setView("days")}>Day by day</button>
          <button type="button" className={`mc ${cycleView ? "on" : ""}`} aria-pressed={cycleView} onClick={() => setView("cycle")}>By cycle</button>
        </div>
      )}
      {!compact && <p className="hint phint">{cycleView ? "One ring per cycle, day 1 at the top. Bigger dots are harder days." : "Your day score; higher is a better day. Each dot takes the colour of that day's strongest symptom."}</p>}
      {compact && callout}
      {cycleView
        ? <CycleRings model={model} sel={ringSel} setSel={(i) => setSelIso(model.pts[i].iso)} />
        : <DayField days={days} rows={rows} stats={stats} sel={daySel} setSel={(i) => setSelIso(days[i].iso)} compact={compact} popIso={popIso} />}
      <FamilyLegend fams={fams} extra={cycleView
        ? <><span><i className="fsize" aria-hidden="true" />bigger = harder day</span>{hasPeriod && <span><i className="fring" aria-hidden="true" />period day</span>}</>
        : <><span><i className="fline" aria-hidden="true" />7-day average</span>{hasPeriod && <span><i className="fband" aria-hidden="true" />period</span>}{compact && <span className="ptap">tap a day for details</span>}</>} />
      {(!compact || picked) && <DayCard day={picked} ids={ids} labels={labels} starts={starts}
        empty={cycleView ? "Tap a dot to see that day." : rows.length ? "Tap a day, or a dot in a row, to see everything you logged that day. Bigger dots in the rows are stronger days." : "Tap a day to see what you logged."} />}
      {!compact && callout}
      {onMore && <p className="pline"><button type="button" className="linkbtn" onClick={onMore}>More in Patterns →</button></p>}
    </div>
  );
}
