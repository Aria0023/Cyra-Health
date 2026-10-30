import { rampVar } from "../../lib/constants.js";
import { tickAt } from "../../lib/potsReport.js";
import { fmtDate } from "../../lib/i18n.js";

/* Stand-test charts (design 4.8.6, 5.8). Inline SVG, role="img", with an aria-label that holds
   the whole series, so the chart never carries meaning a screen reader can't get. Data colour
   comes from the data-viz ramp only (--ramp-* from vizVars: the stage's ramp, its dark steps in
   dark mode); chrome (dashed reference lines, text) comes from the palette (var(--ink)). Value
   labels sit on every point, so nothing depends on colour alone. */
/** A number as the result shows it: whole, or one decimal (a two-reading baseline can end in .5). */
export const fmtN = (x) => (Number.isInteger(x) ? String(x) : String(Math.round(x * 10) / 10));
const fmtM = (m) => (Number.isInteger(m) ? String(m) : String(Math.round(m * 10) / 10));

/** Heart rate by minute for one test: the lying baseline and the threshold line (dashed, ink),
    the upright readings as a line with point markers and value labels (ramp().rough). */
export function HrChart({ test, result }) {
  const pts = (test.up || []).filter((r) => Number.isFinite(r.hr) && Number.isFinite(r.min)).sort((a, b) => a.min - b.min);
  if (!pts.length) return null;
  const base = result.baseHr, thr = result.thr;
  const W = 340, H = 214, L = 22, R = 14, T = 18, B = 62;
  const vals = [...pts.map((r) => r.hr), ...(base != null ? [base, base + thr] : [])];
  const lo = Math.floor((Math.min(...vals) - 8) / 10) * 10, hi = Math.ceil((Math.max(...vals) + 8) / 10) * 10;
  const maxMin = Math.max(10, ...pts.map((r) => r.min));
  const x = (m) => L + (m / maxMin) * (W - L - R), y = (v) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const line = rampVar("rough");
  // A value label sits above its point, or below it when the baseline, threshold or axis line
  // would run through the digits (a reading just under the threshold, say).
  const rules = [H - B, ...(base != null ? [y(base), y(base + thr)] : [])];
  const clear = (ty) => rules.every((ry) => ry < ty - 11 || ry > ty + 3);
  const labelY = (v) => (clear(y(v) - 8) || !clear(y(v) + 16) ? y(v) - 8 : y(v) + 16);
  const label = `Heart rate ${base != null ? `lying ${fmtN(base)}; ` : ""}${pts.map((r) => `minute ${fmtM(r.min)}, ${r.hr}`).join("; ")}${base != null ? `; threshold ${thr} above lying` : ""}.`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={label} style={{ display: "block", margin: "6px 0 10px" }}>
      <line x1={L} y1={H - B} x2={W - R} y2={H - B} stroke="var(--line)" strokeWidth="1.5" />
      {[0, 1, 3, 5, 10].filter((m) => m <= maxMin).map((m) => <text key={m} x={x(m)} y={H - B + 15} fontSize="11" textAnchor="middle" fill="var(--ink)">{m}</text>)}
      <text x={(L + W - R) / 2} y={H - B + 30} fontSize="11" textAnchor="middle" fill="var(--ink)">minutes upright</text>
      {base != null && (
        <>
          <line x1={L} y1={y(base)} x2={W - R} y2={y(base)} stroke="var(--ink)" strokeWidth="1.2" strokeDasharray="4 4" />
          <line x1={L} y1={y(base + thr)} x2={W - R} y2={y(base + thr)} stroke="var(--ink)" strokeWidth="1.2" strokeDasharray="1.5 4" />
          {/* Labels for the two reference lines sit in a key under the chart, clear of the data. */}
          <line x1={L} y1={H - 10} x2={L + 22} y2={H - 10} stroke="var(--ink)" strokeWidth="1.2" strokeDasharray="4 4" />
          <text x={L + 28} y={H - 6} fontSize="11" fill="var(--ink)">{`${test.restPos === "left" ? "Lying on left side" : "Lying"} ${fmtN(base)}`}</text>
          <line x1={W / 2 + 6} y1={H - 10} x2={W / 2 + 28} y2={H - 10} stroke="var(--ink)" strokeWidth="1.2" strokeDasharray="1.5 4" />
          <text x={W / 2 + 34} y={H - 6} fontSize="11" fill="var(--ink)">{`+${thr} clinician threshold`}</text>
        </>
      )}
      <polyline points={pts.map((r) => `${x(r.min)},${y(r.hr)}`).join(" ")} fill="none" stroke={line} strokeWidth="2.5" strokeLinejoin="round" />
      {pts.map((r) => (
        <g key={r.min}>
          <circle cx={x(r.min)} cy={y(r.hr)} r="4" fill={line} />
          <text x={x(r.min)} y={labelY(r.hr)} fontSize="11" fontWeight="700" textAnchor="middle" fill="var(--ink)">{r.hr}</text>
        </g>
      ))}
    </svg>
  );
}

/** Stand tests over time for one method (design 5.8): each test's largest rise as a dot, a
    dashed threshold line, value labels. Dots at or above the threshold use ramp().rough, the
    rest ramp().good. */
export function TrendChart({ rows, thr, methodLabel }) {
  if (rows.length < 2) return null;
  const W = 340, H = 150, L = 22, R = 34, T = 18, B = 30;
  const vals = [...rows.map((r) => r.rise), thr, 0];
  const lo = Math.floor(Math.min(...vals) / 10) * 10, hi = Math.ceil((Math.max(...vals) + 6) / 10) * 10;
  const x = (i) => (rows.length === 1 ? (L + W - R) / 2 : L + (i / (rows.length - 1)) * (W - L - R)), y = (v) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const day = (iso) => fmtDate(iso, { month: "short", day: "numeric" });
  // As in HrChart: a value label goes below its dot when the threshold line would cross it.
  const labelY = (v) => { const ty = y(v) - 9, ry = y(thr); return ry < ty - 11 || ry > ty + 3 ? ty : y(v) + 17; };
  const tick = rows.length <= 6 ? () => true : tickAt(rows.length, (W - L - R) / (rows.length - 1), 34, Math.ceil(rows.length / 6));
  const label = `Heart-rate rise over your ${methodLabel} tests: ${rows.map((r) => `${day(r.date)}, ${fmtN(r.rise)}`).join("; ")}; threshold ${thr}.`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={label} style={{ display: "block", margin: "6px 0 8px" }}>
      <line x1={L} y1={y(thr)} x2={W - R} y2={y(thr)} stroke="var(--ink)" strokeWidth="1.2" strokeDasharray="4 4" />
      <text x={W - 2} y={y(thr) + 4} fontSize="11" textAnchor="end" fill="var(--ink)">{`+${thr}`}</text>
      {rows.map((r, i) => {
        const c = r.rise >= thr ? rampVar("rough") : rampVar("good");
        return (
          <g key={r.id}>
            <circle cx={x(i)} cy={y(r.rise)} r="5" fill={c} />
            <text x={x(i)} y={labelY(r.rise)} fontSize="11" fontWeight="700" textAnchor="middle" fill="var(--ink)">{fmtN(r.rise)}</text>
            {tick(i) && <text x={x(i)} y={H - 10} fontSize="10.5" textAnchor="middle" fill="var(--ink)">{day(r.date)}</text>}
          </g>
        );
      })}
    </svg>
  );
}
