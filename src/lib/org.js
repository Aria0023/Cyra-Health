/* Organizations (2026-11-25, docs/plans/upgrade-enterprise.md Task 3; backend orgs module): a clinic's or employer's
   branded version of the same app. Pure: no React, storage or network (the requests are lib/orgLive.js).
   She joins with a link (?org=<slug>) or an invite code (registration, or You → Your profile). Joining sends only the
   slug or the code (and, when she is signed in, her sign-in, so her account stores which organization it joined). The
   app then wears the organization's name, logo and colours, offers only its life stages (she still gets exactly one) and
   shows only its Shop products, and remembers it on this device (record key `org`, device-only, never in a backup).
   Leaving restores Solia Health's own look. "Powered by Solia Health" stays visible.
   Colours: only the UI palette's primary and accent, light and dark, on Solia's own page and card colours (never the
   data-viz ramps); each is checked here again (AA 4.5:1 on the page and the card of its scheme) before it is used. */
import { ORGS } from "./constants.js";
import { STAGE_CARDS } from "./onboarding.js";

export const SOLIA_SLUG = "cyra";
export const ORG_STAGES = Object.freeze({ cycle: "My Cycle", ttc: "Trying to conceive", preg: "Pregnant", peri: "Perimenopause", meno: "Menopause & beyond" });
export const ORG_STAGE_IDS = Object.freeze(Object.keys(ORG_STAGES));
export const ORG_SLUG_RE = /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/;
export const ORG_CODE_RE = /^[A-Z0-9]{6,12}$/;
const HEX_RE = /^#[0-9A-Fa-f]{6}$/;
const LOGO_RE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/;
export const LOGO_MAX_CHARS = 90_000; // a 64 KB image as base64, with its prefix

/* Every sentence the org parts show (each literally true of this build). */
export const ORG_COPY = Object.freeze({
  privacy: "Your organization sees how many people joined, never what you log.",
  /* 2026-11-25 (upgrade-enterprise Task 4): exactly what its admins' dashboard shows (backend orgs/stats.js). */
  totals: "Totals only. Its admins see how many people joined, how many of them have an account or Pro, and joins per week; any number under 10 shows as \"fewer than 10\", and they never see a name, an email or anything you log.",
  poweredBy: "Powered by Solia Health",
  codeLab: "Invite code (optional)",
  codeHint: "From your clinic or employer, if they gave you one.",
  join: "Join",
  joining: "Checking…",
  joinTitle: (name) => `Join ${name}?`,
  joinLead: (name) => `${name} offers Solia Health with its own look.`,
  joinWhat: "Joining sends only the organization's name or code, and with your sign-in, your account notes which organization you joined.",
  notNow: "Not now",
  joined: (name) => `You joined ${name}.`,
  leave: (name) => `Leave ${name}`,
  left: "You left the organization. Solia Health's own look is back.",
  cardTitle: "Your organization",
  cardNone: "Joined through a clinic or employer? Enter its invite code.",
  cardIn: (name) => `You're using ${name}'s version of Solia Health.`,
  badCode: "That invite code isn't known. Check it with your organization.",
  badLink: "That organization link isn't known.",
  offline: "Couldn't reach Solia Health's server. Try again when you're online.",
  noServer: "Joining an organization needs Solia Health's server, which this version doesn't have.",
});

/* ---------- colour checks (WCAG 2.x) ---------- */
const lin = (c) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const lum = (hex) => { const n = parseInt(hex.slice(1), 16); return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255); };
export const contrastOf = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const BASE = ORGS.cyra.theme;
/** Whether an organization's four brand colours each reach 4.5:1 on Solia's page and card in their scheme. */
export function themeOk(t) {
  if (!t || typeof t !== "object" || !t.dark || typeof t.dark !== "object") return false;
  const pairs = [[t.primary, BASE], [t.accent, BASE], [t.dark.primary, BASE.dark], [t.dark.accent, BASE.dark]];
  return pairs.every(([hex, s]) => typeof hex === "string" && HEX_RE.test(hex) && contrastOf(hex, s.paper) >= 4.5 && contrastOf(hex, s.card) >= 4.5);
}

/** A server answer (or a stored copy) → a clean organization config, or null when any part fails. */
export function cleanOrgConfig(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  if (typeof raw.slug !== "string" || !ORG_SLUG_RE.test(raw.slug) || raw.slug === SOLIA_SLUG) return null;
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  if (!name || name.length > 60 || [...name].some((c) => c.charCodeAt(0) < 32 || c === "<" || c === ">")) return null;
  if (!themeOk(raw.theme)) return null;
  const stages = Array.isArray(raw.stages) ? ORG_STAGE_IDS.filter((s) => raw.stages.includes(s)) : [];
  if (!stages.length) return null;
  const ids = raw.partnerIds;
  if (ids !== null && (!Array.isArray(ids) || ids.length > 200 || ids.some((x) => typeof x !== "string" || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(x)))) return null;
  const logo = typeof raw.logo === "string" && raw.logo.length <= LOGO_MAX_CHARS && LOGO_RE.test(raw.logo) ? raw.logo : null;
  const t = raw.theme;
  return { slug: raw.slug, name, logo, theme: { primary: t.primary.toUpperCase(), accent: t.accent.toUpperCase(), dark: { primary: t.dark.primary.toUpperCase(), accent: t.dark.accent.toUpperCase() } }, stages, partnerIds: ids === null ? null : [...ids] };
}
/** Record validator's twin: null, or a stored config that cleans to itself. */
export const cleanOrgRecord = (v) => cleanOrgConfig(v);

/** The organization's palette for appearance.paletteFor: Solia's page, card, ink, soft and line, its primary and accent. */
export const orgTheme = (cfg) => ({ ...BASE, primary: cfg.theme.primary, accent: cfg.theme.accent, dark: { ...BASE.dark, primary: cfg.theme.dark.primary, accent: cfg.theme.dark.accent } });

/** The `org` object the app's screens read (the same shape as constants.js ORGS entries), for a joined org or Solia. */
export function orgView(cfg) {
  if (!cfg) return ORGS.cyra;
  return { slug: cfg.slug, name: cfg.name, title: cfg.name, tag: ORG_COPY.poweredBy, theme: orgTheme(cfg), partnerIds: cfg.partnerIds, logo: cfg.logo, stages: cfg.stages, joined: true };
}

/** The registration's stage cards for an organization (all of them for Solia). Never empty. */
export function stageCardsFor(cfg) {
  if (!cfg) return STAGE_CARDS;
  const labels = cfg.stages.map((s) => ORG_STAGES[s]);
  const out = STAGE_CARDS.filter(([l]) => labels.includes(l));
  return out.length ? out : STAGE_CARDS;
}

/** ?org=<slug> in a URL's search → the slug, or null. */
export function orgFromSearch(search) {
  try { const s = new URLSearchParams(search || "").get("org"); return s && ORG_SLUG_RE.test(s.toLowerCase()) && s.toLowerCase() !== SOLIA_SLUG ? s.toLowerCase() : null; } catch { return null; }
}
/** What she typed → an invite code, or null. */
export const cleanCode = (v) => { const c = typeof v === "string" ? v.replace(/[\s-]/g, "").toUpperCase() : ""; return ORG_CODE_RE.test(c) ? c : null; };
