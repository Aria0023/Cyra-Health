/* Cyra's AI write-up and chat (calm R8): her switches, what stays on this device, and every sentence the two features
   show. Pure: no imports, no storage, no network. Each sentence here must stay literally true of every build:
   - both features exist only in a build with the ai flag and a server (lib/features.js, lib/api.js), and only on the
     Pro plan (lib/plan.js aiPatternReports / aiChat); they are off until she turns them on in You → Cyra's AI;
   - before EVERY send, "What Cyra will send" shows the exact JSON body, and nothing goes until she taps Send;
   - the body is { summary } (write-up) or { summary, question, history } (chat), the summary built by lib/aiSummary.js;
   - Cyra's server forwards it to Anthropic and keeps no text, only the month's count per account for the monthly
     allowance (backend/src/modules/ai/usage.js); Anthropic keeps requests for a
     limited time under its own terms (the same sentence as Ask's AI_DISCLOSURE);
   - the write-up and the chat history are kept on this device only (aiWeekly, aiChat: device-only, never in a backup
     file), and turning a feature off clears what it kept.
   Listed in docs/PRIVACY-AUDIT.md "Calm R8". */

export const AI_PREFS_DEFAULT = Object.freeze({ weekly: false, chat: false, labs: false });
/** Her switches: { weekly, chat, labs }, each a real true or false (anything else is off). */
export const cleanAiPrefs = (v) => ({ weekly: !!v && v.weekly === true, chat: !!v && v.chat === true, labs: !!v && v.labs === true });

export const CHAT_MAX = 40;
export const CHAT_TEXT_MAX = 2000;
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
/** The chat on this device: [{ role: "me" | "cyra", text, kind?: "urgent" | "local", ask? }]
    (kind "local": a question answered on this device, never sent), the last CHAT_MAX messages. */
export function cleanAiChat(v) {
  if (!Array.isArray(v)) return [];
  return v.filter((m) => isObj(m) && (m.role === "me" || m.role === "cyra") && typeof m.text === "string" && m.text.trim())
    .slice(-CHAT_MAX)
    .map((m) => ({ role: m.role, text: m.text.slice(0, CHAT_TEXT_MAX), ...(m.kind === "urgent" || m.kind === "local" ? { kind: m.kind } : {}), ...(typeof m.ask === "string" && m.ask.trim() ? { ask: m.ask.slice(0, 300) } : {}) }));
}
/** The last write-up on this device: { writeup, ask, day } | null. */
export function cleanAiWeekly(v) {
  if (!isObj(v) || typeof v.writeup !== "string" || !v.writeup.trim()) return null;
  return { writeup: v.writeup.slice(0, 2000), ask: typeof v.ask === "string" && v.ask.trim() ? v.ask.slice(0, 300) : null, day: typeof v.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v.day) ? v.day : null };
}

/** Which of the two this build and plan can offer at all. */
export const aiOffer = ({ flag = false, server = false, canWeekly = false, canChat = false } = {}) => ({
  any: !!(flag && server), weekly: !!(flag && server && canWeekly), chat: !!(flag && server && canChat),
});

/** "December 1" for an ISO date (YYYY-MM-DD); the date itself if it can't be read. */
export const monthDay = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || "")); if (!m) return String(iso || "next month"); return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" }); };

export const AI_COPY = Object.freeze({
  // You → Cyra's AI
  weeklyName: "Weekly write-up",
  weeklyShort: "A short write-up of your last 8 weeks, on Patterns",
  weeklyAdds: "When you ask for one, Solia Health sends a summary of your last 8 weeks: counts, averages and cycle lengths, with no dates, notes or anything that names you. It goes through Solia Health's server to Anthropic, maker of the Claude AI, which keeps it for a limited time. You see exactly what will be sent first, every time.",
  chatName: "Chat about your log",
  chatShort: "Questions about your own patterns, in Mind → Journey",
  chatAdds: "Each message sends your question, your last few chat messages and the same summary, the same way. You see exactly what will be sent first, every time. Your chat history stays on this device.",
  labsName: "Include lab values",
  labsHint: "Adds the latest fasting glucose, HbA1c and waist values you typed, rounded and without their dates.",
  offLine: "Both are off until you turn them on. Solia Health's server passes a request on and never keeps what you sent. It keeps two counts: how many you've used this month, and a daily total of how much AI processing everyone's requests used together, which isn't linked to you. Turning one off clears what it kept on this device.",
  locked: "Pro adds a weekly write-up and a chat about your own log, written by Solia Health's AI from a summary you see before it's sent. Both stay off until you turn them on.",
  // the preview sheet
  sheetTitle: "What Solia Health will send",
  sheetLead: "Exactly the text below goes through Solia Health's server to Anthropic, maker of the Claude AI, which keeps it for a limited time. Solia Health's server never keeps the text. It keeps two counts: how many you've sent this month, and a daily total of how much AI processing everyone's requests used together, which isn't linked to you. Nothing else from your log is sent.",
  sheetPlain: "In plain words",
  sheetExact: "Exactly as sent",
  sheetQuestion: "Your question",
  sheetHistory: "Your last chat messages",
  // shared
  notSetUp: "AI isn't set up on this server yet, so nothing was sent to Anthropic.",
  offline: "You're offline. This needs a connection; nothing was sent.",
  checking: "Checking that Solia Health's AI is available…",
  notAdvice: "Associations to raise with your clinician, not a diagnosis or medical advice.",
  byAI: "Written by Solia Health's AI (Claude, made by Anthropic) from your summary.",
  sentSummary: "Sent: your summary",
  sentChat: "Sent: your question + your summary",
  tooMany: "Too many requests in a minute. Nothing went to Anthropic; try again shortly.",
  // Monthly allowance (backend ai/usage.js): nothing is sent once the month's allowance is used.
  signin: "Sign in to use Solia Health's AI. Nothing was sent.",
  limitChat: (n, date) => `You've used this month's ${n} chat messages, so nothing was sent. They start again on ${monthDay(date)}.`,
  limitWeekly: (n, date) => `You've had this month's ${n} write-ups, so nothing was sent. They start again on ${monthDay(date)}.`,
  leftChat: (u) => `${Math.max(0, u.limit - u.used)} of ${u.limit} chat messages left this month.`,
  leftWeekly: (u) => `${Math.max(0, u.limit - u.used)} of ${u.limit} write-ups left this month.`,
  noAnswer: "No answer came back from Solia Health's AI, and it didn't count toward this month. Try again later.",
  refused: "Solia Health didn't send this: the summary had something it shouldn't. Please report this.",
  // write-up card
  wuTitle: "Solia Health's write-up",
  wuLead: "A short write-up of what stands out in your last 8 weeks, from a summary you see before it's sent.",
  wuGo: "Prepare a write-up",
  wuAgain: "Prepare a new one",
  // chat
  chatTitle: "Chat about your log",
  chatLead: "Ask about your own patterns. Each message shows you exactly what it sends first.",
  chatLabel: "Your message",
  chatGo: "Preview and send",
  chatClear: "Clear chat",
  chatEmpty: "No messages yet. Try \"What stands out in my last two cycles?\"",
  chatKept: "Kept on this device only.",
  urgentLocal: "What you're describing needs care now, not an app. Please call your local emergency number (911 in the US) or go to urgent care. If you are thinking about harming yourself, call or text 988 (US) or your local crisis line. Nothing was sent.",
});

/* Home's "Ask Solia" card (owner request 2026-11-19: "everything seems hidden ... AI chat etc."). It is a way in, never
   a new feature: "Ask" opens Mind → Journey's chat with her question typed into its box, "Ask with evidence" opens the
   evidence card the same way. Nothing is sent from Home; the cards' own "Preview and send" / "Review and send" and the
   "What Solia Health will send" sheet stay the only way anything goes. The card itself makes no request.
   State, in this order (each one true of the build and of her plan):
     soon   the build has no ai flag or no server, or this session already heard from the server that AI isn't set up;
     guest  she is in the "Try it first" window: Pro's AI needs an account;
     plans  her plan has neither the chat nor Ask with evidence;
     ask    the text box. chat: the chat can open (Pro and her switch); chatOff: Pro, switch off; evidence: Pro. */
export function askCard({ flag = false, server = false, serverAi = null, guest = false, canChat = false, chatOn = false, canEvidence = false } = {}) {
  if (!flag || !server || serverAi === "unset") return { state: "soon" };
  if (guest) return { state: "guest" };
  if (!canChat && !canEvidence) return { state: "plans" };
  return { state: "ask", chat: !!(canChat && chatOn), chatOff: !!(canChat && !chatOn), evidence: !!canEvidence };
}
export const ASK_COPY = Object.freeze({
  title: "Ask Solia",
  eyebrow: "Solia Health's AI",
  lead: "Nothing is sent from here. The next screen shows exactly what would go, and only your Send sends it.",
  label: "Your question",
  placeholder: "e.g. What stands out in my last two cycles?",
  ask: "Ask",
  askEvidence: "Ask with evidence",
  chatOff: "Chat about your log is off.",
  turnOn: "Turn on in You → Solia Health's AI",
  plans: "With Pro, ask about your own log or get answers that cite their sources. Nothing is sent until you've seen it and tapped Send.",
  guest: "Solia Health's AI is part of Pro and needs an account.",
  soonChip: "Coming soon",
  soon: "Solia Health's AI isn't connected in this build yet, so there is nothing to ask here for now.",
  hide: "Hide the Ask Solia card",
  hidden: "Ask Solia is hidden. You can bring it back from You.",
  shown: "Ask Solia is back on Home.",
  // the write-up on Home
  wuOpen: "Open in Patterns",
  // You: Home cards
  showName: "Ask Solia on Home",
  showHint: "The card near the top of Home. Hiding it changes nothing else.",
});
