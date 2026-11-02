/* Appearance (spec §8.4, decision D9): System (default), Light or Dark.
   Appearance is a display preference of this device. It is saved with the on-device record
   (IndexedDB on the web, the app's own file on the phone), followed by every open tab of this
   browser, never sent anywhere and never put in a backup file. This module is pure: it imports
   nothing from storage or the network, and System is read with matchMedia by the caller.
   Printing always resolves to light. */

export const APPEARANCES = [["system", "System"], ["light", "Light"], ["dark", "Dark"]];
export const DEFAULT_APPEARANCE = "system";
/* Anything that isn't one of the three keys (missing, an old record, a typo) reads as System. */
export const cleanAppearance = (v) => (APPEARANCES.some(([k]) => k === v) ? v : DEFAULT_APPEARANCE);
/* Style (Solia 2026-11-01: Soft, Mono; skins 2026-11-02: Bloom, Clear, Journal). Five looks of the same layout: a
   device preference like Appearance, saved with the on-device record (record.js DEVICE_PREFS uiStyle), followed by every
   open tab of this browser, never sent anywhere and never put in a backup. Shell puts it on .cy as data-style; styles.js
   and the token layer in lib/constants.js (STYLE_SHAPE, STYLE_SKINS) do the rest (no per-screen code).
   Each entry: [key, name, a few words for the picker card]. */
export const STYLES = [
  ["soft", "Soft", "Pastel, gentle"],
  ["mono", "Mono", "Quiet, one colour"],
  ["bloom", "Bloom", "Warm, editorial"],
  ["clear", "Clear", "Crisp, easy reading"],
  ["journal", "Journal", "Paper, handmade"],
];
export const STYLE_KEYS = STYLES.map(([k]) => k);
export const DEFAULT_STYLE = "soft";
/* Anything that isn't one of the five keys (missing, an old record, a typo) reads as Soft. */
export const cleanStyle = (v) => (STYLE_KEYS.includes(v) ? v : DEFAULT_STYLE);
export const SYSTEM_DARK_QUERY = "(prefers-color-scheme: dark)";
/* The scheme on screen: printing → light; then her explicit choice; else the device setting. */
export const resolveScheme = (appearance, systemDark, printing = false) =>
  printing ? "light" : appearance === "dark" ? "dark" : appearance === "light" ? "light" : systemDark ? "dark" : "light";

/* The seven UI palette tokens. Every PALETTES entry and ORGS theme carries them, plus a `dark`
   object with the same seven (lib/constants.js). Data-viz colours are not part of a palette. */
export const PALETTE_KEYS = ["primary", "accent", "paper", "card", "ink", "soft", "line"];
export const paletteFor = (p, scheme) => Object.fromEntries(PALETTE_KEYS.map((k) => [k, (scheme === "dark" && p.dark ? p.dark : p)[k]]));
/* The seven palette tokens, then the same seven again as --st-* ("stage"): a style may override the first set (Mono,
   Clear and Journal replace them, Bloom warms them), while the --st-* copy always holds the stage palette itself, for
   Bloom's warm mix and the Soft preview card in the Style picker. */
export const paletteVars = (t) => {
  const v = { "--primary": t.primary, "--paper": t.paper, "--card": t.card, "--accent": t.accent, "--ink": t.ink, "--soft": t.soft, "--line": t.line };
  for (const k of PALETTE_KEYS) v[`--st-${k}`] = t[k];
  return v;
};
/* A token object ({ "--x": value }) as CSS declarations, for styles.js (SCHEME_TOKENS). */
export const tokenDecls = (o, important = false) => Object.entries(o).map(([k, v]) => `${k}:${v}${important ? " !important" : ""}`).join(";");

/* Keeps the document outside the app's column in step with the scheme on screen: the native
   form controls and scrollbars (color-scheme), the page beside the 430px column and the
   overscroll area (--doc-bg, index.html), and the browser chrome (every theme-color meta,
   set to the paper on screen in both schemes). The only runtime writer of theme-color. */
export function applyDocumentScheme(doc, { scheme, paper }) {
  if (!doc?.documentElement) return;
  const root = doc.documentElement;
  root.style.colorScheme = scheme;
  root.style.setProperty("--doc-bg", paper);
  for (const m of doc.querySelectorAll('meta[name="theme-color"]')) m.setAttribute("content", paper);
}

/* The Report meter legend's word for the moderate-or-strong segment (ReportScreen, "What stands out").
   That segment is the family colour itself and the other symptom days a 34% tint of it into the card
   (styles.js .fm-strong / .fm-any). On a light card the tint is paler, so the strong segment is the darker
   one; on a dark card the tint is darker, so "Darker" would point at the wrong days. The dark word names
   what holds there, and in the monochrome print fallback too. Printing resolves to light, so print says
   "Darker" like the light screen. */
export const strongMeterWord = (scheme) => (scheme === "dark" ? "Full colour" : "Darker");
