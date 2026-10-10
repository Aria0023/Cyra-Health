import { useEffect, useRef, useState } from "react";
import { setSettings, finishSetup } from "../lib/pots.js";
import { POTS_LOCKED_COPY } from "../lib/potsConstants.js";

/* POTS tab (spec A13; lib/pots.js). An optional add-on inside whichever single life stage
   she has: it never shows a stage choice and never changes the stage. Everything here is
   kept in the on-device record (`pots`) and is never part of weekly counts.

   - A `pots` written by a newer build is shown read-only: one card, no writes.
   - First run: short setup cards, each skippable; finishing or skipping the last one sets
     setupDone. Card 1 ("What would help?") chooses which Today cards show (settings.show),
     and offers only the tools this build has: `shows` lists the settings.show keys whose card
     or section exists, added by the slice that ships it. With nothing to offer and no other
     card, there is no setup yet (setupDone stays false, so the first run comes once the tools
     do). Later slices add their own cards through `setupCards` ({ id, title, children, next }).
   - Sections (Today · Stand test · Move · Patterns · Report) are a button group, not a
     nested tablist. A section shows only once it has content (`sections`, filled by the
     slices that build each one); Stand test also needs settings.show.test and Move
     settings.show.move, so "less on screen" really is less. */
const SECTIONS = [["today", "Today"], ["stand", "Stand test"], ["move", "Move"], ["patterns", "Patterns"], ["report", "Report"]];
const SHOW_CHOICES = [["test", "Stand test"], ["fluid", "Fluids & salt"], ["sym", "Symptoms"], ["meds", "Meds & supports"], ["move", "Movement"]];
const HINT = "Kept on this device. Never part of weekly counts. Cyra can't diagnose POTS; only a clinician can, and good notes make that visit faster.";

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
      <p className="hint" style={{ marginBottom: 12 }}>Less on screen can help on foggy days.</p>
    </>
  );
}

export default function PotsScreen({ pots, setPots, locked, potsSec, setPotsSec, sections = {}, setupCards = [], shows = [] }) {
  const headRef = useRef(null), cardRef = useRef(null);
  const [step, setStep] = useState(0);
  const [show, setShow] = useState(() => ({ ...(pots?.settings?.show || {}) }));
  const [focusTo, setFocusTo] = useState(null); // move focus only after a tap here, never on arrival
  useEffect(() => {
    if (!focusTo) return;
    (focusTo === "card" ? cardRef : headRef).current?.focus();
    setFocusTo(null);
  }, [focusTo]);

  if (locked) {
    return (
      <main className="pots">
        <h1 className="disp">POTS</h1>
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
      if (save) card.next?.();
      if (last) { setPots(finishSetup); setFocusTo("head"); }
      else { setStep(i + 1); setFocusTo("card"); }
    };
    return (
      <main className="pots">
        <h1 className="disp" tabIndex={-1} ref={headRef}>POTS</h1>
        <p className="hint">{HINT}</p>
        <section className="plaincard" aria-labelledby="pots-setup-title">
          {cards.length > 1 && <p className="stepno" style={{ marginBottom: 4 }}>Step {i + 1} of {cards.length}</p>}
          <h2 id="pots-setup-title" className="obq" style={{ marginTop: 0 }} tabIndex={-1} ref={cardRef}>{card.title}</h2>
          {card.children}
          <button type="button" className="cta" onClick={() => go(true)}>{last ? "Start using POTS tools" : "Next"}</button>
          <button type="button" className="linkbtn" style={{ marginTop: 8 }} onClick={() => go(false)}>Skip</button>
        </section>
      </main>
    );
  }

  const s = pots.settings.show;
  const avail = SECTIONS.filter(([id]) => sections[id] && (id !== "stand" || s.test) && (id !== "move" || s.move));
  const cur = avail.some(([id]) => id === potsSec) ? potsSec : avail[0]?.[0];
  return (
    <main className="pots">
      <h1 className="disp" tabIndex={-1} ref={headRef}>POTS</h1>
      <p className="hint">{HINT}</p>
      {avail.length > 1 && (
        <div className="mcrow" role="group" aria-label="POTS sections" style={{ marginBottom: 14 }}>
          {avail.map(([id, l]) => (
            <button key={id} type="button" aria-pressed={cur === id} className={`mc ${cur === id ? "on" : ""}`} onClick={() => setPotsSec(id)}>{l}</button>
          ))}
        </div>
      )}
      {cur && sections[cur]}
    </main>
  );
}
