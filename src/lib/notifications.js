/* Reminders — one at most, never a second nudge, never SMS. Off until the person
   turns them on.
   Phone build: local notifications scheduled ON THE DEVICE (Capacitor
   "LocalNotifications"); no server involved. Web build: Web Push — the backend
   keeps the browser's push subscription (its address and encryption keys) plus the
   reminder days, nudge time and time zone (no name, no health data) and sends a
   generic reminder at the chosen time.
   Off / "When I feel like it" / "Never remind me": on the phone every pending
   notification is cancelled. On the web the browser's push subscription is cancelled
   FIRST (App.jsx also saves the off switch on the device before any request), then the
   server is asked to delete its row. An address the server doesn't confirm (offline,
   server down, an error answer) is returned as `pending`: App.jsx keeps it on this device
   and sends the DELETE again at launch, when the browser comes back online or Cyra comes
   back on screen, and on a timer while Cyra is open, until the server confirms.
   Delete everything works differently (see wipe() in App.jsx): it asks the server first,
   and if that isn't confirmed nothing is deleted. "Delete on this device anyway" cancels
   the browser subscription but erases the record, so the server keeps the row until the
   push service reports the address gone (DataControls says so).
   Calls run one at a time, in order (a newer call never races an older one), and an "off"
   makes any subscribe still waiting in line give up before it registers anything. */
import { API_BASE, apiFetch, apiPost } from "./api.js";
import { isNative, LocalNotifications } from "./native.js";

export const NUDGE_TIME = { morning: [9, 0], midday: [12, 30], evening: [19, 0] };
const DAYS = { daily: [1, 2, 3, 4, 5, 6, 7], weekdays: [2, 3, 4, 5, 6], "3x": [2, 4, 6], weekly: [2], me: [] }; // Capacitor weekday: 1 = Sunday
const REMINDER_IDS = [1000, 1001, 1002, 1003, 1004, 1005, 1006, 1007]; // 1000 + weekday; 1000 never used, cancelled anyway
const native = () => (isNative() ? LocalNotifications : null);
const webSupported = () => typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

export const wantsReminders = (cadence, nudge) => DAYS[cadence]?.length > 0 && nudge in NUDGE_TIME;

/** "native" | "web" | "none" — what this device can do. */
export function support() { return native() ? "native" : webSupported() ? "web" : "none"; }

/** Current permission state, without asking: "granted" | "denied" | "default" | "prompt" | "unsupported". */
export async function permission() {
  const ln = native();
  if (ln) { try { return (await ln.checkPermissions()).display; } catch { return "default"; } }
  if (webSupported()) return Notification.permission;
  return "unsupported";
}

/* What the server last accepted from this page: { endpoint, cadence, nudge, tz }. When
   nothing changed, re-applying reminders sends nothing (in-memory, like a React ref). */
let lastSynced = null;
const tzNow = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

const okEndpoint = (e) => typeof e === "string" && /^https:\/\//.test(e) && e.length <= 2048;
/** Ask Cyra's server to forget these push addresses. Resolves { left, refused }: the ones it
    couldn't confirm, and whether any of those got an answer from the server (an error status)
    rather than no answer at all. */
export async function forgetOnServerWhy(endpoints, { timeoutMs = 15000 } = {}) {
  if (!API_BASE) return { left: [], refused: false };
  const left = []; let refused = false;
  for (const endpoint of [...new Set(endpoints)].filter(okEndpoint)) {
    try { await apiPost("/api/push/subscribe", { endpoint }, { method: "DELETE", timeoutMs }); } catch (e) { left.push(endpoint); if (e?.status) refused = true; }
  }
  return { left, refused };
}
/** Ask Cyra's server to forget these push addresses. Resolves the ones it couldn't confirm. */
export async function forgetOnServer(endpoints, opts) { return (await forgetOnServerWhy(endpoints, opts)).left; }

/** Every push address this browser holds for Cyra right now. */
async function liveSubscriptions() {
  if (!webSupported()) return [];
  const regs = await navigator.serviceWorker.getRegistrations().catch(() => []);
  const subs = [];
  for (const reg of regs) { const sub = await reg.pushManager.getSubscription().catch(() => null); if (sub) subs.push(sub); }
  return subs;
}
/** The addresses a Delete everything must have the server forget (no browser change). */
export async function knownEndpoints(known = []) { return [...new Set([...(await liveSubscriptions()).map((s) => s.endpoint), ...known])].filter(okEndpoint); }
/** Cancel this browser's push subscriptions right away (no server call). Resolves their addresses. */
export async function unsubscribeBrowser() {
  lastSynced = null;
  const subs = await liveSubscriptions();
  for (const sub of subs) await sub.unsubscribe().catch(() => {});
  return subs.map((s) => s.endpoint).filter(okEndpoint);
}

/** Cancel every reminder this app set up. Never registers anything new.
    known: push addresses this device used before (kept by App.jsx), deleted on the server too.
    server:false skips the server (Delete everything already did that step). */
async function cancelAll({ timeoutMs = 15000, known = [], server = true } = {}) {
  const ln = native();
  if (ln) {
    const pending = await ln.getPending().catch(() => ({ notifications: [] }));
    const ids = new Set([...REMINDER_IDS, ...(pending.notifications || []).map((n) => n.id)]);
    await ln.cancel({ notifications: [...ids].map((id) => ({ id })) });
    return { active: false, pending: [] };
  }
  // The browser side goes first, whatever the server will say: no reminder can be shown after this.
  const live = await unsubscribeBrowser();
  const left = server ? await forgetOnServer([...live, ...known], { timeoutMs }) : [];
  return { active: false, pending: left };
}

/** Apply the user's cadence + nudge.
    Returns { active, endpoint?, pending } | { active:false, blocked:true, denied } | { unavailable:true } (server has no push: 503,
    or this build has no server) | { error:true } (any other server answer) | { unsupported:true }.
    pending: push addresses the server couldn't be told to forget yet (web only).
    Throws only when the server can't be reached at all, or on the phone when scheduling fails.
    prompt:false never shows a permission prompt (used at launch): without permission it reports blocked. */
let chain = Promise.resolve();
let offs = 0; // bumped by every "off": a subscribe queued before it gives up
export function syncReminders(settings, opts = {}) {
  const off = !wantsReminders(settings.cadence, settings.nudge);
  if (off) offs++;
  const mine = offs;
  const run = chain.then(() => (!off && mine !== offs ? { active: false, superseded: true } : syncNow(settings, opts)));
  chain = run.catch(() => {});
  return run;
}
async function syncNow({ cadence, nudge }, { prompt = true, timeoutMs, known = [], server = true } = {}) {
  if (!wantsReminders(cadence, nudge)) return cancelAll({ timeoutMs, known, server });
  const ln = native();
  if (ln) {
    await cancelAll(); // the old schedule goes first, whatever happens next
    const perm = prompt ? await ln.requestPermissions() : await ln.checkPermissions();
    if (perm.display !== "granted") return { active: false, blocked: true, denied: perm.display === "denied" };
    const [hour, minute] = NUDGE_TIME[nudge];
    // Inexact on purpose: a gentle check-in may land a few minutes late, whereas exact (the plugin's default) makes Android 12+ open the "Alarms & reminders" settings screen.
    // allowWhileIdle (Android only; iOS ignores both options) lets each weekday's first alarm fire during Doze. The plugin re-arms later weeks
    // without it, so those can be held back in Doze until the app next opens and runs this again (App.jsx re-applies reminders after loading).
    await ln.schedule({ notifications: DAYS[cadence].map((weekday) => ({ id: 1000 + weekday, title: "Cyra", body: "Time for your 30-second check-in.", schedule: { on: { weekday, hour, minute }, allowWhileIdle: true }, isExactNotification: false })) });
    return { active: true };
  }
  if (!webSupported()) return { active: false, unsupported: true };
  if (!API_BASE) return { active: false, unavailable: true };
  const perm = prompt ? await Notification.requestPermission() : Notification.permission;
  if (perm !== "granted") return { active: false, blocked: true, denied: perm === "denied" };
  const reg = await navigator.serviceWorker.register("/sw.js");
  const existing = await reg.pushManager.getSubscription();
  const tz = tzNow();
  if (existing && lastSynced && lastSynced.endpoint === existing.endpoint && lastSynced.cadence === cadence && lastSynced.nudge === nudge && lastSynced.tz === tz) return { active: true, endpoint: existing.endpoint, pending: await forgetOnServer(known.filter((e) => e !== existing.endpoint), { timeoutMs }) };
  const r = await apiFetch("/api/push/vapid");
  if (r.status === 503) return { active: false, unavailable: true };
  if (!r.ok) return { active: false, error: true };
  const { publicKey } = await r.json();
  const sub = existing || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(publicKey) });
  let out;
  try { out = await apiPost("/api/push/subscribe", { subscription: sub.toJSON ? sub.toJSON() : sub, cadence, nudge, tz }); }
  catch (e) { if (e?.status === 503) return { active: false, unavailable: true }; if (e?.status) return { active: false, error: true }; throw e; }
  lastSynced = { endpoint: sub.endpoint, cadence, nudge, tz };
  // An older address of this device (a browser that replaced its subscription) is forgotten too.
  const pending = await forgetOnServer(known.filter((e) => e !== sub.endpoint), { timeoutMs });
  return { active: !!out.active, endpoint: sub.endpoint, pending };
}

function toKey(b64u) { const pad = "=".repeat((4 - (b64u.length % 4)) % 4); const raw = atob((b64u + pad).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(raw, (c) => c.charCodeAt(0)); }
