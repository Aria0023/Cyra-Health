// Minimal JOSE helpers with node:crypto only — no new dependencies.
//   verifyIdToken: RS256 / ES256 id_token verification against a provider's JWKS
//   appleClientSecret: the ES256 JWT Apple requires in place of a static secret
import crypto from "crypto";

const b64u = (buf) => Buffer.from(buf).toString("base64url");
const fromB64u = (s) => Buffer.from(s, "base64url");

const jwksCache = new Map(); // url -> { keys, at }
async function fetchJwks(url) {
  const hit = jwksCache.get(url);
  if (hit && Date.now() - hit.at < 60 * 60_000) return hit.keys;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`jwks fetch failed: ${r.status}`);
  const { keys } = await r.json();
  jwksCache.set(url, { keys, at: Date.now() });
  return keys;
}

/** Verify a signed id_token. Returns the payload or throws. */
export async function verifyIdToken(token, { jwksUrl, issuer, audience, nonce }) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) throw new Error("id_token malformed");
  const header = JSON.parse(fromB64u(parts[0]).toString());
  const payload = JSON.parse(fromB64u(parts[1]).toString());
  let keys = await fetchJwks(jwksUrl);
  let jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) { jwksCache.delete(jwksUrl); keys = await fetchJwks(jwksUrl); jwk = keys.find((k) => k.kid === header.kid); }
  if (!jwk) throw new Error("id_token key not found");
  const key = crypto.createPublicKey({ key: jwk, format: "jwk" });
  const data = Buffer.from(`${parts[0]}.${parts[1]}`);
  const sig = fromB64u(parts[2]);
  let ok = false;
  if (header.alg === "RS256") ok = crypto.verify("RSA-SHA256", data, key, sig);
  else if (header.alg === "ES256") ok = crypto.verify("sha256", data, { key, dsaEncoding: "ieee-p1363" }, sig);
  else throw new Error(`id_token alg ${header.alg} not supported`);
  if (!ok) throw new Error("id_token signature invalid");
  const issuers = Array.isArray(issuer) ? issuer : [issuer];
  if (!issuers.includes(payload.iss)) throw new Error("id_token issuer mismatch");
  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!aud.includes(audience)) throw new Error("id_token audience mismatch");
  if (typeof payload.exp !== "number" || payload.exp * 1000 < Date.now() - 60_000) throw new Error("id_token expired");
  if (nonce && payload.nonce !== nonce) throw new Error("id_token nonce mismatch");
  return payload;
}

/** Apple's client_secret: ES256 JWT signed with the .p8 key from the developer portal. */
export function appleClientSecret({ teamId, clientId, keyId, privateKey }) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64u(JSON.stringify({ alg: "ES256", kid: keyId, typ: "JWT" }));
  const payload = b64u(JSON.stringify({ iss: teamId, iat: now, exp: now + 15 * 60, aud: "https://appleid.apple.com", sub: clientId }));
  const data = Buffer.from(`${header}.${payload}`);
  const sig = crypto.sign("sha256", data, { key: privateKey.replace(/\\n/g, "\n"), dsaEncoding: "ieee-p1363" });
  return `${header}.${payload}.${b64u(sig)}`;
}

/** PKCE helpers */
export const pkceVerifier = () => b64u(crypto.randomBytes(32));
export const pkceChallenge = (v) => b64u(crypto.createHash("sha256").update(v).digest());
