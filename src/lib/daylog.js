/* Her daily log, made personal (L6, decisions D7 and D8): her symptom list per stage (which chips show first and
   in what order, which sit under "More symptoms", which she added from the other stage's library) and the day
   note. Pure: no React, no storage, no network; it imports only ./constants.js and never lib/record.js
   (record.js imports this file to check symPrefs).

   symPrefs = { periods?: StagePrefs, peri?: StagePrefs, preg?: StagePrefs }, StagePrefs = { order, hidden, added }
   (each a list of symptom ids). It is keyed by stage id, so My Cycle and Trying to conceive share "periods", and
   Perimenopause and Menopause share "peri". Pregnancy has order and hide only: nothing can be borrowed into it.
   An empty record ({}) is Cyra's order: every library chip shows, in library order, and nothing is hidden.

   The tracked list (trackedIds: the library plus what she added, hidden ones included) is what every insight,
   chart, calendar card, report row and the doctor email runs on, so hiding a chip never hides what she logged. */
import { SYM, PSYM, GSYM } from "./constants.js";

export const STAGE_LIB = Object.freeze({ periods: PSYM, peri: SYM, preg: GSYM });
const STAGE_IDS = Object.freeze(["periods", "peri", "preg"]);
const ID_RE = /^[a-z][a-z0-9_]{0,15}$/;
const LIST_MAX = 40;
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const plain = (x) => x !== null && typeof x === "object" && !Array.isArray(x);
const libOf = (stage) => (typeof stage === "string" && has(STAGE_LIB, stage) ? STAGE_LIB[stage] : null);

/** The ids of the other stage's library that this stage's library lacks (what "Add from the … list" offers):
    periods → hf, ns, fog, slp, ach, dry, pal, anx, itc; peri → crm, blo, ten, acn, bak, nau, cra; any other → []. */
export function borrowable(stage) {
  if (stage === "periods") return Object.keys(SYM).filter((id) => !has(PSYM, id));
  if (stage === "peri") return Object.keys(PSYM).filter((id) => !has(SYM, id));
  return [];
}

/* A list of distinct well-formed ids, at most LIST_MAX (unknown ids are kept for a later version, and ignored). */
const cleanList = (v) => {
  const out = [];
  if (!Array.isArray(v)) return out;
  for (const x of v) {
    if (out.length >= LIST_MAX) break;
    if (typeof x === "string" && ID_RE.test(x) && !out.includes(x)) out.push(x);
  }
  return out;
};

/** A clean symPrefs (a new object): {} unless v is a plain object. Keeps only the stage keys periods, peri and
    preg, in the input's key order (so a clean record comes back byte-identical in JSON), each as
    { order, hidden, added } of distinct ids matching /^[a-z][a-z0-9_]{0,15}$/, at most 40 each. A stage whose
    three lists are empty is dropped. */
export function cleanSymPrefs(v) {
  if (!plain(v)) return {};
  const out = {};
  for (const st of Object.keys(v)) {
    if (!STAGE_IDS.includes(st) || !plain(v[st])) continue;
    const e = { order: cleanList(v[st].order), hidden: cleanList(v[st].hidden), added: cleanList(v[st].added) };
    if (e.order.length || e.hidden.length || e.added.length) out[st] = e;
  }
  return out;
}

/** One stage's { order, hidden, added } (clean copies; empty lists when nothing is set). */
export function prefsFor(prefs, stage) {
  const p = plain(prefs) && typeof stage === "string" && has(prefs, stage) && plain(prefs[stage]) ? prefs[stage] : {};
  return { order: cleanList(p.order), hidden: cleanList(p.hidden), added: cleanList(p.added) };
}

/** The tracked list for a stage: its library in library order, then the borrowable ids she added, in the order she
    added them (hidden ones included). [] for an unknown stage. */
export function trackedIds(stage, prefs) {
  const lib = libOf(stage);
  if (!lib) return [];
  const can = borrowable(stage);
  return [...Object.keys(lib), ...prefsFor(prefs, stage).added.filter((id) => can.includes(id))];
}

/** The grid: first = her order (ids still tracked and not hidden), then the other shown ids in tracked order;
    more = the hidden tracked ids, in tracked order (under "More symptoms"). */
export function chipLayout(stage, prefs) {
  const tracked = trackedIds(stage, prefs);
  const p = prefsFor(prefs, stage);
  const hidden = p.hidden.filter((id) => tracked.includes(id));
  const shown = tracked.filter((id) => !hidden.includes(id));
  const first = [...p.order.filter((id) => shown.includes(id)), ...shown.filter((id) => !p.order.includes(id))];
  const more = tracked.filter((id) => hidden.includes(id));
  return { first, more };
}

/* A NEW prefs object with `stage` set to entry (other stages are the same objects, in the same key order). An order
   that is exactly Cyra's order for what is shown (the tracked ids minus the hidden ones) is stored as [], and the stage
   is dropped when all three of its lists are empty, so undoing every change leaves {}. */
const withStage = (prefs, stage, entry) => {
  const base = plain(prefs) ? prefs : {};
  const can = borrowable(stage);
  const shown = [...Object.keys(libOf(stage) || {}), ...entry.added.filter((id) => can.includes(id))].filter((id) => !entry.hidden.includes(id));
  if (entry.order.length === shown.length && entry.order.every((id, i) => id === shown[i])) entry = { ...entry, order: [] };
  if (entry.order.length || entry.hidden.length || entry.added.length) return { ...base, [stage]: entry };
  const out = {};
  for (const k of Object.keys(base)) if (k !== stage) out[k] = base[k];
  return out;
};

/** Move a shown symptom one place up (dir -1) or down (dir +1): it swaps with its neighbour in the first list, and the
    whole first list is stored as order. No change (the same object) at either end or for an id not shown first. */
export function moveSym(prefs, stage, id, dir) {
  const { first } = chipLayout(stage, prefs);
  const i = first.indexOf(id), j = i + dir;
  if (i < 0 || (dir !== 1 && dir !== -1) || j < 0 || j >= first.length) return prefs;
  const order = [...first];
  order[i] = first[j]; order[j] = id;
  return withStage(prefs, stage, { ...prefsFor(prefs, stage), order });
}

/** Hide a shown symptom (it moves under "More symptoms"). No change when it isn't shown first, or when it is the only one. */
export function hideSym(prefs, stage, id) {
  const { first } = chipLayout(stage, prefs);
  if (!first.includes(id) || first.length <= 1) return prefs;
  const p = prefsFor(prefs, stage);
  return withStage(prefs, stage, { ...p, hidden: [...p.hidden, id] });
}

/** Show a hidden symptom first again, at the end of the first list. No change for an id that isn't hidden. */
export function showSym(prefs, stage, id) {
  const { first, more } = chipLayout(stage, prefs);
  if (!more.includes(id)) return prefs;
  const p = prefsFor(prefs, stage);
  return withStage(prefs, stage, { ...p, order: [...first, id], hidden: p.hidden.filter((x) => x !== id) });
}

/** Add a symptom from the other stage's library, at the end of the first list. Only borrowable ids not added yet. */
export function addSym(prefs, stage, id) {
  const p = prefsFor(prefs, stage);
  if (!borrowable(stage).includes(id) || p.added.includes(id)) return prefs;
  const { first } = chipLayout(stage, prefs);
  return withStage(prefs, stage, { order: [...first, id], hidden: p.hidden.filter((x) => x !== id), added: [...p.added, id] });
}

/** True when any day in the list logged this symptom (a severity above 0). */
export const loggedEver = (days, id) => Array.isArray(days) && days.some((d) => (d?.sym?.[id] || 0) > 0);

/** A symptom she added can be removed from her list only while nothing was ever logged for it, so her history stays whole. */
export const canRemove = (prefs, stage, id, days) => prefsFor(prefs, stage).added.includes(id) && !loggedEver(days, id);

/** Remove an added symptom (from order, hidden and added). No change (the same object) unless canRemove. */
export function removeSym(prefs, stage, id, days) {
  if (!canRemove(prefs, stage, id, days)) return prefs;
  const p = prefsFor(prefs, stage);
  const drop = (l) => l.filter((x) => x !== id);
  return withStage(prefs, stage, { order: drop(p.order), hidden: drop(p.hidden), added: drop(p.added) });
}

/** "Put back Cyra's order": order and hidden cleared, what she added kept (it then shows at the end, in the order added). */
export function resetSyms(prefs, stage) {
  const p = prefsFor(prefs, stage);
  if (!p.order.length && !p.hidden.length) return prefs;
  return withStage(prefs, stage, { order: [], hidden: [], added: p.added });
}

/* ---------------- the day note (D7) ---------------- */

/** At most this many UTF-16 units (an emoji uses two), the same unit the textarea's maxLength counts. */
export const NOTE_MAX = 280;

/** The note as it is saved: '' for anything but a string; CRLF / CR become LF, it is cut to 280 units (never in the
    middle of a surrogate pair) and trimmed. An empty result means "no note" (the entry gets no note key). */
export function cleanNote(s) {
  if (typeof s !== "string") return "";
  let t = s.replace(/\r\n?/g, "\n").slice(0, NOTE_MAX);
  const last = t.charCodeAt(t.length - 1);
  if (last >= 0xd800 && last <= 0xdbff) t = t.slice(0, -1);
  return t.trim();
}
