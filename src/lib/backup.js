/* Encrypted backup: a file the user keeps, locked with a passphrase only she
   knows. PBKDF2-SHA256 (600,000 rounds, random salt) derives an AES-256-GCM key;
   the envelope carries only the parameters needed to decrypt. No server is
   involved and the passphrase is never stored anywhere. */
const subtle = globalThis.crypto.subtle;
const enc = new TextEncoder(), dec = new TextDecoder();
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
export const ITERATIONS = 600_000;

async function deriveKey(passphrase, salt, iterations) {
  const base = await subtle.importKey("raw", enc.encode(passphrase.normalize("NFKC")), "PBKDF2", false, ["deriveKey"]);
  return subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

/** state (plain object) + passphrase → envelope (plain object, safe to write to a file). */
export async function encryptBackup(state, passphrase) {
  if (typeof passphrase !== "string" || passphrase.length < 8) throw new Error("Use a passphrase of at least 8 characters");
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt, ITERATIONS);
  const ct = await subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(JSON.stringify(state)));
  return { format: "cyra-backup", v: 1, kdf: "PBKDF2-SHA256", iter: ITERATIONS, cipher: "AES-256-GCM", salt: b64(salt), iv: b64(iv), ct: b64(ct), created: new Date().toISOString() };
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
