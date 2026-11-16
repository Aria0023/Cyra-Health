// AI proxy: the app never talks to Anthropic directly and never holds a key.
// Task 3 adds POST /api/ai/evidence {question, summary?} (Pro "Ask with evidence": the web search tool limited to
// evidence sites, answers with numbered sources; evidence.js).
// Calm R8 adds POST /api/ai/weekly {summary} and POST /api/ai/chat {summary, question, history?}
// (Pro, her own switch, the exact body previewed in the app before every send; see tasks.js),
// and GET /api/ai/status → {ready} (true when a key is set; it reads nothing from the request).
// weekly and chat have no rules fallback: without ANTHROPIC_API_KEY they answer 503
// {error:"ai-not-configured"} and nothing is forwarded. Their bodies are capped at 16 kB (413),
// re-checked (400) and never logged or stored: a failure logs only its kind.
// The original task: POST /api/ai/ask {question[, stage]} (see tasks.js). The app
// answers questions from its on-device evidence library first and calls this only
// when the person has turned on "Also ask Cyra's AI when the library has no answer"
// and the library has no match. The question text is forwarded to Anthropic verbatim
// (trimmed to 500 characters): free text carries whatever she typed. This module
// stores no question, answer or summary. The one thing it keeps is the monthly allowance (usage.js): how many evidence
// questions, chat messages and weekly write-ups each signed-in account has had this month (counts only), and
// GET /api/ai/usage reports them. The client address is used only in memory for the rate limit, as
// a salted hash (salt changes daily) that is dropped about a minute (60-65 s) after the
// last request. welcome / route / insight are no longer mounted — the app makes its
// welcome and life-stage routing on the device, so POST /api/ai/{welcome,route,insight}
// answer 404.
//
// Provider selection: ANTHROPIC_API_KEY set → Claude via the official SDK, one attempt
// (no retry) with a 12-second limit — inside the app's 15-second wait — and the
// server-side refusal fallback on. Otherwise, or on any API error / refusal /
// malformed output, the deterministic library answers (HTTP 200, provider: "rules").
import Anthropic from "@anthropic-ai/sdk";
import { TASKS } from "./tasks.js";
import { mountEvidence } from "./evidence.js";
import { rateLimiter } from "../../core/memory.js";
import { usageMeter, limitsFrom } from "./usage.js";

export const basePath = "/api/ai";

async function callClaude(client, model, task, value) {
  const response = await client.beta.messages.create({
    model,
    max_tokens: task.maxTokens || 1024,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: task.system,
    output_config: { effort: task.effort || "low", format: { type: "json_schema", schema: task.schema } },
    messages: task.messages ? task.messages(value) : [{ role: "user", content: task.prompt(value) }],
  });
  if (response.stop_reason === "refusal") throw Object.assign(new Error("model declined"), { cat: `model declined (${String(response.stop_details?.category || "unspecified").slice(0, 40)})` });
  if (response.stop_reason === "max_tokens") throw Object.assign(new Error("model output truncated"), { cat: `output truncated at max_tokens (${response.usage?.output_tokens ?? "?"} tokens)` });
  const text = response.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  return task.clean(JSON.parse(text));
}

export function mount(router, ctx) {
  const { config } = ctx;
  const model = process.env.AI_MODEL || config.ai?.model || "claude-opus-5-5";
  const key = process.env.ANTHROPIC_API_KEY;
  const timeout = Number(config.ai?.timeoutMs) > 0 ? Number(config.ai.timeoutMs) : 12_000;
  const client = key ? new Anthropic({ apiKey: key, timeout, maxRetries: 0 }) : null;
  const allow = rateLimiter({ perMinute: config.ai?.perMinute || 20 });
  const meter = usageMeter({ store: ctx.store, who: (req) => (ctx.accountWho ? ctx.accountWho(req) : null), signinReady: () => !!ctx.accountSigninReady?.(), requireSignin: config.ai?.signinRequired !== false, limits: limitsFrom(config.ai?.monthly) });
  // The monthly allowance applies to the paid tasks only; the free "ask" (with its rules fallback) is not counted.
  const METERED = new Set(["weekly", "chat"]);
  console.log(`[cyra] ai provider: ${client ? model : "rules fallback (ANTHROPIC_API_KEY not set)"}; tasks: ${Object.keys(TASKS).join(", ")}`);

  // Whether this server can reach Cyra's AI at all (the app shows "AI isn't set up on this server yet" when not).
  router.get("/status", (req, res) => { res.set("cache-control", "no-store"); res.json({ ready: !!client }); });

  // This month's allowance for the person asking: { usage: { evidence|chat|weekly: { used, limit } }, resetsOn }.
  router.get("/usage", async (req, res) => {
    res.set("cache-control", "no-store");
    if (!allow(req.ip)) return res.status(429).json({ error: "too many requests — try again in a minute" });
    const u = await meter.usage(req);
    if (!u.ok) return res.status(u.status).json(u.body);
    res.json({ usage: u.usage, resetsOn: u.resetsOn });
  });

  // Task 3, "Ask with evidence" (Pro): its own client (a web-searching answer takes longer than the 12 s ask: 60 s, one
  // attempt) and its own, tighter rate limit. See evidence.js.
  const evTimeout = Number(config.ai?.evidenceTimeoutMs) > 0 ? Number(config.ai.evidenceTimeoutMs) : 60_000;
  const evClient = key ? new Anthropic({ apiKey: key, timeout: evTimeout, maxRetries: 0 }) : null;
  mountEvidence(router, { client: evClient, model, allow: rateLimiter({ perMinute: config.ai?.evidencePerMinute || 6 }), meter });

  for (const [name, task] of Object.entries(TASKS)) {
    router.post(`/${name}`, async (req, res) => {
      if (!allow(req.ip)) return res.status(429).json({ error: "too many requests — try again in a minute" });
      if (!task.fallback) {
        let size = 0; try { size = JSON.stringify(req.body || {}).length; } catch { size = Infinity; }
        if (size > 16_384) return res.status(413).json({ error: "body too large" });
      }
      const input = task.validate(req.body || {});
      if (input.error) return res.status(400).json({ error: input.error });
      const early = task.preflight ? task.preflight(input.value) : null;
      if (early) return res.json({ provider: "safety", ...early });
      if (!client) return task.fallback ? res.json({ provider: "rules", ...task.fallback(input.value) }) : res.status(503).json({ error: "ai-not-configured" });
      const gate = METERED.has(name) ? await meter.check(req, name) : null;
      if (gate && !gate.ok) return res.status(gate.status).json(gate.body);
      try {
        const out = await callClaude(client, model, task, input.value);
        const usage = gate ? await gate.commit() : undefined;
        res.json({ provider: model, ...out, ...(usage ? { usage } : {}) });
      } catch (e) {
        const kind = e instanceof Anthropic.RateLimitError ? "rate-limited" : e instanceof Anthropic.AuthenticationError ? "bad API key" : e instanceof Anthropic.APIConnectionTimeoutError ? "timed out" : e instanceof Anthropic.APIConnectionError ? "connection error" : e instanceof Anthropic.APIError ? `API ${e.status}` : e.cat || e.constructor?.name || "error";
        if (!task.fallback) { console.warn(`[cyra] ai/${name}: ${kind} — no answer`); return res.status(502).json({ error: "no-answer" }); }
        console.warn(`[cyra] ai/${name}: ${kind} — serving rules fallback`);
        res.json({ provider: "rules", degraded: true, ...task.fallback(input.value) });
      }
    });
  }
}
