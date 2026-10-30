import { useEffect, useState } from "react";
import { CONNECT, INTIMACY, AFTER, RELATIONSHIP } from "../lib/constants.js";
import { localDay } from "../lib/engine.js";
import Advice from "../components/Advice.jsx";
import { t } from "../lib/i18n.js";

/* Connect (intimacy & relationship): closeness / desire / tension / mental-load
   sliders, intimacy today, afterwards, situation. Never asks a partner's gender;
   intimacy questions are hidden for solo users.
   UI CC1: the screen reads connLog back. On mount and when the day changes it hydrates
   the sliders from today's saved entry (never while she is editing); the score card
   is idle until a slider moves or today is logged; a saved day shows "Logged today at
   NN"; a chosen situation collapses to one line with Change. The 7-day strip and the
   score are computed here from the on-device record each render, never stored. */
const score = (c) => Math.round(((c.closeness + c.desire + c.load + (10 - c.friction)) / 40) * 100);
const band = (n) => (n >= 75 ? "Close" : n >= 50 ? "Steady" : n >= 30 ? "Strained" : "Distant");
const dayBack = (iso, i) => { const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() - i); return localDay(d); };

export default function ConnectScreen({ relationship, setRelationship, conn, setConn, intimacy, setIntimacy, after, setAfter, connLog, setConnLog, todayIso, stage, ping }) {
  const saved = connLog?.[todayIso] || null;
  const savedScore = saved && ["closeness", "desire", "friction", "load"].every((k) => Number.isFinite(saved[k])) ? score(saved) : null;
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    const e = connLog?.[todayIso];
    if (e && ["closeness", "desire", "friction", "load"].every((k) => Number.isFinite(e[k]))) {
      setConn({ closeness: e.closeness, desire: e.desire, friction: e.friction, load: e.load });
      setIntimacy(e.intimacy ?? null);
      setAfter(e.after ?? null);
    }
    setDirty(false);
  }, [todayIso]); // eslint-disable-line
  const touched = !!saved || dirty;
  const connScore = score(conn);
  const week = Array.from({ length: 7 }, (_, i) => { const iso = dayBack(todayIso, 6 - i); const e = connLog?.[iso]; return { iso, n: e && Number.isFinite(e.closeness) ? score(e) : null }; });
  const loggedWeek = week.filter((d) => d.n != null).length;
  const sitLabel = (RELATIONSHIP.find(([v]) => v === relationship) || [])[1];
  const connAdvice = () => {
    if (after === "pain") return <Advice urgency="visit">{t("connect.painOrDrynessWithIntimacy")}</Advice>;
    if (conn.load <= 3 && conn.desire <= 4) return <Advice urgency="self">{t("connect.researchFoundThatWhenThe")}</Advice>;
    if (conn.friction >= 7) return <Advice urgency="self">{t("connect.highTensionDaysAreWorth")}</Advice>;
    if (conn.closeness >= 8) return <Advice urgency="self">{t("connect.affectionateClosenessNotJustSexual")}</Advice>;
    return <Advice urgency="self">{t("connect.studiesShowRelationshipSatisfactionAnd")}</Advice>;
  };
  return (
    <main>
      <h1 className="disp">{t("connect.connection")}</h1>
      <p className="hint">{t("connect.optionalPrivateAndJudgmentFree")}</p>
      {!relationship ? (
        <>
          <p className="section-lab">{t("connect.yourSituationOptional")}</p>
          <div className="mcrow" style={{ marginBottom: 14 }}>
            {RELATIONSHIP.map(([v, l]) => <button key={v} aria-pressed={relationship === v} className={`mc ${relationship === v ? "on" : ""}`} onClick={() => setRelationship(v)}>{l}</button>)}
          </div>
        </>
      ) : (
        <p className="hint sitline">{t("connect.situation", { sitLabel })} <button type="button" className="linkbtn" onClick={() => setRelationship(null)}>{t("connect.change")}</button></p>
      )}
      <p className="section-lab">{t("connect.howItFeltToday0")}</p>
      {Object.entries(CONNECT).map(([k, s]) => (
        <div className="scalerow" key={k}>
          <div className="scalehead"><span>{s.label}</span><b>{conn[k]}</b></div>
          <input className="slider" type="range" min="0" max="10" value={conn[k]} aria-label={t("connect.0Is10Is", { label: s.label, low: s.low, high: s.high })} aria-valuetext={t("connect.outOf10", { v0: conn[k] })} onChange={(e) => { setDirty(true); setConn((x) => ({ ...x, [k]: +e.target.value })); }} />
          <div className="scaleends"><span>{s.low}</span><span>{s.high}</span></div>
        </div>
      ))}
      {relationship !== "single" && (
        <>
          <p className="section-lab">{t("connect.intimacyToday")}</p>
          <div className="mcrow" style={{ marginBottom: 10 }}>
            {INTIMACY.map(([v, l]) => <button key={v} aria-pressed={intimacy === v} className={`mc ${intimacy === v ? "on" : ""}`} onClick={() => { setDirty(true); setIntimacy(intimacy === v ? null : v); }}>{l}</button>)}
          </div>
          {intimacy && intimacy !== "none" && (
            <>
              <p className="section-lab">{t("connect.afterwards")}</p>
              <div className="mcrow" style={{ marginBottom: 10 }}>
                {AFTER.map(([v, l]) => <button key={v} aria-pressed={after === v} className={`mc ${after === v ? "on" : ""}`} onClick={() => { setDirty(true); setAfter(after === v ? null : v); }}>{l}</button>)}
              </div>
            </>
          )}
        </>
      )}
      <div className={`card ${touched ? "" : "card-idle"}`}>
        <div className={touched ? "num numword" : "num"}>{touched ? band(connScore) : "—"}</div>
        <div className="cbody">
          {touched ? (
            <>
              <p><b>{t("connect.connectionToday", { v0: band(connScore) })}</b> {t("connect.overWeeksThisBuildsA")} {stage === "preg" ? t("connect.yourWeekOfPregnancyAnd") : t("connect.yourSymptoms")}.</p>
              <span className="cmeter" aria-hidden="true"><i style={{ "--v": connScore / 100 }} /></span>
              <div className="cweek">{t("connect.last7DaysLogged", { loggedWeek })}
                <span className="connstrip" role="img" aria-label={t("connect.last7DaysOf7", { loggedWeek })}>
                  {week.map((d) => <i key={d.iso} className={`conndot${d.n == null ? " off" : ""}${d.iso === todayIso ? " today" : ""}`} style={d.n == null ? undefined : { opacity: 0.3 + 0.7 * d.n / 100 }} />)}
                </span>
              </div>
            </>
          ) : <p>{t("connect.moveTheSlidersAndCyra")} {stage === "preg" ? t("connect.yourWeekOfPregnancyAnd") : t("connect.yourSymptoms")}.</p>}
        </div>
      </div>
      {connAdvice()}
      {savedScore != null && <p className="hint saved-line">{t("connect.loggedTodayAtSavingAgain", { savedScore })}</p>}
      <button className="cta" style={{ marginTop: savedScore != null ? 0 : 12 }} onClick={() => { setConnLog((l) => ({ ...l, [todayIso]: { ...conn, intimacy, after } })); setDirty(false); ping("Saved — private to your device"); }}>{t("connect.save")}</button>
      <p className="rfoot">{t("connect.separatedFromSexualActivityOn")}</p>
    </main>
  );
}
