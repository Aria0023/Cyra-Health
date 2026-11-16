// Unit tests for the subscriptions module (docs/plans/portal-subscriptions.md Task 1): the RevenueCat client (configured,
// not configured, API error; every request mocked), owner-only routes (a partner gets 403 on everything except its own
// codes), promotion schedules and the public list, Pro grants (queued until first sign-in, revoke), partner codes, CSV
// parsing caps, and that neither the secret key nor an email address reaches the log.
// In process: accounts + shop + subscriptions on one Express app, an injected clock, a capturing mailer and a fake fetch.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import express from "express";
import { JsonStore } from "../src/core/store.js";
import * as accounts from "../src/modules/accounts/index.js";
import * as shop from "../src/modules/shop/index.js";
import * as subs from "../src/modules/subscriptions/index.js";
import { revenueCat, RC_PATHS, RcError } from "../src/modules/subscriptions/revenuecat.js";

const { promoStatus, activePromotions, cleanPromotion, parseEmails, parseCodes, CAPS } = subs;
const SECRET = "unit-test-secret-1234567890";
const RC_KEY = "sk_unit_test_secret_value_0123456789";
const HOUR = 3_600_000;

/* ---------- a fake RevenueCat ---------- */
const rcCalls = [];
let rcMode = "ok"; // "ok" | "error" | "down"
const fakeFetch = async (url, init) => {
  const u = new URL(url);
  rcCalls.push({ method: init.method, path: u.pathname, auth: init.headers.authorization, body: init.body ? JSON.parse(init.body) : null });
  if (rcMode === "down") throw new TypeError("fetch failed");
  const json = (status, obj) => new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });
  if (rcMode === "error") return json(500, { message: "boom" });
  if (u.pathname === "/v2/projects/proj_test1/metrics/overview") return json(200, { object: "overview_metrics", metrics: [
    { id: "active_subscriptions", name: "Active Subscriptions", value: 42, unit: "#", period: "P0D", last_updated_at_iso8601: "2026-11-15T09:00:00Z" },
    { id: "active_trials", name: "Active Trials", value: 7, unit: "#", period: "P0D" },
    { id: "mrr", name: "MRR", value: 315.5, unit: "$", period: "P28D" },
    { id: "revenue", name: "Revenue", value: 401.2, unit: "$", period: "P28D" },
    { id: "new_customers", name: "New Customers", value: 88, unit: "#", period: "P28D" },
    { id: "something_new", name: "Ignored", value: 1 },
  ] });
  if (u.pathname === "/v2/projects/proj_test1/offerings") return json(200, { items: [{ lookup_key: "spring_clinic", display_name: "Spring clinic offer" }, { lookup_key: "bad id with spaces" }] });
  const g = /^\/v1\/subscribers\/([^/]+)\/entitlements\/pro\/(promotional|revoke_promotionals)$/.exec(u.pathname);
  if (g && init.method === "POST") return json(201, g[2] === "promotional" ? { subscriber: { entitlements: { pro: { expires_date: "2026-12-15T10:00:00Z" } } } } : { subscriber: {} });
  return json(404, { message: "not found" });
};
const RC_ENV_OK = { REVENUECAT_SECRET_KEY: RC_KEY, REVENUECAT_PROJECT_ID: "proj_test1", REVENUECAT_API_BASE: "https://rc.mock" };

/* ---------- pure parts ---------- */
const promo = (over = {}) => ({ id: "p1", name: "Clinic: Dr Smith's patients", offeringId: "spring_clinic", platforms: ["ios", "android"], audience: { who: "everyone", stages: [] }, startsAt: "2026-11-10T00:00:00.000Z", endsAt: "2026-11-20T00:00:00.000Z", banner: { title: "Spring offer", body: "A longer free trial." }, enabled: true, stoppedAt: null, ...over });
const T = Date.parse("2026-11-15T12:00:00Z");

test("promoStatus: draft until started; scheduled, live and ended by the clock; stopped is ended", () => {
  assert.equal(promoStatus(promo({ enabled: false }), T), "draft");
  assert.equal(promoStatus(promo({ startsAt: "2026-11-16T00:00:00Z" }), T), "scheduled");
  assert.equal(promoStatus(promo(), T), "live");
  assert.equal(promoStatus(promo({ endsAt: "2026-11-15T11:59:59Z" }), T), "ended");
  assert.equal(promoStatus(promo({ enabled: false, stoppedAt: "2026-11-14T00:00:00Z" }), T), "ended");
});

test("activePromotions: live only, newest start first, no name and no internal fields", () => {
  const rows = [promo(), promo({ id: "p2", startsAt: "2026-11-12T00:00:00Z", audience: { who: "stages", stages: ["peri", "meno"] } }), promo({ id: "p3", enabled: false }), promo({ id: "p4", startsAt: "2026-11-30T00:00:00Z", endsAt: "2026-12-30T00:00:00Z" })];
  const out = activePromotions(rows, T);
  assert.deepEqual(out.map((p) => p.id), ["p2", "p1"]);
  assert.deepEqual(Object.keys(out[0]).sort(), ["audience", "banner", "endsAt", "id", "offeringId", "platforms", "startsAt"]);
  assert.ok(!JSON.stringify(out).includes("Dr Smith"), "a promotion's internal name never goes public");
  assert.deepEqual(out[0].audience, { who: "stages", stages: ["peri", "meno"] });
});

test("cleanPromotion: required fields, dates, audience, and never a price or percentage in the banner", () => {
  const ok = { name: "Spring", offeringId: "spring_clinic", platforms: ["ios", "web"], audience: { who: "new" }, startsAt: "2026-11-15T00:00:00Z", endsAt: "2026-11-30T00:00:00Z", banner: { title: "A spring offer", body: "Try Pro for longer." } };
  assert.deepEqual(cleanPromotion(ok).value.audience, { who: "new", stages: [] });
  const bad = (over, re) => assert.match(cleanPromotion({ ...ok, ...over }).error || "", re);
  bad({ offeringId: "has spaces" }, /offeringId/);
  bad({ platforms: [] }, /platforms/);
  bad({ platforms: ["windows"] }, /platforms/);
  bad({ audience: { who: "stages", stages: [] } }, /stages/);
  bad({ audience: { who: "stages", stages: ["ttc", "nope"] } }, /stages/);
  bad({ endsAt: "2026-11-14T00:00:00Z" }, /after/);
  bad({ endsAt: "2028-01-01T00:00:00Z" }, /at most a year/);
  bad({ banner: { title: "x".repeat(41), body: "y" } }, /title/);
  bad({ banner: { title: "Half price", body: "Only $4.99 a month" } }, /price/);
  bad({ banner: { title: "50% off", body: "Pro for less" } }, /price/);
  bad({ secret: 1 }, /unknown field/);
});

test("parseEmails / parseCodes: CSV-friendly, unique, invalid listed, header and junk skipped", () => {
  const e = parseEmails("email,name\nMaya@Clinic.example, Maya\n<b@x.example>; maya@clinic.example\nnot@valid\n");
  assert.deepEqual(e.emails, ["maya@clinic.example", "b@x.example"]);
  assert.deepEqual(e.invalid, ["not@valid"]);
  const c = parseCodes("code\nABCD-1234,ios\nABCD-1234\n  wxyz9876  \nbad code!\n-lead\n\n");
  assert.deepEqual(c.codes, ["ABCD-1234", "wxyz9876"]);
  assert.equal(c.invalid, 2);
});

/* ---------- the RevenueCat client ---------- */
test("revenueCat: not configured fails closed before any request and names the variables", async () => {
  const before = rcCalls.length;
  const rc = revenueCat({ env: {}, fetchImpl: fakeFetch });
  assert.equal(rc.configured, false);
  assert.deepEqual(rc.missing, ["REVENUECAT_SECRET_KEY", "REVENUECAT_PROJECT_ID"]);
  await assert.rejects(rc.metrics(), (e) => e instanceof RcError && e.cat === "not configured");
  await assert.rejects(rc.grant("acct_0000000001", "monthly"), RcError);
  assert.equal(rcCalls.length, before, "no request");
});

test("revenueCat: configured calls the documented paths with the secret key; errors are categories, never the key", async () => {
  const rc = revenueCat({ env: RC_ENV_OK, fetchImpl: fakeFetch });
  assert.equal(rc.configured, true);
  const m = await rc.metrics();
  assert.deepEqual(m.metrics.map((x) => x.id), ["active_subscriptions", "active_trials", "mrr", "revenue", "new_customers"]);
  assert.equal(m.updatedAt, "2026-11-15T09:00:00.000Z");
  assert.deepEqual(await rc.offerings(), [{ id: "spring_clinic", name: "Spring clinic offer" }]);
  assert.deepEqual(await rc.grant("acct_0000000001", "monthly"), { expiresAt: "2026-12-15T10:00:00.000Z" });
  const last = rcCalls.at(-1);
  assert.equal(last.path, RC_PATHS.grantPromotional("acct_0000000001", "pro"));
  assert.deepEqual(last.body, { duration: "monthly" });
  assert.equal(last.auth, `Bearer ${RC_KEY}`);
  await assert.rejects(rc.grant("../../etc", "monthly"), /not an account id/);
  await assert.rejects(rc.grant("acct_0000000001", "forever"), /not a duration/);
  rcMode = "error";
  await assert.rejects(rc.metrics(), (e) => e.cat === "RevenueCat answered 500" && !e.message.includes(RC_KEY));
  rcMode = "down";
  await assert.rejects(rc.revoke("acct_0000000001"), (e) => e.cat === "RevenueCat could not be reached");
  rcMode = "ok";
  const v1 = revenueCat({ env: { ...RC_ENV_OK, REVENUECAT_V1_SECRET_KEY: "sk_v1_other_key_0123456789" }, fetchImpl: fakeFetch });
  await v1.grant("acct_0000000001", "weekly");
  assert.equal(rcCalls.at(-1).auth, "Bearer sk_v1_other_key_0123456789", "a separate v1 key is used for the v1 calls when set");
});

/* ---------- the routes, in process ---------- */
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "subs-test-"));
process.on("exit", () => fs.rmSync(dir, { recursive: true, force: true }));
let now = T;
const inbox = [];
const mailer = { ready: true, async send(to, subject, text) { inbox.push({ to, subject, text }); } };
const appCodes = [];
const sender = { ready: true, dev: false, async send(to, code) { appCodes.push({ to, code }); } };
const store = new JsonStore(dir);
const fast = 1000;
const ctx = { config: { authSecret: SECRET, production: true, baseUrl: "https://api.solia.example", accounts: { startPerMinute: fast, verifyPerMinute: fast, perMinute: fast, codesPerAddress: fast },
  shop: { startPerMinute: fast, verifyPerMinute: fast, writePerMinute: fast, readPerMinute: fast, uploadPerMinute: fast, catalogPerMinute: fast, codesPerAddress: fast },
  subscriptions: { publicPerMinute: fast, readPerMinute: fast, writePerMinute: fast, grantPerMinute: fast } }, store, onShutdown: [] };
// the RevenueCat client the module sees can be swapped between tests (configured / not configured)
let rcNow = revenueCat({ env: RC_ENV_OK, fetchImpl: fakeFetch });
const rcProxy = { get configured() { return rcNow.configured; }, get missing() { return rcNow.missing; }, get entitlement() { return rcNow.entitlement; }, metrics: () => rcNow.metrics(), offerings: () => rcNow.offerings(), grant: (a, d) => rcNow.grant(a, d), revoke: (a) => rcNow.revoke(a) };
const app = express(); app.use(express.json());
for (const [mod, opts] of [[accounts, { clock: () => now, sweepMs: 0, sender }], [shop, { clock: () => now, sweepMs: 0, mailer, owners: ["owner@solia.example"] }], [subs, { clock: () => now, rc: rcProxy }]]) {
  const r = express.Router(); mod.mount(r, ctx, opts); app.use(mod.basePath, r);
}
const srv = await new Promise((r) => { const s = app.listen(0, "127.0.0.1", () => r(s)); });
const B = `http://127.0.0.1:${srv.address().port}`;
const req = (method, p, body, token, headers = {}) => fetch(`${B}${p}`, { method, headers: { ...(body !== undefined ? { "content-type": "application/json" } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
const portalCode = (email) => /(\d{6})/.exec(inbox.filter((m) => m.to === email && /code/.test(m.subject)).at(-1)?.subject || "")?.[1];
async function portalSignIn(email) {
  assert.equal((await req("POST", "/api/shop/auth/start", { email })).status, 200);
  const r = await req("POST", "/api/shop/auth/verify", { email, code: portalCode(email) });
  assert.equal(r.status, 200, `portal sign-in ${email}`);
  return (await r.json()).token;
}
async function appSignIn(email) {
  await req("POST", "/api/accounts/email/start", { email });
  const r = await req("POST", "/api/accounts/email/verify", { email, code: appCodes.filter((c) => c.to === email).at(-1).code });
  assert.equal(r.status, 200);
  return (await r.json()).account;
}
const logs = [];
const origWarn = console.warn, origLog = console.log;
console.warn = (...a) => { logs.push(a.join(" ")); }; console.log = (...a) => { logs.push(a.join(" ")); };
test.after(() => { console.warn = origWarn; console.log = origLog; srv.close(); for (const fn of ctx.onShutdown) fn(); });
let owner, partner;
const settle = () => new Promise((r) => setTimeout(r, 50));

test("roles: owner signs in; a partner (invited to one brand) gets 403 on everything but its own codes", async () => {
  await ctx.shopReady;
  owner = await portalSignIn("owner@solia.example");
  assert.equal((await req("POST", "/api/shop/invites", { email: "pat@oura.example", brandIds: ["oura"] }, owner)).status, 201);
  partner = await portalSignIn("pat@oura.example");
  const ownerOnly = [["GET", "/api/subscriptions/config"], ["GET", "/api/subscriptions/metrics"], ["GET", "/api/subscriptions/offerings"], ["GET", "/api/subscriptions/promotions"], ["POST", "/api/subscriptions/promotions", {}],
    ["PATCH", "/api/subscriptions/promotions/abcdefgh", {}], ["POST", "/api/subscriptions/promotions/abcdefgh/start", {}], ["DELETE", "/api/subscriptions/promotions/abcdefgh"],
    ["GET", "/api/subscriptions/grants"], ["POST", "/api/subscriptions/grants", { emails: "a@b.example", duration: "monthly" }], ["POST", "/api/subscriptions/grants/abcdefgh/revoke", {}],
    ["POST", "/api/subscriptions/codes/batches", {}], ["GET", "/api/subscriptions/codes/batches/abcdefgh"], ["PATCH", "/api/subscriptions/codes/batches/abcdefgh", {}], ["DELETE", "/api/subscriptions/codes/batches/abcdefgh"], ["POST", "/api/subscriptions/codes/mark", {}]];
  for (const [m, p, body] of ownerOnly) {
    assert.equal((await req(m, p, body, partner)).status, 403, `partner ${m} ${p}`);
    assert.equal((await req(m, p, body)).status, 401, `nobody ${m} ${p}`);
  }
  assert.equal((await req("GET", "/api/subscriptions/codes", undefined, partner)).status, 200);
  assert.equal((await req("GET", "/api/subscriptions/codes.csv", undefined, partner)).status, 200);
  const appTok = accounts.signToken({ a: "owner@solia.example", s: "x", x: now + 1e9, aud: "portal" }, accounts.accountKeys(SECRET).token);
  assert.equal((await req("GET", "/api/subscriptions/metrics", undefined, appTok)).status, 401, "an app token never opens the portal");
});

test("metrics: not configured names the variables; configured is cached for 5 minutes; an API error is said plainly", async () => {
  rcNow = revenueCat({ env: {}, fetchImpl: fakeFetch });
  let j = await (await req("GET", "/api/subscriptions/metrics", undefined, owner)).json();
  assert.deepEqual([j.configured, j.missing], [false, ["REVENUECAT_SECRET_KEY", "REVENUECAT_PROJECT_ID"]]);
  const cfg = await (await req("GET", "/api/subscriptions/config", undefined, owner)).json();
  assert.equal(cfg.configured, false); assert.ok(!JSON.stringify(cfg).includes("sk_"));
  rcNow = revenueCat({ env: RC_ENV_OK, fetchImpl: fakeFetch });
  const n = rcCalls.length;
  j = await (await req("GET", "/api/subscriptions/metrics", undefined, owner)).json();
  assert.equal(j.configured, true); assert.equal(j.metrics.find((m) => m.id === "active_subscriptions").value, 42); assert.equal(j.error, null);
  assert.ok(j.updatedAt && j.fetchedAt);
  await req("GET", "/api/subscriptions/metrics", undefined, owner);
  assert.equal(rcCalls.length, n + 1, "the second read comes from the cache");
  now += 5 * 60_000 + 1; rcMode = "error";
  j = await (await req("GET", "/api/subscriptions/metrics", undefined, owner)).json();
  assert.equal(j.error, "RevenueCat answered 500"); assert.deepEqual(j.metrics, []);
  rcMode = "ok"; now += 61_000;
  j = await (await req("GET", "/api/subscriptions/metrics", undefined, owner)).json();
  assert.equal(j.error, null);
  const o = await (await req("GET", "/api/subscriptions/offerings", undefined, owner)).json();
  assert.deepEqual(o.offerings.map((x) => x.id), ["spring_clinic"]);
});

test("promotions: created as a draft; started, scheduled, live and stopped; the public list carries only live rules", async () => {
  now = T;
  const body = { name: "Clinic patients (Dr Smith)", offeringId: "spring_clinic", platforms: ["ios", "android", "web"], audience: { who: "stages", stages: ["peri"] }, startsAt: "2026-11-16T00:00:00Z", endsAt: "2026-11-30T00:00:00Z", banner: { title: "A calmer start", body: "A longer free trial on the yearly plan." } };
  const c = await req("POST", "/api/subscriptions/promotions", body, owner);
  assert.equal(c.status, 201);
  const { promotion: p } = await c.json();
  assert.equal(p.status, "draft");
  assert.equal((await req("POST", "/api/subscriptions/promotions", { ...body, banner: { title: "Deal", body: "Now $1.99" } }, owner)).status, 400);
  const pub = async (q = "") => req("GET", `/api/promotions/active${q}`);
  assert.deepEqual((await (await pub()).json()).promotions, [], "a draft is never public");
  assert.equal((await (await req("POST", `/api/subscriptions/promotions/${p.id}/start`, {}, owner)).json()).promotion.status, "scheduled");
  assert.deepEqual((await (await pub()).json()).promotions, [], "scheduled: not yet");
  now = Date.parse("2026-11-16T00:00:01Z");
  owner = await portalSignIn("owner@solia.example"); // portal sessions last 8 hours
  const r = await pub();
  const list = (await r.json()).promotions;
  assert.deepEqual(list.map((x) => x.id), [p.id]);
  assert.ok(!JSON.stringify(list).includes("Smith"));
  assert.match(r.headers.get("cache-control"), /public, max-age=300/);
  const etag = r.headers.get("etag");
  assert.equal((await req("GET", "/api/promotions/active", undefined, null, { "if-none-match": etag })).status, 304);
  assert.equal((await pub("?stage=peri&id=123")).headers.get("etag"), etag, "query parameters change nothing");
  const e = await req("PATCH", `/api/subscriptions/promotions/${p.id}`, { banner: { title: "A calmer start", body: "Edited text." } }, owner);
  assert.equal(e.status, 200);
  assert.equal((await (await pub()).json()).promotions[0].banner.body, "Edited text.", "an edit to a live promotion shows at once");
  assert.equal((await req("DELETE", `/api/subscriptions/promotions/${p.id}`, undefined, owner)).status, 409, "stop before delete");
  assert.equal((await (await req("POST", `/api/subscriptions/promotions/${p.id}/stop`, {}, owner)).json()).promotion.status, "ended");
  assert.deepEqual((await (await pub()).json()).promotions, []);
  now = Date.parse("2026-12-01T00:00:00Z");
  owner = await portalSignIn("owner@solia.example");
  assert.equal((await req("POST", `/api/subscriptions/promotions/${p.id}/start`, {}, owner)).status, 409, "past its end");
  assert.equal((await req("DELETE", `/api/subscriptions/promotions/${p.id}`, undefined, owner)).status, 204);
});

test("grants: by email to existing accounts; no account listed back or queued; queued applied at first sign-in; revoke; caps", async () => {
  now = T;
  owner = await portalSignIn("owner@solia.example");
  const acct = await appSignIn("maya@clinic.example");
  rcNow = revenueCat({ env: {}, fetchImpl: fakeFetch });
  const nc = await req("POST", "/api/subscriptions/grants", { emails: "maya@clinic.example", duration: "monthly" }, owner);
  assert.equal(nc.status, 503); assert.match((await nc.json()).error, /REVENUECAT_SECRET_KEY/);
  rcNow = revenueCat({ env: RC_ENV_OK, fetchImpl: fakeFetch });
  assert.equal((await req("POST", "/api/subscriptions/grants", { emails: "x@y.example", duration: "forever" }, owner)).status, 400);
  const many = Array.from({ length: CAPS.grantsAtOnce + 1 }, (_, i) => `p${i}@clinic.example`).join("\n");
  assert.match((await (await req("POST", "/api/subscriptions/grants", { emails: many, duration: "monthly" }, owner)).json()).error, /at most 500/);
  const r = await req("POST", "/api/subscriptions/grants", { emails: "Maya@Clinic.example\nnew@clinic.example\nbad@", duration: "three_month", note: "Clinic pilot" }, owner);
  assert.equal(r.status, 201);
  const j = await r.json();
  assert.deepEqual(j.results.map((x) => [x.email, x.status]), [["maya@clinic.example", "granted"], ["new@clinic.example", "no-account"]]);
  assert.equal(j.results[0].expiresAt, "2026-12-15T10:00:00.000Z");
  assert.deepEqual(j.invalid, ["bad@"]);
  const call = rcCalls.at(-1);
  assert.equal(call.path, `/v1/subscribers/${acct.id}/entitlements/pro/promotional`, "RevenueCat gets the opaque account id, never the email");
  assert.deepEqual(call.body, { duration: "three_month" });
  // queue the one without an account; it is applied when she first signs in
  const q = await (await req("POST", "/api/subscriptions/grants", { emails: "new@clinic.example", duration: "yearly", queue: true }, owner)).json();
  assert.equal(q.results[0].status, "queued");
  const newbie = await appSignIn("new@clinic.example");
  await settle();
  const list = (await (await req("GET", "/api/subscriptions/grants", undefined, owner)).json()).grants;
  const applied = list.find((g) => g.id === q.results[0].id);
  assert.deepEqual([applied.status, applied.accountIds], ["granted", [newbie.id]]);
  assert.ok(rcCalls.some((c) => c.path === `/v1/subscribers/${newbie.id}/entitlements/pro/promotional` && c.body.duration === "yearly"));
  // revoke
  const g = list.find((x) => x.email === "maya@clinic.example");
  const rv = await req("POST", `/api/subscriptions/grants/${g.id}/revoke`, {}, owner);
  assert.equal(rv.status, 200);
  assert.equal(rcCalls.at(-1).path, `/v1/subscribers/${acct.id}/entitlements/pro/revoke_promotionals`);
  assert.equal((await req("POST", `/api/subscriptions/grants/${g.id}/revoke`, {}, owner)).status, 409);
  // a failed grant is recorded as failed, plainly
  rcMode = "error";
  const f = await (await req("POST", "/api/subscriptions/grants", { emails: "maya@clinic.example", duration: "weekly" }, owner)).json();
  assert.deepEqual([f.results[0].status, f.results[0].error], ["failed", "RevenueCat answered 500"]);
  rcMode = "ok";
  // a queued grant can be cancelled
  const q2 = await (await req("POST", "/api/subscriptions/grants", { emails: "later@clinic.example", duration: "weekly", queue: true }, owner)).json();
  assert.equal((await (await req("POST", `/api/subscriptions/grants/${q2.results[0].id}/revoke`, {}, owner)).json()).grant.status, "cancelled");
  const audit = (await (await req("GET", "/api/shop/audit", undefined, owner)).json()).audit.map((a) => a.action);
  for (const a of ["grant", "queue grant", "grant (queued, applied at sign-in)", "revoke grant", "cancel grant"]) assert.ok(audit.includes(a), `audit: ${a}`);
});

test("codes: owner uploads and assigns; a partner sees and downloads only its own available codes; marks and counts", async () => {
  partner = await portalSignIn("pat@oura.example"); // the clock moved past its earlier session
  const up = await req("POST", "/api/subscriptions/codes/batches", { label: "Oura spring", platform: "ios", offerRef: "oura_spring_3m", expiresAt: "2027-03-01", brandId: "oura", codes: "code\nOURA-0001\nOURA-0002\nOURA-0003\nOURA-0003\nno good!" }, owner);
  assert.equal(up.status, 201);
  const uj = await up.json();
  assert.deepEqual([uj.added, uj.duplicates, uj.invalid], [3, 0, 1], "a code twice in one paste counts once");
  const other = await (await req("POST", "/api/subscriptions/codes/batches", { label: "Other brand", platform: "android", offerRef: "other_offer", brandId: null, codes: "OTHR-0001\nOTHR-0002" }, owner)).json();
  assert.equal((await req("POST", "/api/subscriptions/codes/batches", { label: "Again", platform: "ios", offerRef: "x", codes: "OURA-0001" }, owner)).status, 409, "already uploaded");
  const big = Array.from({ length: CAPS.batchCodes + 1 }, (_, i) => `BIG-${String(i).padStart(5, "0")}`).join("\n");
  assert.match((await (await req("POST", "/api/subscriptions/codes/batches", { label: "Big", platform: "ios", offerRef: "x", codes: big }, owner)).json()).error, /at most 2000/);
  assert.equal((await req("POST", "/api/subscriptions/codes/batches", { label: "Bad", platform: "web", offerRef: "x", codes: "ABCD-1" }, owner)).status, 400);
  // mark one given and one redeemed
  assert.deepEqual(await (await req("POST", "/api/subscriptions/codes/mark", { status: "redeemed", codes: "OURA-0002\nNOPE-0000" }, owner)).json(), { marked: 1, notFound: 1 });
  await req("POST", "/api/subscriptions/codes/mark", { status: "given", codes: "OURA-0003" }, owner);
  const pv = await (await req("GET", "/api/subscriptions/codes", undefined, partner)).json();
  assert.equal(pv.role, "partner");
  assert.deepEqual(pv.available.map((c) => c.code), ["OURA-0001"]);
  assert.deepEqual(pv.summary, [{ brandId: "oura", brand: pv.summary[0].brand, counts: { available: 1, given: 1, redeemed: 1, expired: 0 } }]);
  assert.ok(!JSON.stringify(pv).includes("OTHR"), "never another brand's codes");
  assert.ok(!JSON.stringify(pv).includes("owner@solia.example"), "nor who uploaded them");
  const csv = await (await req("GET", "/api/subscriptions/codes.csv", undefined, partner)).text();
  assert.match(csv, /^code,platform,store offer,expires,brand,status\r\nOURA-0001,ios,oura_spring_3m,2027-03-01,/);
  assert.ok(!csv.includes("OURA-0002") && !csv.includes("OTHR"));
  // the owner sees everything; assigning the other batch to oura shows it to the partner
  const ov = await (await req("GET", "/api/subscriptions/codes", undefined, owner)).json();
  assert.equal(ov.batches.length, 2);
  assert.equal((await req("PATCH", `/api/subscriptions/codes/batches/${other.batch.id}`, { brandId: "oura" }, owner)).status, 200);
  assert.equal((await (await req("GET", "/api/subscriptions/codes", undefined, partner)).json()).available.length, 3);
  // expired codes are not handed out
  now = Date.parse("2027-03-02T00:00:00Z");
  partner = await portalSignIn("pat@oura.example");
  const after = await (await req("GET", "/api/subscriptions/codes", undefined, partner)).json();
  assert.deepEqual(after.available.map((c) => c.code).sort(), ["OTHR-0001", "OTHR-0002"]);
  assert.equal(after.summary[0].counts.expired, 1);
  now = T;
});

test("logs: never the secret key or an email address", () => {
  const all = logs.join("\n");
  assert.ok(!all.includes(RC_KEY), "no secret key");
  assert.ok(!/@clinic\.example|@oura\.example|@solia\.example/.test(all), "no email address");
});
