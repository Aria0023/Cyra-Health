/* Feedback and Help (2026-11-19, docs/plans/launch-tools.md Task 3). You → Help has a few short answers and, in a build
   with a server, "Send feedback" and "Report a problem": one sheet, two kinds. Pure, with NO imports: Node (unit tests)
   imports this file, where import.meta.env is undefined.

   What is sent, and only when she presses Send: POST <server>/api/feedback with EXACTLY the object feedbackPayload()
   returns, which is also exactly what the sheet's "What will be sent" preview shows:
     { kind, message, build, platform, language }                       always
     { ..., reply: true, email }                                        only with "It's OK to reply to me" on
   Nothing else: nothing from her log, no life stage, no module, no device id, no account id. Without the reply switch
   the request carries no sign-in token either, even when she is signed in (credentials "omit", no referrer), so the
   server cannot link it to her account. With the switch on, her sign-in token goes in the Authorization header so the
   server can check the email is hers and delete the feedback with her account.
   This is the first free text the app can send to Solia Health's server: the sheet asks her not to include health
   details, and the privacy dashboard says what happens if she does. Nothing is sent while she types or opens the
   preview. A build without a server never offers the sheet: Help then shows the support email link only (if set). */

export const FEEDBACK_PATH = "/api/feedback";
export const FEEDBACK_MAX = 2000;
export const FEEDBACK_KINDS = Object.freeze(["feedback", "problem"]);
export const FEEDBACK_PLATFORMS = Object.freeze(["web", "ios", "android"]);
const EMAIL_RE = /^[^\s@<>"',;:]+@[^\s@<>"',;:]+\.[^\s@<>"',;:]{2,}$/;

/** A support address from build config, or "" (anything that isn't one plain address). */
export const cleanSupportEmail = (v) => { const s = String(v ?? "").trim(); return s.length <= 254 && EMAIL_RE.test(s) ? s : ""; };
export const SUPPORT_EMAIL = cleanSupportEmail(import.meta.env?.VITE_SUPPORT_EMAIL);
export const supportHref = (email, subject = "Solia Health support") => (email ? `mailto:${email}?subject=${encodeURIComponent(subject)}` : "");

/** Her text as it will be sent: line endings made plain, control characters dropped, trimmed. Never shortened. */
export const cleanMessage = (v) => String(v ?? "").replace(/\r\n?/g, "\n").replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, "").trim();

/** May the reply switch be shown? Only while signed in with an account that has an email. */
export const canReply = (account) => !!(account && typeof account.email === "string" && EMAIL_RE.test(account.email.trim()));

/**
 * The exact request body, or null when there is nothing valid to send. `reply` adds { reply: true, email } and only
 * when the account has an email; nothing else can get in, whatever the caller passes.
 */
export function feedbackPayload({ kind, message, build, platform, language, reply = false, account = null } = {}) {
  const text = cleanMessage(message);
  if (!FEEDBACK_KINDS.includes(kind) || !text || text.length > FEEDBACK_MAX) return null;
  const out = {
    kind, message: text,
    build: String(build ?? "").slice(0, 40),
    platform: FEEDBACK_PLATFORMS.includes(platform) ? platform : "web",
    language: /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$/.test(String(language ?? "")) ? String(language) : "en",
  };
  if (reply === true && canReply(account)) { out.reply = true; out.email = account.email.trim(); }
  return out;
}

/** The preview's rows, in the payload's own order: [key, label, value]. Every key of the payload has a row, and each
    value is shown as it is sent (the one yes/no field, reply, reads "Yes"). */
export function previewRows(payload) {
  if (!payload) return [];
  const L = FEEDBACK_COPY.fields;
  return Object.keys(payload).map((k) => [k, L[k] || k, k === "reply" ? FEEDBACK_COPY.replyYes : String(payload[k])]);
}

/**
 * Sends the payload. → { ok: true } | { ok: false, why: "limit" | "signin" | "server" | "network" }.
 * The token is used only when the payload says reply; otherwise the request carries no sign-in at all.
 */
export async function sendFeedback(payload, { base = "", token = null, fetchImpl = globalThis.fetch, timeoutMs = 15000 } = {}) {
  if (!payload || !base || typeof fetchImpl !== "function") return { ok: false, why: "server" };
  const headers = { "content-type": "application/json" };
  if (payload.reply === true && token) headers.authorization = `Bearer ${token}`;
  const ctrl = typeof AbortController === "function" ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
  try {
    const r = await fetchImpl(`${base}${FEEDBACK_PATH}`, { method: "POST", headers, body: JSON.stringify(payload), credentials: "omit", referrerPolicy: "no-referrer", cache: "no-store", ...(ctrl ? { signal: ctrl.signal } : {}) });
    if (r.ok) return { ok: true };
    return { ok: false, why: r.status === 429 ? "limit" : r.status === 401 ? "signin" : "server" };
  } catch { return { ok: false, why: "network" }; }
  finally { if (timer) clearTimeout(timer); }
}

export const FEEDBACK_COPY = Object.freeze({
  sendFeedback: "Send feedback",
  reportProblem: "Report a problem",
  title: Object.freeze({ feedback: "Send feedback", problem: "Report a problem" }),
  kindLabel: "What is it?",
  kindName: Object.freeze({ feedback: "Feedback", problem: "A problem" }),
  warn: "Please don't include health details. Nothing from your log is attached.",
  boxLabel: Object.freeze({ feedback: "Your feedback", problem: "What went wrong?" }),
  count: (n) => `${n} of ${FEEDBACK_MAX} characters`,
  tooLong: `That's over ${FEEDBACK_MAX} characters. Shorten it to send.`,
  replyName: "It's OK to reply to me",
  replyHint: (email) => `Off: we can't tell who sent it. On: your account email (${email}) is sent with it so we can answer, and it's kept with your account.`,
  replyYes: "Yes",
  previewLabel: "What will be sent",
  previewLead: "Exactly this, and only when you press Send:",
  previewEmpty: "Type your message to see exactly what will be sent.",
  previewFootAnon: "Nothing else: nothing from your log, no life stage, no device id, and no sign-in, so Solia Health can't tell who sent it. Like any request, it shows your device's internet address and app or browser type; Solia Health's code uses the address only in memory, to limit repeated requests, and doesn't keep it.",
  previewFootReply: "Nothing else: nothing from your log, no life stage and no device id. It's sent with your sign-in, so Solia Health's server links it to your account and deletes it if you delete your account. Like any request, it shows your device's internet address and app or browser type; Solia Health's code uses the address only in memory, to limit repeated requests, and doesn't keep it.",
  kept: "Solia Health's team reads it. It's kept for 365 days, then deleted.",
  fields: Object.freeze({ kind: "Kind (feedback or problem)", message: "Your message", build: "App version", platform: "Platform (web, ios or android)", language: "App language", reply: "OK to reply", email: "Your account email" }),
  send: "Send",
  sending: "Sending…",
  cancel: "Cancel",
  sent: Object.freeze({ feedback: "Thank you. Your feedback was sent.", problem: "Thank you. Your report was sent." }),
  err: Object.freeze({
    limit: "Too many messages from this connection in a short time, so this one wasn't sent. Try again in a minute.",
    signin: "Your sign-in has ended, so this wasn't sent. Turn off \"It's OK to reply to me\" to send it without your email, or sign in again.",
    server: "Solia Health's server didn't accept it, so nothing was sent. Try again later.",
    network: "Solia Health's server couldn't be reached, so nothing was sent. Check your connection and try again.",
  }),
  // the privacy dashboard's row (lib/privacyFlows.js)
  flowName: "Feedback you send",
  flowState: "When you send one",
  flowLine: "Only when you press Send in You → Help: your message, whether it's feedback or a problem, the app version, web, iOS or Android, and the app's language. Nothing from your log is attached. Your account email goes with it only if you turn on \"It's OK to reply to me\".",
  flowDetail1: "It's the one place you can type free text that goes to Solia Health's server. Whatever you type is sent as you wrote it, so please don't include health details: if you do, they are stored with your message.",
  flowDetail2: "Solia Health's team reads it in a private page. It's kept for 365 days, then deleted. Without \"It's OK to reply to me\" it's sent with no sign-in and isn't linked to your account. With it on, it's linked to your account and deleted when you delete your account.",
  flowDetail3: "Like any request, it shows your device's internet address and app or browser type. Solia Health's own code uses the address only in memory, to limit repeated requests, and doesn't keep it. Feedback is never sent to the AI.",
});

/**
 * Help: the short answers, each true of THIS build. f = { trialGate, native, server, wearables, deviceSync, accounts }.
 * → [{ id, q, a: [paragraphs] }]
 */
export function helpItems(f = {}) {
  const items = [];
  items.push({ id: "free-week", q: "How does the free week work?", a: f.trialGate
    ? ["Your first 7 days include everything. After that, saving new entries needs Pro.", "Everything you already logged stays yours: you can open it, export it or delete it any time, with or without Pro."]
    : ["This version has no free-week limit: logging, your cycle and a clear summary for appointments are free.", "Where Pro can be bought (in the phone app, through the App Store or Google Play), the first 7 days include everything, and after that saving new entries needs Pro. What you logged always stays yours to open, export or delete."] });
  items.push({ id: "cancel", q: "How do I cancel Pro?", a: [
    "Pro is bought through the App Store or Google Play and renews there until you cancel. Cancel it in that store's subscription settings: Solia Health can't cancel it for you.",
    "Signing out, deleting your Solia Health account or removing the app doesn't cancel a subscription. Ending Pro never changes or deletes anything you logged."] });
  items.push({ id: "data", q: "Where does my data live?", a: [
    `What you log is kept on this device. ${f.accounts ? "Solia Health's servers keep no readable copy: only your encrypted account backup, if you make one." : "Solia Health's servers don't keep a copy."}`,
    "That also means Solia Health can't get it back for you. Save an encrypted backup now and then in You → Privacy & your data, and keep the file and its passphrase somewhere safe.",
    "The same card shows everything that can leave this device, and Delete everything."] });
  const watch = [];
  if (f.deviceSync && f.native) watch.push("Open You → Data sources and connect Apple Health (iPhone) or Health Connect (Android). Your watch's or ring's own app shares with it, and Solia Health reads it on your phone: those readings are never sent to a server.");
  if (f.wearables && f.server) watch.push(`${f.deviceSync && f.native ? "An Oura ring can also be connected" : "An Oura ring is connected"} from You → Data sources, where the list offers it: you sign in with Oura, and each sync goes through Solia Health's server, which passes your readings to this device without keeping them.`);
  if (f.deviceSync && !f.native) watch.push("Apple Health and Health Connect are read on the phone, so they need the Solia Health phone app; a browser can't reach them.");
  if (!watch.length) watch.push("This version of Solia Health doesn't connect to a watch or ring. Everything works without one.");
  else watch.push("Solia Health works fully without a device, and you can disconnect any time.");
  items.push({ id: "watch", q: "How do I connect a watch or ring?", a: watch });
  return items;
}

export const HELP_COPY = Object.freeze({
  eyebrow: "Help",
  title: "Questions and feedback",
  lead: "Short answers to common questions.",
  contact: "Tell us",
  contactLead: "Something not working, or an idea? It goes to Solia Health's team.",
  emailLead: "You can also write to",
  emailOnlyLead: "Need help? Write to",
});
