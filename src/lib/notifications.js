/* Reminders — one at most, never a second nudge, never SMS.
   Phone build: local notifications scheduled ON THE DEVICE (Capacitor
   "LocalNotifications"); no server involved. Web build: Web Push — the backend
   keeps the browser's push subscription plus cadence, nudge time and timezone
   (no name, no health data) and sends a generic reminder at the chosen time. */
import { API_BASE, apiPost } from "./api.js";

export const NUDGE_TIME = { morning: [9, 0], midday: [12, 30], evening: [19, 0] };
const DAYS = { daily: [1, 2, 3, 4, 5, 6, 7], weekdays: [2, 3, 4, 5, 6], "3x": [2, 4, 6], weekly: [2], me: [] }; // Capacitor weekday: 1 = Sunday
const native = () => (typeof window !== "undefined" && window.Capacitor?.Plugins?.LocalNotifications) || null;
const webSupported = () => typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

export const wantsReminders = (cadence, nudge) => DAYS[cadence]?.length > 0 && nudge in NUDGE_TIME;

/** "native" | "web" | "none" — what this device can do. */
export function support() { return native() ? "native" : webSupported() ? "web" : "none"; }

/** Current permission state for the UI: "granted" | "denied" | "default" | "unsupported". */
export async function permission() {
  const ln = native();
  if (ln) { try { return (await ln.checkPermissions()).display; } catch { return "default"; } }
  if (webSupported()) return Notification.permission;
  return "unsupported";
}

/** Apply the user's cadence + nudge. Call from a user gesture the first time (permission prompt). */
export async function syncReminders({ cadence, nudge }) {
  const ln = native();
  if (ln) {
    const pending = await ln.getPending().catch(() => ({ notifications: [] }));
    if (pending.notifications?.length) await ln.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
    if (!wantsReminders(cadence, nudge)) return { active: false };
    const perm = await ln.requestPermissions();
    if (perm.display !== "granted") return { active: false, blocked: true };
    const [hour, minute] = NUDGE_TIME[nudge];
    await ln.schedule({ notifications: DAYS[cadence].map((weekday) => ({ id: 1000 + weekday, title: "Cyra", body: "Time for your 30-second check-in.", schedule: { on: { weekday, hour, minute }, allowWhileIdle: true } })) });
    return { active: true };
  }
  if (!webSupported()) return { active: false, unsupported: true };
  const reg = await navigator.serviceWorker.register("/sw.js");
  const existing = await reg.pushManager.getSubscription();
  if (!wantsReminders(cadence, nudge)) {
    if (existing) { await apiPost("/api/push/subscribe", { endpoint: existing.endpoint }, { method: "DELETE" }).catch(() => {}); await existing.unsubscribe().catch(() => {}); }
    return { active: false };
  }
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return { active: false, blocked: true };
  const r = await fetch(`${API_BASE}/api/push/vapid`);
  if (!r.ok) return { active: false, unavailable: true };
  const { publicKey } = await r.json();
  const sub = existing || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(publicKey) });
  const out = await apiPost("/api/push/subscribe", { subscription: sub.toJSON ? sub.toJSON() : sub, cadence, nudge, tz: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC" });
  return { active: !!out.active };
}

function toKey(b64u) { const pad = "=".repeat((4 - (b64u.length % 4)) % 4); const raw = atob((b64u + pad).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(raw, (c) => c.charCodeAt(0)); }
