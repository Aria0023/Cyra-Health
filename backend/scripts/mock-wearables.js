// Local mock Oura (OAuth + v2 endpoints + token revocation) and Terra (widget session,
// userInfo, deauthenticateUser) for tests. `seen` records every request the backend made
// to it (method, path, query, body) so tests can check what reached the "provider".
import http from "http";
import crypto from "crypto";
export function startMockWearables(port = 3997) {
  const base = `http://127.0.0.1:${port}`;
  const codes = new Set(); const tokens = new Set(); let lastRef = null;
  const refs = new Map(); // Terra reference_id → user_id (assigned when its widget session completes)
  const seen = { requests: [], revoked: [], deauthenticated: [] };
  const day = (i) => new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, base); let raw = ""; req.on("data", (c) => (raw += c)); req.on("end", () => {
      seen.requests.push({ method: req.method, path: u.pathname, query: u.search, body: raw, headers: { "dev-id": req.headers["dev-id"], "x-api-key": req.headers["x-api-key"] } });
      const json = (o, s = 200) => { res.writeHead(s, { "content-type": "application/json" }); res.end(JSON.stringify(o)); };
      const terraAuthed = () => req.headers["x-api-key"] === "test-key" && req.headers["dev-id"] === "test-dev";
      if (u.pathname === "/oauth/authorize") { const code = crypto.randomBytes(6).toString("hex"); codes.add(code); res.writeHead(302, { location: `${u.searchParams.get("redirect_uri")}?code=${code}&state=${encodeURIComponent(u.searchParams.get("state"))}` }); return res.end(); }
      if (u.pathname === "/oauth/token") {
        const b = Object.fromEntries(new URLSearchParams(raw));
        if (b.client_secret !== "test-oura-secret") return json({ error: "invalid_client" }, 401);
        if (b.grant_type === "refresh_token") { if (b.refresh_token !== "rt-1") return json({ error: "invalid_grant" }, 400); const t = "at-" + crypto.randomBytes(4).toString("hex"); tokens.add(t); return json({ access_token: t, refresh_token: "rt-2", expires_in: 86400 }); }
        if (!codes.delete(b.code)) return json({ error: "invalid_grant" }, 400);
        const t = "at-" + crypto.randomBytes(4).toString("hex"); tokens.add(t); return json({ access_token: t, refresh_token: "rt-1", expires_in: 86400 });
      }
      if (u.pathname === "/oauth/revoke") { const t = u.searchParams.get("access_token") || ""; if (!tokens.delete(t)) return json({ detail: "invalid token" }, 400); seen.revoked.push(t); return json({}); }
      if (u.pathname.startsWith("/v2/usercollection/")) {
        if (!tokens.has((req.headers.authorization || "").replace("Bearer ", ""))) return json({ detail: "unauthorized" }, 401);
        const what = u.pathname.split("/").pop(); const data = [];
        for (let i = 30; i >= 1; i--) {
          if (what === "daily_readiness") data.push({ day: day(i), score: 80, temperature_deviation: +(0.1 + 0.3 * (i % 3 === 0)).toFixed(2) });
          if (what === "daily_sleep") data.push({ day: day(i), score: 70 + (i % 5) });
          if (what === "sleep") { data.push({ day: day(i), type: "long_sleep", average_hrv: 40 + (i % 4), lowest_heart_rate: 58 + (i % 3) }); data.push({ day: day(i), type: "nap", average_hrv: 99, lowest_heart_rate: 99 }); }
        }
        return json({ data, next_token: null });
      }
      if (u.pathname === "/auth/generateWidgetSession") { if (!terraAuthed()) return json({ message: "unauthorized" }, 401); const b = JSON.parse(raw); lastRef = b.reference_id; seen.widgetProviders = b.providers; return json({ status: "success", url: `${base}/widget?ref=${b.reference_id}&ok=${encodeURIComponent(b.auth_success_redirect_url)}` }); }
      if (u.pathname === "/last-ref") return json({ ref: lastRef });
      // like Terra: the success redirect gets user_id, reference_id and resource appended to its query
      if (u.pathname === "/widget") { const ref = u.searchParams.get("ref"); refs.set(ref, refs.get(ref) || `terra-u${refs.size + 1}`); res.writeHead(302, { location: `${u.searchParams.get("ok")}&user_id=${refs.get(ref)}&resource=FITBIT&reference_id=${ref}` }); return res.end(); }
      if (u.pathname === "/userInfo") { if (!terraAuthed()) return json({ message: "unauthorized" }, 401); const ref = u.searchParams.get("reference_id"); return json({ status: "success", users: refs.has(ref) ? [{ user_id: refs.get(ref), provider: "FITBIT", reference_id: ref, active: true }] : [] }); }
      if (u.pathname === "/auth/deauthenticateUser" && req.method === "DELETE") { if (!terraAuthed()) return json({ message: "unauthorized" }, 401); const id = u.searchParams.get("user_id"); for (const [r, uid] of refs) if (uid === id) refs.delete(r); seen.deauthenticated.push(id); return json({ status: "success" }); }
      json({ error: "not found" }, 404);
    });
  });
  return new Promise((resolve) => server.listen(port, () => resolve({ base, seen, close: () => server.close() })));
}
if (process.argv[1] && process.argv[1].endsWith("mock-wearables.js")) { const { base } = await startMockWearables(Number(process.argv[2]) || 3997); console.log(`[mock-wearables] ${base}`); }
