// Unit tests for the account and sign-in totals (docs/plans/tracking-reports.md Task 2): the accounts module notes a
// coarse lastSeenDay (a UTC date, at most one write a day, on sign-in or GET /me; no time, no address), and the portal's
// GET /api/insights/people answers COUNTS only, to owners only. In process: accounts + shop + insights on one Express
// app, an injected clock, capturing mailers; the store is a JsonStore in a temp directory.
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
import { peopleStats, sinceDay } from "../src/modules/insights/people.js";

const SECRET = "unit-test-secret-1234567890";
const DAY = 86_400_000;
const T0 = Date.UTC(2026, 10, 19, 9, 30);

test("peopleStats: counts by window and sign-in method; nothing that names anyone", () => {
  const rows = [
    { id: "a1", provider: "apple", email: "a@x.example", name: "Ana", createdAt: "2026-11-19T08:00:00.000Z", lastSeenDay: "2026-11-19" },
    { id: "a2", provider: "google", email: "b@x.example", createdAt: "2026-11-14T08:00:00.000Z", lastSeenDay: "2026-11-15" },
    { id: "a3", provider: "email", email: "c@x.example", createdAt: "2026-11-08T08:00:00.000Z", lastSeenDay: "2026-11-09" },
    { id: "a4", provider: "email", email: "d@x.example", createdAt: "2026-10-25T08:00:00.000Z", lastSeenDay: "2026-10-25" },
    { id: "a5", provider: "facebook", email: "", createdAt: "2026-09-01T08:00:00.000Z" },
    { id: "a6", provider: "myspace", createdAt: "not a date", lastSeenDay: "2099-01-01" },
  ];
  const s = peopleStats(rows, T0);
  assert.equal(s.total, 6);
  assert.deepEqual(s.byProvider, { apple: 1, google: 1, facebook: 1, email: 2 });
  assert.deepEqual([s.new7, s.newPrev7, s.new30], [2, 1, 4]);
  assert.deepEqual([s.active1, s.active7, s.activePrev7, s.active30], [1, 2, 1, 4]);
  assert.equal(s.neverSeen, 2, "no day noted yet, or a day in the future");
  assert.equal(s.newByDay.length, 30);
  assert.deepEqual(s.newByDay.at(-1), { day: "2026-11-19", count: 1 });
  assert.equal(s.newByDay.reduce((n, d) => n + d.count, 0), 4);
  assert.equal(sinceDay(7, T0), "2026-11-13");
  assert.doesNotMatch(JSON.stringify(s), /@|Ana|a1|a2|myspace/);
  assert.equal(peopleStats(null, T0).total, 0);
});

/* ---------- the routes, in process ---------- */
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "insights-people-test-"));
process.on("exit", () => fs.rmSync(dir, { recursive: true, force: true }));
let now = T0;
const inbox = [], appCodes = [];
const mailer = { ready: true, async send(to, subject, text) { inbox.push({ to, subject, text }); } };
const sender = { ready: true, dev: false, async send(to, code) { appCodes.push({ to, code }); } };
const store = new JsonStore(dir);
const fast = 1000;
const ctx = { config: { authSecret: SECRET, production: true, baseUrl: "https://api.solia.example", accounts: { startPerMinute: fast, verifyPerMinute: fast, perMinute: fast, codesPerAddress: fast }, shop: { startPerMinute: fast, verifyPerMinute: fast, writePerMinute: fast, readPerMinute: fast, codesPerAddress: fast }, insights: { readPerMinute: fast } }, store, onShutdown: [] };
const app = express(); app.use(express.json());
for (const [mod, opts] of [[accounts, { clock: () => now, sweepMs: 0, sender }], [shop, { clock: () => now, sweepMs: 0, mailer, owners: ["owner@solia.example"], tapFlushMs: 0 }], [insights, { clock: () => now }]]) {
  const r = express.Router(); mod.mount(r, ctx, opts); app.use(mod.basePath, r);
}
const srv = await new Promise((r) => { const s = app.listen(0, "127.0.0.1", () => r(s)); });
const B = `http://127.0.0.1:${srv.address().port}`;
const req = (method, p, body, token, headers = {}) => fetch(`${B}${p}`, { method, headers: { ...(body !== undefined ? { "content-type": "application/json" } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
async function portalSignIn(email) {
  await req("POST", "/api/shop/auth/start", { email });
  const code = /(\d{6})/.exec(inbox.filter((m) => m.to === email && /code/.test(m.subject)).at(-1)?.subject || "")?.[1];
  return (await (await req("POST", "/api/shop/auth/verify", { email, code })).json()).token;
}
async function appSignIn(email) {
  await req("POST", "/api/accounts/email/start", { email });
  return (await req("POST", "/api/accounts/email/verify", { email, code: appCodes.filter((c) => c.to === email).at(-1).code })).json();
}
const acct = (email) => JSON.parse(fs.readFileSync(path.join(dir, "accounts.json"), "utf8")).find((a) => a.email === email);
let maya;

test("accounts: a sign-in notes the day (a UTC date only), and the app never sees it", async () => {
  await ctx.shopReady;
  maya = await appSignIn("maya@x.example");
  const row = acct("maya@x.example");
  assert.equal(row.lastSeenDay, "2026-11-19");
  assert.deepEqual(Object.keys(row).sort(), ["createdAt", "email", "id", "key", "lastSeenDay", "name", "provider"], "nothing else is kept: no address, no time of last use, no device");
  assert.equal(maya.account.lastSeenDay, undefined, "not part of what the app is sent");
});

test("accounts: GET /me moves the day forward at most once a day; other requests don't", async () => {
  const writes = () => fs.statSync(path.join(dir, "accounts.json")).mtimeMs;
  const w0 = writes();
  now += 3 * 3_600_000; // same UTC day
  const me = await req("GET", "/api/accounts/me", undefined, maya.token, { "x-forwarded-for": "203.0.113.7" });
  assert.equal(me.status, 200);
  assert.equal((await me.json()).account.lastSeenDay, undefined);
  assert.equal(writes(), w0, "same day: no write");
  now += DAY; // 2026-11-20
  assert.equal((await req("GET", "/api/accounts/me", undefined, "garbage.token")).status, 401);
  assert.equal(acct("maya@x.example").lastSeenDay, "2026-11-19", "a request that isn't signed in notes nothing");
  assert.equal((await req("GET", "/api/accounts/me", undefined, maya.token)).status, 200);
  assert.equal(acct("maya@x.example").lastSeenDay, "2026-11-20");
  assert.doesNotMatch(fs.readFileSync(path.join(dir, "accounts.json"), "utf8"), /203\.0\.113|T1[0-9]:.*lastSeen|lastSeenAt/);
  now += 2 * DAY; // 2026-11-22: signing out is not "using the account"
  await req("POST", "/api/accounts/sign-out", {}, maya.token);
  assert.equal(acct("maya@x.example").lastSeenDay, "2026-11-20");
});

test("people: owners get counts only — no email, name, id or list of people", async () => {
  await appSignIn("noor@x.example"); // 2026-11-22
  const owner = await portalSignIn("owner@solia.example");
  const r = await req("GET", "/api/insights/people", undefined, owner);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("cache-control"), "no-store");
  const p = await r.json();
  assert.equal(p.asOf, "2026-11-22");
  assert.equal(p.total, 2);
  assert.deepEqual(p.byProvider, { apple: 0, google: 0, facebook: 0, email: 2 });
  assert.deepEqual([p.active1, p.active7, p.active30, p.new7, p.new30], [1, 2, 2, 2, 2]);
  assert.deepEqual(p.newByDay.filter((d) => d.count).map((d) => [d.day, d.count]), [["2026-11-19", 1], ["2026-11-22", 1]]);
  const raw = JSON.stringify(p);
  assert.doesNotMatch(raw, /@|maya|noor/);
  assert.equal(raw.includes(acct("maya@x.example").id), false);
  for (const v of Object.values(p).flatMap((x) => (Array.isArray(x) ? x.flatMap((y) => Object.values(y)) : typeof x === "object" ? Object.values(x) : [x]))) assert.ok(typeof v === "number" || /^\d{4}-\d{2}-\d{2}$/.test(v), `only numbers and dates: ${v}`);
});

test("people: a partner gets 403, an app account's token 401, no sign-in 401", async () => {
  const owner = await portalSignIn("owner@solia.example");
  assert.equal((await req("POST", "/api/shop/invites", { email: "pat@oura.example", brandIds: ["oura"] }, owner)).status, 201);
  const partner = await portalSignIn("pat@oura.example");
  assert.equal((await req("GET", "/api/insights/people", undefined, partner)).status, 403);
  const noor = await appSignIn("noor@x.example");
  assert.equal((await req("GET", "/api/insights/people", undefined, noor.token)).status, 401, "an app session never opens the portal");
  assert.equal((await req("GET", "/api/insights/people")).status, 401);
});

test("deleting an account removes it from every count", async () => {
  const noor = await appSignIn("noor@x.example");
  assert.equal((await req("DELETE", "/api/accounts/me", undefined, noor.token)).status, 204);
  const owner = await portalSignIn("owner@solia.example");
  assert.equal((await (await req("GET", "/api/insights/people", undefined, owner)).json()).total, 1);
});

test("close", async () => { srv.close(); for (const fn of ctx.onShutdown) await fn(); });
