/* The one place the app talks to its backend. The base URL is public config
   (VITE_API_BASE, set at build time); there are no secrets in this bundle.
   Every call is a short JSON POST with a timeout; callers keep a deterministic
   fallback so the app never breaks offline. */
export const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/$/, "");

export async function apiPost(path, body, { timeoutMs = 15000, method = "POST" } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(`${API_BASE}${path}`, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: ctrl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(timer);
  }
}
