// Reminders for the web build: real Web Push, scheduled here, honoring the
// user's cadence, nudge time and "never". What this module stores, one row per
// browser while reminders are on: the browser's push subscription (endpoint + keys,
// with a hash of the endpoint as the row id), cadence, nudge, IANA time zone, and the
// last day a reminder was sent. Never a name, never health data. The reminder text is
// generic. Turning reminders off (DELETE, or a subscribe whose cadence/nudge sends
// nothing) deletes the row when the DELETE arrives. The app cancels the browser's
// subscription and saves the off switch (with the address still to forget) on the
// device BEFORE it sends the DELETE; if the DELETE can't arrive (offline, server down,
// an error answer), the app keeps sending it at launch, whenever it is back online or
// back on screen, and on a timer while it is open, until it lands. Meanwhile a send to
// that cancelled address gets a 404/410 from the push service, which deletes the row
// too; after a forced "Delete on this device anyway" that is the only path.
// At most one reminder per local day: re-subscribing or changing the time keeps the
// day's lastSentDay, scheduler passes never overlap, and a row first created inside its
// own send window (e.g. re-created after a restart lost the store) skips that day.
// No SMS exists anywhere in Cyra.
// Abuse limits: POST /subscribe is rate-limited in memory (20 a minute per client
// address, 600 a minute overall; the address is held only as a daily-salted hash for
// about a minute, see core/memory.js), accepts only endpoints on the browser push
// services' hosts (Google FCM, Mozilla, Apple, Microsoft WNS; config push.hosts
// overrides) with bounded key and endpoint lengths, and refuses new rows once the store
// holds push.maxRows (default 20000). Each send has a socket timeout and a hard
// deadline, and a pass sends to at most 8 addresses at a time, so no push service that
// stalls can hold up the scheduler.
//
//   GET    /api/push/vapid                → { publicKey } (unconfigured → 503)
//   POST   /api/push/subscribe {subscription, cadence, nudge, tz} → { ok, active }
//   DELETE /api/push/subscribe {endpoint} → { ok, removed }
// Phones don't use this: the native build schedules local notifications on-device.
import crypto from "crypto";
import webpush from "web-push";
import { rateLimiter } from "../../core/memory.js";

export const basePath = "/api/push";
export const CADENCES = ["daily", "weekdays", "3x", "weekly", "me"];
export const NUDGES = { morning: [9, 0], midday: [12, 30], evening: [19, 0], never: null };
const DAYS = { daily: [0, 1, 2, 3, 4, 5, 6], weekdays: [1, 2, 3, 4, 5], "3x": [1, 3, 5], weekly: [1], me: [] };
// Hosts of the push services browsers hand out subscriptions for (a host matches itself or any subdomain).
export const PUSH_HOSTS = ["fcm.googleapis.com", "android.googleapis.com", "push.services.mozilla.com", "push.apple.com", "notify.windows.com"];
const B64URL = /^[A-Za-z0-9_-]+={0,2}$/;
/** Is this a browser push-service endpoint we will POST to? https only, on an allowed host, at most 2048 chars. */
export function endpointAllowed(endpoint, hosts = PUSH_HOSTS) {
  if (typeof endpoint !== "string" || endpoint.length > 2048) return false;
  let u; try { u = new URL(endpoint); } catch { return false; }
  if (u.protocol !== "https:" || u.username || u.password) return false;
  const h = u.hostname.toLowerCase();
  return hosts.some((x) => h === x || h.endsWith(`.${x}`));
}

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

export function mount(router, ctx, { intervalMs = 60_000, agent, clock = () => new Date(), sendTimeoutMs = 10_000, sendDeadlineMs = 15_000, concurrency = 8 } = {}) {
  const { store, config = {} } = ctx;
  const pc = config.push || {};
  const hosts = Array.isArray(pc.hosts) && pc.hosts.length ? pc.hosts.map((h) => String(h).toLowerCase()) : PUSH_HOSTS;
  const maxRows = Number(pc.maxRows) > 0 ? Number(pc.maxRows) : 20_000;
  const allow = rateLimiter({ perMinute: pc.perMinute || 20, globalPerMinute: pc.globalPerMinute || 600 });
  const pub = (process.env.VAPID_PUBLIC_KEY || "").trim(), priv = (process.env.VAPID_PRIVATE_KEY || "").trim(), subject = (process.env.VAPID_SUBJECT || "mailto:hello@example.com").trim();
  const on = !!(pub && priv);
  if (on) webpush.setVapidDetails(subject, pub, priv);
  console.log(`[cyra] push: ${on ? "web push enabled" : "disabled (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY not set)"}`);
  const idOf = (endpoint) => crypto.createHash("sha256").update(endpoint).digest("base64url");

  router.get("/vapid", (req, res) => (on ? res.json({ publicKey: pub }) : res.status(503).json({ error: "push is not configured on this server" })));
  router.post("/subscribe", async (req, res) => {
    if (!on) return res.status(503).json({ error: "push is not configured on this server" });
    if (!allow(req.ip)) return res.status(429).json({ error: "too many requests — try again in a minute" });
    const { subscription, cadence, nudge, tz } = req.body || {};
    const k = subscription?.keys || {};
    if (!endpointAllowed(subscription?.endpoint, hosts) || typeof k.p256dh !== "string" || k.p256dh.length > 128 || !B64URL.test(k.p256dh) || typeof k.auth !== "string" || k.auth.length > 64 || !B64URL.test(k.auth)) return res.status(400).json({ error: "a browser push subscription is required" });
    if (!CADENCES.includes(cadence) || !(nudge in NUDGES)) return res.status(400).json({ error: "cadence or nudge invalid" });
    const id = idOf(subscription.endpoint);
    const active = !!(NUDGES[nudge] && DAYS[cadence].length);
    if (!active) { await store.remove("push", (r) => r.id === id); return res.json({ ok: true, active: false }); } // nothing to send → nothing kept
    const prev = await store.findOne("push", (r) => r.id === id);
    if (!prev && (await store.find("push")).length >= maxRows) return res.status(507).json({ error: "reminders are full on this server — try again later" });
    // lastSentDay survives a re-subscribe or a new time: a day that already had its reminder never gets a second one.
    const row = { id, endpoint: subscription.endpoint, keys: { p256dh: String(subscription.keys.p256dh), auth: String(subscription.keys.auth) }, cadence, nudge, tz: typeof tz === "string" ? tz.slice(0, 64) : "UTC", lastSentDay: prev?.lastSentDay ?? null };
    // A new row inside today's send window may be one a restart lost after today's reminder went: skip today.
    if (!prev) { const now = clock(); if (due(row, now)) row.lastSentDay = localParts(now, row.tz).day; }
    if (prev) await store.update("push", (r) => r.id === id, row); else await store.insert("push", row);
    res.json({ ok: true, active: true });
  });
  router.delete("/subscribe", async (req, res) => {
    const endpoint = String(req.body?.endpoint || "");
    const id = idOf(endpoint);
    const n = endpoint ? await store.remove("push", (r) => r.id === id) : 0;
    res.json({ ok: true, removed: n });
  });

  /** One scheduler pass. Exported on ctx for tests; runs every minute in production. */
  let running = false; // passes never overlap, so a slow pass can't let the next one send the same reminder again
  const DEADLINE = Symbol("deadline");
  const send = (s) => {
    let timer;
    const deadline = new Promise((resolve) => { timer = setTimeout(() => resolve(DEADLINE), sendDeadlineMs); timer.unref?.(); });
    const req = webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, JSON.stringify({ title: "Cyra", body: "Time for your 30-second check-in.", tag: "cyra-checkin" }), { TTL: 60 * 60, urgency: "normal", timeout: sendTimeoutMs, ...(agent ? { agent } : {}) });
    return Promise.race([req, deadline]).finally(() => clearTimeout(timer));
  };
  const tick = async (now = new Date()) => {
    if (!on) return { sent: 0, removed: 0 };
    if (running) return { sent: 0, removed: 0, skipped: true };
    running = true;
    let sent = 0;
    const sentDay = new Map(), gone = new Set();
    try {
      const subs = await store.find("push", (r) => r.keys && due(r, now));
      let next = 0;
      const worker = async () => {
        while (next < subs.length) {
          const s = subs[next++];
          try {
            const out = await send(s);
            // Past the deadline the request may still land, so the day counts as sent: at most one reminder a day.
            if (out === DEADLINE) console.warn("[cyra] push send failed (deadline)");
            else sent++;
            sentDay.set(s.id, localParts(now, s.tz).day);
          } catch (e) {
            if (e.statusCode === 404 || e.statusCode === 410) gone.add(s.id); // the browser dropped it: delete the row
            else console.warn(`[cyra] push send failed (${e.statusCode || "network error"})`);
          }
        }
      };
      await Promise.all(Array.from({ length: Math.min(concurrency, subs.length) }, worker));
      // One write for the whole pass (not one full-file rewrite per row).
      const removed = sentDay.size || gone.size ? await store.apply("push", (rows) => {
        let n = 0;
        for (let i = rows.length - 1; i >= 0; i--) {
          if (gone.has(rows[i].id)) { rows.splice(i, 1); n++; }
          else if (sentDay.has(rows[i].id)) rows[i].lastSentDay = sentDay.get(rows[i].id);
        }
        return n;
      }) : 0;
      return { sent, removed };
    } finally {
      running = false;
    }
  };
  ctx.pushTick = tick;
  if (on && intervalMs > 0) setInterval(() => tick().catch((e) => console.warn(`[cyra] push tick: ${e.message}`)), intervalMs).unref();
}
