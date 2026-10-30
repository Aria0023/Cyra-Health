/* The optional account (calm R9, plan §7 "Guest first … optional account for sync"): an email and a passphrase she
   keeps, both turned into keys on this device, so Cyra's server holds only an opaque, already-encrypted backup.
   Pure: imports only ./backup.js (itself import-free); the request function is passed in (lib/cloudBackup.js wires
   apiFetch), so Node runs every line of this file in the unit tests and the backend smoke.

   What leaves the device, per request (and nothing else):
     x-cyra-account  lookupFor(email): SHA-256 of "cyra-account-lookup/v1\n" + her normalised email, base64url
                     (43 characters). The email itself is never sent, so there is no mail provider and no magic link:
                     Cyra could not send her an email even if it wanted to.
     authorization   Bearer tokenFor(email, passphrase): PBKDF2-SHA256 (600,000 rounds) of the passphrase, salted with
                     SHA-256 of "cyra-account-salt/v1\n" + the email, then HMAC-SHA256 under that key of a fixed label.
                     The server keeps only SHA-256 of it. It is a different key from the one that encrypts the backup
                     (backup.js backupKey: the same PBKDF2 over the envelope's own random salt), so the token can't
                     open the backup, and finding the passphrase from it costs the same 600,000 rounds per guess as
                     attacking the backup itself.
     body            the cyra-backup envelope (AES-256-GCM), as application/octet-stream.
   A lost passphrase can't be recovered: nothing on the server, and nothing Cyra holds, can rebuild it or the key. */
import { isEnvelope, CLOUD_MAX_BYTES, ITERATIONS } from "./backup.js";

const subtle = globalThis.crypto.subtle;
const enc = new TextEncoder();
const b64url = (buf) => { const u = new Uint8Array(buf); let s = ""; for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
const sha256 = async (text) => new Uint8Array(await subtle.digest("SHA-256", enc.encode(text)));

export const LOOKUP_TAG = "cyra-account-lookup/v1\n";
export const SALT_TAG = "cyra-account-salt/v1\n";
export const TOKEN_TAG = "cyra-account-write-token/v1";
export const KEY_RE = /^[A-Za-z0-9_-]{43}$/;

/** Her email the way it is hashed: NFKC, trimmed, lower case. */
export const normEmail = (e) => String(e ?? "").normalize("NFKC").trim().toLowerCase();
/** A plausible email (one @, a dot after it, no spaces, at most 254 characters). */
export const isEmail = (e) => { const n = normEmail(e); return n.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(n); };

/** email → the 43-character lookup key the server files her backup under. */
export const lookupFor = async (email) => b64url(await sha256(LOOKUP_TAG + normEmail(email)));

/** email + passphrase → the 43-character write token (see the header). `iterations` exists for tests only. */
export async function tokenFor(email, passphrase, { iterations = ITERATIONS } = {}) {
  const salt = await sha256(SALT_TAG + normEmail(email));
  const base = await subtle.importKey("raw", enc.encode(String(passphrase ?? "").normalize("NFKC")), "PBKDF2", false, ["deriveBits"]);
  const bits = await subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, base, 256);
  const mac = await subtle.importKey("raw", bits, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await subtle.sign("HMAC", mac, enc.encode(TOKEN_TAG)));
}

/** email + passphrase → { lookup, token }. */
export const credentialsFor = async (email, passphrase, opts) => ({ lookup: await lookupFor(email), token: await tokenFor(email, passphrase, opts) });
export const okCred = (c) => !!c && KEY_RE.test(String(c.lookup || "")) && KEY_RE.test(String(c.token || ""));

const fail = (code, message, extra = {}) => Object.assign(new Error(message), { code, ...extra });
export const ACCOUNT_ERRORS = Object.freeze({
  CLOUD_OFF: "Accounts aren't available in this version of Heard Health",
  NOT_ENCRYPTED: "Only an encrypted backup can be uploaded",
  TOO_LARGE: "This backup is too large for your account",
  NO_ACCOUNT: "No backup matches that email and passphrase. Check both — a lost passphrase can't be recovered.",
  GONE: "Your account's backup isn't on Heard Health's server any more. It may have been deleted from another device or expired.",
  CONFLICT: "The backup on Heard Health's server is newer than this device's",
  BUSY: "Too many tries just now. Wait a few minutes and try again.",
  FULL: "Heard Health's server can't take more backups right now. Your log is safe on this device.",
  OFFLINE: "Heard Health's server couldn't be reached. Your log is safe on this device.",
  SERVER: "Heard Health's server couldn't do that just now. Your log is safe on this device.",
});
const E = (code, extra) => fail(code, ACCOUNT_ERRORS[code], extra);

/**
 * The account transport. request = apiFetch-shaped (path, init, { timeoutMs }) → Response. Fail-closed like
 * backup.js cloudTransport: every method throws CLOUD_OFF before any request unless enabled, request and gate() say yes.
 * meta(cred) → { version, updatedAt, expiresAt, size }; load(cred) → { envelope, version, updatedAt };
 * save(envelope, cred, base: "new" | "any" | version) → { version, updatedAt, expiresAt } (throws CONFLICT with
 * { version, updatedAt } when the server's backup isn't `base`); remove(cred) → true.
 * A 404 is NO_ACCOUNT for meta/load (wrong email or passphrase, or none) and GONE for save/remove of a known account.
 */
export function accountTransport({ request = null, enabled = false, gate = () => false } = {}) {
  const available = () => !!(enabled && request && gate());
  const head = (cred) => ({ "x-cyra-account": cred.lookup, authorization: `Bearer ${cred.token}` });
  const send = async (init, path = "/api/backup/account") => {
    try { return await request(path, init, { timeoutMs: 30000 }); }
    catch (e) { throw e && e.code ? e : E("OFFLINE"); }
  };
  const status = async (r, notFound) => {
    if (r.status === 404) throw E(notFound);
    if (r.status === 409) { let j = {}; try { j = await r.json(); } catch { /* no body */ } throw E("CONFLICT", { version: j.version, updatedAt: j.updatedAt }); }
    if (r.status === 429) throw E("BUSY");
    if (r.status === 507) throw E("FULL");
    if (r.status === 413) throw E("TOO_LARGE");
    throw E("SERVER", { status: r.status });
  };
  const guard = (cred) => { if (!available()) throw E("CLOUD_OFF"); if (!okCred(cred)) throw E("NO_ACCOUNT"); };
  return {
    kind: "account",
    available,
    async meta(cred) {
      guard(cred);
      const r = await send({ method: "GET", headers: head(cred) }, "/api/backup/account/meta");
      if (r.status !== 200) return status(r, "NO_ACCOUNT");
      return r.json();
    },
    async load(cred) {
      guard(cred);
      const r = await send({ method: "GET", headers: head(cred) });
      if (r.status !== 200) return status(r, "NO_ACCOUNT");
      let envelope = null;
      try { envelope = JSON.parse(new TextDecoder().decode(await r.arrayBuffer())); } catch { /* not JSON */ }
      if (!isEnvelope(envelope)) throw E("NOT_ENCRYPTED");
      return { envelope, version: Number(r.headers.get("x-cyra-version")) || null, updatedAt: r.headers.get("x-cyra-updated") || null };
    },
    async save(envelope, cred, base = "new") {
      guard(cred);
      if (!isEnvelope(envelope)) throw E("NOT_ENCRYPTED");
      const body = enc.encode(JSON.stringify(envelope));
      if (body.byteLength > CLOUD_MAX_BYTES) throw E("TOO_LARGE");
      const r = await send({ method: "PUT", headers: { ...head(cred), "content-type": "application/octet-stream", "x-cyra-base": String(base) }, body });
      if (r.status !== 200 && r.status !== 201) return status(r, base === "new" ? "SERVER" : "GONE");
      return r.json();
    },
    async remove(cred) {
      guard(cred);
      const r = await send({ method: "DELETE", headers: head(cred) });
      if (r.status !== 200) return status(r, "GONE");
      return true;
    },
  };
}

/* ---------- what this device keeps (record key cloudAccount: DEVICE_ONLY and NOT_IN_BACKUP) ----------
   { rev, acct } with acct = null (a guest) or { email, lookup, token, salt, key, version, at, since }:
   email (shown as "Signed in as …"), the lookup and write token above, the backup key from backup.js backupKey (salt +
   key, so this device can back up after each change without asking for the passphrase; never the passphrase),
   version (the server's version this device last wrote or restored), at (ISO time of that), since (signed in) and sum
   (a short checksum of what that back-up held, contentSum, so a launch with nothing new to back up only asks the server
   for its version instead of uploading again).
   rev grows with every change so that, across a browser's tabs, the newest state wins (mergeCloudAccount). */
export const NO_ACCOUNT = Object.freeze({ rev: 0, acct: null });
const ISO_RE = /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/;
const B64_RE = /^[A-Za-z0-9+/]+={0,2}$/;
export function cleanCloudAccount(v) {
  if (!v || typeof v !== "object" || Array.isArray(v)) return NO_ACCOUNT;
  const rev = Number.isInteger(v.rev) && v.rev >= 0 ? v.rev : 0;
  const a = v.acct;
  const ok = !!a && typeof a === "object" && isEmail(a.email) && KEY_RE.test(String(a.lookup)) && KEY_RE.test(String(a.token))
    && typeof a.salt === "string" && B64_RE.test(a.salt) && typeof a.key === "string" && B64_RE.test(a.key);
  if (!ok) return rev ? { rev, acct: null } : NO_ACCOUNT;
  return { rev, acct: { email: normEmail(a.email), lookup: a.lookup, token: a.token, salt: a.salt, key: a.key,
    version: Number.isInteger(a.version) && a.version > 0 ? a.version : null,
    at: typeof a.at === "string" && ISO_RE.test(a.at) ? a.at : null, since: typeof a.since === "string" && ISO_RE.test(a.since) ? a.since : null,
    sum: typeof a.sum === "string" && /^[0-9a-f]{8}$/.test(a.sum) ? a.sum : null } };
}
/** A short FNV-1a checksum (8 hex digits) of a string: tells "the same as the last back-up" apart, nothing more. */
export const contentSum = (str) => { let h = 0x811c9dc5; const t = String(str); for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, "0"); };
/** The newer of this tab's state and the stored one (higher rev; a tie keeps `mine`). */
export const mergeCloudAccount = (mine, stored) => { const a = cleanCloudAccount(mine), b = cleanCloudAccount(stored); return b.rev > a.rev ? b : a; };
/** The next state: `acct` (or null) with rev + 1. */
export const nextCloudAccount = (cur, acct) => ({ rev: cleanCloudAccount(cur).rev + 1, acct: acct ?? null });

/* ---------- every sentence the account shows (You → Account, its sheets, the splash sign-in) ---------- */
export const ACCOUNT_COPY = Object.freeze({
  eyebrow: "Account",
  guestTitle: "No account needed",
  guestLine: "You're using Heard Health as a guest. Your log lives on this device.",
  guestMore: "An account is optional. It keeps an encrypted copy of your log on Heard Health's server, so you can bring it back on a new phone or browser. Heard Health can't read it.",
  proLine: "An encrypted backup to Heard Health's server comes with Pro.",
  create: "Create an account",
  signIn: "Sign in",
  signInSplash: "Sign in to restore from your account",
  createTitle: "Create an account",
  signInTitle: "Sign in",
  createLead: "Your account is your email and a passphrase only you know. Both are turned into keys on this device; Heard Health's server never sees either.",
  holdsLab: "What Heard Health's server keeps",
  holds: Object.freeze([
    "Your log, encrypted on this device before it's sent. Heard Health can't read it.",
    "A one-way hash of your email, used only to find your backup. Never your email itself, so Heard Health never emails you.",
    "A key made from your passphrase that lets your devices replace or delete the backup. Never the passphrase.",
    "When it was last backed up and its size. It's deleted a year after the last back-up.",
  ]),
  lost: "If you lose your passphrase, nobody can recover it or your backup — not Heard Health, and not you. Write it down somewhere safe.",
  understand: "I understand a lost passphrase can't be recovered",
  deviceKeeps: "While you're signed in, this device keeps a key made from your passphrase (not the passphrase) so it can back up after each change. Signing out removes it.",
  emailLab: "Email",
  passLab: "Passphrase",
  pass2Lab: "Repeat it",
  createGo: "Create account and back up",
  createBusy: "Locking your backup…",
  signInLead: "Use the email and passphrase you chose. Your backup is opened on this device.",
  signInGo: "Sign in",
  signInBusy: "Opening your backup…",
  title: "Your account",
  signedIn: (email) => `Signed in as ${email}.`,
  auto: "Heard Health backs up a few seconds after each change while you're signed in, encrypted on this device first.",
  backupNow: "Back up now",
  backingUp: "Backing up…",
  signOut: "Sign out",
  deleteAcct: "Delete account",
  deleteQ: "Delete your account?",
  deleteBody: "Your encrypted backup is deleted from Heard Health's server now. Your log stays on this device.",
  deleteGo: "Delete account",
  cancel: "Cancel",
  conflictHead: "The backup is newer",
  conflictBody: "Your account's backup was changed after this device last backed up, maybe from another phone or browser.",
  localHead: "This device already has a log",
  localBody: "Your account has a backup too. Choose which one to keep; the other is replaced.",
  useBackup: "Use the backup",
  useBackupHint: "Replaces this device's log with the backup.",
  keepDevice: "Keep this device's log",
  keepDeviceHint: "Replaces the backup with this device's log.",
  toastCreated: "Account created and backed up. Keep your passphrase somewhere safe; Heard Health can't recover it.",
  toastBacked: "Backed up to your account",
  toastRestored: "Restored from your account",
  toastSignedIn: "Signed in. This device will back up after each change.",
  toastSignedOut: "Signed out. Your log stays on this device, and your encrypted backup stays on Heard Health's server.",
  toastDeleted: "Account deleted. Your log is still on this device.",
  errEmail: "Enter your email",
  errShort: "Use a passphrase of at least 8 characters",
  errMatch: "The two passphrases don't match",
  errAgree: "Tick the box to show you understand a lost passphrase can't be recovered",
  exists: "There's already an account with this email and passphrase. Sign in to use it.",
  waiting: "Waiting for a connection to back up.",
  failed: "Couldn't back up just now. Heard Health will try again after your next change.",
});
