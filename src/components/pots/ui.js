/* Small display helpers shared by the POTS components (no state, no storage, no network).
   Labels for symptoms, triggers and medicines, the time and date formats the design uses,
   amounts in her display units, and the screen-owned safety announcement (urgentLive). */
import { useRef, useState } from "react";
import { POTS_SYM, POTS_TRIG, POTS_MED_LIB } from "../../lib/potsConstants.js";
import { localDay, mlToOz, fmtSodium, NA_PER_G_SALT, OZ_ML } from "../../lib/pots.js";

/** "08:05" -> "8:05" (the medicine rows and plan). */
export const hm = (t) => (typeof t === "string" ? t.replace(/^0(\d)/, "$1") : "");
/** "14:10" -> "2:10 pm" (the Last-logged row). */
export const ampm = (t) => {
  if (typeof t !== "string" || !/^\d{2}:\d{2}$/.test(t)) return "";
  const h = Number(t.slice(0, 2));
  return `${((h + 11) % 12) + 1}:${t.slice(3)} ${h < 12 ? "am" : "pm"}`;
};
/** "Sat, Oct 10". */
export const dayLabel = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
/** `iso` moved by `n` calendar days, as a local day key. */
export const addDays = (iso, n) => { const [y, m, d] = iso.split("-").map(Number); return localDay(new Date(y, m - 1, d + n)); };
/** The first sentence of a safety text (what urgentLive announces). */
export const firstSentence = (s) => { const m = /^[\s\S]*?[.!?](?=\s|$)/.exec(s || ""); return m ? m[0] : s || ""; };
export const SEV_WORD = { 1: "mild", 2: "moderate", 3: "strong" };

/** Her own symptom / trigger lists (archived ones keep their names for past days). */
export function symLabel(pots, id) {
  const b = POTS_SYM.find((x) => x.id === id);
  if (b) return b.label;
  const c = (pots?.settings?.customSym || []).find((x) => x.id === id);
  return c ? c.label : "Other symptom";
}
export function trigLabel(pots, id) {
  const b = POTS_TRIG.find((x) => x.id === id);
  if (b) return b.label;
  const c = (pots?.settings?.customTrig || []).find((x) => x.id === id);
  return c ? c.label : "Other trigger";
}
export const libFor = (med) => POTS_MED_LIB.find((x) => x.id === med?.lib) || null;
export const medName = (pots, id) => ((pots?.meds || []).find((m) => m.id === id) || {}).name || "A medicine";

/** Amounts in her display units: "250 ml" / "8 oz"; "480 mg sodium" / "1.2 g salt". */
export const isOz = (units) => units?.fluid === "oz";
export const isGSalt = (units) => units?.salt === "gSalt";
export const amountText = (ml, units) => (isOz(units) ? `${Math.round(mlToOz(ml))} oz` : `${ml} ml`);
export const naText = (mg, units) => (isGSalt(units) ? fmtSodium(mg, units) : `${fmtSodium(mg, units)} sodium`);
/** "Glass 250 ml", "Electrolyte drink 500 ml · 480 mg sodium", "Salt tablet" (an intake or a preset). */
export function intakeText(x, units) {
  const parts = [];
  if (x.ml != null) parts.push(amountText(x.ml, units));
  if (x.naMg != null) parts.push(naText(x.naMg, units));
  const label = x.label || "Drink";
  return parts.length ? `${label} ${parts.join(" · ")}` : label;
}
/** A typed number ("" or not a number -> null). Accepts a decimal comma. */
export const numOf = (s) => { const t = String(s ?? "").trim().replace(",", "."); if (!t) return null; const n = Number(t); return Number.isFinite(n) ? n : null; };
/** Typed amounts to stored units: ml and mg sodium, whole numbers. */
export const toMl = (v, units) => (v == null ? null : Math.round(isOz(units) ? v * OZ_ML : v));
export const toNaMg = (v, gSalt) => (v == null ? null : Math.round(gSalt ? v * NA_PER_G_SALT : v));
/** Stored amounts to what an input shows in her unit. */
export const mlIn = (ml, units) => (ml == null ? "" : String(isOz(units) ? Math.round(mlToOz(ml) * 10) / 10 : ml));
export const naIn = (mg, gSalt) => (mg == null ? "" : String(gSalt ? Math.round((mg / NA_PER_G_SALT) * 10) / 10 : mg));

/** Numeric input props (design 4: numeric keyboard, digits only, no autofill). */
export const numProps = (decimal = false) => ({ type: "text", inputMode: decimal ? "decimal" : "numeric", pattern: decimal ? "[0-9]*[.,]?[0-9]*" : "[0-9]*", autoComplete: "off" });

/** The screen-owned safety announcement (design 4.4, "Announcing safety cards"): one empty
    sr-only role="alert" node rendered from mount; a card that appears because of an answer she
    just picked writes its first sentence into it once. The node is cleared first, so the same
    sentence picked again later is read again. Cards rendered on load are never announced. */
export function useAnnounce() {
  const [live, setLive] = useState("");
  const timer = useRef(null);
  const announce = (text) => {
    clearTimeout(timer.current);
    setLive("");
    timer.current = setTimeout(() => setLive(firstSentence(text)), 60);
  };
  return [live, announce];
}
