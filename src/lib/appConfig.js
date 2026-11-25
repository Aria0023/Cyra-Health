/* The owner's app settings (2026-11-25, docs/plans/upgrade-enterprise.md Task 2; backend settings module). In a build with
   a server (VITE_API_BASE) the app downloads them when it starts with one plain GET to /api/app-config that carries
   nothing about her: no query, no token, no cookie (credentials "omit"), no referrer. The cleaned copy is kept on this
   device (localStorage APP_CONFIG_KEY: app settings only, the same for everyone; never her record, never in a backup),
   so the next start uses it, offline too. Any failure keeps the last good copy; no copy, or an answer that doesn't pass
   the cleaner, means the built-in defaults. A build without a server never asks and behaves exactly as before.
   Pure (no network): the download is lib/appConfigLive.js.
   What each setting does in the app:
     featuresOff    from the next start (lib/features.js reads the copy before any screen is built): those features are
                    off as if the build didn't offer them. Only REMOTE_OFF names; never turns a feature on.
     defaultStyle / defaultPalette   what a new person starts with, until she picks her own
     announcement   one plain-text line on Home while the owner has it on
     helpLines      up to three plain-text lines under You → Help & about's answers
     prices         the web's reference prices on the Pro sheet and the plan tiles (phones always show the store's own) */
import { REMOTE_OFF } from "./features.js";
import { STYLE_KEYS } from "./appearance.js";
import { APP_CONFIG_KEY } from "./appConfigBoot.js";

export { APP_CONFIG_KEY };
export const ANNOUNCE_MAX = 140, HELP_LINE_MAX = 240, HELP_LINES_MAX = 3, PALETTE_COUNT = 3;
export const PRICE_RE = /^\$\d{1,4}(\.\d{2})?$/;
// plain text only: no control characters (newlines included) and no angle brackets
const plainBad = (s) => [...s].some((c) => { const n = c.charCodeAt(0); return n < 32 || (n >= 127 && n < 160) || c === "<" || c === ">"; });
const plain = (v, max) => (typeof v === "string" && v.trim() && v.trim().length <= max && !plainBad(v.trim()) ? v.trim() : null);

/** Anything → a clean config, or null when it isn't one (then the built-in defaults apply). */
export function cleanAppConfig(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw) || raw.version !== 1) return null;
  const off = Array.isArray(raw.featuresOff) ? REMOTE_OFF.filter((n) => raw.featuresOff.includes(n)) : [];
  const style = STYLE_KEYS.includes(raw.defaultStyle) ? raw.defaultStyle : null;
  const pal = Number.isInteger(raw.defaultPalette) && raw.defaultPalette >= 0 && raw.defaultPalette < PALETTE_COUNT ? raw.defaultPalette : null;
  const help = Array.isArray(raw.helpLines) ? raw.helpLines.map((x) => plain(x, HELP_LINE_MAX)).filter(Boolean).slice(0, HELP_LINES_MAX) : [];
  const price = (v) => (typeof v === "string" && PRICE_RE.test(v) ? v : null);
  const p = raw.prices && typeof raw.prices === "object" ? raw.prices : {};
  const at = typeof raw.updatedAt === "string" && !Number.isNaN(Date.parse(raw.updatedAt)) ? raw.updatedAt : null;
  return { version: 1, featuresOff: off, defaultStyle: style, defaultPalette: pal, announcement: plain(raw.announcement, ANNOUNCE_MAX), helpLines: help, prices: { monthly: price(p.monthly), annual: price(p.annual) }, updatedAt: at };
}

/** The copy this device kept (read by lib/appConfigBoot.js at start), cleaned; null = built-in defaults. */
export const bootAppConfig = () => { try { return cleanAppConfig(globalThis.__soliaAppConfig); } catch { return null; } };

/** Keeps the clean copy on this device for the next start (null removes it). Never throws. */
export function keepAppConfig(cfg, ls = typeof localStorage !== "undefined" ? localStorage : null) {
  try { if (!ls) return; if (cfg) ls.setItem(APP_CONFIG_KEY, JSON.stringify(cfg)); else ls.removeItem(APP_CONFIG_KEY); } catch { /* storage blocked: this start only */ }
}

/** The web's reference prices: the owner's, else the built-in ones (lib/pricing.js PRO_PRODUCTS). */
export const webRefs = (cfg) => ({ monthly: cfg?.prices?.monthly || null, annual: cfg?.prices?.annual || null });
