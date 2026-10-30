// Local-first L10: the app lock's pure logic (lib/lock.js). Run: npm run test:unit
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  LOCK_V, PIN_ITER, AFTER_CHOICES, FREE_TRIES, BACKOFF_SEC, GRACE_MS, GRACE_MAX_MS, validPin, weakPin, hashPin, checkPin, newLock, cleanLock,
  backoffMs, afterFail, afterSuccess, triesLeft, awayMs, shouldLock, fmtWait, waitWords, passkeyAvailable, checkClientData, checkAssertion,
  forgotPinRecord, b64u, LOCK_COPY,
} from "./lock.js";
import { ITERATIONS } from "./backup.js";
import { PERSISTED, DEVICE_ONLY, DEVICE_PREFS, NOT_IN_BACKUP, RECORD_VERSION } from "./record.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const src = readFileSync(path.join(here, "lock.js"), "utf8");
const enc = (s) => new TextEncoder().encode(s);

test("lock: validPin accepts 4–6 digits only", () => {
  for (const ok of ["0000", "1234", "12345", "123456"]) assert.equal(validPin(ok), true, ok);
  for (const bad of ["123", "1234567", "12a4", " 1234", "", null, undefined]) assert.equal(validPin(bad), false, String(bad));
});

test("lock: weakPin flags repeats and straight runs", () => {
  for (const w of ["1111", "000000", "1234", "123456", "0123", "3456", "4321", "987654"]) assert.equal(weakPin(w), true, w);
  for (const s of ["1357", "2580", "9214", "120384", "1123"]) assert.equal(weakPin(s), false, s);
});

test("lock: hashPin + checkPin round trip (iter 1000), two salts differ, the PIN is never stored", async () => {
  const rec = await hashPin("2580", { iter: 1000 });
  assert.deepEqual(Object.keys(rec).sort(), ["hash", "iter", "len", "salt"]);
  assert.equal(Buffer.from(rec.salt, "base64").length, 16);
  assert.equal(Buffer.from(rec.hash, "base64").length, 32);
  assert.equal(rec.iter, 1000); assert.equal(rec.len, 4);
  assert.equal(await checkPin("2580", rec), true);
  assert.equal(await checkPin("2581", rec), false);
  const rec2 = await hashPin("2580", { iter: 1000 });
  assert.notEqual(rec2.hash, rec.hash); assert.notEqual(rec2.salt, rec.salt);
  assert.ok(!Object.values(rec).includes("2580"));
  assert.equal(await checkPin("12a4", rec), false);
  assert.equal(await checkPin("2580", null), false);
  assert.equal(await checkPin("2580", { salt: "x", hash: "y", iter: 1000 }), false);
});

test("lock: PIN_ITER matches the backup's cost and is the default", async () => {
  assert.equal(PIN_ITER, 600000); assert.equal(PIN_ITER, ITERATIONS);
  const rec = await hashPin("2580");
  assert.equal(rec.iter, 600000);
});

test("lock: back-off schedule, afterFail / afterSuccess, triesLeft", async () => {
  assert.equal(FREE_TRIES, 5); assert.deepEqual([...BACKOFF_SEC], [30, 60, 120, 300, 900]);
  for (let i = 0; i < 5; i++) assert.equal(backoffMs(i), 0);
  assert.equal(backoffMs(5), 30000); assert.equal(backoffMs(6), 60000); assert.equal(backoffMs(7), 120000); assert.equal(backoffMs(8), 300000); assert.equal(backoffMs(9), 900000); assert.equal(backoffMs(50), 900000);
  const pin = await hashPin("2580", { iter: 1000 });
  let cfg = newLock(pin, { after: 60 }); cfg = { ...cfg, cred: { id: "abcdefghijklmnopqrstuvwxyz" } };
  const now = 1_700_000_000_000;
  for (let i = 1; i <= 4; i++) { cfg = afterFail(cfg, now); assert.equal(cfg.fails, i); assert.equal(cfg.waitUntil, 0); }
  cfg = afterFail(cfg, now); assert.equal(cfg.fails, 5); assert.equal(cfg.waitUntil, now + 30000);
  cfg = afterFail(cfg, now); assert.equal(cfg.waitUntil, now + 60000);
  assert.equal(cfg.pin, pin); assert.equal(cfg.after, 60); assert.deepEqual(cfg.cred, { id: "abcdefghijklmnopqrstuvwxyz" });
  const clean = afterSuccess(cfg); assert.equal(clean.fails, 0); assert.equal(clean.waitUntil, 0); assert.notEqual(clean, cfg);
  assert.equal(afterSuccess(clean), clean, "already clean: the same object");
  assert.equal(triesLeft(3), 2); assert.equal(triesLeft(7), 0);
});

test("lock: shouldLock and awayMs", () => {
  assert.equal(GRACE_MS, 3000); assert.equal(GRACE_MAX_MS, 300000); assert.deepEqual([...AFTER_CHOICES], [0, 60, 300]);
  for (const a of [0, 1, 59999, 10 ** 9]) assert.equal(shouldLock({ afterSec: 0, awayMs: a }), true);
  assert.equal(shouldLock({ afterSec: 60, awayMs: 59999 }), false); assert.equal(shouldLock({ afterSec: 60, awayMs: 60000 }), true);
  assert.equal(shouldLock({ afterSec: 300, awayMs: 299999 }), false); assert.equal(shouldLock({ afterSec: 300, awayMs: 300000 }), true);
  assert.equal(shouldLock({ afterSec: 0, awayMs: 299999, graced: true }), false); assert.equal(shouldLock({ afterSec: 0, awayMs: 300000, graced: true }), true);
  for (const a of [0, 60, 300]) for (const away of [0, 10 ** 9]) assert.equal(shouldLock({ afterSec: a, awayMs: away, running: true }), false);
  assert.equal(awayMs({ hiddenAt: 1000, now: 4000, hiddenMono: 10, nowMono: 20 }), 3000);
  assert.equal(awayMs({ hiddenAt: 1000, now: 1500, hiddenMono: 10, nowMono: 5010 }), 5000);
  assert.equal(awayMs({ hiddenAt: 5000, now: 1000, hiddenMono: 10, nowMono: 70010 }), 70000, "a clock moved back still locks by the monotonic delta");
  assert.equal(awayMs({ hiddenAt: 5000, now: 1000, hiddenMono: 50, nowMono: 10 }), 0);
  assert.equal(fmtWait(30000), "0:30"); assert.equal(fmtWait(900000), "15:00"); assert.equal(fmtWait(61000), "1:01"); assert.equal(fmtWait(-5), "0:00");
  assert.equal(waitWords(30000), "30 seconds"); assert.equal(waitWords(60000), "1 minute"); assert.equal(waitWords(120000), "2 minutes"); assert.equal(waitWords(300000), "5 minutes"); assert.equal(waitWords(900000), "15 minutes");
});

test("lock: cleanLock passes a valid cfg unchanged, rejects a broken one, fixes up the rest", async () => {
  const pin = await hashPin("2580", { iter: 1000 });
  const now = 1_700_000_000_000;
  const good = { v: 1, pin, after: 60, cred: { id: "abcdefghijklmnopqrstuvwxyz0123456789" }, fails: 2, waitUntil: 0 };
  assert.deepEqual(cleanLock(good, now), good);
  assert.equal(cleanLock({ ...good, pin: undefined }, now), null);
  assert.equal(cleanLock({ ...good, pin: { ...pin, salt: Buffer.alloc(15).toString("base64") } }, now), null);
  assert.equal(cleanLock({ ...good, pin: { ...pin, hash: Buffer.alloc(31).toString("base64") } }, now), null);
  assert.equal(cleanLock({ ...good, pin: { ...pin, iter: 999 } }, now), null);
  assert.equal(cleanLock({ ...good, pin: { ...pin, len: 3 } }, now), null);
  assert.equal(cleanLock({ ...good, pin: { ...pin, len: 7 } }, now), null);
  assert.equal(cleanLock({ ...good, v: 2 }, now), null);
  assert.equal(cleanLock("nope", now), null); assert.equal(cleanLock(null, now), null);
  const fixed = cleanLock({ ...good, after: 45, fails: -1, waitUntil: now + 3600000, cred: { id: "bad id!" }, junk: 1 }, now);
  assert.deepEqual(fixed, { v: 1, pin, after: 0, cred: null, fails: 0, waitUntil: now + 900000 });
  assert.equal(cleanLock({ ...good, fails: "x" }, now).fails, 0);
  assert.equal(cleanLock({ ...good, waitUntil: -5 }, now).waitUntil, 0);
  assert.equal(LOCK_V, 1);
});

test("lock: checkAssertion and checkClientData over synthetic buffers", () => {
  const challenge = new Uint8Array(32).map((_, i) => i * 7 % 256);
  const rawId = new Uint8Array(20).map((_, i) => 200 - i);
  const credId = b64u(rawId);
  const origin = "https://cyra.test";
  const cd = (o) => enc(JSON.stringify({ type: "webauthn.get", challenge: b64u(challenge), origin, ...o }));
  const ad = (flags) => { const a = new Uint8Array(37); a[32] = flags; return a; };
  const ok = { rawId, clientDataJSON: cd({}), authenticatorData: ad(0x05) };
  assert.equal(checkAssertion(ok, { credId, challenge, origin }), true);
  assert.equal(checkAssertion({ ...ok, clientDataJSON: cd({ type: "webauthn.create" }) }, { credId, challenge, origin }), false);
  assert.equal(checkAssertion({ ...ok, clientDataJSON: cd({ challenge: b64u(new Uint8Array(32)) }) }, { credId, challenge, origin }), false);
  assert.equal(checkAssertion({ ...ok, clientDataJSON: cd({ origin: "https://evil.test" }) }, { credId, challenge, origin }), false);
  assert.equal(checkAssertion({ ...ok, rawId: new Uint8Array(20) }, { credId, challenge, origin }), false);
  assert.equal(checkAssertion({ ...ok, authenticatorData: ad(0x01) }, { credId, challenge, origin }), false, "no UV");
  assert.equal(checkAssertion({ ...ok, authenticatorData: ad(0x04) }, { credId, challenge, origin }), false, "no UP");
  assert.equal(checkAssertion({ ...ok, clientDataJSON: enc("{nope") }, { credId, challenge, origin }), false);
  assert.equal(checkAssertion({ ...ok, authenticatorData: new Uint8Array(10) }, { credId, challenge, origin }), false);
  assert.equal(checkAssertion({}, { credId, challenge, origin }), false);
  const cc = enc(JSON.stringify({ type: "webauthn.create", challenge: b64u(challenge), origin }));
  assert.equal(checkClientData(cc, { type: "webauthn.create", challenge, origin }), true);
  assert.equal(checkClientData(cc.buffer, { type: "webauthn.create", challenge, origin }), true, "an ArrayBuffer works too");
  assert.equal(checkClientData(cc, { type: "webauthn.get", challenge, origin }), false);
  assert.equal(checkClientData(cc, { type: "webauthn.create", challenge, origin: "https://x" }), false);
  assert.equal(checkClientData(null, { type: "webauthn.create", challenge, origin }), false);
});

test("lock: passkeyAvailable is false on the phone and in Node, without throwing", async () => {
  assert.equal(await passkeyAvailable({ native: true }), false);
  assert.equal(await passkeyAvailable({ native: false }), false);
  assert.equal(await passkeyAvailable(), false);
});

test("lock: forgotPinRecord writes the backup as the whole record, minus device-only keys and reminders", () => {
  const now = new Date("2026-10-23T10:00:00Z");
  const saved = { v: 1, stage: "peri", days: [1], research: true, askAI: true, lastBackupAt: "2026-01-01", appearance: "dark", reminders: { enabled: true, endpoint: "https://x" }, wearSources: { oura: { token: "t" }, terra: { key: "k", demo: true } }, junk: 1 };
  const opts = { persisted: PERSISTED, deviceOnly: DEVICE_ONLY, devicePrefs: DEVICE_PREFS, notInBackup: NOT_IN_BACKUP, now };
  const rec = forgotPinRecord(saved, { ...opts, native: false });
  for (const k of ["research", "askAI", "lastBackupAt", "junk", "appearance"]) assert.ok(!(k in rec), `${k} dropped`);
  assert.deepEqual(rec.reminders, { enabled: false, endpoint: null, pending: [], rev: 0 });
  assert.deepEqual(forgotPinRecord(saved, { ...opts, native: true }).reminders, { enabled: true, endpoint: null, pending: [], rev: 0 });
  assert.deepEqual(rec.wearSources, { oura: { token: "t", pending: true, restored: true }, terra: { key: "k", demo: true } });
  assert.equal(rec.stage, "peri"); assert.deepEqual(rec.days, [1]);
  assert.equal(rec.v, RECORD_VERSION); assert.equal(rec.phase, "app"); assert.equal(rec.savedAt, now.toISOString());
  assert.ok(/export function forgotPinRecord\(saved, \{/.test(src), "takes the backup and options only: never the device's current state");
  const noWear = forgotPinRecord({ v: 1, stage: "peri" }, { ...opts, native: false });
  assert.deepEqual(noWear.wearSources, {}, "a backup without connections leaves none (never this device's)");
  assert.ok(!("days" in noWear));
});

test("lock: the source makes no request and touches no storage; LOCK_COPY holds the lock strings", () => {
  for (const bad of ["fetch(", "XMLHttpRequest", "sendBeacon", "WebSocket", "localStorage", "sessionStorage", "indexedDB", "./api.js", "./native.js", "./storage.js", "./features.js"]) assert.ok(!src.includes(bad), bad);
  assert.ok(src.includes("credentials.create(") && src.includes("credentials.get("));
  assert.equal(LOCK_COPY.title, "Heard Health is locked");
  assert.equal(LOCK_COPY.onSub(true, 60), "PIN, or fingerprint, face or screen lock. Heard Health locks when it opens and after a minute away.");
  assert.equal(LOCK_COPY.onSub(false, 0), "PIN. Heard Health locks when it opens and as soon as you leave it.");
  assert.equal(LOCK_COPY.wrong(1), "That PIN isn't right. 1 more try before a short wait.");
  assert.equal(LOCK_COPY.wrong(4), "That PIN isn't right. 4 more tries before a short wait.");
  assert.equal(LOCK_COPY.wrong(0), "That PIN isn't right.");
});
