import { useEffect, useRef, useState } from "react";
import { NOTE_MAX } from "../lib/daylog.js";

/* The day note (L6, decision D7): an optional short note on the check-in, at most 280 characters (UTF-16 units, the
   unit maxLength counts), saved on that day's entry (App.jsx dayNote; lib/daylog.js cleanNote). Closed it is one
   "Add a note" link; it opens on that tap (focusing the field) and stays open while the day has a note, so clearing
   the text never collapses it mid-edit. The hint is a privacy statement (docs/PRIVACY-AUDIT.md, L6 and L9): the note lives
   on the device and in the backups she saves, reaches a file only through the Report's "Include my notes" tick
   (the appointment PDF, L9), and is never sent anywhere. */
export default function DayNote({ value = "", onChange, label }) {
  const [open, setOpen] = useState(!!value);
  const field = useRef(null);
  const wrap = useRef(null);
  const focusNext = useRef(false);
  useEffect(() => { if (value) setOpen(true); }, [value]);
  // Opened by her tap: focus the field and bring the whole note (hint and counter too) clear of the sticky Save bar
  // that follows it; focusing alone doesn't scroll a field that is already on screen behind that bar.
  useEffect(() => {
    if (!open || !focusNext.current) return;
    focusNext.current = false;
    field.current?.focus({ preventScroll: true });
    const el = wrap.current;
    if (!el || typeof window === "undefined") return;
    const bar = document.querySelector(".stopbar.savebar");
    const limit = Math.min(window.innerHeight, bar ? bar.getBoundingClientRect().top : window.innerHeight) - 8;
    const over = el.getBoundingClientRect().bottom - limit;
    if (over > 0) window.scrollBy(0, over);
  }, [open]);
  if (!open && !value) {
    return <button type="button" className="linkbtn addnote" onClick={() => { focusNext.current = true; setOpen(true); }}>Add a note</button>;
  }
  const left = NOTE_MAX - value.length;
  const live = left === 20 ? "20 characters left." : left === 10 ? "10 characters left." : left <= 0 ? "The note is full." : "";
  return (
    <div className="daynote" ref={wrap}>
      <label className="section-lab" htmlFor="day-note">{label}</label>
      <textarea id="day-note" ref={field} className="inp" rows={3} maxLength={NOTE_MAX} placeholder="A trigger, a change, anything worth remembering" aria-describedby="day-note-hint day-note-count" value={value} onChange={(e) => onChange(e.target.value.slice(0, NOTE_MAX))} />
      <div className="notefoot">
        <p className="rfoot" id="day-note-hint">Kept with this day on this device and in backups you save. It goes into an appointment PDF only if you tick Include my notes; Cyra never sends it anywhere.</p>
        <span id="day-note-count" className={`notecount${left <= 20 ? " near" : ""}`}>{value.length}/{NOTE_MAX}</span>
      </div>
      <p className="sr-only" aria-live="polite">{live}</p>
    </div>
  );
}
