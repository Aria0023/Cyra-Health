// LLM provider: Claude tool-use loop over the same TOOLS registry.
// Requires ANTHROPIC_API_KEY in the environment. Never receives raw PII —
// only opaque userRefs and normalized aggregates flow through tools.
export async function run(task, TOOLS) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY not set — use provider 'rules' or set the key");

  const tools = Object.entries(TOOLS).map(([name, t]) => ({
    name,
    description: t.description,
    input_schema: { type: "object", additionalProperties: true },
  }));
  const messages = [
    {
      role: "user",
      content: `Task: ${JSON.stringify(task)}. Use tools to gather data, then reply with a short JSON object: {"insight": "...", "suggestion": "... or null"}. Observations only — never diagnose.`,
    },
  ];
  const trace = [];

  for (let turn = 0; turn < 6; turn++) {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 800, tools, messages }),
    });
    const data = await resp.json();
    if (data.error) throw new Error(data.error.message);
    messages.push({ role: "assistant", content: data.content });
    const toolUses = data.content.filter((b) => b.type === "tool_use");
    if (!toolUses.length) {
      const text = data.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
      try { return { ...JSON.parse(text.replace(/```json|```/g, "").trim()), trace }; }
      catch { return { insight: text, trace }; }
    }
    const results = [];
    for (const tu of toolUses) {
      const out = await TOOLS[tu.name].run(tu.input);
      trace.push({ tool: tu.name, args: tu.input });
      results.push({ type: "tool_result", tool_use_id: tu.id, content: JSON.stringify(out) });
    }
    messages.push({ role: "user", content: results });
  }
  throw new Error("agent loop exceeded max turns");
}
