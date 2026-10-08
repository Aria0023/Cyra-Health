// Local mock Oura (OAuth + v2 endpoints) and Terra (widget session) for tests.
import http from "http";
import crypto from "crypto";
export function startMockWearables(port = 3997) {
  const base = `http://127.0.0.1:${port}`;
  const codes = new Set(); const tokens = new Set(); let lastRef = null;
  const day = (i) => new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, base); let raw = ""; req.on("data", (c) => (raw += c)); req.on("end", () => {
      const json = (o, s = 200) => { res.writeHead(s, { "content-type": "application/json" }); res.end(JSON.stringify(o)); };
      if (u.pathname === "/oauth/authorize") { const code = crypto.randomBytes(6).toString("hex"); codes.add(code); res.writeHead(302, { location: `${u.searchParams.get("redirect_uri")}?code=${code}&state=${encodeURIComponent(u.searchParams.get("state"))}` }); return res.end(); }
      if (u.pathname === "/oauth/token") {
        const b = Object.fromEntries(new URLSearchParams(raw));
        if (b.client_secret !== "test-oura-secret") return json({ error: "invalid_client" }, 401);
        if (b.grant_type === "refresh_token") { if (b.refresh_token !== "rt-1") return json({ error: "invalid_grant" }, 400); const t = "at-" + crypto.randomBytes(4).toString("hex"); tokens.add(t); return json({ access_token: t, refresh_token: "rt-2", expires_in: 86400 }); }
        if (!codes.delete(b.code)) return json({ error: "invalid_grant" }, 400);
        const t = "at-" + crypto.randomBytes(4).toString("hex"); tokens.add(t); return json({ access_token: t, refresh_token: "rt-1", expires_in: 86400 });
      }
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
      if (u.pathname === "/auth/generateWidgetSession") { if (req.headers["x-api-key"] !== "test-key" || req.headers["dev-id"] !== "test-dev") return json({ message: "unauthorized" }, 401); const b = JSON.parse(raw); lastRef = b.reference_id; return json({ status: "success", url: `${base}/widget?ref=${b.reference_id}&ok=${encodeURIComponent(b.auth_success_redirect_url)}` }); }
      if (u.pathname === "/last-ref") return json({ ref: lastRef });
      if (u.pathname === "/widget") { res.writeHead(302, { location: `${u.searchParams.get("ok")}&user_id=terra-u1&reference_id=${u.searchParams.get("ref")}` }); return res.end(); }
      json({ error: "not found" }, 404);
    });
  });
  return new Promise((resolve) => server.listen(port, () => resolve({ base, close: () => server.close() })));
}
if (process.argv[1] && process.argv[1].endsWith("mock-wearables.js")) { const { base } = await startMockWearables(Number(process.argv[2]) || 3997); console.log(`[mock-wearables] ${base}`); }
