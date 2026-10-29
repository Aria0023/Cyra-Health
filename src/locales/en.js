/* The English catalogue (calm R10): the source text for every key t() looks up, and the fallback for any key a
   later catalogue leaves out. Two parts:
   - UI (en-ui.js): the screens' own strings, moved out of the JSX with their exact text;
   - data: the copy that lives with its data (tab and log-sheet names, onboarding steps, the practice library, the
     mood check-in words, Cyra's AI copy), flattened here under stable keys so a second catalogue can translate it
     without touching the data modules. The data modules stay the single source of the English. */
import { UI } from "./en-ui.js";
import { TABS, LOG_ITEMS } from "../lib/routes.js";
import { STEP_COPY, PCOS_ANSWERS } from "../lib/onboarding.js";
import { PRACTICES, NEEDS, MOODS, FEELINGS, ENERGY_LEVELS, FOG_LEVELS, STRENGTH, PHASE_WORDS } from "../lib/mind.js";
import { AI_COPY } from "../lib/aiFeatures.js";

const DATA = {};
const put = (k, v) => { if (typeof v === "string" || typeof v === "function") DATA[k] = v; };
for (const x of TABS) put(`tab.${x.id}`, x.label);
for (const x of LOG_ITEMS) put(`log.${x.id}`, x.label);
for (const [step, copy] of Object.entries(STEP_COPY)) for (const [f, v] of Object.entries(copy)) put(`onb.step.${step}.${f}`, v);
for (const [id, label] of PCOS_ANSWERS) put(`onb.pcos.${id}`, label);
for (const p of PRACTICES) {
  for (const f of ["title", "short", "evidence", "caution", "line"]) put(`practice.${p.id}.${f}`, p[f]);
  (p.steps || []).forEach((s, i) => put(`practice.${p.id}.step${i}`, s.text));
}
for (const n of NEEDS) put(`need.${n.id}`, n.label);
for (const m of MOODS) put(`mood.${m.v}`, m.label);
for (const f of FEELINGS) put(`feeling.${f.id}`, f.label);
for (const [v, l] of ENERGY_LEVELS) put(`energy.${v}`, l);
for (const [v, l] of FOG_LEVELS) put(`fog.${v}`, l);
for (const [k, l] of Object.entries(STRENGTH)) put(`strength.${k}`, l);
for (const [k, l] of Object.entries(PHASE_WORDS)) put(`phase.${k}`, l);
for (const [k, v] of Object.entries(AI_COPY)) put(`ai.${k}`, v);

/* Plural helpers' forms (lib/i18n.js plural / t with { count }). */
const PLURALS = {
  "unit.days": { one: "{count} day", other: "{count} days" },
  "unit.daysLogged": { one: "{count} day logged", other: "{count} days logged" },
  "unit.messages": { one: "{count} message", other: "{count} messages" },
  "unit.min": { one: "{count} min", other: "{count} min" },
};

/* Strings written by hand where the screens build text outside JSX. */
const EXTRA = {
  "practiceSheet.done": "Done",
  "practiceSheet.doneDot": "Done.",
  "practiceSheet.stepOf": "Step {n} of {total}",
  "mind.level.energy": "Energy",
  "mind.level.fog": "Brain fog",
  "you.language": "Language",
  "you.languageLead": "Cyra follows this device's language when it has it. Your choice stays on this device and isn't part of a backup.",
  "you.languageDevice": "Same as this device",
  "you.whatEachOneAdds": "What each one adds",
  "cycles.body": "Body",
  "care.summary": "Options for your stage, with the ones that fit what you've logged first. That matching runs on your device, and partners never see your data.",
  "care.labels": "Every label below is the honest state of the evidence, including when something is comfort rather than treatment.",
  "care.seeOptions": { one: "See the option for your stage", other: "See {count} options for your stage" },
  "you.fertShort": "Cervical mucus, ovulation tests, temperature",
};

export const EN = Object.freeze({ ...DATA, ...PLURALS, ...EXTRA, ...UI });
export const EN_META = Object.freeze({ name: "English", tag: "en-US" });
