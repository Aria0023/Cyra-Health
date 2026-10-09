// AI proxy smoke test. Runs backends with no key (rules fallback) and pointed at a mock
// Anthropic server (ANTHROPIC_BASE_URL) that records each request and returns a
// structured-output response — so the SDK path is exercised end to end without a real
// key. Checks: only `ask` is mounted (welcome/route/insight → 404), the stage is optional
// and the question is the only user content forwarded, one attempt with no retry, and a
// slow API answered by the fallback inside the time limit. Usage: node scripts/ai-smoke.js
import http from "http";
import fs from "fs";
import { spawn } from "child_process";

const j = (r) => r.json();
const post = (base, path, body) => fetch(`${base}${path}`, { method: "POST", headers: { "content-type": "application/json", origin: "https://app.example" }, body: JSON.stringify(body) });
const assert = (cond, msg) => { if (!cond) { console.error("FAIL:", msg); process.exitCode = 1; } else console.log("ok  ", msg); };
const waitFor = async (url) => { for (let i = 0; i < 50; i++) { try { if ((await fetch(url)).ok) return; } catch {} await new Promise((r) => setTimeout(r, 100)); } throw new Error("backend did not start: " + url); };

// --- mock Anthropic Messages API ---
const seen = [];
let mode = "ok"; // "ok" | "fail" (HTTP 500) | "slow" (answers after 2.5 s)
const mock = http.createServer((req, res) => {
  let raw = ""; req.on("data", (c) => (raw += c)); req.on("end", () => {
    const body = JSON.parse(raw); seen.push({ headers: req.headers, body });
    if (mode === "fail") { res.writeHead(500, { "content-type": "application/json" }); return res.end(JSON.stringify({ type: "error", error: { type: "api_error", message: "mock failure" } })); }
    const schema = body.output_config?.format?.schema; const out = {};
    for (const [k, p] of Object.entries(schema?.properties || {})) out[k] = p.type === "boolean" ? false : p.enum ? p.enum[0] : `mock ${k}`;
    const send = () => { res.setHeader("content-type", "application/json"); res.end(JSON.stringify({ id: "msg_mock", type: "message", role: "assistant", model: body.model, stop_reason: "end_turn", stop_sequence: null, content: [{ type: "text", text: JSON.stringify(out) }], usage: { input_tokens: 1, output_tokens: 1 } })); };
    if (mode === "slow") setTimeout(send, 2500); else send();
  });
});
await new Promise((r) => mock.listen(3999, r));

// a config with a 1-second API limit for the timeout check (12 s in production)
const cfg = JSON.parse(fs.readFileSync("config/app-dev.json")); cfg.ai = { ...cfg.ai, timeoutMs: 1000 }; fs.writeFileSync("config/app.ai-test.json", JSON.stringify(cfg));
const start = (port, env) => spawn("node", ["server.js"], { env: { ...process.env, PORT: String(port), NODE_ENV: "", ...env }, stdio: ["ignore", "ignore", "inherit"] });
const rules = start(3101, { ANTHROPIC_API_KEY: "" });
const live = start(3102, { ANTHROPIC_API_KEY: "sk-ant-test", ANTHROPIC_BASE_URL: "http://127.0.0.1:3999", CORS_ORIGIN: "https://app.example" });
const quick = start(3109, { ANTHROPIC_API_KEY: "sk-ant-test", ANTHROPIC_BASE_URL: "http://127.0.0.1:3999", CYRA_CONFIG: "config/app.ai-test.json" });
try {
  await waitFor("http://127.0.0.1:3101/health"); await waitFor("http://127.0.0.1:3102/health"); await waitFor("http://127.0.0.1:3109/health");
  const R = "http://127.0.0.1:3101", L = "http://127.0.0.1:3102", Q = "http://127.0.0.1:3109";

  // only ask is mounted: the app builds its welcome and routing on the device
  for (const [path, body] of [["/api/ai/welcome", { stage: "Perimenopause", age: "45–54", goals: ["Sleep better"] }], ["/api/ai/route", { preg: "no", age: "45p", per: "irregular", vms: "yes" }], ["/api/ai/insight", { stage: "Perimenopause", symptoms_last30: { "Hot flashes": 12 } }]]) {
    for (const base of [R, L]) { const s = await post(base, path, body); assert(s.status === 404, `${path}: not mounted → ${s.status}`); }
  }
  assert(seen.length === 0, "welcome/route/insight: nothing reached Anthropic");

  // rules fallback (no key)
  let r = await j(await post(R, "/api/ai/ask", { question: "Does hormone therapy raise cancer risk?" }));
  assert(r.provider === "rules" && /Menopause Society/.test(r.source_note) && r.urgent === false, "ask: no stage needed — library answer with named source");
  r = await j(await post(R, "/api/ai/ask", { question: "Does hormone therapy raise cancer risk?", stage: "Perimenopause" }));
  assert(r.provider === "rules" && /Menopause Society/.test(r.source_note), "ask: an optional stage is still accepted");
  r = await j(await post(R, "/api/ai/ask", { question: "I'm soaking a pad every hour and feel faint" }));
  assert(r.urgent === true, "ask: red flags → urgent");
  r = await j(await post(R, "/api/ai/ask", { question: "What is the best color for a nursery?" }));
  assert(r.urgent === false && /don't have a written answer/.test(r.answer) && /Cyra's AI wasn't available/.test(r.answer) && r.ask_your_doctor, "ask: unknown topic → honest no-answer naming Cyra's AI");
  let s = await post(R, "/api/ai/ask", { question: "" }); assert(s.status === 400, "ask: empty question → 400");

  // SDK path against the mock
  r = await j(await post(L, "/api/ai/ask", { question: "Why are my cramps worse some months?", name: "LEAK", entries: [{ date: "2026-01-01" }], email: "leak@example.com" }));
  assert(r.provider === "claude-opus-5-5" && r.answer === "mock answer" && r.urgent === false, "ask: SDK path returns cleaned structured output");
  const req = seen[seen.length - 1];
  const userText = req.body.messages.map((m) => (typeof m.content === "string" ? m.content : JSON.stringify(m.content))).join("\n");
  assert(req.body.model === "claude-opus-5-5", "request: model claude-opus-5-5");
  assert(req.body.fallbacks === "default" && /server-side-fallback-2026-07-01/.test(req.headers["anthropic-beta"] || ""), "request: server-side refusal fallback on");
  assert(req.body.output_config?.format?.type === "json_schema" && req.body.output_config.effort === "low" && req.body.max_tokens === 4000, "request: json_schema structured output + effort low + max_tokens 4000 (room for thinking)");
  assert(req.headers["x-api-key"] === "sk-ant-test", "request: key sent only by the backend");
  assert(!/LEAK|entries|leak@example/.test(JSON.stringify(req.body)), "request: unknown fields never forwarded");
  assert(userText.includes('"Why are my cramps worse some months?"') && /life stage: not stated\./.test(userText) && !/life stage: (My Cycle|Trying|Pregnancy|Perimenopause|Menopause)/.test(userText) && !/LEAK|leak@/.test(userText), "request: without a stage the prompt carries only the typed question");
  assert(/Never diagnose/.test(req.body.system) && /doses/.test(req.body.system), "request: system prompt forbids diagnosis and dosing");

  // one attempt, no retry: a failing API is asked exactly once, then the library answers
  mode = "fail"; let before = seen.length;
  r = await j(await post(L, "/api/ai/ask", { question: "Why are my cramps worse some months?" }));
  mode = "ok";
  assert(seen.length - before === 1 && r.provider === "rules" && r.degraded === true, `ask: API error → asked once (${seen.length - before}), no retry, library fallback`);
  // a slow API is cut off at the limit and answered by the fallback (12 s in production, inside the app's 15 s wait; 1 s here)
  mode = "slow"; before = seen.length; const t0 = Date.now();
  r = await j(await post(Q, "/api/ai/ask", { question: "Why are my cramps worse some months?" }));
  const took = Date.now() - t0; mode = "ok";
  assert(r.provider === "rules" && r.degraded === true && took < 2000 && seen.length - before === 1, `ask: slow API → fallback after the time limit (${took} ms), one attempt`);

  // CORS + rate limit
  const pre = await fetch(`${L}/api/ai/ask`, { method: "OPTIONS", headers: { origin: "https://app.example", "access-control-request-method": "POST" } });
  assert(pre.status === 204 && pre.headers.get("access-control-allow-origin") === "https://app.example", "cors: allowlisted origin preflight");
  const bad = await fetch(`${L}/api/ai/ask`, { method: "OPTIONS", headers: { origin: "https://evil.example" } });
  assert(bad.headers.get("access-control-allow-origin") === null, "cors: other origins get no header");
  let limited = 0; for (let i = 0; i < 25; i++) if ((await post(R, "/api/ai/ask", { question: "Does exercise help sleep?" })).status === 429) limited++;
  assert(limited > 0, `rate limit: 429 after 20/min per address (${limited} of 25 refused)`);
} finally { rules.kill(); live.kill(); quick.kill(); mock.close(); fs.rmSync("config/app.ai-test.json", { force: true }); }
console.log(process.exitCode ? "AI SMOKE: FAILURES" : "AI SMOKE: all passed");
