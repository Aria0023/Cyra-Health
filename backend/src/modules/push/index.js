// Reminders for the web build: real Web Push, scheduled here, honoring the
// user's cadence, nudge time and "never". What this module stores: the browser's
// push subscription (endpoint + keys), cadence, nudge, timezone, and the last
// day a reminder was sent. Never a name, never health data. The reminder text
// is generic. At most one reminder per day. No SMS exists anywhere in Cyra.
//
//   GET    /api/push/vapid                → { publicKey } (unconfigured → 503)
//   POST   /api/push/subscribe {subscription, cadence, nudge, tz} → { ok }
//   DELETE /api/push/subscribe {endpoint} → { ok }
// Phones don't use this: the native build schedules local notifications on-device.
import crypto from "crypto";
import webpush from "web-push";

export const basePath = "/api/push";
export const CADENCES = ["daily", "weekdays", "3x", "weekly", "me"];
export const NUDGES = { morning: [9, 0], midday: [12, 30], evening: [19, 0], never: null };
const DAYS = { daily: [0, 1, 2, 3, 4, 5, 6], weekdays: [1, 2, 3, 4, 5], "3x": [1, 3, 5], weekly: [1], me: [] };

/** Local wall-clock parts for `now` in `tz` (falls back to UTC on a bad zone). */
export function localParts(now, tz) {
  let f;
  try { f = new Intl.DateTimeFormat("en-US", { timeZone: tz || "UTC", weekday: "short", hour: "numeric", minute: "numeric", hour12: false, year: "numeric", month: "2-digit", day: "2-digit" }); }
  catch { f = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short", hour: "numeric", minute: "numeric", hour12: false, year: "numeric", month: "2-digit", day: "2-digit" }); }
  const p = Object.fromEntries(f.formatToParts(now).map((x) => [x.type, x.value]));
  const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday);
  return { dow, hour: Number(p.hour) % 24, minute: Number(p.minute), day: `${p.year}-${p.month}-${p.day}` };
}
/** Should a reminder go out now for this subscription? Pure. */
export function due(sub, now) {
  const at = NUDGES[sub.nudge]; const days = DAYS[sub.cadence] || [];
  if (!at || !days.length) return false;
  const lp = localParts(now, sub.tz);
  if (!days.includes(lp.dow) || lp.day === sub.lastSentDay) return false;
  const mins = lp.hour * 60 + lp.minute, want = at[0] * 60 + at[1];
  return mins >= want && mins < want + 30; // a 30-minute window, once per day
}

export function mount(router, ctx, { intervalMs = 60_000, agent } = {}) {
  const { store } = ctx;
  const pub = (process.env.VAPID_PUBLIC_KEY || "").trim(), priv = (process.env.VAPID_PRIVATE_KEY || "").trim(), subject = (process.env.VAPID_SUBJECT || "mailto:hello@example.com").trim();
  const on = !!(pub && priv);
  if (on) webpush.setVapidDetails(subject, pub, priv);
  console.log(`[cyra] push: ${on ? "web push enabled" : "disabled (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY not set)"}`);
  const idOf = (endpoint) => crypto.createHash("sha256").update(endpoint).digest("base64url");

  router.get("/vapid", (req, res) => (on ? res.json({ publicKey: pub }) : res.status(503).json({ error: "push is not configured on this server" })));
  router.post("/subscribe", async (req, res) => {
    if (!on) return res.status(503).json({ error: "push is not configured on this server" });
    const { subscription, cadence, nudge, tz } = req.body || {};
    if (!subscription?.endpoint || !/^https:\/\//.test(subscription.endpoint) || !subscription.keys?.p256dh || !subscription.keys?.auth) return res.status(400).json({ error: "a browser push subscription is required" });
    if (!CADENCES.includes(cadence) || !(nudge in NUDGES)) return res.status(400).json({ error: "cadence or nudge invalid" });
    const id = idOf(subscription.endpoint);
    const row = { id, endpoint: subscription.endpoint, keys: { p256dh: String(subscription.keys.p256dh), auth: String(subscription.keys.auth) }, cadence, nudge, tz: typeof tz === "string" ? tz.slice(0, 64) : "UTC", lastSentDay: null, updatedAt: new Date().toISOString() };
    if (await store.findOne("push", (r) => r.id === id)) await store.update("push", (r) => r.id === id, row); else await store.insert("push", row);
    res.json({ ok: true, active: !!(NUDGES[nudge] && DAYS[cadence].length) });
  });
  router.delete("/subscribe", async (req, res) => {
    const endpoint = String(req.body?.endpoint || "");
    const n = await store.update("push", (r) => r.endpoint === endpoint, { cadence: "me", nudge: "never", keys: null, endpoint: `removed:${idOf(endpoint)}` });
    res.json({ ok: true, removed: n });
  });

  /** One scheduler pass. Exported on ctx for tests; runs every minute in production. */
  const tick = async (now = new Date()) => {
    if (!on) return { sent: 0, removed: 0 };
    let sent = 0, removed = 0;
    const subs = await store.find("push", (r) => r.keys && due(r, now));
    for (const s of subs) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, JSON.stringify({ title: "Cyra", body: "Time for your 30-second check-in.", tag: "cyra-checkin" }), { TTL: 60 * 60, urgency: "normal", ...(agent ? { agent } : {}) });
        await store.update("push", (r) => r.id === s.id, { lastSentDay: localParts(now, s.tz).day });
        sent++;
      } catch (e) {
        if (e.statusCode === 404 || e.statusCode === 410) { await store.update("push", (r) => r.id === s.id, { keys: null, endpoint: `gone:${s.id}` }); removed++; }
        else console.warn(`[cyra] push send failed (${e.statusCode || e.message})`);
      }
    }
    return { sent, removed };
  };
  ctx.pushTick = tick;
  if (on && intervalMs > 0) setInterval(() => tick().catch((e) => console.warn(`[cyra] push tick: ${e.message}`)), intervalMs).unref();
}
