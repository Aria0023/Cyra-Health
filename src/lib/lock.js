/* The app lock (local-first L10, owner decision D4): a 4–6 digit PIN, kept only as a PBKDF2-SHA-256
   hash with a random salt, an optional passkey (WebAuthn, web only) that may unlock it, the lock-after
   choice and the attempt back-off. Everything here is pure logic over WebCrypto and WebAuthn: no network
   is used anywhere. WebAuthn runs between the page and the device's own authenticator (or the password
   manager that holds the passkey); Cyra's servers are never involved, and no request leaves the device.
   The whole LockCfg lives in a device-only slot outside the record (lib/storage.js saveLock / loadLock):
   it is never in PERSISTED, the autosave, another tab's adoption or a backup.

   The lock keeps Cyra closed on this device; it does not encrypt what is stored. A 4–6 digit PIN hash
   can be brute-forced offline by someone who copies the slot, and the back-off is client-side; the
   Settings copy (LOCK_COPY) says so. A damaged or unrecognised slot (cleanLock → null) fails open, so a
   record is never stranded behind a lock that can't be checked; an unreadable slot (I/O error) fails
   closed but recoverable (Try again / Forgot PIN, App.jsx).

   This file must not import api.js, native.js, storage.js or features.js, so node --test loads it. It
   imports RECORD_VERSION from record.js (pure) for the record a forgotten-PIN restore writes.

   Written for the iOS 15 web view too: no structuredClone, .at(), findLast or Object.hasOwn. */
import { RECORD_VERSION } from "./record.js";

/**
 * This device's app lock, as stored in the device-only slot (web: IndexedDB "cyra"/"state" key "v1-lock";
 * phone: Library/NoCloud/cyra-lock.json). Written only by lock actions (set / change / off, lock-after,
 * passkey on / off, failed and successful PIN checks); removed by Delete everything, Start over and a
 * forgotten-PIN restore.
 * @typedef {Object} LockCfg
 * @property {1} v LOCK_V.
 * @property {{salt: string, hash: string, iter: number, len: number}} pin base64 16-byte salt, base64 32-byte
 *   PBKDF2-SHA-256 hash, the round count and the PIN's length (4–6, drives auto-submit). Never the PIN.
 * @property {0|60|300} after seconds Cyra may be hidden before it locks again (Immediately / 1 min / 5 min).
 * @property {{id: string}|null} cred the base64url WebAuthn credential id of the passkey that may unlock this
 *   device (web only), or null. Only the id is kept; the private key stays in the authenticator.
 * @property {number} fails wrong tries since the last success (0–1000).
 * @property {number} waitUntil epoch ms until which no try is accepted (0 when none), capped at 15 minutes.
 */

export const LOCK_V = 1;
/** PBKDF2 rounds, the same cost as lib/backup.js ITERATIONS. */
export const PIN_ITER = 600_000;
/** Lock-after choices, in seconds: Immediately / 1 minute / 5 minutes. */
export const AFTER_CHOICES = Object.freeze([0, 60, 300]);
export const FREE_TRIES = 5;
/** Wait after the 5th, 6th, 7th, 8th and every later wrong try. */
export const BACKOFF_SEC = Object.freeze([30, 60, 120, 300, 900]);
/** How long a hand-off Cyra starts itself (backup share, file picker, passkey prompt) keeps the lock from firing on the hide it causes. */
export const GRACE_MS = 3000;
/** A graced hide still locks once the app has been away this long. */
export const GRACE_MAX_MS = 300_000;

const SALT_LEN = 16, HASH_LEN = 32;

/* ---------- small codecs ---------- */
const bytesOf = (b) => (b instanceof Uint8Array ? b : b instanceof ArrayBuffer ? new Uint8Array(b) : ArrayBuffer.isView(b) ? new Uint8Array(b.buffer, b.byteOffset, b.byteLength) : null);
const toB64 = (bytes) => { let s = ""; for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]); return btoa(s); };
const fromB64 = (s) => { try { const bin = atob(String(s)); const out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; } catch { return null; } };
/** base64url without padding (WebAuthn ids and challenges). */
export const b64u = (b) => toB64(bytesOf(b) || new Uint8Array(0)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
export const fromB64u = (s) => fromB64(String(s).replace(/-/g, "+").replace(/_/g, "/") + "===".slice((String(s).length + 3) % 4));
const rand = (n) => crypto.getRandomValues(new Uint8Array(n));
const b64Len = (s) => { const b = typeof s === "string" ? fromB64(s) : null; return b ? b.length : -1; };

/* ---------- the PIN ---------- */
/** Exactly 4 to 6 digits. */
export const validPin = (s) => typeof s === "string" && /^\d{4,6}$/.test(s);
/** Every digit the same, or a straight run up or down (1234, 0123, 987654…). */
export function weakPin(s) {
  if (!validPin(s)) return false;
  const d = s.split("").map(Number);
  const same = d.every((x) => x === d[0]);
  const up = d.every((x, i) => i === 0 || x === d[i - 1] + 1);
  const down = d.every((x, i) => i === 0 || x === d[i - 1] - 1);
  return same || up || down;
}
async function derive(pin, salt, iter) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: iter, hash: "SHA-256" }, key, HASH_LEN * 8));
}
/** PBKDF2-SHA-256 of the PIN with a fresh 16-byte salt → { salt, hash, iter, len }. The PIN itself is never kept. */
export async function hashPin(pin, { salt = rand(SALT_LEN), iter = PIN_ITER } = {}) {
  if (!validPin(pin)) throw new Error("Use 4 to 6 digits.");
  const hash = await derive(pin, salt, iter);
  return { salt: toB64(salt), hash: toB64(hash), iter, len: pin.length };
}
/** Re-derives with the record's salt and rounds and compares in constant time. false for anything invalid. */
export async function checkPin(pin, rec) {
  if (!validPin(pin) || !rec || typeof rec !== "object") return false;
  const salt = fromB64(rec.salt), want = fromB64(rec.hash);
  if (!salt || !want || !Number.isInteger(rec.iter) || rec.iter < 1) return false;
  const got = await derive(pin, salt, rec.iter);
  if (got.length !== want.length) return false;
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= got[i] ^ want[i];
  return diff === 0;
}

/* ---------- the stored config ---------- */
/** A fresh lock around a hashed PIN. */
export const newLock = (pinRec, { after = 0 } = {}) => ({ v: LOCK_V, pin: pinRec, after, cred: null, fails: 0, waitUntil: 0 });
const CRED_ID = /^[A-Za-z0-9_-]{16,1366}$/;
/** The stored value → a LockCfg, or null when it isn't one (a damaged slot opens the app rather than stranding her). */
export function cleanLock(raw, now = Date.now()) {
  if (!raw || typeof raw !== "object" || raw.v !== LOCK_V) return null;
  const p = raw.pin;
  if (!p || typeof p !== "object" || b64Len(p.salt) !== SALT_LEN || b64Len(p.hash) !== HASH_LEN || !Number.isInteger(p.iter) || p.iter < 1000 || !Number.isInteger(p.len) || p.len < 4 || p.len > 6) return null;
  const after = AFTER_CHOICES.includes(raw.after) ? raw.after : 0;
  const cred = raw.cred && typeof raw.cred === "object" && typeof raw.cred.id === "string" && CRED_ID.test(raw.cred.id) ? { id: raw.cred.id } : null;
  const fails = Number.isInteger(raw.fails) && raw.fails >= 0 && raw.fails <= 1000 ? raw.fails : 0;
  const waitUntil = Number.isFinite(raw.waitUntil) && raw.waitUntil > 0 ? Math.min(raw.waitUntil, now + 900_000) : 0;
  return { v: LOCK_V, pin: { salt: p.salt, hash: p.hash, iter: p.iter, len: p.len }, after, cred, fails, waitUntil };
}

/* ---------- back-off ---------- */
export const backoffMs = (fails) => (fails < FREE_TRIES ? 0 : BACKOFF_SEC[Math.min(fails - FREE_TRIES, BACKOFF_SEC.length - 1)] * 1000);
export function afterFail(cfg, now = Date.now()) {
  const fails = (cfg.fails || 0) + 1;
  return { ...cfg, fails, waitUntil: fails >= FREE_TRIES ? now + backoffMs(fails) : 0 };
}
export const afterSuccess = (cfg) => (!cfg.fails && !cfg.waitUntil ? cfg : { ...cfg, fails: 0, waitUntil: 0 });
export const triesLeft = (fails) => Math.max(0, FREE_TRIES - (fails || 0));

/* ---------- timing ---------- */
/** How long the app was hidden: the larger of the wall-clock and monotonic deltas, never negative (a clock moved back still locks). */
export const awayMs = ({ hiddenAt, now, hiddenMono, nowMono }) => Math.max(0, (now ?? 0) - (hiddenAt ?? 0), (nowMono ?? 0) - (hiddenMono ?? 0));
/** Whether a return after awayMs should show the lock. Never while a POTS test or session runs; a graced hide (a hand-off Cyra started) waits GRACE_MAX_MS at least. */
export function shouldLock({ afterSec = 0, awayMs: away = 0, graced = false, running = false } = {}) {
  if (running) return false;
  const need = graced ? Math.max(afterSec * 1000, GRACE_MAX_MS) : afterSec * 1000;
  return away >= need;
}
export const fmtWait = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
export const waitWords = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return s <= 30 ? "30 seconds" : s <= 60 ? "1 minute" : s <= 120 ? "2 minutes" : s <= 300 ? "5 minutes" : "15 minutes"; };

/* ---------- WebAuthn (web only) ---------- */
const codeErr = (e) => { const c = e?.name === "NotAllowedError" || e?.name === "AbortError" ? "cancel" : "failed"; const err = new Error(c === "cancel" ? "Cancelled" : "Didn't finish"); err.code = c; return err; };
/** Whether this page can use a user-verifying platform authenticator (never on the phone, never outside a secure context). */
export async function passkeyAvailable({ native = false } = {}) {
  try {
    if (native || typeof window === "undefined" || !window.isSecureContext) return false;
    const PKC = window.PublicKeyCredential;
    if (!PKC || typeof PKC.isUserVerifyingPlatformAuthenticatorAvailable !== "function") return false;
    return (await PKC.isUserVerifyingPlatformAuthenticatorAvailable()) === true;
  } catch { return false; }
}
/** Pure: the clientDataJSON of a create/get matches the type, challenge and origin asked for. Malformed → false. */
export function checkClientData(buf, { type, challenge, origin }) {
  try {
    const bytes = bytesOf(buf); if (!bytes) return false;
    const d = JSON.parse(new TextDecoder().decode(bytes));
    return !!d && d.type === type && d.challenge === b64u(challenge) && d.origin === origin;
  } catch { return false; }
}
/** Pure: an assertion came from the stored credential, for this challenge and origin, with user presence and verification. */
export function checkAssertion({ rawId, clientDataJSON, authenticatorData } = {}, { credId, challenge, origin } = {}) {
  try {
    if (!rawId || b64u(rawId) !== credId) return false;
    if (!checkClientData(clientDataJSON, { type: "webauthn.get", challenge, origin })) return false;
    const ad = bytesOf(authenticatorData); if (!ad || ad.length < 37) return false;
    const flags = ad[32];
    return (flags & 0x01) === 0x01 && (flags & 0x04) === 0x04;
  } catch { return false; }
}
/** Makes the passkey on this device (called inside her tap). Returns { id } or throws Error with .code "cancel" | "failed". */
export async function createPasskey() {
  const challenge = rand(32);
  let cred;
  try {
    cred = await navigator.credentials.create({ publicKey: {
      rp: { name: "Heard Health" }, user: { id: rand(16), name: "Heard Health lock", displayName: "Heard Health lock" }, challenge,
      pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "discouraged", requireResidentKey: false },
      attestation: "none", timeout: 60000,
    } });
  } catch (e) { throw codeErr(e); }
  if (!cred || !cred.rawId || !checkClientData(cred.response?.clientDataJSON, { type: "webauthn.create", challenge, origin: location.origin })) { const err = new Error("Didn't finish"); err.code = "failed"; throw err; }
  return { id: b64u(cred.rawId) };
}
/** Asks the device to verify her with the stored passkey → true only for a checked assertion. Same error codes as createPasskey. */
export async function verifyPasskey(credId, { signal } = {}) {
  const challenge = rand(32);
  const id = fromB64u(credId);
  let cred;
  try {
    cred = await navigator.credentials.get({ publicKey: { challenge, allowCredentials: [{ type: "public-key", id, transports: ["internal"] }], userVerification: "required", timeout: 60000 }, signal });
  } catch (e) { throw codeErr(e); }
  return !!cred && checkAssertion({ rawId: cred.rawId, clientDataJSON: cred.response?.clientDataJSON, authenticatorData: cred.response?.authenticatorData }, { credId, challenge, origin: location.origin });
}

/* ---------- forgotten PIN: the record a restore writes into the emptied store ---------- */
/** The backup becomes the device's whole record (never merged with what was there, which a crafted backup could
    otherwise have unlocked): only persisted keys, minus the device-only, device-preference and not-in-backup
    keys and `reminders`; wearable connections from the backup only, marked unconfirmed; reminders off on the
    web. The caller applies the POTS epoch. */
export function forgotPinRecord(saved, { persisted = [], deviceOnly = [], devicePrefs = [], notInBackup = [], native = false, now = new Date() } = {}) {
  const drop = new Set([...deviceOnly, ...devicePrefs, ...notInBackup, "reminders"]);
  const rec = {};
  for (const k of persisted) if (!drop.has(k) && saved && k in saved && saved[k] !== undefined) rec[k] = saved[k];
  const wear = saved?.wearSources && typeof saved.wearSources === "object" ? { ...saved.wearSources } : {};
  for (const id of ["oura", "terra"]) { const st = wear[id]; if (st && typeof st === "object" && !st.demo) wear[id] = { ...st, pending: true, restored: true }; }
  rec.wearSources = wear;
  rec.reminders = { enabled: native ? !!saved?.reminders?.enabled : false, endpoint: null, pending: [], rev: 0 };
  return { ...rec, v: RECORD_VERSION, savedAt: new Date(now).toISOString(), phase: "app" };
}

/* ---------- copy ---------- */
export const LOCK_COPY = Object.freeze({
  label: "App lock",
  offTitle: "Off", onTitle: "On",
  offSub: "Ask for a PIN each time Heard Health opens on this device.",
  onSub: (cred, after) => `${cred ? "PIN, or fingerprint, face or screen lock" : "PIN"}. Heard Health locks when it opens and ${after === 0 ? "as soon as you leave it" : after === 60 ? "after a minute away" : "after 5 minutes away"}.`,
  setPin: "Set a PIN", lockNow: "Lock now",
  afterLabel: "Lock again after", afterNames: Object.freeze({ 0: "Immediately", 60: "1 minute", 300: "5 minutes" }),
  bioTitle: "Fingerprint, face or screen lock", bioSub: "Unlock with a passkey this device keeps. Your PIN always works too.",
  changePin: "Change PIN", turnOff: "Turn off lock",
  noteWeb: "The lock keeps Heard Health closed on this device until your PIN is entered. It doesn't encrypt what's stored: anyone with full access to this browser, for example through its developer tools, could still read your record. Only an encrypted backup file is locked with a passphrase.",
  notePhone: "The lock keeps Heard Health closed on this phone until your PIN is entered. It doesn't encrypt what's stored; your phone's own passcode is what protects its storage. Only an encrypted backup file is locked with a passphrase.",
  facts: Object.freeze([
    "Heard Health never stores your PIN, only a one-way hash of it made with a random salt. It stays on this device, isn't in your backups and is never sent anywhere. A 4 to 6 digit PIN could still be worked out from that hash by someone who copies it off the device, which is one reason the lock isn't encryption.",
    "After 5 wrong tries Heard Health makes you wait before the next one: 30 seconds at first, longer each time, up to 15 minutes.",
    "If you forget your PIN there's no reset. On the lock screen you can restore an encrypted backup, which replaces everything on this device, or erase Heard Health's record here. Anyone holding the device can do either, as they could by deleting the app, but neither shows them your record.",
    "Delete everything, or restoring a backup from the lock screen, also removes the lock. Restoring a backup from Settings keeps it.",
    "Anything you turned on keeps working while Heard Health is locked.",
  ]),
  factPots: "Heard Health waits to lock while a stand test or movement session is running, and locks the next time you leave it.",
  factPhone: "The phone app unlocks with your PIN only.",
  bioFacts: Object.freeze([
    "The passkey is made and checked on this device. Heard Health's servers aren't involved.",
    "Anyone whose fingerprint or face this device accepts, or who knows its screen lock, can open Heard Health with it.",
    "Your password manager lists it as \"Heard Health lock\" (\"Cyra lock\" if you set it up before the app was renamed) for this website and may sync it to your other devices. It holds nothing about your health, and only this device's lock accepts it.",
    "Turning it off here doesn't delete it from your password manager; you can delete it there.",
  ]),
  // panels
  choose: "Choose a PIN", newPin: "New PIN (4 to 6 digits)", newPinLabel: "New PIN", repeat: "Repeat it", repeatLabel: "Repeat new PIN", current: "Current PIN",
  forgetHint: "If you forget it, Heard Health can't reset it: you'd restore an encrypted backup or erase Heard Health's record on this device.",
  noBackupYet: " You haven't made a backup on this device yet.",
  turnOnLock: "Turn on the lock", saving: "Saving…", cancel: "Cancel", saveNew: "Save new PIN",
  offAsk: "Turn off the app lock?", offHint: "Heard Health will open without a PIN on this device.", turnOffLock: "Turn off the lock", keepOn: "Keep it on",
  bioSetup: "Set up fingerprint, face or screen lock", bioContinue: "Continue", bioConfirm: "Now confirm with your fingerprint, face or screen lock.", bioGo: "Set it up",
  // errors
  errDigits: "Use 4 to 6 digits.", errMatch: "The two PINs don't match.", errWeak: "That PIN is easy to guess. Avoid a run like 1234 or one digit repeated.",
  errCurrent: "That isn't your current PIN.", errWait: (t) => `Too many tries. Try again in ${t}.`, errSave: "Heard Health couldn't save the lock on this device. Try again.",
  errBio: "Setting up fingerprint, face or screen lock didn't finish. Your PIN still works.",
  // toasts
  toastOn: "App lock on. Heard Health asks for your PIN when it opens and when you come back to it.",
  toastChanged: "PIN changed.",
  toastOff: "App lock off. Heard Health opens without a PIN on this device.",
  toastOffCred: " You can delete the \"Heard Health lock\" passkey (\"Cyra lock\" if you set it up before the app was renamed) from your password manager.",
  toastBioOn: "Fingerprint, face or screen lock can now unlock Heard Health on this device.",
  toastBioOff: "Fingerprint, face or screen lock is off. Your PIN still unlocks Heard Health. You can delete the \"Heard Health lock\" passkey (\"Cyra lock\" if you set it up before the app was renamed) from your password manager.",
  toastRestored: "Backup restored. The app lock is off — set a new PIN in Settings if you want one.",
  toastRestoredRem: "Backup restored. Reminders stay off in this browser — turn them on in Settings if you want them here. The app lock is off — set a new PIN in Settings if you want one.",
  toastRestoreFailed: "Heard Health deleted this device's record but couldn't put your backup in its place. Choose the backup file again to restore it.",
  // the lock screen
  title: "Heard Health is locked", enter: "Enter your PIN to open it.", pinLabel: "PIN", keypad: "PIN keypad", del: "Delete last digit",
  checking: "Checking…",
  wrong: (left) => (left > 0 ? `That PIN isn't right. ${left} more ${left === 1 ? "try" : "tries"} before a short wait.` : "That PIN isn't right."),
  waiting: (t) => `Too many tries. Try again in ${t}.`, waitingSr: (w) => `Too many tries. You can try again in ${w}.`,
  canRetry: "You can try again now.",
  bioFailed: "Fingerprint, face or screen lock didn't unlock Heard Health. Use your PIN.",
  readError: "Heard Health couldn't check your PIN just now. Try again.",
  useBio: "Use fingerprint, face or screen lock", forgot: "Forgot your PIN?", back: "Back to the PIN",
  unreadable: "Heard Health couldn't read its lock settings on this device.", tryAgain: "Try again",
  forgotHead: "Heard Health can't reset your PIN.", forgotBody: " There's no account and no back door. You can restore an encrypted backup, which replaces everything on this device and turns the lock off, or erase Heard Health's record on this device.",
  forgotBodyAccount: " There's no back door, and your account can't reset it either. You can restore an encrypted backup, which replaces everything on this device and turns the lock off, or erase Heard Health's record on this device.",
  restoreBtn: "Restore from a backup", eraseBtn: "Erase this device's record",
  restoreLab: "Restore from an encrypted backup", fileLab: "Backup file", passLab: "Passphrase", passField: "Backup passphrase", openBackup: "Open my backup", unlocking: "Unlocking…",
  restoreFoot: "Opened on this device with your passphrase. Nothing changes until you confirm on the next step.",
  restoreConfirm: "Yes, restore my backup", restoring: "Restoring…",
  restoreIntroHead: "Your backup opened. Restore it on this device?",
  restoreIntro: " Heard Health first deletes everything on this device, the same as Delete everything: every check-in, POTS log, note, appointment and setting here, and the app lock.",
  restoreIntroTail: " Then it puts your backup in their place and opens without a PIN.",
});
