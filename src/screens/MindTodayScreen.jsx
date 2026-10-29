import { Card } from "../components/ui/index.js";
import Icon from "../components/Icon.jsx";
import MoodFace from "../components/mind/MoodFace.jsx";
import BreathOrb from "../components/mind/BreathOrb.jsx";
import { MOODS, FEELINGS, ENERGY_LEVELS, FOG_LEVELS, needLabel } from "../lib/mind.js";

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
        <h1 className="disp">How are you feeling?</h1>
        <p className="hint">One tap is enough. It saves as you go and stays on this device.</p>
      </div>

      <Card className="checkcard" tint="mind" icon="smile" eyebrow="Check-in" title="Your mood today" level={2} id="mood-card" hero>
        <div className="moodrow" role="group" aria-label="Mood today">
          {MOODS.map((m) => (
            <button key={m.v} type="button" className={`moodbtn${day.mood === m.v ? " on" : ""}`} aria-pressed={day.mood === m.v} onClick={() => onMood(day.mood === m.v ? null : m.v)}>
              <MoodFace v={m.v} />
              <span className="moodlab">{m.label}</span>
            </button>
          ))}
        </div>
        <p className="mindlab" id="feel-lab">What else is here? <span>(any)</span></p>
        <div className="feelchips" role="group" aria-labelledby="feel-lab">
          {FEELINGS.map((f) => <button key={f.id} type="button" className={`mc feelchip ${tags.includes(f.id) ? "on" : ""}`} aria-pressed={tags.includes(f.id)} onClick={() => onTag(f.id)}>{f.label}</button>)}
        </div>
        <div className="levels">
          {[["energy", "Energy", ENERGY_LEVELS, "lightning"], ["fog", "Brain fog", FOG_LEVELS, "sun"]].map(([k, lab, levels, icon]) => (
            <div className="levelrow" key={k}>
              <p className="mindlab levellab" id={`lvl-${k}`}><Icon name={icon} size={14} />{lab} <span>(optional)</span></p>
              <div className="seg levelseg" role="group" aria-labelledby={`lvl-${k}`}>
                {levels.map(([v, l]) => <button key={v} type="button" className={`mc ${day[k] === v ? "on" : ""}`} aria-pressed={day[k] === v} onClick={() => onLevel(k, day[k] === v ? null : v)}>{l}</button>)}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {P && (
        <Card className="nextcard" tint="mind" eyebrow="Your next practice" title={P.title} level={2} id="next-practice">
          <div className="nextbody">
            <div className="nextorb"><BreathOrb phase="idle" size={96} still /></div>
            <div className="nexttext">
              <p className="nextwhy">{next.why}</p>
              <p className="nextshort">{P.short}</p>
              <p className="nexttags"><span className="nextmin">{needLabel(next.need)}</span><span className="nextmin">{P.min} min</span></p>
            </div>
          </div>
          <div className="nextacts">
            <button type="button" className="cta nextgo" onClick={() => onOpen(P.id, next.need)}><Icon name="play" size={15} />Start · {P.min} min</button>
            <button type="button" className="linkbtn nextmore" onClick={onMore}>More practices</button>
          </div>
          <p className="nextline">{P.line}</p>
        </Card>
      )}

      {runs.length > 0 && (
        <Card className="helpedcard" tint="you" icon="heart" eyebrow="Today" title="Which one helped?" level={2} id="which-helped">
          <ul className="helpedlist">
            {runs.map((r) => (
              <li key={r.id} className="helpedrow">
                <span className="helpedname" id={`hp-${r.id}`}>{r.title}</span>
                <span className="helpedbtns" role="group" aria-labelledby={`hp-${r.id}`}>
                  <button type="button" className={`mc ${r.helped === "yes" ? "on" : ""}`} aria-pressed={r.helped === "yes"} onClick={() => onHelped(r.id, "yes")}>Helped</button>
                  <button type="button" className={`mc ${r.helped === "no" ? "on" : ""}`} aria-pressed={r.helped === "no"} onClick={() => onHelped(r.id, "no")}>Not this time</button>
                </span>
              </li>
            ))}
          </ul>
          <p className="hint">Cyra suggests what helps you more often. Your answers stay on this device.</p>
        </Card>
      )}
    </main>
  );
}
