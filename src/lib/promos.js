/* Scheduled promotions in the app (owner request 2026-11-15, docs/plans/portal-subscriptions.md Task 3). Pure: no imports,
   no storage, no network (lib/promoLive.js downloads, lib/purchase.js asks the store, App.jsx keeps the device copy).

   How it works, and what stays on her device:
   - The app downloads the list of live promotions with one plain GET that carries nothing about her (no query, no id, no
     cookie): the same list for everyone. At most once a day, and when the Pro sheet or You opens.
   - Whether one is for her is decided HERE, on the device, from her own record: her life stage and whether she first
     used Solia Health within the last 14 days (`newSince`: the record's own first date). The server never learns either.
   - A matching promotion names a RevenueCat offering. The app asks the store for it (lib/purchase.js loadOffer) and shows
     the banner with ONLY the store's own price strings for that offering. If the offering or its prices don't load, it
     shows nothing at all. The web sells nothing: there the banner says the offer is in the iPhone and Android apps,
     with no price (lib/pricing.js has no reference price for any promotion).
   - At most one banner at a time; she can dismiss it (the id is remembered on this device only). Never in notifications,
     onboarding, urgent screens or insights: only on You → Plan and the Pro sheet. */

export const PROMO_STAGES = Object.freeze(["periods", "ttc", "preg", "peri", "meno"]);
export const PROMO_PLATFORMS = Object.freeze(["ios", "android", "web"]);
export const NEW_DAYS = 14;
export const PROMO_REFRESH_MS = 24 * 3_600_000;
const MAX_PROMOS = 20;
const ID_RE = /^[A-Za-z0-9_-]{6,40}$/;
const OFFERING_RE = /^[A-Za-z0-9_.$-]{1,100}$/;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const CTRL = /[\u0000-\u001F\u007F‪-‮⁦-⁩]/g; // eslint-disable-line no-control-regex

export const PROMO_COPY = Object.freeze({
  label: "An offer",
  dismiss: "Not now",
  dismissLabel: (title) => `Not now: hide the offer "${title}"`,
  webLine: "This offer is in the iPhone and Android apps. There's nothing to buy on the web.",
  storeLine: "Price from the App Store or Google Play. The store's terms apply.",
});

const text = (v, max) => {
  if (typeof v !== "string") return null;
  const s = v.replace(CTRL, " ").replace(/\s+/g, " ").trim();
  return s && s.length <= max ? s : null;
};
const iso = (v) => (typeof v === "string" && v.length <= 40 && !Number.isNaN(Date.parse(v)) ? new Date(Date.parse(v)).toISOString() : null);

/** One promotion from the server, cleaned, or null. Anything unexpected drops the whole promotion. */
export function cleanPromo(p) {
  if (!p || typeof p !== "object") return null;
  if (typeof p.id !== "string" || !ID_RE.test(p.id) || typeof p.offeringId !== "string" || !OFFERING_RE.test(p.offeringId)) return null;
  const platforms = Array.isArray(p.platforms) ? [...new Set(p.platforms.filter((x) => PROMO_PLATFORMS.includes(x)))] : [];
  if (!platforms.length || platforms.length !== new Set(p.platforms).size) return null;
  const a = p.audience && typeof p.audience === "object" ? p.audience : null;
  if (!a || !["everyone", "new", "stages"].includes(a.who)) return null;
  const stages = Array.isArray(a.stages) ? [...new Set(a.stages)] : [];
  if (stages.some((s) => !PROMO_STAGES.includes(s)) || (a.who === "stages" && !stages.length)) return null;
  const startsAt = iso(p.startsAt), endsAt = iso(p.endsAt);
  if (!startsAt || !endsAt || endsAt <= startsAt) return null;
  const b = p.banner && typeof p.banner === "object" ? p.banner : null;
  const title = b && text(b.title, 40), body = b && text(b.body, 120);
  if (!title || !body) return null;
  return { id: p.id, offeringId: p.offeringId, platforms, audience: { who: a.who, stages: a.who === "stages" ? stages : [] }, startsAt, endsAt, banner: { title, body } };
}

/** The server's answer → a clean list (at most 20), or null when it isn't the expected shape at all. */
export function cleanPromos(json) {
  if (!json || typeof json !== "object" || !Array.isArray(json.promotions)) return null;
  return json.promotions.slice(0, MAX_PROMOS).map(cleanPromo).filter(Boolean);
}

/** The device copy (record key `promos`, device-only, never in a backup): { at: ISO time, list: [...] } or null. */
export function cleanPromoCache(v) {
  if (!v || typeof v !== "object" || !iso(v.at) || !Array.isArray(v.list)) return null;
  const list = v.list.slice(0, MAX_PROMOS).map(cleanPromo).filter(Boolean);
  return { at: iso(v.at), list };
}
/** The promotions she hid on this device (record key `promoHidden`, device-only): at most 50 ids. */
export const cleanPromoHidden = (v) => (Array.isArray(v) ? [...new Set(v.filter((x) => typeof x === "string" && ID_RE.test(x)))].slice(-50) : []);

/** Whether the device copy is a day old (or missing) and may be downloaded again. */
export const promosDue = (cache, nowMs = Date.now()) => !cache || !iso(cache.at) || nowMs - Date.parse(cache.at) >= PROMO_REFRESH_MS;

/** Her promotion stage id from the app's own: periods (or ttc while trying to conceive), preg, peri (or meno). */
export function promoStageOf({ stage = null, ttc = false, meno = false } = {}) {
  if (stage === "periods") return ttc ? "ttc" : "periods";
  if (stage === "preg") return "preg";
  if (stage === "peri") return meno ? "meno" : "peri";
  return null;
}

/** "New": she first used Solia Health on `firstDay` (her record's own first date, YYYY-MM-DD) within the last 14 days. */
export function isNewUser(firstDay, todayIso) {
  if (typeof firstDay !== "string" || !ISO_DAY.test(firstDay) || typeof todayIso !== "string" || !ISO_DAY.test(todayIso)) return false;
  const d = (Date.parse(`${todayIso}T00:00:00Z`) - Date.parse(`${firstDay}T00:00:00Z`)) / 86_400_000;
  return d >= 0 && d < NEW_DAYS;
}

/** The one promotion for her now, decided on this device, or null. ctx: { platform, stage (promo id), isNew, nowMs, hidden[], owned }.
    Someone who already has Pro sees none. The newest start wins (the server sends the newest first). */
export function promoFor(list, { platform = "web", stage = null, isNew = false, nowMs = Date.now(), hidden = [], owned = false } = {}) {
  if (owned || !Array.isArray(list)) return null;
  for (const p of list) {
    if (!p || hidden.includes(p.id) || !p.platforms.includes(platform)) continue;
    if (!(Date.parse(p.startsAt) <= nowMs && nowMs < Date.parse(p.endsAt))) continue;
    if (p.audience.who === "new" && !isNew) continue;
    if (p.audience.who === "stages" && !(stage && p.audience.stages.includes(stage))) continue;
    return p;
  }
  return null;
}

/** What the banner says. `offer` is lib/purchase.js loadOffer()'s answer for the promotion's offering.
    - phone ("store"): the title, the text, and ONLY the store's price strings for that offering's plans (via planLines,
      passed in as `lines(planId, plan)`); no offer, or no price → null (nothing is shown).
    - web: the title, the text and "in the iPhone and Android apps", never a price.
    `trialDays(product)` reads a free trial from the store's own product. */
export function promoBanner(promo, { where = "web", offer = null, lines = null, trialDays = () => 0 } = {}) {
  if (!promo) return null;
  if (where === "web") return { id: promo.id, title: promo.banner.title, body: promo.banner.body, prices: [], foot: PROMO_COPY.webLine };
  const plans = offer && offer.ok && offer.plans && typeof offer.plans === "object" ? offer.plans : null;
  if (!plans || typeof lines !== "function") return null;
  const prices = [];
  for (const id of ["annual", "monthly"]) {
    const plan = plans[id];
    if (!plan || typeof plan.priceString !== "string" || !plan.priceString) continue;
    const l = lines(id, plan);
    if (!l) continue;
    const days = trialDays(plan.pkg && plan.pkg.product);
    prices.push(`${l.title}: ${l.price}${days ? ` · ${days}-day free trial` : ""}`);
  }
  if (!prices.length) return null;
  return { id: promo.id, title: promo.banner.title, body: promo.banner.body, prices, foot: PROMO_COPY.storeLine };
}
