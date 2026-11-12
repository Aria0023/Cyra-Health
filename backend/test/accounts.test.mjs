// Unit tests for the accounts module (Task 1): code expiry, the attempt limit, single use, tokens, sign-out and delete.
// In-process with an injected clock and a capturing sender; the store is a JsonStore in a temp directory.
// Usage: cd backend && npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import express from "express";
import { JsonStore } from "../src/core/store.js";
import { mount, basePath, codeBook, perAddress, signToken, openToken, accountKeys, isEmail, normEmail, CODE_TTL_MS } from "../src/modules/accounts/index.js";

test("codeBook: a code works once, expires, and locks after five wrong tries", () => {
  let now = 1_000_000;
  const b = codeBook({ clock: () => now, sweepMs: 0 });
  const c = b.issue("a@x.example");
  assert.match(c, /^\d{6}$/);
  assert.equal(b.check("a@x.example", c), "ok");
  assert.equal(b.check("a@x.example", c), "none", "single use");
  const c2 = b.issue("a@x.example");
  now += CODE_TTL_MS + 1;
  assert.equal(b.check("a@x.example", c2), "expired");
  const c3 = b.issue("a@x.example");
  const wrong = c3 === "000000" ? "111111" : "000000";
  for (let i = 0; i < 4; i++) assert.equal(b.check("a@x.example", wrong), "wrong");
  assert.equal(b.check("a@x.example", wrong), "locked", "fifth wrong try drops the code");
  assert.equal(b.check("a@x.example", c3), "none", "the right code no longer works after the lock");
  assert.equal(b.size, 0);
});

test("codeBook: a new code replaces the old one; sweep drops expired codes", () => {
  let now = 0;
  const b = codeBook({ clock: () => now, sweepMs: 0 });
  const old = b.issue("b@x.example");
  const fresh = b.issue("b@x.example");
  if (old !== fresh) assert.equal(b.check("b@x.example", old), "wrong");
  b.issue("c@x.example");
  now += CODE_TTL_MS + 1;
  b.sweep();
  assert.equal(b.size, 0);
});

test("perAddress: three codes per ten minutes for one address", () => {
  let now = 0;
  const ok = perAddress({ clock: () => now });
  assert.deepEqual([ok("a"), ok("a"), ok("a"), ok("a"), ok("b")], [true, true, true, false, true]);
  now += 10 * 60_000 + 1;
  assert.equal(ok("a"), true);
});

test("tokens: signed, expiring, and refused when altered", () => {
  const k = accountKeys("unit-test-secret-1234567890").token;
  const t = signToken({ a: "acct", s: "sess", x: 5000 }, k);
  assert.deepEqual(openToken(t, k, 1000), { a: "acct", s: "sess", x: 5000 });
  assert.equal(openToken(t, k, 6000), null, "expired");
  const [body, sig] = t.split(".");
  const forged = Buffer.from(JSON.stringify({ a: "other", s: "sess", x: 5000 })).toString("base64url");
  assert.equal(openToken(`${forged}.${sig}`, k, 1000), null, "another payload with the old signature");
  assert.equal(openToken(t, accountKeys("another-secret-abcdefghijk").token, 1000), null, "another server's key");
  assert.equal(openToken(`${body}.x`, k, 1000), null);
});

test("emails: normalised and checked", () => {
  assert.equal(normEmail("  Ada@Example.COM "), "ada@example.com");
  assert.ok(isEmail("ada@example.com"));
  for (const bad of ["", "ada", "ada@", "@x.com", "a b@x.com", "ada@localhost", `${"a".repeat(65)}@x.com`]) assert.ok(!isEmail(bad), bad);
});

/* ---------- the routes, in process ---------- */
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "accounts-test-"));
process.on("exit", () => fs.rmSync(dir, { recursive: true, force: true }));
let now = Date.UTC(2026, 10, 12);
const sent = [];
const sender = { ready: true, dev: false, async send(to, code) { sent.push({ to, code }); } };
const store = new JsonStore(dir);
const ctx = { config: { authSecret: "unit-test-secret-1234567890", production: true, accounts: { startPerMinute: 1000, verifyPerMinute: 1000, perMinute: 1000 } }, store, onShutdown: [] };
// a stand-in for the oauth module's handoff: one code → one identity
const handoffs = new Map();
ctx.oauth = { configured: () => ({ apple: true, google: false, facebook: true }), take: (code) => { const h = handoffs.get(code); handoffs.delete(code); return h || null; } };
const app = express(); app.use(express.json());
const router = express.Router(); mount(router, ctx, { clock: () => now, sweepMs: 0, sender }); app.use(basePath, router);
const srv = await new Promise((r) => { const s = app.listen(0, "127.0.0.1", () => r(s)); });
const B = `http://127.0.0.1:${srv.address().port}${basePath}`;
const post = (p, body, token) => fetch(`${B}${p}`, { method: "POST", headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body || {}) });
const get = (p, token) => fetch(`${B}${p}`, { headers: token ? { authorization: `Bearer ${token}` } : {} });
const del = (p, token) => fetch(`${B}${p}`, { method: "DELETE", headers: token ? { authorization: `Bearer ${token}` } : {} });
const rows = (c) => { try { return JSON.parse(fs.readFileSync(path.join(dir, `${c}.json`), "utf8")); } catch { return []; } };

test("config names the providers that work here", async () => {
  assert.deepEqual(await (await get("/config")).json(), { providers: { apple: true, google: false, facebook: true, email: true } });
});

test("email sign-in: code, verify, me, wrong code, expiry", async () => {
  assert.equal((await post("/email/start", { email: "not an email" })).status, 400);
  const r = await post("/email/start", { email: " Ada@Example.com " });
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { sent: true }, "no dev flag, never the code");
  const { to, code } = sent.at(-1);
  assert.equal(to, "ada@example.com");
  const wrong = code === "123456" ? "654321" : "123456";
  const w = await post("/email/verify", { email: "ada@example.com", code: wrong });
  assert.equal(w.status, 401); assert.equal((await w.json()).why, "wrong");
  const ok = await post("/email/verify", { email: "ADA@example.com", code });
  assert.equal(ok.status, 200);
  const { token, account } = await ok.json();
  assert.equal(account.provider, "email"); assert.equal(account.email, "ada@example.com");
  assert.deepEqual(Object.keys(account).sort(), ["createdAt", "email", "id", "name", "provider"]);
  const me = await get("/me", token);
  assert.equal(me.status, 200); assert.equal((await me.json()).account.id, account.id);
  assert.equal((await post("/email/verify", { email: "ada@example.com", code })).status, 401, "the code is single use");
  // expiry
  await post("/email/start", { email: "late@example.com" });
  const late = sent.at(-1).code;
  now += CODE_TTL_MS + 1000;
  const e = await post("/email/verify", { email: "late@example.com", code: late });
  assert.equal(e.status, 401); assert.equal((await e.json()).why, "expired");
  // the same address signs in to the same account again
  await post("/email/start", { email: "ada@example.com" });
  const again = await (await post("/email/verify", { email: "ada@example.com", code: sent.at(-1).code })).json();
  assert.equal(again.account.id, account.id);
  // no health or extra field is ever stored
  for (const a of rows("accounts")) assert.deepEqual(Object.keys(a).sort(), ["createdAt", "email", "id", "key", "name", "provider"]);
});

test("email sign-in: five wrong codes lock the code", async () => {
  await post("/email/start", { email: "lock@example.com" });
  const code = sent.at(-1).code, wrong = code === "000000" ? "999999" : "000000";
  const whys = [];
  for (let i = 0; i < 5; i++) whys.push((await (await post("/email/verify", { email: "lock@example.com", code: wrong })).json()).why);
  assert.deepEqual(whys, ["wrong", "wrong", "wrong", "wrong", "locked"]);
  assert.equal((await post("/email/verify", { email: "lock@example.com", code })).status, 401);
});

test("email sign-in: at most three codes per address in ten minutes", async () => {
  const st = [];
  for (let i = 0; i < 4; i++) st.push((await post("/email/start", { email: "many@example.com" })).status);
  assert.deepEqual(st, [200, 200, 200, 429]);
});

test("provider sign-in: the oauth handoff becomes an account; the same subject finds it again", async () => {
  handoffs.set("c1", { identity: { provider: "apple", email: "relay@privaterelay.appleid.com", emailVerified: true, name: "Ada L" }, subject: "subj-hash-1" });
  const r = await post("/provider", { code: "c1" });
  assert.equal(r.status, 200);
  const { token, account } = await r.json();
  assert.equal(account.provider, "apple"); assert.equal(account.email, "relay@privaterelay.appleid.com"); assert.equal(account.name, "Ada L");
  assert.equal((await post("/provider", { code: "c1" })).status, 404, "a code is single use");
  handoffs.set("c2", { identity: { provider: "apple", email: "", emailVerified: false, name: "" }, subject: "subj-hash-1" });
  const again = await (await post("/provider", { code: "c2" })).json();
  assert.equal(again.account.id, account.id); assert.equal(again.account.name, "Ada L", "an empty name keeps the old one");
  // the raw subject is never stored
  assert.ok(!JSON.stringify(rows("accounts")).includes("subj-hash-1"));
  assert.equal((await get("/me", token)).status, 200);
});

test("sign-out ends only this session; delete removes the record and every session", async () => {
  await post("/email/start", { email: "del@example.com" });
  const a = await (await post("/email/verify", { email: "del@example.com", code: sent.at(-1).code })).json();
  await post("/email/start", { email: "del@example.com" });
  const b = await (await post("/email/verify", { email: "del@example.com", code: sent.at(-1).code })).json();
  assert.equal(a.account.id, b.account.id);
  assert.equal((await post("/sign-out", {}, a.token)).status, 204);
  assert.equal((await get("/me", a.token)).status, 401, "signed out");
  assert.equal((await get("/me", b.token)).status, 200, "the other device stays signed in");
  assert.equal((await del("/me", "garbage")).status, 401);
  assert.equal((await del("/me", b.token)).status, 204);
  assert.equal((await get("/me", b.token)).status, 401);
  assert.ok(!rows("accounts").some((x) => x.id === a.account.id), "account row gone");
  assert.ok(!rows("account_sessions").some((x) => x.accountId === a.account.id), "sessions gone");
  assert.ok(!fs.readFileSync(path.join(dir, "accounts.json"), "utf8").includes("del@example.com"), "the email is gone from disk");
  assert.equal((await post("/sign-out", {}, "garbage")).status, 204, "sign-out is idempotent");
});

test("a production server without an email key reports email off and refuses to start a code", async () => {
  const s2 = new JsonStore(fs.mkdtempSync(path.join(os.tmpdir(), "accounts-test2-")));
  const c2 = { config: { authSecret: "unit-test-secret-1234567890", production: true }, store: s2, onShutdown: [] };
  const old = { k: process.env.RESEND_API_KEY, f: process.env.EMAIL_FROM };
  delete process.env.RESEND_API_KEY; delete process.env.EMAIL_FROM;
  const a2 = express(); a2.use(express.json()); const r2 = express.Router(); mount(r2, c2, { sweepMs: 0 }); a2.use(basePath, r2);
  const s = await new Promise((r) => { const x = a2.listen(0, "127.0.0.1", () => r(x)); });
  try {
    const base = `http://127.0.0.1:${s.address().port}${basePath}`;
    assert.deepEqual((await (await fetch(`${base}/config`)).json()).providers, { apple: false, google: false, facebook: false, email: false });
    assert.equal((await fetch(`${base}/email/start`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "x@example.com" }) })).status, 503);
  } finally {
    s.close(); for (const fn of c2.onShutdown) await fn();
    if (old.k !== undefined) process.env.RESEND_API_KEY = old.k;
    if (old.f !== undefined) process.env.EMAIL_FROM = old.f;
  }
});

test("close", async () => { srv.close(); for (const fn of ctx.onShutdown) await fn(); });
