/* Meal photos (Pro, her own switch, off by default; docs/plans/meal-photos.md). Pure: no React, storage or network.
   With the switch on, the Meals sheet offers "Add from a photo". What then happens, and what every sentence below says:
   - the photo she picks is redrawn on a canvas on this device, at most PHOTO_MAX_SIDE pixels on its long side, and
     saved again as a JPEG (components/ai/MealPhoto.jsx downsizePhoto). A redrawn picture carries no EXIF data, so the
     camera's hidden details (place, time, device) are not in what is sent;
   - "What Solia Health will send" shows that exact picture. The request body is photoBody(): { image: { media_type,
     data } } and nothing else: no log, no stage, no note. Her session token rides in the Authorization header, as for
     every Pro AI request, so the server can count it toward her month (60 photos; backend ai/usage.js);
   - nothing goes until she taps Send. Cancel drops the picture from memory;
   - Solia Health's server forwards it to Anthropic and keeps neither the photo nor the answer (backend ai/meal.js);
   - the answer (foods, a portion guess and a calorie RANGE each, how sure) is cleaned again here (cleanAnswer), shown
     for her to edit or discard, and only what she saves is kept: in that meal note, as `est` (cleanEst), on this device
     and in her backups like the rest of the note. Solia Health keeps no copy of the photo anywhere;
   - "Show calorie estimates" off (aiPrefs.hideCal) hides every calorie figure and portion guess; food names stay.
   Guardrails: no targets, goals, "over" or "under", scores, streaks, colours for good or bad, or advice. Patterns and the
   AI summary never read `est` (lib/patterns.js, lib/aiSummary.js use the fixed chips only).
   Listed in docs/PRIVACY-AUDIT.md "Meal photos" and docs/CLINICIAN-REVIEW.md. */
import { monthDay } from "./aiFeatures.js";

export const PHOTO_MAX_SIDE = 1024;
export const PHOTO_QUALITY = 0.8;
export const PHOTO_MAX_BYTES = 1_048_576; // the server's cap on the decoded image (backend ai/meal.js MEAL_MAX_BYTES)
export const EST_MAX_ITEMS = 8;
export const KCAL_MAX = 3000; // per item, as on the server
export const SURE_IDS = Object.freeze(["low", "medium", "high"]);

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/** The size to draw a w × h picture at so its long side is at most `max` (never enlarged, never below 1 pixel). */
export function fitWithin(w, h, max = PHOTO_MAX_SIDE) {
  const W = Number(w), H = Number(h);
  if (!(W > 0) || !(H > 0) || !Number.isFinite(W) || !Number.isFinite(H)) return null;
  const k = Math.min(1, max / Math.max(W, H));
  return { w: Math.max(1, Math.round(W * k)), h: Math.max(1, Math.round(H * k)) };
}

/** How many bytes a base64 string decodes to. */
export const base64Bytes = (b64) => { const s = String(b64 || ""); return Math.max(0, Math.floor((s.length * 3) / 4) - (s.endsWith("==") ? 2 : s.endsWith("=") ? 1 : 0)); };

/** The request body for a canvas data URL, exactly as shown and sent: { image: { media_type: "image/jpeg", data } }.
    null unless it is a base64 JPEG no larger than the server takes. */
export function photoBody(dataUrl) {
  const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/.exec(String(dataUrl || ""));
  if (!m || base64Bytes(m[1]) > PHOTO_MAX_BYTES) return null;
  return { image: { media_type: "image/jpeg", data: m[1] } };
}
/** The data URL the preview shows for a body: built from the very bytes that are posted. */
export const bodyDataUrl = (body) => `data:${body.image.media_type};base64,${body.image.data}`;

/** Plain words only: letters, digits, spaces and a little punctuation. Markup, control characters and emoji are dropped. */
export const plainWords = (v, max) => (typeof v === "string" ? v.normalize("NFKC").replace(/[^\p{L}\p{N} ,.'()&/%+-]/gu, " ").replace(/\s+/g, " ").trim().slice(0, max).trim() : "");
const kcal = (v) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v) : NaN);
function cleanItem(it) {
  if (!isObj(it)) return null;
  const name = plainWords(it.name, 60), portion = plainWords(it.portion, 40);
  let low = kcal(it.low), high = kcal(it.high);
  if (!name || Number.isNaN(low) || Number.isNaN(high)) return null;
  if (low > high) [low, high] = [high, low];
  if (low < 0 || high > KCAL_MAX) return null;
  return { name, portion, low, high };
}
const cleanItems = (list) => { const out = []; for (const it of Array.isArray(list) ? list : []) { const c = cleanItem(it); if (c) out.push(c); if (out.length >= EST_MAX_ITEMS) break; } return out; };
/** The low–high sum of a list of items. */
export const totalOf = (items) => ({ low: (items || []).reduce((n, x) => n + x.low, 0), high: (items || []).reduce((n, x) => n + x.high, 0) });

/** The server's answer → { food: true, items, sure } | { food: false }. Unknown fields are dropped, ranges made sane
    (whole numbers, 0 to KCAL_MAX, low ≤ high), names and portions reduced to plain words. */
export function cleanAnswer(d) {
  if (!isObj(d) || d.food !== true) return { food: false };
  const items = cleanItems(d.items);
  if (!items.length) return { food: false };
  return { food: true, items, sure: SURE_IDS.includes(d.sure) ? d.sure : "low" };
}

/** What a meal note keeps of an estimate: { items: [{ name, portion, low, high }], sure } or null when nothing is left. */
export function cleanEst(v) {
  if (!isObj(v)) return null;
  const items = cleanItems(v.items);
  return items.length ? { items, sure: SURE_IDS.includes(v.sure) ? v.sure : "low" } : null;
}

/** "300–450 kcal". */
export const kcalRange = (r) => (r.low === r.high ? `${r.low} kcal` : `${r.low}–${r.high} kcal`);
/** The same for a screen reader: "300 to 450 kilocalories". */
export const kcalRangeSaid = (r) => (r.low === r.high ? `${r.low} kilocalories` : `${r.low} to ${r.high} kilocalories`);
/** One food in words: "White rice · a small bowl · 180–260 kcal", or only the name while calories are hidden. */
export const itemWords = (it, showCal = true) => [it.name, showCal ? it.portion : "", showCal ? kcalRange(it) : ""].filter(Boolean).join(" · ");
/** The day's total across the meal notes that hold an estimate: { low, high, meals } or null when none does. */
export function dayTotal(meals) {
  const withEst = (Array.isArray(meals) ? meals : []).filter((m) => m && m.est && Array.isArray(m.est.items) && m.est.items.length);
  if (!withEst.length) return null;
  const all = withEst.flatMap((m) => m.est.items);
  return { ...totalOf(all), meals: withEst.length };
}

/** Whether Meal photos can be offered: the ai flag, a server, the plan (plan.js aiMealPhotos) and Meal notes in her stage. */
export const mealPhotoOffer = ({ flag = false, server = false, pro = false, mealsOffered = false } = {}) => !!flag && !!server && !!pro && !!mealsOffered;

export const MEAL_COPY = Object.freeze({
  // You → Solia Health's AI
  name: "Meal photos",
  short: "Photograph a meal in Meal notes; the AI names the foods and gives a rough calorie range",
  adds: "When you choose a photo in Meal notes, Solia Health makes it smaller on this device, shows you the exact picture, and sends it only when you tap Send. It goes through Solia Health's server to Anthropic, maker of the Claude AI, which keeps it for a limited time. Nothing from your log goes with it. Solia Health's server never keeps the photo or the answer. Turning this off stops photos; estimates you already saved stay in your meal notes until you remove them.",
  needsNotes: "Meal notes is off. Turn it on in You → Your profile to use this.",
  showCal: "Show calorie estimates",
  showCalHint: "Turn this off to hide every calorie figure and portion guess. The food names stay.",
  onSaid: "Meal photos on. Nothing is sent until you tap Send.",
  offSaid: "Meal photos off. Nothing more will be sent.",
  calOnSaid: "Calorie estimates are shown",
  calOffSaid: "Calorie estimates are hidden",
  // the Meals sheet
  add: "Add from a photo",
  replace: "Replace with a new photo",
  addHint: "Photograph only the food. You'll see exactly what will be sent before anything goes.",
  preparing: "Making the photo smaller on this device…",
  badPhoto: "That file couldn't be read as a photo. Nothing was sent.",
  // "What Solia Health will send"
  sheetLead: "Exactly the photo below goes through Solia Health's server to Anthropic, maker of the Claude AI, which keeps it for a limited time. Solia Health's server never keeps the photo or the answer. It keeps two counts: how many photos you've sent this month, and a daily total of how much AI processing everyone's requests used together, which isn't linked to you.",
  photoLab: "The photo, exactly as sent",
  photoAlt: "The photo that will be sent",
  photoFacts: (w, h, bytes) => `Made smaller on this device: ${w} × ${h} pixels, about ${Math.max(1, Math.round(bytes / 1024))} kB. It was saved again as a new JPEG, which leaves out the camera's hidden details, such as where and when it was taken.`,
  withLab: "What goes with it",
  withNothing: "Nothing from your log: no stage, no notes, no meal details.",
  withSignin: "Your sign-in goes with the request, so Solia Health's server can count it toward this month.",
  onlyFood: "Photograph only the food. Everything in the picture is sent, so leave out faces, papers and screens.",
  send: "Send",
  sending: "Sending…",
  cancel: "Cancel",
  cancelSaid: "Photo discarded. Nothing was sent.",
  reading: "Reading your photo…",
  // the answer
  answerTitle: "What the photo shows",
  answerLead: "Change a name or remove anything that's wrong, then save. Nothing is saved until you do.",
  calNote: "A rough estimate from a photo. It can be well off.",
  sureLab: "How sure the AI is",
  sure: Object.freeze({ low: "Not very sure", medium: "Fairly sure", high: "Quite sure" }),
  foodName: (n) => `Food ${n}`,
  removeFood: (name) => `Remove ${name}`,
  total: "Total",
  save: "Save to this meal note",
  discard: "Discard",
  closeAnswer: "Close and discard this answer",
  discardSaid: "Discarded. Nothing was saved.",
  savedSaid: "Saved to this meal note",
  allRemoved: "Nothing is left to save.",
  notFood: "That didn't look like food, or it was too unclear to read, so nothing was added. It still counted toward this month.",
  notKept: "Solia Health doesn't keep the photo, on this device or on its server. If you took it with your camera or picked it from your library, that copy is yours to keep or delete.",
  // a saved estimate
  savedTag: "Estimated from a photo",
  removeEst: "Remove this estimate",
  removedSaid: "Estimate removed",
  dayTotal: (range, meals) => `Day total from ${meals === 1 ? "1 photo" : `${meals} photos`}: ${range}`,
  preg: "Energy needs change in pregnancy. Ask your clinician what's right for you.",
  byAI: "Named and estimated by Solia Health's AI (Claude, made by Anthropic) from your photo. Guidance, not a diagnosis or advice.",
  // when nothing comes back
  offline: "You're offline, so nothing was sent. Try again when you're connected.",
  dropped: "The connection dropped before an answer came back, so nothing was saved. Try again in a moment.",
  notSetUp: "Solia Health's AI isn't set up on this server yet, so nothing was sent to Anthropic.",
  tooMany: "That was more photos than a minute allows. Nothing went to Anthropic; try again shortly.",
  signin: "Sign in to use meal photos. Nothing was sent to Anthropic.",
  tooBig: "That photo was too large for Solia Health's server, so it wasn't read. Nothing went to Anthropic.",
  notImage: "Solia Health's server couldn't read that as a photo. Nothing went to Anthropic.",
  noAnswer: "No answer came back, and it didn't count toward this month. Try again in a moment.",
  limit: (n, date) => `You've used this month's ${n} meal photos, so this one wasn't read and nothing went to Anthropic. They start again on ${monthDay(date)}.`,
  left: (u) => `${Math.max(0, u.limit - u.used)} of ${u.limit} meal photos left this month.`,
});

/** The line for a failed send (aiClient why()). */
export function failLine(r) {
  const C = MEAL_COPY;
  switch (r && r.why) {
    case "unset": return C.notSetUp;
    case "busy": return C.tooMany;
    case "signin": return C.signin;
    case "limit": return C.limit(r.limit, r.resetsOn);
    case "offline": return C.dropped;
    case "toobig": return C.tooBig;
    case "notimage": return C.notImage;
    default: return C.noAnswer;
  }
}
