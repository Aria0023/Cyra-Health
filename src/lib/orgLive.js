/* Joining and leaving an organization (lib/org.js): the only requests the org parts make, each on her tap (or on opening a
   ?org= link, which asks for that organization's public config and nothing else). Join sends only { slug } or { code };
   the sign-in token goes with it only when she is signed in, so her account notes which organization it joined. */
import { apiFetch, hasServer } from "./api.js";
import { cleanOrgConfig } from "./org.js";

const post = (path, body, token) => apiFetch(path, { method: "POST", credentials: "omit", referrerPolicy: "no-referrer", headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) }, { timeoutMs: 15000 });

/** The public config of ?org=<slug> (nothing is counted) → { ok, cfg } | { ok: false, why: "unknown" | "offline" | "server" }. */
export async function peekOrg(slug) {
  if (!hasServer()) return { ok: false, why: "server" };
  try {
    const r = await apiFetch(`/api/orgs/${encodeURIComponent(slug)}/config`, { method: "GET", credentials: "omit", referrerPolicy: "no-referrer" });
    if (r.status === 404) return { ok: false, why: "unknown" };
    if (!r.ok) return { ok: false, why: "offline" };
    const cfg = cleanOrgConfig(await r.json().catch(() => null));
    return cfg ? { ok: true, cfg } : { ok: false, why: "unknown" };
  } catch { return { ok: false, why: "offline" }; }
}

/** Joins by { slug } or { code } → { ok, cfg } | { ok: false, why: "code" | "unknown" | "offline" | "server" }. */
export async function joinOrg(what, token = null) {
  if (!hasServer()) return { ok: false, why: "server" };
  try {
    const r = await post("/api/orgs/join", what, token);
    if (r.status === 404) return { ok: false, why: what.code != null ? "code" : "unknown" };
    if (!r.ok) return { ok: false, why: "offline" };
    const cfg = cleanOrgConfig((await r.json().catch(() => null))?.org);
    return cfg ? { ok: true, cfg } : { ok: false, why: "unknown" };
  } catch { return { ok: false, why: "offline" }; }
}

/** Tells the server to forget the organization on her account; only when signed in (otherwise nothing is sent). */
export async function leaveOrg(token = null) {
  if (!hasServer() || !token) return { ok: true };
  try { const r = await post("/api/orgs/leave", {}, token); return { ok: r.ok }; } catch { return { ok: false }; }
}
