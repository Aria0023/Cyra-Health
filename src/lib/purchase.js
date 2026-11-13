/* Store purchases (calm R8; owner decision D4, 2026-11-12): the one place Solia Health asks the app store about Pro.
   No imports, no storage, no network of its own. App.jsx passes the platform ("ios" | "android" | "web"), the store
   plugin (RevenueCat's Capacitor plugin, lib/native.js Purchases, only on a phone where it is bundled) and the
   store's public SDK key for that platform (VITE_REVENUECAT_IOS_KEY / VITE_REVENUECAT_ANDROID_KEY: RevenueCat's
   public app keys are designed to ship inside apps; they are not secrets).

   What the store is told: nothing about her. configure() gets no app user id, so RevenueCat makes an anonymous one;
   no attributes, no email, no health data are ever set (docs/MONETIZATION.md §6, docs/PRIVACY-AUDIT.md "Pro").
   What it answers: offerings with the store's own prices, and whether the "pro" entitlement is active.

     storeFor({ platform, plugin, apiKey }) → { kind, available, line, plugin, apiKey }
     startStore(store)                      → Promise<{ ok, owned }>       configure once, then read the entitlement
     loadOffer(store)                       → Promise<{ ok, plans, tips }> the store's packages and prices
     buyPro(store, planId, offer)           → Promise<{ ok, owned, cancelled?, line }>
     restorePurchases(store)                → Promise<{ ok, owned, line }>
     sendTip(store, tipId, offer)           → Promise<{ ok, cancelled?, line }>  never changes the plan
   Without a plugin and a key (the web, a build without the store) nothing is available and every answer says so. */

export const STORE_KINDS = Object.freeze(["app-store", "play", "none"]);

export const STORE_LINES = Object.freeze({
  native: "The app store isn't connected in this build, so Pro can't be bought or restored here yet.",
  web: "Pro is sold in the iPhone and Android apps. There's nothing to buy on the web.",
  restoreNative: "Restoring purchases needs the app store, which isn't connected in this build. Nothing was checked or sent.",
  restoreWeb: "There's nothing to restore on the web: Pro is sold in the iPhone and Android apps.",
  restored: "Restored. Pro is on.",
  restoredNone: "No Pro subscription was found for this Apple or Google account.",
  bought: "Pro is on. Thank you.",
  cancelled: "Nothing was bought.",
  failed: "The store couldn't finish that. Nothing was charged. Try again in a moment.",
  noPrice: "The store hasn't answered with a price yet. Nothing can be bought until it does.",
  tipThanks: "Thank you. Your tip helps keep Solia Health going.",
});

export const ENTITLEMENT_ID = "pro";
const KIND = { ios: "app-store", android: "play" };

/** The store this build can use: available only on a phone with the plugin bundled and its public key set. */
export function storeFor({ platform = "web", plugin = null, apiKey = "" } = {}) {
  const kind = KIND[platform] || "none";
  if (kind === "none") return Object.freeze({ kind, available: false, line: STORE_LINES.web, plugin: null, apiKey: "" });
  const ready = !!plugin && typeof apiKey === "string" && apiKey.trim().length > 0;
  return Object.freeze({ kind, available: ready, line: ready ? "" : STORE_LINES.native, plugin: ready ? plugin : null, apiKey: ready ? apiKey.trim() : "" });
}

/** Whether a RevenueCat customerInfo carries an active Pro entitlement. Anything unreadable is false. */
export const ownsPro = (info) => !!(info && info.entitlements && info.entitlements.active && info.entitlements.active[ENTITLEMENT_ID] && info.entitlements.active[ENTITLEMENT_ID].isActive === true);

/* The native plugin rejects a cancelled purchase with code "1" (PURCHASE_CANCELLED_ERROR) and userCancelled in its data. */
const cancelledErr = (e) => !!e && (e.userCancelled === true || (e.data && e.data.userCancelled === true) || String(e.code) === "1");
const configured = new WeakSet();

/** Configure the store once (anonymous: no app user id), then read whether Pro is active. */
export async function startStore(store) {
  if (!store || !store.available) return { ok: false, owned: false };
  try {
    if (!configured.has(store.plugin)) { await store.plugin.configure({ apiKey: store.apiKey }); configured.add(store.plugin); }
    const r = await store.plugin.getCustomerInfo();
    return { ok: true, owned: ownsPro(r && r.customerInfo) };
  } catch {
    return { ok: false, owned: false };
  }
}

/** The store's current offering: { plans: { annual, monthly }, tips: [...] }, each with the store's own price. */
export async function loadOffer(store, { planTypes = { annual: "ANNUAL", monthly: "MONTHLY" }, tipIds = [] } = {}) {
  if (!store || !store.available) return { ok: false, plans: {}, tips: [] };
  try {
    const o = await store.plugin.getOfferings();
    const pkgs = (o && o.current && Array.isArray(o.current.availablePackages)) ? o.current.availablePackages : [];
    const plans = {};
    for (const [id, type] of Object.entries(planTypes)) {
      const pkg = pkgs.find((p) => p && p.packageType === type && p.product && typeof p.product.priceString === "string");
      if (pkg) plans[id] = { pkg, priceString: pkg.product.priceString, price: pkg.product.price };
    }
    let tips = [];
    if (tipIds.length) {
      const r = await store.plugin.getProducts({ productIdentifiers: tipIds, type: "NON_SUBSCRIPTION" }).catch(() => ({ products: [] }));
      const got = (r && Array.isArray(r.products)) ? r.products : [];
      tips = tipIds.map((id) => got.find((p) => p && p.identifier === id)).filter((p) => p && typeof p.priceString === "string").map((p) => ({ id: p.identifier, product: p, priceString: p.priceString }));
    }
    return { ok: true, plans, tips };
  } catch {
    return { ok: false, plans: {}, tips: [] };
  }
}

/** Buy one Pro plan ("annual" | "monthly") from a loaded offer. */
export async function buyPro(store, planId, offer) {
  if (!store || !store.available) return { ok: false, owned: false, line: store && store.kind !== "none" ? STORE_LINES.native : STORE_LINES.web };
  const plan = offer && offer.plans && offer.plans[planId];
  if (!plan) return { ok: false, owned: false, line: STORE_LINES.noPrice };
  try {
    const r = await store.plugin.purchasePackage({ aPackage: plan.pkg });
    const owned = ownsPro(r && r.customerInfo);
    return { ok: owned, owned, line: owned ? STORE_LINES.bought : STORE_LINES.failed };
  } catch (e) {
    return cancelledErr(e) ? { ok: false, owned: false, cancelled: true, line: STORE_LINES.cancelled } : { ok: false, owned: false, line: STORE_LINES.failed };
  }
}

/** "Restore purchases": asks the store which subscriptions this Apple or Google account owns. */
export async function restorePurchases(store) {
  if (!store || !store.available) return { ok: false, owned: false, line: store && store.kind !== "none" ? STORE_LINES.restoreNative : STORE_LINES.restoreWeb };
  try {
    const r = await store.plugin.restorePurchases();
    const owned = ownsPro(r && r.customerInfo);
    return { ok: true, owned, line: owned ? STORE_LINES.restored : STORE_LINES.restoredNone };
  } catch {
    return { ok: false, owned: false, line: STORE_LINES.failed };
  }
}

/** A one-time tip. It unlocks nothing and never changes the plan. */
export async function sendTip(store, tipId, offer) {
  if (!store || !store.available) return { ok: false, line: store && store.kind !== "none" ? STORE_LINES.native : STORE_LINES.web };
  const tip = offer && Array.isArray(offer.tips) ? offer.tips.find((x) => x.id === tipId) : null;
  if (!tip) return { ok: false, line: STORE_LINES.noPrice };
  try {
    await store.plugin.purchaseStoreProduct({ product: tip.product });
    return { ok: true, line: STORE_LINES.tipThanks };
  } catch (e) {
    return cancelledErr(e) ? { ok: false, cancelled: true, line: STORE_LINES.cancelled } : { ok: false, line: STORE_LINES.failed };
  }
}

/** Kept for callers that only need a synchronous answer at launch: nothing is owned until the store has answered. */
export const proOwned = () => false;
