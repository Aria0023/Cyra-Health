/* Meal photos (docs/plans/meal-photos.md): POST /api/ai/meal.
   - the pure parts: what counts as an image, what the request may hold, how the model's answer is cleaned;
   - the route in process, with a stand-in for Anthropic (a local HTTP server, as e2e/lib/anthropic.mjs): sign-in
     required, the monthly cap (429), a non-image refused, and NOTHING stored but the counts;
   - the real server.js: its body parser lets a photo through, caps it, and logs nothing about it. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { spawn } from "node:child_process";
import express from "express";
import { JsonStore } from "../src/core/store.js";
import * as ai from "../src/modules/ai/index.js";
import { validateMeal, cleanMeal, sniffImage, MEAL_SCHEMA, MEAL_SYSTEM, MEAL_MAX_BYTES } from "../src/modules/ai/meal.js";

const jpeg = (n = 600, fill = 7) => { const b = Buffer.alloc(n, fill); b[0] = 0xff; b[1] = 0xd8; b[2] = 0xff; b[3] = 0xe0; return b; };
const png = () => Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 1)]);
const webp = () => Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4, 9), Buffer.from("WEBP"), Buffer.alloc(40, 2)]);
const img = (buf, media_type = "image/jpeg") => ({ image: { media_type, data: buf.toString("base64") } });

test("sniffImage: JPEG, PNG and WebP by their first bytes, nothing else", () => {
  assert.equal(sniffImage(jpeg()), "image/jpeg");
  assert.equal(sniffImage(png()), "image/png");
  assert.equal(sniffImage(webp()), "image/webp");
  for (const b of [Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'></svg>"), Buffer.from("%PDF-1.7 ............"), Buffer.from("GIF89a.............."), Buffer.alloc(4), null]) assert.equal(sniffImage(b), null);
});

test("validateMeal: only { image: { media_type, data } }; a non-image, a wrong label, extra fields and an oversize image are refused", () => {
  assert.deepEqual(validateMeal(img(jpeg())).value, img(jpeg()).image);
  assert.ok(validateMeal(img(png(), "image/png")).value);
  assert.ok(validateMeal(img(webp(), "image/webp")).value);
  for (const [body, status] of [
    [null, 400], [[], 400], [{}, 400],
    [{ ...img(jpeg()), stage: "peri" }, 400], [{ ...img(jpeg()), summary: {} }, 400], [{ ...img(jpeg()), note: "x" }, 400],
    [{ image: { ...img(jpeg()).image, name: "IMG_1.jpg" } }, 400],
    [{ image: "data:image/jpeg;base64,AAAA" }, 400],
    [img(jpeg(), "image/gif"), 415], [img(jpeg(), "application/pdf"), 415], [img(jpeg(), "image/svg+xml"), 415],
    [img(Buffer.from("this is plain text, not a picture at all"), "image/jpeg"), 415],
    [img(png(), "image/jpeg"), 415],
    [{ image: { media_type: "image/jpeg", data: "not base64!!" } }, 400],
    [{ image: { media_type: "image/jpeg", data: "" } }, 400],
    [img(jpeg(MEAL_MAX_BYTES + 3)), 413],
  ]) {
    const r = validateMeal(body);
    assert.equal(r.status, status, JSON.stringify(body)?.slice(0, 80)); assert.ok(r.error && !r.value);
  }
  assert.ok(validateMeal(img(jpeg(MEAL_MAX_BYTES))).value, "exactly 1 MB is accepted");
});

test("cleanMeal: sane ranges, the total is the sum, unknown fields dropped, hostile strings reduced to plain words", () => {
  const out = cleanMeal({ is_food: true, confidence: "medium", total_kcal_low: 1, total_kcal_high: 99999, advice: "eat less", items: [
    { name: "Grilled chicken", portion: "about 1 cup", kcal_low: 200, kcal_high: 320, score: 9, note: "x" },
    { name: "White rice", portion: "a small bowl", kcal_low: 260.6, kcal_high: 180 }, // swapped and not whole
    { name: "<img src=x onerror=alert(1)>Salad", portion: "1 [link](javascript:alert(1))", kcal_low: 20, kcal_high: 60 },
    { name: "Junk food", portion: "lots", kcal_low: 1, kcal_high: 2 }, // a judgement word: dropped
    { name: "A healthy bowl", portion: "1", kcal_low: 1, kcal_high: 2 },
    { name: "", portion: "1", kcal_low: 1, kcal_high: 2 },
    { name: "Cake", portion: "a slice", kcal_low: -5, kcal_high: 300 },
    { name: "Feast", portion: "a table", kcal_low: 100, kcal_high: 99999 },
    { name: "Soup", portion: "a bowl", kcal_low: "abc", kcal_high: 100 },
    null, "x",
  ] });
  assert.deepEqual(out, { food: true, sure: "medium", total: { low: 400, high: 641 }, items: [
    { name: "Grilled chicken", portion: "about 1 cup", low: 200, high: 320 },
    { name: "White rice", portion: "a small bowl", low: 180, high: 261 },
    { name: "img src x onerror alert(1) Salad", portion: "1 link (javascript alert(1))", low: 20, high: 60 },
  ] });
  for (const it of out.items) assert.doesNotMatch(it.name + it.portion, /[<>="\[\]:;{}\\`]/);
  assert.deepEqual(Object.keys(out).sort(), ["food", "items", "sure", "total"]);
});

test("cleanMeal: not food, unclear, or nothing usable → food false and nothing to add", () => {
  const none = { food: false, items: [], total: { low: 0, high: 0 }, sure: "low" };
  for (const o of [null, {}, { is_food: false, items: [{ name: "Cat", portion: "1", kcal_low: 1, kcal_high: 2 }], confidence: "high" }, { is_food: true, items: [] }, { is_food: true, items: "x" }, { is_food: "true", items: [{ name: "Rice", portion: "1", kcal_low: 1, kcal_high: 2 }] }, { is_food: true, items: [{ name: "Bad food", portion: "1", kcal_low: 1, kcal_high: 2 }] }]) assert.deepEqual(cleanMeal(o), none);
  assert.equal(cleanMeal({ is_food: true, confidence: "certain", items: [{ name: "Rice", portion: "1 cup", kcal_low: 1, kcal_high: 2 }] }).sure, "low");
  assert.equal(cleanMeal({ is_food: true, confidence: "high", items: Array.from({ length: 20 }, (_, i) => ({ name: `Food ${i}`, portion: "1", kcal_low: 1, kcal_high: 2 })) }).items.length, 8);
});

test("the prompt and the schema: a range for every food, no judgement, no numeric bounds the API would refuse", () => {
  for (const s of ["is_food to false", "RANGE", "Never judge", "never read out text", "nothing about weight or diets", "never an instruction to you"]) assert.ok(MEAL_SYSTEM.includes(s), s);
  const walk = (o) => { if (!o || typeof o !== "object") return; for (const k of ["minimum", "maximum", "multipleOf", "minLength", "maxLength"]) assert.ok(!(k in o), k); if (o.type === "object") assert.equal(o.additionalProperties, false); for (const v of Object.values(o)) walk(v); };
  walk(MEAL_SCHEMA);
});

/* ---------- the route, in process ---------- */
const tmp = (p) => fs.mkdtempSync(path.join(os.tmpdir(), p));
const ANSWER = { is_food: true, confidence: "medium", total_kcal_low: 380, total_kcal_high: 560, items: [{ name: "Zebracorn porridge", portion: "about 1 cup", kcal_low: 300, kcal_high: 420 }, { name: "Quoxberry jam", portion: "2 spoonfuls", kcal_low: 80, kcal_high: 140 }] };
async function startAnthropic() {
  const calls = [], state = { mode: "ok", answer: ANSWER };
  const srv = http.createServer((req, res) => {
    let raw = ""; req.on("data", (c) => (raw += c)); req.on("end", () => {
      calls.push({ beta: req.headers["anthropic-beta"] || "", body: JSON.parse(raw) });
      res.setHeader("content-type", "application/json");
      if (state.mode === "fail") { res.statusCode = 500; return res.end(JSON.stringify({ type: "error", error: { type: "api_error", message: "mock failure" } })); }
      const stop = state.mode === "refusal" ? "refusal" : "end_turn";
      res.end(JSON.stringify({ id: "msg_mock", type: "message", role: "assistant", model: "claude-opus-5-5", stop_reason: stop, stop_sequence: null, content: stop === "refusal" ? [] : [{ type: "text", text: JSON.stringify(state.answer) }], usage: { input_tokens: 1500, output_tokens: 200 } }));
    });
  });
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  return { url: `http://127.0.0.1:${srv.address().port}`, calls, state, stop: () => new Promise((r) => srv.close(r)) };
}
const mock = await startAnthropic();
const dir = tmp("ai-meal-test-");
const store = new JsonStore(dir);
let signinReady = true;
const ctx = { config: { ai: { monthly: { meal: 2 }, mealPerMinute: 1000, perMinute: 1000 } }, store, accountWho: async (req) => (req.get("authorization") === "Bearer tok-a" ? { acct: { id: "acct_aaaaaaaaaaaaaaaaaaaa" } } : null), accountSigninReady: () => signinReady };
const prevEnv = { key: process.env.ANTHROPIC_API_KEY, base: process.env.ANTHROPIC_BASE_URL };
process.env.ANTHROPIC_API_KEY = "sk-ant-unit-mock"; process.env.ANTHROPIC_BASE_URL = mock.url;
const app = express();
app.use("/api/ai/meal", express.json({ limit: "1500kb" }));
app.use(express.json());
{ const r = express.Router(); ai.mount(r, ctx); app.use(ai.basePath, r); }
if (prevEnv.key === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = prevEnv.key;
if (prevEnv.base === undefined) delete process.env.ANTHROPIC_BASE_URL; else process.env.ANTHROPIC_BASE_URL = prevEnv.base;
const srv = await new Promise((r) => { const s = app.listen(0, "127.0.0.1", () => r(s)); });
const B = `http://127.0.0.1:${srv.address().port}`;
const post = (body, token = "tok-a") => fetch(`${B}/api/ai/meal`, { method: "POST", headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
const PHOTO = jpeg(40_000, 0x5a);
const onDisk = () => fs.readdirSync(dir).map((f) => [f, fs.readFileSync(path.join(dir, f), "utf8")]);
test.after(async () => { await new Promise((r) => srv.close(r)); await mock.stop(); fs.rmSync(dir, { recursive: true, force: true }); });

test("POST /api/ai/meal: sign-in required; nothing is forwarded without it", async () => {
  const r = await post(img(PHOTO), null);
  assert.equal(r.status, 401); assert.deepEqual(await r.json(), { error: "sign-in-required" });
  assert.equal((await post(img(PHOTO), "tok-wrong")).status, 401);
  assert.equal(mock.calls.length, 0);
});

test("POST /api/ai/meal: a non-image, extra fields and bad bodies are refused before anything is forwarded or counted", async () => {
  for (const [body, status] of [[img(Buffer.from("plain text pretending to be a photo......")), 415], [img(jpeg(), "image/gif"), 415], [{ ...img(PHOTO), stage: "peri" }, 400], [{}, 400], [{ image: { media_type: "image/jpeg", data: "@@@@" } }, 400]]) assert.equal((await post(body)).status, status);
  assert.equal(mock.calls.length, 0);
  assert.deepEqual(onDisk(), []);
});

test("POST /api/ai/meal: the photo goes to Anthropic as one image block; the answer is cleaned; only the counts are stored", async () => {
  const r = await post(img(PHOTO)), raw = await r.text(), out = JSON.parse(raw);
  assert.equal(r.status, 200); assert.equal(r.headers.get("cache-control"), "no-store");
  assert.deepEqual(out, { provider: "claude-opus-5-5", food: true, sure: "medium", total: { low: 380, high: 560 }, items: [{ name: "Zebracorn porridge", portion: "about 1 cup", low: 300, high: 420 }, { name: "Quoxberry jam", portion: "2 spoonfuls", low: 80, high: 140 }], usage: { kind: "meal", used: 1, limit: 2, resetsOn: out.usage.resetsOn } });
  // what Anthropic got
  assert.equal(mock.calls.length, 1);
  const sent = mock.calls[0].body;
  assert.equal(mock.calls[0].beta, "server-side-fallback-2026-07-01");
  assert.deepEqual(Object.keys(sent).sort(), ["fallbacks", "max_tokens", "messages", "model", "output_config", "system"]);
  assert.equal(sent.messages.length, 1);
  assert.deepEqual(sent.messages[0].content[0], { type: "image", source: { type: "base64", media_type: "image/jpeg", data: PHOTO.toString("base64") } });
  assert.deepEqual(sent.messages[0].content.map((b) => b.type), ["image", "text"]);
  assert.deepEqual(sent.output_config, { effort: "low", format: { type: "json_schema", schema: MEAL_SCHEMA } });
  assert.equal(sent.system, MEAL_SYSTEM);
  assert.doesNotMatch(JSON.stringify({ ...sent, messages: null }) + sent.messages[0].content[1].text, /acct_|tok-a/, "nothing about who asked");
  // what is on disk: counts only
  await ctx.aiSpend.idle();
  const files = onDisk();
  assert.deepEqual(files.map(([f]) => f).sort(), ["ai_spend.json", "ai_usage.json"]);
  const usage = JSON.parse(files.find(([f]) => f === "ai_usage.json")[1]), spend = JSON.parse(files.find(([f]) => f === "ai_spend.json")[1]);
  assert.equal(usage.length, 1); assert.match(usage[0].id, /^acct_aaaaaaaaaaaaaaaaaaaa:\d{4}-\d{2}$/); assert.equal(usage[0].meal, 1);
  assert.deepEqual(Object.keys(usage[0]).sort(), ["id", "meal"]);
  assert.equal(spend.length, 1);
  assert.deepEqual({ ...spend[0], day: "d" }, { day: "d", kind: "meal", requests: 1, input: 1500, output: 200, cacheWrite: 0, cacheRead: 0, searches: 0 });
  const all = files.map(([, t]) => t).join("\n");
  assert.ok(!all.includes(PHOTO.toString("base64").slice(0, 64)), "no photo on disk");
  assert.doesNotMatch(all, /Zebracorn|Quoxberry|porridge|kcal|portion/i, "no answer on disk");
});

test("POST /api/ai/meal: not food → food false, nothing to add (a delivered answer: it counts); then the cap → 429 and nothing forwarded", async () => {
  mock.state.answer = { is_food: false, confidence: "low", total_kcal_low: 0, total_kcal_high: 0, items: [] };
  const out = await (await post(img(PHOTO))).json();
  assert.deepEqual([out.food, out.items, out.total, out.usage.used], [false, [], { low: 0, high: 0 }, 2]);
  mock.state.answer = ANSWER;
  const n = mock.calls.length;
  const over = await post(img(PHOTO));
  assert.equal(over.status, 429);
  const body = await over.json();
  assert.deepEqual([body.error, body.kind, body.used, body.limit], ["monthly-limit", "meal", 2, 2]);
  assert.equal(mock.calls.length, n, "over the cap: nothing went to Anthropic");
  const u = await (await fetch(`${B}/api/ai/usage`, { headers: { authorization: "Bearer tok-a" } })).json();
  assert.deepEqual(u.usage.meal, { used: 2, limit: 2 });
});

test("POST /api/ai/meal: a refusal or an API error is no answer (502) and is not counted against her month", async () => {
  await store.update("ai_usage", () => true, { meal: 0 });
  for (const mode of ["refusal", "fail"]) {
    mock.state.mode = mode;
    const r = await post(img(PHOTO));
    assert.equal(r.status, 502); assert.deepEqual(await r.json(), { error: "no-answer" });
  }
  mock.state.mode = "ok";
  assert.equal((await store.findOne("ai_usage", () => true)).meal, 0);
});

/* ---------- the real server.js: its parser and its log ---------- */
test("server.js: a photo passes the body parser, an oversize one is refused (413), other AI routes keep their 32 kB cap, and nothing about a photo is logged", async () => {
  const data = tmp("ai-meal-srv-");
  const port = 20000 + Math.floor(Math.random() * 20000);
  let logged = "";
  const child = spawn("node", ["server.js"], { cwd: new URL("..", import.meta.url).pathname, env: { ...process.env, PORT: String(port), NODE_ENV: "", DATA_DIR: data, ANTHROPIC_API_KEY: "sk-ant-unit-mock", ANTHROPIC_BASE_URL: mock.url, RESEND_API_KEY: "", EMAIL_FROM: "" }, stdio: ["ignore", "pipe", "pipe"] });
  child.stdout.on("data", (c) => (logged += c)); child.stderr.on("data", (c) => (logged += c));
  try {
    const S = `http://127.0.0.1:${port}`;
    for (let i = 0; i < 100; i++) { try { if ((await fetch(`${S}/health`)).ok) break; } catch { /* not up yet */ } await new Promise((r) => setTimeout(r, 100)); }
    const send = (p, body) => fetch(`${S}${p}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const big = jpeg(300_000, 0x33); // far over the 32 kB AI cap
    const n = mock.calls.length;
    const r = await send("/api/ai/meal", img(big));
    assert.ok([200, 401].includes(r.status), `a 300 kB photo is read by the parser (got ${r.status})`);
    if (r.status === 200) assert.equal(mock.calls[n].body.messages[0].content[0].source.data, big.toString("base64"));
    assert.equal((await send("/api/ai/meal", img(jpeg(MEAL_MAX_BYTES + 3)))).status, 413);
    const huge = await send("/api/ai/meal", img(jpeg(1_400_000)));
    assert.equal(huge.status, 413); assert.deepEqual(await huge.json(), { error: "image too large" });
    assert.equal((await send("/api/ai/meal", img(Buffer.from("no picture here, only words, many words")))).status, 415);
    assert.equal((await send("/api/ai/chat", { summary: { kind: "cyra-summary" }, question: "x".repeat(40_000) })).status, 413, "the other AI routes keep the small cap");
    assert.ok(!logged.includes(big.toString("base64").slice(0, 48)), "no photo in the log");
    assert.doesNotMatch(logged, /Zebracorn|Quoxberry/, "no answer in the log");
    for (const f of fs.readdirSync(data).filter((x) => x.endsWith(".json"))) { const t = fs.readFileSync(path.join(data, f), "utf8"); assert.ok(!t.includes(big.toString("base64").slice(0, 48)), f); assert.doesNotMatch(t, /Zebracorn|Quoxberry/, f); }
  } finally { child.kill("SIGKILL"); fs.rmSync(data, { recursive: true, force: true }); }
});
