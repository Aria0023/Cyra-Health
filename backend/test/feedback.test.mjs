// Unit tests for feedback (docs/plans/launch-tools.md Task 3): the payload whitelist (unknown fields are dropped, never
// stored), an email only with her consent and only her own, 365 days kept, deleted with the account when linked, the
// owners' inbox (owner only), nothing in the log, and the weekly report gets a count and never the text.
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
import * as feedback from "../src/modules/feedback/index.js";
import { validateFeedback, cleanMessage, keepSince, FEEDBACK_MAX } from "../src/modules/feedback/index.js";
import { buildTotals, numbersText, weekOf, weeklyPrompt } from "../src/modules/insights/weekly.js";

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 10, 19, 9, 30);

test("validateFeedback: the whitelist, the length cap and the reply rule", () => {
  const ok = validateFeedback({ kind: "problem", message: "  The chart\r\nis blank\u0007  ", build: "BUILD 2026.10.07-D", platform: "ios", language: "en", stage: "ttc", deviceId: "d-1", log: [{ day: "2026-11-01" }], email: "maya@x.example", accountId: "acct_1" });
  assert.deepEqual(ok.value, { kind: "problem", message: "The chart\nis blank", build: "BUILD 2026.10.07-D", platform: "ios", language: "en", reply: false, email: "" }, "no reply: the email in the body is dropped with every unknown field");
  assert.deepEqual(Object.keys(ok.value), ["kind", "message", "build", "platform", "language", "reply", "email"]);
  assert.equal(validateFeedback({ kind: "feedback", message: "x", reply: true, email: " Maya@X.example " }).value.email, "maya@x.example");
  for (const bad of [null, [], { kind: "rant", message: "x" }, { kind: "feedback" }, { kind: "feedback", message: 5 }, { kind: "feedback", message: "   " }, { kind: "feedback", message: "x".repeat(FEEDBACK_MAX + 1) }, { kind: "feedback", message: "x", reply: true }, { kind: "feedback", message: "x", reply: true, email: "nope" }]) assert.ok(validateFeedback(bad).error, JSON.stringify(bad)?.slice(0, 60));
  assert.equal(validateFeedback({ kind: "feedback", message: "x".repeat(FEEDBACK_MAX) }).value.message.length, FEEDBACK_MAX);
  assert.deepEqual([validateFeedback({ kind: "feedback", message: "x", platform: "windows", language: "<script>", build: "b".repeat(90) }).value].map((v) => [v.platform, v.language, v.build.length]), [["web", "en", 40]]);
  assert.equal(validateFeedback({ kind: "feedback", message: "x", reply: "true", email: "a@b.example" }).value.reply, false, "reply must be exactly true");
  assert.equal(cleanMessage(7), "");
  assert.equal(keepSince(T0), "2025-11-19");
});

test("the weekly report gets counts only, never the text", () => {
  const week = weekOf(Date.UTC(2026, 10, 16, 14));
  const t = buildTotals({ week, nowMs: Date.UTC(2026, 10, 16, 14), feedback: [{ status: "open", day: "2026-11-10", message: "SECRETTEXT" }, { status: "handled", day: "2026-11-11" }, { status: "open", day: "2026-10-01" }] });
  assert.deepEqual(t.feedback, { open: 2, receivedThisWeek: 2 });
  assert.ok(numbersText(t).includes("FEEDBACK FROM THE APP (counts only; read it in the portal)\n- Open: 2 (2 received this week)"));
  assert.doesNotMatch(weeklyPrompt(t) + numbersText(t), /SECRETTEXT/);
});

/* ---------- the routes, in process ---------- */
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "feedback-test-"));
process.on("exit", () => fs.rmSync(dir, { recursive: true, force: true }));
let now = T0;
const inbox = [], appCodes = [], aiCalls = [];
const mailer = { ready: true, async send(to, subject, text) { inbox.push({ to, subject, text }); } };
const sender = { ready: true, dev: false, async send(to, code) { appCodes.push({ to, code }); } };
const store = new JsonStore(dir);
const fast = 1000;
const ctx = { config: { authSecret: "unit-test-secret-1234567890", production: true, modules: [], baseUrl: "https://api.solia.example", accounts: { startPerMinute: fast, verifyPerMinute: fast, perMinute: fast, codesPerAddress: fast }, shop: { startPerMinute: fast, verifyPerMinute: fast, writePerMinute: fast, readPerMinute: fast, codesPerAddress: fast }, insights: { readPerMinute: fast, writePerMinute: fast, sendPerMinute: fast }, feedback: { perMinute: 8, globalPerMinute: fast } }, store, onShutdown: [] };
const off = { configured: false, missing: [], campaigns: async () => [], performance: async () => [] };
const app = express(); app.use(express.json());
for (const [mod, opts] of [[accounts, { clock: () => now, sweepMs: 0, sender }], [shop, { clock: () => now, sweepMs: 0, mailer, owners: ["owner@solia.example"], tapFlushMs: 0 }], [insights, { clock: () => now, mailer, timerMs: 0, env: {}, rc: off, impact: off }], [feedback, { clock: () => now, sweepMs: 0 }]]) {
  const r = express.Router(); mod.mount(r, ctx, opts); app.use(mod.basePath, r);
}
ctx.aiWrite = async (a) => { aiCalls.push(a); return "Two accounts were made this week and feedback is waiting to be read in the portal."; };
const srv = await new Promise((r) => { const s = app.listen(0, "127.0.0.1", () => r(s)); });
const B = `http://127.0.0.1:${srv.address().port}`;
const req = (method, p, body, token) => fetch(`${B}${p}`, { method, headers: { ...(body !== undefined ? { "content-type": "application/json" } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
async function portalSignIn(email) {
  await req("POST", "/api/shop/auth/start", { email });
  const code = /(\d{6})/.exec(inbox.filter((m) => m.to === email && /code/.test(m.subject)).at(-1)?.subject || "")?.[1];
  return (await (await req("POST", "/api/shop/auth/verify", { email, code })).json()).token;
}
async function appSignIn(email) {
  await req("POST", "/api/accounts/email/start", { email });
  return (await req("POST", "/api/accounts/email/verify", { email, code: appCodes.filter((c) => c.to === email).at(-1).code })).json();
}
const disk = () => JSON.parse(fs.readFileSync(path.join(dir, "feedback.json"), "utf8"));
const logs = [];
const orig = { log: console.log, warn: console.warn };
const base = { build: "BUILD 2026.10.07-D", platform: "web", language: "en" };
let maya, owner;

test("POST /api/feedback: stored with the day it arrived; unknown fields dropped; anonymous unless she chose reply", async () => {
  await ctx.shopReady;
  console.log = (...a) => logs.push(a.join(" ")); console.warn = (...a) => logs.push(a.join(" "));
  maya = await appSignIn("maya@x.example");
  // anonymous, even though a valid session token rides along and the body tries to add things
  let r = await req("POST", "/api/feedback", { kind: "feedback", message: "Love the calendar SECRETTEXT1", ...base, email: "maya@x.example", stage: "ttc", deviceId: "dev-9", days: [{ flow: 3 }], accountId: maya.account.id }, maya.token);
  assert.equal(r.status, 201); assert.deepEqual(await r.json(), { ok: true }); assert.equal(r.headers.get("cache-control"), "no-store");
  assert.deepEqual(Object.keys(disk()[0]), ["id", "day", "kind", "message", "build", "platform", "language", "status", "handledDay"]);
  assert.deepEqual({ ...disk()[0], id: null }, { id: null, day: "2026-11-19", kind: "feedback", message: "Love the calendar SECRETTEXT1", build: "BUILD 2026.10.07-D", platform: "web", language: "en", status: "open", handledDay: null });
  assert.doesNotMatch(JSON.stringify(disk()), /maya|x\.example|ttc|dev-9|flow|T09:30/, "no email, account, stage, device or time of day");
  // reply: needs her session, and the email kept is her account's
  assert.equal((await req("POST", "/api/feedback", { kind: "problem", message: "It crashed", ...base, reply: true, email: "maya@x.example" })).status, 401, "reply without a session");
  assert.equal((await req("POST", "/api/feedback", { kind: "problem", message: "It crashed", ...base, reply: true, email: "someone@else.example" }, maya.token)).status, 400, "not her own address");
  assert.equal(disk().length, 1, "nothing was stored for the refused ones");
  r = await req("POST", "/api/feedback", { kind: "problem", message: "It crashed SECRETTEXT2", ...base, platform: "ios", reply: true, email: "Maya@x.example" }, maya.token);
  assert.equal(r.status, 201);
  assert.deepEqual({ ...disk()[1], id: null }, { id: null, day: "2026-11-19", kind: "problem", message: "It crashed SECRETTEXT2", build: "BUILD 2026.10.07-D", platform: "ios", language: "en", status: "open", handledDay: null, reply: true, email: "maya@x.example", accountId: maya.account.id });
  for (const bad of [{ kind: "feedback", message: "" }, { kind: "x", message: "y" }, { kind: "feedback", message: "x".repeat(2001) }, "just text"]) assert.equal((await req("POST", "/api/feedback", bad)).status, 400);
  assert.equal(disk().length, 2);
});

test("the rate limit: per address, in memory", async () => {
  let last = 201, n = 0;
  for (let i = 0; i < 12 && last !== 429; i++) { last = (await req("POST", "/api/feedback", { kind: "feedback", message: `filler ${i}`, ...base })).status; if (last === 201) n++; }
  assert.equal(last, 429); assert.ok(n >= 1 && n <= 8);
  await store.remove("feedback", (r) => r.message.startsWith("filler"));
  assert.equal(disk().length, 2);
});

test("the owners' inbox: newest first, filters, mark handled, delete; owner only; a count for the Overview", async () => {
  owner = await portalSignIn("owner@solia.example");
  await req("POST", "/api/shop/invites", { email: "pat@oura.example", brandIds: ["oura"] }, owner);
  const partner = await portalSignIn("pat@oura.example");
  const id0 = disk()[0].id, id1 = disk()[1].id;
  for (const [m, p, b] of [["GET", "/api/feedback"], ["GET", "/api/feedback/count"], ["PATCH", `/api/feedback/${id0}`, { status: "handled" }], ["DELETE", `/api/feedback/${id0}`]]) {
    assert.equal((await req(m, p, b, partner)).status, 403, `${m} ${p} partner`); assert.equal((await req(m, p, b)).status, 401, `${m} ${p} nobody`); assert.equal((await req(m, p, b, maya.token)).status, 401, `${m} ${p} an app session is not a portal session`);
  }
  const all = await (await req("GET", "/api/feedback", undefined, owner)).json();
  assert.deepEqual([all.open, all.total, all.keptDays], [2, 2, 365]);
  assert.deepEqual(all.items.map((i) => [i.id, i.kind, i.reply, i.email]), [[id1, "problem", true, "maya@x.example"], [id0, "feedback", false, null]], "newest first; an email only where she allowed a reply");
  assert.ok(!("accountId" in all.items[0]), "the account id is not shown");
  assert.deepEqual((await (await req("GET", "/api/feedback?kind=feedback", undefined, owner)).json()).items.map((i) => i.id), [id0]);
  assert.equal((await req("PATCH", `/api/feedback/${id0}`, { status: "done" }, owner)).status, 400);
  assert.equal((await req("PATCH", "/api/feedback/nope", { status: "handled" }, owner)).status, 404);
  const h = await (await req("PATCH", `/api/feedback/${id0}`, { status: "handled" }, owner)).json();
  assert.deepEqual([h.item.status, h.item.handledDay], ["handled", "2026-11-19"]);
  assert.deepEqual((await (await req("GET", "/api/feedback?status=open", undefined, owner)).json()).items.map((i) => i.id), [id1]);
  assert.deepEqual((await (await req("GET", "/api/feedback?status=handled", undefined, owner)).json()).items.map((i) => i.id), [id0]);
  assert.deepEqual(await (await req("GET", "/api/feedback/count", undefined, owner)).json(), { open: 1, total: 2 });
  assert.equal((await (await req("PATCH", `/api/feedback/${id0}`, { status: "open" }, owner)).json()).item.handledDay, null);
  // the audit says what was done, never the text
  const audit = fs.readFileSync(path.join(dir, "shop_audit.json"), "utf8");
  assert.match(audit, /feedback handled/); assert.doesNotMatch(audit, /SECRETTEXT/);
});

test("the weekly report: the open count is in it; the text is never given to the AI or put in the email", async () => {
  const p = await (await req("POST", "/api/insights/weekly/preview", {}, owner)).json();
  assert.ok(p.text.includes("- Open: 2 (0 received this week)"), "the preview is for the last complete week");
  assert.equal(aiCalls.length, 1);
  assert.doesNotMatch(aiCalls[0].prompt + aiCalls[0].system + p.text, /SECRETTEXT|maya|It crashed|Love the calendar/);
  assert.match(aiCalls[0].prompt, /"feedback":\{"open":2,"receivedThisWeek":0\}/);
});

test("retention and the account: 365 days, then gone; linked feedback goes with the account, anonymous feedback stays", async () => {
  await store.insert("feedback", { id: "old-one", day: "2025-11-18", kind: "feedback", message: "366 days old", build: "", platform: "web", language: "en", status: "open", handledDay: null });
  await store.insert("feedback", { id: "edge-one", day: "2025-11-19", kind: "feedback", message: "365 days old", build: "", platform: "web", language: "en", status: "open", handledDay: null });
  await ctx.feedbackPrune();
  assert.deepEqual(disk().map((r) => r.id).filter((id) => id.includes("-one")), ["edge-one"]);
  now = T0 + DAY;
  owner = await portalSignIn("owner@solia.example");
  assert.ok(!(await (await req("GET", "/api/feedback", undefined, owner)).json()).items.some((i) => i.id === "edge-one"), "a day later the 365-day-old one is gone, on a read");
  assert.equal(disk().length, 2);
  // delete the account: the linked one goes, the anonymous one stays
  assert.equal((await req("DELETE", "/api/accounts/me", undefined, maya.token)).status, 204);
  for (let i = 0; i < 100 && disk().length > 1; i++) await new Promise((r) => setTimeout(r, 10));
  assert.deepEqual(disk().map((r) => [r.kind, r.reply === true]), [["feedback", false]]);
  assert.doesNotMatch(JSON.stringify(disk()), /maya/);
});

test("nothing she wrote, and no address, is in the log", () => {
  console.log = orig.log; console.warn = orig.warn;
  assert.doesNotMatch(logs.join("\n"), /SECRETTEXT|It crashed|Love the calendar|maya@x\.example|filler/);
});

test.after(async () => { console.log = orig.log; console.warn = orig.warn; for (const fn of ctx.onShutdown) await fn(); srv.close(); });
