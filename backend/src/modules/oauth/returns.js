// Where a sign-in or connect flow may send the person back to, and the app-link
// verifier that makes a one-time handoff code useless to anyone but the install
// that asked for it. Shared by the oauth and integrations modules.
//
// Return URLs:
//   http(s)  — the origin must be in RETURN_ORIGINS (comma list). Unset = the http(s)
//              entries of CORS_ORIGIN. The phone apps' own web-view origins
//              (https://localhost, http://localhost) are never web returns, even when
//              CORS_ORIGIN lists them. "*" or an empty list means any origin, except with
//              NODE_ENV=production, where it means none (fail closed).
//   app link — exactly <scheme>://auth/<flow>, optionally ?a=<attempt id>, where the
//              scheme is written in lowercase and listed in APP_RETURN_SCHEMES (comma
//              list, default "cyrahealth") and <flow> is one the calling endpoint serves
//              (oauth | oura | terra). The attempt id lets the app tell this attempt's
//              link from a stale one. Nothing else is accepted: no fragment ('#'), no
//              other host, path or query, no upper-case scheme.
//   Anything else (javascript:, data:, file:, intent:, unknown schemes, other hosts or
//   paths under the app scheme) is refused, and the schemes in NEVER can't be enabled
//   through APP_RETURN_SCHEMES either. (A web return's own #fragment is dropped; an app
//   return with any '#' is refused.)
//
// App-link verifier: a custom URL scheme can be claimed by another installed app,
// which would then see the one-time code in cyrahealth://auth/...#oauth=<code>. So
// the app sends app_challenge = base64url(SHA-256(verifier)) on the start URL, the
// challenge travels inside the signed state and is stored with the handoff, and
// the exchange only answers when the matching verifier comes with the code. It works
// both ways: a code minted without a challenge (a web flow) is refused when a
// verifier is sent, so a web code can't be slipped into the app (see codeRedeemable).
import crypto from "crypto";

const env = (k) => (process.env[k] || "").trim();
const NEVER = new Set(["javascript", "vbscript", "data", "file", "blob", "about", "filesystem", "intent", "content", "http", "https", "ws", "wss", "ftp", "mailto", "tel", "sms"]);
const WEBVIEW_ORIGINS = new Set(["https://localhost", "http://localhost"]); // Capacitor Android (and http-scheme) web views
const APP_LINK = /^([A-Za-z][A-Za-z0-9+.-]*):\/\/auth\/([a-z]+)(\?a=[A-Za-z0-9_-]{16,64})?$/;

export function appSchemes() {
  return (env("APP_RETURN_SCHEMES") || "cyrahealth").split(",").map((s) => s.trim().toLowerCase()).filter((s) => /^[a-z][a-z0-9+.-]*$/.test(s) && !NEVER.has(s));
}

/** The http(s) origins a web flow may return to; ["*"] = any, [] = none. */
export function returnOrigins() {
  const raw = (env("RETURN_ORIGINS") || env("CORS_ORIGIN")).split(",").map((s) => s.trim()).filter(Boolean);
  const list = raw.filter((s) => s === "*" || (/^https?:\/\//i.test(s) && !WEBVIEW_ORIGINS.has(s.toLowerCase().replace(/\/$/, ""))));
  const wildcard = raw.length === 0 || list.includes("*");
  if (wildcard) return env("NODE_ENV") === "production" ? [] : ["*"];
  return list;
}

/** Normalized return URL (no fragment) and whether it is an app link, or null when not allowed.
    `flows` limits app links to the flows the calling endpoint serves. */
export function checkReturn(url, { flows = [] } = {}) {
  const text = String(url || "");
  const app = APP_LINK.exec(text); // anchored, and its character classes admit no '#'
  if (app) {
    const scheme = app[1];
    if (scheme !== scheme.toLowerCase() || !appSchemes().includes(scheme) || !flows.includes(app[2])) return null;
    return { href: text, app: true };
  }
  let u; try { u = new URL(text); } catch { return null; }
  if (u.username || u.password) return null;
  if (u.protocol !== "http:" && u.protocol !== "https:") return null; // every other scheme, and app links in any other shape
  u.hash = "";
  if (WEBVIEW_ORIGINS.has(u.origin)) return null;
  const list = returnOrigins();
  return list.includes("*") || list.includes(u.origin) ? { href: u.href, app: false } : null;
}
export const isAppReturn = (href) => !/^https?:\/\//i.test(String(href || ""));

const CHALLENGE = /^[A-Za-z0-9_-]{43}$/; // base64url SHA-256, no padding
const VERIFIER = /^[A-Za-z0-9_-]{43,128}$/;

/** The start request's app_challenge: required for app links, refused for web returns. */
export function startChallenge(ret, raw) {
  const c = raw == null || raw === "" ? null : String(raw);
  if (c !== null && !CHALLENGE.test(c)) return { error: "app_challenge must be base64url(SHA-256(verifier)), 43 characters" };
  if (ret.app && !c) return { error: "app return links need an app_challenge" };
  if (!ret.app && c) return { error: "app_challenge is only for app return links" };
  return { challenge: c };
}

/** True when SHA-256(verifier), base64url, equals the challenge bound at start. */
export function verifierMatches(challenge, verifier) {
  const v = String(verifier || "");
  if (!VERIFIER.test(v) || !CHALLENGE.test(String(challenge || ""))) return false;
  const a = Buffer.from(crypto.createHash("sha256").update(v).digest("base64url")), b = Buffer.from(String(challenge));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Both or neither: a code bound to a challenge needs its verifier, and a code bound to
    none (web flow) is refused when a verifier comes with it — the app always sends one,
    so a web-minted code injected into the app's link can't be redeemed there. */
export function codeRedeemable(handoff, verifier) {
  if (!handoff) return false;
  const sent = verifier != null && verifier !== "";
  return handoff.ac ? verifierMatches(handoff.ac, verifier) : !sent;
}
