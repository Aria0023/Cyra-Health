/* Encrypted backup: a file the user keeps, locked with a passphrase only she
   knows. PBKDF2-SHA256 (600,000 rounds, random salt) derives an AES-256-GCM key;
   the envelope carries only a format tag and the parameters needed to decrypt (the
   file name, cyra-backup-<date>.cyra.json, shows the day it was made). Encryption and
   decryption happen on this device: the crypto here makes no network call, Cyra never
   sends the backup's contents or the passphrase to any server, and the passphrase is
   never saved. Restoring re-applies saved settings, so a restored wearable connection
   (or, on the phone, reminders) works again the way it normally does; in a browser,
   restored reminders stay off until she turns them on (App.jsx importBackup). Where
   the encrypted file goes afterwards (Files, iCloud, Drive, downloads…) is the
   user's choice.

   Transports (local-first L4) move an envelope that is ALREADY encrypted; they never see the
   passphrase or the plaintext. fileTransport is today's behaviour, unchanged: a download in a
   browser, the share sheet on a phone. cloudTransport is a scaffold for the optional encrypted
   cloud backup (owner decision D3): it is fail-closed by default (unavailable unless it is given a
   request function, enabled AND its gate says yes), refuses anything that isn't an envelope before
   any request, and is wired up in ./cloudBackup.js behind plan.can("cloudBackup") and the
   cloudBackup build flag, both off; nothing imports that file yet, so no build can reach it.
   This module has NO imports: the POTS suites load it straight from Node, so its I/O (Capacitor
   plugins, the DOM, apiFetch) is passed in. */
const subtle = globalThis.crypto.subtle;
const enc = new TextEncoder(), dec = new TextDecoder();
// In 32 KB slices: spreading a whole record as call arguments overflows the engine's argument
// limit (about 65,536 in Safari / the iPhone app) once months of entries are saved.
const b64 = (buf) => { const u = new Uint8Array(buf); let s = ""; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
export const ITERATIONS = 600_000;
/** "At least 8 characters", counted the way a person counts them: after the same NFKC
    normalization the key derivation uses, by code point (an emoji is one, not two). */
export const passphraseLength = (p) => [...String(p ?? "").normalize("NFKC")].length;
export const isLongEnough = (p) => typeof p === "string" && passphraseLength(p) >= 8;

async function deriveKey(passphrase, salt, iterations) {
  const base = await subtle.importKey("raw", enc.encode(passphrase.normalize("NFKC")), "PBKDF2", false, ["deriveKey"]);
  return subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

/** state (plain object) + passphrase → envelope (plain object, safe to write to a file). */
export async function encryptBackup(state, passphrase) {
  if (!isLongEnough(passphrase)) throw new Error("Use a passphrase of at least 8 characters");
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt, ITERATIONS);
  const ct = await subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(JSON.stringify(state)));
  return { format: "cyra-backup", v: 1, kdf: "PBKDF2-SHA256", iter: ITERATIONS, cipher: "AES-256-GCM", salt: b64(salt), iv: b64(iv), ct: b64(ct) };
}

/** envelope + passphrase → state. Throws a plain-language error on a wrong passphrase or a damaged file. */
export async function decryptBackup(envelope, passphrase) {
  if (!envelope || envelope.format !== "cyra-backup" || envelope.v !== 1) throw new Error("That file isn't a Cyra backup");
  const key = await deriveKey(String(passphrase || ""), unb64(envelope.salt), envelope.iter || ITERATIONS);
  try {
    const pt = await subtle.decrypt({ name: "AES-GCM", iv: unb64(envelope.iv) }, key, unb64(envelope.ct));
    return JSON.parse(dec.decode(pt));
  } catch {
    throw new Error("Wrong passphrase, or the file is damaged");
  }
}

/** The backup file's name: cyra-backup-<local day>.cyra.json (only the day it was made). */
export const backupFileName = (iso) => `cyra-backup-${iso}.cyra.json`;

/** true for an encrypted backup envelope (what encryptBackup returns), false for anything else. */
export const isEnvelope = (x) => !!x && typeof x === "object" && x.format === "cyra-backup" && x.v === 1
  && [x.salt, x.iv, x.ct].every((s) => typeof s === "string" && s.length > 0);

/**
 * The file transport: today's export and restore, moved here unchanged.
 * io = { isNative: () => boolean, Filesystem, Directory, Encoding, Share, doc?, URL?, Blob?, later? }
 * (doc, URL, Blob and later default to the browser's document, URL, Blob and setTimeout).
 */
export function fileTransport(io) {
  return {
    kind: "file",
    available: () => true,
    /** Hands the envelope over as a file. Resolves false when she cancels the phone's share sheet. */
    async save(envelope, { name } = {}) {
      if (io.isNative()) {
        // Phone: the already-encrypted file goes to the app's cache while the share sheet
        // (Save to Files, Drive, AirDrop…) is in use and is deleted as soon as Cyra hears back
        // from it (on iPhone when the sheet or the chosen action closes; on Android when she
        // returns to Cyra from the app she chose). A copy left behind by an interrupted share
        // (app closed or killed mid-share) is deleted at the next launch (App.jsx sweepBackupCache)
        // or by Delete everything. Where it goes is her choice; its contents are unreadable
        // without the passphrase (the file name shows only the date it was made).
        const { Filesystem, Directory, Encoding, Share } = io;
        let uri;
        try { ({ uri } = await Filesystem.writeFile({ path: name, data: JSON.stringify(envelope), directory: Directory.Cache, encoding: Encoding.UTF8 })); }
        catch { throw new Error("Couldn't prepare the backup file on this phone"); }
        try { await Share.share({ title: "Cyra encrypted backup", files: [uri] }); }
        catch (e) {
          const m = String(e?.message || e);
          if (/cancel/i.test(m)) return false;
          if (/must provide|in progress/i.test(m)) throw new Error("Couldn't open the share sheet on this phone");
          throw new Error("Sharing didn't finish — the backup may not have reached where you sent it. Anything that did is still encrypted.");
        }
        finally { await Filesystem.deleteFile({ path: name, directory: Directory.Cache }).catch(() => { /* already gone */ }); }
        return true;
      }
      const doc = io.doc || globalThis.document, U = io.URL || globalThis.URL, B = io.Blob || globalThis.Blob;
      const later = io.later || ((fn, ms) => setTimeout(fn, ms));
      const blob = new B([JSON.stringify(envelope)], { type: "application/json" });
      const a = doc.createElement("a"); a.href = U.createObjectURL(blob); a.download = name; doc.body.appendChild(a); a.click(); a.remove();
      later(() => U.revokeObjectURL(a.href), 2000);
      return true;
    },
    /** A chosen file → its parsed contents (decryptBackup checks it is a Cyra backup). */
    async load(file) {
      try { return JSON.parse(await file.text()); } catch { throw new Error("That file isn't a Cyra backup"); }
    },
  };
}

/** The most a cloud backup may hold (the backend module's default maxBytes). */
export const CLOUD_MAX_BYTES = 4 * 1024 * 1024;
const ID_RE = /^[A-Za-z0-9_-]{22}$/, TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;
const fail = (code, message, extra = {}) => Promise.reject(Object.assign(new Error(message), { code, ...extra }));
const CLOUD_OFF = ["CLOUD_OFF", "Encrypted cloud backup isn't available in this version of Cyra"];
const NOT_ENCRYPTED = ["NOT_ENCRYPTED", "Only an encrypted backup can be uploaded"];
const GONE = ["GONE", "That cloud backup is gone or the code is wrong"];

/**
 * The cloud transport (scaffold, D3). request = apiFetch-shaped (path, init, { timeoutMs }) → Response.
 * Unavailable — every method rejects with code CLOUD_OFF before any request — unless enabled, request
 * and gate() all say yes. Only an envelope goes up, as opaque application/octet-stream bytes; the
 * server keeps them under a random id and only a hash of the write token, and never decrypts them.
 * ref = { id, token } (the token comes back once, from the first save; the caller keeps it on the device).
 */
export function cloudTransport({ request = null, enabled = false, gate = () => false } = {}) {
  const available = () => !!(enabled && request && gate());
  const bodyOf = (envelope) => new TextEncoder().encode(JSON.stringify(envelope));
  const okRef = (ref) => !!ref && typeof ref.id === "string" && ID_RE.test(ref.id) && typeof ref.token === "string" && TOKEN_RE.test(ref.token);
  const bearer = (ref) => ({ authorization: `Bearer ${ref.token}` });
  const statusError = (r) => (r.status === 404 ? fail(...GONE) : fail("SERVER", `Cyra's server couldn't keep the backup (HTTP ${r.status})`, { status: r.status }));
  const send = (path, init) => request(path, init, { timeoutMs: 30000 });
  return {
    kind: "cloud",
    available,
    async save(envelope, { ref } = {}) {
      if (!available()) return fail(...CLOUD_OFF);
      if (!isEnvelope(envelope)) return fail(...NOT_ENCRYPTED);
      const body = bodyOf(envelope);
      if (body.byteLength > CLOUD_MAX_BYTES) return fail("TOO_LARGE", "This backup is too large for cloud backup");
      if (ref !== undefined && !okRef(ref)) return fail(...GONE);
      const headers = { "content-type": "application/octet-stream", ...(ref ? bearer(ref) : {}) };
      const r = await send(ref ? `/api/backup/${ref.id}` : "/api/backup", { method: ref ? "PUT" : "POST", headers, body });
      if (r.status !== (ref ? 200 : 201)) return statusError(r);
      const j = await r.json();
      return ref ? { id: ref.id, expiresAt: j.expiresAt } : { id: j.id, token: j.token, expiresAt: j.expiresAt };
    },
    async load(ref) {
      if (!available()) return fail(...CLOUD_OFF);
      if (!okRef(ref)) return fail(...GONE);
      const r = await send(`/api/backup/${ref.id}`, { method: "GET", headers: bearer(ref) });
      if (r.status !== 200) return statusError(r);
      let env = null;
      try { env = JSON.parse(new TextDecoder().decode(await r.arrayBuffer())); } catch { /* not JSON */ }
      if (!isEnvelope(env)) return fail("NOT_ENCRYPTED", "That cloud backup isn't an encrypted Cyra backup");
      return env;
    },
    async remove(ref) {
      if (!available()) return fail(...CLOUD_OFF);
      if (!okRef(ref)) return fail(...GONE);
      const r = await send(`/api/backup/${ref.id}`, { method: "DELETE", headers: bearer(ref) });
      if (r.status !== 200) return statusError(r);
      return true;
    },
  };
}
