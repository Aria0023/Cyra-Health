// Unit tests for the anonymous shop tap counts (docs/plans/tracking-reports.md Task 1): the body is exactly
// { productId }, an unknown or unpublished id is refused, the store holds ONLY one total per product per day (no row per
// request, no address, no account, no time of day), rows older than 400 days go, a partner reads only its own brands'
// totals, and nothing about a tap is logged. In process, with an injected clock; the store is a JsonStore in a temp dir.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import express from "express";
import { JsonStore } from "../src/core/store.js";
import { mount, basePath, cleanTap, mergeTaps, tapTotals, tapSince, TAP_KEEP_DAYS } from "../src/modules/shop/index.js";

const SECRET = "unit-test-secret-1234567890";
const DAY = 86_400_000;

test("cleanTap: exactly { productId }; any other field, shape or id is refused", () => {
  assert.deepEqual(cleanTap({ productId: "oura" }), { productId: "oura" });
  for (const bad of [null, [], "oura", {}, { productId: "Oura" }, { productId: "oura", stage: "peri" }, { productId: "oura", accountId: "a" }, { productId: 7 }, { productId: "x".repeat(49) }, { id: "oura" }, { productId: "../etc" }]) assert.equal(cleanTap(bad), null, JSON.stringify(bad));
});

test("mergeTaps and tapTotals: one row per product per day; old rows are dropped; totals by brand, product and day", () => {
  const rows = [{ day: "2025-01-01", productId: "old", brandId: "b", taps: 9 }, { day: "2026-11-18", productId: "oura", brandId: "oura", taps: 2 }];
  mergeTaps(rows, new Map([["2026-11-18|oura", { brandId: "oura", n: 3 }], ["2026-11-19|oura", { brandId: "oura", n: 1 }], ["2026-11-19|mira", { brandId: "mira", n: 4 }]]), "2025-10-15");
  assert.deepEqual(rows, [{ day: "2026-11-18", productId: "oura", brandId: "oura", taps: 5 }, { day: "2026-11-19", productId: "oura", brandId: "oura", taps: 1 }, { day: "2026-11-19", productId: "mira", brandId: "mira", taps: 4 }]);
  const t = tapTotals(rows, "2026-11-19", { brandName: (id) => ({ oura: "Oura", mira: "Mira" })[id], productName: (id) => ({ oura: "Oura Ring" })[id] });
  assert.equal(t.total, 5);
  assert.deepEqual(t.brands, [{ brandId: "mira", name: "Mira", taps: 4 }, { brandId: "oura", name: "Oura", taps: 1 }]);
  assert.deepEqual(t.products.map((p) => [p.productId, p.name, p.brand, p.taps]), [["mira", "mira", "Mira", 4], ["oura", "Oura Ring", "Oura", 1]]);
  assert.deepEqual(t.byDay, [{ day: "2026-11-19", taps: 5 }]);
  assert.equal(tapSince(7, Date.UTC(2026, 10, 19, 23)), "2026-11-13", "a 7-day window includes today");
  assert.equal(TAP_KEEP_DAYS, 400);
});

/* ---------- the routes, in process ---------- */
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "shop-taps-test-"));
process.on("exit", () => fs.rmSync(dir, { recursive: true, force: true }));
let now = Date.UTC(2026, 10, 19, 15, 30);
const inbox = [];
const mailer = { ready: true, async send(to, subject, text) { inbox.push({ to, subject, text }); } };
const store = new JsonStore(dir);
const ctx = { config: { authSecret: SECRET, production: true, baseUrl: "https://api.solia.example", shop: { startPerMinute: 1000, verifyPerMinute: 1000, writePerMinute: 1000, readPerMinute: 1000, codesPerAddress: 1000, tapPerMinute: 1000 } }, store, onShutdown: [] };
const app = express(); app.use(express.json());
const router = express.Router(); mount(router, ctx, { clock: () => now, sweepMs: 0, mailer, owners: ["owner@solia.example"], tapFlushMs: 0 }); app.use(basePath, router);
const srv = await new Promise((r) => { const s = app.listen(0, "127.0.0.1", () => r(s)); });
const B = `http://127.0.0.1:${srv.address().port}${basePath}`;
const req = (method, p, body, token, headers = {}) => fetch(`${B}${p}`, { method, headers: { ...(body !== undefined ? { "content-type": "application/json" } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
const codeFor = (email) => /(\d{6})/.exec(inbox.filter((m) => m.to === email && /code/.test(m.subject)).at(-1)?.subject || "")?.[1];
async function signIn(email) {
  await req("POST", "/auth/start", { email });
  const r = await req("POST", "/auth/verify", { email, code: codeFor(email) });
  return (await r.json()).token;
}
const disk = () => { try { return JSON.parse(fs.readFileSync(path.join(dir, "shop_taps.json"), "utf8")); } catch { return []; } };
const logs = [];
const orig = { log: console.log, warn: console.warn };
let owner, partner;

test("tap: a published product's total goes up by one; the answer is an empty 204", async () => {
  await ctx.shopReady;
  console.log = (...a) => logs.push(a.join(" ")); console.warn = (...a) => logs.push(a.join(" "));
  const r = await req("POST", "/tap", { productId: "oura" }, null, { cookie: "sid=abc", "x-forwarded-for": "203.0.113.9", "user-agent": "SoliaTest/1.0" });
  assert.equal(r.status, 204);
  assert.equal(await r.text(), "");
  assert.equal(r.headers.get("set-cookie"), null);
  assert.equal(r.headers.get("cache-control"), "no-store");
  await req("POST", "/tap", { productId: "oura" });
  await req("POST", "/tap", { productId: "mira" });
  assert.deepEqual(disk(), [{ day: "2026-11-19", productId: "oura", brandId: "oura", taps: 2 }, { day: "2026-11-19", productId: "mira", brandId: "mira", taps: 1 }]);
});

test("tap: the store holds totals only — no address, agent, cookie, account, time of day or per-request row", async () => {
  const raw = fs.readFileSync(path.join(dir, "shop_taps.json"), "utf8");
  assert.doesNotMatch(raw, /203\.0\.113|SoliaTest|sid=|account|T15:30|"at"|"ip"|"id"/);
  for (const row of disk()) assert.deepEqual(Object.keys(row).sort(), ["brandId", "day", "productId", "taps"]);
  // no other collection learned about the taps either (the audit log included)
  for (const f of fs.readdirSync(dir).filter((x) => x !== "shop_taps.json" && x.endsWith(".json"))) assert.doesNotMatch(fs.readFileSync(path.join(dir, f), "utf8"), /"tap"|203\.0\.113/, f);
});

test("tap: an unknown, unpublished or malformed id is refused, and extra fields are refused", async () => {
  assert.equal((await req("POST", "/tap", { productId: "no-such-product" })).status, 404);
  assert.equal((await req("POST", "/tap", { productId: "oura", stage: "peri" })).status, 400, "nothing else may be in the body");
  assert.equal((await req("POST", "/tap", { productId: "<script>" })).status, 400);
  assert.equal((await req("POST", "/tap", {})).status, 400);
  assert.equal((await req("POST", "/tap", ["oura"])).status, 400);
  owner = await signIn("owner@solia.example");
  assert.equal((await req("POST", "/products/oura/unpublish", {}, owner)).status, 200);
  assert.equal((await req("POST", "/tap", { productId: "oura" })).status, 404, "unpublished: no longer counted");
  assert.equal((await req("POST", "/products/oura/publish", {}, owner)).status, 200);
  assert.equal((await req("POST", "/tap", { productId: "oura" })).status, 204);
  assert.equal(disk().reduce((n, r) => n + r.taps, 0), 4, "refused taps counted nothing");
});

test("tap: a signed-in portal token changes nothing — the tap is still only a total", async () => {
  assert.equal((await req("POST", "/tap", { productId: "mira" }, owner)).status, 204);
  assert.deepEqual(Object.keys(disk().find((r) => r.productId === "mira")).sort(), ["brandId", "day", "productId", "taps"]);
});

test("totals: an owner sees every brand; 7, 30 and 90 day windows; rows older than 400 days are dropped", async () => {
  now += DAY; // 2026-11-20
  owner = await signIn("owner@solia.example"); // a portal session lasts 8 hours
  await req("POST", "/tap", { productId: "mira" });
  await store.apply("shop_taps", (rows) => { rows.push({ day: "2026-10-01", productId: "oura", brandId: "oura", taps: 10 }, { day: "2025-09-01", productId: "oura", brandId: "oura", taps: 99 }); });
  const d7 = await (await req("GET", "/taps?days=7", undefined, owner)).json();
  assert.equal(d7.total, 6); assert.equal(d7.from, "2026-11-14"); assert.equal(d7.to, "2026-11-20");
  assert.deepEqual(d7.brands, [{ brandId: "mira", name: "Mira", taps: 3 }, { brandId: "oura", name: "Oura", taps: 3 }]);
  assert.deepEqual(d7.products.map((p) => [p.productId, p.name, p.brand, p.taps]), [["mira", "Fertility hormone monitor", "Mira", 3], ["oura", "Oura Ring", "Oura", 3]]);
  assert.deepEqual(d7.byDay, [{ day: "2026-11-19", taps: 5 }, { day: "2026-11-20", taps: 1 }]);
  assert.equal(d7.rows, undefined, "the JSON answer carries totals, not rows");
  assert.equal((await (await req("GET", "/taps?days=90", undefined, owner)).json()).total, 16);
  assert.equal((await (await req("GET", "/taps?days=30", undefined, owner)).json()).total, 6);
  assert.equal((await (await req("GET", "/taps?days=9999", undefined, owner)).json()).days, 30, "an unknown window falls back to 30 days");
  await req("POST", "/tap", { productId: "mira" }); // the next write prunes
  assert.equal(disk().some((r) => r.day === "2025-09-01"), false, "older than 400 days: gone");
  assert.equal(disk().some((r) => r.day === "2026-10-01"), true);
});

test("totals: a partner sees only its own brands' totals; not signed in is 401", async () => {
  assert.equal((await req("POST", "/invites", { email: "pat@oura.example", brandIds: ["oura"] }, owner)).status, 201);
  partner = await signIn("pat@oura.example");
  const p = await (await req("GET", "/taps?days=90", undefined, partner)).json();
  assert.deepEqual(p.brands, [{ brandId: "oura", name: "Oura", taps: 13 }]);
  assert.deepEqual(p.products.map((x) => x.productId), ["oura"]);
  assert.equal(p.total, 13);
  assert.doesNotMatch(JSON.stringify(p), /mira/i);
  const csv = await (await req("GET", "/taps.csv?days=90", undefined, partner)).text();
  assert.match(csv, /^day,brand,product,productId,taps\r\n2026-10-01,Oura,Oura Ring,oura,10\r\n2026-11-19,Oura,Oura Ring,oura,3\r\n$/);
  const all = await (await req("GET", "/taps.csv?days=90", undefined, owner)).text();
  assert.match(all, /2026-11-20,Mira,Fertility hormone monitor,mira,2/);
  assert.equal((await req("GET", "/taps")).status, 401);
  assert.equal((await req("GET", "/taps.csv")).status, 401);
});

test("log: a tap writes nothing to the log", () => {
  console.log = orig.log; console.warn = orig.warn;
  assert.equal(logs.filter((l) => /tap|203\.0\.113/i.test(l)).length, 0, logs.join("\n"));
});

test("rate limit: taps are limited per client, in memory", async () => {
  const d2 = fs.mkdtempSync(path.join(os.tmpdir(), "shop-taps-test2-"));
  const c2 = { config: { authSecret: SECRET, production: true, shop: { tapPerMinute: 3 } }, store: new JsonStore(d2), onShutdown: [] };
  const a2 = express(); a2.use(express.json());
  const r2 = express.Router(); mount(r2, c2, { sweepMs: 0, mailer, owners: ["owner@solia.example"] }); a2.use(basePath, r2);
  const s = await new Promise((r) => { const x = a2.listen(0, "127.0.0.1", () => r(x)); });
  try {
    const st = [];
    for (let i = 0; i < 5; i++) st.push((await fetch(`http://127.0.0.1:${s.address().port}${basePath}/tap`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ productId: "oura" }) })).status);
    assert.deepEqual(st, [204, 204, 204, 429, 429]);
    assert.equal(fs.existsSync(path.join(d2, "shop_taps.json")), false, "buffered as totals in memory until the next write");
    for (const fn of c2.onShutdown) await fn(); // shutdown writes what is waiting
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(d2, "shop_taps.json"), "utf8")).map((r) => r.taps), [3]);
  } finally { s.close(); fs.rmSync(d2, { recursive: true, force: true }); }
});

test("close", async () => { srv.close(); for (const fn of ctx.onShutdown) await fn(); });
