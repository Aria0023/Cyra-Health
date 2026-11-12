/* "Ask with evidence" (Pro, Task 3): her question answered by Claude with the web search tool, limited to evidence sites
   (backend/src/modules/ai/evidence.js), with numbered source links. Pure: no React, storage or network.
   What is sent: only her typed question, plus the pseudonymized summary of her log (lib/aiSummary.js) if she ticks
   "Include a summary of my log". She sees this exact body in "What Solia Health will send" before every send. A red-flag
   question is answered on this device (lib/askLibrary.js RED_FLAGS) and never sent. Nothing is kept on the server. */

/** The sites the server lets the search use, in words (the server's EVIDENCE_DOMAINS, said for people). */
export const EVIDENCE_SITES = "PubMed, MedlinePlus, CDC, NIH, ACOG, WHO, NICE, the Cochrane Library, the Endocrine Society and the FDA";

/** The request body, exactly as shown and sent. */
export const evidenceBody = (question, summary = null) => ({ question: String(question || "").trim().slice(0, 500), ...(summary ? { summary } : {}) });

/** Whether Ask with evidence is offered: the ai flag, a server and Pro (plan.js can("aiEvidence")). */
export const evidenceOffer = ({ flag = false, server = false, pro = false } = {}) => ({ shown: !!flag && !!server, open: !!flag && !!server && !!pro });

/** The answer split into paragraphs, each a list of text and [n] marks: [[{ text } | { n }]]. */
export function answerParts(answer) {
  return String(answer || "").split(/\n\s*\n/).map((para) => {
    const out = [];
    const re = /\[(\d{1,2})\]/g;
    let last = 0, m;
    while ((m = re.exec(para))) { if (m.index > last) out.push({ text: para.slice(last, m.index) }); out.push({ n: Number(m[1]) }); last = re.lastIndex; }
    if (last < para.length) out.push({ text: para.slice(last) });
    return out;
  }).filter((p) => p.length);
}

/** Sources the app shows: https only, numbered, at most 12. */
export const cleanSources = (list) => (Array.isArray(list) ? list : []).filter((s) => s && Number.isInteger(s.n) && typeof s.url === "string" && /^https:\/\//.test(s.url)).slice(0, 12).map((s) => ({ n: s.n, url: s.url, title: typeof s.title === "string" && s.title.trim() ? s.title.trim().slice(0, 200) : new URL(s.url).hostname }));

export const EVIDENCE_COPY = Object.freeze({
  title: "Ask with evidence",
  lead: `Answers that cite their sources: ${EVIDENCE_SITES}.`,
  label: "Your question",
  placeholder: "e.g. Do non-hormonal treatments help hot flashes?",
  includeSummary: "Include a summary of my log",
  includeHint: "Counts and averages only, no dates, notes or anything that names you. You'll see it in full before anything is sent.",
  ask: "Review and send",
  asking: "Searching the evidence…",
  sendLines: (summary) => [
    ["Who answers", `Claude, made by Anthropic, through Solia Health's server. Anthropic's search provider runs the search, only on ${EVIDENCE_SITES}.`],
    ["Summary of your log", summary ? "Included, shown in full below." : "Not included."],
    ["Kept", "Solia Health's server keeps nothing. Anthropic keeps the request for a limited time under its own terms."],
  ],
  sourcesLab: "Sources",
  opensIn: "opens in a new tab",
  foot: "Guidance, not a diagnosis or dosing advice. Bring what you read to your clinician.",
  locked: "With Pro, ask a question and get an answer that cites PubMed, MedlinePlus, CDC, NIH, ACOG, WHO, NICE and similar sources.",
  notSetUp: "Solia Health's AI isn't set up on this server yet, so nothing was sent.",
  offline: "You're offline, so nothing was sent. Try again when you're connected.",
  tooMany: "Too many questions in a minute. Wait a moment and try again.",
  noSources: "No sources could be found for that just now, so there's no answer. Try asking it another way.",
  refused: "This one can't be answered here. Please ask your clinician.",
  noAnswer: "No answer came back. Try again in a moment.",
  urgentLocal: "What you're describing needs care now, not an app. Please call your local emergency number (911 in the US) or go to urgent care. If you are thinking about harming yourself, call or text 988 (US) or your local crisis line. Your question wasn't sent anywhere.",
  tooShort: "Type a question first.",
});
