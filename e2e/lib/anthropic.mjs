/* A stand-in for Anthropic's Messages API for the portal e2e specs (docs/plans/tracking-reports.md Task 4): a local HTTP
   server on a free port of 127.0.0.1. The backend's ai module reaches it through ANTHROPIC_BASE_URL (the official SDK,
   as in backend/scripts/ai-smoke.js); nothing leaves the machine. `calls` records each request body; `mode` "fail"
   answers 500 so the template fallback can be seen. */
import http from "node:http";

export const SUMMARY = "Three accounts were made this week, all with an email code. The Shop was opened six times, most often for the Oura Ring.\n\nSubscriptions and Impact aren't connected to this server, so there are no revenue or affiliate numbers. Nothing moved more than 30% from the week before.";
export async function startAnthropic() {
  const calls = [];
  const state = { mode: "ok" };
  const srv = http.createServer((req, res) => {
    let raw = ""; req.on("data", (c) => (raw += c)); req.on("end", () => {
      let body = {}; try { body = JSON.parse(raw); } catch { /* not JSON */ }
      calls.push({ url: req.url, beta: req.headers["anthropic-beta"] || "", body });
      res.setHeader("content-type", "application/json");
      if (state.mode === "fail") { res.statusCode = 500; return res.end(JSON.stringify({ type: "error", error: { type: "api_error", message: "mock failure" } })); }
      res.end(JSON.stringify({ id: "msg_mock", type: "message", role: "assistant", model: body.model, stop_reason: "end_turn", stop_sequence: null, content: [{ type: "text", text: SUMMARY }], usage: { input_tokens: 1, output_tokens: 1 } }));
    });
  });
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const url = `http://127.0.0.1:${srv.address().port}`;
  return { url, calls, state, env: { ANTHROPIC_API_KEY: "sk-ant-e2e-mock", ANTHROPIC_BASE_URL: url }, stop: () => new Promise((r) => srv.close(r)) };
}
