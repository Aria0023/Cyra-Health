/* The one place the app talks to its backend. The base URL is public config
   (VITE_API_BASE, set at build time); there are no secrets in this bundle.
   Every call is a short JSON request with a timeout; callers keep a deterministic
   fallback so the app never breaks offline.
   A build without VITE_API_BASE has no backend at all: every helper here fails
   at once with a "no server" error and never calls fetch. */
export const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/$/, "");
/** true when this build was given a backend (VITE_API_BASE). */
export const hasServer = () => !!API_BASE;

/** Thrown before any request when the build has no backend. */
export class NoServerError extends Error {
  constructor() { super("no server"); this.name = "NoServerError"; this.noServer = true; }
}
export function needServer() { if (!API_BASE) throw new NoServerError(); }

/* Errors carry what happened, so callers can word the message truthfully:
     e.status  — the server answered with this non-OK HTTP status (message "HTTP <status>")
     e.network — no answer at all (offline, DNS, CORS, or the timeout below)          */
export async function apiFetch(path, init = {}, { timeoutMs = 15000 } = {}) {
  needServer();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    let r;
    try { r = await fetch(`${API_BASE}${path}`, { ...init, signal: ctrl.signal }); }
    catch (e) { throw Object.assign(new Error(e?.name === "AbortError" ? "timeout" : "network"), { network: true }); }
    return r;
  } finally {
    clearTimeout(timer);
  }
}

export async function apiPost(path, body, { timeoutMs = 15000, method = "POST" } = {}) {
  const r = await apiFetch(path, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) }, { timeoutMs });
  if (!r.ok) throw Object.assign(new Error(`HTTP ${r.status}`), { status: r.status });
  return r.json();
}
