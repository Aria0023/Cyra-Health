/* Downloading the live promotions (docs/plans/portal-subscriptions.md Task 3): one plain GET to
   <VITE_API_BASE>/api/promotions/active with nothing about her: no query, no header of ours, no cookie (credentials
   "omit"), no referrer. The same list goes to everyone; whether one is for her is decided on the device (lib/promos.js).
   The answer is cleaned before anything uses it. Promotions come from the partner portal, which ships with the shop flag
   (lib/features.js FEATURE_ALSO.shop: portal, subscriptions). */
import { apiFetch, hasServer } from "./api.js";
import { cleanPromos } from "./promos.js";
import { FEATURES } from "./features.js";

/** This build downloads promotions: it has a server and the shop flag (the partner portal's modules). */
export const PROMOS_LIVE = !!FEATURES.shop && hasServer();

/** → { ok: true, list } (clean; possibly empty), { ok: false, invalid: true } or { ok: false } (offline, error). Never throws. */
export async function fetchPromos() {
  if (!hasServer()) return { ok: false };
  try {
    const r = await apiFetch("/api/promotions/active", { method: "GET", credentials: "omit", referrerPolicy: "no-referrer" }, { timeoutMs: 15000 });
    if (!r.ok) return { ok: false };
    let raw;
    try { raw = await r.json(); } catch { return { ok: false, invalid: true }; }
    const list = cleanPromos(raw);
    return list ? { ok: true, list } : { ok: false, invalid: true };
  } catch { return { ok: false }; }
}
