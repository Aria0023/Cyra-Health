// Unit tests for the AI spend estimate (docs/plans/launch-tools.md Task 2): the ai module keeps TOTALS only per UTC day
// and kind (never who or what); the estimate is tokens x editable prices; the budget emails once at 80% and once at
// 100% in a month, also across a restart; the weekly report carries the estimate; owner only.
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
import { spendRecorder, usageTotals, costOf, cleanPrices, DEFAULT_PRICES, SPEND_KINDS } from "../src/modules/ai/spend.js";
import { spendReport, budgetState, alertDue, alertEmail, costBetween } from "../src/modules/insights/spend.js";
import { buildTotals, numbersText, weekOf } from "../src/modules/insights/weekly.js";

const T0 = Date.UTC(2026, 10, 10, 12); // 2026-11-10 12:00 UTC
const DAY = 86_400_000;
const tmp = (n) => { const d = fs.mkdtempSync(path.join(os.tmpdir(), n)); process.on("exit", () => fs.rmSync(d, { recursive: true, force: true })); return d; };

test("usageTotals and costOf: the five totals and nothing else; the estimate's arithmetic", () => {
  const usage = { input_tokens: 1_000_000, output_tokens: 500_000, cache_creation_input_tokens: 200_000, cache_read_input_tokens: 1_000_000, server_tool_use: { web_search_requests: 5, web_fetch_requests: 9 }, inference_geo: "us", service_tier: "standard", iterations: [{ type: "message" }] };
  const t = usageTotals(usage);
  assert.deepEqual(t, { input: 1_000_000, output: 500_000, cacheWrite: 200_000, cacheRead: 1_000_000, searches: 5 });
  // 1M in x $4 + 0.5M out x $20 + 0.2M cache write x $5 + 1M cache read x $0.20 + 5 searches x $10/1000
  assert.equal(Math.round(costOf(t, DEFAULT_PRICES) * 10000) / 10000, 4 + 10 + 1 + 0.2 + 0.05);
  assert.deepEqual(usageTotals(null), { input: 0, output: 0, cacheWrite: 0, cacheRead: 0, searches: 0 });
  assert.deepEqual(usageTotals({ input_tokens: -5, output_tokens: "x" }), { input: 0, output: 0, cacheWrite: 0, cacheRead: 0, searches: 0 });
  assert.deepEqual(DEFAULT_PRICES, { model: "claude-opus-5-5", inputPerMTok: 4, outputPerMTok: 20, cacheWritePerMTok: 5, cacheReadPerMTok: 0.2, webSearchPer1000: 10 });
  assert.deepEqual(cleanPrices({ inputPerMTok: 3, outputPerMTok: -1, cacheReadPerMTok: "0.3", webSearchPer1000: "" }), { model: "claude-opus-5-5", inputPerMTok: 3, outputPerMTok: 20, cacheWritePerMTok: 5, cacheReadPerMTok: 0.3, webSearchPer1000: 10 });
  for (const f of ["config/app.json", "config/app-dev.json"]) assert.deepEqual(cleanPrices(JSON.parse(fs.readFileSync(new URL(`../${f}`, import.meta.url), "utf8")).ai.prices), { ...DEFAULT_PRICES }, f);
});

test("spendRecorder: one row per day and kind, totals only, 400 days kept", async () => {
  const dir = tmp("ai-spend-rec-"), store = new JsonStore(dir);
  let now = T0, pings = 0;
  await store.insert("ai_spend", { day: "2025-10-01", kind: "chat", requests: 3, input: 9, output: 9, cacheWrite: 0, cacheRead: 0, searches: 0 }); // 405 days old
  await store.insert("ai_spend", { day: "2025-10-10", kind: "chat", requests: 1, input: 1, output: 1, cacheWrite: 0, cacheRead: 0, searches: 0 }); // 396 days old
  const rec = spendRecorder({ store, clock: () => now, onRecord: () => { pings++; } });
  rec.record("chat", { input_tokens: 100, output_tokens: 50, account: "acct_x", text: "my period is late" });
  rec.record("chat", { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 7 });
  rec.record("evidence", { input_tokens: 1, output_tokens: 2, server_tool_use: { web_search_requests: 3 } });
  rec.record("not-a-kind", { input_tokens: 999 }); rec.record("ask", null);
  now = T0 + DAY; rec.record("report", { input_tokens: 4, output_tokens: 4 });
  await rec.idle();
  const rows = JSON.parse(fs.readFileSync(path.join(dir, "ai_spend.json"), "utf8"));
  assert.deepEqual(rows, [
    { day: "2025-10-10", kind: "chat", requests: 1, input: 1, output: 1, cacheWrite: 0, cacheRead: 0, searches: 0 },
    { day: "2026-11-10", kind: "chat", requests: 2, input: 110, output: 55, cacheWrite: 0, cacheRead: 7, searches: 0 },
    { day: "2026-11-10", kind: "evidence", requests: 1, input: 1, output: 2, cacheWrite: 0, cacheRead: 0, searches: 3 },
    { day: "2026-11-11", kind: "report", requests: 1, input: 4, output: 4, cacheWrite: 0, cacheRead: 0, searches: 0 },
  ]);
  assert.equal(pings, 4);
  assert.doesNotMatch(fs.readFileSync(path.join(dir, "ai_spend.json"), "utf8"), /acct_|period|text|account/);
  assert.deepEqual([...SPEND_KINDS], ["ask", "evidence", "chat", "weekly", "report"]);
});

test("spendReport: this month so far, by kind, by day, the projection and the average per person", () => {
  const rows = [
    { day: "2026-11-01", kind: "chat", requests: 10, input: 1_000_000, output: 100_000, cacheWrite: 0, cacheRead: 0, searches: 0 },   // $4 + $2 = $6
    { day: "2026-11-10", kind: "evidence", requests: 2, input: 500_000, output: 50_000, cacheWrite: 0, cacheRead: 0, searches: 100 }, // $2 + $1 + $1 = $4
    { day: "2026-10-31", kind: "chat", requests: 1, input: 9_000_000, output: 0, cacheWrite: 0, cacheRead: 0, searches: 0 },          // last month
    { day: "2026-11-12", kind: "chat", requests: 1, input: 9_000_000, output: 0, cacheWrite: 0, cacheRead: 0, searches: 0 },          // a later day than "now"
    { day: "2026-11-02", kind: "mystery", requests: 1, input: 9_000_000 },
  ];
  const r = spendReport({ rows, nowMs: T0, people: 4 });
  assert.deepEqual([r.month, r.asOf, r.daysInMonth, r.estimateUsd, r.people, r.perPersonUsd], ["2026-11", "2026-11-10", 30, 10, 4, 2.5]);
  assert.equal(r.projectedUsd, Math.round((10 / 9.5) * 30 * 10000) / 10000, "9.5 days gone of 30");
  assert.deepEqual(r.byKind.map((k) => [k.kind, k.requests, k.usd]), [["ask", 0, 0], ["evidence", 2, 4], ["chat", 10, 6], ["weekly", 0, 0], ["report", 0, 0]]);
  assert.equal(r.byDay.length, 10);
  assert.deepEqual([r.byDay[0], r.byDay[9]], [{ day: "2026-11-01", requests: 10, usd: 6 }, { day: "2026-11-10", requests: 2, usd: 4 }]);
  assert.equal(spendReport({ rows, nowMs: T0, people: 0 }).perPersonUsd, null);
  assert.equal(spendReport({ rows: [rows[0]], nowMs: Date.UTC(2026, 10, 1, 1) }).projectedUsd, 180, "the first hours count as one day");
  assert.equal(spendReport({ rows, nowMs: T0, prices: { ...DEFAULT_PRICES, inputPerMTok: 8 } }).estimateUsd, 16, "the owner's prices are the ones used");
  assert.equal(costBetween(rows, "2026-11-09", "2026-11-15", DEFAULT_PRICES), 40, "a week's rows, whatever today is");
});

test("budgetState, alertDue and the alert's words", () => {
  assert.deepEqual(budgetState(10, null), { budgetUsd: null, percent: null, level: "none" });
  assert.deepEqual([budgetState(79.99, 100).level, budgetState(80, 100).level, budgetState(99.99, 100).level, budgetState(100, 100).level], ["ok", "warn", "warn", "over"]);
  assert.equal(budgetState(81.7, 100).percent, 81);
  assert.equal(alertDue("ok", {}), null);
  assert.equal(alertDue("warn", {}), "p80");
  assert.equal(alertDue("warn", { p80: "x" }), null);
  assert.equal(alertDue("over", { p80: "x" }), "p100");
  assert.equal(alertDue("over", {}), "p100", "straight past 100%: one email, the 100% one");
  assert.equal(alertDue("over", { p100: "x" }), null);
  assert.equal(alertDue("warn", { p100: "x" }), null, "after the 100% email (budget raised since) no 80% email follows this month");
  const m = alertEmail("p80", { month: "2026-11", estimateUsd: 81.5, projectedUsd: 240, budgetUsd: 100 });
  assert.equal(m.subject, "Solia Health: the AI cost estimate has passed 80% of this month's budget");
  for (const s of ["$81.50", "$100.00", "$240.00", "Estimate only", "Anthropic's console is the bill of record.", "Nothing is switched off when the budget is passed. The per-person monthly caps remain the hard limit."]) assert.ok(m.text.includes(s), s);
});

test("the weekly report's numbers carry the estimate", () => {
  const week = weekOf(Date.UTC(2026, 10, 16, 14));
  const t = buildTotals({ week, nowMs: Date.UTC(2026, 10, 16, 14), aiCost: { weekUsd: 12.345, monthUsd: 40.1, budgetUsd: 50, budgetPercent: 80 } });
  assert.deepEqual(t.ai, { month: "2026-11", evidenceQuestions: 0, chatMessages: 0, weeklyWriteUps: 0, estimatedCostThisWeekUsd: 12.35, estimatedCostMonthUsd: 40.1, monthlyBudgetUsd: 50, budgetUsedPercent: 80 });
  assert.ok(numbersText(t).includes("- Estimated AI cost: $12.35 this week; $40.10 in 2026-11 so far (80% of the $50.00 monthly budget). An estimate from token totals; Anthropic's console is the bill of record."));
  const none = buildTotals({ week, nowMs: Date.UTC(2026, 10, 16, 14) });
  assert.ok(!numbersText(none).includes("Estimated AI cost"));
});

/* ---------- the routes and the alert, in process ---------- */
const dir = tmp("ai-spend-test-");
let now = T0;
const inbox = [], sent = [];
const portalMailer = { ready: true, async send(to, subject, text) { inbox.push({ to, subject, text }); } };
const mailer = { ready: true, async send(to, subject, text) { sent.push({ to, subject, text }); } };
const fast = 1000;
const mk = (store) => ({ config: { authSecret: "unit-test-secret-1234567890", production: true, modules: [], baseUrl: "https://api.solia.example", ai: { prices: { ...DEFAULT_PRICES } }, accounts: { startPerMinute: fast, verifyPerMinute: fast, perMinute: fast, codesPerAddress: fast }, shop: { startPerMinute: fast, verifyPerMinute: fast, writePerMinute: fast, readPerMinute: fast, codesPerAddress: fast }, insights: { readPerMinute: fast, writePerMinute: fast, sendPerMinute: fast } }, store, onShutdown: [] });
const off = { configured: false, missing: [], campaigns: async () => [], performance: async () => [] };
function boot(ctx, app) {
  for (const [mod, opts] of [[accounts, { clock: () => now, sweepMs: 0, sender: { ready: true, dev: false, async send() {} } }], [shop, { clock: () => now, sweepMs: 0, mailer: portalMailer, owners: ["owner@solia.example", "second@solia.example"], tapFlushMs: 0 }], [insights, { clock: () => now, mailer, timerMs: 0, env: {}, rc: off, impact: off }]]) {
    const r = express.Router(); mod.mount(r, ctx, opts); app?.use(mod.basePath, r);
  }
}
const store = new JsonStore(dir);
const ctx = mk(store);
const app = express(); app.use(express.json());
boot(ctx, app);
ctx.aiSpend = spendRecorder({ store, clock: () => now, onRecord: () => ctx.onAiSpend?.() }); // what the ai module sets
const srv = await new Promise((r) => { const s = app.listen(0, "127.0.0.1", () => r(s)); });
const B = `http://127.0.0.1:${srv.address().port}`;
const req = (method, p, body, token) => fetch(`${B}${p}`, { method, headers: { ...(body !== undefined ? { "content-type": "application/json" } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
async function portalSignIn(email) {
  await req("POST", "/api/shop/auth/start", { email });
  const code = /(\d{6})/.exec(inbox.filter((m) => m.to === email && /code/.test(m.subject)).at(-1)?.subject || "")?.[1];
  return (await (await req("POST", "/api/shop/auth/verify", { email, code })).json()).token;
}
const M = 1_000_000;
let owner;

test("GET /ai-costs: owner only; an estimate with its prices; editing prices and the budget", async () => {
  await ctx.shopReady;
  owner = await portalSignIn("owner@solia.example");
  await req("POST", "/api/shop/invites", { email: "pat@oura.example", brandIds: ["oura"] }, owner);
  const partner = await portalSignIn("pat@oura.example");
  for (const [m, p, b] of [["GET", "/api/insights/ai-costs"], ["GET", "/api/insights/ai-costs.csv"], ["PUT", "/api/insights/ai-costs/prices", { inputPerMTok: 1 }], ["PUT", "/api/insights/ai-costs/budget", { usd: 1 }]]) {
    assert.equal((await req(m, p, b, partner)).status, 403, p); assert.equal((await req(m, p, b)).status, 401, p);
  }
  await store.insert("ai_usage", { id: "acct_aaaaaaaaaaaaaaaaaaaa:2026-11", evidence: 1, chat: 2, weekly: 0 });
  await store.insert("ai_usage", { id: "acct_bbbbbbbbbbbbbbbbbbbb:2026-11", evidence: 0, chat: 1, weekly: 0 });
  await store.insert("ai_usage", { id: "acct_aaaaaaaaaaaaaaaaaaaa:2026-10", evidence: 9, chat: 9, weekly: 9 });
  ctx.aiSpend.record("chat", { input_tokens: 2 * M, output_tokens: 0.1 * M }); // $8 + $2 = $10
  const res = await req("GET", "/api/insights/ai-costs", undefined, owner), raw = await res.text(), v = JSON.parse(raw);
  assert.deepEqual([v.estimate, v.month, v.estimateUsd, v.people, v.perPersonUsd, v.budget.level, v.prices.editedAt, v.prices.modelDiffers, v.model], [true, "2026-11", 10, 2, 5, "none", null, false, "claude-opus-5-5"]);
  assert.equal(v.estimateLine, "Estimate only: token totals multiplied by the prices shown. Anthropic's console is the bill of record.");
  assert.equal(v.noShutoffLine, "Nothing is switched off when the budget is passed. The per-person monthly caps remain the hard limit.");
  assert.doesNotMatch(raw, /acct_|@/, "no account id and no address");
  for (const bad of [{ inputPerMTok: "4" }, { inputPerMTok: -1 }, { model: "x" }, {}, { inputPerMTok: 1e9 }]) assert.equal((await req("PUT", "/api/insights/ai-costs/prices", bad, owner)).status, 400, JSON.stringify(bad));
  const p = await (await req("PUT", "/api/insights/ai-costs/prices", { inputPerMTok: 5 }, owner)).json();
  assert.deepEqual([p.prices.inputPerMTok, p.prices.outputPerMTok, p.prices.editedAt, p.estimateUsd], [5, 20, "2026-11-10T12:00:00.000Z", 12]);
  const back = await (await req("PUT", "/api/insights/ai-costs/prices", { reset: true }, owner)).json();
  assert.deepEqual([back.prices.inputPerMTok, back.prices.editedAt, back.estimateUsd], [4, null, 10]);
  for (const bad of [{ usd: "100" }, { usd: 0 }, { usd: -5 }, {}, { usd: 5, more: 1 }]) assert.equal((await req("PUT", "/api/insights/ai-costs/budget", bad, owner)).status, 400, JSON.stringify(bad));
  const csv = await (await req("GET", "/api/insights/ai-costs.csv", undefined, owner)).text();
  assert.equal(csv, "day_utc,kind,requests,input_tokens,output_tokens,cache_write_tokens,cache_read_tokens,web_searches,estimated_cost_usd\n2026-11-10,chat,1,2000000,100000,0,0,0,10.0000\n");
});

test("the budget: one email at 80%, one at 100%, never again that month, not even after a restart; then a new month", async () => {
  const b = await (await req("PUT", "/api/insights/ai-costs/budget", { usd: 20 }, owner)).json();
  assert.deepEqual([b.budget.budgetUsd, b.budget.percent, b.budget.level], [20, 50, "ok"]);
  assert.equal(await ctx.aiBudgetCheck(), null);
  assert.equal(sent.length, 0);
  ctx.aiSpend.record("evidence", { input_tokens: 1.5 * M }); // +$6 = $16: 80%
  await ctx.aiSpend.idle();
  assert.deepEqual(await ctx.aiBudgetCheck(), { which: "p80", sent: 2, failed: 0 });
  assert.deepEqual(sent.map((m) => m.to), ["owner@solia.example", "second@solia.example"], "the weekly report's recipients");
  assert.match(sent[0].subject, /passed 80%/); assert.ok(sent[0].text.includes("$16.00") && sent[0].text.includes("$20.00"));
  assert.equal(await ctx.aiBudgetCheck(), null); assert.equal(sent.length, 2);
  // a restart: a new server on the same data sends nothing more
  const ctx2 = mk(new JsonStore(dir)); boot(ctx2, null);
  assert.equal(await ctx2.aiBudgetCheck(), null); assert.equal(sent.length, 2);
  for (const fn of ctx2.onShutdown) await fn();
  // the weekly report's recipients, when an owner changed them
  await req("PUT", "/api/insights/weekly", { recipients: "cfo@solia.example" }, owner);
  ctx.aiSpend.record("chat", { input_tokens: 1 * M }); // +$4 = $20: 100%
  await ctx.aiSpend.idle();
  assert.deepEqual(await ctx.aiBudgetCheck(), { which: "p100", sent: 1, failed: 0 });
  assert.equal(sent.at(-1).to, "cfo@solia.example"); assert.match(sent.at(-1).subject, /passed 100%/);
  ctx.aiSpend.record("chat", { input_tokens: 5 * M }); await ctx.aiSpend.idle();
  assert.equal(await ctx.aiBudgetCheck(), null); assert.equal(sent.length, 3);
  const v = await (await req("GET", "/api/insights/ai-costs", undefined, owner)).json();
  assert.deepEqual([v.budget.level, v.budget.percent, !!v.budget.alerts.p80, !!v.budget.alerts.p100], ["over", 200, true, true]);
  // raising the budget so the month sits at 80% again: no second 80% email
  await req("PUT", "/api/insights/ai-costs/budget", { usd: 45 }, owner);
  assert.equal(await ctx.aiBudgetCheck(), null); assert.equal(sent.length, 3);
  // the readiness page and the weekly report see the same state
  const ready = await (await req("GET", "/api/insights/readiness", undefined, owner)).json();
  const row = ready.rows.find((r) => r.id === "ai-budget");
  assert.deepEqual([row.status, row.required], ["problem", false]); assert.match(row.detail, /\$40\.00: 88% of the \$45\.00 budget, past 80%/);
  // December: the markers are per month
  now = Date.UTC(2026, 11, 2, 12);
  owner = await portalSignIn("owner@solia.example");
  ctx.aiSpend.record("chat", { input_tokens: 9 * M, output_tokens: 0.05 * M }); await ctx.aiSpend.idle(); // $37: 82% of $45
  // a minute has passed since the last automatic check, so the recorder's own check sends this one: no call from here
  for (let i = 0; i < 100 && sent.length < 4; i++) await new Promise((r) => setTimeout(r, 10));
  assert.equal(sent.length, 4); assert.match(sent[3].subject, /passed 80%/); assert.ok(sent[3].text.includes("for 2026-12"));
  assert.equal(await ctx.aiBudgetCheck(), null);
  for (const m of sent) assert.doesNotMatch(m.text, /acct_/);
});

test.after(async () => { for (const fn of ctx.onShutdown) await fn(); srv.close(); });
