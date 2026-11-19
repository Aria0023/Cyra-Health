// Unit tests for the weekly owner report (docs/plans/tracking-reports.md Task 4): the Monday 14:00 UTC schedule and its
// grace, never sending a week twice (also across a restart), the totals-only JSON (key allowlist, no "@", no ids), the
// >30% "unusual" rule, Claude writing the summary through the ai module's client with the template fallback (no key, an
// API error, a refusal, an unusable answer), settings validation, preview = what is sent, and owner-only routes.
// In process: accounts + shop + insights on one Express app, an injected clock, a capturing mailer and a fake AI writer.
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
import { dueSlot, slotToSend, nextSlot, weekOf, buildTotals, unusualMoves, composeReport, numbersText, cleanSummary, cleanRecipients, TOTALS_LINE, WEEKLY_SYSTEM, weeklyPrompt } from "../src/modules/insights/weekly.js";
import { writeText } from "../src/modules/ai/index.js";

const SECRET = "unit-test-secret-1234567890";
const HOUR = 3_600_000, DAY = 86_400_000;
const MON = Date.UTC(2026, 10, 16, 14); // Monday 2026-11-16 14:00 UTC

/* ---------- pure parts ---------- */
test("schedule: due every Monday 14:00 UTC; one slot per week; three days of grace; off means never", () => {
  assert.equal(new Date(dueSlot(MON)).toISOString(), "2026-11-16T14:00:00.000Z");
  assert.equal(new Date(dueSlot(MON - 1)).toISOString(), "2026-11-09T14:00:00.000Z", "one millisecond before: still last week's slot");
  assert.equal(new Date(dueSlot(Date.UTC(2026, 10, 22, 23, 59))).toISOString(), "2026-11-16T14:00:00.000Z", "Sunday night");
  assert.equal(nextSlot(MON + HOUR), "2026-11-23T14:00:00.000Z");
  assert.deepEqual(weekOf(MON), { from: "2026-11-09", to: "2026-11-15", prevFrom: "2026-11-02", prevTo: "2026-11-08" });
  const slot = "2026-11-16T14:00:00.000Z";
  assert.equal(slotToSend({ nowMs: MON, enabled: true, lastSlot: null }), slot);
  assert.equal(slotToSend({ nowMs: MON + 5 * HOUR, enabled: true, lastSlot: "2026-11-09T14:00:00.000Z" }), slot);
  assert.equal(slotToSend({ nowMs: MON + 5 * HOUR, enabled: true, lastSlot: slot }), null, "already sent this week");
  assert.equal(slotToSend({ nowMs: MON + 3 * DAY, enabled: true, lastSlot: null }), slot, "a server that was down still sends within three days");
  assert.equal(slotToSend({ nowMs: MON + 3 * DAY + 1, enabled: true, lastSlot: null }), null, "after that the week is skipped");
  assert.equal(slotToSend({ nowMs: MON, enabled: false, lastSlot: null }), null);
  assert.equal(slotToSend({ nowMs: MON - HOUR, enabled: true, lastSlot: "2026-11-09T14:00:00.000Z" }), null, "an hour early: last week's is sent, this week's isn't due");
});

test("unusual: more than 30% either way, or from nothing to five or more", () => {
  assert.deepEqual(unusualMoves([{ metric: "A", now: 131, before: 100 }, { metric: "B", now: 130, before: 100 }, { metric: "C", now: 69, before: 100 }, { metric: "D", now: 6, before: 0 }, { metric: "E", now: 4, before: 0 }, { metric: "F", now: 0, before: 0 }, { metric: "G", now: 0, before: 10 }]),
    [{ metric: "A", thisWeek: 131, weekBefore: 100, changePercent: 31 }, { metric: "C", thisWeek: 69, weekBefore: 100, changePercent: -31 }, { metric: "D", thisWeek: 6, weekBefore: 0, changePercent: null }, { metric: "G", thisWeek: 0, weekBefore: 10, changePercent: -100 }]);
});

const SRC = () => ({
  week: weekOf(MON), nowMs: MON,
  accounts: [
    { provider: "apple", createdAt: "2026-11-10T09:00:00.000Z", lastSeenDay: "2026-11-15" },
    { provider: "email", createdAt: "2026-11-12T09:00:00.000Z", lastSeenDay: "2026-11-12" },
    { provider: "google", createdAt: "2026-11-03T09:00:00.000Z", lastSeenDay: "2026-11-04" },
    { provider: "email", createdAt: "2026-08-01T09:00:00.000Z" },
  ],
  taps: [{ day: "2026-11-09", productId: "oura", brandId: "oura", taps: 30 }, { day: "2026-11-14", productId: "oura", brandId: "oura", taps: 10 }, { day: "2026-11-14", productId: "mira", brandId: "mira", taps: 5 }, { day: "2026-11-05", productId: "oura", brandId: "oura", taps: 20 }, { day: "2026-11-16", productId: "oura", brandId: "oura", taps: 99 }],
  names: { product: (id) => ({ oura: "Oura Ring", mira: "Fertility hormone monitor" })[id], brand: (id) => ({ oura: "Oura", mira: "Mira" })[id] },
  rc: { configured: true, metrics: [{ id: "active_subscriptions", name: "Active Subscriptions", value: 42, unit: "#", period: "P0D" }, { id: "mrr", name: "MRR", value: 315.5, unit: "$", period: "P28D" }] },
  impact: { configured: true, now: [{ campaignId: "1001", campaign: "Oura", clicks: 120, actions: 6, saleAmount: 1794, commission: 143.52 }], before: [{ campaignId: "1001", campaign: "Oura", clicks: 60, actions: 5, saleAmount: 1495, commission: 119.6 }] },
  amazon: { uploadedAt: "2026-11-16T08:00:00.000Z", days: [{ day: "2026-11-10", items: 3, revenue: 50, earnings: 2 }, { day: "2026-11-01", items: 9, revenue: 90, earnings: 9 }] },
  applications: [{ status: "pending", at: "2026-11-11T10:00:00.000Z" }, { status: "pending", at: "2026-10-01T10:00:00.000Z" }, { status: "approved", at: "2026-11-13T10:00:00.000Z" }],
  products: [{ status: "pending" }, { status: "published" }, { status: "pending" }, { status: "draft" }],
  partners: 3,
  aiUsage: [{ id: ":2026-11", evidence: 10, chat: 40, weekly: 2 }, { id: ":2026-11", evidence: 5, chat: 1 }, { id: ":2026-10", evidence: 99, chat: 99, weekly: 9 }],
});
const ALLOWED = new Set(["week", "weekBefore", "from", "to", "people", "total", "newThisWeek", "newWeekBefore", "activeSinceWeekStart", "activeLast30Days", "bySignIn", "apple", "google", "facebook", "email", "subscriptions", "connected", "notSet", "error", "numbers", "id", "name", "value", "unit", "period", "shop", "taps", "tapsWeekBefore", "mostOpened", "product", "brand", "affiliates", "impact", "thisWeek", "clicks", "sales", "saleAmount", "commission", "amazon", "uploadedOn", "items", "revenue", "earnings", "daysCovered", "partners", "applicationsWaiting", "applicationsThisWeek", "productsWaitingForReview", "ai", "month", "evidenceQuestions", "chatMessages", "weeklyWriteUps", "unusual", "metric", "changePercent"]);
const keysOf = (v, out = new Set()) => { if (Array.isArray(v)) v.forEach((x) => keysOf(x, out)); else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) { out.add(k); keysOf(x, out); } return out; };

test("totals: counts and sums only; every key is on the allowlist; nothing that names a person", () => {
  const src = SRC();
  // rows as the store holds them, with what must never get through
  src.accounts = src.accounts.map((a, i) => ({ ...a, id: `acct_secret_${i}`, email: `person${i}@x.example`, name: "Maya Lin", key: "k" }));
  src.applications = src.applications.map((a) => ({ ...a, email: "founder@brand.example", company: "Brand Co", note: "call me" }));
  const t = buildTotals(src);
  assert.deepEqual(t.week, { from: "2026-11-09", to: "2026-11-15" });
  assert.deepEqual(t.people, { total: 4, newThisWeek: 2, newWeekBefore: 1, activeSinceWeekStart: 2, activeLast30Days: 3, bySignIn: { apple: 1, google: 1, facebook: 0, email: 2 } });
  assert.deepEqual(t.shop, { taps: 45, tapsWeekBefore: 20, mostOpened: [{ product: "Oura Ring", brand: "Oura", taps: 40 }, { product: "Fertility hormone monitor", brand: "Mira", taps: 5 }] });
  assert.deepEqual(t.affiliates.impact, { connected: true, thisWeek: { clicks: 120, sales: 6, saleAmount: 1794, commission: 143.52 }, weekBefore: { clicks: 60, sales: 5, saleAmount: 1495, commission: 119.6 } });
  assert.deepEqual(t.affiliates.amazon, { uploadedOn: "2026-11-16", items: 3, revenue: 50, earnings: 2, daysCovered: 1 });
  assert.deepEqual(t.partners, { applicationsWaiting: 2, applicationsThisWeek: 2, productsWaitingForReview: 2, partners: 3 });
  assert.deepEqual(t.ai, { month: "2026-11", evidenceQuestions: 15, chatMessages: 41, weeklyWriteUps: 2 });
  assert.deepEqual(t.unusual.map((u) => [u.metric, u.changePercent]), [["New accounts", 100], ["Shop taps", 125], ["Affiliate clicks (Impact)", 100]]);
  const raw = JSON.stringify(t);
  assert.doesNotMatch(raw, /@|acct_secret|Maya|person\d|founder|Brand Co|call me/);
  const extra = [...keysOf(t)].filter((k) => !ALLOWED.has(k));
  assert.deepEqual(extra, [], "a key that isn't on the totals allowlist");
  // not connected / error states carry only names of variables and a category
  const off = buildTotals({ ...SRC(), rc: { configured: false, missing: ["REVENUECAT_SECRET_KEY"] }, impact: { configured: true, error: "Impact answered 500" }, amazon: null });
  assert.deepEqual(off.subscriptions, { connected: false, notSet: ["REVENUECAT_SECRET_KEY"] });
  assert.deepEqual(off.affiliates, { impact: { connected: true, error: "Impact answered 500" }, amazon: null });
  assert.equal(buildTotals({ ...SRC(), names: { product: () => "Ring by ceo@brand.example", brand: () => "B" } }).shop.mostOpened[0].product.includes("@"), false, "an address typed into a product name never reaches the report");
});

test("the email: the same numbers with or without the AI summary; it says totals only", () => {
  const t = buildTotals(SRC());
  const plain = composeReport(t, "");
  assert.equal(plain.subject, "Solia Health weekly report: 2026-11-09 to 2026-11-15");
  assert.equal(plain.writer, "template");
  assert.ok(plain.text.includes(TOTALS_LINE)); assert.equal(TOTALS_LINE, "Totals only; no personal or health data.");
  for (const line of ["- Accounts: 4 in all; 2 new this week (1 the week before)", "- Active Subscriptions: 42", "- MRR: $315.50", "- Product taps: 45 (20 the week before)", "  1. Oura Ring (Oura): 40", "- Impact: 120 clicks, 6 sales, 1,794.00 in sales, 143.52 commission (week before: 60 clicks, 5 sales, 119.60 commission)", "- Amazon Associates (report uploaded 2026-11-16, 1 of 7 days): 3 items shipped, 50.00 revenue, 2.00 earnings", "- Applications waiting: 2 (2 received this week)", "- Evidence questions: 15; chat messages: 41; weekly write-ups: 2", "- Shop taps: 45 this week, 20 the week before (up 125%)"]) assert.ok(plain.text.includes(line), line);
  assert.match(plain.text, /No AI summary this week: this is the plain template with the same numbers\./);
  const ai = composeReport(t, "New accounts doubled to 2.\n\nShop taps rose from 20 to 45.");
  assert.equal(ai.writer, "claude");
  assert.ok(ai.text.includes("New accounts doubled to 2.") && ai.text.includes(numbersText(t)), "the summary sits above the same numbers");
  assert.match(ai.text, /written by Claude \(Anthropic\) from the numbers below it/);
  assert.match(numbersText(buildTotals({ ...SRC(), taps: [], impact: { configured: false, missing: ["IMPACT_ACCOUNT_SID", "IMPACT_AUTH_TOKEN"] }, amazon: null, accounts: [] })), /Impact: not connected \(IMPACT_ACCOUNT_SID, IMPACT_AUTH_TOKEN not set on the server\)\.[\s\S]*Amazon Associates: no report uploaded\.[\s\S]*Nothing moved more than 30%\./);
});

test("cleanSummary and cleanRecipients", () => {
  assert.equal(cleanSummary("  Two new accounts this week.\r\n\r\n\r\nTaps rose.  "), "Two new accounts this week.\n\nTaps rose.");
  for (const bad of [null, 7, "", "short", "x".repeat(2501), "See https://evil.example for more details now", "Write to ceo@brand.example for details please"]) assert.equal(cleanSummary(bad), "", String(bad).slice(0, 30));
  const tools = { isEmail: accounts.isEmail, normEmail: accounts.normEmail };
  assert.deepEqual(cleanRecipients(" A@x.example, b@x.example;a@x.example\n", tools), { value: ["a@x.example", "b@x.example"] });
  assert.ok(cleanRecipients("", tools).error); assert.ok(cleanRecipients("not-an-address", tools).error);
  assert.ok(cleanRecipients(Array.from({ length: 11 }, (_, i) => `p${i}@x.example`), tools).error);
  assert.match(WEEKLY_SYSTEM, /use only the numbers in the JSON/);
  assert.ok(weeklyPrompt({ a: 1 }).includes('{"a":1}'));
});

test("writeText (ai module): effort low, no thinking parameter, the server-side refusal fallback; refusal and truncation are errors", async () => {
  const seen = [];
  const client = (resp) => ({ beta: { messages: { create: async (params, opts) => { seen.push({ params, opts }); if (resp instanceof Error) throw resp; return resp; } } } });
  const out = await writeText(client({ stop_reason: "end_turn", content: [{ type: "thinking", thinking: "" }, { type: "text", text: "Hello " }, { type: "text", text: "there." }] }), "claude-opus-5-5", { system: "S", prompt: "P", maxTokens: 4000, timeoutMs: 60_000 });
  assert.equal(out, "Hello there.");
  const { params, opts } = seen[0];
  assert.equal(params.model, "claude-opus-5-5"); assert.equal(params.max_tokens, 4000); assert.equal(params.system, "S");
  assert.deepEqual(params.output_config, { effort: "low" });
  assert.equal("thinking" in params, false, "no thinking parameter (never thinking: disabled)");
  assert.deepEqual(params.betas, ["server-side-fallback-2026-07-01"]); assert.equal(params.fallbacks, "default");
  assert.deepEqual(params.messages, [{ role: "user", content: "P" }]);
  assert.deepEqual(opts, { timeout: 60_000 });
  await assert.rejects(writeText(client({ stop_reason: "refusal", stop_details: { category: "cyber" }, content: [] }), "m", { system: "S", prompt: "P" }), (e) => e.cat === "model declined (cyber)");
  await assert.rejects(writeText(client({ stop_reason: "max_tokens", usage: { output_tokens: 4000 }, content: [{ type: "text", text: "cut" }] }), "m", { system: "S", prompt: "P" }), (e) => /truncated/.test(e.cat));
  await assert.rejects(writeText(client(Object.assign(new Error("boom"), { status: 500 })), "m", { system: "S", prompt: "P" }), (e) => typeof e.cat === "string" && e.cat.length > 0);
});

/* ---------- the routes and the schedule, in process ---------- */
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "insights-weekly-test-"));
process.on("exit", () => fs.rmSync(dir, { recursive: true, force: true }));
let now = MON - 2 * DAY; // Saturday
const inbox = [], sent = [];
let mailFails = false;
const portalMailer = { ready: true, async send(to, subject, text) { inbox.push({ to, subject, text }); } };
const reportMailer = { ready: true, async send(to, subject, text) { if (mailFails) throw Object.assign(new Error("send"), { cat: "email provider answered 500" }); sent.push({ to, subject, text }); } };
const store = new JsonStore(dir);
const fast = 1000;
const mkCtx = () => ({ config: { authSecret: SECRET, production: true, baseUrl: "https://api.solia.example", accounts: { startPerMinute: fast, verifyPerMinute: fast, perMinute: fast, codesPerAddress: fast }, shop: { startPerMinute: fast, verifyPerMinute: fast, writePerMinute: fast, readPerMinute: fast, codesPerAddress: fast, tapPerMinute: fast }, insights: { readPerMinute: fast, writePerMinute: fast, sendPerMinute: fast } }, store, onShutdown: [] });
const ctx = mkCtx();
const aiCalls = [];
let aiMode = "ok"; // "ok" | "error" | "junk" | "none"
const aiWrite = async (args) => { aiCalls.push(args); if (aiMode === "error") throw Object.assign(new Error("x"), { cat: "API 529" }); if (aiMode === "junk") return "ok"; return "Two accounts were made this week and the Shop was opened three times.\n\nNothing else stands out."; };
const rcOff = { configured: false, missing: ["REVENUECAT_SECRET_KEY", "REVENUECAT_PROJECT_ID"] };
const imOff = { configured: false, missing: ["IMPACT_ACCOUNT_SID", "IMPACT_AUTH_TOKEN"], campaigns: async () => [], performance: async () => [] };
const mountAll = (c, app) => { for (const [mod, opts] of [[accounts, { clock: () => now, sweepMs: 0, sender: { ready: true, dev: false, async send() {} } }], [shop, { clock: () => now, sweepMs: 0, mailer: portalMailer, owners: ["owner@solia.example", "second@solia.example"], tapFlushMs: 0 }], [insights, { clock: () => now, rc: rcOff, impact: imOff, mailer: reportMailer, timerMs: 0 }]]) { const r = express.Router(); mod.mount(r, c, opts); app.use(mod.basePath, r); } };
const app = express(); app.use(express.json());
mountAll(ctx, app);
ctx.aiWrite = aiWrite; // what the ai module sets when ANTHROPIC_API_KEY is there
const srv = await new Promise((r) => { const s = app.listen(0, "127.0.0.1", () => r(s)); });
const B = `http://127.0.0.1:${srv.address().port}`;
const req = (method, p, body, token) => fetch(`${B}${p}`, { method, headers: { ...(body !== undefined ? { "content-type": "application/json" } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
async function portalSignIn(email) {
  await req("POST", "/api/shop/auth/start", { email });
  const code = /(\d{6})/.exec(inbox.filter((m) => m.to === email && /code/.test(m.subject)).at(-1)?.subject || "")?.[1];
  return (await (await req("POST", "/api/shop/auth/verify", { email, code })).json()).token;
}
const stateRow = () => JSON.parse(fs.readFileSync(path.join(dir, "insights_weekly.json"), "utf8"))[0];
const logs = [];
const orig = { log: console.log, warn: console.warn };
let owner;

test("settings: on by default, to the owners; an owner can change both; validation", async () => {
  await ctx.shopReady;
  console.log = (...a) => logs.push(a.join(" ")); console.warn = (...a) => logs.push(a.join(" "));
  // something to report on: two accounts and three taps in the week of 2026-11-09
  now = Date.UTC(2026, 10, 10, 9);
  for (const id of ["oura", "oura", "mira"]) await req("POST", "/api/shop/tap", { productId: id });
  await store.insert("accounts", { id: "acct_aaaaaaaaaaaaaaaaaaaa", provider: "email", key: "k1", email: "maya@x.example", name: "", createdAt: "2026-11-10T09:00:00.000Z", lastSeenDay: "2026-11-14" });
  await store.insert("accounts", { id: "acct_bbbbbbbbbbbbbbbbbbbb", provider: "apple", key: "k2", email: "noor@x.example", name: "Noor", createdAt: "2026-11-11T09:00:00.000Z", lastSeenDay: "2026-11-11" });
  await store.insert("ai_usage", { id: "acct_aaaaaaaaaaaaaaaaaaaa:2026-11", evidence: 4, chat: 9, weekly: 1 });
  now = MON - 2 * DAY;
  owner = await portalSignIn("owner@solia.example");
  const s = await (await req("GET", "/api/insights/weekly", undefined, owner)).json();
  assert.deepEqual([s.enabled, s.recipients, s.usingOwners, s.lastSentAt, s.nextAt, s.email, s.ai], [true, ["owner@solia.example", "second@solia.example"], true, null, "2026-11-16T14:00:00.000Z", "ready", true]);
  assert.deepEqual([s.nextWeek, s.week, s.dueNow], [{ from: "2026-11-09", to: "2026-11-15" }, { from: "2026-11-02", to: "2026-11-08" }, false], "Saturday: Monday's report covers this week; last Monday's slot is past its grace");
  assert.equal((await req("PUT", "/api/insights/weekly", { recipients: "not an address" }, owner)).status, 400);
  assert.equal((await req("PUT", "/api/insights/weekly", { enabled: "yes" }, owner)).status, 400);
  assert.equal((await req("PUT", "/api/insights/weekly", { cron: "* * * * *" }, owner)).status, 400);
  assert.equal((await req("PUT", "/api/insights/weekly", { recipients: Array.from({ length: 11 }, (_, i) => `p${i}@x.example`) }, owner)).status, 400);
  const put = await (await req("PUT", "/api/insights/weekly", { recipients: "Owner@solia.example, cfo@solia.example" }, owner)).json();
  assert.deepEqual([put.recipients, put.usingOwners], [["owner@solia.example", "cfo@solia.example"], false]);
});

test("preview: exactly what would be sent, written by Claude from the totals JSON only", async () => {
  const p = await (await req("POST", "/api/insights/weekly/preview", {}, owner)).json();
  assert.equal(p.subject, "Solia Health weekly report: 2026-11-02 to 2026-11-08", "on Saturday the latest complete week is the one before");
  now = MON + HOUR;
  owner = await portalSignIn("owner@solia.example");
  const q = await (await req("POST", "/api/insights/weekly/preview", {}, owner)).json();
  assert.equal(q.subject, "Solia Health weekly report: 2026-11-09 to 2026-11-15");
  assert.equal(q.writer, "claude"); assert.equal(q.why, null);
  assert.ok(q.text.includes("Two accounts were made this week") && q.text.includes("- Accounts: 2 in all; 2 new this week (0 the week before)") && q.text.includes("- Product taps: 3 (0 the week before)") && q.text.includes("1. Oura Ring (Oura): 2") && q.text.includes("- Evidence questions: 4; chat messages: 9; weekly write-ups: 1"));
  assert.ok(q.text.includes("- Not connected (REVENUECAT_SECRET_KEY, REVENUECAT_PROJECT_ID not set on the server).") && q.text.includes("Totals only; no personal or health data."));
  assert.deepEqual(q.recipients, ["owner@solia.example", "cfo@solia.example"]);
  // what Claude was given: the system prompt and the totals JSON, nothing that names anyone
  const call = aiCalls.at(-1);
  assert.equal(call.system, WEEKLY_SYSTEM); assert.equal(call.maxTokens, 4000);
  const given = JSON.parse(call.prompt.slice(call.prompt.indexOf("{"), call.prompt.lastIndexOf("}") + 1));
  assert.deepEqual(given.people, { total: 2, newThisWeek: 2, newWeekBefore: 0, activeSinceWeekStart: 2, activeLast30Days: 2, bySignIn: { apple: 1, google: 0, facebook: 0, email: 1 } });
  assert.doesNotMatch(call.prompt, /@|acct_|maya|noor|Noor/i);
  assert.deepEqual([...keysOf(given)].filter((k) => !ALLOWED.has(k)), []);
  assert.doesNotMatch(q.text, /maya|noor|acct_|x\.example/i);
  assert.equal(sent.length, 0, "a preview sends nothing");
});

test("the schedule: sent once on Monday 14:00 UTC, never twice, not even after a restart", async () => {
  now = MON - HOUR;
  // last week's slot is still inside its grace? No: Monday 13:00 is 6 days 23 hours after it.
  assert.equal(await ctx.insightsWeeklyTick(), null);
  assert.equal(sent.length, 0);
  now = MON + 60_000;
  const r = await ctx.insightsWeeklyTick();
  assert.deepEqual([r.ok, r.sent, r.failed], [true, 2, 0]);
  assert.deepEqual(sent.map((m) => m.to), ["owner@solia.example", "cfo@solia.example"], "one email per recipient");
  assert.equal(sent[0].subject, "Solia Health weekly report: 2026-11-09 to 2026-11-15");
  assert.ok(sent[0].text.includes("Totals only; no personal or health data."));
  assert.equal(stateRow().lastSlot, "2026-11-16T14:00:00.000Z");
  assert.equal(stateRow().lastResult.scheduled, true);
  for (let i = 0; i < 5; i++) { now += HOUR; assert.equal(await ctx.insightsWeeklyTick(), null); }
  assert.equal(sent.length, 2, "the hourly check sends nothing more this week");
  // a restart: a second server on the same DATA_DIR reads the stamp
  const c2 = mkCtx(); c2.store = new JsonStore(dir);
  mountAll(c2, express());
  await c2.shopReady;
  assert.equal(await c2.insightsWeeklyTick(), null);
  assert.equal(sent.length, 2, "the restarted server doesn't send the week again");
  for (const fn of c2.onShutdown) await fn();
  now = MON + 7 * DAY + 5 * 60_000; // the next Monday
  assert.equal((await ctx.insightsWeeklyTick()).sent, 2);
  assert.equal(sent.at(-1).subject, "Solia Health weekly report: 2026-11-16 to 2026-11-22");
  assert.equal(sent.length, 4);
});

test("a crash between the stamp and the email skips the week rather than sending it twice", async () => {
  now = MON + 14 * DAY + 60_000;
  mailFails = true;
  const r = await ctx.insightsWeeklyTick();
  assert.deepEqual([r.ok, r.sent, r.failed, r.error], [false, 0, 2, "email provider answered 500"]);
  mailFails = false;
  now += HOUR;
  assert.equal(await ctx.insightsWeeklyTick(), null, "the slot was claimed before the send: no second attempt");
  assert.equal(sent.length, 4);
  assert.equal(stateRow().lastResult.ok, false);
});

test("off: nothing is sent on Monday; Send now still works and sends the previewed text", async () => {
  now = MON + 21 * DAY + 60_000;
  owner = await portalSignIn("owner@solia.example");
  assert.equal((await (await req("PUT", "/api/insights/weekly", { enabled: false, recipients: null }, owner)).json()).nextAt, null);
  assert.equal(await ctx.insightsWeeklyTick(), null);
  assert.equal(sent.length, 4);
  const p = await (await req("POST", "/api/insights/weekly/preview", {}, owner)).json();
  aiMode = "error"; // the send must not ask the AI again: it sends the draft that was read
  const n = aiCalls.length;
  const s = await req("POST", "/api/insights/weekly/send", { previewId: p.id }, owner);
  assert.equal(s.status, 200);
  assert.deepEqual(await s.json().then((j) => [j.sent, j.writer, j.recipients]), [2, "claude", 2]);
  assert.equal(aiCalls.length, n);
  assert.deepEqual(sent.slice(-2).map((m) => [m.to, m.text === p.text, m.subject === p.subject]), [["owner@solia.example", true, true], ["second@solia.example", true, true]], "back to the owners; the text is the previewed text");
  assert.equal((await req("POST", "/api/insights/weekly/send", { previewId: p.id }, owner)).status, 409, "a sent draft is gone");
  assert.equal((await req("POST", "/api/insights/weekly/send", { previewId: "nope" }, owner)).status, 409);
  assert.equal(stateRow().lastSlot, "2026-11-30T14:00:00.000Z", "Send now never moves the schedule's stamp");
});

test("template fallback: an API error, an unusable answer, or no key → the plain template with the same numbers", async () => {
  aiMode = "error";
  const a = await (await req("POST", "/api/insights/weekly/preview", {}, owner)).json();
  assert.deepEqual([a.writer, a.why], ["template", "API 529"]);
  assert.match(a.text, /No AI summary this week: this is the plain template with the same numbers\./);
  assert.ok(a.text.includes("- Accounts: 2 in all") && a.text.includes("Totals only; no personal or health data."));
  aiMode = "junk";
  assert.deepEqual(await (await req("POST", "/api/insights/weekly/preview", {}, owner)).json().then((j) => [j.writer, j.why]), ["template", "the AI's answer couldn't be used"]);
  ctx.aiWrite = undefined; // no ANTHROPIC_API_KEY: the ai module sets nothing
  const c = await (await req("POST", "/api/insights/weekly/preview", {}, owner)).json();
  assert.deepEqual([c.writer, c.why], ["template", "ANTHROPIC_API_KEY isn't set on the server"]);
  assert.equal((await (await req("GET", "/api/insights/weekly", undefined, owner)).json()).ai, false);
  const s = await (await req("POST", "/api/insights/weekly/send", {}, owner)).json();
  assert.equal(s.writer, "template");
  assert.match(sent.at(-1).text, /plain template/);
  ctx.aiWrite = aiWrite; aiMode = "ok";
});

test("owner only: a partner gets 403 on every weekly route; no sign-in is 401", async () => {
  assert.equal((await req("POST", "/api/shop/invites", { email: "pat@oura.example", brandIds: ["oura"] }, owner)).status, 201);
  const partner = await portalSignIn("pat@oura.example");
  for (const [m, p] of [["GET", "/api/insights/weekly"], ["PUT", "/api/insights/weekly"], ["POST", "/api/insights/weekly/preview"], ["POST", "/api/insights/weekly/send"]]) {
    assert.equal((await req(m, p, m === "GET" ? undefined : {}, partner)).status, 403, `${m} ${p}`);
    assert.equal((await req(m, p, m === "GET" ? undefined : {})).status, 401, `${m} ${p} without a sign-in`);
  }
});

test("log and disk: no address and no report text in the log; the state holds only settings and results", () => {
  console.log = orig.log; console.warn = orig.warn;
  const all = logs.join("\n");
  assert.doesNotMatch(all, /@solia\.example|@x\.example|Accounts: 2 in all|Two accounts were made/);
  assert.ok(/weekly report: 2 of 2 not sent \(email provider answered 500\)/.test(all));
  assert.deepEqual(Object.keys(stateRow()).sort(), ["enabled", "key", "lastResult", "lastSentAt", "lastSlot", "recipients"]);
});

test("close", async () => { srv.close(); for (const fn of ctx.onShutdown) await fn(); });
