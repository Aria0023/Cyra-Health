// Push smoke: VAPID keys generated on the fly, a mock push service that records
// deliveries, and the scheduler driven with injected clocks. Usage: node scripts/push-smoke.js
import https from "https";
import { execFileSync } from "child_process";
import fs from "fs";
import crypto from "crypto";
import webpush from "web-push";
import express from "express";
import { JsonStore } from "../src/core/store.js";
import { mount, due } from "../src/modules/push/index.js";
const assert = (c, m) => { if (!c) { console.error("FAIL:", m); process.exitCode = 1; } else console.log("ok  ", m); };

const keys = webpush.generateVAPIDKeys();
process.env.VAPID_PUBLIC_KEY = keys.publicKey; process.env.VAPID_PRIVATE_KEY = keys.privateKey; process.env.VAPID_SUBJECT = "mailto:test@example.com";
const delivered = []; let gone = false;
// HTTPS mock push service with a throwaway self-signed cert; the client trusts exactly that cert (TLS verification stays on)
fs.mkdirSync("./data-push-tls", { recursive: true });
execFileSync("openssl", ["req", "-x509", "-newkey", "ec", "-pkeyopt", "ec_paramgen_curve:prime256v1", "-nodes", "-days", "1", "-subj", "/CN=127.0.0.1", "-addext", "subjectAltName=IP:127.0.0.1", "-keyout", "./data-push-tls/key.pem", "-out", "./data-push-tls/cert.pem"], { stdio: "ignore" });
const tls = { key: fs.readFileSync("./data-push-tls/key.pem"), cert: fs.readFileSync("./data-push-tls/cert.pem") };
const trustAgent = new https.Agent({ ca: tls.cert });
const pushSvc = https.createServer(tls, (req, res) => { let n = 0; req.on("data", (c) => (n += c.length)); req.on("end", () => { delivered.push({ url: req.url, bytes: n, enc: req.headers["content-encoding"], auth: String(req.headers.authorization || "").slice(0, 6) }); res.writeHead(gone ? 410 : 201); res.end(); }); });
await new Promise((r) => pushSvc.listen(3996, r));

fs.rmSync("./data-push-test", { recursive: true, force: true });
const store = new JsonStore("./data-push-test");
const app = express(); app.use(express.json()); const router = express.Router(); const ctx = { config: {}, store }; mount(router, ctx, { intervalMs: 0, agent: trustAgent }); app.use("/api/push", router);
const srv = await new Promise((r) => { const s = app.listen(3110, () => r(s)); });
const B = "http://127.0.0.1:3110";
// a subscription whose keys are a real P-256 pair so web-push can encrypt to it
const ecdh = crypto.createECDH("prime256v1"); ecdh.generateKeys();
const subscription = { endpoint: "https://127.0.0.1:3996/push/abc", keys: { p256dh: ecdh.getPublicKey("base64url"), auth: crypto.randomBytes(16).toString("base64url") } };
try {
  const v = await (await fetch(`${B}/api/push/vapid`)).json();
  assert(v.publicKey === keys.publicKey, "vapid: public key served");
  let r = await fetch(`${B}/api/push/subscribe`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ subscription: { ...subscription, endpoint: "https://127.0.0.1:3996/push/abc" }, cadence: "weekdays", nudge: "morning", tz: "America/Los_Angeles", name: "LEAK", days: [{ sym: 1 }] }) });
  assert(r.status === 200 && (await r.json()).active === true, "subscribe: stored with cadence weekdays / morning / LA");
  const row = JSON.parse(fs.readFileSync("data-push-test/push.json"))[0];
  assert(Object.keys(row).sort().join() === "cadence,endpoint,id,keys,lastSentDay,nudge,tz,updatedAt", "store: subscription + preferences only — no name, no health data");
  r = await fetch(`${B}/api/push/subscribe`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ subscription, cadence: "sometimes", nudge: "morning" }) });
  assert(r.status === 400, "subscribe: invalid cadence → 400");
  // due() — pure scheduling rules
  const mk = (cadence, nudge, tz = "America/Los_Angeles") => ({ cadence, nudge, tz, lastSentDay: null });
  const at = (iso) => new Date(iso);
  assert(due(mk("weekdays", "morning"), at("2026-10-07T16:05:00Z")) === true, "due: Wed 09:05 LA, weekdays+morning → yes");
  assert(due(mk("weekdays", "morning"), at("2026-10-07T15:55:00Z")) === false, "due: Wed 08:55 LA → not yet");
  assert(due(mk("weekdays", "morning"), at("2026-10-07T16:40:00Z")) === false, "due: Wed 09:40 LA → window closed (one reminder, never a second nudge)");
  assert(due(mk("weekdays", "morning"), at("2026-10-10T16:05:00Z")) === false, "due: Sat → weekdays skips weekends");
  assert(due(mk("daily", "evening"), at("2026-10-07T02:10:00Z")) === true && due(mk("daily", "evening", "UTC"), at("2026-10-07T02:10:00Z")) === false, "due: Wed 02:10 UTC is Tue 19:10 in LA → timezone honored");
  assert(due(mk("3x", "evening", "UTC"), at("2026-10-07T19:10:00Z")) === true, "due: Wed 19:10 UTC, 3x evening → yes");
  assert(due(mk("3x", "evening", "UTC"), at("2026-10-06T19:10:00Z")) === false, "due: Tue → 3x (Mon/Wed/Fri) skips");
  assert(due(mk("weekly", "midday", "UTC"), at("2026-10-05T12:35:00Z")) === true && due(mk("weekly", "midday", "UTC"), at("2026-10-06T12:35:00Z")) === false, "due: weekly = Mondays only");
  assert(due(mk("daily", "never"), at("2026-10-07T16:05:00Z")) === false, "due: nudge never → never");
  assert(due(mk("me", "morning"), at("2026-10-07T16:05:00Z")) === false, "due: cadence 'when I feel like it' → no reminders at all");
  assert(due({ ...mk("daily", "morning", "UTC"), lastSentDay: "2026-10-07" }, at("2026-10-07T09:05:00Z")) === false, "due: already sent today → no second reminder");
  // scheduler end to end against the mock push service (store row uses the http endpoint so the mock can receive it)
  await store.update("push", () => true, { endpoint: subscription.endpoint, tz: "UTC", cadence: "daily", nudge: "morning" });
  let t = await ctx.pushTick(at("2026-10-07T09:03:00Z"));
  assert(t.sent === 1 && delivered.length === 1 && delivered[0].enc === "aes128gcm" && delivered[0].auth === "vapid ", `tick: one encrypted (aes128gcm) VAPID-signed push delivered (${delivered[0].bytes} bytes)`);
  t = await ctx.pushTick(at("2026-10-07T09:10:00Z"));
  assert(t.sent === 0, "tick: same day again → nothing (one per day)");
  t = await ctx.pushTick(at("2026-10-08T09:03:00Z"));
  assert(t.sent === 1 && delivered.length === 2, "tick: next day → sent again");
  gone = true;
  t = await ctx.pushTick(at("2026-10-09T09:03:00Z"));
  assert(t.removed === 1 && (await store.find("push", (r) => r.keys)).length === 0, "tick: push service says 410 Gone → subscription dropped");
  r = await fetch(`${B}/api/push/subscribe`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ endpoint: subscription.endpoint }) });
  assert(r.status === 200, "unsubscribe: ok");
} finally { srv.close(); pushSvc.close(); fs.rmSync("./data-push-test", { recursive: true, force: true }); fs.rmSync("./data-push-tls", { recursive: true, force: true }); }
console.log(process.exitCode ? "PUSH SMOKE: FAILURES" : "PUSH SMOKE: all passed");
