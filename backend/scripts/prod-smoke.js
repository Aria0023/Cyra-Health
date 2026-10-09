// Production guard smoke test (spec A12 / CH23). With NODE_ENV=production the server
//   - refuses to start (non-zero exit, a clear message naming the variable, never its
//     value) when ADMIN_KEY or AUTH_SECRET is unset, a demo value, too short, or the two
//     are equal — and, if partner webhooks are ever re-enabled, without real
//     PARTNER_<ID>_WEBHOOK_SECRET values;
//   - with real-looking secrets, starts and mounts exactly oauth, integrations, pulse,
//     push and ai: no partner/referral/FHIR/admin routes, no /r/:code, no ops console.
// Development (any other NODE_ENV) still mounts every module.
// Usage: node scripts/prod-smoke.js
import { spawn } from "child_process";
import crypto from "crypto";
import fs from "fs";
const assert = (c, m) => { if (!c) { console.error("FAIL:", m); process.exitCode = 1; } else console.log("ok  ", m); };
const PROD = ["oauth", "integrations", "pulse", "push", "ai"];
const ALL = JSON.parse(fs.readFileSync("config/app-dev.json")).modules;
const real = () => crypto.randomBytes(32).toString("hex");

/** Start server.js; resolve when it listens (→ { proc, out }) or exits (→ { code, out }). */
function run(env, port) {
  return new Promise((resolve) => {
    const proc = spawn("node", ["server.js"], { env: { ...process.env, ADMIN_KEY: "", AUTH_SECRET: "", CYRA_CONFIG: "", PORT: String(port), ...env }, stdio: ["ignore", "pipe", "pipe"] });
    let out = "", done = false;
    const finish = (v) => { if (!done) { done = true; clearTimeout(timer); resolve(v); } };
    const timer = setTimeout(() => { proc.kill(); finish({ code: "timeout", out }); }, 8000);
    proc.stdout.on("data", (d) => { out += d; if (/backend listening/.test(out)) finish({ proc, out }); });
    proc.stderr.on("data", (d) => { out += d; });
    proc.on("exit", (code) => finish({ code, out }));
  });
}
const mounted = (out) => [...out.matchAll(/module mounted: (\w+)/g)].map((m) => m[1]);

// refusals
const refusals = [
  ["unset", {}, [/ADMIN_KEY is not set/, /AUTH_SECRET is not set/]],
  ["demo values", { ADMIN_KEY: "demo-admin-key-change-me", AUTH_SECRET: "demo-auth-secret-change-me" }, [/ADMIN_KEY is still a demo/, /AUTH_SECRET is still a demo/]],
  ["placeholder", { ADMIN_KEY: real(), AUTH_SECRET: "please-change-me-before-launch" }, [/AUTH_SECRET is still a demo/]],
  ["too short", { ADMIN_KEY: "abc123", AUTH_SECRET: real() }, [/ADMIN_KEY is shorter than 16/]],
  ["equal", (() => { const v = real(); return { ADMIN_KEY: v, AUTH_SECRET: v }; })(), [/must be different/]],
];
let port = 3120;
for (const [label, env, want] of refusals) {
  const r = await run({ NODE_ENV: "production", ...env }, port++);
  if (r.proc) r.proc.kill();
  const values = Object.values(env).filter(Boolean);
  assert(typeof r.code === "number" && r.code !== 0 && /FATAL: refusing to start with NODE_ENV=production/.test(r.out) && want.every((re) => re.test(r.out)), `production, ${label}: exits ${r.code} with "${(r.out.match(/ {2}- .*/g) || []).join("; ").trim()}"`);
  assert(!values.some((v) => r.out.includes(v)) && !/module mounted/.test(r.out), `production, ${label}: no secret value printed, nothing mounted`);
}
// partner webhooks re-enabled in production need real per-partner secrets
{
  const cfg = JSON.parse(fs.readFileSync("config/app.json")); cfg.modules = [...cfg.modules, "webhooks"]; fs.writeFileSync("config/app.prod-test.json", JSON.stringify(cfg));
  const r = await run({ NODE_ENV: "production", ADMIN_KEY: real(), AUTH_SECRET: real(), CYRA_CONFIG: "config/app.prod-test.json" }, port++);
  if (r.proc) r.proc.kill();
  assert(r.code !== 0 && /PARTNER_MIDI_WEBHOOK_SECRET is not set/.test(r.out), `production + webhooks without PARTNER_<ID>_WEBHOOK_SECRET: refused (exit ${r.code})`);
  const r2 = await run({ NODE_ENV: "production", ADMIN_KEY: real(), AUTH_SECRET: real(), CYRA_CONFIG: "config/app.prod-test.json", PARTNER_MIDI_WEBHOOK_SECRET: "midi-demo-secret-change-me", PARTNER_ALLOY_WEBHOOK_SECRET: real(), PARTNER_NIGHTFALL_WEBHOOK_SECRET: real() }, port++);
  if (r2.proc) r2.proc.kill();
  assert(r2.code !== 0 && /PARTNER_MIDI_WEBHOOK_SECRET is still a demo/.test(r2.out) && !r2.out.includes("midi-demo-secret-change-me"), "production + webhooks with a demo partner secret: refused, value not printed");
  fs.rmSync("config/app.prod-test.json", { force: true });
}

// real-looking secrets: starts with exactly the five modules
{
  const ADMIN = real(), AUTH = real(), P = port++;
  const r = await run({ NODE_ENV: "production", ADMIN_KEY: ADMIN, AUTH_SECRET: AUTH }, P);
  try {
    assert(!!r.proc, `production, real secrets: starts (${r.proc ? "listening" : `exit ${r.code}`})`);
    const m = mounted(r.out);
    assert(m.length === 5 && PROD.every((x) => m.includes(x)), `production: mounts exactly ${m.join(", ")}`);
    assert(!r.out.includes(ADMIN) && !r.out.includes(AUTH), "production: secrets never logged");
    const B = `http://127.0.0.1:${P}`;
    const st = async (path, init) => (await fetch(`${B}${path}`, { redirect: "manual", ...init })).status;
    const jpost = (body) => ({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    assert(await st("/health") === 200 && await st("/api/pulse") === 200 && await st("/api/oauth/providers") === 200 && await st("/api/integrations/sources") === 200 && await st("/api/push/vapid") === 503 && await st("/api/ai/ask", jpost({ question: "Does exercise help sleep?" })) === 200, "production: the five modules answer (push 503 = VAPID not set here)");
    const gone = [["GET", "/"], ["GET", "/index.html"], ["GET", "/r/abcdef1234"], ["GET", "/api/partners"], ["POST", "/api/referrals/link"], ["POST", "/api/webhooks/midi"], ["GET", "/api/payouts"], ["GET", "/api/reports/partners/midi"], ["GET", "/api/catalog?stage=peri"], ["POST", "/api/agent/run"], ["GET", "/api/orgs/cyra/config"], ["GET", "/api/users"], ["POST", "/api/auth/login"], ["GET", "/api/fhir/outbox"], ["POST", "/api/fhir/push"], ["GET", "/api/affiliates"], ["POST", "/api/ai/welcome"], ["POST", "/api/ai/route"], ["POST", "/api/ai/insight"]];
    const statuses = [];
    for (const [method, path] of gone) statuses.push(`${method} ${path} ${await st(path, method === "POST" ? jpost({}) : { method })}`);
    assert(statuses.every((x) => x.endsWith(" 404")), `production: everything else is absent (${statuses.filter((x) => !x.endsWith(" 404")).join(", ") || "all 404"})`);
  } finally { r.proc?.kill(); }
}

// development: every module, the ops console and /r/:code
{
  const P = port++;
  const r = await run({ NODE_ENV: "" }, P);
  try {
    const m = mounted(r.out);
    assert(!!r.proc && m.length === ALL.length && ALL.every((x) => m.includes(x)), `development: mounts all ${m.length} modules from config/app-dev.json`);
    const B = `http://127.0.0.1:${P}`;
    const home = await fetch(`${B}/`); const html = await home.text();
    assert(home.status === 200 && /Ops Console/.test(html) && !/googleapis|gstatic/.test(html), "development: ops console served, no Google Fonts request");
    const rr = await fetch(`${B}/r/doesnotexist`, { redirect: "manual" });
    assert(rr.status === 404 && /Unknown referral/.test(await rr.text()), "development: /r/:code is routed");
  } finally { r.proc?.kill(); }
}
console.log(process.exitCode ? "PROD SMOKE: FAILURES" : "PROD SMOKE: all passed");
