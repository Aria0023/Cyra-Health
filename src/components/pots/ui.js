/* Small display helpers shared by the POTS components (no state, no storage, no network).
   Labels for symptoms, triggers and medicines, the time and date formats the design uses,
   amounts in her display units, and the screen-owned safety announcement (urgentLive). */
import { useEffect, useRef, useState } from "react";
import { POTS_SYM, POTS_TRIG, POTS_MED_LIB } from "../../lib/potsConstants.js";
import { localDay, mlToOz, fmtSodium, NA_PER_G_SALT, OZ_ML } from "../../lib/pots.js";
import { fmtDate } from "../../lib/i18n.js";

/** "08:05" -> "8:05" (the medicine rows and plan). */
export const hm = (t) => (typeof t === "string" ? t.replace(/^0(\d)/, "$1") : "");
/** "14:10" -> "2:10 pm" (the Last-logged row). */
export const ampm = (t) => {
  if (typeof t !== "string" || !/^\d{2}:\d{2}$/.test(t)) return "";
  const h = Number(t.slice(0, 2));
  return `${((h + 11) % 12) + 1}:${t.slice(3)} ${h < 12 ? "am" : "pm"}`;
};
/** "Sat, Oct 10". */
export const dayLabel = (iso) => fmtDate(iso, { weekday: "short", month: "short", day: "numeric" });
/** `iso` moved by `n` calendar days, as a local day key. */
export const addDays = (iso, n) => { const [y, m, d] = iso.split("-").map(Number); return localDay(new Date(y, m - 1, d + n)); };
/** The first sentence of a safety text (what urgentLive announces). */
export const firstSentence = (s) => { const m = /^[\s\S]*?[.!?](?=\s|$)/.exec(s || ""); return m ? m[0] : s || ""; };
export const SEV_WORD = { 1: "mild", 2: "moderate", 3: "strong" };
/** Whether the record really is being saved on this device (lib/storage.js driver(), as App
    holds it in storageDriver). null is "not probed yet" (a few ms at launch) and keeps the
    usual copy; "memory", "unreadable" and "stale" get the truthful variants below, so no
    POTS line says "saved on this device" while it isn't. */
export const potsSaved = (d) => d == null || d === "indexeddb" || d === "app-sandbox";
/** "memory" or "unreadable" (nothing is being saved) vs "stale" (saving stopped working). */
export const potsUnsaved = (d) => (potsSaved(d) ? null : d === "stale" ? "stale" : "memory");

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
/** A typed number ("" or not a number -> null). Thousands grouping ("2,500", "1.000",
    "1 000") is read as the whole number, never as a decimal, so a 2,500 ml goal or a
    1,000 mg label is never stored 1000x too small; otherwise one comma is a decimal comma
    ("1,5" -> 1.5). A grouped number in a decimal unit (1,000 oz, 1.500 g salt) lands outside
    the fields' range checks, which then show their error. */
const GROUPED = /^[1-9]\d{0,2}([,. \u00a0\u202f])\d{3}(\1\d{3})*$/;
export const numOf = (s) => {
  let t = String(s ?? "").trim();
  if (!t) return null;
  t = GROUPED.test(t) ? t.replace(/[,. \u00a0\u202f]/g, "") : t.replace(",", ".");
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};
/** Typed text that isn't a number (and isn't empty): a field shows an error for it instead of
    reading it as "left empty". */
export const notNum = (s) => String(s ?? "").trim() !== "" && numOf(s) == null;
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
    sentence picked again later is read again. Cards rendered on load are never announced.
    Calls made together (one tap that shows two cards, e.g. a faint while exercising) are
    joined in call order, so a later one never cancels an earlier one: the emergency sentence,
    announced first, is always read. */
export function useAnnounce() {
  const [live, setLive] = useState("");
  const timer = useRef(null), queue = useRef([]);
  const announce = (text) => {
    const s = firstSentence(text);
    if (s && !queue.current.includes(s)) queue.current.push(s);
    clearTimeout(timer.current);
    setLive("");
    timer.current = setTimeout(() => { setLive(queue.current.join(" ")); queue.current = []; }, 60);
  };
  return [live, announce];
}

/** Keeps a running test's or session's sticky Stop bar in reach while she types (design 4.8.5).
    Where the on-screen keyboard only shrinks the visual viewport (iOS Safari and WKWebView,
    Chrome's default), a bar stuck to the bottom of the page sits behind the keyboard: this
    returns the height the keyboard covers (0 where the page itself shrinks, or with no
    keyboard), which the runner uses as the bar's bottom offset plus a spacer of the same height
    after it. When a field takes focus or the keyboard opens, the page scrolls just enough that
    the field isn't under the bar. */
export function useKbLift(barRef) {
  const [kb, setKb] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    let raf = 0;
    const clear = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => { raf = requestAnimationFrame(() => {
        const el = document.activeElement, bar = barRef.current;
        if (!bar || !el || !/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
        const over = el.getBoundingClientRect().bottom - bar.getBoundingClientRect().top + 8;
        if (over > 0) window.scrollBy(0, over);
      }); });
    };
    const measure = () => setKb(vv ? Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)) : 0);
    const onResize = () => { measure(); clear(); };
    if (vv) { vv.addEventListener("resize", onResize); vv.addEventListener("scroll", measure); }
    document.addEventListener("focusin", clear);
    measure();
    return () => {
      cancelAnimationFrame(raf);
      if (vv) { vv.removeEventListener("resize", onResize); vv.removeEventListener("scroll", measure); }
      document.removeEventListener("focusin", clear);
    };
  }, []); // barRef is a stable ref
  return kb;
}
