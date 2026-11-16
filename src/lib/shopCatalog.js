/* The live Shop catalog (docs/plans/partner-portal.md Task 3). A build with a server (VITE_API_BASE) and the shop flag
   downloads the published catalog with one plain GET (GET /api/shop/catalog: no query, no id, no token, no cookie,
   nothing about her; like loading a web page), cleans every field here, keeps the clean copy on this device in the
   device-only record key shopCatalog (never in any backup), and falls back to the bundled catalog (lib/shop.js and
   src/config/*.json) when offline, unset or invalid. Matching to her stage and modules stays on the device (lib/shop.js
   shopCategories). Pure: no React, storage or network.

   One shape for the Shop page, whichever the source: { source: "live" | "bundled", items, brands } where an item is
   { id, category, also, brand, name, covers, description, why, tone, ev, sources, avail, stages, modules, kind,
     href, affiliate, price, image, art, reviewed }
   (art: the illustration drawn while there is no image, lib/shopArt.js; an unknown or missing one is the need's default)
   and brands maps a brand's name to { tag, about, mono, hue }. "Clinician reviewed" (reviewed) only where the server
   marks the item signed (live) or src/config/shop-reviewed.json lists it (bundled). The affiliate label only where an
   https affiliate URL exists. */
import {
  SHOP_ITEMS, SHOP_CATEGORIES, AVAIL_LABEL, TONE_LABEL, SHOP_HUE_IDS, BRANDS, monogram, brandHue, linkFor, priceFor, imageFor, isReviewed, itemSources,
} from "./shop.js";
import { cleanArt, artFor } from "./shopArt.js";

export const MAX_PRODUCTS = 300;
export const MAX_BRANDS = 120;
export const CATALOG_MAX_AGE_MS = 24 * 3_600_000; // the background refresh: at most once a day
const KINDS = ["rx", "supp", "habit", "program", "aid", "care"]; // lib/trying.js TRY_KINDS (shopCatalog.test.mjs checks)
const STAGES = ["periods", "ttc", "preg", "peri", "meno"];
const MODULES = ["pots", "pcos"];
const CATS = SHOP_CATEGORIES.map((c) => c.id);
const ID_RE = /^[a-z0-9][a-z0-9-]{0,47}$/;
const IMAGE_RE = /^[a-f0-9]{24}$/;
const PRICE_RE = /^(From |About )?[$£€]\d[\d.,]{0,8}( (a|per) (month|year|test|kit))?$/;
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k); // not Object.hasOwn: iOS 15.0 target
const CTRL = /[\u0000-\u001F\u007F‪-‮⁦-⁩]/g; // eslint-disable-line no-control-regex

/** Plain text: a string, control and bidi characters removed, whitespace collapsed, at most `max` characters, else "". */
export const text = (v, max) => {
  if (typeof v !== "string") return "";
  const s = v.replace(CTRL, " ").replace(/\s+/g, " ").trim();
  return s.length <= max ? s : "";
};
/** An https URL with a real host and no user:password, else "". */
export function httpsUrl(v) {
  if (typeof v !== "string" || v.length > 500 || !/^https:\/\//i.test(v.trim())) return "";
  try {
    const u = new URL(v.trim());
    if (u.protocol !== "https:" || u.username || u.password || !/\./.test(u.hostname) || /^\d+(\.\d+)+$/.test(u.hostname)) return "";
    return u.href;
  } catch { return ""; }
}
const ids = (v, known, max = known.length) => (Array.isArray(v) ? [...new Set(v.filter((x) => typeof x === "string" && known.includes(x)))].slice(0, max) : []);

/** The server's catalog → a clean copy, or null when it is unusable (not an object, or no product survives cleaning). */
export function cleanCatalog(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw) || !Array.isArray(raw.products) || !Array.isArray(raw.brands)) return null;
  const brands = [];
  for (const b of raw.brands.slice(0, MAX_BRANDS)) {
    if (!b || typeof b !== "object") continue;
    const id = typeof b.id === "string" && ID_RE.test(b.id) ? b.id : "";
    const name = text(b.name, 60);
    const website = httpsUrl(b.website);
    if (!id || !name || brands.some((x) => x.id === id || x.name === name)) continue;
    brands.push({
      id, name, website,
      monogram: typeof b.monogram === "string" && /^[A-Z0-9]{1,3}$/.test(b.monogram) ? b.monogram : monogram(name),
      hue: SHOP_HUE_IDS.includes(b.hue) ? b.hue : null,
      tag: text(b.tag, 30).toUpperCase(), about: text(b.about, 240),
    });
  }
  const products = [];
  for (const p of raw.products.slice(0, MAX_PRODUCTS)) {
    if (!p || typeof p !== "object") continue;
    const id = typeof p.id === "string" && ID_RE.test(p.id) ? p.id : "";
    const name = text(p.name, 90);
    const url = httpsUrl(p.url);
    const categories = ids(p.categories, CATS, 3);
    if (!id || !name || !url || !categories.length || !brands.some((b) => b.id === p.brandId) || products.some((x) => x.id === id)) continue;
    const ev = p.evidence && typeof p.evidence === "object" && has(TONE_LABEL, p.evidence.tone) && text(p.evidence.label, 80) ? { tone: p.evidence.tone, label: text(p.evidence.label, 80) } : null;
    products.push({
      id, brandId: p.brandId, name, url, categories,
      covers: text(p.covers, 140), description: text(p.description, 400), why: text(p.why, 240),
      availability: has(AVAIL_LABEL, p.availability) ? p.availability : "",
      price: typeof p.price === "string" && PRICE_RE.test(p.price.trim()) ? p.price.trim() : "",
      affiliateUrl: httpsUrl(p.affiliateUrl),
      imageId: typeof p.imageId === "string" && IMAGE_RE.test(p.imageId) ? p.imageId : null,
      stages: ids(p.stages, STAGES), modules: ids(p.modules, MODULES),
      kind: KINDS.includes(p.kind) ? p.kind : null,
      evidence: ev,
      sources: Array.isArray(p.sources) ? p.sources.slice(0, 6).map((s) => text(s, 300)).filter(Boolean) : [],
      clinicianStatus: p.clinicianStatus === "signed" ? "signed" : "awaiting",
      // 2026-11-16: a known illustration id only (lib/shopArt.js); an unknown or missing one is left out, so the page
      // draws the need's default, and a copy saved before this field existed still cleans to itself.
      ...(cleanArt(p.art) ? { art: cleanArt(p.art) } : {}),
    });
  }
  if (!products.length) return null;
  const used = new Set(products.map((p) => p.brandId));
  return { version: 1, updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt.slice(0, 40) : null, brands: brands.filter((b) => used.has(b.id)), products };
}

/** The device-only record value: null, or { at: ISO time of the download, data: a clean catalog }. */
export function cleanShopCatalog(v) {
  if (!v || typeof v !== "object" || typeof v.at !== "string" || Number.isNaN(Date.parse(v.at))) return null;
  const data = cleanCatalog(v.data);
  return data ? { at: v.at, data } : null;
}
/** Whether the background refresh may run: no copy yet, or the last download is a day old. */
export const catalogDue = (rec, now = Date.now()) => !rec || !(now - Date.parse(rec.at) < CATALOG_MAX_AGE_MS);

/** The bundled catalog in the page's shape. */
export function bundledShop({ affiliates = {}, images = {}, signed = [] } = {}) {
  const items = SHOP_ITEMS.map((i) => {
    const link = linkFor(i, affiliates);
    const img = imageFor(i, images);
    return {
      id: i.id, category: i.category, also: [...(i.also || [])], brand: i.brand, name: i.name, covers: i.covers || "", description: "",
      why: i.why || "", tone: i.tone || null, ev: i.ev || "", sources: itemSources(i), avail: i.avail || "", stages: [...i.stages], modules: [...i.modules],
      kind: i.kind || null, href: link.href, affiliate: link.affiliate, price: priceFor(i, affiliates), image: img ? { bundled: img } : null, art: artFor(i), reviewed: isReviewed(i, signed),
    };
  });
  const brands = Object.fromEntries([...new Set(items.map((i) => i.brand))].map((name) => [name, { tag: BRANDS[name]?.tag || "", about: BRANDS[name]?.about || "", mono: monogram(name), hue: brandHue(name) }]));
  return { source: "bundled", items, brands };
}

/** A clean live catalog in the page's shape. Images come from the server (<apiBase>/api/shop/images/<id>); an item without
    one keeps a licensed bundled image of the same id, if the owner placed one (src/config/shop-images.json). */
export function liveShop(data, { apiBase = "", images = {} } = {}) {
  const byId = new Map(data.brands.map((b) => [b.id, b]));
  const items = data.products.map((p) => {
    const b = byId.get(p.brandId);
    const bundledImg = imageFor({ id: p.id }, images);
    return {
      id: p.id, category: p.categories[0], also: p.categories.slice(1), brand: b.name, name: p.name, covers: p.covers, description: p.description,
      why: p.why, tone: p.evidence?.tone || null, ev: p.evidence?.label || "", sources: p.sources, avail: p.availability, stages: p.stages, modules: p.modules,
      kind: p.kind, href: p.affiliateUrl || p.url, affiliate: !!p.affiliateUrl, price: p.price || null,
      image: p.imageId && apiBase ? { url: `${apiBase}/api/shop/images/${p.imageId}` } : bundledImg ? { bundled: bundledImg } : null,
      art: artFor({ art: p.art, category: p.categories[0] }), reviewed: p.clinicianStatus === "signed",
    };
  });
  const brands = Object.fromEntries(data.brands.map((b) => [b.name, { tag: b.tag, about: b.about, mono: b.monogram, hue: b.hue || brandHue(b.name) }]));
  return { source: "live", items, brands };
}

/** The catalog the page shows: the device's clean live copy when there is one, else the bundled one. */
export const shopFor = (rec, { apiBase = "", affiliates = {}, images = {}, signed = [] } = {}) => (rec && rec.data ? liveShop(rec.data, { apiBase, images }) : bundledShop({ affiliates, images, signed }));

/** The items of a category (its own and those that also belong there), with an optional employer allow-list. */
export const itemsIn = (shop, category, { allow = null } = {}) => shop.items.filter((i) => (i.category === category || i.also.includes(category)) && (!allow || allow.includes(i.id)));
/** Every item, optionally of one brand, with an employer allow-list. */
export const itemsOf = (shop, { brand = null, allow = null } = {}) => shop.items.filter((i) => (!brand || i.brand === brand) && (!allow || allow.includes(i.id)));
