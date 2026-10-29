import { Card, Chip, TwoBar, Sheet } from "../ui/index.js";
import Advice from "../Advice.jsx";
import { NOT_ADVICE } from "../../lib/patterns.js";
import { t } from "../../lib/i18n.js";

/* A "What you're learning" card (calm R6, the reference's pattern-card format): the question's topic as the eyebrow,
   a status chip (Supported pattern / Still showing up / Not enough information; none for a plain observation), one
   plain sentence framed as an association (the card's heading), the difference figure with two labelled bars and
   their day counts, "In your recent data", and "View pattern" for the detail sheet. c: lib/patterns.js card model. */
export function PatternCard({ c, onView }) {
  return (
    <Card as="article" className={`patcard st-${c.status}`} eyebrow={c.topic} badge={c.status !== "seen" ? <Chip variant={c.status} /> : null} title={c.sentence} level={3} data-key={c.key}>
      {c.bars && <TwoBar a={c.bars.a} b={c.bars.b} diff={c.diff} diffLabel={c.diffLabel || t("patternCard.difference")} family={c.family} />}
      {!c.bars && c.big && <p className="patbig"><b>{c.big}</b> <span>{c.bigLabel}</span></p>}
      <div className="patfoot">
        <p className="patrecent">{c.recent}</p>
        <button type="button" className="linkbtn patview" aria-haspopup="dialog" aria-label={t("patternCard.viewPattern2", { topic: c.topic })} onClick={() => onView(c)}>{t("patternCard.viewPattern")}</button>
      </div>
    </Card>
  );
}

/* The detail sheet: the question, the same sentence and bars, every count in words, what to do with it (the L8
   advice), the sources for module questions, the not-medical-advice line, and the two existing actions. */
export function PatternSheet({ c, onClose, onReport, onAsk, askQ, sources = [] }) {
  return (
    <Sheet id="pattern-sheet" title={c.topic} onClose={onClose} closeLabel={t("patternCard.closePattern")} className="patsheet">
      <p className="eyebrow">{t("patternCard.theQuestion")}</p>
      <p className="patq">{c.detail.question}</p>
      <div className="patsheet-chip">{c.status !== "seen" && <Chip variant={c.status} />}</div>
      <p className="patsent">{c.sentence}</p>
      {c.bars && <TwoBar a={c.bars.a} b={c.bars.b} diff={c.diff} diffLabel={c.diffLabel || t("patternCard.difference")} family={c.family} />}
      {!c.bars && c.big && <p className="patbig"><b>{c.big}</b> <span>{c.bigLabel}</span></p>}
      <ul className="patlines">{c.detail.lines.map((l) => <li key={l}>{l}</li>)}</ul>
      {c.detail.advice && <Advice urgency={c.detail.advice.urgency} alone>{c.detail.advice.text}</Advice>}
      {sources.length > 0 && <p className="srcline">{t("patternCard.source", { v0: sources.map((s) => `${s.title}. ${s.body} ${s.year}.`).join(" ") })}</p>}
      <p className="notadvice">{t("patternCard.aLinkInYourLog", { NOT_ADVICE })}</p>
      <p className="pline patacts2">
        <button type="button" className="linkbtn" onClick={onReport}>{t("patternCard.addToVisitNotes")}</button>
        {askQ && <> · <button type="button" className="linkbtn" onClick={() => onAsk(askQ)}>{t("patternCard.askAboutThis")}</button></>}
      </p>
    </Sheet>
  );
}
