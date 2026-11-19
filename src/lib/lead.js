/* The lead of a suggestion: the short part shown in bold so the point can be read at a glance (owner request
   2026-11-19). Pure; the wording itself is never changed, only split in two.
   splitLead(text) → [lead, rest]; lead is "" when nothing short enough stands out, and lead + rest === text.
   Rules, first that fits:
     1. more than one sentence: the first sentence, when it is at most LEAD_MAX characters;
     2. one sentence with a label ("Worth asking: ..."): up to and including the colon;
     3. one sentence with an opening clause ("After a rough night, ..."): up to and including the first comma;
     4. otherwise nothing is bold (a whole sentence in bold reads as shouting). */
export const LEAD_MAX = 110;
const CLAUSE_MAX = 48;

export function splitLead(text) {
  if (typeof text !== "string") return ["", text];
  const s = text;
  // A sentence end: . ! or ? (and a closing quote or bracket), then space, then a capital, digit or opening quote.
  const m = /^(\s*\S.*?[.!?]["'”’)]?)(\s+)(?=["'“‘(]?[A-Z0-9])/s.exec(s);
  if (m && m[1].trim().length <= LEAD_MAX && !/\b(e\.g|i\.e|vs|approx|Dr|Mr|Ms|Mrs)\.$/.test(m[1])) return [m[1], s.slice(m[1].length)];
  if (m) return ["", s];
  const colon = /^(\s*[^:]{3,48}:)(?=\s)/.exec(s);
  if (colon) return [colon[1], s.slice(colon[1].length)];
  const comma = /^(\s*[^,]+,)(?=\s)/.exec(s);
  if (comma && comma[1].trim().length <= CLAUSE_MAX && comma[1].trim().split(/\s+/).length >= 2 && s.length - comma[1].length >= 12) return [comma[1], s.slice(comma[1].length)];
  return ["", s];
}
