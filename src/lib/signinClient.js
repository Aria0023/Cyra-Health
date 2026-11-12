/* Requests for sign-in (lib/signin.js has the rules and the copy). Each one goes to Solia Health's own server
   (lib/api.js) and carries only what it names: an email address and a code, a provider's one-time code, or the
   session token. Never anything from her log. A build without a server fails at once (api.js NoServerError). */
import { apiFetch, apiPost } from "./api.js";

const json = async (r) => { try { return await r.json(); } catch { return null; } };
const fail = (r, body) => Object.assign(new Error(body?.error || `HTTP ${r.status}`), { status: r.status, why: body?.why || null });

/** { providers } | "offline". */
export async function accountsConfig() {
  try {
    const r = await apiFetch("/api/accounts/config", { method: "GET" }, { timeoutMs: 12000 });
    if (r.status === 404) return { providers: {} }; // a server without the accounts module: nothing to sign in to
    if (!r.ok) return "offline";
    const j = await json(r);
    return j && j.providers && typeof j.providers === "object" ? { providers: j.providers } : "offline";
  } catch { return "offline"; }
}

/** → { sent, dev } */
export const emailStart = (email) => apiPost("/api/accounts/email/start", { email: String(email || "").trim() }, { timeoutMs: 15000 });

/** → { token, account }; a wrong / expired / locked code throws with e.why. */
export async function emailVerify(email, code) {
  const r = await apiFetch("/api/accounts/email/verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: String(email || "").trim(), code }) }, { timeoutMs: 15000 });
  const j = await json(r);
  if (!r.ok) throw fail(r, j);
  return j;
}

/** The provider's one-time code (and, in the phone app, its verifier) → { token, account }. */
export const providerFinish = (code, verifier) => apiPost("/api/accounts/provider", verifier ? { code, verifier } : { code }, { timeoutMs: 15000 });

const bearer = (token) => ({ authorization: `Bearer ${token}` });
/** Ends this device's session. Resolves when the server confirms it (or says the session is already gone). */
export async function signOutServer(token) {
  const r = await apiFetch("/api/accounts/sign-out", { method: "POST", headers: bearer(token) }, { timeoutMs: 10000 });
  if (!r.ok && r.status !== 401) throw fail(r, await json(r));
}
/** Deletes the account. Resolves when the server confirms it, or says the token no longer names one (401: already gone). */
export async function deleteAccountServer(token, { timeoutMs = 10000 } = {}) {
  const r = await apiFetch("/api/accounts/me", { method: "DELETE", headers: bearer(token) }, { timeoutMs });
  if (!r.ok && r.status !== 401) throw fail(r, await json(r));
}
