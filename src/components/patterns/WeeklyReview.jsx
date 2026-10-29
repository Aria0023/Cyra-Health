import { useEffect, useRef, useState } from "react";
import { Card, Chip, IBadge } from "../ui/index.js";
import Details from "../Details.jsx";
import { fmt } from "../../lib/engine.js";
import { EXP_DAYS, experimentSources } from "../../lib/experiments.js";
import { EMPTY_LINE } from "../../lib/patterns.js";

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
        <div className="wrclosed-txt"><h2 id="wr-closed-t" className="v2card-title">Weekly review</h2><p className="hint">Last week, {range}. Optional, whenever it suits you.</p></div>
        <button type="button" className="ghostbtn wropen" aria-expanded="false" aria-controls="weekly-review" onClick={() => setOpen(true)}>Look back</button>
      </section>
    );
  }
  const x = m.offer;
  return (
    <Card id="weekly-review" className="wrcard" tint="patterns" icon="sparkle" level={2} eyebrow="Weekly review" title="Your week, gently"
      action={!m.week.shows ? <button type="button" className="linkbtn" aria-expanded="true" aria-controls="weekly-review" onClick={() => setOpen(false)}>Close</button> : null}>
      <p className="wrlead">Last week, {range}. Only if it helps, here's what you logged:</p>
      {m.counts.length
        ? <ul className="wrcounts">{m.counts.map((c) => <li key={c}>{c}</li>)}</ul>
        : <p className="hint">Nothing logged last week, and that's fine. One log is enough to start again.</p>}
      <h3 className="wrh">What stood out</h3>
      {m.notes.length ? <ul className="wrnotes">{m.notes.map((n) => <li key={n}>{n}</li>)}</ul> : <p className="hint">{EMPTY_LINE}</p>}
      {m.last && (
        <div className="wrlast">
          <h3 className="wrh">Last experiment: {m.last.x.title.toLowerCase()}</h3>
          <p>You did it on {m.last.done} of the {m.last.target} days you planned{m.last.done ? "." : ", and that's fine: it was optional."}</p>
          {m.last.fu && m.last.fu.done.n > 0 && m.last.fu.other.n > 0 && (
            <p>On the days you did it, {m.last.fu.label} came up on {m.last.fu.done.hits} of {m.last.fu.done.n}; on the other days, {m.last.fu.other.hits} of {m.last.fu.other.n}. One week is a small sample: an association in your log, not a result.</p>
          )}
        </div>
      )}
      <div className="wrexp" data-tint="body" tabIndex={-1}>
        <p className="eyebrow">One small experiment · optional</p>
        {m.running ? (
          <>
            <h3 className="wrexp-t">{m.running.x.title}</h3>
            <p>Day {m.running.dayN} of {EXP_DAYS}, ticked on {m.running.done} of {m.running.x.target} days so far. You tick the days on Home.</p>
          </>
        ) : x ? (
          <>
            <h3 className="wrexp-t">{x.title}</h3>
            <p>{x.short} See what your own log shows.</p>
            <Details label="Why this one">
              <p>{x.why} {x.line}</p>
              <p className="srcline">Source: {experimentSources(x).map((s) => `${s.title}. ${s.body} ${s.year}.`).join(" ")}</p>
            </Details>
            <div className="wracts">
              <button type="button" className="cta wrstart" onClick={() => onStart(x.id)}>Start</button>
              <button type="button" className="ghostbtn wrskip" onClick={onSkip}>Skip this week</button>
            </div>
            {x.practice && <p className="hint wrpract"><button type="button" className="linkbtn" onClick={() => onPractice(x.practice)}>Try the practice now →</button></p>}
          </>
        ) : (
          <p className="hint">{m.skipped ? "No experiment this week. That's fine; the review comes back on Sunday." : EMPTY_LINE}</p>
        )}
        <div className="wrcustom"><span>Your own experiment</span><Chip variant="pro" /><button type="button" className="linkbtn" onClick={onPro}>See what Pro adds</button></div>
      </div>
    </Card>
  );
}
