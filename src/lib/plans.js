/* The two Pro plans as tiles (owner request 2026-11-15, docs/plans/plans-shop-page.md Task 2): Yearly (best value, with
   the 7-day free trial) and Monthly, side by side on You → Plan and at the top of the Pro sheet. Pure: imports only
   ./pricing.js (itself import-free), so Node runs every line in the unit tests.

   Where a price comes from (lib/pricing.js rules, App Store Guideline 3.1.2 and Google Play's subscription policy):
   - web ("web"): the owner's US reference prices, named as "in the iPhone and Android apps" (nothing is sold on the web);
   - a phone ("store"): ONLY the store's own price strings, and the trial badge only when the store's offer carries a
     free trial for that product. No offer yet (or no store) → no tiles at all, so no reference price is ever shown there.
   Tile: { id, title, price, note|null, trial|null ("7-day free trial"), trialDays, best } */
import { PRO_PRODUCTS, PRO_PLAN_IDS, perMonthOf, planLines } from "./pricing.js";

const UNIT_DAYS = { DAY: 1, WEEK: 7, MONTH: 30, YEAR: 365 };
const daysOf = (unit, n) => (UNIT_DAYS[String(unit || "").toUpperCase()] && Number.isInteger(n) && n > 0 ? UNIT_DAYS[String(unit).toUpperCase()] * n : 0);

/** The free-trial length the STORE's product offers, in days (0 when none, or unreadable). RevenueCat's Capacitor
    product: iOS `introPrice` { price: 0, periodUnit, periodNumberOfUnits }; Android `defaultOption.freePhase.billingPeriod`
    { unit, value }. A paid introductory price is not a free trial. */
export function storeTrialDays(product) {
  if (!product || typeof product !== "object") return 0;
  const ip = product.introPrice;
  if (ip && typeof ip === "object" && ip.price === 0) {
    const d = daysOf(ip.periodUnit, ip.periodNumberOfUnits);
    if (d) return d;
  }
  const bp = product.defaultOption && product.defaultOption.freePhase && product.defaultOption.freePhase.billingPeriod;
  if (bp && typeof bp === "object") return daysOf(bp.unit, bp.value);
  return 0;
}

export const PLANS_COPY = Object.freeze({
  label: "Pro plans",
  best: "Best value",
  trialBadge: (n) => `${n}-day free trial`,
  getInApp: "Get Solia Health Pro in the app",
  appStore: "App Store",
  playStore: "Google Play",
  appStoreLabel: "Get Solia Health on the App Store (opens in your browser)",
  playStoreLabel: "Get Solia Health on Google Play (opens in your browser)",
  comingSoon: "Coming soon to the App Store and Google Play",
  webOnly: "Pro is sold only in the iPhone and Android apps. Nothing is sold on the web.",
  chip: "Pro · 7-day free trial",
  chipHide: "Hide the Pro trial note for today",
});

/** The web's tiles: the US reference prices (web wording only). */
export function webTiles() {
  const a = PRO_PRODUCTS.annual, m = PRO_PRODUCTS.monthly;
  const perMonth = perMonthOf(Number(a.ref.replace(/[^\d.]/g, "")), a.ref);
  return [
    { id: "annual", title: "Yearly", price: `${a.ref} a year`, note: perMonth ? `About ${perMonth} a month` : null, trial: a.trialDays ? PLANS_COPY.trialBadge(a.trialDays) : null, trialDays: a.trialDays, best: true },
    { id: "monthly", title: "Monthly", price: `${m.ref} a month`, note: null, trial: m.trialDays ? PLANS_COPY.trialBadge(m.trialDays) : null, trialDays: m.trialDays, best: false },
  ];
}

/** The tiles for where she is: "web" → webTiles(); "store" → the store offer's plans only (none until it answers). */
export function planTiles({ where = "web", offer = null } = {}) {
  if (where === "web") return webTiles();
  const plans = offer && offer.plans && typeof offer.plans === "object" ? offer.plans : {};
  return PRO_PLAN_IDS.filter((id) => plans[id]).map((id) => {
    const l = planLines(id, plans[id]);
    if (!l) return null;
    const days = storeTrialDays(plans[id].pkg && plans[id].pkg.product);
    return { id, title: l.title, price: l.price, note: l.note, trial: days ? PLANS_COPY.trialBadge(days) : null, trialDays: days, best: id === "annual" };
  }).filter(Boolean);
}

/** The one line above the tiles in the Pro sheet. Web: the reference price "in the iPhone and Android apps". A phone: only
    when the store's yearly offer has a free trial, with the store's own price; otherwise null (nothing is claimed). */
export function proTrialLine(where, tiles) {
  const y = (tiles || []).find((x) => x.id === "annual");
  if (!y || !y.trialDays) return null;
  return where === "web"
    ? `Try Pro free for ${y.trialDays} days on the yearly plan, then ${y.price} in the iPhone and Android apps. Cancel any time.`
    : `Try Pro free for ${y.trialDays} days on the yearly plan, then ${y.price}. Cancel any time.`;
}

/** Home's small "Pro · 7-day free trial" note: only for someone without Pro, never while the free-week bar shows (one
    note at a time), and on at most one day's first Home visit: `shownDay` is the record key proChip (the local day it was
    last shown; device-only, never in a backup). */
export const proChipEligible = ({ owned = false, trialBar = false, enabled = true } = {}) => !!enabled && !owned && !trialBar;
export const proChipNew = ({ shownDay = null, todayIso }) => typeof todayIso === "string" && shownDay !== todayIso;
export const cleanProChip = (v) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
