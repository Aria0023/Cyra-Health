/* Registers the catalogues this build ships (calm R10) and holds the small helpers that localise copy which lives
   with its data. Import once, before the first render (main.jsx). Today only English ships, so lib/i18n.js
   pickerShown() is false and the You page's Language card stays hidden. A second language: add ./<code>.js with
   every key of EN (a unit test can compare key sets) and one addCatalogue line below. */
import { addCatalogue, t } from "../lib/i18n.js";
import { EN, EN_META } from "./en.js";

addCatalogue("en", EN, EN_META);

/** A practice with its words in the current language (the data object is never changed). */
export function localPractice(p) {
  if (!p) return p;
  const k = (f) => `practice.${p.id}.${f}`;
  return {
    ...p,
    title: t(k("title")), short: t(k("short")), evidence: t(k("evidence")), line: t(k("line")),
    caution: p.caution ? t(k("caution")) : p.caution,
    steps: p.steps ? p.steps.map((s, i) => ({ ...s, text: t(k(`step${i}`)) })) : p.steps,
  };
}
/** Onboarding step copy ({ short, title, sub, ... }) in the current language. */
export function stepCopy(key, copy) {
  if (!copy) return copy;
  const out = {};
  for (const [f, v] of Object.entries(copy)) out[f] = typeof v === "string" ? t(`onb.step.${key}.${f}`) : v;
  return out;
}
/** Tabs / log items with their labels in the current language. */
export const localTabs = (tabs) => tabs.map((x) => ({ ...x, label: t(`tab.${x.id}`) }));
export const localItems = (items) => items.map((x) => ({ ...x, label: t(`log.${x.id}`) }));
