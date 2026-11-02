/* "Questions for my visit" (doctor report v2, 2026-11-02): the questions she types on the Report screen for page 1 of
   the clinician summary. Persisted key `visitQuestions` (record, in backups, restored literally; record.js RULES). Pure,
   no imports: record.js and lib/clinicianSummary.js both use it. Her own words only; Solia Health suggests none here. */
export const QUESTIONS_MAX = 8;
export const QUESTION_LEN = 200;
const tidy = (s) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, QUESTION_LEN).trim();

/** Any stored value → her questions: strings, whitespace tidied, each at most QUESTION_LEN characters, empty ones and
    repeats dropped, at most QUESTIONS_MAX. */
export function cleanQuestions(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const q of raw) {
    if (typeof q !== "string") continue;
    const t = tidy(q);
    if (t && !out.includes(t)) out.push(t);
    if (out.length >= QUESTIONS_MAX) break;
  }
  return out;
}
/** Add one question: { ok, list, why? } (why: "empty" | "full" | "same"). The input list is not changed. */
export function addQuestion(list, text) {
  const cur = cleanQuestions(list);
  const t = tidy(text);
  if (!t) return { ok: false, list: cur, why: "empty" };
  if (cur.length >= QUESTIONS_MAX) return { ok: false, list: cur, why: "full" };
  if (cur.includes(t)) return { ok: false, list: cur, why: "same" };
  return { ok: true, list: [...cur, t] };
}
/** The list without question `i`. */
export const removeQuestion = (list, i) => cleanQuestions(list).filter((_, k) => k !== i);
