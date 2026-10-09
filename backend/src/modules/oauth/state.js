// Sealed `state` for sign-in and wearable-connect redirects. The state travels through
// the provider (Apple, Google, Facebook, Oura, Terra), the browser's address bar and
// any request log, so it is encrypted, not just signed: AES-256-GCM with a key derived
// from AUTH_SECRET (HKDF-SHA256). Nobody along the way can read the PKCE verifier (which only the
// server uses, server-to-server at the provider's token endpoint), or
// read or alter anything else inside it (the nonce is also sent to the provider in the
// clear, and the return URL and app challenge also appear in the /start query). Each flow binds its
// own purpose ("oauth", "oura", "terra") as associated data, so a state minted for one
// flow can't be replayed in another. Every state carries `exp` and is refused after it.
//   token = base64url( iv[12] | ciphertext | tag[16] )
import crypto from "crypto";

const TOKEN = /^[A-Za-z0-9_-]{40,4096}$/;

/** The 32-byte AES key for `secret` (AUTH_SECRET). */
export function stateKey(secret) {
  if (!secret) throw new Error("AUTH_SECRET is required for sign-in and connect flows");
  return Buffer.from(crypto.hkdfSync("sha256", Buffer.from(String(secret), "utf8"), Buffer.from("cyra-state-v1"), Buffer.from("aes-256-gcm redirect state"), 32));
}

export function sealState(payload, key, purpose) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", key, iv);
  c.setAAD(Buffer.from(`cyra:${purpose}`));
  const ct = Buffer.concat([c.update(JSON.stringify(payload), "utf8"), c.final()]);
  return Buffer.concat([iv, ct, c.getAuthTag()]).toString("base64url");
}

/** The payload, or null when the token is malformed, tampered with, for another purpose, or expired. */
export function openState(token, key, purpose) {
  const t = String(token || "");
  if (!TOKEN.test(t)) return null;
  try {
    const buf = Buffer.from(t, "base64url");
    if (buf.length < 12 + 16 + 2) return null;
    const d = crypto.createDecipheriv("aes-256-gcm", key, buf.subarray(0, 12));
    d.setAAD(Buffer.from(`cyra:${purpose}`));
    d.setAuthTag(buf.subarray(buf.length - 16));
    const p = JSON.parse(Buffer.concat([d.update(buf.subarray(12, buf.length - 16)), d.final()]).toString("utf8"));
    return p && typeof p.exp === "number" && p.exp > Date.now() ? p : null;
  } catch {
    return null;
  }
}
