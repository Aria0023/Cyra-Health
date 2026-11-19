// Unit tests for launch readiness (docs/plans/launch-tools.md Task 1): the rows and their statuses come from presence
// and shape checks only; NO secret value is ever in an answer (the values below are recognisable and searched for);
// the two live checks (a test email to the signed-in owner, the storage round trip) run only when asked; owner only.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import express from "express";
import { JsonStore } from "../src/core/store.js";
import { appSeen } from "../src/core/appSeen.js";
import * as accounts from "../src/modules/accounts/index.js";
import * as shop from "../src/modules/shop/index.js";
import * as insights from "../src/modules/insights/index.js";
import { readinessRows, readinessSummary, storageRoundTrip, APP_SIDE } from "../src/modules/insights/readiness.js";
import { PRODUCTION_MODULES } from "../src/core/registry.js";

const S = (n) => `SECRETVALUE${n}zzzzzzzzzzzzzzzz`;
const FULL = {
  AUTH_SECRET: S(1), ADMIN_KEY: S(2), ADMIN_EMAILS: "owner@solia.example, second@solia.example", RESEND_API_KEY: S(3), EMAIL_FROM: "Solia Health <signin@solia.example>",
  APPLE_CLIENT_ID: S(4), APPLE_TEAM_ID: S(5), APPLE_KEY_ID: S(6), APPLE_PRIVATE_KEY: `-----BEGIN PRIVATE KEY-----\\n${S(7)}\\n-----END PRIVATE KEY-----`,
  GOOGLE_CLIENT_ID: S(8), GOOGLE_CLIENT_SECRET: S(9), FACEBOOK_APP_ID: S(10), FACEBOOK_APP_SECRET: S(11), ANTHROPIC_API_KEY: S(12),
  REVENUECAT_SECRET_KEY: `sk_${S(13)}`, REVENUECAT_PROJECT_ID: "proj1234", IMPACT_ACCOUNT_SID: S(14), IMPACT_AUTH_TOKEN: S(15), OURA_CLIENT_ID: S(16), OURA_CLIENT_SECRET: S(17), DATA_DIR: "/var/data/SECRETVALUEdir",
};
const byId = (rows) => Object.fromEntries(rows.map((r) => [r.id, r]));
const prod = { production: true, modules: [...PRODUCTION_MODULES] };
const on = { configured: true, missing: [] };

test("readinessRows: everything set and in shape is Ready, and no value is in the rows", () => {
  const rows = readinessRows({ env: FULL, config: prod, rc: on, impact: on, storage: { dirSet: true, writable: true, before: true } });
  assert.deepEqual(rows.map((r) => r.id), ["auth-secret", "admin-key", "owners", "email", "signin-apple", "signin-google", "signin-facebook", "ai", "subscriptions", "impact", "oura", "storage", "modules"]);
  assert.deepEqual(rows.filter((r) => r.status !== "ready"), []);
  assert.ok(rows.findIndex((r) => r.id === "signin-apple") < rows.findIndex((r) => r.id === "signin-google"), "Apple first");
  assert.deepEqual(rows.filter((r) => r.required).map((r) => r.id), ["auth-secret", "admin-key", "owners", "email", "signin-apple", "ai", "storage", "modules"]);
  const s = readinessSummary(rows);
  assert.equal(s.line, "13 of 13 ready. Nothing needed for launch is missing.");
  assert.doesNotMatch(JSON.stringify(rows), /SECRETVALUE|solia\.example|proj1234/);
  for (const r of rows) for (const v of r.vars) assert.deepEqual(Object.keys(v), ["name", "set"]);
});

test("readinessRows: nothing set names the exact variables; the summary lists what launch needs", () => {
  const rows = readinessRows({ env: {}, config: { production: true, modules: ["ai", "push"] }, rc: { configured: false }, impact: { configured: false }, storage: { dirSet: false, writable: true, before: false } });
  const r = byId(rows);
  for (const id of ["auth-secret", "admin-key", "owners", "email", "signin-apple", "signin-google", "signin-facebook", "ai", "subscriptions", "impact", "oura", "storage"]) assert.equal(r[id].status, "not-set-up", id);
  assert.deepEqual(r.email.vars, [{ name: "RESEND_API_KEY", set: false }, { name: "EMAIL_FROM", set: false }]);
  assert.deepEqual(r["signin-apple"].vars.map((v) => v.name), ["APPLE_CLIENT_ID", "APPLE_TEAM_ID", "APPLE_KEY_ID", "APPLE_PRIVATE_KEY"]);
  assert.deepEqual(r.subscriptions.vars.map((v) => v.name), ["REVENUECAT_SECRET_KEY", "REVENUECAT_PROJECT_ID"]);
  assert.equal(r.modules.status, "problem");
  assert.match(r.modules.detail, /Not mounted: oauth, accounts, integrations, shop, portal, subscriptions, insights\./);
  assert.equal(readinessSummary(rows).line, "0 of 13 ready. Needed for launch: Sign-in secret, Admin key, Owners, Email, Sign in with Apple, AI, Storage, Modules.");
});

test("readinessRows: half-set groups and bad shapes are Problems, described without the value", () => {
  const env = { ...FULL, AUTH_SECRET: "short-SECRETVALUE", ADMIN_KEY: "demo-admin-key-change-me", ADMIN_EMAILS: "owner@solia.example, not-an-address-SECRETVALUE", EMAIL_FROM: "SECRETVALUE no address", APPLE_PRIVATE_KEY: S(7), GOOGLE_CLIENT_SECRET: "", REVENUECAT_SECRET_KEY: `appl_${S(13)}`, OURA_CLIENT_ID: "" };
  const rows = readinessRows({ env, config: prod, rc: on, impact: { configured: false, missing: [] }, storage: { dirSet: true, writable: false, before: null } });
  const r = byId(rows);
  for (const id of ["admin-key", "owners", "email", "signin-apple", "signin-google", "subscriptions", "impact", "oura", "storage"]) assert.equal(r[id].status, "problem", id);
  assert.equal(r["auth-secret"].status, "ready", "17 characters is long enough");
  assert.match(r["admin-key"].detail, /ADMIN_KEY is still a demo\/placeholder value/);
  assert.match(r.owners.detail, /1 of 2 entries isn't a valid email address and is ignored/);
  assert.match(r["signin-google"].detail, /GOOGLE_CLIENT_SECRET is missing/);
  assert.match(r.subscriptions.detail, /starts sk_/);
  assert.doesNotMatch(JSON.stringify(rows), /SECRETVALUE/);
  // storage: set and writable but nothing from before this start is "not confirmed yet", never Ready
  const first = byId(readinessRows({ env: FULL, config: prod, storage: { dirSet: true, writable: true, before: false } })).storage;
  assert.equal(first.status, "not-set-up"); assert.match(first.detail, /^Not confirmed yet/);
  assert.equal(byId(readinessRows({ env: { ...FULL, DATA_DIR: "" }, config: prod, storage: { dirSet: false, writable: true, before: true } })).storage.status, "not-set-up", "the default folder is never Ready");
  const same = byId(readinessRows({ env: { ...FULL, ADMIN_KEY: FULL.AUTH_SECRET }, config: prod, storage: {} }));
  assert.equal(same["admin-key"].status, "problem");
});

test("appSeen: one time in memory, only for an allowed origin that isn't the server's own", () => {
  let now = 1000;
  const seen = appSeen({ origins: ["https://app.example"], clock: () => now });
  const call = (origin) => seen.middleware({ get: (k) => ({ origin, host: "api.example" })[k], protocol: "https" }, {}, () => {});
  assert.equal(seen.last(), null);
  call(undefined); call("https://evil.example"); call("https://api.example"); call("null");
  assert.equal(seen.last(), null);
  now = Date.UTC(2026, 10, 19, 9); call("https://app.example");
  assert.equal(seen.last(), "2026-11-19T09:00:00.000Z");
  assert.deepEqual(Object.keys(seen), ["middleware", "last"]);
});

/* ---------- the routes, in process ---------- */
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "insights-readiness-test-"));
process.on("exit", () => fs.rmSync(dir, { recursive: true, force: true }));
const now = Date.UTC(2026, 10, 19, 9, 30);
const inbox = [], sent = [];
let mailFails = false;
const portalMailer = { ready: true, async send(to, subject, text) { inbox.push({ to, subject, text }); } };
const mailer = { ready: true, async send(to, subject, text) { if (mailFails) throw Object.assign(new Error("send"), { cat: "email provider answered 403" }); sent.push({ to, subject, text }); } };
const fast = 1000;
const mk = (store, extra = {}) => ({ config: { authSecret: FULL.AUTH_SECRET, production: true, modules: [...PRODUCTION_MODULES], baseUrl: "https://api.solia.example", accounts: { startPerMinute: fast, verifyPerMinute: fast, perMinute: fast, codesPerAddress: fast }, shop: { startPerMinute: fast, verifyPerMinute: fast, writePerMinute: fast, readPerMinute: fast, codesPerAddress: fast }, insights: { readPerMinute: fast, writePerMinute: fast, sendPerMinute: fast } }, store, onShutdown: [], ...extra });
const store = new JsonStore(dir);
const ctx = mk(store, { appLastSeen: () => "2026-11-19T09:00:00.000Z" });
const app = express(); app.use(express.json());
for (const [mod, opts] of [[accounts, { clock: () => now, sweepMs: 0, sender: { ready: true, dev: false, async send() {} } }], [shop, { clock: () => now, sweepMs: 0, mailer: portalMailer, owners: ["owner@solia.example"], tapFlushMs: 0 }], [insights, { clock: () => now, mailer, timerMs: 0, env: FULL, rc: on, impact: { ...on, campaigns: async () => [], performance: async () => [] } }]]) {
  const r = express.Router(); mod.mount(r, ctx, opts); app.use(mod.basePath, r);
}
const srv = await new Promise((r) => { const s = app.listen(0, "127.0.0.1", () => r(s)); });
const B = `http://127.0.0.1:${srv.address().port}`;
const req = (method, p, body, token) => fetch(`${B}${p}`, { method, headers: { ...(body !== undefined ? { "content-type": "application/json" } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
async function portalSignIn(email) {
  await req("POST", "/api/shop/auth/start", { email });
  const code = /(\d{6})/.exec(inbox.filter((m) => m.to === email && /code/.test(m.subject)).at(-1)?.subject || "")?.[1];
  return (await (await req("POST", "/api/shop/auth/verify", { email, code })).json()).token;
}
const logs = [];
let owner;

test("GET /readiness: owner only; statuses, the summary, modules and the app's side; never a value", async () => {
  await ctx.shopReady;
  const orig = { log: console.log, warn: console.warn };
  console.log = (...a) => logs.push(a.join(" ")); console.warn = (...a) => logs.push(a.join(" "));
  try {
    assert.equal((await req("GET", "/api/insights/readiness")).status, 401);
    owner = await portalSignIn("owner@solia.example");
    await req("POST", "/api/shop/invites", { email: "pat@oura.example", brandIds: ["oura"] }, owner);
    const partner = await portalSignIn("pat@oura.example");
    for (const [m, p] of [["GET", "/api/insights/readiness"], ["POST", "/api/insights/readiness/test-email"], ["POST", "/api/insights/readiness/storage-check"]]) assert.equal((await req(m, p, m === "POST" ? {} : undefined, partner)).status, 403, p);
    const res = await req("GET", "/api/insights/readiness", undefined, owner), raw = await res.text(), r = JSON.parse(raw);
    assert.equal(res.headers.get("cache-control"), "no-store");
    assert.doesNotMatch(raw, /SECRETVALUE|proj1234/, "no secret value, whole or in part");
    const rows = byId(r.rows);
    assert.equal(rows.storage.status, "not-set-up", "first start with this folder: not confirmed yet");
    assert.equal(r.summary.line, "12 of 14 ready. Needed for launch: Storage.");
    assert.deepEqual(r.modules.mounted, [...PRODUCTION_MODULES]);
    assert.deepEqual([r.app.lastSeenAt, r.app.tracked, r.email, r.production], ["2026-11-19T09:00:00.000Z", true, "ready", true]);
    assert.deepEqual(r.app.vars, JSON.parse(JSON.stringify(APP_SIDE)));
    assert.equal(r.app.vars[0].name, "VITE_API_BASE");
    assert.equal(sent.length, 0, "opening the page sends nothing");
  } finally { console.log = orig.log; console.warn = orig.warn; }
});

test("a second start with the same folder finds the earlier data: storage is Ready", async () => {
  await ctx.readinessBoot;
  const ctx2 = mk(new JsonStore(dir));
  const r1 = express.Router(); shop.mount(r1, ctx2, { clock: () => now, sweepMs: 0, mailer: portalMailer, owners: ["owner@solia.example"], tapFlushMs: 0 });
  const r2 = express.Router(); insights.mount(r2, ctx2, { clock: () => now, mailer, timerMs: 0, env: FULL, rc: on, impact: on });
  assert.deepEqual(await ctx2.readinessBoot, { before: true, firstAt: "2026-11-19T09:30:00.000Z", writable: true });
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, "server_starts.json"), "utf8"))[0].count, 2);
  for (const fn of ctx2.onShutdown) await fn();
});

test("the two live checks: a test email to the signed-in owner only, and the storage round trip leaves nothing behind", async () => {
  const orig = { log: console.log, warn: console.warn };
  console.log = (...a) => logs.push(a.join(" ")); console.warn = (...a) => logs.push(a.join(" "));
  try {
    const m = await (await req("POST", "/api/insights/readiness/test-email", { to: "someone@else.example" }, owner)).json();
    assert.deepEqual(m, { sent: true });
    assert.deepEqual(sent.map((x) => x.to), ["owner@solia.example"], "always the signed-in owner, whatever the body says");
    assert.match(sent[0].subject, /test email/);
    mailFails = true;
    const bad = await req("POST", "/api/insights/readiness/test-email", {}, owner);
    assert.equal(bad.status, 502); assert.match((await bad.json()).error, /email provider answered 403/);
    mailFails = false;
    const before = fs.readdirSync(dir).sort();
    const d = await (await req("POST", "/api/insights/readiness/storage-check", {}, owner)).json();
    assert.deepEqual([d.ok, d.wrote, d.read, d.deleted, d.error, d.dirSet], [true, true, true, true, null, true]);
    assert.deepEqual(fs.readdirSync(dir).sort().filter((f) => f !== "shop_audit.json"), before.filter((f) => f !== "shop_audit.json"), "the temp file is gone");
    const ro = await storageRoundTrip({ dir: path.join(dir, "no-such-folder") });
    assert.equal(ro.ok, false); assert.match(ro.error, /couldn't be written to \(ENOENT\)/);
    assert.doesNotMatch(logs.join("\n"), /SECRETVALUE|owner@solia\.example/, "nothing secret and no address in the log");
  } finally { console.log = orig.log; console.warn = orig.warn; }
});

test.after(async () => { for (const fn of ctx.onShutdown) await fn(); srv.close(); });
