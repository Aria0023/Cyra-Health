// "Ask with evidence" (Pro, Task 3; docs/plans/account-wearables-evidence.md): POST /api/ai/evidence
//   { question, summary? } → { provider, answer, sources: [{ n, title, url }] }
//
// What it forwards to Anthropic: her typed question (trimmed, at most 500 characters) and, only if she ticked it in the
// app, the same pseudonymized summary the weekly write-up uses (re-checked by checkSummary; anything else is refused with
// 400). The app shows her this exact body ("What Solia Health will send") before every send. Anthropic runs the web search
// tool on its side, limited to the evidence domains below, so its search provider runs the search. Nothing is logged or
// stored here: a failure logs only its kind.
// Red flags are answered before anything is sent (the app answers them on the device first; this is the second check).
//
// The model call: the server web search tool (web_search_20260209, at most 5 searches, allowed_domains below), effort
// "medium", thinking left to the model's default (Opus 5.5 can't disable it), and the server-side refusal fallback.
// Answers are built from the text blocks; each `web_search_result_location` citation becomes a numbered source, so
// every cited sentence carries [n]. stop_reason "refusal" → { refused: true } with no answer; "pause_turn" (a long
// server-tool turn) is continued at most twice; a web search error arrives as a web_search_tool_result whose content is
// an error object (not an exception) and is reported as `searchError` — with no source at all the answer is withheld
// (502 no-sources), because an evidence answer without evidence is not what Pro promises.
import Anthropic from "@anthropic-ai/sdk";
import { checkSummary, RED_FLAGS, EMERGENCY_ANSWER } from "./tasks.js";

export const EVIDENCE_DOMAINS = Object.freeze(["pubmed.ncbi.nlm.nih.gov", "ncbi.nlm.nih.gov", "medlineplus.gov", "nih.gov", "cdc.gov", "acog.org", "who.int", "nice.org.uk", "cochranelibrary.com", "endocrine.org", "fda.gov"]);
export const EVIDENCE_TOOL = Object.freeze({ type: "web_search_20260209", name: "web_search", max_uses: 5, allowed_domains: EVIDENCE_DOMAINS });

export const EVIDENCE_SYSTEM = `You answer women's-health questions for Solia Health, a calm app. You must use the web_search tool to find evidence before answering, and base the answer only on what you find there.
Rules:
- Plain language at about an 8th-grade reading level. Short paragraphs, at most 220 words.
- Cite every medical claim to a search result. Do not make a medical claim you cannot cite.
- Say plainly when the evidence is weak, mixed, early, or only in small studies.
- Give guidance, never a diagnosis. Do not tell her what she has.
- Never give doses or dosing advice, and never tell her to start, stop or change a medicine or supplement.
- Never make a claim that anything works as contraception or prevents pregnancy, and never advise on contraception reliability.
- Suggest she brings the question to her clinician, and end with one short question she could ask them.
- If the question describes something urgent (heavy bleeding soaking a pad hourly, chest pain, trouble breathing, fainting, severe headache with vision changes, reduced fetal movement, thoughts of self-harm), do not search: say it needs care now and give the emergency line (call your local emergency number, 911 in the US; for thoughts of self-harm call or text 988 in the US).
- If a summary of her own logs is included, it is pseudonymized counts; you may relate the evidence to it, but never interpret it as a diagnosis.`;

const str = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const allowedUrl = (u) => {
  try { const x = new URL(u); return x.protocol === "https:" && EVIDENCE_DOMAINS.some((d) => x.hostname === d || x.hostname.endsWith(`.${d}`)); } catch { return false; }
};

/** The request body she was shown → { value } | { error }. */
export function validateEvidence(b = {}) {
  const question = str(b.question, 500);
  if (question.length < 3) return { error: "question is required" };
  if (b.summary != null) { const p = checkSummary(b.summary); if (p.length) return { error: p.join("; ") }; }
  return { value: { question, summary: b.summary ?? null } };
}

/** A model response's content → { answer, sources, searchError }. Pure; exported for the smoke test. */
export function buildAnswer(content = []) {
  const sources = []; // { n, title, url }
  const byUrl = new Map();
  let answer = "", searchError = null;
  for (const block of content) {
    if (block?.type === "web_search_tool_result") {
      const c = block.content;
      if (c && !Array.isArray(c) && typeof c === "object" && c.error_code) searchError = searchError || String(c.error_code).slice(0, 40);
      continue;
    }
    if (block?.type !== "text" || typeof block.text !== "string") continue;
    const marks = [];
    for (const cit of Array.isArray(block.citations) ? block.citations : []) {
      if (cit?.type !== "web_search_result_location" || !allowedUrl(cit.url)) continue;
      let n = byUrl.get(cit.url);
      if (!n) { n = sources.length + 1; byUrl.set(cit.url, n); sources.push({ n, title: str(cit.title, 200) || new URL(cit.url).hostname, url: cit.url }); }
      if (!marks.includes(n)) marks.push(n);
    }
    answer += block.text + (marks.length ? ` ${marks.map((n) => `[${n}]`).join("")}` : "");
  }
  answer = answer.replace(/[ \t]+\n/g, "\n").replace(/ {2,}/g, " ").trim().slice(0, 4000);
  return { answer, sources: sources.slice(0, 12), searchError };
}

const prompt = (v) => `Her question: "${v.question}"${v.summary ? `\nA pseudonymized summary of her own logs (JSON, counts only): ${JSON.stringify(v.summary)}` : ""}\nSearch the evidence sources, then answer under the rules.`;

/** Calls Claude with the web search tool. → { refused } | { answer, sources, searchError }. Throws on API errors. */
export async function askWithEvidence(client, model, v, { maxContinues = 2 } = {}) {
  const messages = [{ role: "user", content: prompt(v) }];
  const blocks = [];
  for (let turn = 0; turn <= maxContinues; turn++) {
    const r = await client.beta.messages.create({
      model,
      max_tokens: 8000, // thinking counts toward it on this model; the answer itself is short
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: EVIDENCE_SYSTEM,
      output_config: { effort: "medium" },
      tools: [{ ...EVIDENCE_TOOL, allowed_domains: [...EVIDENCE_DOMAINS] }],
      messages,
    });
    if (r.stop_reason === "refusal") return { refused: true, category: String(r.stop_details?.category || "unspecified").slice(0, 40) };
    blocks.push(...(r.content || []));
    if (r.stop_reason !== "pause_turn") break;
    messages.push({ role: "assistant", content: r.content }); // a long server-tool turn: let it carry on
  }
  return buildAnswer(blocks);
}

export function mountEvidence(router, { client, model, allow }) {
  router.post("/evidence", async (req, res) => {
    res.set("cache-control", "no-store");
    if (!allow(req.ip)) return res.status(429).json({ error: "too many requests — try again in a minute" });
    let size = 0; try { size = JSON.stringify(req.body || {}).length; } catch { size = Infinity; }
    if (size > 16_384) return res.status(413).json({ error: "body too large" });
    const input = validateEvidence(req.body || {});
    if (input.error) return res.status(400).json({ error: input.error });
    if (RED_FLAGS.test(input.value.question)) return res.json({ provider: "safety", urgent: true, answer: EMERGENCY_ANSWER, sources: [] });
    if (!client) return res.status(503).json({ error: "ai-not-configured" });
    try {
      const out = await askWithEvidence(client, model, input.value);
      if (out.refused) { console.warn(`[cyra] ai/evidence: model declined (${out.category})`); return res.json({ provider: model, refused: true, answer: "", sources: [] }); }
      if (!out.sources.length || !out.answer) { console.warn(`[cyra] ai/evidence: no sources${out.searchError ? ` (search: ${out.searchError})` : ""}`); return res.status(502).json({ error: "no-sources", searchError: out.searchError }); }
      res.json({ provider: model, answer: out.answer, sources: out.sources, ...(out.searchError ? { searchError: out.searchError } : {}) });
    } catch (e) {
      const kind = e instanceof Anthropic.RateLimitError ? "rate-limited" : e instanceof Anthropic.AuthenticationError ? "bad API key" : e instanceof Anthropic.APIConnectionTimeoutError ? "timed out" : e instanceof Anthropic.APIConnectionError ? "connection error" : e instanceof Anthropic.APIError ? `API ${e.status}` : e?.constructor?.name || "error";
      console.warn(`[cyra] ai/evidence: ${kind} — no answer`);
      res.status(502).json({ error: "no-answer" });
    }
  });
}
