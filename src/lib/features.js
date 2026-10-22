/* Build-time feature flags (local-first L4, owner decisions D2 and D3). VITE_FEATURES is read once,
   when the bundle is built, and decides which optional features this build OFFERS. A flag never turns a
   feature on for her: each one that is an opt-in (Cyra's AI, browser reminders, weekly counts, a
   wearable connection, sign-in prefill) still starts off until she turns it on, and says exactly what
   it sends before she does. A feature that is off leaves no trace in the app and makes no request.

   VITE_FEATURES: unset or empty = the shipping defaults (ai, webReminders); a comma list REPLACES the
   defaults ("counts,ai" offers only those two); "all" = every feature; "none" = none. Names are matched
   without regard to case; an unknown name is ignored (vite.config.js warns about it at build time).

   Each server feature also needs its backend module listed in backend/config/app.json ("modules"):
     wearables   → integrations (Oura, Fitbit/Garmin/Whoop via Terra; on the phone also Apple Health / Health Connect)
     counts      → pulse        (anonymous weekly counts, "You're not alone")
     ai          → ai           ("Also ask Cyra's AI")
     webReminders→ push         (reminders in a browser; phones schedule local notifications and need no server)
     cloudBackup → backup       (encrypted cloud backup: a scaffold, no screen uses it yet)
     signin      → oauth        (Apple / Google / Facebook name-and-email prefill)
   signin is a sixth flag beside the five D2 names: production no longer mounts oauth (D2: push + ai), so
   the default build must not offer sign-in buttons that could not work.

   Pure, with NO imports: Node (unit tests, vite.config.js) imports this file, where import.meta.env is
   undefined; the optional chaining below keeps it importable there, and Vite still inlines the value. */

export const FEATURE_NAMES = Object.freeze(["wearables", "counts", "ai", "webReminders", "cloudBackup", "signin"]);
export const DEFAULT_FEATURES = Object.freeze({ wearables: false, counts: false, ai: true, webReminders: true, cloudBackup: false, signin: false });
export const FEATURE_MODULE = Object.freeze({ wearables: "integrations", counts: "pulse", ai: "ai", webReminders: "push", cloudBackup: "backup", signin: "oauth" });

const words = (raw) => String(raw).split(",").map((w) => w.trim()).filter(Boolean);
const known = (w) => FEATURE_NAMES.find((n) => n.toLowerCase() === w.toLowerCase());

/** raw VITE_FEATURES → a fresh plain object with all six flags. */
export function parseFeatures(raw) {
  if (raw == null || !String(raw).trim()) return { ...DEFAULT_FEATURES };
  const list = words(raw);
  const all = list.some((w) => w.toLowerCase() === "all");
  const out = Object.fromEntries(FEATURE_NAMES.map((n) => [n, all]));
  if (!all) for (const w of list) { const n = known(w); if (n) out[n] = true; }
  return out;
}

/** The words in raw that are neither a feature name nor "all" / "none". */
export function unknownFeatures(raw) {
  if (raw == null) return [];
  return words(raw).filter((w) => !known(w) && !/^(all|none)$/i.test(w));
}

/** This build's flags (frozen). */
export const FEATURES = Object.freeze(parseFeatures(import.meta.env?.VITE_FEATURES));

/** true when this build offers `name`. */
export const feature = (name) => FEATURES[name] === true;

/** Whether this build has check-in reminders at all: phones always schedule local notifications;
    webReminders governs only web push. */
export const remindersInBuild = (native, f = FEATURES) => !!native || !!f.webReminders;
