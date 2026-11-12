// "Ask with evidence" smoke test (Task 3): a backend pointed at a mock Anthropic Messages API (ANTHROPIC_BASE_URL, the
// ai-smoke pattern), so the SDK path runs end to end without a real key. Checks the request shape (model from config,
// web_search_20260209 with max_uses 5 and the allowed evidence domains, effort medium, no thinking:{disabled}, the
// server-side fallback beta), numbered sources from web_search_result_location citations (an off-list URL is dropped),
// stop_reason refusal, a web search error result block (no exception; no sources → 502 no-sources), pause_turn continued,
// red flags never forwarded, summary re-check, 503 without a key, and that the question is never logged.
// Usage: node scripts/evidence-smoke.js
import http from "http";
import fs from "fs";
import { spawn } from "child_process";
import { EVIDENCE_DOMAINS, buildAnswer } from "../src/modules/ai/evidence.js";

const assert = (c, m) => { if (!c) { console.error("FAIL:", m); process.exitCode = 1; } else console.log("ok  ", m); };
const waitFor = async (url) => { for (let i = 0; i < 60; i++) { try { if ((await fetch(url)).ok) return; } catch { /* not yet */ } await new Promise((r) => setTimeout(r, 100)); } throw new Error("backend did not start: " + url); };
const post = (base, body) => fetch(`${base}/api/ai/evidence`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

const cite = (url, title, text) => ({ type: "web_search_result_location", url, title, cited_text: text, encrypted_index: "x" });
const searchOk = { type: "web_search_tool_result", tool_use_id: "srv_1", content: [{ type: "web_search_result", url: "https://medlineplus.gov/hotflashes.html", title: "Hot flashes", encrypted_content: "x" }] };
const RESPONSES = {
  cite: [{ stop_reason: "end_turn", content: [
    { type: "server_tool_use", id: "srv_1", name: "web_search", input: { query: "hot flashes non-hormonal treatment" } },
    searchOk,
    { type: "text", text: "Several non-hormonal options reduce hot flashes." , citations: [cite("https://medlineplus.gov/hotflashes.html", "Hot flashes | MedlinePlus", "options"), cite("https://pubmed.ncbi.nlm.nih.gov/123/", "Trial of fezolinetant", "reduced")] },
    { type: "text", text: " The evidence for supplements is mixed.", citations: [cite("https://www.ncbi.nlm.nih.gov/books/1/", "Black cohosh", "mixed"), cite("https://example.com/blog", "A blog", "x")] },
    { type: "text", text: "\n\nAsk your clinician: which option fits my history?" },
  ] }],
  refusal: [{ stop_reason: "refusal", stop_details: { type: "refusal", category: "bio", explanation: "x" }, content: [] }],
  toolerror: [{ stop_reason: "end_turn", content: [
    { type: "server_tool_use", id: "srv_1", name: "web_search", input: { query: "q" } },
    { type: "web_search_tool_result", tool_use_id: "srv_1", content: { type: "web_search_tool_result_error", error_code: "max_uses_exceeded" } },
    { type: "text", text: "I couldn't search just now." },
  ] }],
  pause: [
    { stop_reason: "pause_turn", content: [{ type: "server_tool_use", id: "srv_1", name: "web_search", input: { query: "q" } }, searchOk] },
    { stop_reason: "end_turn", content: [{ type: "text", text: "Sleep improves with CBT-I.", citations: [cite("https://www.nice.org.uk/guidance/ng23", "NICE NG23", "CBT")] }] },
  ],
};
const seen = [];
let mode = "cite", step = 0;
const mock = http.createServer((req, res) => {
  let raw = ""; req.on("data", (c) => (raw += c)); req.on("end", () => {
    const body = JSON.parse(raw); seen.push({ url: req.url, headers: req.headers, body });
    const list = RESPONSES[mode]; const r = list[Math.min(step++, list.length - 1)];
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ id: "msg_mock", type: "message", role: "assistant", model: body.model, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 }, stop_details: null, ...r }));
  });
});
await new Promise((r) => mock.listen(3995, r));
let logged = "";
// a config with room for every case below (production: 6 a minute per client)
const cfg = JSON.parse(fs.readFileSync("config/app-dev.json")); cfg.ai = { ...cfg.ai, evidencePerMinute: 100 }; fs.writeFileSync("config/app.evidence-test.json", JSON.stringify(cfg));
const live = spawn("node", ["server.js"], { env: { ...process.env, PORT: "3107", NODE_ENV: "", ANTHROPIC_API_KEY: "sk-ant-test", ANTHROPIC_BASE_URL: "http://127.0.0.1:3995", AI_MODEL: "", CYRA_CONFIG: "config/app.evidence-test.json" }, stdio: ["ignore", "pipe", "pipe"] });
live.stdout.on("data", (c) => (logged += c)); live.stderr.on("data", (c) => (logged += c));
const nokey = spawn("node", ["server.js"], { env: { ...process.env, PORT: "3108", NODE_ENV: "", ANTHROPIC_API_KEY: "" }, stdio: ["ignore", "ignore", "ignore"] });
const L = "http://127.0.0.1:3107";
const Q = "What non-hormonal treatments help hot flashes? MARKER-7f3a";
try {
  await waitFor(`${L}/health`); await waitFor("http://127.0.0.1:3108/health");

  // citations → numbered sources
  mode = "cite"; step = 0; seen.length = 0;
  let r = await post(L, { question: Q });
  let j = await r.json();
  const req = seen[0]?.body || {};
  assert(r.status === 200 && seen.length === 1, "cite: one request to Anthropic");
  assert(req.model === "claude-opus-5-5", `model from config (${req.model})`);
  const tool = (req.tools || [])[0] || {};
  assert(tool.type === "web_search_20260209" && tool.name === "web_search" && tool.max_uses === 5 && JSON.stringify(tool.allowed_domains) === JSON.stringify(EVIDENCE_DOMAINS), "the web search tool: web_search_20260209, max_uses 5, the evidence domains");
  assert(!("thinking" in req) && req.output_config?.effort === "medium", "no thinking:{disabled}; effort medium");
  assert(/server-side-fallback-2026-07-01/.test(seen[0].headers["anthropic-beta"] || "") && req.fallbacks === "default", "server-side refusal fallback on");
  assert(!("format" in (req.output_config || {})), "no structured output (citations need plain text)");
  assert(JSON.stringify(req.messages).includes("MARKER-7f3a") && req.messages.length === 1 && !/summary/i.test(req.messages[0].content.replace(/Search the evidence/, "")), "only her question is sent (no summary unless she ticks it)");
  assert(j.sources.length === 3 && j.sources.map((s) => s.n).join() === "1,2,3" && j.sources.every((s) => s.url.startsWith("https://") && !s.url.includes("example.com")), `three numbered sources, the off-list one dropped (${j.sources.map((s) => s.url).join(" ")})`);
  assert(/hot flashes\. \[1\]\[2\]/.test(j.answer) && /mixed\. \[3\]/.test(j.answer) && /Ask your clinician/.test(j.answer), "the answer carries [n] markers after each cited sentence");

  // with the summary she ticked
  mode = "cite"; step = 0; seen.length = 0;
  const summary = { kind: "cyra-summary", version: 1, lifeStage: "Perimenopause", weeks: 8, daysLogged: 30 };
  r = await post(L, { question: Q, summary });
  assert(r.status === 200 && JSON.stringify(seen[0].body.messages).includes("Perimenopause"), "with the ticked summary: it goes with the question");
  r = await post(L, { question: Q, summary: { kind: "cyra-summary", note: "my name is Ada" } });
  assert(r.status === 400, "a summary that isn't the pseudonymized shape: 400, not forwarded");

  // refusal
  mode = "refusal"; step = 0;
  r = await post(L, { question: "Explain how this condition spreads" });
  j = await r.json();
  assert(r.status === 200 && j.refused === true && j.answer === "" && j.sources.length === 0, "stop_reason refusal: { refused: true }, no answer");

  // search error result block
  mode = "toolerror"; step = 0;
  r = await post(L, { question: Q });
  j = await r.json();
  assert(r.status === 502 && j.error === "no-sources" && j.searchError === "max_uses_exceeded", "web search error result: no exception, no sources → 502 no-sources with the error code");

  // pause_turn continued
  mode = "pause"; step = 0; seen.length = 0;
  r = await post(L, { question: "Does CBT help menopause sleep?" });
  j = await r.json();
  assert(r.status === 200 && seen.length === 2 && seen[1].body.messages.length === 2 && seen[1].body.messages[1].role === "assistant" && j.sources[0]?.url.includes("nice.org.uk"), "pause_turn: continued once, then answered with its source");

  // red flags: never forwarded
  seen.length = 0;
  r = await post(L, { question: "I'm soaking a pad every hour and feel faint" });
  j = await r.json();
  assert(j.urgent === true && j.provider === "safety" && seen.length === 0, "red flag: answered here, nothing sent to Anthropic");
  assert((await post(L, { question: "x" })).status === 400, "a question under 3 characters: 400");

  // no key
  r = await fetch("http://127.0.0.1:3108/api/ai/evidence", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question: Q }) });
  assert(r.status === 503, "no ANTHROPIC_API_KEY: 503 ai-not-configured");

  // pure helper
  const b = buildAnswer([{ type: "text", text: "A", citations: [cite("http://cdc.gov/x", "plain http", "a")] }]);
  assert(b.sources.length === 0, "buildAnswer: a non-https URL is dropped");
  await new Promise((res) => setTimeout(res, 200));
  assert(!logged.includes("MARKER-7f3a") && !logged.includes("soaking"), "nothing she typed is logged");
  // the per-client limit (6 a minute on the default config)
  const statuses = [];
  for (let i = 0; i < 7; i++) statuses.push((await post("http://127.0.0.1:3108", { question: "Does CBT help menopause sleep?" })).status);
  // one request already went to this server above, so the sixth of these is the seventh in the minute
  assert(statuses.slice(0, 5).every((x) => x === 503) && statuses.slice(5).every((x) => x === 429), `rate limit: the seventh request in a minute answers 429 (${statuses.join(",")})`);
} finally {
  live.kill(); nokey.kill(); mock.close(); fs.rmSync("config/app.evidence-test.json", { force: true });
}
console.log(process.exitCode ? "EVIDENCE SMOKE: FAILURES" : "EVIDENCE SMOKE: all passed");
process.exit();
