import { useId, useState } from "react";

/* Layered privacy notice: a short summary sits on screen, and the exact specifics sit
   behind this plain-labelled toggle. Same pattern as the app's other sections
   (.disclosure button + .bodypanel), compact variant. The panel stays in the page while
   closed (hidden), so the full text is always part of the screen. */
export default function Details({ label = "Details", children }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className="morewrap">
      <button type="button" className="disclosure more" aria-expanded={open} aria-controls={id} onClick={() => setOpen((v) => !v)}>
        <span>{label}</span><span aria-hidden="true">{open ? "−" : "+"}</span>
      </button>
      <div id={id} className="bodypanel more" hidden={!open}>{children}</div>
    </div>
  );
}

/* Browser reminders: what Cyra's server keeps, shared by the consent step and Settings. */
export function WebReminderFacts() {
  return (
    <ul>
      <li>Your browser's push service delivers the reminder.</li>
      <li>An update or restart of Cyra's server can pause reminders until you next open Cyra, which sets them up again.</li>
      <li>Cyra's server keeps only this browser's push address and its encryption keys, which days and what time to remind you, your time zone, and the last day it sent you a reminder.</li>
      <li>Turning reminders off erases them. If Cyra's server can't be reached or doesn't confirm it then, Cyra asks again while Cyra is open and each time you open it, until the server confirms. This browser stops accepting reminders right away.</li>
    </ul>
  );
}
