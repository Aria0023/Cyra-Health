import { useState } from "react";
import { standResult, editTestReadings, RESULT_FOOT } from "../../lib/pots.js";
import { RUNNER_FEEL, THRESH } from "../../lib/potsConstants.js";
import { cycleLabelOn } from "../../lib/potsPatterns.js";
import Advice from "../Advice.jsx";
import Details from "../Details.jsx";
import UrgentCard from "./UrgentCard.jsx";
import { HrChart, fmtN } from "./HrChart.jsx";
import { numOf, numProps, symLabel, dayLabel } from "./ui.js";

/* A stand test's result (design 4.8.6), computed by lib/pots.js standResult at render and never
   stored, so the numbers and the wording always agree and can be corrected later. It compares
   her numbers with published thresholds and never diagnoses (POTS_BANNED is checked over this
   text by the tests). "Edit readings" corrects a mistyped number in place on any finished,
   stopped or interrupted test; the result recomputes and says the readings were corrected. */

export const METHOD_WORD = { stand: "Active stand", lean: "Lean test" };
export const methodWord = (m) => METHOD_WORD[m] || "Other test";
const fmtM = (m) => (Number.isInteger(m) ? String(m) : String(Math.round(m * 10) / 10));
const feelWord = (pots, id) => (RUNNER_FEEL.find((x) => x.id === id) || {}).label || symLabel(pots, id);
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

/** The result with everything it needs from the rest of the log: the teen setting, the stage,
    that day's symptoms, how many tests had a high lying blood pressure (this one included),
    whether this is her first heart-rate or blood-pressure finding (the midlife line), and, in a
    cycle stage, the cycle day of the test from her logged period starts ("Cycle day 24 (week
    before your period)"; `cyc` = { starts, stageName }, lib/potsPatterns.js). A label only:
    nothing is inferred from it. */
export function resultFor(pots, test, stage, cyc = null) {
  const done = (pots.tests || []).filter((x) => x.status !== "running");
  const base = { teen: pots.settings.teen === true, stage };
  const supineCount = done.filter((x) => standResult(x, base).supineHigh).length;
  const finding = (x) => { const r = standResult(x, base); return ["met", "single_mid", "single_last"].includes(r.hrStatus) || r.bpStatus === "drop"; };
  const first = done.find(finding);
  const cycle = cyc ? cycleLabelOn(test.date, cyc.starts, stage, cyc.stageName) : null;
  return standResult(test, { ...base, daySym: ((pots.days || {})[test.date] || {}).sym || null, supineCount, firstFinding: !!first && first.id === test.id, cycle });
}

/** The big number on a result card: the largest rise ("+36"), or null (shown as "—") when
    the readings aren't enough to work one out, so a single upright reading never shows a rise
    the result itself won't evaluate. */
export const riseShown = (r) => (r.hrStatus === "insufficient" || r.peakRise == null ? null : `${r.peakRise > 0 ? "+" : ""}${fmtN(r.peakRise)}`);

/** One line for lists and the Today card: "rise 34", "stopped at minute 4" or "not enough readings for a rise". */
export function riseText(test, r) {
  const stoppedAt = test.status === "stopped" && Number.isFinite(test.stoppedAt) ? test.stoppedAt : null;
  if (r.hrStatus === "insufficient") return stoppedAt != null ? (stoppedAt > 0 ? `stopped at minute ${fmtM(stoppedAt)}` : "stopped before standing up") : "not enough readings for a rise";
  const rise = r.peakRise > 0 ? `rise ${fmtN(r.peakRise)}` : "no rise above lying";
  return stoppedAt != null && stoppedAt > 0 ? `${rise} · stopped at minute ${fmtM(stoppedAt)}` : rise;
}

function Line({ l, preg }) {
  return (
    <>
      {l.urgent && <UrgentCard variant={l.urgent} preg={preg} />}
      {l.urgency
        ? <div className="icard"><Advice urgency={l.urgency} alone>{l.text}</Advice></div>
        : <p className="plain">{l.text}</p>}
    </>
  );
}

/** "The numbers": every reading, as a real table with a caption. */
function NumbersTable({ pots, test, result }) {
  const base = result.baseHr;
  const bp = (r) => (Number.isFinite(r.sys) || Number.isFinite(r.dia) ? `${r.sys ?? "?"}/${r.dia ?? "?"}` : "—");
  const lyingWord = test.restPos === "left" ? "Lying on left side" : "Lying";
  const rows = [
    ...(test.rest || []).slice().sort((a, b) => a.min - b.min).map((r) => ({ k: `r${r.min}`, m: `${lyingWord}, rest minute ${fmtM(r.min)}`, hr: r.hr, how: r.how, rise: "", bp: bp(r), felt: "" })),
    ...(test.up || []).slice().sort((a, b) => a.min - b.min).map((r) => {
      const late = Number.isFinite(r.atSec) && r.atSec - r.min * 60 > 45 ? ` (entered at ${mmss(r.atSec)})` : "";
      return { k: `u${r.min}`, m: `${fmtM(r.min)}${late}`, hr: r.hr, how: r.how, rise: Number.isFinite(r.hr) && base != null ? fmtN(r.hr - base) : "", bp: bp(r), felt: (r.feel || []).map((id) => feelWord(pots, id)).join(", ") };
    }),
  ];
  // Chips tapped between readings (test.feel) that no reading already lists.
  const listed = new Set((test.up || []).flatMap((r) => r.feel || []));
  const also = [...new Set(test.feel || [])].filter((id) => !listed.has(id)).map((id) => feelWord(pots, id));
  return (
    <>
    <table className="rtab">
      <caption className="sr-only">{`Readings from the ${dayLabel(test.date)} test`}</caption>
      <thead><tr><th scope="col">Minute</th><th scope="col">Heart rate</th><th scope="col">Rise</th><th scope="col">Blood pressure</th><th scope="col">How you felt</th></tr></thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.k}><td>{r.m}</td><td>{Number.isFinite(r.hr) ? `${r.hr}${r.how === "counted" ? " (counted)" : ""}` : "skipped"}</td><td>{r.rise}</td><td>{r.bp}</td><td>{r.felt}</td></tr>
        ))}
      </tbody>
    </table>
    {also.length > 0 && <p className="plain" style={{ marginTop: 8 }}>{`During the test you also noted: ${also.join(", ")}.`}</p>}
    </>
  );
}

const R = THRESH.range;
const bad = (v, [lo, hi]) => v != null && (v < lo || v > hi);
/** "Edit readings": one row per lying and upright reading with heart rate, top and bottom
    number. Planned minute and time entered aren't editable. Saving marks the test edited. */
export function EditReadings({ test, setPots, onDone, headRef }) {
  const toS = (v) => (Number.isFinite(v) ? String(v) : "");
  const [rest, setRest] = useState(() => (test.rest || []).map((r) => ({ hr: toS(r.hr), sys: toS(r.sys), dia: toS(r.dia) })));
  const [up, setUp] = useState(() => (test.up || []).map((r) => ({ hr: toS(r.hr), sys: toS(r.sys), dia: toS(r.dia) })));
  const [err, setErr] = useState("");
  const lying = test.restPos === "left" ? "Lying on left side" : "Lying";
  const row = (list, setList, i, label, idp) => {
    const v = list[i], n = { hr: numOf(v.hr), sys: numOf(v.sys), dia: numOf(v.dia) };
    const b = { hr: bad(n.hr, R.hr), sys: bad(n.sys, R.sys), dia: bad(n.dia, R.dia) };
    // Every box has its own visible label (the numbers are pre-filled, so a placeholder would
    // never show), and its aria-label repeats it.
    const errId = `${idp}-${i}-err`;
    const f = (k, word) => (
      <div style={{ flex: "1 1 0", minWidth: 0 }}>
        <label className="hint" htmlFor={`${idp}-${i}-${k}`} style={{ display: "block", margin: "0 0 2px" }}>{word}</label>
        <input id={`${idp}-${i}-${k}`} className={`inp ${b[k] ? "inpErr" : ""}`} {...numProps()} aria-label={`${label}, ${word.toLowerCase()}`} aria-invalid={b[k] || undefined} aria-describedby={b[k] ? errId : undefined} value={v[k]} style={{ width: "100%" }}
          onChange={(e) => { const val = e.target.value; setList((l) => l.map((x, j) => (j === i ? { ...x, [k]: val } : x))); setErr(""); }} />
      </div>
    );
    return (
      <div key={label} role="group" aria-label={label} style={{ marginBottom: 6 }}>
        <p className="plain" style={{ margin: "8px 0 4px" }}><b>{label}</b></p>
        <div style={{ display: "flex", gap: 6 }}>{f("hr", "Heart rate")}{f("sys", "Top number")}{f("dia", "Bottom number")}</div>
        {(b.hr || b.sys || b.dia) && <p className="errhint" id={errId} style={{ marginTop: 0, marginBottom: 8 }}>That looks unusual. Check the number?</p>}
      </div>
    );
  };
  const save = () => {
    const parse = (l) => l.map((v) => ({ hr: numOf(v.hr), sys: numOf(v.sys), dia: numOf(v.dia) }));
    const all = [...parse(rest), ...parse(up)];
    if (all.some((v) => bad(v.hr, R.hr) || bad(v.sys, R.sys) || bad(v.dia, R.dia))) { setErr("Fix or clear the unusual number first."); return; }
    const round = (l) => parse(l).map((v) => ({ hr: v.hr == null ? null : Math.round(v.hr), sys: v.sys == null ? null : Math.round(v.sys), dia: v.dia == null ? null : Math.round(v.dia) }));
    setPots((p) => editTestReadings(p, test.id, { rest: round(rest), up: round(up) }));
    onDone(true);
  };
  return (
    <section className="plaincard" aria-labelledby="pots-edit-h">
      <h2 className="obq" id="pots-edit-h" tabIndex={-1} ref={headRef}>{`Edit readings · ${dayLabel(test.date)}`}</h2>
      <p className="hint" style={{ margin: "0 0 6px" }}>Fix a number you typed wrong. Clear a box to remove that number. The result will say the readings were corrected.</p>
      {(test.rest || []).map((r, i) => row(rest, setRest, i, `${lying}, rest minute ${fmtM(r.min)}`, "pots-edr"))}
      {(test.up || []).map((r, i) => row(up, setUp, i, `Minute ${fmtM(r.min)}`, "pots-edu"))}
      {err && <p className="errhint" role="alert" style={{ marginTop: 0, marginBottom: 10 }}>{err}</p>}
      <button type="button" className="cta" onClick={save}>Save changes</button>
      <button type="button" className="ghostbtn" onClick={() => onDone(false)}>Cancel</button>
    </section>
  );
}

/** The result itself. `test` is the stored test; nothing here is stored. */
export default function StandResult({ pots, test, stage, cyc = null }) {
  const r = resultFor(pots, test, stage, cyc), preg = stage === "preg";
  return (
    <>
      <div className="card">
        <div className="num" aria-hidden={riseShown(r) == null || undefined}>{riseShown(r) ?? "—"}</div>
        <p>{r.headline || "No rise could be worked out from these readings."}</p>
      </div>
      {r.lines.map((l, i) => <Line key={`${l.kind}-${i}`} l={l} preg={preg} />)}
      <HrChart test={test} result={r} stage={stage} />
      <Details label="The numbers"><NumbersTable pots={pots} test={test} result={r} /></Details>
      <p className="rfoot">{RESULT_FOOT}</p>
      <Details label="How Heard Health worked this out">
        <ul>
          <li>{`Lying heart rate: the average of your last two lying readings, or the one you took.`}</li>
          <li>{`Rise: each standing heart rate minus your lying heart rate. Heard Health looks for a rise of ${r.thr} or more that lasts: two readings in a row at or above it, the second at minute 3 or after, no more than 5 minutes apart. A skipped reading between them doesn't break the pair.`}</li>
          <li>{`Clinicians use ${THRESH.hr} beats a minute for adults and ${THRESH.hrTeen} for ages 12–19, within 10 minutes of standing (Sheldon RS et al., Heart Rhythm Society 2015).`}</li>
          <li>{`Blood pressure: a drop of ${THRESH.ohSys} or more in the top number, or ${THRESH.ohDia} or more in the bottom number, within 3 minutes of standing, compared with your lying blood pressure (Freeman R et al., Clin Auton Res 2011). A lying blood pressure of ${THRESH.supineSys}/${THRESH.supineDia} or more is noted on its own (Fanciulli A et al., Clin Auton Res 2018).`}</li>
          <li>Heard Health's "lasts" rule is its own way of applying these published thresholds to a home test. A clinician reads the whole picture.</li>
        </ul>
      </Details>
    </>
  );
}
