import { useState } from "react";
import { Card } from "./ui/index.js";
import { weekTrend, sparkPoints, cycleBuckets } from "../lib/home.js";
import { famVar, SYM_FAMILY } from "../lib/constants.js";
import { t } from "../lib/i18n.js";

/* Home v2 (calm R3): the compact, word-based patterns preview. Day by day: a soft sparkline of her 7-day trend (higher =
   lighter days; no axis, no numbers) and one sentence against her usual. By cycle (once two period starts are logged):
   soft bars per phase, placed from her own cycle lengths, and one sentence. Underneath, what has been showing up most
   lately, each with its symptom family's colour (data-viz colours, never the UI palette). The full chart lives in
   Patterns. days: windowDays(...) (oldest → newest, { iso, e, score }). */
const W = 300, H = 72, PAD = 6;
function pathOf(pts, n) {
  if (pts.length < 2) return null;
  const lo = Math.min(...pts.map((p) => p.v)), hi = Math.max(...pts.map((p) => p.v));
  const span = Math.max(hi - lo, 0.12), mid = (hi + lo) / 2;
  const xy = pts.map((p) => [PAD + (p.i / Math.max(1, n - 1)) * (W - 2 * PAD), H / 2 - ((p.v - mid) / span) * (H - 2 * PAD - 8)]);
  let d = `M${xy[0][0].toFixed(1)} ${xy[0][1].toFixed(1)}`;
  for (let i = 1; i < xy.length; i++) {
    const [x0, y0] = xy[Math.max(0, i - 2)], [x1, y1] = xy[i - 1], [x2, y2] = xy[i], [x3, y3] = xy[Math.min(xy.length - 1, i + 1)];
    const c1 = [x1 + (x2 - x0) / 6, y1 + (y2 - y0) / 6], c2 = [x2 - (x3 - x1) / 6, y2 - (y3 - y1) / 6];
    d += ` C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`;
  }
  const last = xy[xy.length - 1];
  return { line: d, area: `${d} L${last[0].toFixed(1)} ${H} L${xy[0][0].toFixed(1)} ${H} Z`, last };
}
/* What showed up on the most days in the last 14 days (top 3). */
function lately(days, ids, labels) {
  const recent = days.slice(-14).filter((d) => d.e);
  return ids.map((id) => ({ id, label: labels[id] || id, n: recent.filter((d) => (d.e.sym?.[id] || 0) > 0).length }))
    .filter((r) => r.n > 0).sort((a, b) => b.n - a.n).slice(0, 3);
}
const RANK = (bars) => {
  const have = bars.filter((b) => b.v != null);
  const hi = have.length ? Math.max(...have.map((b) => b.v)) : 0, lo = have.length ? Math.min(...have.map((b) => b.v)) : 0;
  return (b) => (b.v == null ? "not enough days yet" : have.length < 2 || hi - lo < 0.04 ? "about the same" : b.v === hi ? "lightest" : b.v === lo ? "heaviest" : "in between");
};

export default function HomePatterns({ days, ids, labels, starts = [], curLen = 28, onMore = null }) {
  const [view, setView] = useState("days");
  const logged = days.filter((d) => d.e).length;
  const canCycle = starts.length >= 2;
  const cycleView = canCycle && view === "cycle";
  const trend = weekTrend(days);
  const path = pathOf(sparkPoints(days), days.length);
  const cyc = cycleView ? cycleBuckets(days, starts, curLen) : null;
  const rank = cyc ? RANK(cyc.bars) : null;
  const top = lately(days, ids, labels);
  // Low data: Today's insight already carries the calm empty line, so the preview waits until three days are logged.
  if (logged < 3) return null;
  const vmax = cyc ? Math.max(...cyc.bars.map((b) => b.v ?? 0)) : 0, vmin = cyc ? Math.min(...cyc.bars.filter((b) => b.v != null).map((b) => b.v)) : 0;
  return (
    <Card className="homepatterns" title={t("homePatterns.yourPatterns")} eyebrow={t("homePatterns.last60Days")} icon="patterns" tint="patterns" level={2}
      action={onMore && <button type="button" className="linkbtn hpmore" onClick={onMore}>{t("homePatterns.moreInPatterns")}<span aria-hidden="true">&nbsp;→</span></button>}>
      {(
        <>
          {canCycle && (
            <div className="mcrow pswitch seg hpswitch" role="group" aria-label={t("homePatterns.chartView")}>
              <button type="button" className={`mc ${!cycleView ? "on" : ""}`} aria-pressed={!cycleView} onClick={() => setView("days")}>{t("homePatterns.dayByDay")}</button>
              <button type="button" className={`mc ${cycleView ? "on" : ""}`} aria-pressed={cycleView} onClick={() => setView("cycle")}>{t("homePatterns.byCycle")}</button>
            </div>
          )}
          {cycleView ? (
            <figure className="hpfig">
              <div className="hpbars" aria-hidden="true">
                {cyc.bars.map((b, i) => (
                  <div className="hpbar" key={b.id}>
                    <i className={b.v == null ? "none" : `s${1 + Math.round(((b.v - vmin) / Math.max(0.0001, vmax - vmin)) * 2)}`} style={{ height: b.v == null ? "14%" : `${28 + ((b.v - vmin) / Math.max(0.04, vmax - vmin)) * 72}%`, animationDelay: `${i * 60}ms` }} />
                    <span>{b.label}</span>
                  </div>
                ))}
              </div>
              <figcaption>
                <p className="hpsentence">{cyc.sentence}</p>
                <ul className="sr-only">{cyc.bars.map((b) => <li key={b.id}>{b.label}: {rank(b)}</li>)}</ul>
                <p className="hplegend"><i className="hpkey bar" aria-hidden="true" />{t("homePatterns.tallerBarsLighterDaysPhases")}</p>
              </figcaption>
            </figure>
          ) : (
            <figure className="hpfig">
              {path && (
                <div className="hpplot">
                <svg className="hpspark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
                  <defs>
                    <linearGradient id="hpfill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" style={{ stopColor: "var(--soft-2)", stopOpacity: 0.42 }} />
                      <stop offset="1" style={{ stopColor: "var(--soft-1)", stopOpacity: 0 }} />
                    </linearGradient>
                    <linearGradient id="hpline" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0" style={{ stopColor: "var(--soft-1)" }} />
                      <stop offset="1" style={{ stopColor: "var(--soft-3)" }} />
                    </linearGradient>
                  </defs>
                  <path className="hparea" d={path.area} fill="url(#hpfill)" />
                  <path className="hpline" d={path.line} fill="none" stroke="url(#hpline)" strokeWidth="3" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                </svg>
                <span className="hpdot" aria-hidden="true" style={{ left: `${(path.last[0] / W) * 100}%`, top: `${(path.last[1] / H) * 100}%` }} />
                </div>
              )}
              <div className="hpends" aria-hidden="true"><span>{t("homePatterns.8WeeksAgo")}</span><span>{t("homePatterns.today")}</span></div>
              <figcaption>
                <p className="hpsentence">{trend.sentence}</p>
                <p className="hplegend"><i className="hpkey" aria-hidden="true" />{t("homePatterns.your7DayTrendHigher")}</p>
              </figcaption>
            </figure>
          )}
          {top.length > 0 && (
            <div className="hplately">
              <span className="hplab">{t("homePatterns.showingUpMostLately")}</span>
              <ul>{top.map((r) => <li key={r.id}><i className="fdot" aria-hidden="true" style={{ background: famVar(SYM_FAMILY[r.id] || "body") }} />{r.label}</li>)}</ul>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
