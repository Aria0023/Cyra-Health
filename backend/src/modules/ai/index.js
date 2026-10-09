// AI proxy: the app never talks to Anthropic directly and never holds a key.
// One task is mounted: POST /api/ai/ask {question[, stage]} (see tasks.js). The app
// answers questions from its on-device evidence library first and calls this only
// when the person has turned on "Also ask Cyra's AI when the library has no answer"
// and the library has no match. The question text is forwarded to Anthropic verbatim
// (trimmed to 500 characters): free text carries whatever she typed. This module
// stores nothing. The client address is used only in memory for the rate limit, as
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
import { rateLimiter } from "../../core/memory.js";

export const basePath = "/api/ai";

async function callClaude(client, model, task, value) {
  const response = await client.beta.messages.create({
    model,
    max_tokens: task.maxTokens || 1024,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: task.system,
    output_config: { effort: task.effort || "low", format: { type: "json_schema", schema: task.schema } },
    messages: [{ role: "user", content: task.prompt(value) }],
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
  console.log(`[cyra] ai provider: ${client ? model : "rules fallback (ANTHROPIC_API_KEY not set)"}; tasks: ${Object.keys(TASKS).join(", ")}`);

  for (const [name, task] of Object.entries(TASKS)) {
    router.post(`/${name}`, async (req, res) => {
      if (!allow(req.ip)) return res.status(429).json({ error: "too many requests — try again in a minute" });
      const input = task.validate(req.body || {});
      if (input.error) return res.status(400).json({ error: input.error });
      if (!client) return res.json({ provider: "rules", ...task.fallback(input.value) });
      try {
        res.json({ provider: model, ...(await callClaude(client, model, task, input.value)) });
      } catch (e) {
        const kind = e instanceof Anthropic.RateLimitError ? "rate-limited" : e instanceof Anthropic.AuthenticationError ? "bad API key" : e instanceof Anthropic.APIConnectionTimeoutError ? "timed out" : e instanceof Anthropic.APIConnectionError ? "connection error" : e instanceof Anthropic.APIError ? `API ${e.status}` : e.cat || e.constructor?.name || "error";
        console.warn(`[cyra] ai/${name}: ${kind} — serving rules fallback`);
        res.json({ provider: "rules", degraded: true, ...task.fallback(input.value) });
      }
    });
  }
}
