/* "You're not alone": anonymous weekly counts. See backend/src/modules/pulse.

   Reading the counts (every launch, no opt-in needed): one GET /api/pulse with no
   query. The server answers with the last closed ISO week's counts for all three
   life stages, and this device picks its own stage locally, so the request carries
   nothing about the user's health — only what any web request carries (IP address,
   user agent). A count is null until at least k contributions are in.

   Sharing counts (only while "Share anonymous weekly counts" is on): saving a
   check-in records a few allowlisted yes/no event flags in a queue kept on this device
   (pulseQueue), one entry per local day: saving that day's check-in again REPLACES the
   day's flags, so the queue always matches the check-in as last saved. Quick check-ins
   (combined questions such as "cramps or bloating") add no symptom flags. Nothing is
   sent at check-in time. The queue is dated by its newest check-in, so it becomes due
   only on a later local day. A due queue goes out as ONE POST /api/pulse/tally
   { stage, events } — no token, no account, no dates or values.
   At most once a day from this browser (phone: this app install): App.jsx runs the send
   inside a Web Lock (every tab of this browser shares it), re-reads the stored record
   first, records the send day (pulseLastSend) and writes "sent" to storage BEFORE the
   request — and sends nothing if, by then, sharing was turned off or Delete everything
   started — so a reload or a second tab can't send it again. pulseSent remembers which
   stage|event pairs this record already sent in the current ISO week, and each send also
   writes a week-only hold outside the record (lib/storage.js), so a new record made on
   this device that week (after Delete everything or Start over) sends no counts again:
   each flag goes at most once a week from this browser or app install (removing the app
   or clearing this site's data resets that). An answer from the server that isn't a
   refusal (5xx, or no answer) counts as sent, so a flag is never sent twice for one week.
   A queue whose stage is no longer the record's stage is dropped, never sent. Turning
   sharing off clears the queue in every open tab. */
import { API_BASE, apiFetch, apiPost, needServer } from "./api.js";
import { localDay } from "./engine.js";

export const PULSE_EVENTS = {
  peri: [["hf", "logged hot flashes"], ["ns", "logged night sweats"], ["rough_night", "had a rough night's sleep"]],
  periods: [["crm", "logged cramps"], ["mood_dip", "logged mood swings before their period"], ["heavy_day", "logged a heavy day"]],
  preg: [["nau", "logged nausea"], ["kicks", "counted kicks"], ["swl", "logged swelling"]],
};

/* Exactly what a tally can say, in plain words — every disclosure is built from this. */
export const STAGE_GROUP = { periods: "cycle tracking or trying to conceive", peri: "perimenopause or menopause", preg: "pregnancy" };
export const FLAG_WORDS = { crm: "cramps", heavy_day: "a heavy-flow day", mood_dip: "mood swings in the days before a predicted period", hf: "hot flashes", ns: "night sweats", rough_night: "a poor night's sleep", nau: "nausea", swl: "swelling", kicks: "baby's kicks" };
const FLAG_ORDER = { periods: ["crm", "heavy_day", "mood_dip"], peri: ["hf", "ns", "rough_night"], preg: ["nau", "swl", "kicks"] };
const orList = (a) => (a.length < 2 ? a.join("") : `${a.slice(0, -1).join(", ")} or ${a[a.length - 1]}`);
/** "cramps, a heavy-flow day or mood swings …" for one stage. */
export const flagWords = (stage) => orList((FLAG_ORDER[stage] || []).map((id) => FLAG_WORDS[id]));
/** Every stage group with its flags, for the consent step (the stage isn't final yet). */
export const allFlagGroups = () => Object.keys(FLAG_ORDER).map((st) => `${STAGE_GROUP[st]}: ${flagWords(st).replace(/ or ([^,]*)$/, ", $1")}`).join("; ");

export function weekKey(d = new Date()) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y = t.getUTCFullYear();
  return `${y}-W${String(Math.ceil(((t - Date.UTC(y, 0, 1)) / 86400000 + 1) / 7)).padStart(2, "0")}`;
}
/** This device's local calendar day, YYYY-MM-DD (defined once, in engine.js). */
export { localDay };

/** Events worth counting from one saved cycle/peri/pregnancy day (sym severities, sleep, flow,
    phase and lateness of the predicted period). mood_dip: the "Mood swings" symptom on a day
    before the predicted period (luteal phase, period not yet late). */
export function eventsForDay(stage, { sym = {}, sleepQ, flow, phase, late } = {}) {
  const out = [];
  if (stage === "peri") { if ((sym.hf || 0) > 0) out.push("hf"); if ((sym.ns || 0) > 0) out.push("ns"); if (sleepQ === "poor") out.push("rough_night"); }
  if (stage === "periods") { if ((sym.crm || 0) > 0) out.push("crm"); if ((sym.mood || 0) > 0 && phase === "luteal" && !(late > 0)) out.push("mood_dip"); if (flow === "heavy" || flow === "flood") out.push("heavy_day"); }
  if (stage === "preg") { if ((sym.nau || 0) > 0) out.push("nau"); if ((sym.swl || 0) > 0) out.push("swl"); }
  return out;
}

/** The counts for all stages: { week, k, stages: { peri, periods, preg } }. No stage is sent. */
export async function fetchPulse() {
  needServer();
  const r = await apiFetch("/api/pulse", { cache: "no-store" });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const j = await r.json();
  if (!j || typeof j.stages !== "object" || !j.stages) throw new Error("bad pulse payload");
  return j;
}

/** This device's stage, picked locally from the all-stage answer. Unknown or missing counts read as null. */
export function pickStage(all, stage) {
  const got = Array.isArray(all?.stages?.[stage]) ? all.stages[stage] : [];
  return (PULSE_EVENTS[stage] || []).map(([id, what]) => {
    const n = got.find((x) => x && x.id === id)?.count;
    return { id, what, count: Number.isFinite(n) ? n : null };
  });
}

const sentThisWeek = (sent, week) => (sent && sent.week === week && Array.isArray(sent.keys) ? sent.keys : []);

/* A queue: { stage, day, byDay: { [localDay]: events[] }, events }. events is the union of
   byDay; day is the newest entry's day (or later, after a refused send was re-dated).
   A queue from an older version ({ stage, day, events }) reads as one entry for its day. */
const daysOf = (q) => (q && q.byDay && typeof q.byDay === "object" ? q.byDay : q && q.day && Array.isArray(q.events) ? { [q.day]: q.events } : {});
function build(stage, byDay, notBefore = null) {
  const keys = Object.keys(byDay).filter((k) => Array.isArray(byDay[k]) && byDay[k].length).sort();
  if (!keys.length) return null;
  const clean = Object.fromEntries(keys.map((k) => [k, [...new Set(byDay[k])]]));
  const newest = keys[keys.length - 1];
  return { stage, day: notBefore && notBefore > newest ? notBefore : newest, byDay: clean, events: [...new Set(keys.flatMap((k) => clean[k]))] };
}

/** Record one day's check-in in the on-device queue. Pure: returns the new queue (or null).
    The day's flags REPLACE whatever that day's earlier save queued (a flag she took back is
    never sent). The queue takes the day of its NEWEST check-in, so nothing from today's
    check-in goes out today. */
export function queueEvents(queue, sent, stage, events, now = new Date(), { day = null } = {}) {
  const already = sentThisWeek(sent, weekKey(now));
  const fresh = [...new Set(events)].filter((e) => !already.includes(`${stage}|${e}`));
  // One stage per queue: after a stage change, the old stage's unsent flags are dropped, never sent.
  const same = queue && queue.stage === stage;
  const days = same ? daysOf(queue) : {};
  // An edit of an earlier day can only take back flags still waiting for that day; it never
  // adds any (an added flag would be due at once, i.e. sent on the day she logged it).
  if (day && day !== localDay(now)) return same && days[day] ? build(stage, { ...days, [day]: fresh.filter((e) => days[day].includes(e)) }, queue.day) : queue;
  return build(stage, { ...days, [localDay(now)]: fresh }, same ? queue.day : null);
}

/** Bring a queue in line with what this device already sent (another tab may have sent some of it). */
export function pruneQueue(queue, sent, now = new Date()) {
  if (!queue || !queue.stage) return null;
  const already = sentThisWeek(sent, weekKey(now));
  const days = daysOf(queue);
  return build(queue.stage, Object.fromEntries(Object.entries(days).map(([d, evs]) => [d, (Array.isArray(evs) ? evs : []).filter((e) => !already.includes(`${queue.stage}|${e}`))])), queue.day);
}

/** Two tabs' queues for the same stage, merged day by day (a's entry wins for a day both have);
    a different stage never mixes in. */
export function mergeQueues(a, b) {
  if (!a) return b || null;
  if (!b || b.stage !== a.stage) return a;
  return build(a.stage, { ...daysOf(b), ...daysOf(a) }, a.day > b.day ? a.day : b.day);
}

/** Is the queue due on this launch? Only when it was filled on an earlier local day. */
export const queueDue = (queue, now = new Date()) => !!(queue && queue.day && queue.day < localDay(now) && Array.isArray(queue.events) && queue.events.length);

/** Send a due queue as ONE tally. Resolves { queue, sent } to store next.
    commit(result) is awaited BEFORE the request with the "sent" result (queue cleared, events
    recorded in pulseSent), so a reload or another tab during the request can't send it again.
    If commit() resolves false (sharing was turned off, or Delete everything started), nothing
    is sent at all.
    - server answered OK, with a 5xx, or not at all (it may or may not have been counted):
      stays "sent", so a flag is never counted twice in one week.
    - server refused it (4xx, e.g. 400 or 429: nothing counted): queue kept, retried no
      sooner than tomorrow; commit() is called again with that. */
export async function flushQueue(queue, sent, { now = new Date(), commit = async () => {} } = {}) {
  if (!API_BASE || !queueDue(queue, now)) return { queue, sent };
  const week = weekKey(now);
  const already = sentThisWeek(sent, week);
  const all = [...new Set(Object.values(daysOf(queue)).flat())];
  const events = all.filter((e) => !already.includes(`${queue.stage}|${e}`));
  if (!events.length) { const none = { queue: null, sent }; await commit(none); return none; }
  const done = { queue: null, sent: { week, keys: [...already, ...events.map((e) => `${queue.stage}|${e}`)] } };
  if ((await commit(done)) === false) return done; // sharing off or a delete under way: send nothing
  try {
    await apiPost("/api/pulse/tally", { stage: queue.stage, events });
    return done;
  } catch (e) {
    if (!e?.status || e.status >= 500) return done;
    const back = { queue: { ...queue, day: localDay(now) }, sent };
    await commit(back);
    return back;
  }
}
