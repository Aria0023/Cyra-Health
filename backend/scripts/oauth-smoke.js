// OAuth smoke test: a local mock identity provider (OIDC-style authorize/token/jwks
// for google+apple, token+/me for facebook) and a backend pointed at it via
// OAUTH_MOCK_BASE. Exercises the full code flow with plain fetch, plus the
// failure paths. Usage: node scripts/oauth-smoke.js
import http from "http";
import crypto from "crypto";
import { spawn } from "child_process";
import { startMockProvider } from "./mock-oauth-provider.js";

const assert = (c, m) => { if (!c) { console.error("FAIL:", m); process.exitCode = 1; } else console.log("ok  ", m); };
const waitFor = async (url) => { for (let i = 0; i < 50; i++) { try { if ((await fetch(url)).ok) return; } catch {} await new Promise((r) => setTimeout(r, 100)); } throw new Error("backend did not start"); };

// --- mock provider ---
const mockSrv = await startMockProvider(3998);
const MOCK = mockSrv.base;
const mock = { close: mockSrv.close };

const backend = spawn("node", ["server.js"], { env: { ...process.env, PORT: "3103", PUBLIC_BASE_URL: "http://127.0.0.1:3103", OAUTH_MOCK_BASE: MOCK, CORS_ORIGIN: "https://app.example", AUTH_SECRET: "test-auth-secret" }, stdio: ["ignore", "ignore", "inherit"] });
const B = "http://127.0.0.1:3103", RET = "https://app.example/";
const go = (url, init) => fetch(url, { redirect: "manual", ...init });
try {
  await waitFor(`${B}/health`);
  const prov = await (await fetch(`${B}/api/oauth/providers`)).json();
  assert(prov.apple && prov.google && prov.facebook, "providers: all configured under the mock");

  for (const id of ["google", "facebook", "apple"]) {
    let r = await go(`${B}/api/oauth/${id}/start?return=${encodeURIComponent(RET)}`);
    assert(r.status === 302 && r.headers.get("location").startsWith(`${MOCK}/${id}/authorize?`), `${id}: start redirects to the provider`);
    const auth = new URL(r.headers.get("location"));
    if (id !== "apple") assert(auth.searchParams.get("code_challenge_method") === "S256", `${id}: PKCE S256 sent`);
    assert(auth.searchParams.get("redirect_uri") === `${B}/api/oauth/${id}/callback` && auth.searchParams.get("nonce"), `${id}: redirect_uri + nonce present`);
    r = await go(auth.toString());
    let cb;
    if (id === "apple") { // form_post: the mock returns an auto-submitting form; post it ourselves
      const html = await r.text(); const code = html.match(/name=code value="([^"]+)"/)[1]; const state = html.match(/name=state value="([^"]+)"/)[1];
      cb = await go(`${B}/api/oauth/apple/callback`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ code, state, user: JSON.stringify({ name: { firstName: "Ada", lastName: "L" } }) }) });
    } else cb = await go(r.headers.get("location"));
    const loc = cb.headers.get("location") || "";
    assert(cb.status === 302 && loc.startsWith(`${RET}#oauth=`), `${id}: callback hands off with a one-time code`);
    const code = loc.split("#oauth=")[1];
    const idn = await (await fetch(`${B}/api/oauth/exchange`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code }) })).json();
    assert(idn.provider === id && idn.email === `ada@${id}.example` && idn.emailVerified === true, `${id}: verified email returned`);
    assert(id === "apple" ? idn.name === "Ada L" : idn.name === "Ada Lovelace", `${id}: name returned (${idn.name})`);
    const again = await fetch(`${B}/api/oauth/exchange`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code }) });
    assert(again.status === 404, `${id}: handoff code is single-use`);
  }

  // failure paths
  let r = await go(`${B}/api/oauth/google/start?return=${encodeURIComponent("https://evil.example/")}`);
  assert(r.status === 400, "start: return URL outside CORS_ORIGIN rejected");
  r = await go(`${B}/api/oauth/google/callback?code=x&state=forged.sig`);
  assert(r.status === 400, "callback: forged state rejected");
  r = await go(`${B}/api/oauth/google/start?return=${encodeURIComponent(RET)}`); const auth = new URL(r.headers.get("location"));
  r = await go(auth.toString()); const cbUrl = new URL(r.headers.get("location")); cbUrl.searchParams.set("code", "nope");
  r = await go(cbUrl.toString());
  assert(r.status === 302 && /#oauth_error=signin_failed/.test(r.headers.get("location")), "callback: bad code → oauth_error back to the app");
  r = await go(`${B}/api/oauth/google/start?return=${encodeURIComponent(RET)}`); const a2 = new URL(r.headers.get("location"));
  r = await go(a2.toString()); const cb2 = new URL(r.headers.get("location"));
  // swap in another flow's state: nonce in state ≠ nonce the provider signed → rejected
  const other = new URL((await go(`${B}/api/oauth/google/start?return=${encodeURIComponent(RET)}`)).headers.get("location"));
  cb2.searchParams.set("state", other.searchParams.get("state"));
  r = await go(cb2.toString());
  assert(/#oauth_error=signin_failed/.test(r.headers.get("location") || ""), "callback: nonce/PKCE mismatch across flows rejected");
  r = await go(`${B}/api/oauth/nope/start?return=${encodeURIComponent(RET)}`);
  assert(r.status === 404, "start: unknown provider 404");
} finally { backend.kill(); mock.close(); }

// unconfigured provider → 503 (separate backend without the mock)
const bare = spawn("node", ["server.js"], { env: { ...process.env, PORT: "3104", APPLE_CLIENT_ID: "", GOOGLE_CLIENT_ID: "", FACEBOOK_APP_ID: "", OAUTH_MOCK_BASE: "" }, stdio: ["ignore", "ignore", "inherit"] });
try { await waitFor("http://127.0.0.1:3104/health");
  const prov = await (await fetch("http://127.0.0.1:3104/api/oauth/providers")).json();
  assert(prov.apple === false && prov.google === false && prov.facebook === false, "providers: none configured without credentials");
  const r = await go(`http://127.0.0.1:3104/api/oauth/apple/start?return=${encodeURIComponent(RET)}`);
  assert(r.status === 503, "start: unconfigured provider → 503, never a fake login");
} finally { bare.kill(); }
console.log(process.exitCode ? "OAUTH SMOKE: FAILURES" : "OAUTH SMOKE: all passed");
