// OAuth smoke test: a local mock identity provider (OIDC-style authorize/token/jwks
// for google+apple, token+/me for facebook) and a backend pointed at it via
// OAUTH_MOCK_BASE. Exercises the full code flow with plain fetch, plus the
// failure paths, plus the native app's flow: a cyrahealth://auth/oauth?a=<attempt>
// return link with an app_challenge whose verifier the exchange demands (both or
// neither), and the return allowlists. Usage: node scripts/oauth-smoke.js
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

const backend = spawn("node", ["server.js"], { env: { ...process.env, PORT: "3103", PUBLIC_BASE_URL: "http://127.0.0.1:3103", OAUTH_MOCK_BASE: MOCK, CORS_ORIGIN: "https://app.example,capacitor://localhost,https://localhost", AUTH_SECRET: "test-auth-secret", APP_RETURN_SCHEMES: "", RETURN_ORIGINS: "", NODE_ENV: "" }, stdio: ["ignore", "ignore", "inherit"] });
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
      const html = await r.text(); const code = html.match(/name="?code"? value="([^"]+)"/)[1]; const state = html.match(/name="?state"? value="([^"]+)"/)[1];
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

  // ---- native app: system browser + cyrahealth:// return link + app verifier ----
  const APP_RET = `cyrahealth://auth/oauth?a=${crypto.randomBytes(16).toString("base64url")}`; // per-attempt id, as the app sends it
  const pair = () => { const verifier = crypto.randomBytes(32).toString("base64url"); return { verifier, challenge: crypto.createHash("sha256").update(verifier).digest("base64url") }; };
  const appFlow = async (id, challenge) => { // start → provider → callback; returns the callback's Location
    let s = await go(`${B}/api/oauth/${id}/start?return=${encodeURIComponent(APP_RET)}&app_challenge=${challenge}`);
    if (s.status !== 302) return { status: s.status };
    s = await go(s.headers.get("location"));
    if (id === "apple") { const html = await s.text(); s = await go(`${B}/api/oauth/apple/callback`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ code: html.match(/name="?code"? value="([^"]+)"/)[1], state: html.match(/name="?state"? value="([^"]+)"/)[1] }) }); }
    else s = await go(s.headers.get("location"));
    return { status: s.status, loc: s.headers.get("location") || "" };
  };
  const exchange = (body) => fetch(`${B}/api/oauth/exchange`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  for (const id of ["google", "apple"]) {
    const p = pair();
    const out = await appFlow(id, p.challenge);
    assert(out.status === 302 && out.loc.startsWith(`${APP_RET}#oauth=`), `app ${id}: callback redirects to ${APP_RET}#oauth=<code> (${out.loc.slice(0, 40)}…)`);
    const code = out.loc.split("#oauth=")[1];
    const idn = await exchange({ code, verifier: p.verifier });
    const body = idn.status === 200 ? await idn.json() : {};
    assert(idn.status === 200 && body.provider === id && body.email === `ada@${id}.example`, `app ${id}: right verifier → identity (${idn.status} ${body.email || ""})`);
    assert((await exchange({ code, verifier: p.verifier })).status === 404, `app ${id}: code still single-use`);
  }
  { const p = pair(); const out = await appFlow("google", p.challenge); const code = out.loc.split("#oauth=")[1];
    const r1 = await exchange({ code });
    assert(r1.status === 404, `app: missing verifier → ${r1.status}`);
    assert((await exchange({ code, verifier: p.verifier })).status === 404, "app: a refused attempt burns the code (an interceptor can't retry)"); }
  { const p = pair(); const out = await appFlow("google", p.challenge); const code = out.loc.split("#oauth=")[1];
    const r1 = await exchange({ code, verifier: pair().verifier });
    assert(r1.status === 404, `app: wrong verifier → ${r1.status}`); }
  { const p = pair(); const out = await appFlow("google", p.challenge); const code = out.loc.split("#oauth=")[1];
    const r1 = await exchange({ code, verifier: "short" });
    assert(r1.status === 404, `app: malformed verifier → ${r1.status}`); }
  { const p = pair(); const s1 = await go(`${B}/api/oauth/google/start?return=${encodeURIComponent("cyrahealth://auth/oauth")}&app_challenge=${p.challenge}`);
    assert(s1.status === 302, `app: cyrahealth://auth/oauth without an attempt id also accepted (${s1.status})`); }
  r = await go(`${B}/api/oauth/google/start?return=${encodeURIComponent(APP_RET)}`);
  assert(r.status === 400, `app: cyrahealth:// return without app_challenge → ${r.status}`);
  r = await go(`${B}/api/oauth/google/start?return=${encodeURIComponent(RET)}&app_challenge=${pair().challenge}`);
  assert(r.status === 400, `web: app_challenge on a web return refused → ${r.status}`);
  r = await go(`${B}/api/oauth/google/start?return=${encodeURIComponent(APP_RET)}&app_challenge=not-a-challenge`);
  assert(r.status === 400, `app: malformed app_challenge → ${r.status}`);
  for (const bad of ["evil://x", "javascript:alert(1)", "data:text/html,hi", "file:///etc/passwd", "intent://x#Intent;end", "cyrahealthx://auth/oauth", "https://app.example.evil/",
    // only exactly <scheme>://auth/oauth[?a=<id>] for this module
    "cyrahealth:auth/oauth", "cyrahealth://evil.example/x", "cyrahealth://auth/oura", "cyrahealth://auth/terra", "cyrahealth://auth/oauth/x", "cyrahealth://auth/oauth?x=1", "cyrahealth://auth/oauth?a=short", "cyrahealth://user@auth/oauth", "cyrahealth://auth:1/oauth",
    // the phone apps' own web-view origins are in CORS_ORIGIN but are never web returns
    "https://localhost/", "http://localhost/", "capacitor://localhost/"]) {
    r = await go(`${B}/api/oauth/google/start?return=${encodeURIComponent(bad)}&app_challenge=${pair().challenge}`);
    assert(r.status === 400, `start: return ${bad} rejected (${r.status})`);
  }
  // both or neither: a web code (no app_challenge bound) is refused when a verifier comes
  // with it — that is how the app redeems — so a web code injected into the app's link fails
  const webCode = async () => { let w = await go(`${B}/api/oauth/google/start?return=${encodeURIComponent(RET)}`); w = await go(w.headers.get("location")); w = await go(w.headers.get("location")); return (w.headers.get("location") || "").split("#oauth=")[1]; };
  { const code = await webCode();
    const r1 = await exchange({ code, verifier: pair().verifier });
    assert(r1.status === 404, `web code + any verifier (code injected into the app) → ${r1.status}`);
    assert((await exchange({ code })).status === 404, "web code: the refused attempt burns it"); }
  { const code = await webCode();
    const idn = await exchange({ code, verifier: "" });
    assert(idn.status === 200 && (await idn.json()).email === "ada@google.example", "web: no app_challenge bound, no verifier → exchange unchanged"); }
  // a return URL that already has a fragment gets a clean one
  { r = await go(`${B}/api/oauth/google/start?return=${encodeURIComponent(RET + "#stale")}`); r = await go(r.headers.get("location")); r = await go(r.headers.get("location"));
    assert(/^https:\/\/app\.example\/#oauth=[a-f0-9]+$/.test(r.headers.get("location") || ""), `web: stale fragment dropped (${(r.headers.get("location") || "").slice(0, 32)}…)`); }
} finally { backend.kill(); mock.close(); }

// APP_RETURN_SCHEMES is honoured, and can't switch on a dangerous scheme
const custom = spawn("node", ["server.js"], { env: { ...process.env, PORT: "3107", PUBLIC_BASE_URL: "http://127.0.0.1:3107", OAUTH_MOCK_BASE: MOCK, /* start never calls the provider */ CORS_ORIGIN: "https://app.example", AUTH_SECRET: "test-auth-secret", APP_RETURN_SCHEMES: "cyrabeta, javascript ,data" }, stdio: ["ignore", "ignore", "inherit"] });
try { await waitFor("http://127.0.0.1:3107/health");
  const ch = crypto.createHash("sha256").update(crypto.randomBytes(32).toString("base64url")).digest("base64url");
  const at = (ret) => go(`http://127.0.0.1:3107/api/oauth/google/start?return=${encodeURIComponent(ret)}&app_challenge=${ch}`).then((x) => x.status);
  assert(await at("cyrabeta://auth/oauth") === 302, "APP_RETURN_SCHEMES=cyrabeta: cyrabeta:// accepted");
  assert(await at("cyrahealth://auth/oauth") === 400, "APP_RETURN_SCHEMES=cyrabeta: default cyrahealth:// no longer accepted");
  assert(await at("javascript:alert(1)") === 400 && await at("data:text/html,x") === 400, "APP_RETURN_SCHEMES can't enable javascript: or data:");
} finally { custom.kill(); }

// RETURN_ORIGINS overrides CORS_ORIGIN for web returns; production fails closed without a list
const roEnv = { ...process.env, OAUTH_MOCK_BASE: MOCK, AUTH_SECRET: "test-auth-secret", APP_RETURN_SCHEMES: "" };
const ro = spawn("node", ["server.js"], { env: { ...roEnv, PORT: "3108", PUBLIC_BASE_URL: "http://127.0.0.1:3108", CORS_ORIGIN: "https://app.example,https://localhost", RETURN_ORIGINS: "https://web.example,https://localhost", NODE_ENV: "" }, stdio: ["ignore", "ignore", "inherit"] });
const prod = spawn("node", ["server.js"], { env: { ...roEnv, PORT: "3109", PUBLIC_BASE_URL: "http://127.0.0.1:3109", CORS_ORIGIN: "", RETURN_ORIGINS: "", NODE_ENV: "production" }, stdio: ["ignore", "ignore", "inherit"] });
try { await waitFor("http://127.0.0.1:3108/health"); await waitFor("http://127.0.0.1:3109/health");
  const at = (port, ret, extra = "") => go(`http://127.0.0.1:${port}/api/oauth/google/start?return=${encodeURIComponent(ret)}${extra}`).then((x) => x.status);
  assert(await at(3108, "https://web.example/") === 302 && await at(3108, "https://app.example/") === 400, "RETURN_ORIGINS: its origins are web returns, CORS_ORIGIN's are not");
  assert(await at(3108, "https://localhost/") === 400, "RETURN_ORIGINS: https://localhost still refused even when listed");
  assert(await at(3109, "https://anything.example/") === 400, "NODE_ENV=production, no CORS_ORIGIN/RETURN_ORIGINS: web returns fail closed");
  const ch = crypto.createHash("sha256").update(crypto.randomBytes(32).toString("base64url")).digest("base64url");
  assert(await at(3109, "cyrahealth://auth/oauth", `&app_challenge=${ch}`) === 302, "NODE_ENV=production: app links still work");
} finally { ro.kill(); prod.kill(); }

// unconfigured provider → 503 (separate backend without the mock)
const bare = spawn("node", ["server.js"], { env: { ...process.env, PORT: "3104", APPLE_CLIENT_ID: "", GOOGLE_CLIENT_ID: "", FACEBOOK_APP_ID: "", OAUTH_MOCK_BASE: "" }, stdio: ["ignore", "ignore", "inherit"] });
try { await waitFor("http://127.0.0.1:3104/health");
  const prov = await (await fetch("http://127.0.0.1:3104/api/oauth/providers")).json();
  assert(prov.apple === false && prov.google === false && prov.facebook === false, "providers: none configured without credentials");
  const r = await go(`http://127.0.0.1:3104/api/oauth/apple/start?return=${encodeURIComponent(RET)}`);
  assert(r.status === 503, "start: unconfigured provider → 503, never a fake login");
} finally { bare.kill(); }
console.log(process.exitCode ? "OAUTH SMOKE: FAILURES" : "OAUTH SMOKE: all passed");
