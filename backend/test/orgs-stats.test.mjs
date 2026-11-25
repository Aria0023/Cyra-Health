// Unit tests for organization dashboards (docs/plans/upgrade-enterprise.md Task 4): totals only, any number under 10 as
// "fewer than 10" (by the server), no people, emails or account ids; and every role boundary: an owner sees every org; an
// org admin (an email listed on the org) signs in to the same portal and sees ONLY its org: another org's stats, owner
// pages and the partner routes all 403; a partner gets 403 on dashboards; nobody signed in gets 401.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import express from "express";
import { JsonStore } from "../src/core/store.js";
import * as accounts from "../src/modules/accounts/index.js";
import * as shop from "../src/modules/shop/index.js";
import * as orgs from "../src/modules/orgs/index.js";
import { masked, joinTotals, weekOf } from "../src/modules/orgs/stats.js";

const SECRET = "unit-test-secret-1234567890";
const DAY = 86_400_000;
const T0 = Date.UTC(2026, 10, 25, 9, 30); // a Wednesday
const THEME = { primary: "#2F5D50", accent: "#8A4E18", dark: { primary: "#8AC2B0", accent: "#D8A96A" } };

test("masked, weekOf and joinTotals", () => {
  assert.deepEqual(masked(9), { value: null, fewerThan: 10, text: "fewer than 10" });
  assert.deepEqual(masked(0), { value: null, fewerThan: 10, text: "fewer than 10" });
  assert.deepEqual(masked(10), { value: 10, text: "10" });
  assert.equal(weekOf("2026-11-25"), "2026-11-23");
  assert.equal(weekOf("2026-11-23"), "2026-11-23");
  assert.equal(weekOf("2026-11-22"), "2026-11-16");
  const t = joinTotals([{ day: "2026-11-25", slug: "a", joins: 4 }, { day: "2026-11-23", slug: "a", joins: 8 }, { day: "2026-11-20", slug: "a", joins: 11 }, { day: "2026-01-01", slug: "a", joins: 3 }, { day: "2026-11-25", slug: "b", joins: 50 }], "a", T0);
  assert.equal(t.joined, 26);
  assert.equal(t.byWeek.length, 12);
  assert.deepEqual(t.byWeek.at(-1), { week: "2026-11-23", joins: 12 });
  assert.deepEqual(t.byWeek.at(-2), { week: "2026-11-16", joins: 11 });
});

/* ---------- the routes, in process ---------- */
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "orgs-stats-test-"));
process.on("exit", () => fs.rmSync(dir, { recursive: true, force: true }));
const inbox = [], appCodes = [];
const mailer = { ready: true, async send(to, subject, text) { inbox.push({ to, subject, text }); } };
const sender = { ready: true, dev: false, async send(to, code) { appCodes.push({ to, code }); } };
const store = new JsonStore(dir);
const fast = 1000;
const active = new Set();
const rc = { configured: true, async active(id) { return active.has(id); } };
const ctx = { config: { authSecret: SECRET, production: true, baseUrl: "https://api.solia.example", accounts: { startPerMinute: fast, verifyPerMinute: fast, perMinute: fast, codesPerAddress: fast }, shop: { startPerMinute: fast, verifyPerMinute: fast, writePerMinute: fast, readPerMinute: fast, codesPerAddress: fast }, orgs: { publicPerMinute: fast, joinPerMinute: fast, readPerMinute: fast, writePerMinute: fast } }, store, onShutdown: [] };
const app = express(); app.use(express.json());
for (const [mod, opts] of [[accounts, { clock: () => T0, sweepMs: 0, sender }], [shop, { clock: () => T0, sweepMs: 0, mailer, owners: ["owner@solia.example"], tapFlushMs: 0 }], [orgs, { clock: () => T0, rc }]]) {
  const r = express.Router(); mod.mount(r, ctx, opts); app.use(mod.basePath, r);
}
const srv = await new Promise((r) => { const s = app.listen(0, "127.0.0.1", () => r(s)); });
const B = `http://127.0.0.1:${srv.address().port}`;
const req = (method, p, body, token) => fetch(`${B}${p}`, { method, headers: { ...(body !== undefined ? { "content-type": "application/json" } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
async function portalSignIn(email) {
  const s = await req("POST", "/api/shop/auth/start", { email });
  assert.equal(s.status, 200);
  const code = /(\d{6})/.exec(inbox.filter((m) => m.to === email && /code/.test(m.subject)).at(-1)?.subject || "")?.[1];
  const v = await req("POST", "/api/shop/auth/verify", { email, code });
  return v.status === 200 ? (await v.json()) : { status: v.status };
}
async function appSignIn(email) {
  await req("POST", "/api/accounts/email/start", { email });
  return (await req("POST", "/api/accounts/email/verify", { email, code: appCodes.filter((c) => c.to === email).at(-1).code })).json();
}
let owner, ana, pat;

test("setup: two organizations, an org admin for one of them, a partner", async () => {
  await ctx.shopReady; await ctx.orgsReady;
  owner = (await portalSignIn("owner@solia.example")).token;
  for (const [slug, name, code, admins] of [["lakeside", "Lakeside Clinic", "LAKE2026", ["ana@lakeside.example"]], ["harbor", "Harbor Works", "HARB2026", ["hal@harbor.example"]]]) {
    assert.equal((await req("POST", "/api/orgs", { slug, name, theme: THEME, stages: ["peri", "meno"], inviteCode: code, admins }, owner)).status, 201);
  }
  assert.equal((await req("POST", "/api/shop/invites", { email: "pat@oura.example", brandIds: ["oura"] }, owner)).status, 201);
  pat = (await portalSignIn("pat@oura.example")).token;
  const a = await portalSignIn("ana@lakeside.example");
  assert.deepEqual(a.me, { email: "ana@lakeside.example", role: "orgAdmin", brandIds: [], orgSlugs: ["lakeside"] });
  ana = a.token;
  assert.equal((await portalSignIn("nobody@lakeside.example")).status, 401, "an address on no org has no portal access");
});

test("org admin: only its organization; owner pages, partner routes and other orgs refused; owner sees all", async () => {
  assert.deepEqual((await (await req("GET", "/api/orgs/mine", undefined, ana)).json()).orgs, [{ slug: "lakeside", name: "Lakeside Clinic" }]);
  assert.deepEqual((await (await req("GET", "/api/orgs/mine", undefined, owner)).json()).orgs.map((o) => o.slug).sort(), ["harbor", "lakeside"]);
  assert.equal((await req("GET", "/api/orgs/lakeside/stats", undefined, ana)).status, 200);
  for (const [m, p, b] of [["GET", "/api/orgs/harbor/stats"], ["GET", "/api/orgs/nowhere/stats"], ["GET", "/api/orgs"], ["POST", "/api/orgs", { slug: "mine-too", name: "X" }], ["PATCH", "/api/orgs/lakeside", { name: "Mine" }],
    ["GET", "/api/shop/brands"], ["GET", "/api/shop/products"], ["GET", "/api/shop/taps"], ["GET", "/api/shop/partners"], ["GET", "/api/shop/audit"], ["POST", "/api/shop/products", { brandId: "oura", name: "x" }]]) {
    assert.equal((await req(m, p, b, ana)).status, 403, `org admin ${m} ${p}`);
  }
  assert.equal((await req("GET", "/api/shop/me", undefined, ana)).status, 200, "its own session");
  // a partner and nobody
  for (const p of ["/api/orgs/mine", "/api/orgs/lakeside/stats"]) {
    assert.equal((await req("GET", p, undefined, pat)).status, 403, `partner ${p}`);
    assert.equal((await req("GET", p)).status, 401, `anonymous ${p}`);
    assert.equal((await req("GET", p, undefined, "forged.token")).status, 401, `forged ${p}`);
  }
  assert.equal((await req("GET", "/api/orgs/harbor/stats", undefined, owner)).status, 200, "an owner sees every org");
  // removed from the org's admins: the next request is refused
  assert.equal((await req("PATCH", "/api/orgs/lakeside", { admins: [] }, owner)).status, 200);
  assert.equal((await req("GET", "/api/orgs/lakeside/stats", undefined, ana)).status, 401);
  assert.equal((await req("PATCH", "/api/orgs/lakeside", { admins: ["ana@lakeside.example"] }, owner)).status, 200);
});

test("stats: totals only, under 10 as 'fewer than 10'; joins per week; signed-in and Pro counts", async () => {
  const s0 = await (await req("GET", "/api/orgs/lakeside/stats", undefined, ana)).json();
  assert.deepEqual([s0.joined, s0.signedIn, s0.pro].map((x) => x.text), ["fewer than 10", "fewer than 10", "fewer than 10"]);
  assert.equal(s0.joined.value, null, "the small number itself is never sent");
  // 12 anonymous joins and 10 signed-in ones, 3 of them Pro
  for (let i = 0; i < 12; i++) await req("POST", "/api/orgs/join", { code: "LAKE2026" });
  for (let i = 0; i < 10; i++) { const a = await appSignIn(`p${i}@x.example`); await req("POST", "/api/orgs/join", { slug: "lakeside" }, a.token); if (i < 3) active.add(a.account.id); }
  const s = await (await req("GET", "/api/orgs/lakeside/stats", undefined, ana)).json();
  assert.deepEqual(s.joined, { value: 22, text: "22" });
  assert.deepEqual(s.signedIn, { value: 10, text: "10" });
  assert.equal(s.pro.text, "fewer than 10");
  assert.equal(s.joinsByWeek.length, 12);
  assert.deepEqual(s.joinsByWeek.at(-1), { week: "2026-11-23", value: 22, text: "22" });
  assert.equal(s.joinsByWeek.at(-2).text, "fewer than 10");
  const body = JSON.stringify(s);
  assert.doesNotMatch(body, /@|acct|"id"|LAKE2026/, "no email, account id or invite code");
  assert.deepEqual(Object.keys(s).sort(), ["asOf", "joined", "joinsByWeek", "name", "pro", "signedIn", "slug", "small"]);
  // the other organization is untouched
  const h = await (await req("GET", "/api/orgs/harbor/stats", undefined, owner)).json();
  assert.equal(h.joined.text, "fewer than 10");
});

test("Pro without RevenueCat: 'not available', never a guess", async () => {
  const st = new JsonStore(fs.mkdtempSync(path.join(os.tmpdir(), "orgs-stats-norc-")));
  const c2 = { ...ctx, store: st, onShutdown: [] };
  const a2 = express(); a2.use(express.json());
  for (const [mod, opts] of [[accounts, { clock: () => T0, sweepMs: 0, sender }], [shop, { clock: () => T0, sweepMs: 0, mailer, owners: ["owner@solia.example"], tapFlushMs: 0 }], [orgs, { clock: () => T0, rc: { configured: false } }]]) { const r = express.Router(); mod.mount(r, c2, opts); a2.use(mod.basePath, r); }
  const s2 = await new Promise((r) => { const s = a2.listen(0, "127.0.0.1", () => r(s)); });
  const B2 = `http://127.0.0.1:${s2.address().port}`;
  await c2.shopReady; await c2.orgsReady;
  await fetch(`${B2}/api/shop/auth/start`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "owner@solia.example" }) });
  const code = /(\d{6})/.exec(inbox.filter((m) => m.to === "owner@solia.example").at(-1).subject)[1];
  const tok = (await (await fetch(`${B2}/api/shop/auth/verify`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "owner@solia.example", code }) })).json()).token;
  const H = { "content-type": "application/json", authorization: `Bearer ${tok}` };
  await fetch(`${B2}/api/orgs`, { method: "POST", headers: H, body: JSON.stringify({ slug: "lakeside", name: "Lakeside", theme: THEME }) });
  const s = await (await fetch(`${B2}/api/orgs/lakeside/stats`, { headers: H })).json();
  assert.equal(s.pro.text, "not available");
  assert.match(s.pro.unavailable, /REVENUECAT_SECRET_KEY/);
  await new Promise((r) => s2.close(r)); for (const fn of c2.onShutdown) await fn();
});

test("cleanup", async () => { await new Promise((r) => srv.close(r)); for (const fn of ctx.onShutdown) await fn(); });
