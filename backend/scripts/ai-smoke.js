// AI proxy smoke test. Runs backends with no key (rules fallback) and pointed at a mock
// Anthropic server (ANTHROPIC_BASE_URL) that records each request and returns a
// structured-output response — so the SDK path is exercised end to end without a real
// key. Checks: only `ask` is mounted (welcome/route/insight → 404), the stage is optional
// and the question is the only user content forwarded, one attempt with no retry, and a
// slow API answered by the fallback inside the time limit. Calm R8: weekly and chat (status, 503 without a key,
// summary re-check, size caps, red flags never forwarded, multi-turn shape, nothing logged). Usage: node scripts/ai-smoke.js
import http from "http";
import fs from "fs";
import { spawn } from "child_process";
import { checkSummary as serverCheck, EMERGENCY_ANSWER } from "../src/modules/ai/tasks.js";
import { buildSummary, SUMMARY_VOCAB, chatBody, weeklyBody } from "../../src/lib/aiSummary.js";

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
// calm R8: a server whose every output line is captured, to prove no summary or question is ever logged
let logged = "";
const watched = spawn("node", ["server.js"], { env: { ...process.env, PORT: "3110", NODE_ENV: "", ANTHROPIC_API_KEY: "sk-ant-test", ANTHROPIC_BASE_URL: "http://127.0.0.1:3999" }, stdio: ["ignore", "pipe", "pipe"] });
watched.stdout.on("data", (c) => (logged += c)); watched.stderr.on("data", (c) => (logged += c));
const rules2 = start(3111, { ANTHROPIC_API_KEY: "" }); // calm R8: no key, not yet rate-limited
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
  assert(r.urgent === false && /don't have a written answer/.test(r.answer) && /Heard Health's AI wasn't available/.test(r.answer) && r.ask_your_doctor, "ask: unknown topic → honest no-answer naming Heard Health's AI");
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

  /* ---------------- calm R8: weekly write-up and chat ---------------- */
  await waitFor("http://127.0.0.1:3110/health"); await waitFor("http://127.0.0.1:3111/health");
  const W = "http://127.0.0.1:3110", R2 = "http://127.0.0.1:3111";
  const days = []; for (let i = 60; i >= 0; i--) { const d = new Date(Date.UTC(2026, 9, 29 - i)).toISOString().slice(0, 10); days.push({ date: d, period: i % 29 < 4, sym: { crm: i % 29 < 4 ? 2 : 0, blo: i % 3 ? 0 : 1 }, note: "LEAKNOTE Maya" }); }
  const summary = buildSummary({ stage: "periods", stageName: "My Cycle", entries: days, todayIso: "2026-10-29", pcosOn: true, includeLabs: true, labs: [{ id: "a", kind: "fglu", value: 97, unit: "mg/dL", date: "2026-10-01" }] });
  // every label the app may send passes the server's own check
  const badLabels = [...SUMMARY_VOCAB].filter((t) => serverCheck({ kind: "cyra-summary", symptoms: [{ name: t, days: 1 }] }).length);
  assert(badLabels.length === 0, `server check accepts every label of the app's fixed lists (${badLabels.join(" | ") || "all"})`);
  assert(serverCheck(summary).length === 0, "server check accepts a real summary");

  // status
  let st = await j(await fetch(`${R2}/api/ai/status`)); assert(st.ready === false, "status: no key → ready false");
  st = await j(await fetch(`${W}/api/ai/status`)); assert(st.ready === true, "status: key set → ready true");

  // no key: 503, nothing forwarded, no rules text pretending to be AI
  before = seen.length;
  s = await post(R2, "/api/ai/weekly", weeklyBody(summary)); assert(s.status === 503 && (await j(s)).error === "ai-not-configured", "weekly without a key → 503 ai-not-configured");
  s = await post(R2, "/api/ai/chat", chatBody({ summary, question: "Why is day 3 hard?" })); assert(s.status === 503, "chat without a key → 503");
  assert(seen.length === before, "no key: nothing reached Anthropic");

  // weekly through the SDK path
  before = seen.length;
  r = await j(await post(W, "/api/ai/weekly", { ...weeklyBody(summary), name: "LEAKNAME", email: "leak@example.com" }));
  assert(r.provider === "claude-opus-5-5" && r.writeup === "mock writeup" && r.ask_your_doctor === "mock ask_your_doctor", "weekly: cleaned structured output");
  let q = seen[seen.length - 1];
  let sent = JSON.stringify(q.body);
  assert(seen.length - before === 1, "weekly: one request upstream");
  assert(!/LEAK|leak@|2026-|Maya/.test(sent), "weekly: no extra field, note, name or date forwarded");
  assert(sent.includes(JSON.stringify(JSON.stringify(summary)).slice(1, -1)), "weekly: the summary is forwarded exactly as sent");
  assert(/associations/.test(q.body.system) && /Never diagnose/.test(q.body.system) && /Never grade/.test(q.body.system) && /Never interpret a lab value/.test(q.body.system) && /911/.test(q.body.system) && /180 words/.test(JSON.stringify(q.body.messages)), "weekly: system prompt frames associations, no diagnosis or grades, emergency line; ≤ 180 words");
  assert(q.headers["x-api-key"] === "sk-ant-test", "weekly: the key is added by the server");

  // rejected summaries never go upstream
  before = seen.length;
  for (const [label, body] of [["a date inside", { summary: { ...summary, lifeStage: "2026-10-01" } }], ["an email inside", { summary: { ...summary, symptoms: [{ name: "a@b.co", days: 1 }] } }], ["a free-text field", { summary: { ...summary, note: "hello" } }], ["a long text", { summary: { ...summary, lifeStage: "x".repeat(80) } }], ["no summary", {}]]) {
    s = await post(W, "/api/ai/weekly", body); assert(s.status === 400, `weekly: ${label} → 400`);
  }
  s = await post(W, "/api/ai/chat", { summary: { ...summary, symptoms: Array.from({ length: 12 }, () => ({ name: "Cramps", days: 1, byCycleDay: { cd1to5: 1 } })) }, question: "x".repeat(400), history: Array.from({ length: 6 }, () => ({ role: "user", text: "y".repeat(1200) })) });
  assert(s.status === 200 || s.status === 400, "chat: a large but valid body is handled");
  s = await fetch(`${W}/api/ai/chat`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ summary, question: "q", pad: "z".repeat(20000) }) });
  assert(s.status === 413, `size cap: a body over 16 kB → 413 (${s.status})`);
  s = await fetch(`${W}/api/ai/chat`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ summary, question: "q", pad: "z".repeat(40000) }) });
  assert(s.status === 413, `parser cap: a body over 32 kB → 413 (${s.status})`);
  s = await fetch(`${W}/api/ai/chat`, { method: "POST", headers: { "content-type": "application/json" }, body: '{"question":"LEAKBROKEN my cramps", "summary": ' });
  assert(s.status === 400, "a body that isn't JSON → 400");
  assert(seen.length - before <= 1, "rejected bodies never reach Anthropic");

  // chat: history as alternating turns, then her summary and question
  before = seen.length;
  const hist = [{ role: "cyra", text: "earlier answer" }, { role: "me", text: "LEAKQ1 first question" }, { role: "cyra", text: "first answer" }];
  r = await j(await post(W, "/api/ai/chat", chatBody({ summary, question: "LEAKQ2 Why are cramps worse on day 2?", history: hist })));
  assert(r.provider === "claude-opus-5-5" && r.answer === "mock answer" && r.urgent === false, "chat: cleaned structured output");
  q = seen[seen.length - 1];
  const roles = q.body.messages.map((m) => m.role).join(",");
  assert(roles === "user,assistant,user", `chat: history starts with her turn and alternates (${roles})`);
  assert(q.body.messages[2].content.includes("LEAKQ2 Why are cramps worse on day 2?") && q.body.messages[2].content.includes('"kind":"cyra-summary"'), "chat: the last turn carries the summary and her question");
  // red flag: answered by the server, never sent
  before = seen.length;
  r = await j(await post(W, "/api/ai/chat", chatBody({ summary, question: "I have chest pain and feel faint" })));
  assert(r.provider === "safety" && r.urgent === true && r.answer === EMERGENCY_ANSWER && seen.length === before, "chat: a red-flag question gets the emergency line and is not forwarded");
  mode = "fail"; r = await post(W, "/api/ai/weekly", weeklyBody(summary)); mode = "ok";
  assert(r.status === 502, "weekly: an API error → 502, no invented text");

  // nothing she sent is in the server's output
  await new Promise((res) => setTimeout(res, 300));
  assert(!/LEAK|cyra-summary|Cramps|cramps|chest pain|Maya/.test(logged), `logs carry no summary, question or body (${logged.split("\n").filter((l) => /ai/.test(l)).join(" / ").slice(0, 200)})`);
} finally { watched.kill(); rules2.kill(); rules.kill(); live.kill(); quick.kill(); mock.close(); fs.rmSync("config/app.ai-test.json", { force: true }); }
console.log(process.exitCode ? "AI SMOKE: FAILURES" : "AI SMOKE: all passed");
