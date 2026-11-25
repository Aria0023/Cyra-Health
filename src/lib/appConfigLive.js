/* Downloading the owner's app settings (lib/appConfig.js): one plain GET to <VITE_API_BASE>/api/app-config with nothing
   about her: no query, no header of ours, no cookie (credentials "omit"), no referrer. The answer is cleaned before use. */
import { apiFetch, hasServer } from "./api.js";
import { cleanAppConfig } from "./appConfig.js";

/** → { ok: true, cfg } | { ok: false, invalid: true } (the server answered something unusable) | { ok: false } (no server,
    offline, an error status). One plain GET with nothing about her. Never throws. */
export async function fetchAppConfig() {
  if (!hasServer()) return { ok: false };
  try {
    const r = await apiFetch("/api/app-config", { method: "GET", credentials: "omit", referrerPolicy: "no-referrer" }, { timeoutMs: 10000 });
    if (!r.ok) return { ok: false };
    let raw;
    try { raw = await r.json(); } catch { return { ok: false, invalid: true }; }
    const cfg = cleanAppConfig(raw);
    return cfg ? { ok: true, cfg } : { ok: false, invalid: true };
  } catch { return { ok: false }; }
}

