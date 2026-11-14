import { useState } from "react";
import { Card, Sheet, Switch } from "./ui/index.js";
import Icon from "./Icon.jsx";
import { PARTNER_COPY as C, partnerItems, shareMessage, NOTE_MAX } from "../lib/partner.js";

/* Share with a partner (Task A1). You → a card with one button; the sheet holds the ticks (her choices are kept on this
   device in partnerShare), a short note she types (never saved), a preview of the exact message and Share, which hands
   the text to the phone's share sheet (web: the browser's share, else a copy; lib/files.js shareText). The optional
   reminder is a local notification on the phone; in a browser the switch is replaced by one line saying so.
   Props: prefs { pick, remind }, setPrefs(next), pred (lib/engine.js predict or null), ttc, phone (reminders possible
   here), onShare(text) → Promise<"shared" | "copied" | "cancelled" | "blocked">. Nothing here sends anything itself. */
export function PartnerCard({ onOpen }) {
  return (
    <Card id="you-partner" tint="you" icon="share" eyebrow={C.eyebrow} title={C.title} level={2} className="youpartner">
      <p className="hint">{C.cardLine}</p>
      <button type="button" className="ghostbtn" aria-haspopup="dialog" onClick={onOpen}>{C.title}</button>
    </Card>
  );
}

export function PartnerSheet({ prefs, setPrefs, pred, ttc = false, phone = false, onShare, onClose }) {
  const [note, setNote] = useState("");
  const items = partnerItems({ ttc });
  const pick = prefs.pick.filter((id) => items.some((i) => i.id === id));
  const msg = shareMessage({ pick, pred, ttc, note });
  const toggle = (id) => setPrefs({ ...prefs, pick: pick.includes(id) ? pick.filter((x) => x !== id) : [...pick, id] });
  return (
    <Sheet id="partner-sheet" title={C.title} closeLabel={`Close ${C.title}`} onClose={onClose} className="partnersheet">
      <p className="hint">{C.lead}</p>
      {!pred && <p className="hint" role="note">{C.noPrediction}</p>}
      <p className="section-lab" id="partner-pick">{C.pickLab}</p>
      <div className="partnerpicks" role="group" aria-labelledby="partner-pick">
        {items.map((i) => {
          const on = pick.includes(i.id);
          return (
            <button key={i.id} type="button" role="checkbox" aria-checked={on} className={`consentopt ${on ? "on" : ""}`} disabled={!pred} onClick={() => toggle(i.id)}>
              <span className="ckbox" aria-hidden="true">{on ? "✓" : ""}</span><span>{i.label}</span>
            </button>
          );
        })}
      </div>
      <label className="qlab" htmlFor="partner-note">{C.noteLab}</label>
      <textarea id="partner-note" className="inp" rows={2} maxLength={NOTE_MAX} placeholder={C.notePh} value={note} onChange={(e) => setNote(e.target.value.slice(0, NOTE_MAX))} />
      <p className="section-lab" id="partner-preview-lab">{C.preview}</p>
      <div className="partnerpreview" aria-labelledby="partner-preview-lab" role="region" aria-live="polite">
        {msg.empty ? <p className="hint">{C.nothing}</p> : msg.text.split("\n").map((l, k) => <p key={k}>{l}</p>)}
      </div>
      <button type="button" className="cta partnergo" disabled={msg.empty} onClick={() => onShare(msg.text)}><Icon name="share" size={16} />{C.share}</button>
      <p className="rfoot">{C.privacy}</p>
      {phone ? (
        <div className="modrow partnerremind">
          <div className="modrow-main">
            <div className="modinfo"><b id="partner-remind-n">{C.remindName}</b></div>
            <Switch checked={prefs.remind} onChange={(v) => setPrefs({ ...prefs, remind: v })} labelledBy="partner-remind-n" describedBy="partner-remind-d" disabled={!pred} />
          </div>
          <p className="modadds" id="partner-remind-d">{C.remindAdds}</p>
        </div>
      ) : <p className="rfoot">{C.remindWeb}</p>}
    </Sheet>
  );
}
