// AI proxy: the app never talks to Anthropic directly and never holds a key.
// POST /api/ai/welcome | /route | /ask | /insight  (see tasks.js for contracts)
//
// Provider selection: ANTHROPIC_API_KEY set → Claude via the official SDK with the
// server-side refusal fallback on; otherwise, or on any API error / refusal /
// malformed output, the task's deterministic fallback answers (HTTP 200,
// provider: "rules") so the app keeps working offline-equivalent.
import Anthropic from "@anthropic-ai/sdk";
import { TASKS } from "./tasks.js";

export const basePath = "/api/ai";

function rateLimiter(perMinute) {
  const hits = new Map();
  return (key) => {
    const now = Date.now(), from = now - 60_000;
    const arr = (hits.get(key) || []).filter((t) => t > from);
    if (arr.length >= perMinute) { hits.set(key, arr); return false; }
    arr.push(now); hits.set(key, arr);
    if (hits.size > 10_000) for (const [k, v] of hits) if (!v.some((t) => t > from)) hits.delete(k);
    return true;
  };
}

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
  if (response.stop_reason === "refusal") throw new Error(`model declined (${response.stop_details?.category || "unspecified"})`);
  if (response.stop_reason === "max_tokens") throw new Error("model output truncated");
  const text = response.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  return task.clean(JSON.parse(text));
}

export function mount(router, ctx) {
  const { config } = ctx;
  const model = process.env.AI_MODEL || config.ai?.model || "claude-opus-5-5";
  const key = process.env.ANTHROPIC_API_KEY;
  const client = key ? new Anthropic({ apiKey: key, timeout: 25_000, maxRetries: 1 }) : null;
  const allow = rateLimiter(config.ai?.perMinute || 20);
  console.log(`[cyra] ai provider: ${client ? model : "rules fallback (ANTHROPIC_API_KEY not set)"}`);

  for (const [name, task] of Object.entries(TASKS)) {
    router.post(`/${name}`, async (req, res) => {
      if (!allow(req.ip || "anon")) return res.status(429).json({ error: "too many requests — try again in a minute" });
      const input = task.validate(req.body || {});
      if (input.error) return res.status(400).json({ error: input.error });
      if (!client) return res.json({ provider: "rules", ...task.fallback(input.value) });
      try {
        res.json({ provider: model, ...(await callClaude(client, model, task, input.value)) });
      } catch (e) {
        const kind = e instanceof Anthropic.RateLimitError ? "rate-limited" : e instanceof Anthropic.AuthenticationError ? "bad API key" : e instanceof Anthropic.APIConnectionError ? "connection error" : e instanceof Anthropic.APIError ? `API ${e.status}` : e.constructor?.name || "error";
        console.warn(`[cyra] ai/${name}: ${kind}: ${e.message} — serving rules fallback`);
        res.json({ provider: "rules", degraded: true, ...task.fallback(input.value) });
      }
    });
  }
}
