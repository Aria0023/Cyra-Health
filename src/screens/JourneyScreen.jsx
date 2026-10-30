import { useState } from "react";
import { Card, EmptyNote } from "../components/ui/index.js";
import Icon from "../components/Icon.jsx";
import { moodLabel, rowWords, MOODS } from "../lib/mind.js";
import { t } from "../lib/i18n.js";

/* Mind → Journey (calm R5, spec §3.5c): her mood across her cycle (a calm strip per cycle, one cell per cycle day,
   shaded by the check-in's face; words, never a score), her journal (the same entries as Home's Journal), Connection
   (the relationship log, opened as a sub-page) and Ask Cyra (the written library first; the AI only with her consent,
   exactly as before). Everything here stays on this device except what Ask's own sentences say.

   Props: rows (lib/mind.js moodByCycle), enough (bool: ≥ STRIP_MIN check-ins), sentence, journal { iso: text },
   jDraft, setJDraft, onJournal(text), fmt(iso), conn { line } | null, onConnect(), ask (the embedded Ask section),
   chat (calm R8: Cyra's chat about her log, only for Pro with her switch on; it shows what it sends before every send). */
export default function JourneyScreen({ rows = [], enough = false, sentence, journal = {}, jDraft = "", setJDraft, onJournal, fmt = (x) => x, conn = null, onConnect, ask, chat = null }) {
  const [writing, setWriting] = useState(false);
  const entries = Object.keys(journal).sort().reverse().slice(0, 3);
  const cycled = rows.length > 0 && rows[0].key !== "recent";
  return (
    <main className="journey">
      <div className="mindhead">
        <svg className="mindblob" viewBox="0 0 200 120" aria-hidden="true" focusable="false"><path d="M18 58c6-26 44-46 86-42s76 24 78 50-36 44-80 42-90-24-84-50z" /></svg>
        <p className="eyebrow">{t("journey.mind")}</p>
        <h1 className="disp">{t("journey.journey")}</h1>
        <p className="hint">{cycled ? t("journey.howYouveBeenInYour") : t("journey.howYouveBeenInYour2")}</p>
      </div>

      <Card className="moodcard" tint="mind" icon="smile" eyebrow={cycled ? t("journey.byCycleDay") : t("journey.recentWeeks")} title={cycled ? t("journey.moodAcrossYourCycle") : t("journey.yourMoodLately")} level={2} id="mood-history">
        {!enough ? <EmptyNote /> : <p className="moodsent">{sentence}</p>}
        <div className="moodrows">
          {rows.map((r) => (
            <div className="moodrow-c" key={r.key}>
              <p className="moodrow-lab"><b>{r.label}</b> <span>{rowWords(r)}</span></p>
              <div className="moodcells" role="img" aria-label={`${r.label}: ${rowWords(r)}`} style={{ "--n": Math.max(r.days.length, 28) }}>
                {r.days.map((d) => <i key={d.iso} className={`mcell${d.mood ? ` m${d.mood}` : ""}`} title={d.mood ? `${cycled ? `Day ${d.cd}` : fmt(d.iso)}: ${moodLabel(d.mood)}` : undefined} />)}
              </div>
              {cycled && <p className="moodticks" aria-hidden="true">{[1, 7, 14, 21, 28].map((n) => <span key={n} style={{ "--at": (n - 1) / Math.max(r.days.length, 28) }}>{n}</span>)}</p>}
            </div>
          ))}
        </div>
        <p className="moodkey" aria-hidden="true">{MOODS.map((m) => <span key={m.v}><i className={`mcell m${m.v}`} />{m.label}</span>)}</p>
      </Card>

      <Card className="journalcard" tint="you" icon="book" eyebrow={t("journey.private")} title={t("journey.journal")} level={2} id="journey-journal"
        action={!writing ? <button type="button" className="linkbtn jwrite" onClick={() => setWriting(true)}>{t("journey.write")}</button> : null}>
        {writing && (
          <div className="jform">
            <label className="sr-only" htmlFor="journey-j">{t("journey.journalEntryForToday")}</label>
            <textarea id="journey-j" className="inp" rows={3} maxLength={2000} value={jDraft} placeholder={t("journey.anythingOnYourMind")} onChange={(e) => setJDraft(e.target.value)} />
            <div className="jacts">
              <button type="button" className="cta" disabled={!jDraft.trim()} onClick={() => { onJournal(jDraft.trim()); setWriting(false); }}>{t("journey.saveToJournal")}</button>
              <button type="button" className="ghostbtn" onClick={() => setWriting(false)}>{t("journey.cancel")}</button>
            </div>
          </div>
        )}
        {entries.length ? (
          <ul className="jlist">{entries.map((iso) => <li key={iso} className="jentry"><b>{fmt(iso)}</b><p>{journal[iso].length > 180 ? `${journal[iso].slice(0, 178)}…` : journal[iso]}</p></li>)}</ul>
        ) : !writing && <p className="hint">{t("journey.nothingWrittenYetYourJournal")}</p>}
      </Card>

      {conn && (
        <Card className="conncard" tint="body" icon="people" eyebrow={t("journey.optional")} title={t("journey.connection")} level={2} id="journey-conn">
          <p className="hint">{conn.line}</p>
          <button type="button" className="ghostbtn connopen" onClick={onConnect}>{t("journey.openConnection")}<Icon name="arrow-right" size={15} /></button>
        </Card>
      )}

      {chat}

      {ask}
    </main>
  );
}
