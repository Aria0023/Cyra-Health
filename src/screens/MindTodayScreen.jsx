import { Card } from "../components/ui/index.js";
import Icon from "../components/Icon.jsx";
import MoodFace from "../components/mind/MoodFace.jsx";
import BreathOrb from "../components/mind/BreathOrb.jsx";
import { MOODS, FEELINGS, ENERGY_LEVELS, FOG_LEVELS } from "../lib/mind.js";
import { t } from "../lib/i18n.js";

/* Mind → Today (calm R5, spec §3.5c): the mood check-in (a 5-face row, feeling tags, optional energy and brain-fog
   levels; each tap saves on this device), "Your next practice" picked from today's check-in, and "Which one helped?"
   for the practices she ran today. Words, never scores; one tap is enough.

   Props: eyebrow (date), day (today's cleaned check-in), onMood(v), onTag(id), onLevel("energy" | "fog", v|null),
   next { practice, need, why } (always a practice she can start), onOpen(practiceId, need), onMore() (→ Practices),
   runs [{ id, p, title, helped? }], onHelped(runId, "yes" | "no"). */
export default function MindTodayScreen({ eyebrow, day = {}, onMood, onTag, onLevel, next, onOpen, onMore, runs = [], onHelped }) {
  const tags = day.tags || [];
  const P = next?.practice;
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
          {FEELINGS.map((f) => <button key={f.id} type="button" className={`mc feelchip ${tags.includes(f.id) ? "on" : ""}`} aria-pressed={tags.includes(f.id)} onClick={() => onTag(f.id)}>{t(`feeling.${f.id}`)}</button>)}
        </div>
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
