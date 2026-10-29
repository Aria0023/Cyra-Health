/* Store purchases (calm R8, plan §7 "Premium (Pro)"): the one place Cyra asks whether Pro is owned. Pure: no imports,
   no storage, no network. App.jsx passes the platform ("ios" | "android" | "web", lib/native.js platform()) and, on a
   phone, whether a store plugin is present.

   The interface a real store adapter fills in later (StoreKit on iOS, Play Billing on Android, both through a
   Capacitor plugin registered as "CyraStore"):
     storeFor({ platform, plugin }) → { kind: "app-store" | "play" | "none", available, line }
     buyPro(store)                  → Promise<{ ok, owned, line }>
     restorePurchases(store)        → Promise<{ ok, owned, line }>
     owned (boolean)                → passed to lib/plan.js planFor(devFlags, owned)
   In this version no store is connected: there is no product, no price and nothing to buy. The phone stub says
   "isn't connected in this build" honestly; the web has no store at all. Nothing here ever reports Pro as owned, so
   the only way to open Pro's parts is the dev/QA flag proDev (lib/features.js), which is off in shipping builds.
   No price is shown anywhere until a real store product exists. */

export const STORE_KINDS = Object.freeze(["app-store", "play", "none"]);

export const STORE_LINES = Object.freeze({
  native: "The app store isn't connected in this build, so Pro can't be bought or restored here yet.",
  web: "Pro will be sold in the iPhone and Android apps. There's nothing to buy on the web.",
  restoreNative: "Restoring purchases needs the app store, which isn't connected in this build. Nothing was checked or sent.",
  restoreWeb: "There's nothing to restore: Pro isn't sold in this version. Nothing was checked or sent.",
});

/** The store this build could use. available is false everywhere in this version (no product is wired). */
export function storeFor({ platform = "web" } = {}) {
  if (platform === "ios") return Object.freeze({ kind: "app-store", available: false, line: STORE_LINES.native });
  if (platform === "android") return Object.freeze({ kind: "play", available: false, line: STORE_LINES.native });
  return Object.freeze({ kind: "none", available: false, line: STORE_LINES.web });
}

/** Buying Pro. With no store connected it answers at once, owns nothing and sends nothing. */
export async function buyPro(store = storeFor()) {
  return { ok: false, owned: false, line: store && store.kind !== "none" ? STORE_LINES.native : STORE_LINES.web };
}

/** "Restore purchases". With no store connected it answers at once, owns nothing and sends nothing. */
export async function restorePurchases(store = storeFor()) {
  return { ok: false, owned: false, line: store && store.kind !== "none" ? STORE_LINES.restoreNative : STORE_LINES.restoreWeb };
}

/** Whether Pro is owned according to this build's store: always false until a store adapter exists. */
export const proOwned = () => false;
