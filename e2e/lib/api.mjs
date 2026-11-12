/* A stand-in for Solia Health's backend at API_BASE (e2e/lib/serve.mjs), answered inside the browser with page.route: no
   real server runs and nothing leaves the machine. `state` is the mock's memory, so a spec can change what the server
   reports between page loads (e.g. sign-in becomes configured) and read what the app sent (`state.sent`). */
import { API_BASE } from "./serve.mjs";

const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "content-type, authorization", "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS" };
export const TOKEN = `${"t".repeat(40)}.${"s".repeat(43)}`;
export const account = (provider, email, name = "") => ({ id: `acct_${provider}_0001`, provider, email, name, createdAt: "2026-11-12T10:00:00.000Z" });

export function newApiState(over = {}) {
  return {
    providers: { apple: true, google: true, facebook: true, email: true },
    code: "123456",
    sources: { oura: true, terra: true },
    evidence: null, // (body) => { status, json } for POST /api/ai/evidence
    sent: [],
    ...over,
  };
}

/** Routes every request to API_BASE on this page (or context) through `state`. */
export async function mockApi(target, state) {
  await target.route(`${API_BASE}/**`, async (route) => {
    const req = route.request();
    const u = new URL(req.url());
    const method = req.method();
    if (method === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    let body = null; try { body = req.postDataJSON(); } catch { body = null; }
    state.sent.push({ method, path: u.pathname, body, auth: req.headers().authorization || null });
    const json = (status, obj) => route.fulfill({ status, headers: { ...CORS, "content-type": "application/json" }, body: JSON.stringify(obj) });
    const p = u.pathname;
    if (p === "/api/accounts/config") return json(200, { providers: state.providers });
    if (p === "/api/accounts/email/start") return json(200, { sent: true });
    if (p === "/api/accounts/email/verify") return body?.code === state.code ? json(200, { token: TOKEN, account: account("email", body.email) }) : json(401, { error: "that code isn't right", why: "wrong" });
    const start = /^\/api\/oauth\/(apple|google|facebook)\/start$/.exec(p);
    if (start) return route.fulfill({ status: 302, headers: { location: `${u.searchParams.get("return")}#oauth=mockcode-${start[1]}` } });
    if (p === "/api/accounts/provider") {
      const id = /^mockcode-(apple|google|facebook)$/.exec(body?.code || "")?.[1];
      return id ? json(200, { token: TOKEN, account: account(id, id === "facebook" ? "" : `maya@${id}.example`, "Maya Lin") }) : json(404, { error: "code unknown" });
    }
    if (p === "/api/accounts/sign-out") return route.fulfill({ status: 204, headers: CORS });
    if (p === "/api/accounts/me" && method === "DELETE") return route.fulfill({ status: 204, headers: CORS });
    if (p === "/api/integrations/sources") return json(200, state.sources);
    if (p === "/api/ai/status") return json(200, { ready: true });
    if (p === "/api/ai/evidence" && state.evidence) { const r = state.evidence(body); return json(r.status, r.json); }
    if (p === "/api/ai/ask") return json(200, { provider: "rules", answer: "A written answer.", source_note: null, ask_your_doctor: null, urgent: false });
    return json(404, { error: "not in the mock" });
  });
}
