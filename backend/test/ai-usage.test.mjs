import test from "node:test";
import assert from "node:assert/strict";
import { usageMeter, limitsFrom, resetsOn, monthOf, DEFAULT_MONTHLY } from "../src/modules/ai/usage.js";

function memStore() {
  const c = {};
  const col = (n) => (c[n] ||= []);
  return {
    rows: c,
    async findOne(n, p) { return col(n).find(p) || null; },
    async insert(n, d) { col(n).push({ ...d }); return d; },
    async update(n, p, patch) { let k = 0; for (const r of col(n)) if (p(r)) { Object.assign(r, patch); k++; } return k; },
  };
}
const req = (ip = "1.2.3.4", auth = null) => ({ ip, get: (h) => (h.toLowerCase() === "authorization" ? auth : undefined) });

test("defaults are 30 evidence, 100 chat, 6 weekly; config can override within bounds", () => {
  assert.deepEqual(DEFAULT_MONTHLY, { evidence: 30, chat: 100, weekly: 6 });
  assert.deepEqual(limitsFrom({ evidence: 10, chat: -1, weekly: "x" }), { evidence: 10, chat: 100, weekly: 6 });
});

test("resetsOn is the first day of next UTC month", () => {
  assert.equal(resetsOn(Date.UTC(2026, 10, 15)), "2026-12-01");
  assert.equal(resetsOn(Date.UTC(2026, 11, 31, 23)), "2027-01-01");
  assert.equal(monthOf(Date.UTC(2026, 10, 15)), "2026-11");
});

test("a signed-in account is stopped at its limit; only commits count; counts are per month", async () => {
  let now = Date.UTC(2026, 10, 15);
  const store = memStore();
  const who = async (r) => (r.get("authorization") === "Bearer ok" ? { acct: { id: "acct1" } } : null);
  const m = usageMeter({ store, who, signinReady: () => true, limits: { evidence: 2, chat: 1, weekly: 1 }, clock: () => now });
  const r = req("1.1.1.1", "Bearer ok");
  const a = await m.check(r, "evidence"); assert.equal(a.ok, true);
  await m.check(r, "evidence"); // checked but not committed: does not count
  assert.deepEqual(await a.commit(), { kind: "evidence", used: 1, limit: 2, resetsOn: "2026-12-01" });
  await (await m.check(r, "evidence")).commit();
  const over = await m.check(r, "evidence");
  assert.equal(over.ok, false); assert.equal(over.status, 429);
  assert.deepEqual(over.body, { error: "monthly-limit", kind: "evidence", used: 2, limit: 2, resetsOn: "2026-12-01" });
  assert.equal((await m.check(r, "chat")).ok, true, "each kind has its own allowance");
  const u = await m.usage(r);
  assert.deepEqual(u.usage.evidence, { used: 2, limit: 2 });
  assert.deepEqual(store.rows.ai_usage, [{ id: "acct1:2026-11", evidence: 2 }], "counts only, keyed by account and month");
  now = Date.UTC(2026, 11, 1);
  assert.equal((await m.check(r, "evidence")).ok, true, "a new month starts again");
});

test("signed out on a server with sign-in: 401 sign-in-required; nothing stored", async () => {
  const store = memStore();
  const m = usageMeter({ store, who: async () => null, signinReady: () => true });
  const g = await m.check(req(), "chat");
  assert.equal(g.status, 401); assert.deepEqual(g.body, { error: "sign-in-required" });
  assert.equal((await m.usage(req())).status, 401);
  assert.equal(store.rows.ai_usage, undefined);
});

test("no sign-in on this server: counted in memory by address, never written", async () => {
  const store = memStore();
  const m = usageMeter({ store, who: async () => null, signinReady: () => false, limits: { evidence: 1, chat: 1, weekly: 1 } });
  await (await m.check(req("9.9.9.9"), "evidence")).commit();
  assert.equal((await m.check(req("9.9.9.9"), "evidence")).status, 429);
  assert.equal((await m.check(req("8.8.8.8"), "evidence")).ok, true, "another address has its own allowance");
  assert.equal(store.rows.ai_usage, undefined);
});
