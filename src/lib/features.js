/* Build-time feature flags (local-first L4, owner decisions D2 and D3). VITE_FEATURES is read once,
   when the bundle is built, and decides which optional features this build OFFERS. A flag never turns a
   feature on for her: each one that is an opt-in (Cyra's AI, browser reminders, weekly counts, a
   wearable connection, sign-in prefill) still starts off until she turns it on, and says exactly what
   it sends before she does. A feature that is off leaves no trace in the app and makes no request.

   VITE_FEATURES: unset or empty = the shipping defaults (ai, webReminders, signin, deviceSync, wearables); a comma list REPLACES the
   defaults ("counts,ai" offers only those two); "all" = every feature; "none" = none. Names are matched
   without regard to case; an unknown name is ignored (vite.config.js warns about it at build time).

   Each server feature also needs its backend module listed in backend/config/app.json ("modules"):
     wearables   → integrations (Oura, Fitbit/Garmin/Whoop via Terra; on the phone also Apple Health / Health Connect).
                                 ON by default since 2026-11-12 (owner decision, Task 2): one "Connect your devices"
                                 list (lib/devices.js); the earlier privacy-review recommendation for the pass-through
                                 still stands (docs/PRIVACY-AUDIT.md).
     counts      → pulse        (anonymous weekly counts, "You're not alone")
     ai          → ai           ("Also ask Cyra's AI")
     webReminders→ push         (reminders in a browser; phones schedule local notifications and need no server)
     cloudBackup → backup       (encrypted cloud backup: a scaffold, no screen uses it yet)
     signin      → accounts + oauth (sign in to a Solia Health account with Apple, Google, Facebook or an
                                 email code; owner request 2026-11-12: ON by default, and required unless
                                 VITE_REQUIRE_SIGNIN=false or the server has no sign-in configured; lib/signin.js)
   signin is a sixth flag beside the five D2 names. It needs a server: a build without VITE_API_BASE offers no
   sign-in and says so on the first registration step.
   deviceSync (passive tracking S3, plan W9) is the seventh: the on-phone sources (Apple Health / Health Connect, read
   by the app on the phone, never through a server) and everything built on their rows (the Home card, the cycle
   markers, the PDF table, You → Devices & reminders). ON by default, since it needs no backend module (FEATURE_MODULE null)
   and sends nothing; it offers nothing in a browser. Oura and Fitbit/Garmin/Whoop stay behind `wearables`.

   shop (2026-11-14, Task C) is the eighth: the Shop by need page (2026-11-15: the header's button, a labelled "Shop" pill since 2026-11-19; You's entry card; the "+" sheet's row; #/shop)
   and its quiet contextual links (lib/shop.js). ON by default. Its backend module is shop (2026-11-15, partner portal:
   the published catalog and the portal API): with a server, the Shop downloads the published catalog with a plain
   request that carries nothing about her (lib/shopLive.js), else it shows the bundled one; matching runs on the device and
   a link opens in the browser only on her tap. 2026-11-19: with a server, opening a product also sends that product's id
   (only) for an anonymous daily total, unless she turned it off (lib/shopTaps.js). Off, the shop and every link to it
   are gone, and no tap is sent.

   Pure, with NO imports: Node (unit tests, vite.config.js) imports this file, where import.meta.env is
   undefined; the optional chaining below keeps it importable there, and Vite still inlines the value. */

export const FEATURE_NAMES = Object.freeze(["wearables", "counts", "ai", "webReminders", "cloudBackup", "signin", "deviceSync", "shop"]);
export const DEFAULT_FEATURES = Object.freeze({ wearables: true, counts: false, ai: true, webReminders: true, cloudBackup: false, signin: true, deviceSync: true, shop: true });
/** The backend module each server feature needs; null for a feature that never touches a server (deviceSync). */
export const FEATURE_MODULE = Object.freeze({ wearables: "integrations", counts: "pulse", ai: "ai", webReminders: "push", cloudBackup: "backup", signin: "accounts", deviceSync: null, shop: "shop" });
/** Further backend modules a server feature also needs: sign-in with Apple, Google or Facebook runs through oauth; the
    shop's partner portal page (where its catalog is edited) is the portal module, and the portal's subscriptions part
    (promotions the app downloads with GET /api/promotions/active, Pro grants, partner codes) is the subscriptions module;
    insights (2026-11-19) is the portal's owner-only totals (accounts and sign-ins; the app never calls it); feedback
    (2026-11-19) takes You → Help & about's "Send feedback" / "Report a problem" (POST /api/feedback, lib/feedback.js: offered in
    any build with a server) and holds the portal's owner-only inbox, which needs the shop module's portal sign-in; settings
    (2026-11-25) is the portal's owner-only App settings and the public GET /api/app-config the app downloads at start in any
    build with a server (lib/appConfig.js); its writes need the shop module's portal sign-in; orgs (2026-11-25) is organizations: the public config, join and
    leave the app calls in a build with a server (lib/orgLive.js), and the portal's owner-only Organizations. */
export const FEATURE_ALSO = Object.freeze({ signin: Object.freeze(["oauth"]), shop: Object.freeze(["portal", "subscriptions", "insights", "feedback", "settings", "orgs"]) });

const words = (raw) => String(raw).split(",").map((w) => w.trim()).filter(Boolean);
const known = (w) => FEATURE_NAMES.find((n) => n.toLowerCase() === w.toLowerCase());

/* Developer-only flags (calm R1). They live in the same VITE_FEATURES list but are not product features: they
   offer nothing to her, map to no backend module and never change which product features a build offers. A list
   made only of dev words therefore keeps the shipping defaults ("devGallery" = the defaults plus the gallery).
     devGallery → the design-system gallery at #/dev/ui (src/dev/DevGallery.jsx); default off. "all" turns it on,
                  so the harness builds (VITE_FEATURES=all) carry it. vite.config.js inlines it as
                  __CYRA_DEV_GALLERY__, so a build without it leaves the gallery code out of the bundle entirely.
     proDev     → the dev/QA unlock of Pro (calm R5, plan §7): lib/plan.js planFor(DEV_FLAGS) returns DEV_PRO_PLAN, so the
                  Pro-gated parts (the full practice library) can be tested before store purchases exist (R8). Default
                  off; "all" turns it on, so the harness builds test the unlocked paths. Nothing is bought or sent.
     trialGate  → turns on the free-week gate (lib/trial.js) in a build with no connected store: QA and the e2e harness,
                  and the web once Pro can be bought there. Phone builds with a connected store have the gate anyway.
                  proDev never opens the gate: only a real purchase or the free week does. */
export const DEV_FLAG_NAMES = Object.freeze(["devGallery", "proDev", "trialGate"]);
const devWord = (w) => DEV_FLAG_NAMES.some((n) => n.toLowerCase() === w.toLowerCase());

/** raw VITE_FEATURES → a fresh plain object with every flag (dev words are ignored here). */
export function parseFeatures(raw) {
  if (raw == null || !String(raw).trim()) return { ...DEFAULT_FEATURES };
  const list = words(raw).filter((w) => !devWord(w));
  if (!list.length) return { ...DEFAULT_FEATURES };
  const all = list.some((w) => w.toLowerCase() === "all");
  const out = Object.fromEntries(FEATURE_NAMES.map((n) => [n, all]));
  if (!all) for (const w of list) { const n = known(w); if (n) out[n] = true; }
  return out;
}

/** The words in raw that are neither a feature name nor "all" / "none". */
export function unknownFeatures(raw) {
  if (raw == null) return [];
  return words(raw).filter((w) => !known(w) && !devWord(w) && !/^(all|none)$/i.test(w));
}

/** raw VITE_FEATURES → { devGallery, proDev } (each dev flag on when named or with "all"; "none" names none). */
export function parseDevFlags(raw) {
  const list = raw == null ? [] : words(raw);
  const all = list.some((w) => w.toLowerCase() === "all");
  return Object.fromEntries(DEV_FLAG_NAMES.map((n) => [n, all || list.some((w) => w.toLowerCase() === n.toLowerCase())]));
}

/* Owner settings (2026-11-25, docs/plans/upgrade-enterprise.md Task 2; backend settings module, GET /api/app-config): the
   owner can turn OFF some of the features this build offers, never turn one on. Only these may be turned off from there:
   sign-in, the on-device sources and the encrypted backup never are (someone could be cut off from her account or her
   backup). The list comes from the copy of the app config this device last downloaded (lib/appConfigBoot.js puts it on
   globalThis.__soliaAppConfig before this module runs), so a change applies from the next start of the app. */
export const REMOTE_OFF = Object.freeze(["ai", "shop", "wearables", "webReminders", "counts"]);
/** flags with the names in `off` (only REMOTE_OFF names) turned off; never turns anything on. */
export const withRemoteOff = (flags, off) => {
  const out = { ...flags };
  for (const n of Array.isArray(off) ? off : []) if (REMOTE_OFF.includes(n)) out[n] = false;
  return out;
};
const bootOff = () => { try { const c = globalThis.__soliaAppConfig; return c && Array.isArray(c.featuresOff) ? c.featuresOff : []; } catch { return []; } };
/** What this build offers before the owner's settings (frozen). */
export const BUILD_FEATURES = Object.freeze(parseFeatures(import.meta.env?.VITE_FEATURES));
/** This build's flags (frozen), less any the owner turned off. */
export const FEATURES = Object.freeze(withRemoteOff(BUILD_FEATURES, bootOff()));

/** This build's developer flags (frozen). */
export const DEV_FLAGS = Object.freeze(parseDevFlags(import.meta.env?.VITE_FEATURES));

/** true when this build offers `name`. */
export const feature = (name) => FEATURES[name] === true;

/** Whether this build has check-in reminders at all: phones always schedule local notifications;
    webReminders governs only web push. */
export const remindersInBuild = (native, f = FEATURES) => !!native || !!f.webReminders;
