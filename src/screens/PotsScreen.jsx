import { useEffect, useRef, useState } from "react";
import { setSettings, finishSetup } from "../lib/pots.js";
import { POTS_LOCKED_COPY } from "../lib/potsConstants.js";
import UrgentCard from "../components/pots/UrgentCard.jsx";
import Icon from "../components/Icon.jsx";
import { potsSaved } from "../components/pots/ui.js";

/* POTS tools page (spec A13; lib/pots.js). An optional add-on inside whichever single life
   stage she has, opened from Home (never a tab): it never shows a stage choice and never changes the stage. Everything here is
   kept in the on-device record (`pots`) and is never part of weekly counts.

   - A `pots` written by a newer build is shown read-only: one card, no writes.
   - First run: short setup cards, each skippable; finishing or skipping the last one sets
     setupDone. Card 1 ("What would help?") chooses which Today cards show (settings.show),
     and offers only the tools this build has: `shows` lists the settings.show keys whose card
     or section exists, added by the slice that ships it. With nothing to offer and no other
     card, there is no setup yet (setupDone stays false, so the first run comes once the tools
     do). Later slices add their own cards through `setupCards`: { id, title, body(saveRef) or
     children, next?, skip?: { label, big } }. Next runs `next()` or else the card's own
     saveRef.current(); either returning false keeps the card open (e.g. a number to fix).
   - Sections (Today · Stand test · Move · Patterns · Report) are a button group, not a
     nested tablist. A section shows only once it has content (`sections`, filled by the
     slices that build each one); Stand test also needs settings.show.test and Move
     settings.show.move, so "less on screen" really is less.
   - Under every section: "When to get help now" (the urgent-care cards) and "POTS settings",
     which opens `settings({ headRef, onBack })` in place of the section. */
const SECTIONS = [["today", "Today"], ["stand", "Stand test"], ["move", "Move"], ["patterns", "Patterns"], ["report", "Report"]];
const SHOW_CHOICES = [["test", "Stand test"], ["fluid", "Fluids & salt"], ["sym", "Symptoms"], ["meds", "Meds & supports"], ["move", "Movement"]];
const HINT_TAIL = "Never part of weekly counts. Cyra can't diagnose POTS; only a clinician can, and good notes make that visit faster.";
const HINT_SHORT = "Kept on this device and ready for your clinician.";
const HINT = `${HINT_SHORT} ${HINT_TAIL}`;
// While the record isn't being saved (ui.js potsSaved), the hint says so instead.
const HINT_UNSAVED = `Not being saved on this device right now (see Settings → Your data). ${HINT_TAIL}`;
/* After setup the hint shows its first sentence; the rest is still read by assistive tech (the
   whole HINT is the paragraph's text) and the two claims it makes are shown again, verbatim,
   under the Today section (PotsToday TODAY_FOOT_2). The first-run cards keep the full hint on
   screen, and HINT_UNSAVED is always on screen in full. */
const ShortHint = () => <p className="hint tophint">{HINT_SHORT}<span className="sr-only">{` ${HINT_TAIL}`}</span></p>;

/* Card 1: what Today shows. Choices stay on this card until Next saves them; Skip keeps what
   was there. */
function WhatHelps({ choices, show, setShow }) {
  return (
    <>
      <div className="mcrow" role="group" aria-label="What would help?" style={{ marginBottom: 10 }}>
        {choices.map(([k, l]) => (
          <button key={k} type="button" aria-pressed={!!show[k]} className={`mc ${show[k] ? "on" : ""}`} onClick={() => setShow({ ...show, [k]: !show[k] })}>{l}</button>
        ))}
      </div>
      <p className="hint" style={{ marginBottom: 12 }}>You can change this anytime in POTS settings. Less on screen can help on foggy days.</p>
    </>
  );
}

/* "When to get help now" (design 4.2 item 18, 8.3): on every section, as a full-width row with the
   urgency dot (--bad is only ever "now" urgency and destructive actions) and a chevron. */
function HelpNow({ preg }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="linkbtn helpnow" aria-expanded={open} aria-controls="pots-help-now" onClick={() => setOpen((v) => !v)}>When to get help now<Icon name="chevron" className="chev" /></button>
      <div id="pots-help-now" hidden={!open} style={{ marginTop: 8 }}>
        {open && ["faint", "chest", "breath"].map((v) => <UrgentCard key={v} variant={v} preg={preg} />)}
      </div>
    </>
  );
}

export default function PotsScreen({ pots, setPots, locked, potsSec, setPotsSec, sections = {}, setupCards = [], shows = [], settings = null, preg = false, storageDriver = null, onBack = null }) {
  const back = onBack ? <nav aria-label="POTS tools" className="backbar"><button type="button" className="linkbtn" onClick={onBack}>← Back</button></nav> : null;
  const hint = potsSaved(storageDriver) ? HINT : HINT_UNSAVED;
  const headRef = useRef(null), cardRef = useRef(null), saveRef = useRef(null), setHeadRef = useRef(null), setLinkRef = useRef(null);
  const [step, setStep] = useState(0);
  const [show, setShow] = useState(() => ({ ...(pots?.settings?.show || {}) }));
  const [focusTo, setFocusTo] = useState(null); // move focus only after a tap here, never on arrival
  useEffect(() => {
    if (!focusTo) return;
    ({ card: cardRef, head: headRef, settings: setHeadRef, link: setLinkRef })[focusTo].current?.focus();
    setFocusTo(null);
  }, [focusTo]);

  const head = (ref) => <div className="potshead">{back}<h1 className="disp" tabIndex={ref ? -1 : undefined} ref={ref}>POTS</h1></div>;
  if (locked) {
    return (
      <main className="pots">
        {head(null)}
        <div className="plaincard"><p className="plain">{POTS_LOCKED_COPY}</p></div>
      </main>
    );
  }

  const choices = SHOW_CHOICES.filter(([k]) => shows.includes(k));
  const cards = pots.setupDone ? [] : [
    ...(choices.length ? [{ id: "help", title: "What would help?", children: <WhatHelps choices={choices} show={show} setShow={setShow} />, next: () => setPots((p) => setSettings(p, { show })) }] : []),
    ...setupCards,
  ];
  if (cards.length) {
    const i = Math.min(step, cards.length - 1), card = cards[i], last = i === cards.length - 1;
    const go = (save) => {
      if (save && (card.next ? card.next() : saveRef.current?.()) === false) return;
      saveRef.current = null;
      if (last) { setPots(finishSetup); setFocusTo("head"); }
      else { setStep(i + 1); setFocusTo("card"); }
    };
    return (
      <main className="pots">
        {head(headRef)}
        <p className="hint">{hint}</p>
        <section className="plaincard" aria-labelledby="pots-setup-title">
          {cards.length > 1 && (
            <div className="stepline">
              <p className="stepno">Step {i + 1} of {cards.length}</p>
              <div className="prog" aria-hidden="true">{cards.map((c, k) => <span key={c.id} className={k <= i ? "on" : ""} />)}</div>
            </div>
          )}
          <h2 id="pots-setup-title" className="obq" style={{ marginTop: 0 }} tabIndex={-1} ref={cardRef}>{card.title}</h2>
          {card.body ? card.body(saveRef) : card.children}
          <button type="button" className="cta" onClick={() => go(true)}>{last ? "Start using POTS tools" : "Next"}</button>
          {card.skip?.big
            ? <button type="button" className="ghostbtn" onClick={() => go(false)}>{card.skip.label}</button>
            : <button type="button" className="linkbtn" style={{ marginTop: 8 }} onClick={() => go(false)}>{card.skip?.label || "Skip"}</button>}
        </section>
      </main>
    );
  }

  const s = pots.settings.show;
  const avail = SECTIONS.filter(([id]) => sections[id] && (id !== "stand" || s.test) && (id !== "move" || s.move));
  const inSettings = potsSec === "settings" && !!settings;
  const cur = avail.some(([id]) => id === potsSec) ? potsSec : avail[0]?.[0];
  const openSettings = () => { setPotsSec("settings"); setFocusTo("settings"); };
  const closeSettings = () => { setPotsSec(cur || "today"); setFocusTo("link"); };
  return (
    <main className="pots">
      {head(headRef)}
      {potsSaved(storageDriver) ? <ShortHint /> : <p className="hint">{hint}</p>}
      {avail.length > 1 && !inSettings && (
        <div className="mcrow seg scroll secnav" role="group" aria-label="POTS sections">
          {avail.map(([id, l]) => (
            <button key={id} type="button" aria-pressed={cur === id} className={`mc ${cur === id ? "on" : ""}`} onClick={() => setPotsSec(id)}>{l}</button>
          ))}
        </div>
      )}
      {inSettings ? settings({ headRef: setHeadRef, onBack: closeSettings }) : cur && sections[cur]}
      {cur && (
        <>
          <HelpNow preg={preg} />
          {!inSettings && settings && <button type="button" className="linkbtn" ref={setLinkRef} style={{ display: "block", marginTop: 14 }} onClick={openSettings}>POTS settings</button>}
        </>
      )}
    </main>
  );
}
