import { useEffect, useRef, useState } from "react";
import { Card, Chip, IBadge } from "../ui/index.js";
import Details from "../Details.jsx";
import { fmt } from "../../lib/engine.js";
import { EXP_DAYS, experimentSources } from "../../lib/experiments.js";
import { EMPTY_LINE } from "../../lib/patterns.js";
import { t } from "../../lib/i18n.js";

/* The weekly review (calm R6, spec §3.5d). Optional and kind: it opens by itself from Sunday through Tuesday and on
   demand any other day ("Look back at last week"). It counts what she logged (counts, never grades), names one or two
   associations, says how last week's experiment went (the days she did it against the others, as an association),
   and ends in ONE optional starter experiment with "Start" and "Skip this week" side by side. A custom experiment is
   Pro: a one-line chip and "See what Pro adds", never blocking anything.
   m: { week: reviewWeek(), counts: string[], notes: string[], offer, running, skipped, last: { x, target, done, fu } | null }. */
export default function WeeklyReview({ m, onStart, onSkip, onPractice, onPro }) {
  const [open, setOpen] = useState(false);
  // on demand: focus follows the review open (its heading) and closed (the "Look back" button)
  const moved = useRef(false);
  useEffect(() => {
    if (!moved.current) { moved.current = true; return; }
    const el = document.querySelector(open ? "#weekly-review .v2card-title" : ".wropen");
    if (!el) return;
    if (open) el.setAttribute("tabindex", "-1");
    el.focus();
  }, [open]);
  const range = `${fmt(m.week.from)}–${fmt(m.week.to)}`;
  if (!m.week.shows && !open) {
    return (
      <section className="v2card wrclosed" data-tint="patterns" aria-labelledby="wr-closed-t">
        <IBadge icon="sparkle" tint="patterns" />
        <div className="wrclosed-txt"><h2 id="wr-closed-t" className="v2card-title">{t("weekly.weeklyReview")}</h2><p className="hint">{t("weekly.lastWeekOptionalWheneverIt", { range })}</p></div>
        <button type="button" className="ghostbtn wropen" aria-expanded="false" aria-controls="weekly-review" onClick={() => setOpen(true)}>{t("weekly.lookBack")}</button>
      </section>
    );
  }
  const x = m.offer;
  return (
    <Card id="weekly-review" className="wrcard" tint="patterns" icon="sparkle" level={2} eyebrow={t("weekly.weeklyReview")} title={t("weekly.yourWeekGently")}
      action={!m.week.shows ? <button type="button" className="linkbtn" aria-expanded="true" aria-controls="weekly-review" onClick={() => setOpen(false)}>{t("weekly.close")}</button> : null}>
      <p className="wrlead">{t("weekly.lastWeekOnlyIfIt", { range })}</p>
      {m.counts.length
        ? <ul className="wrcounts">{m.counts.map((c) => <li key={c}>{c}</li>)}</ul>
        : <p className="hint">{t("weekly.nothingLoggedLastWeekAnd")}</p>}
      <h3 className="wrh">{t("weekly.whatStoodOut")}</h3>
      {m.notes.length ? <ul className="wrnotes">{m.notes.map((n) => <li key={n}>{n}</li>)}</ul> : <p className="hint">{EMPTY_LINE}</p>}
      {m.last && (
        <div className="wrlast">
          <h3 className="wrh">{t("weekly.lastExperiment", { v0: m.last.x.title.toLowerCase() })}</h3>
          <p>{t("weekly.youDidItOn")} {m.last.done} {t("weekly.ofThe")} {m.last.target} {t("weekly.daysYouPlanned")}{m.last.done ? "." : t("weekly.andThatsFineItWas")}</p>
          {m.last.fu && m.last.fu.done.n > 0 && m.last.fu.other.n > 0 && (
            <p>{t("weekly.onTheDaysYouDid", { label: m.last.fu.label, hits: m.last.fu.done.hits, n: m.last.fu.done.n, hits2: m.last.fu.other.hits, n2: m.last.fu.other.n })}</p>
          )}
        </div>
      )}
      <div className="wrexp" data-tint="body" tabIndex={-1}>
        <p className="eyebrow">{t("weekly.oneSmallExperimentOptional")}</p>
        {m.running ? (
          <>
            <h3 className="wrexp-t">{m.running.x.title}</h3>
            <p>{t("weekly.dayOfTickedOnOf", { dayN: m.running.dayN, EXP_DAYS, done: m.running.done, target: m.running.x.target })}</p>
          </>
        ) : x ? (
          <>
            <h3 className="wrexp-t">{x.title}</h3>
            <p>{t("weekly.seeWhatYourOwnLog", { short: x.short })}</p>
            <Details label={t("weekly.whyThisOne")}>
              <p>{x.why} {x.line}</p>
              <p className="srcline">{t("weekly.source", { v0: experimentSources(x).map((s) => `${s.title}. ${s.body} ${s.year}.`).join(" ") })}</p>
            </Details>
            <div className="wracts">
              <button type="button" className="cta wrstart" onClick={() => onStart(x.id)}>{t("weekly.start")}</button>
              <button type="button" className="ghostbtn wrskip" onClick={onSkip}>{t("weekly.skipThisWeek")}</button>
            </div>
            {x.practice && <p className="hint wrpract"><button type="button" className="linkbtn" onClick={() => onPractice(x.practice)}>{t("weekly.tryThePracticeNow")}</button></p>}
          </>
        ) : (
          <p className="hint">{m.skipped ? t("weekly.noExperimentThisWeekThats") : EMPTY_LINE}</p>
        )}
        <div className="wrcustom"><span>{t("weekly.yourOwnExperiment")}</span><Chip variant="pro" /><button type="button" className="linkbtn" onClick={onPro}>{t("weekly.seeWhatProAdds")}</button></div>
      </div>
    </Card>
  );
}
