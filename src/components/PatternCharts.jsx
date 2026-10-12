import { useState } from "react";
import { dayScore, isPeriodDay, fmt, localDay, sevDots } from "../lib/engine.js";
import { FAMILIES, SYM_FAMILY } from "../lib/constants.js";

/* Patterns charts (Patterns tab, cycle and perimenopause/menopause stages):
   - DayLine: day score for the last 60 calendar days, each day a dot in the colour of its
     strongest symptom family, the 7-day average as a line, period days shaded, and the best and
     hardest 4-day stretches labelled.
   - CycleRings: one ring per logged cycle (day 1 at the top, clockwise), dot size = how hard
     the day was, dot colour = strongest symptom family; the cycle days that are usually hardest
     are highlighted. Needs two logged period starts.
   - SymptomTimeline: one row per most-logged symptom (plus rough nights), a dot per day sized by
     severity and coloured by family.
   Everything is computed from the on-device record; nothing here is stored or sent. Every chart
   can be stepped through with the arrow keys or tapped, and a day card names what was logged, so
   colour is never the only way to read it. */

const FAM = Object.fromEntries(FAMILIES.map((f) => [f.id, f]));
const NONE = "var(--line)";
const addDays = (iso, n) => { const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + n); return localDay(d); };
const daysBetween = (a, b) => Math.round((new Date(b + "T12:00:00") - new Date(a + "T12:00:00")) / 86400000);
const wkday = (iso) => new Date(iso + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" });

/* The family of the day's strongest symptom (ties go to the first symptom in the stage's list). */
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

export function FamilyLegend({ fams, extra }) {
  return (
    <div className="flegend">
      {FAMILIES.filter((f) => fams.has(f.id)).map((f) => <span key={f.id}><i className="fdot" style={{ background: f.color }} aria-hidden="true" />{f.label}</span>)}
      {extra}
    </div>
  );
}

/* Shared pointer and keyboard handling: pick the nearest index from the pointer, step with arrows. */
function usePick(count, sel, setSel) {
  const onKeyDown = (ev) => {
    if (ev.key !== "ArrowLeft" && ev.key !== "ArrowRight") return;
    ev.preventDefault();
    const cur = sel == null ? count - 1 : sel;
    setSel(Math.max(0, Math.min(count - 1, cur + (ev.key === "ArrowRight" ? 1 : -1))));
  };
  return { onKeyDown };
}

/* ---------------- A. Day by day ---------------- */
export function DayLine({ days, ids, labels, starts }) {
  const [sel, setSel] = useState(null);
  const W = 360, H = 206, L = 28, R = 10, T = 26, B = 24, n = days.length;
  const x = (i) => L + (i / (n - 1)) * (W - L - R);
  // the scale starts a little below her lowest logged day (in tens), so the ups and downs are readable
  const minScore = Math.min(...days.filter((d) => d.score != null).map((d) => d.score), 1);
  const lo = Math.max(0, Math.floor((minScore - 0.1) * 10) / 10), span = 1 - lo;
  const y = (v) => T + (1 - (v - lo) / span) * (H - T - B);
  const ticks = [lo, lo + span / 2, 1].map((v) => Math.round(v * 100) / 100);
  const step = (W - L - R) / (n - 1);
  // 7-day average over logged days (needs 3 in the window)
  const avg = days.map((_, i) => { const w = days.slice(Math.max(0, i - 6), i + 1).filter((d) => d.score != null); return w.length >= 3 ? w.reduce((a, d) => a + d.score, 0) / w.length : null; });
  let path = "", pen = false;
  avg.forEach((v, i) => { if (v == null) { pen = false; return; } path += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`; pen = true; });
  // best / hardest 4-day stretch (needs 3 logged days in it)
  const win = 4; let best = null, worst = null, bv = -1, wv = 2;
  for (let i = 0; i <= n - win; i++) {
    const w = days.slice(i, i + win).filter((d) => d.score != null);
    if (w.length < 3) continue;
    const m = w.reduce((a, d) => a + d.score, 0) / w.length;
    if (m > bv) { bv = m; best = i; }
    if (m < wv) { wv = m; worst = i; }
  }
  const logged = days.filter((d) => d.score != null);
  const showStretches = best != null && worst != null && bv - wv >= 0.08;
  const weekMean = (from, to) => { const w = days.slice(from, to).filter((d) => d.score != null); return w.length >= 3 ? w.reduce((a, d) => a + d.score, 0) / w.length : null; };
  const first = weekMean(0, 7), last = weekMean(n - 7, n);
  const diff = first != null && last != null ? Math.round((last - first) * 100) : null;
  const fams = new Set(days.map((d) => d.fam).filter(Boolean));
  const pick = (ev) => { const r = ev.currentTarget.getBoundingClientRect(); const px = ((ev.clientX - r.left) / r.width) * W; return Math.max(0, Math.min(n - 1, Math.round((px - L) / step))); };
  const { onKeyDown } = usePick(n, sel, setSel);
  const label = (i, above) => {
    const cx = x(i + (win - 1) / 2), anchor = cx > W - 70 ? "end" : cx < L + 60 ? "start" : "middle";
    return { x: Math.min(W - R, Math.max(L, cx)), anchor, y: above ? 12 : H - 4 };
  };
  const bl = best != null ? label(best, true) : null, wl = worst != null ? label(worst, false) : null;
  const summary = `Day score for the last 60 days, ${logged.length} days logged.${diff != null ? ` Weekly average ${diff >= 0 ? "up" : "down"} ${Math.abs(diff)} points since the first week.` : ""}${showStretches ? ` Best stretch from ${fmt(days[best].iso)}, hardest from ${fmt(days[worst].iso)}.` : ""} Use the left and right arrow keys to step through days.`;
  return (
    <div className="pchart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={summary} tabIndex={0} className="psvg"
        onPointerMove={(ev) => setSel(pick(ev))} onPointerDown={(ev) => setSel(pick(ev))} onKeyDown={onKeyDown}>
        <g style={{ color: "var(--ink)" }}>
          {days.map((d, i) => d.e && isPeriodDay(d.e) && <rect key={`p${i}`} x={x(i) - step / 2} y={T} width={step} height={H - T - B} fill="currentColor" fillOpacity={0.07} />)}
          {ticks.map((v) => (
            <g key={v}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeWidth={1} /><text x={L - 6} y={y(v) + 3.5} textAnchor="end" className="ptick">{Math.round(v * 100)}</text></g>
          ))}
          {showStretches && [[best, bl, "Best stretch"], [worst, wl, "Hardest"]].map(([i, lb, t]) => (
            <g key={t}>
              <rect x={x(i) - 3} y={T} width={x(i + win - 1) - x(i) + 6} height={H - T - B} rx={4} fill="none" stroke="var(--soft)" strokeDasharray="3 3" />
              <text x={lb.x} y={lb.y} textAnchor={lb.anchor} className="pnote">{t} · {fmt(days[i].iso)}</text>
            </g>
          ))}
          {path && <path d={path} fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" opacity={0.85} />}
          {days.map((d, i) => d.score != null && (
            <circle key={`d${i}`} cx={x(i)} cy={y(d.score)} r={3.4} fill={d.fam ? FAM[d.fam].color : NONE} stroke="var(--card)" strokeWidth={1.2} />
          ))}
          {sel != null && (
            <g pointerEvents="none">
              <line x1={x(sel)} x2={x(sel)} y1={T} y2={H - B} stroke="currentColor" strokeOpacity={0.35} />
              {days[sel].score != null && <circle cx={x(sel)} cy={y(days[sel].score)} r={6} fill="none" stroke="currentColor" strokeWidth={2} />}
            </g>
          )}
          <text x={L} y={H - 4} className="ptick" textAnchor="start" style={{ display: showStretches && wl.anchor === "start" ? "none" : undefined }}>{fmt(days[0].iso)}</text>
          <text x={W - R} y={H - 4} className="ptick" textAnchor="end" style={{ display: showStretches && wl.anchor === "end" ? "none" : undefined }}>Today</text>
        </g>
      </svg>
      <FamilyLegend fams={fams} extra={<>
        <span><i className="fline" aria-hidden="true" />7-day average</span>
        {days.some((d) => d.e && isPeriodDay(d.e)) && <span><i className="fband" aria-hidden="true" />period</span>}
      </>} />
      <DayCard day={sel != null ? days[sel] : null} ids={ids} labels={labels} starts={starts} empty="Tap a day to see what you logged. Each dot's colour is that day's strongest symptom." />
      {(diff != null || showStretches) && (
        <div className="pcallout">
          {diff != null && <b>{diff > 0 ? "+" : ""}{diff}</b>}
          <p>{diff != null ? (Math.abs(diff) < 3 ? "Your weekly average is about where it was 8 weeks ago." : `Your weekly average is ${Math.abs(diff)} points ${diff > 0 ? "better" : "lower"} than 8 weeks ago.`) : ""}{showStretches ? ` Hardest stretch: ${fmt(days[worst].iso)}–${fmt(days[worst + win - 1].iso)}.` : ""}</p>
        </div>
      )}
    </div>
  );
}

/* ---------------- B. By cycle ---------------- */
export function CycleRings({ sorted, ids, labels, starts, todayIso }) {
  const [sel, setSel] = useState(null);
  const by = new Map(sorted.map((d) => [d.date, d]));
  // the last 4 cycles that began with a logged start; the newest runs to today
  const cyc = starts.slice(-4).map((s, i, arr) => {
    const next = starts[starts.indexOf(s) + 1];
    const end = next ? addDays(next, -1) : todayIso;
    const len = Math.min(45, daysBetween(s, end) + 1);
    return { start: s, days: Array.from({ length: len }, (_, k) => { const iso = addDays(s, k), e = by.get(iso) || null; return { iso, cd: k + 1, e, score: e ? dayScore(e, ids) : null, fam: dominantFamily(e, ids) }; }), last: i === arr.length - 1 };
  });
  const S = 340, cx = S / 2, cy = S / 2;
  const MAXD = Math.max(35, ...cyc.map((c) => c.days.length));
  const r0 = 70, gap = cyc.length > 1 ? Math.min(26, 62 / (cyc.length - 1)) : 0;
  const ang = (cd) => ((cd - 1) / MAXD) * Math.PI * 2 - Math.PI / 2;
  const pts = [];
  cyc.forEach((c, ci) => c.days.forEach((d) => { const r = r0 + gap * ci, a = ang(d.cd); pts.push({ ...d, ci, px: cx + Math.cos(a) * r, py: cy + Math.sin(a) * r }); }));
  // hardest 5-day window of cycle days, from at least 2 cycles and 6 logged days
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
  const fams = new Set(pts.map((p) => p.fam).filter(Boolean));
  const pick = (ev) => {
    const r = ev.currentTarget.getBoundingClientRect(), px = ((ev.clientX - r.left) / r.width) * S, py = ((ev.clientY - r.top) / r.height) * S;
    let bi = null, bd = 24 * 24;
    pts.forEach((p, i) => { const dd = (p.px - px) ** 2 + (p.py - py) ** 2; if (dd < bd) { bd = dd; bi = i; } });
    return bi;
  };
  const { onKeyDown } = usePick(pts.length, sel, setSel);
  const summary = `${cyc.length} cycles drawn as rings, day 1 at the top.${hs != null ? ` Your hardest days usually fall around cycle days ${hs} to ${hs + 4}.` : ""} Use the left and right arrow keys to step through days.`;
  return (
    <div className="pchart">
      <svg viewBox={`0 0 ${S} ${S}`} role="img" aria-label={summary} tabIndex={0} className="psvg"
        onPointerMove={(ev) => { const i = pick(ev); if (i != null) setSel(i); }} onPointerDown={(ev) => { const i = pick(ev); if (i != null) setSel(i); }} onKeyDown={onKeyDown}>
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
      <FamilyLegend fams={fams} extra={<><span><i className="fsize" aria-hidden="true" />bigger = harder day</span><span><i className="fring" aria-hidden="true" />period day</span></>} />
      <DayCard day={sel != null ? pts[sel] : null} ids={ids} labels={labels} starts={starts} empty="Tap a dot to see that day." />
      <div className="pcallout">
        {hs != null && <b>Days {hs}–{hs + 4}</b>}
        <p>{hs != null ? `Across your last ${cyc.length} cycles, your hardest days usually fall around cycle days ${hs}–${hs + 4}. Worth planning a lighter week around them.` : "Keep logging through your next period and Cyra can show which cycle days are usually hardest for you."}</p>
      </div>
    </div>
  );
}

/* ---------------- C. What showed up, and when ---------------- */
export function SymptomTimeline({ days, ids, labels, starts }) {
  const [sel, setSel] = useState(null);
  const n = days.length;
  const count = (k) => days.filter((d) => (d.e?.sym?.[k] || 0) > 0).length;
  const top = ids.map((k) => ({ k, c: count(k) })).filter((o) => o.c > 0).sort((a, b) => b.c - a.c).slice(0, 6);
  const nights = days.filter((d) => d.e?.sleepQ === "poor").length;
  const rows = [...(nights ? [{ k: "_poor", label: "Rough nights", fam: "sleep", c: nights, v: (d) => (d.e?.sleepQ === "poor" ? 2 : 0) }] : []),
    ...top.map((o) => ({ k: o.k, label: labels[o.k] || o.k, fam: SYM_FAMILY[o.k] || "body", c: o.c, v: (d) => d.e?.sym?.[o.k] || 0 }))];
  const W = 360, L = 92, R = 26, T = 6, rh = 26, H = T + rows.length * rh + 20;
  const x = (i) => L + (i / (n - 1)) * (W - L - R), step = (W - L - R) / (n - 1);
  const pick = (ev) => { const r = ev.currentTarget.getBoundingClientRect(), px = ((ev.clientX - r.left) / r.width) * W; return px < L - 6 ? null : Math.max(0, Math.min(n - 1, Math.round((px - L) / step))); };
  const { onKeyDown } = usePick(n, sel, setSel);
  if (!rows.length) return null;
  const fams = new Set(rows.map((r) => r.fam));
  const summary = `What showed up over the last 60 days: ${rows.map((r) => `${r.label} on ${r.c} days`).join(", ")}. Use the left and right arrow keys to step through days.`;
  return (
    <div className="pchart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={summary} tabIndex={0} className="psvg"
        onPointerMove={(ev) => { const i = pick(ev); if (i != null) setSel(i); }} onPointerDown={(ev) => { const i = pick(ev); if (i != null) setSel(i); }} onKeyDown={onKeyDown}>
        <g style={{ color: "var(--ink)" }}>
          {days.map((d, i) => d.e && isPeriodDay(d.e) && <rect key={`p${i}`} x={x(i) - step / 2} y={T} width={step} height={rows.length * rh} fill="currentColor" fillOpacity={0.07} />)}
          {rows.map((r, ri) => {
            const yy = T + ri * rh + rh / 2;
            return (
              <g key={r.k}>
                <line x1={L} x2={W - R} y1={yy} y2={yy} stroke="var(--line)" strokeWidth={1} />
                <text x={0} y={yy + 3.5} className="prow">{r.label}</text>
                <text x={W} y={yy + 3.5} textAnchor="end" className="ptick">{r.c}d</text>
                {days.map((d, i) => { const v = r.v(d); return v ? <circle key={i} cx={x(i)} cy={yy} r={1.3 + v * 1.25} fill={FAM[r.fam].color} /> : null; })}
              </g>
            );
          })}
          {sel != null && <rect x={x(sel) - Math.max(step, 4) / 2} y={T} width={Math.max(step, 4)} height={rows.length * rh} rx={2} fill="none" stroke="currentColor" strokeOpacity={0.45} pointerEvents="none" />}
          <text x={L} y={H - 4} className="ptick">{fmt(days[0].iso)}</text>
          <text x={L + (W - L - R) / 2} y={H - 4} textAnchor="middle" className="ptick">{fmt(days[Math.floor(n / 2)].iso)}</text>
          <text x={W - R} y={H - 4} textAnchor="end" className="ptick">Today</text>
        </g>
      </svg>
      <FamilyLegend fams={fams} extra={days.some((d) => d.e && isPeriodDay(d.e)) && <span><i className="fband" aria-hidden="true" />period</span>} />
      <DayCard day={sel != null ? days[sel] : null} ids={ids} labels={labels} starts={starts} empty="Tap a day to see everything you logged. Bigger dots are stronger days; the number on the right is how many days in 60." />
    </div>
  );
}
