// Unit tests for the owner settings (docs/plans/upgrade-enterprise.md Task 2): the checks, the public app config (nothing
// about anyone; the announcement only while on), owner-only writes with a change log, and each role boundary: an owner may
// read and write, a partner gets 403, nobody signed in gets 401. In process: shop + settings on one Express app.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import express from "express";
import { JsonStore } from "../src/core/store.js";
import * as shop from "../src/modules/shop/index.js";
import * as settings from "../src/modules/settings/index.js";
import { cleanSettings, publicConfig, DEFAULTS, REMOTE_OFF, STYLE_KEYS } from "../src/modules/settings/index.js";

const SECRET = "unit-test-secret-1234567890";
const T0 = Date.UTC(2026, 10, 25, 9, 30);

test("cleanSettings: every field checked, unknown fields and bad values refused", () => {
  assert.deepEqual(cleanSettings({ featuresOff: ["shop", "ai", "shop"] }).patch, { featuresOff: ["ai", "shop"] });
  for (const bad of [["signin"], ["deviceSync"], ["cloudBackup"], "ai", [1]]) assert.equal(cleanSettings({ featuresOff: bad }).status, 400, `featuresOff ${JSON.stringify(bad)}`);
  assert.equal(cleanSettings({ trialDays: 14 }).status, 400, "the trial length is not a setting");
  assert.equal(cleanSettings({ privacyLine: "x" }).status, 400);
  assert.deepEqual(cleanSettings({ defaultStyle: "aura", defaultPalette: 2 }).patch, { defaultStyle: "aura", defaultPalette: 2 });
  assert.equal(cleanSettings({ defaultStyle: "bloom" }).status, 400);
  assert.equal(cleanSettings({ defaultPalette: 3 }).status, 400);
  assert.deepEqual(cleanSettings({ announcement: { on: true, text: "  New: Shop by need  " } }).patch, { announcement: { on: true, text: "New: Shop by need" } });
  assert.equal(cleanSettings({ announcement: { on: true, text: "" } }).status, 400, "on needs text");
  assert.equal(cleanSettings({ announcement: { on: false, text: "x".repeat(141) } }).status, 400, "length-capped");
  assert.equal(cleanSettings({ announcement: { on: true, text: "<b>hi</b>" } }).status, 400, "plain text only");
  assert.deepEqual(cleanSettings({ announcement: { on: false, text: "" } }).patch, { announcement: { on: false, text: "" } });
  assert.deepEqual(cleanSettings({ helpLines: ["One.", "  ", "Two."] }).patch, { helpLines: ["One.", "Two."] });
  assert.equal(cleanSettings({ helpLines: ["a", "b", "c", "d"] }).status, 400);
  assert.equal(cleanSettings({ helpLines: ["x".repeat(241)] }).status, 400);
  assert.deepEqual(cleanSettings({ prices: { monthly: "$8.95", annual: "" } }).patch, { prices: { monthly: "$8.95", annual: null } });
  for (const bad of [{ monthly: "8.95" }, { monthly: "$8.9" }, { weekly: "$1" }, { annual: "€90" }]) assert.equal(cleanSettings({ prices: bad }).status, 400, JSON.stringify(bad));
  assert.deepEqual(REMOTE_OFF, ["ai", "shop", "wearables", "webReminders", "counts"]);
  assert.equal(STYLE_KEYS.length, 9);
});

test("publicConfig: the announcement only while on; nothing else is added", () => {
  const c = publicConfig({ ...DEFAULTS, announcement: { on: false, text: "Hidden" } });
  assert.equal(c.announcement, null);
  assert.deepEqual(Object.keys(c).sort(), ["announcement", "defaultPalette", "defaultStyle", "featuresOff", "helpLines", "prices", "updatedAt", "version"]);
  assert.equal(publicConfig({ ...DEFAULTS, announcement: { on: true, text: "Shown" } }).announcement, "Shown");
});

/* ---------- the routes, in process ---------- */
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "settings-test-"));
process.on("exit", () => fs.rmSync(dir, { recursive: true, force: true }));
const inbox = [];
const mailer = { ready: true, async send(to, subject, text) { inbox.push({ to, subject, text }); } };
const store = new JsonStore(dir);
const fast = 1000;
const ctx = { config: { authSecret: SECRET, production: true, baseUrl: "https://api.solia.example", shop: { startPerMinute: fast, verifyPerMinute: fast, writePerMinute: fast, readPerMinute: fast, codesPerAddress: fast }, settings: { publicPerMinute: fast, readPerMinute: fast, writePerMinute: fast } }, store, onShutdown: [] };
const app = express(); app.use(express.json());
for (const [mod, opts] of [[shop, { clock: () => T0, sweepMs: 0, mailer, owners: ["owner@solia.example"], tapFlushMs: 0 }], [settings, { clock: () => T0 }]]) {
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
let owner, partner;

test("roles: owner reads and writes; a partner gets 403; nobody signed in gets 401; the public config needs nothing", async () => {
  await ctx.shopReady;
  owner = await portalSignIn("owner@solia.example");
  assert.equal((await req("POST", "/api/shop/invites", { email: "pat@oura.example", brandIds: ["oura"] }, owner)).status, 201);
  partner = await portalSignIn("pat@oura.example");
  assert.ok(owner && partner);
  for (const [m, p, b] of [["GET", "/api/settings"], ["GET", "/api/settings/log"], ["PUT", "/api/settings", { featuresOff: ["shop"] }]]) {
    assert.equal((await req(m, p, b)).status, 401, `anonymous ${m} ${p}`);
    assert.equal((await req(m, p, b, partner)).status, 403, `partner ${m} ${p}`);
    assert.equal((await req(m, p, b, "not.a.token")).status, 401, `bad token ${m} ${p}`);
  }
  const pub = await req("GET", "/api/app-config");
  assert.equal(pub.status, 200);
  assert.deepEqual(await pub.json(), publicConfig(DEFAULTS, null), "built-in defaults until an owner changes one");
  const r = await req("GET", "/api/settings", undefined, owner);
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.ok(j.notEditable.some((x) => /Privacy claims/.test(x)) && j.notEditable.some((x) => /trial/.test(x)) && j.notEditable.some((x) => /Apple/.test(x)));
});

test("an owner's change: saved, in the public config, and in the change log (who, when, old → new)", async () => {
  const bad = await req("PUT", "/api/settings", { announcement: { on: true, text: "" } }, owner);
  assert.equal(bad.status, 400);
  const r = await req("PUT", "/api/settings", { featuresOff: ["shop"], announcement: { on: true, text: "Shop by need is resting this week." }, prices: { monthly: "$8.95", annual: null } }, owner);
  assert.equal(r.status, 200);
  assert.deepEqual((await r.json()).changed.sort(), ["announcement", "featuresOff", "prices"]);
  const pub = await (await req("GET", "/api/app-config")).json();
  assert.deepEqual(pub.featuresOff, ["shop"]);
  assert.equal(pub.announcement, "Shop by need is resting this week.");
  assert.deepEqual(pub.prices, { monthly: "$8.95", annual: null });
  assert.equal(pub.updatedAt, new Date(T0).toISOString());
  assert.doesNotMatch(JSON.stringify(pub), /@/, "no email in the public config");
  const log = (await (await req("GET", "/api/settings/log", undefined, owner)).json()).log;
  const row = log.find((x) => x.field === "featuresOff");
  assert.deepEqual([row.by, row.at, row.from, row.to], ["owner@solia.example", new Date(T0).toISOString(), "[]", "[\"shop\"]"]);
  // the same value again changes nothing and logs nothing
  const again = await req("PUT", "/api/settings", { featuresOff: ["shop"] }, owner);
  assert.deepEqual((await again.json()).changed, []);
  assert.equal((await (await req("GET", "/api/settings/log", undefined, owner)).json()).log.length, log.length);
  // the portal's Activity log lists it too
  const audit = JSON.parse(fs.readFileSync(path.join(dir, "shop_audit.json"), "utf8"));
  assert.ok(audit.some((a) => a.action === "settings" && a.by === "owner@solia.example"));
  // turning the announcement off hides it publicly
  await req("PUT", "/api/settings", { announcement: { on: false, text: "Shop by need is resting this week." } }, owner);
  assert.equal((await (await req("GET", "/api/app-config")).json()).announcement, null);
});

test("cleanup", async () => { await new Promise((r) => srv.close(r)); for (const fn of ctx.onShutdown) await fn(); });
