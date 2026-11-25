/* Runs first (src/main.jsx imports it before anything else): reads the copy of the owner's app settings this device last
   downloaded (lib/appConfig.js, GET /api/app-config) and puts it on globalThis.__soliaAppConfig, so lib/features.js can
   turn off what the owner turned off before any screen is built. It holds app settings only (the same for everyone,
   nothing about her). No import on purpose: lib/features.js must not have run yet. Never throws; a missing, unreadable
   or blocked copy leaves the built-in defaults. */
export const APP_CONFIG_KEY = "solia.appConfig.v1";
try {
  const raw = typeof localStorage !== "undefined" ? localStorage.getItem(APP_CONFIG_KEY) : null;
  const v = raw ? JSON.parse(raw) : null;
  globalThis.__soliaAppConfig = v && typeof v === "object" && !Array.isArray(v) && v.version === 1 ? v : null;
} catch { globalThis.__soliaAppConfig = null; }
