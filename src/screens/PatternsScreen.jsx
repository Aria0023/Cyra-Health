import { useState } from "react";
import { PatternsCard, ChartSoon, windowDays } from "../components/PatternCharts.jsx";
import { INSIGHT_STARTERS } from "../lib/askStarters.js";
import FertilitySummary from "../components/FertilitySummary.jsx";
import Details from "../components/Details.jsx";
import Icon from "../components/Icon.jsx";
import { Card, Ring, Sheet, EmptyNote } from "../components/ui/index.js";
import CycleTimeline from "../components/patterns/CycleTimeline.jsx";
import { PatternCard, PatternSheet } from "../components/patterns/PatternCard.jsx";
import WeeklyReview from "../components/patterns/WeeklyReview.jsx";
import { NOT_ADVICE, CARDS_SHOWN, EMPTY_LINE } from "../lib/patterns.js";
import { MODULES, sourcesOf } from "../lib/modules.js";
import { t } from "../lib/i18n.js";

/* Patterns (calm R6, spec §3.5d; HealthMaxxing's "Balance"). Where she feels seen: honest associations from her own
   log, never verdicts, grades or scores.
   Top: History (her cycles) and Share (the Report and the appointment PDF), then the hero cycle timeline (the last
   cycles at their actual lengths, lib/patterns.js cycleTimeline). Then the Body and Mind rings around the cycle ring,
   in words against her usual, with "What's driving this". The weekly review (Sunday through Tuesday, or on demand)
   ends in one optional experiment. "What you're learning": the pattern cards (L8 sleep links and cycle-day clusters,
   the PCOS module's questions, what she's trying), the not-medical-advice line beside them, CARDS_SHOWN first and
   "View all patterns" for the rest; each opens a detail sheet. The 60-day chart reads lighter / usual / heavier days
   against her usual (no 0–100 axis). "How Cyra finds these" lists every check. The POTS pointer stays last.
   aiWriteUp: the "Cyra's write-up" slot for the AI deep dive (R8); nothing renders in R6.
   Everything is worked out on this device on render (App.jsx), never saved or sent. */
export default function PatternsScreen({
  ins, symIds, symMap, isMeno = false, todayIso, potsOn = false, popIso = null, onGo, onAsk, onPots = null, scoreScale, fert = null,
  timeline = null, rings, cards = [], checked = [], weekly = null, onStart, onSkip, onPractice, onPro, onHistory, onReport, aiWriteUp = null, historyLabel = "History",
}) {
  const [all, setAll] = useState(false);
  const [view, setView] = useState(null);
  const [share, setShare] = useState(false);
  const days = windowDays(ins.sorted, symIds, todayIso, 60, scoreScale);
  const logged = days.filter((d) => d.e).length;
  const starts = isMeno ? [] : ins.starts || [];
  const shown = all ? cards : cards.slice(0, CARDS_SHOWN);
  const srcFor = (c) => (c.detail.src ? sourcesOf(MODULES.pcos, c.detail.src) : []);
  const review = weekly && <WeeklyReview m={weekly} onStart={onStart} onSkip={onSkip} onPractice={onPractice} onPro={onPro} />;
  return (
    <main className="patternspage">
      <div className="pathead">
        <svg className="patblob" viewBox="0 0 200 120" aria-hidden="true" focusable="false"><path d="M30 70C20 30 70 6 112 18s82 28 70 66-70 40-104 30S38 96 30 70z" /></svg>
        <p className="eyebrow">{t("patterns.patterns")}</p>
        <h1 className="disp">{t("patterns.whatYourLogIsShowing")}</h1>
        <div className="patacts">
          <button type="button" className="patact" onClick={onHistory}><Icon name="calendar" size={16} />{historyLabel}</button>
          <button type="button" className="patact" aria-haspopup="dialog" onClick={() => setShare(true)}><Icon name="share" size={16} />{t("patterns.share")}</button>
        </div>
      </div>

      {/* ---- the hero: the cycle timeline ---- */}
      {!isMeno && (
        <Card hero className="tlcard" tint="patterns" icon="calendar" level={2} eyebrow={timeline ? t("patterns.yourLast", { length: timeline.rows.length, v1: timeline.rows.length === 1 ? "cycle" : "cycles" }) : t("patterns.cycles")} title={t("patterns.yourCycleTimeline")}>
          {timeline ? <CycleTimeline model={timeline} /> : <EmptyNote>{t("patterns.yourTimelineStartsAfterYou")}</EmptyNote>}
        </Card>
      )}

      {/* ---- Body and Mind around the cycle ring, in words ---- */}
      {rings && (
        <Card className="ringscard" tint="patterns" icon="patterns" level={2} eyebrow={t("patterns.thisWeek")} title={t("patterns.bodyAndMind")}>
          <div className="ringrow patrings">
            <Ring title={t("patterns.body")} value={rings.body.value} word={rings.body.word} size={92} stroke={8} tone="primary" />
            <Ring title={rings.hero.title} value={rings.hero.value} center={rings.hero.center} sub={rings.hero.sub} size={128} stroke={10} blob />
            <Ring title={t("patterns.mind")} value={rings.mind.value} word={rings.mind.word} size={92} stroke={8} tone="accent" />
          </div>
          <Details label={t("patterns.whatsDrivingThis")}>
            <ul className="ringins">{rings.inputs.map((l) => <li key={l}>{l}</li>)}</ul>
          </Details>
        </Card>
      )}

      {weekly && weekly.week.shows && review}

      {/* ---- What you're learning ---- */}
      <section className="learn" aria-labelledby="learn-h">
        <div className="learnhead">
          <h2 id="learn-h" className="sechead">{t("patterns.whatYoureLearning")}</h2>
          <p className="notadvice">{NOT_ADVICE}</p>
        </div>
        {cards.length ? shown.map((c) => <PatternCard key={c.key} c={c} onView={setView} />) : <EmptyNote>{EMPTY_LINE}</EmptyNote>}
        {cards.length > CARDS_SHOWN && (
          <button type="button" className="ghostbtn viewall" aria-expanded={all} onClick={() => setAll((v) => !v)}>
            {all ? t("patterns.showFewerPatterns") : t("patterns.viewAllPatterns", { length: cards.length })}
          </button>
        )}
      </section>

      {aiWriteUp}

      {weekly && !weekly.week.shows && review}

      {/* ---- day by day: lighter / usual / heavier against her usual ---- */}
      <Card className="daycard" tint="patterns" icon="patterns" level={2} eyebrow={t("patterns.dayByDay")} title={t("patterns.yourLast60Days")}>
        {logged < 3 ? (
          <ChartSoon logged={logged}>
            <p className="pline"><button type="button" className="linkbtn" onClick={() => onGo("today")}>{t("patterns.logTodaysCheckIn")}</button></p>
          </ChartSoon>
        ) : <PatternsCard days={days} ids={symIds} labels={symMap} starts={starts} sorted={ins.sorted} todayIso={todayIso} popIso={popIso} allowCycle={!isMeno} scale={scoreScale} />}
      </Card>
      {/* Trying to conceive with fertility signs shown (L7): this cycle's signs, an observation only. */}
      {fert && <FertilitySummary days={ins.sorted} starts={ins.starts} todayIso={todayIso} unit={fert.unit} onLog={() => onGo("today")} />}

      {logged >= 3 && checked.length > 0 && (
        <div className="plaincard findhow">
          <Details label={t("patterns.howCyraFindsThese")}>
            <p className="plain">{t("patterns.cyraComparesDaysInYour")}</p>
            <p className="plain">{t("patterns.aCardSaysSupportedPattern")}</p>
            <p className="plain">{t("patterns.sleepLinksCompareDaysAfter")}</p>
            {!isMeno && <p className="plain">{t("patterns.cycleDaysCountFromEach")}</p>}
            <ul className="findlist">{checked.map((l) => <li key={l}>{l}</li>)}</ul>
            <p className="plain">{t("patterns.workedOutOnThisDevice")}</p>
          </Details>
        </div>
      )}
      {/* POTS tools: their patterns live in POTS tools only (never in insights() or this screen). */}
      {potsOn && <p className="hint" style={{ marginTop: 16 }}>{t("patterns.yourPotsPatternsLiveIn")} {onPots && <button type="button" className="linkbtn" onClick={onPots}>{t("patterns.goToPotsTools")}</button>}</p>}

      {view && (
        <PatternSheet c={view} sources={srcFor(view)} onClose={() => setView(null)} askQ={view.detail.askId ? INSIGHT_STARTERS[view.detail.askId] || null : null}
          onReport={() => { setView(null); onReport(false); }} onAsk={(q) => { setView(null); onAsk(q); }} />
      )}
      {share && (
        <Sheet id="share-sheet" title={t("patterns.share")} onClose={() => setShare(false)} closeLabel={t("patterns.closeShare")} className="sharesheet">
          <p className="bsheet-sub">{t("patterns.madeOnThisDeviceNothing")}</p>
          <ul className="sharelist">
            <li><button type="button" className="sharerow" onClick={() => { setShare(false); onReport(true); }}><Icon name="note" size={18} /><span><b>{t("patterns.appointmentPdf")}</b><span>{t("patterns.aOnePageSummaryTo")}</span></span></button></li>
            <li><button type="button" className="sharerow" onClick={() => { setShare(false); onReport(false); }}><Icon name="share" size={18} /><span><b>{t("patterns.report")}</b><span>{t("patterns.whatToTellYourDoctor")}</span></span></button></li>
          </ul>
        </Sheet>
      )}
    </main>
  );
}
