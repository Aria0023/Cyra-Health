/* Downloading the published Shop catalog (docs/plans/partner-portal.md Task 3): one plain GET to
   <VITE_API_BASE>/api/shop/catalog with nothing about her: no query, no header of ours, no cookie (credentials "omit"),
   no referrer. The browser's own HTTP cache revalidates it with the server's ETag. The answer is cleaned
   (lib/shopCatalog.js) before anything uses it. */
import { apiFetch, hasServer } from "./api.js";
import { cleanCatalog } from "./shopCatalog.js";
import { FEATURES } from "./features.js";

/** This build downloads the published catalog: it has a server and the shop flag. */
export const SHOP_LIVE = !!FEATURES.shop && hasServer();

/** → { ok: true, data } (a clean catalog), { ok: false, invalid: true } (the server answered something unusable) or
    { ok: false } (no server, offline, or an error status). Never throws. */
export async function fetchShopCatalog() {
  if (!hasServer()) return { ok: false };
  try {
    const r = await apiFetch("/api/shop/catalog", { method: "GET", credentials: "omit", referrerPolicy: "no-referrer" }, { timeoutMs: 15000 });
    if (!r.ok) return { ok: false };
    let raw;
    try { raw = await r.json(); } catch { return { ok: false, invalid: true }; }
    const data = cleanCatalog(raw);
    return data ? { ok: true, data } : { ok: false, invalid: true };
  } catch { return { ok: false }; }
}
