import { useId, useState } from "react";
import Icon from "./Icon.jsx";
import { FERT_COPY } from "../lib/fertility.js";

/* Layered privacy notice: a short summary sits on screen, and the exact specifics sit
   behind this plain-labelled toggle. Same pattern as the app's other sections
   (.disclosure button + .bodypanel), compact variant. The panel stays in the page while
   closed (hidden), so the full text is always part of the screen. describedBy (L10): an id the
   toggle button points at with aria-describedby, so a "Details" button in a list says which row
   it belongs to. */
export default function Details({ label = "Details", describedBy, children }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className="morewrap">
      <button type="button" className="disclosure more" aria-expanded={open} aria-controls={id} aria-describedby={describedBy} onClick={() => setOpen((v) => !v)}>
        <span>{label}</span><Icon name="chevron" className="chev" />
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
      <li>An update or restart of Heard Health's server can pause reminders until you next open Heard Health, which sets them up again.</li>
      <li>Heard Health's server keeps only this browser's push address and its encryption keys, which days and what time to remind you, your time zone, and the last day it sent you a reminder.</li>
      <li>Turning reminders off erases them. If Heard Health's server can't be reached or doesn't confirm it then, Heard Health asks again while Heard Health is open and each time you open it, until the server confirms. This browser stops accepting reminders right away.</li>
    </ul>
  );
}

/* L10: three fact lists shared between their original screens and the privacy dashboard, so both render the same
   words (the suites assert them where they first appeared). Text byte-identical to the screens before L10. */
/** Settings → Anonymous weekly counts → "Exactly what's sent" (the fertility line for stage periods, L7; the POTS line last). */
export function CountsFacts({ stage = null }) {
  return (
    <ul>
      <li>Sent at most once a day, and never on the day you log them.</li>
      <li>"Once a week" is counted on this device: deleting the app or clearing this browser's data resets it.</li>
      <li>No dates, values, name or account. Like any request, it carries your device's internet address.</li>
      <li>They're added to the weekly "You're not alone" counts.</li>
      {stage === "periods" && <li>{FERT_COPY.countsLi}</li>}
      <li>Nothing you log in POTS tools is ever part of weekly counts.</li>
    </ul>
  );
}
/** Ask → "Exactly what's sent" under the AI opt-in. */
export function AiFacts() {
  return (
    <ul>
      <li>The question you typed (up to 500 characters) is sent. Your name, account and life stage don't go with it.</li>
      <li>Heard Health doesn't keep your question. Anthropic keeps it for a limited time under its own terms.</li>
    </ul>
  );
}
/** Home → Wearables → "How each connection works" (the phone line only on a phone). */
export function WearableFacts({ native = false }) {
  return (
    <ul>
      {native && <li>Heard Health never sends Apple Health or Health Connect readings anywhere; they leave this phone only inside an encrypted backup you choose to save.</li>}
      <li>Oura readings pass through Heard Health's server on the way to you and aren't stored there.</li>
      <li>Fitbit, Garmin and Whoop connect through Terra, a health-data service that keeps your connection, and the data it collects, under its own policy. Their readings wait in Heard Health's server memory (never on disk) until this device collects them, and are deleted after 7 days if not collected.</li>
      <li>Disconnect ends the connection; anything Terra already collected stays under Terra's policy.</li>
      <li>Delete everything also ends both connections. If Heard Health can't confirm that, your record isn't deleted yet: Heard Health shows what did and didn't end, and lets you try again where that can help, or delete on this device anyway.</li>
    </ul>
  );
}
