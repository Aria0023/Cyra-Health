// Unit tests for the affiliate results (docs/plans/tracking-reports.md Task 3): the Impact client (configured, not
// configured, API error; every request mocked), the Amazon Associates CSV parser (caps and validation), the join of
// Solia taps with network numbers per brand, the 15-minute cache, owner-only routes, and that neither the Impact token
// nor an email address reaches the log. In process: accounts + shop + insights on one Express app with a fake fetch.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import express from "express";
import { JsonStore } from "../src/core/store.js";
import * as accounts from "../src/modules/accounts/index.js";
import * as shop from "../src/modules/shop/index.js";
import * as insights from "../src/modules/insights/index.js";
import { impactClient, performanceRow, IMPACT_PATHS, ImpactError, IMPACT_DEFAULT_REPORT } from "../src/modules/insights/impact.js";
import { parseAmazonCsv, csvRows, reportDay, amount, amazonTotals, AMAZON_CAPS } from "../src/modules/insights/amazon.js";
import { joinAffiliates, IMPACT_TTL_MS } from "../src/modules/insights/affiliates.js";

const SECRET = "unit-test-secret-1234567890";
const SID = "IRunitTestAccountSid01", TOKEN = "unit_test_impact_token_0123456789";
const T0 = Date.UTC(2026, 10, 19, 12);

/* ---------- a fake Impact ---------- */
const calls = [];
let mode = "ok"; // "ok" | "error" | "down" | "denied"
const fakeFetch = async (url, init) => {
  const u = new URL(url);
  calls.push({ method: init.method, path: u.pathname, query: Object.fromEntries(u.searchParams), auth: init.headers.authorization });
  if (mode === "down") throw new TypeError("fetch failed");
  const json = (status, obj) => new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });
  if (mode === "error") return json(500, { Message: "boom" });
  if (mode === "denied") return json(401, { Message: "bad credentials" });
  if (u.pathname === `/Mediapartners/${SID}/Campaigns`) return json(200, { Campaigns: [{ CampaignId: "1001", CampaignName: "Oura" }, { CampaignId: 1002, CampaignName: "Mira Fertility" }, { CampaignId: "bad id!", CampaignName: "Ignored" }] });
  if (u.pathname === `/Mediapartners/${SID}/Reports/${IMPACT_DEFAULT_REPORT}`) return json(200, { Records: [
    { CampaignId: "1001", Campaign: "Oura", Clicks: "120", Actions: "6", SaleAmount: "1,794.00", Earnings: "143.52" },
    { CampaignId: "1001", Campaign: "Oura", Clicks: 5, Actions: 1, SaleAmount: 299, Earnings: 23.92 },
    { campaign_id: "1002", campaign_name: "Mira Fertility", clicks: 40, actions: 2, sale_amount: 398, payout: 39.8 },
    { CampaignId: "1003", Campaign: "Everlywell", Clicks: 15, Actions: 0, SaleAmount: 0, Earnings: 0 },
    { nothing: true },
  ] });
  return json(404, { Message: "not found" });
};
const ENV_OK = { IMPACT_ACCOUNT_SID: SID, IMPACT_AUTH_TOKEN: TOKEN, IMPACT_API_BASE: "https://impact.mock" };

/* ---------- pure parts ---------- */
test("impact: not configured fails closed and names what is missing; no request is made", async () => {
  const before = calls.length;
  const none = impactClient({ env: {}, fetchImpl: fakeFetch });
  assert.equal(none.configured, false);
  assert.deepEqual(none.missing, ["IMPACT_ACCOUNT_SID", "IMPACT_AUTH_TOKEN"]);
  assert.deepEqual(impactClient({ env: { IMPACT_ACCOUNT_SID: SID }, fetchImpl: fakeFetch }).missing, ["IMPACT_AUTH_TOKEN"]);
  await assert.rejects(none.performance("2026-11-01", "2026-11-07"), (e) => e instanceof ImpactError && e.cat === "not configured");
  await assert.rejects(none.campaigns(), ImpactError);
  assert.equal(impactClient({ env: { ...ENV_OK, IMPACT_ACCOUNT_SID: "../etc" }, fetchImpl: fakeFetch }).configured, false, "a SID that isn't an id never reaches a URL");
  assert.equal(calls.length, before);
});

test("impact: configured calls the documented paths with Basic auth; rows are summed per campaign; errors are categories, never the token", async () => {
  const im = impactClient({ env: ENV_OK, fetchImpl: fakeFetch });
  assert.equal(im.configured, true);
  assert.deepEqual(await im.campaigns(), [{ id: "1001", name: "Oura" }, { id: "1002", name: "Mira Fertility" }]);
  assert.equal(calls.at(-1).path, `/Mediapartners/${SID}/Campaigns`);
  const rows = await im.performance("2026-11-13", "2026-11-19");
  const last = calls.at(-1);
  assert.equal(`${last.path}?START_DATE=2026-11-13&END_DATE=2026-11-19&SUBAID=${SID}`, IMPACT_PATHS.performanceByCampaign(SID, IMPACT_DEFAULT_REPORT, "2026-11-13", "2026-11-19"));
  assert.deepEqual(last.query, { START_DATE: "2026-11-13", END_DATE: "2026-11-19", SUBAID: SID });
  assert.equal(last.auth, `Basic ${Buffer.from(`${SID}:${TOKEN}`).toString("base64")}`);
  assert.deepEqual(rows, [
    { campaignId: "1001", campaign: "Oura", clicks: 125, actions: 7, saleAmount: 2093, commission: 167.44 },
    { campaignId: "1002", campaign: "Mira Fertility", clicks: 40, actions: 2, saleAmount: 398, commission: 39.8 },
    { campaignId: "1003", campaign: "Everlywell", clicks: 15, actions: 0, saleAmount: 0, commission: 0 },
  ]);
  await assert.rejects(im.performance("2026-11-19", "2026-11-13"), /not a date range/);
  await assert.rejects(im.performance("yesterday", "today"), /not a date range/);
  mode = "error";
  await assert.rejects(im.performance("2026-11-13", "2026-11-19"), (e) => e.cat === "Impact answered 500" && !e.message.includes(TOKEN));
  mode = "denied";
  await assert.rejects(im.campaigns(), (e) => e.cat === "Impact refused the account SID or token (401)");
  mode = "down";
  await assert.rejects(im.campaigns(), (e) => e.cat === "Impact could not be reached");
  mode = "ok";
  const custom = impactClient({ env: { ...ENV_OK, IMPACT_REPORT_ID: "my_report" }, fetchImpl: fakeFetch });
  await assert.rejects(custom.performance("2026-11-13", "2026-11-19"), (e) => e.cat === "Impact answered 404 (check the report id)");
  assert.equal(calls.at(-1).path, `/Mediapartners/${SID}/Reports/my_report`);
  assert.equal(performanceRow({}), null);
  assert.equal(performanceRow({ Campaign: "A\u0000B", Clicks: "x" }).clicks, 0, "a field that isn't a number counts as 0");
});

test("amazon CSV: a title line, quoted commas, US dates and $ amounts; per-day totals; product names are not kept", () => {
  const csv = [
    "Fee-Earnings reports from 11-01-2026 to 11-15-2026",
    "Category,Name,ASIN,Seller,Tracking ID,Date Shipped,Price($),Items Shipped,Returns,Revenue($),Ad Fees($),Device Type Group,Direct",
    'Health,"LH strips, 50 ct",B00X,Amazon,solia-20,2026-11-01 00:00:00,19.99,2,0,39.98,1.60,MOBILE,DI',
    "Health,Thermometer,B00Y,Amazon,solia-20,2026-11-01 00:00:00,9.99,1,0,9.99,0.40,MOBILE,DI",
    'Health,Prenatal,B00Z,Amazon,solia-20,11/03/2026,25.00,1,0,"$1,005.00",(0.20),DESKTOP,DI',
    "Health,Bad row,B000,Amazon,solia-20,not a date,1,1,0,1,1,MOBILE,DI",
    "",
  ].join("\r\n");
  const r = parseAmazonCsv(csv, { nowMs: T0 });
  assert.deepEqual(r.days, [{ day: "2026-11-01", items: 3, revenue: 49.97, earnings: 2 }, { day: "2026-11-03", items: 1, revenue: 1005, earnings: -0.2 }]);
  assert.deepEqual([r.rows, r.skipped, r.from, r.to], [3, 1, "2026-11-01", "2026-11-03"]);
  assert.doesNotMatch(JSON.stringify(r), /strips|Thermometer|B00X|solia-20/);
  assert.deepEqual(amazonTotals(r.days, "2026-11-02"), { items: 1, revenue: 1005, earnings: -0.2, days: 1 });
  const tsv = "Date\tQty\tRevenue\tEarnings\nNovember 2, 2026\t4\t80.00\t3.20\n";
  assert.deepEqual(parseAmazonCsv(tsv, { nowMs: T0 }).days, [{ day: "2026-11-02", items: 4, revenue: 80, earnings: 3.2 }]);
  assert.deepEqual(csvRows('a,"b ""q"" c",d\n'), [["a", 'b "q" c', "d"]]);
  assert.equal(reportDay("2026-02-30"), null); assert.equal(reportDay("13/45/2026"), null); assert.equal(reportDay("11/3/2026"), "2026-11-03");
  assert.equal(amount("$1,234.50"), 1234.5); assert.equal(amount("(3.20)"), -3.2); assert.equal(amount("=1+1"), null); assert.equal(amount(""), 0);
});

test("amazon CSV: caps and validation", () => {
  const head = "Date Shipped,Items Shipped,Revenue,Ad Fees\n";
  assert.match(parseAmazonCsv("", { nowMs: T0 }).error, /empty/);
  assert.match(parseAmazonCsv("just,some,words\n1,2,3\n", { nowMs: T0 }).error, /no header row/);
  assert.match(parseAmazonCsv(`${head}nope,1,2,3\n`, { nowMs: T0 }).error, /no row could be read/);
  assert.match(parseAmazonCsv(head + "x".repeat(AMAZON_CAPS.bytes), { nowMs: T0 }).error, /larger than 1 MB/);
  assert.match(parseAmazonCsv(`${head}${"2026-11-01,1,1.00,0.10\n".repeat(AMAZON_CAPS.rows + 20)}`.slice(0, AMAZON_CAPS.bytes - 10), { nowMs: T0 }).error, /more than 20000 rows/);
  assert.match(parseAmazonCsv("PK\u0000\u0000binary", { nowMs: T0 }).error, /isn't a text/);
  const odd = parseAmazonCsv(`${head}2027-01-01,1,1,1\n2010-01-01,1,1,1\n2026-11-02,1,99999999999,1\n2026-11-02,2,10,1\n2026-11-02,=cmd,10,1\n`, { nowMs: T0 });
  assert.deepEqual(odd.days, [{ day: "2026-11-02", items: 2, revenue: 10, earnings: 1 }], "a future day, a day over 5 years old, an absurd amount and a formula are skipped");
  assert.equal(odd.skipped, 4);
});

test("joinAffiliates: taps beside the linked campaign; unlinked campaigns listed apart; totals", () => {
  const brands = [{ id: "oura", name: "Oura", impactCampaignId: "1001" }, { id: "mira", name: "Mira" }, { id: "inito", name: "Inito", impactCampaignId: "9999" }, { id: "quiet", name: "Quiet" }];
  const im = [{ campaignId: "1001", campaign: "Oura", clicks: 125, actions: 7, saleAmount: 2093, commission: 167.44 }, { campaignId: "1002", campaign: "Mira Fertility", clicks: 40, actions: 2, saleAmount: 398, commission: 39.8 }];
  const j = joinAffiliates(brands, new Map([["oura", 30], ["mira", 12]]), im);
  assert.deepEqual(j.rows.map((r) => [r.brandId, r.taps, r.linked, r.clicks, r.commission]), [["oura", 30, true, 125, 167.44], ["mira", 12, false, null, null], ["inito", 0, true, null, null]]);
  assert.deepEqual(j.unlinked.map((u) => u.campaignId), ["1002"]);
  assert.deepEqual(j.totals, { taps: 42, clicks: 165, actions: 9, saleAmount: 2491, commission: 207.24 });
  assert.equal(JSON.stringify(joinAffiliates(brands, new Map(), [])).includes("quiet"), false, "a brand with no taps and no campaign isn't listed");
});

/* ---------- the routes, in process ---------- */
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "insights-aff-test-"));
process.on("exit", () => fs.rmSync(dir, { recursive: true, force: true }));
let now = T0;
const inbox = [];
const mailer = { ready: true, async send(to, subject, text) { inbox.push({ to, subject, text }); } };
const store = new JsonStore(dir);
const fast = 1000;
const ctx = { config: { authSecret: SECRET, production: true, baseUrl: "https://api.solia.example", accounts: { startPerMinute: fast, verifyPerMinute: fast, perMinute: fast, codesPerAddress: fast }, shop: { startPerMinute: fast, verifyPerMinute: fast, writePerMinute: fast, readPerMinute: fast, codesPerAddress: fast, tapPerMinute: fast }, insights: { readPerMinute: fast, writePerMinute: fast, sendPerMinute: fast } }, store, onShutdown: [] };
let imNow = impactClient({ env: ENV_OK, fetchImpl: fakeFetch });
const imProxy = { get configured() { return imNow.configured; }, get missing() { return imNow.missing; }, get reportId() { return imNow.reportId; }, campaigns: () => imNow.campaigns(), performance: (a, b) => imNow.performance(a, b) };
const app = express(); app.use(express.json());
for (const [mod, opts] of [[accounts, { clock: () => now, sweepMs: 0 }], [shop, { clock: () => now, sweepMs: 0, mailer, owners: ["owner@solia.example"], tapFlushMs: 0 }], [insights, { clock: () => now, impact: imProxy, mailer: null, timerMs: 0 }]]) {
  const r = express.Router(); mod.mount(r, ctx, opts); app.use(mod.basePath, r);
}
const srv = await new Promise((r) => { const s = app.listen(0, "127.0.0.1", () => r(s)); });
const B = `http://127.0.0.1:${srv.address().port}`;
const req = (method, p, body, token, headers = {}) => fetch(`${B}${p}`, { method, headers: { ...(body !== undefined && typeof body !== "string" ? { "content-type": "application/json" } : {}), ...(typeof body === "string" ? { "content-type": "text/csv" } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers }, body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body) });
async function portalSignIn(email) {
  await req("POST", "/api/shop/auth/start", { email });
  const code = /(\d{6})/.exec(inbox.filter((m) => m.to === email && /code/.test(m.subject)).at(-1)?.subject || "")?.[1];
  return (await (await req("POST", "/api/shop/auth/verify", { email, code })).json()).token;
}
const logs = [];
const orig = { log: console.log, warn: console.warn };
let owner, partner;

test("brand: only an owner can link an Impact campaign; the link never reaches the public catalog", async () => {
  await ctx.shopReady;
  console.log = (...a) => logs.push(a.join(" ")); console.warn = (...a) => logs.push(a.join(" "));
  owner = await portalSignIn("owner@solia.example");
  assert.equal((await req("POST", "/api/shop/invites", { email: "pat@oura.example", brandIds: ["oura"] }, owner)).status, 201);
  partner = await portalSignIn("pat@oura.example");
  assert.equal((await req("PATCH", "/api/shop/brands/oura", { impactCampaignId: "1001" }, partner)).status, 403);
  assert.equal((await req("PATCH", "/api/shop/brands/oura", { impactCampaignId: "not an id!" }, owner)).status, 400);
  const r = await req("PATCH", "/api/shop/brands/oura", { impactCampaignId: "1001" }, owner);
  assert.equal(r.status, 200);
  assert.equal((await r.json()).brand.impactCampaignId, "1001");
  assert.equal((await req("POST", "/api/shop/brands/oura/publish", {}, owner)).status, 200);
  const cat = await (await req("GET", "/api/shop/catalog")).text();
  assert.doesNotMatch(cat, /impactCampaignId|1001/);
});

test("affiliates: taps beside Impact's numbers per brand, totals, last read; cached 15 minutes", async () => {
  for (const id of ["oura", "oura", "mira"]) assert.equal((await req("POST", "/api/shop/tap", { productId: id })).status, 204);
  const n0 = calls.length;
  const a = await (await req("GET", "/api/insights/affiliates?days=7", undefined, owner)).json();
  assert.deepEqual([a.days, a.from, a.to], [7, "2026-11-13", "2026-11-19"]);
  assert.equal(a.impact.configured, true); assert.equal(a.impact.error, null); assert.equal(a.impact.fetchedAt, new Date(T0).toISOString()); assert.equal(a.impact.cachedMinutes, 15);
  assert.deepEqual(a.rows.map((r) => [r.brandId, r.taps, r.campaign, r.clicks, r.actions, r.saleAmount, r.commission]), [["oura", 2, "Oura", 125, 7, 2093, 167.44], ["mira", 1, null, null, null, null, null]]);
  assert.deepEqual(a.unlinked.map((u) => [u.campaignId, u.campaign]), [["1002", "Mira Fertility"], ["1003", "Everlywell"]]);
  assert.deepEqual(a.totals, { taps: 3, clicks: 180, actions: 9, saleAmount: 2491, commission: 207.24 });
  assert.deepEqual(a.amazon, { uploaded: false });
  assert.equal(calls.length, n0 + 1);
  assert.doesNotMatch(JSON.stringify(a), new RegExp(TOKEN));
  now += 14 * 60_000;
  await req("GET", "/api/insights/affiliates?days=7", undefined, owner);
  assert.equal(calls.length, n0 + 1, "within 15 minutes: served from the cache");
  await req("GET", "/api/insights/affiliates?days=7&refresh=1", undefined, owner);
  assert.equal(calls.length, n0 + 2, "Refresh reads again");
  now += IMPACT_TTL_MS + 1;
  await req("GET", "/api/insights/affiliates?days=7", undefined, owner);
  assert.equal(calls.length, n0 + 3, "after 15 minutes: read again");
  const camps = await (await req("GET", "/api/insights/impact/campaigns", undefined, owner)).json();
  assert.deepEqual(camps.campaigns, [{ id: "1001", name: "Oura" }, { id: "1002", name: "Mira Fertility" }]);
});

test("affiliates: an Impact error is shown as a category and the taps still show; not configured names the variables and makes no request", async () => {
  mode = "error"; now += IMPACT_TTL_MS + 1;
  const e = await (await req("GET", "/api/insights/affiliates?days=30", undefined, owner)).json();
  assert.equal(e.impact.error, "Impact answered 500");
  assert.equal(e.totals.taps, 3); assert.equal(e.rows.find((r) => r.brandId === "oura").clicks, null);
  mode = "ok";
  imNow = impactClient({ env: {}, fetchImpl: fakeFetch });
  const n = calls.length;
  const off = await (await req("GET", "/api/insights/affiliates?days=30", undefined, owner)).json();
  assert.equal(off.impact.configured, false);
  assert.deepEqual(off.impact.missing, ["IMPACT_ACCOUNT_SID", "IMPACT_AUTH_TOKEN"]);
  assert.deepEqual(off.impact.env, { sid: "IMPACT_ACCOUNT_SID", token: "IMPACT_AUTH_TOKEN", report: "IMPACT_REPORT_ID" });
  assert.equal(off.totals.taps, 3);
  assert.equal((await (await req("GET", "/api/insights/impact/campaigns", undefined, owner)).json()).configured, false);
  assert.equal(calls.length, n, "no request without the variables");
  imNow = impactClient({ env: ENV_OK, fetchImpl: fakeFetch });
});

test("amazon: an owner uploads the earnings report; totals show for the window; a second upload replaces the same days; delete removes it", async () => {
  const head = "Date Shipped,Name,Items Shipped,Revenue($),Ad Fees($)\n";
  assert.equal((await req("POST", "/api/insights/amazon", "nothing useful", owner)).status, 400);
  assert.equal((await req("POST", "/api/insights/amazon", { csv: "x" }, owner)).status, 415, "JSON is not a report");
  assert.equal((await req("POST", "/api/insights/amazon", head + "x".repeat(AMAZON_CAPS.bytes + 10), owner)).status, 413);
  const up = await req("POST", "/api/insights/amazon", `${head}2026-11-18,LH strips,2,40.00,1.60\n2026-11-18,Thermometer,1,10.00,0.40\n2026-10-01,Old,5,100.00,4.00\n`, owner);
  assert.equal(up.status, 201);
  assert.deepEqual(await up.json().then((j) => [j.rows, j.days, j.from, j.to]), [3, 2, "2026-10-01", "2026-11-18"]);
  const a = (await (await req("GET", "/api/insights/affiliates?days=7", undefined, owner)).json()).amazon;
  assert.equal(a.uploaded, true); assert.deepEqual(a.window, { items: 3, revenue: 50, earnings: 2, days: 1 }); assert.deepEqual([a.from, a.to], ["2026-10-01", "2026-11-18"]);
  assert.equal((await (await req("GET", "/api/insights/affiliates?days=90", undefined, owner)).json()).amazon.window.items, 8);
  assert.equal((await req("POST", "/api/insights/amazon", `${head}2026-11-18,LH strips,4,80.00,3.20\n`, owner)).status, 201);
  assert.deepEqual((await (await req("GET", "/api/insights/affiliates?days=90", undefined, owner)).json()).amazon.window, { items: 9, revenue: 180, earnings: 7.2, days: 2 });
  const disk = fs.readFileSync(path.join(dir, "insights_amazon.json"), "utf8");
  assert.doesNotMatch(disk, /strips|Thermometer|Old/);
  for (const row of JSON.parse(disk)) assert.deepEqual(Object.keys(row).sort(), ["day", "earnings", "items", "revenue"]);
  assert.equal((await req("DELETE", "/api/insights/amazon", undefined, owner)).status, 204);
  assert.deepEqual((await (await req("GET", "/api/insights/affiliates", undefined, owner)).json()).amazon, { uploaded: false });
  const audit = (await (await req("GET", "/api/shop/audit", undefined, owner)).json()).audit;
  assert.ok(audit.some((x) => x.action === "upload amazon report" && x.by === "owner@solia.example") && audit.some((x) => x.action === "remove amazon report"));
});

test("a partner gets 403 on every affiliates route; no sign-in is 401", async () => {
  partner = await portalSignIn("pat@oura.example");
  for (const [m, p, b] of [["GET", "/api/insights/affiliates"], ["GET", "/api/insights/impact/campaigns"], ["POST", "/api/insights/amazon", "Date,Revenue,Earnings\n2026-11-01,1,1\n"], ["DELETE", "/api/insights/amazon"]]) {
    assert.equal((await req(m, p, b, partner)).status, 403, `${m} ${p}`);
    assert.equal((await req(m, p, b)).status, 401, `${m} ${p} without a sign-in`);
  }
});

test("log: never the Impact token, the SID or an email address", () => {
  console.log = orig.log; console.warn = orig.warn;
  const all = logs.join("\n");
  assert.ok(/insights: impact \(Impact answered 500\)/.test(all), "the failure is logged as a category");
  assert.doesNotMatch(all, new RegExp(`${TOKEN}|${SID}|@solia\\.example|@oura\\.example`));
});

test("close", async () => { srv.close(); for (const fn of ctx.onShutdown) await fn(); });
