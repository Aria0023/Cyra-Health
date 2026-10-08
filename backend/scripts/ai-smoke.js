// AI proxy smoke test. Runs two backends: one with no key (rules fallback) and one
// pointed at a mock Anthropic server (ANTHROPIC_BASE_URL) that records the request
// and returns a structured-output response — so the SDK path is exercised end to end
// without a real key. Usage: node scripts/ai-smoke.js
import http from "http";
import { spawn } from "child_process";

const j = (r) => r.json();
const post = (base, path, body) => fetch(`${base}${path}`, { method: "POST", headers: { "content-type": "application/json", origin: "https://app.example" }, body: JSON.stringify(body) });
const assert = (cond, msg) => { if (!cond) { console.error("FAIL:", msg); process.exitCode = 1; } else console.log("ok  ", msg); };
const waitFor = async (url) => { for (let i = 0; i < 50; i++) { try { if ((await fetch(url)).ok) return; } catch {} await new Promise((r) => setTimeout(r, 100)); } throw new Error("backend did not start: " + url); };

// --- mock Anthropic Messages API ---
const seen = [];
const mock = http.createServer((req, res) => {
  let raw = ""; req.on("data", (c) => (raw += c)); req.on("end", () => {
    const body = JSON.parse(raw); seen.push({ headers: req.headers, body });
    const schema = body.output_config?.format?.schema; const out = {};
    for (const [k, p] of Object.entries(schema?.properties || {})) out[k] = p.type === "boolean" ? false : p.enum ? p.enum[0] : `mock ${k}`;
    if (out.stage) { out.stage = "peri"; out.label = "Perimenopause"; }
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ id: "msg_mock", type: "message", role: "assistant", model: body.model, stop_reason: "end_turn", stop_sequence: null, content: [{ type: "text", text: JSON.stringify(out) }], usage: { input_tokens: 1, output_tokens: 1 } }));
  });
});
await new Promise((r) => mock.listen(3999, r));

const start = (port, env) => spawn("node", ["server.js"], { env: { ...process.env, PORT: String(port), ...env }, stdio: ["ignore", "ignore", "inherit"] });
const rules = start(3101, { ANTHROPIC_API_KEY: "" });
const live = start(3102, { ANTHROPIC_API_KEY: "sk-ant-test", ANTHROPIC_BASE_URL: "http://127.0.0.1:3999", CORS_ORIGIN: "https://app.example" });
try {
  await waitFor("http://127.0.0.1:3101/health"); await waitFor("http://127.0.0.1:3102/health");
  const R = "http://127.0.0.1:3101", L = "http://127.0.0.1:3102";

  // rules fallback (no key)
  let r = await j(await post(R, "/api/ai/welcome", { stage: "Perimenopause", age: "45–54", goals: ["Sleep better"] }));
  assert(r.provider === "rules" && /Perimenopause space/.test(r.welcome), "welcome: rules fallback");
  r = await j(await post(R, "/api/ai/route", { preg: "no", age: "45p", per: "irregular", vms: "yes" }));
  assert(r.stage === "peri" && r.label === "Perimenopause", "route: rules → Perimenopause");
  r = await j(await post(R, "/api/ai/route", { preg: "yes" }));
  assert(r.stage === "preg", "route: pregnancy always wins");
  r = await j(await post(R, "/api/ai/ask", { question: "Does hormone therapy raise cancer risk?", stage: "Perimenopause" }));
  assert(r.provider === "rules" && /Menopause Society/.test(r.source_note) && r.urgent === false, "ask: library answer with named source");
  r = await j(await post(R, "/api/ai/ask", { question: "I'm soaking a pad every hour and feel faint" }));
  assert(r.urgent === true, "ask: red flags → urgent");
  r = await j(await post(R, "/api/ai/ask", { question: "What is the best color for a nursery?" }));
  assert(r.urgent === false && /don't have a written answer/.test(r.answer) && r.ask_your_doctor, "ask: unknown topic → honest no-answer");
  let s = await post(R, "/api/ai/ask", { question: "" }); assert(s.status === 400, "ask: empty question → 400");
  s = await post(R, "/api/ai/welcome", { stage: "Nope" }); assert(s.status === 400, "welcome: bad stage → 400");
  r = await j(await post(R, "/api/ai/insight", { stage: "Perimenopause", symptoms_last30: { "Hot flashes": 12, "Sleep disruption": 9 }, sleep_to_hotflash_multiplier: 1.8, cycle_lengths_days: [24, 33, 27], wearables: { avg_sleep_score: 61 }, name: "LEAK", entries: [{ date: "2026-01-01" }] }));
  assert(r.urgency === "next visit" && /9-day spread/.test(r.flag_for_doctor) && /CBT-I/.test(r.action), "insight: rules thresholds");

  // SDK path against the mock
  r = await j(await post(L, "/api/ai/ask", { question: "Why are my cramps worse some months?", stage: "My Cycle" }));
  assert(r.provider === "claude-opus-5-5" && r.answer === "mock answer" && r.urgent === false, "ask: SDK path returns cleaned structured output");
  const req = seen[seen.length - 1];
  assert(req.body.model === "claude-opus-5-5", "request: model claude-opus-5-5");
  assert(req.body.fallbacks === "default" && /server-side-fallback-2026-07-01/.test(req.headers["anthropic-beta"] || ""), "request: server-side refusal fallback on");
  assert(req.body.output_config?.format?.type === "json_schema" && req.body.output_config.effort === "medium", "request: json_schema structured output + effort");
  assert(req.headers["x-api-key"] === "sk-ant-test", "request: key sent only by the backend");
  assert(!/LEAK|entries/.test(JSON.stringify(req.body)) , "request: unknown fields never forwarded");
  assert(/Never diagnose/.test(req.body.system) && /doses/.test(req.body.system), "request: system prompt forbids diagnosis and dosing");
  r = await j(await post(L, "/api/ai/route", { preg: "no", age: "45p", per: "irregular", vms: "yes" }));
  assert(r.stage === "peri" && r.provider === "claude-opus-5-5", "route: SDK path validated enum");
  r = await j(await post(L, "/api/ai/insight", { stage: "Perimenopause", symptoms_last30: { "Hot flashes": 12 } }));
  assert(!/LEAK/.test(JSON.stringify(seen[seen.length - 1].body)) && r.urgency === "self-care", "insight: SDK path, enum cleaned");

  // CORS + rate limit
  const pre = await fetch(`${L}/api/ai/ask`, { method: "OPTIONS", headers: { origin: "https://app.example", "access-control-request-method": "POST" } });
  assert(pre.status === 204 && pre.headers.get("access-control-allow-origin") === "https://app.example", "cors: allowlisted origin preflight");
  const bad = await fetch(`${L}/api/ai/ask`, { method: "OPTIONS", headers: { origin: "https://evil.example" } });
  assert(bad.headers.get("access-control-allow-origin") === null, "cors: other origins get no header");
  let limited = 0; for (let i = 0; i < 25; i++) if ((await post(R, "/api/ai/route", { preg: "no" })).status === 429) limited++;
  assert(limited > 0, "rate limit: 429 after 20/min per IP");
} finally { rules.kill(); live.kill(); mock.close(); }
console.log(process.exitCode ? "AI SMOKE: FAILURES" : "AI SMOKE: all passed");
