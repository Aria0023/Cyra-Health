import { useMemo, useState } from "react";
import {
  patterns, sinceOffered, paceText, isCycleStage, medLine, RATING_WORD,
  TODAY_NOTE, WEEK_NOTE, TREND_NOTE, CYCLE_NOTE, CYCLE_PERI, PREG_NOTE, MED_ADVICE,
} from "../../lib/potsPatterns.js";
import { fmtFluid, fmtSodium, activeMeds } from "../../lib/pots.js";
import { THRESH } from "../../lib/potsConstants.js";
import { rampVar } from "../../lib/constants.js";
import { platform } from "../../lib/native.js";
import Advice from "../Advice.jsx";
import Details from "../Details.jsx";
import { TrendChart, fmtN } from "./HrChart.jsx";
import { Choice } from "./StandSafety.jsx";
import { resultFor, riseText, methodWord } from "./StandResult.jsx";
import { SEV_WORD, naText } from "./ui.js";
import { fmtDate } from "../../lib/i18n.js";

/* POTS → Patterns (design 5.5): what her own log shows, worked out on this device by
   lib/potsPatterns.js at render and never stored. Windows: Today, 7 days, 30 days (default) and,
   once there are more than 60 days, Since you started.

   - Every comparison uses her own day rating (rough = Rough or Bad) among rated days, and holds
     back until there is enough data (A13.5): no card is a guess from a handful of days.
   - Copy uses natural frequencies, names chance, and never diagnoses.
   - Watch and ring readings (wearData) appear here only, on screen, with the tag "shown here
     only, never in your report". The report runs the same engine without them.
   - Cycle groups come from logged period starts only (no predicted ovulation), and only in My
     Cycle, Trying to Conceive and Perimenopause. Pregnancy and Menopause have no cycle card. */
const short = (iso) => fmtDate(iso, { weekday: "short", month: "short", day: "numeric" });
/** "Mon 5", kept on one line: the 7-day table's Day column (the week never repeats a weekday). */
const weekDay = (iso) => { const d = new Date(`${iso}T12:00:00`); return `${fmtDate(d, { weekday: "short" })}\u00a0${d.getDate()}`; };
const lc1 = (s) => (s ? s[0].toLowerCase() + s.slice(1) : s);
/** The device a watch or ring reading came from, as the card tag names it. */
const wearName = (src) => (src === "healthkit" ? (platform() === "android" ? "watch" : "Apple Watch") : src === "oura" ? "ring" : "wearable");
export const WEAR_CARD_TAG = (src) => `From your ${wearName(src)} · shown here only, never in your report.`;
export const WEAR_ROW_NOTE = (src) => `From your ${wearName(src)} · shown here only, not in reports.`;
export const HEAT_LINE = "Heard Health doesn't look up the weather, because that would send your location to a weather service. Tag heat yourself when it bothers you.";
const WEAR_CHECKED = "Watch and ring: HRV is compared only when exactly one watch or ring is connected, and only over its own readings, because devices measure it differently. Resting heart rate and sleep score use the device that sent most of the days.";

/** Rich text: strings and { b } (bold) segments. */
const Parts = ({ parts }) => parts.map((x, i) => (typeof x === "string" ? <span key={i}>{x}</span> : <b key={i}>{x.b}</b>));

/** Horizontal bars, one per day (fill ramp().mid; a day not logged has no bar), with her goal
    as a thin ink tick. The whole series is in the aria-label. */
function DayBars({ title, days, get, fmt, goal, label }) {
  const vals = days.map(get);
  const max = Math.max(1, goal || 0, ...vals.filter((v) => v != null)) * 1.05;
  return (
    <>
      <p className="plain" style={{ margin: "10px 0 4px" }}><b>{title}</b></p>
      <div className="bars" role="img" aria-label={label}>
        {days.map((d, i) => (
          <div key={d.date} className="brow" style={{ gridTemplateColumns: "84px 1fr 64px" }}>
            <span className="blab">{short(d.date)}</span>
            <div className="btrack" style={{ position: "relative" }}>
              {vals[i] != null && <div className="bfill" style={{ width: `${(vals[i] / max) * 100}%`, background: rampVar("mid") }} />}
              {goal != null && <div style={{ position: "absolute", top: 0, bottom: 0, left: `${(goal / max) * 100}%`, width: 2, background: "var(--ink)" }} />}
            </div>
            <span className="bval" style={{ color: "var(--ink)" }}>{vals[i] == null ? "—" : fmt(vals[i])}</span>
          </div>
        ))}
      </div>
    </>
  );
}

/** "Planned doses logged: 2 of 3 · other doses 1": the planned slots of today's medicines with a
    dose logged taken (each slot once, however often it was logged) against the slots planned,
    and every other taken dose apart (a medicine without times, a slot logged again, a medicine
    not on today's plan), so the first number can never pass the second. */
function doseLine(pots, iso) {
  const taken = (((pots.days || {})[iso] || {}).doses || []).filter((d) => d.state === "taken");
  const planned = new Set(activeMeds(pots, iso).filter((m) => m.kind !== "aid").flatMap((m) => m.times.map((t) => `${m.id} ${t}`)));
  if (!planned.size) return `Doses logged: ${taken.length}`;
  const done = new Set(taken.map((d) => `${d.medId} ${d.slot}`).filter((k) => planned.has(k)));
  const other = taken.length - done.size;
  return `Planned doses logged: ${done.size} of ${planned.size}${other ? ` · other doses ${other}` : ""}`;
}

function TodayView({ pots, pat, nowMin, stage, cyc }) {
  const t = pat.today, tot = t.totals, g = tot.goals, units = pots.settings.units;
  const fluid = tot.fluidMl == null ? "Fluids: nothing logged yet" : `Fluids ${fmtFluid(tot.fluidMl, units)}${g.fluidMl != null ? ` of your ${fmtFluid(g.fluidMl, units)}` : ""}`;
  const na = tot.naMg == null ? "Sodium: nothing logged yet" : `Sodium ${fmtSodium(tot.naMg, units)}${g.naMg != null ? ` of your ${fmtSodium(g.naMg, units)}` : ""}`;
  const lines = [
    fluid, na,
    t.rating ? `How's today: ${RATING_WORD[t.rating]}` : "How's today: not rated yet",
    t.sym.length ? `Symptoms: ${t.sym.map((s) => `${s.label} (${SEV_WORD[s.sev]})`).join(", ")}` : "Symptoms: none logged",
    `Episodes: ${t.eps}${t.faints || t.nearFaints ? ` (${[t.faints ? `fainted ${t.faints}` : null, t.nearFaints ? `almost fainted ${t.nearFaints}` : null].filter(Boolean).join(", ")})` : ""}`,
    doseLine(pots, pat.range.to),
    ...(t.test ? [`Stand test: ${riseText(t.test, resultFor(pots, t.test, stage, cyc))}`] : []),
  ];
  return (
    <>
      <p className="lab" id="pots-pat-today">Today so far</p>
      <div className="plaincard" role="group" aria-labelledby="pots-pat-today">
        <ul className="rlist" style={{ fontSize: 14 }}>{lines.map((l) => <li key={l}>{l}</li>)}</ul>
      </div>
      <p className="plain">{paceText(pat.pace, nowMin, units)}</p>
      <p className="rfoot">{TODAY_NOTE}</p>
    </>
  );
}

function WeekView({ pots, pat }) {
  const w = pat.week, units = pots.settings.units, g = pots.settings.goals;
  const naFmt = (v) => fmtSodium(v, units);
  return (
    <>
      <div className="potstablewrap" role="region" aria-label="Your last 7 days" tabIndex={0}>
        <table className="rtab potsrtab">
          <caption>Your last 7 days</caption>
          <thead><tr><th scope="col">Day</th><th scope="col">How it was</th><th scope="col">Fluids</th><th scope="col">Sodium</th><th scope="col">Episodes</th><th scope="col">Stand test</th></tr></thead>
          <tbody>
            {[...w.days].reverse().map((d) => (
              <tr key={d.date}>
                <td>{weekDay(d.date)}</td>
                <td>{d.rating ? RATING_WORD[d.rating] : "not rated"}</td>
                <td>{d.fluidMl == null ? "not logged" : fmtFluid(d.fluidMl, units)}</td>
                <td>{d.naMg == null ? "not logged" : naFmt(d.naMg)}</td>
                <td>{d.logged ? d.eps : "—"}</td>
                <td>{d.test ? "yes" : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <DayBars title={`Fluids${g.fluidMl != null ? " (line: your goal)" : ""}`} days={w.days} get={(d) => d.fluidMl} fmt={(v) => fmtFluid(v, units)} goal={g.fluidMl}
        label={`Fluids per day: ${w.days.map((d) => `${short(d.date)}, ${d.fluidMl == null ? "not logged" : fmtFluid(d.fluidMl, units)}`).join("; ")}${g.fluidMl != null ? `; goal ${fmtFluid(g.fluidMl, units)}` : ""}.`} />
      <DayBars title={`Sodium${g.naMg != null ? " (line: your goal)" : ""}`} days={w.days} get={(d) => d.naMg} fmt={naFmt} goal={g.naMg}
        label={`Sodium per day: ${w.days.map((d) => `${short(d.date)}, ${d.naMg == null ? "not logged" : naText(d.naMg, units)}`).join("; ")}${g.naMg != null ? `; goal ${naText(g.naMg, units)}` : ""}.`} />
      <p className="plain" style={{ marginTop: 12 }}>{w.line}</p>
      <p className="rfoot">{WEEK_NOTE}</p>
    </>
  );
}

function Card({ c }) {
  return (
    <div className="icard">
      <div className="card" style={{ marginBottom: 0 }}>
        <div className="num">{c.num}</div>
        <div>
          <p><Parts parts={c.parts} /></p>
          {(c.repeated || c.src) && (
            <p className="hint" style={{ margin: "6px 0 0" }}>{[c.repeated ? "Seen last month too." : null, c.src ? WEAR_CARD_TAG(c.src) : null].filter(Boolean).join(" ")}</p>
          )}
        </div>
      </div>
      <Advice urgency={c.urgency}>{c.advice}</Advice>
    </div>
  );
}

function MonthView({ pots, pat, stage, stageName, outcome, setOutcome, window }) {
  const gvr = pat.goodVsRough, cycleStage = isCycleStage(stage, stageName);
  const known = pat.outcome ? pat.rows.filter((r) => r.symAny).length : pat.rated;
  const wearUsed = pat.cards.some((c) => c.src) || (gvr.rows || []).some((r) => r.wear) || pat.checked.some((x) => x.key.startsWith("wear:"));
  const inLast = window === "all" ? "since you started" : "in the last 30";
  return (
    <>
      {pat.outcomes.length > 0 && (
        <Choice id="pots-pat-outcome" label="Compare" value={outcome && pat.outcome === outcome ? outcome : null} onPick={setOutcome}
          options={[[null, "Rough days"], ...pat.outcomes.map((o) => [o.id, `Days with ${o.id.startsWith("p_") ? lc1(o.label) : o.label} moderate or strong`])]} />
      )}
      <h3 className="lab" id="pots-pat-cards">What stood out</h3>
      {known < THRESH.pat.rated && (
        <p className="plain">{pat.outcome
          ? `Heard Health compares once it has at least ${THRESH.pat.rated} days with symptoms logged in this window. There are ${known} so far.`
          : `Heard Health compares days once you've rated at least ${THRESH.pat.rated} in this window. You've rated ${known} so far.`}</p>
      )}
      {pat.cards.length ? pat.cards.map((c) => <Card key={c.key} c={c} />) : <p className="plain">Nothing stands out yet.</p>}
      <p className="rfoot">{pat.footer}</p>

      <h3 className="lab" style={{ marginTop: 22 }}>Good days and rough days</h3>
      {gvr.wait ? <p className="plain">{gvr.wait}</p> : (
        <>
          <div className="potstablewrap" role="region" aria-label="Good days and rough days" tabIndex={0}>
            <table className="rtab potsrtab">
              <caption>{`Your ${gvr.nGood} good and ${gvr.nRough} rough days ${inLast}, side by side.`}</caption>
              <thead><tr><th scope="col"><span className="sr-only">What Heard Health compared</span></th><th scope="col">{`Good days (${gvr.nGood})`}</th><th scope="col">{`Rough days (${gvr.nRough})`}</th></tr></thead>
              <tbody>{gvr.rows.map((r) => <tr key={r.label}><th scope="row" style={{ fontWeight: 400, textAlign: "left", fontSize: 12.5, color: "var(--ink)" }}>{r.label}</th><td>{r.good}</td><td>{r.rough}</td></tr>)}</tbody>
            </table>
          </div>
          {gvr.wearSources.map((src) => <p className="rfoot" key={src} style={{ marginTop: 0 }}>{WEAR_ROW_NOTE(src)}</p>)}
        </>
      )}

      {cycleStage && pat.cycle && (
        <>
          <h3 className="lab" style={{ marginTop: 22 }}>Your cycle</h3>
          {pat.cycle.shown ? (
            <div className="icard">
              <div className="card" style={{ marginBottom: 0 }}><p>{pat.cycle.sentence}</p></div>
              <Advice urgency={pat.cycle.urgency}>{CYCLE_NOTE}</Advice>
            </div>
          ) : <p className="plain">{`${pat.cycle.wait}.`}</p>}
          {stage === "peri" && <p className="plain">{CYCLE_PERI}</p>}
          {pat.cycle.shown && <Details label="Where this comes from"><p className="plain">Groups come only from the period starts you logged: period days are the start and the 4 days after it, the week before is the 7 days before a period you went on to log, and other days are the rest. Heard Health never predicts ovulation for this. Studies: Peggs KJ et al., Int J Gynaecol Obstet 2012; Fu Q et al., Hypertension 2010.</p></Details>}
        </>
      )}
      {stage === "preg" && <div style={{ marginTop: 18 }}><Details label="POTS and pregnancy"><p className="plain">{PREG_NOTE}</p></Details></div>}

      {pat.meds.length > 0 && (
        <>
          <h3 className="lab" style={{ marginTop: 22 }}>Medicines since starting</h3>
          {pat.meds.map((m) => (
            <div key={m.id}>
              {m.beforeAfter && m.beforeAfter.ready && (
                <div className="icard">
                  <div className="card" style={{ marginBottom: 0 }}><p>{medLine(m.name, m.beforeAfter)}</p></div>
                  <Advice urgency="visit">{MED_ADVICE}</Advice>
                </div>
              )}
              {m.beforeAfter && !m.beforeAfter.ready && <p className="plain">{`${m.name}: ${m.beforeAfter.need} more rated ${m.beforeAfter.need === 1 ? "day" : "days"} to compare`}</p>}
              {m.eps && <p className="plain">{m.eps.text}</p>}
            </div>
          ))}
        </>
      )}

      {pat.tests.length > 0 && (
        <>
          <h3 className="lab" style={{ marginTop: 22 }}>Stand tests over time</h3>
          {pat.tests.map((g) => (
            <div key={g.method}>
              <p className="plain" style={{ margin: "8px 0 0" }}><b>{`Largest rise in each complete ${methodWord(g.method).toLowerCase()}${g.median != null ? ` (median ${fmtN(g.median)})` : ""}`}</b></p>
              <TrendChart rows={g.rows} thr={g.thr} stage={stage} methodLabel={methodWord(g.method).toLowerCase()} />
            </div>
          ))}
          <p className="rfoot">{TREND_NOTE}</p>
        </>
      )}

      <div style={{ marginTop: 18 }}>
        <Details label="What Heard Health checked">
          {pat.checked.length ? <ul>{pat.checked.map((x) => <li key={x.key}>{x.text}</li>)}{wearUsed && <li>{WEAR_CHECKED}</li>}</ul> : <p className="plain">Everything Heard Health compared is shown above.</p>}
        </Details>
        <Details label="Why heat is a tag"><p className="plain">{HEAT_LINE}</p></Details>
      </div>
    </>
  );
}

const NONE = []; // stable defaults, so the patterns aren't recomputed on every render
export default function PotsPatterns({ pots, stage, stageName, todayIso, starts = NONE, checkin = null, wearData = NONE, connected = NONE }) {
  const [win, setWin] = useState("30");
  const [outcome, setOutcome] = useState(null);
  const since = sinceOffered(pots, todayIso);
  const window = win === "all" && !since ? "30" : win;
  const now = new Date(), nowMin = now.getHours() * 60 + now.getMinutes();
  const cyc = { starts, stageName };
  const pat = useMemo(
    () => patterns(pots, { window, today: todayIso, nowMin, stage, stageName, starts, checkin, wearData, connected, outcome }),
    // nowMin only matters for Today's pace; it changes once a minute at most.
    [pots, window, todayIso, window === "today" ? nowMin : 0, stage, stageName, starts, checkin, wearData, connected, outcome], // eslint-disable-line
  );
  if (!pat) return null;
  const WINDOWS = [["today", "Today"], ["7", "7 days"], ["30", "30 days"], ...(since ? [["all", "Since you started"]] : [])];
  return (
    <section aria-labelledby="pots-pat-h">
      <h2 className="sr-only" id="pots-pat-h">Patterns</h2>
      <Choice id="pots-pat-win" label="Show" value={window} options={WINDOWS} onPick={setWin} />
      <div style={{ marginTop: 12 }}>
        {window === "today" && <TodayView pots={pots} pat={pat} nowMin={nowMin} stage={stage} cyc={cyc} />}
        {window === "7" && <WeekView pots={pots} pat={pat} />}
        {(window === "30" || window === "all") && <MonthView pots={pots} pat={pat} stage={stage} stageName={stageName} outcome={outcome} setOutcome={setOutcome} window={window} />}
      </div>
    </section>
  );
}
