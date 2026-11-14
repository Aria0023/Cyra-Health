/* Share with a partner (2026-11-14, docs/plans/partner-learn-glucose-shop.md Task A1): she ticks what to include and
   the app writes a short, kind message that she sends herself through the phone's share sheet (web: the browser's
   share, else a copy). Pure: no React, storage or network; imports engine.js only.

   What it never does: there is no partner account and nothing is stored on a server. The message holds only what she
   ticked: the next period window, the fertile window (Trying to conceive only), today's cycle day and phase, and a
   short note she types. Never symptoms, notes from her log, moods, ids or anything she didn't tick. Every date is
   worded as an estimate. The optional reminder ("Send an update before my period") is a local notification on the
   phone with a generic text that says nothing about her body.

   Record key partnerShare { pick: ids[], remind: boolean } (record, in backups): her ticks and the reminder switch. The
   note is never saved. */
import { fmt, addDays } from "./engine.js";

export const PARTNER_ITEMS = Object.freeze([
  Object.freeze({ id: "next", label: "When my next period is likely" }),
  Object.freeze({ id: "fertile", label: "My estimated fertile window", ttcOnly: true }),
  Object.freeze({ id: "today", label: "Today's cycle day and phase" }),
]);
export const PARTNER_IDS = Object.freeze(PARTNER_ITEMS.map((i) => i.id));
export const NOTE_MAX = 200;

export const PARTNER_COPY = Object.freeze({
  eyebrow: "Share",
  title: "Share with a partner",
  cardLine: "Send a short update you choose, such as when your next period is likely. You send it yourself; nothing is stored on a server.",
  lead: "Tick what to include. You send it yourself, from your phone's share sheet or as copied text.",
  pickLab: "Include",
  noteLab: "A short note (optional)",
  notePh: "For example: Could we keep Saturday quiet?",
  preview: "What they'll get",
  share: "Share",
  copy: "Copy the message",
  nothing: "Tick at least one thing, or write a note.",
  noPrediction: "Your cycle dates show here once Solia Health can estimate them. Log a period start first.",
  privacy: "Nothing is stored on a server and there is no partner account. Only what you tick is in the message; never your symptoms, notes or moods.",
  remindName: "Remind me to send an update before my period",
  remindAdds: "A notification on this phone 2 days before your next period is likely. It only says \"A reminder you set: send your partner an update.\"",
  remindWeb: "Reminders to send an update work in the Solia Health app on a phone.",
  shared: "Shared. Only what you ticked was in the message.",
  copied: "Copied. Paste it wherever you talk.",
});
/** The phone notification's words: nothing about her body or her cycle. */
export const PARTNER_NOTIFY = Object.freeze({ id: 2100, title: "Solia Health", body: "A reminder you set: send your partner an update." });

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
/** partnerShare as stored: { pick: known ids in PARTNER_ITEMS order, remind: boolean }. Default: next period and today. */
export function cleanPartnerShare(v) {
  const o = isObj(v) ? v : {};
  const pick = Array.isArray(o.pick) ? PARTNER_IDS.filter((id) => o.pick.includes(id)) : ["next", "today"];
  return { pick, remind: o.remind === true };
}
/** The items she can tick here: the fertile window only for Trying to conceive. */
export const partnerItems = ({ ttc = false } = {}) => PARTNER_ITEMS.filter((i) => !i.ttcOnly || ttc);
/** The note, trimmed, single-spaced and at most NOTE_MAX characters. */
export const cleanNote = (s) => String(s || "").replace(/\s+/g, " ").trim().slice(0, NOTE_MAX);

const PHASE = { menstrual: "period days", follicular: "follicular phase", luteal: "luteal phase", fertile: "fertile window" };
const range = (a, b) => (a === b ? fmt(a) : `${fmt(a)} and ${fmt(b)}`);

/** The message lines for what she ticked. pred: lib/engine.js predict() (or null); ttc: Trying to conceive; note: typed.
    → { lines: string[], text: string, empty: boolean }. Without a prediction the cycle lines are left out. */
export function shareMessage({ pick = [], pred = null, ttc = false, note = "" } = {}) {
  const want = new Set(pick);
  const lines = [];
  if (pred && want.has("next") && pred.fromIso && pred.toIso) lines.push(`My next period is likely to start between ${range(pred.fromIso, pred.toIso)}. It's an estimate, so it can move.`);
  if (pred && ttc && want.has("fertile") && pred.fertileFromIso && pred.fertileToIso) lines.push(`My estimated fertile window is ${fmt(pred.fertileFromIso)} to ${fmt(pred.fertileToIso)}. An estimate, not a guarantee.`);
  if (pred && want.has("today") && Number.isInteger(pred.cycleDay) && pred.cycleDay > 0) {
    // Outside Trying to conceive the fertile window is never named, so a "fertile" phase reads as the cycle day only.
    const ph = pred.phase === "fertile" && !ttc ? null : PHASE[pred.phase] || null;
    lines.push(`Today is day ${pred.cycleDay} of my cycle${ph ? ` (${ph})` : ""}.`);
  }
  const n = cleanNote(note);
  if (n) lines.push(n);
  const empty = lines.length === 0;
  const text = empty ? "" : ["A quick update from me:", ...lines.map((l) => (l === n ? l : `• ${l}`)), "Sent from Solia Health. Only what I chose is shared."].join("\n");
  return { lines, text, empty };
}

/** When the phone reminder fires: 18:00 local, 2 days before the first likely day of the next period, if that is still
    ahead of nowMs; null otherwise (no prediction, or that time has passed). */
export function partnerReminderAt(pred, nowMs = Date.now()) {
  if (!pred || typeof pred.fromIso !== "string") return null;
  const day = addDays(pred.fromIso, -2);
  const [y, m, d] = day.split("-").map(Number);
  const at = new Date(y, m - 1, d, 18, 0, 0, 0).getTime();
  return Number.isFinite(at) && at > nowMs ? at : null;
}
