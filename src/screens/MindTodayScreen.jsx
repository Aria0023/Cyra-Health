import { Card, Sheet } from "../components/ui/index.js";
import Icon from "../components/Icon.jsx";
import MoodFace from "../components/mind/MoodFace.jsx";
import BreathOrb from "../components/mind/BreathOrb.jsx";
import { useState } from "react";
import Details from "../components/Details.jsx";
import { MOODS, FEELINGS, FEELING_GROUPS, FIRST_FEELINGS, ENERGY_LEVELS, FOG_LEVELS } from "../lib/mind.js";
import { t } from "../lib/i18n.js";

/* Mind → Today (calm R5, spec §3.5c): the mood check-in (a 5-face row, feeling tags, optional energy and brain-fog
   levels; each tap saves on this device), "Your next practice" picked from today's check-in, and "Which one helped?"
   for the practices she ran today. Words, never scores; one tap is enough. 2026-11-14: the first row of feelings is the
   original ten; fourteen more sit behind "More feelings" in groups (open by itself when one of them is picked), and
   "What these words mean" opens a small sheet with a one-line meaning for each.

   Props: eyebrow (date), day (today's cleaned check-in), onMood(v), onTag(id), onLevel("energy" | "fog", v|null),
   next { practice, need, why } (always a practice she can start), onOpen(practiceId, need), onMore() (→ Practices),
   runs [{ id, p, title, helped? }], onHelped(runId, "yes" | "no"). */
export default function MindTodayScreen({ eyebrow, day = {}, onMood, onTag, onLevel, next, onOpen, onMore, runs = [], onHelped }) {
  const tags = day.tags || [];
  const P = next?.practice;
  const [words, setWords] = useState(false);
  const chip = (f) => <button key={f.id} type="button" className={`mc feelchip ${tags.includes(f.id) ? "on" : ""}`} aria-pressed={tags.includes(f.id)} onClick={() => onTag(f.id)}>{t(`feeling.${f.id}`)}</button>;
  const more = FEELINGS.filter((f) => !FIRST_FEELINGS.includes(f.id));
  return (
    <main className="mindtoday">
      <div className="mindhead">
        <svg className="mindblob" viewBox="0 0 200 120" aria-hidden="true" focusable="false"><path d="M30 64c0-28 30-50 70-50s74 16 80 42-16 52-58 56-92-20-92-48z" /></svg>
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="disp">{t("mind.howAreYouFeeling")}</h1>
        <p className="hint">{t("mind.oneTapIsEnoughIt")}</p>
      </div>

      <Card className="checkcard" tint="mind" icon="smile" eyebrow={t("mind.checkIn")} title={t("mind.yourMoodToday")} level={2} id="mood-card" hero>
        <div className="moodrow" role="group" aria-label={t("mind.moodToday")}>
          {MOODS.map((m) => (
            <button key={m.v} type="button" className={`moodbtn${day.mood === m.v ? " on" : ""}`} aria-pressed={day.mood === m.v} onClick={() => onMood(day.mood === m.v ? null : m.v)}>
              <MoodFace v={m.v} />
              <span className="moodlab">{t(`mood.${m.v}`)}</span>
            </button>
          ))}
        </div>
        <p className="mindlab" id="feel-lab">{t("mind.whatElseIsHere")} <span>{t("mind.any")}</span></p>
        <div className="feelchips" role="group" aria-labelledby="feel-lab">
          {FIRST_FEELINGS.map((id) => chip(FEELINGS.find((f) => f.id === id)))}
        </div>
        <div className="feelmore">
          <Details label={t("mind.moreFeelings")} defaultOpen={more.some((f) => tags.includes(f.id))}>
            {FEELING_GROUPS.map(([g]) => {
              const list = more.filter((f) => f.group === g);
              return list.length ? (
                <div key={g} className="feelgroup">
                  <p className="mindlab feelgroup-lab" id={`feel-g-${g}`}>{t(`feelingGroup.${g}`)}</p>
                  <div className="feelchips" role="group" aria-labelledby={`feel-g-${g}`}>{list.map(chip)}</div>
                </div>
              ) : null;
            })}
          </Details>
          <button type="button" className="linkbtn feelwords" aria-haspopup="dialog" onClick={() => setWords(true)}>{t("mind.feelingWords")}</button>
        </div>
        {words && (
          <Sheet id="feeling-words" title={t("mind.feelingWords")} closeLabel={`Close ${t("mind.feelingWords")}`} onClose={() => setWords(false)} className="feelsheet">
            <p className="hint">{t("mind.feelingWordsLead")}</p>
            {FEELING_GROUPS.map(([g]) => (
              <section key={g} className="feelwords-g" aria-labelledby={`fw-${g}`}>
                <h3 className="section-lab" id={`fw-${g}`}>{t(`feelingGroup.${g}`)}</h3>
                <dl className="feelwords-list">
                  {FEELINGS.filter((f) => f.group === g).map((f) => <div key={f.id} className="feelword"><dt>{t(`feeling.${f.id}`)}</dt><dd>{t(`feelingAbout.${f.id}`)}</dd></div>)}
                </dl>
              </section>
            ))}
          </Sheet>
        )}
        <div className="levels">
          {[["energy", t("mind.level.energy"), ENERGY_LEVELS, "lightning"], ["fog", t("mind.level.fog"), FOG_LEVELS, "sun"]].map(([k, lab, levels, icon]) => (
            <div className="levelrow" key={k}>
              <p className="mindlab levellab" id={`lvl-${k}`}><Icon name={icon} size={14} />{lab} <span>{t("mind.optional")}</span></p>
              <div className="seg levelseg" role="group" aria-labelledby={`lvl-${k}`}>
                {levels.map(([v, l]) => <button key={v} type="button" className={`mc ${day[k] === v ? "on" : ""}`} aria-pressed={day[k] === v} onClick={() => onLevel(k, day[k] === v ? null : v)}>{t(`${k}.${v}`)}</button>)}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {P && (
        <Card className="nextcard" tint="mind" eyebrow={t("mind.yourNextPractice")} title={P.title} level={2} id="next-practice">
          <div className="nextbody">
            <div className="nextorb"><BreathOrb phase="idle" size={96} still /></div>
            <div className="nexttext">
              <p className="nextwhy">{next.why}</p>
              <p className="nextshort">{P.short}</p>
              <p className="nexttags"><span className="nextmin">{t(`need.${next.need}`)}</span><span className="nextmin">{t("mind.min", { min: P.min })}</span></p>
            </div>
          </div>
          <div className="nextacts">
            <button type="button" className="cta nextgo" onClick={() => onOpen(P.id, next.need)}><Icon name="play" size={15} />{t("mind.startMin", { min: P.min })}</button>
            <button type="button" className="linkbtn nextmore" onClick={onMore}>{t("mind.morePractices")}</button>
          </div>
          <p className="nextline">{P.line}</p>
        </Card>
      )}

      {runs.length > 0 && (
        <Card className="helpedcard" tint="you" icon="heart" eyebrow={t("mind.today")} title={t("mind.whichOneHelped")} level={2} id="which-helped">
          <ul className="helpedlist">
            {runs.map((r) => (
              <li key={r.id} className="helpedrow">
                <span className="helpedname" id={`hp-${r.id}`}>{r.title}</span>
                <span className="helpedbtns" role="group" aria-labelledby={`hp-${r.id}`}>
                  <button type="button" className={`mc ${r.helped === "yes" ? "on" : ""}`} aria-pressed={r.helped === "yes"} onClick={() => onHelped(r.id, "yes")}>{t("mind.helped")}</button>
                  <button type="button" className={`mc ${r.helped === "no" ? "on" : ""}`} aria-pressed={r.helped === "no"} onClick={() => onHelped(r.id, "no")}>{t("mind.notThisTime")}</button>
                </span>
              </li>
            ))}
          </ul>
          <p className="hint">{t("mind.cyraSuggestsWhatHelpsYou")}</p>
        </Card>
      )}
    </main>
  );
}
