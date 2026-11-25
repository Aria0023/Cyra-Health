// Unit tests for organizations (docs/plans/upgrade-enterprise.md Task 3): the checks (colours AA on Solia's page and card,
// stages, the Shop lineup, the invite code, admins), the public config (never the invite code or admins), joining by slug
// or code (a daily total; with the app's sign-in the account stores the org), leaving, the logo, the bootstrap org's
// real palette, and each role boundary: owner writes, a partner gets 403, nobody signed in gets 401.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import express from "express";
import { JsonStore } from "../src/core/store.js";
import * as accounts from "../src/modules/accounts/index.js";
import * as shop from "../src/modules/shop/index.js";
import * as orgs from "../src/modules/orgs/index.js";
import { cleanOrg, themeProblems, contrast, SOLIA_THEME, publicOrg } from "../src/modules/orgs/index.js";

const SECRET = "unit-test-secret-1234567890";
const T0 = Date.UTC(2026, 10, 25, 9, 30);
const THEME = { primary: "#2F5D50", accent: "#8A4E18", dark: { primary: "#8AC2B0", accent: "#D8A96A" } };
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

test("colours: AA 4.5:1 on Solia's page and card, light and dark; Solia's own palette passes", () => {
  assert.equal(Math.round(contrast("#000000", "#FFFFFF")), 21);
  assert.deepEqual(themeProblems(SOLIA_THEME), []);
  assert.deepEqual(themeProblems(THEME), []);
  const weak = themeProblems({ ...THEME, primary: "#F0A3C0" });
  assert.ok(weak.length && /primary #F0A3C0 has .*:1 against the light page/.test(weak[0]), weak[0]);
  assert.ok(themeProblems({ ...THEME, dark: { primary: "#2F5D50", accent: "#D8A96A" } }).some((x) => /dark primary/.test(x)));
  assert.ok(themeProblems({ primary: "teal" }).length >= 3);
});

test("cleanOrg: required fields, stages, lineup, code, admins; unknown fields refused", () => {
  const ok = cleanOrg({ slug: "Lakeside", name: " Lakeside Clinic ", theme: THEME, stages: ["peri", "meno"], partnerIds: ["oura-ring"], inviteCode: "lake2026", admins: ["Ana@Lakeside.example"] }, { create: true, productIds: ["oura-ring"] });
  assert.deepEqual(ok.patch, { slug: "lakeside", name: "Lakeside Clinic", theme: { primary: "#2F5D50", accent: "#8A4E18", dark: { primary: "#8AC2B0", accent: "#D8A96A" } }, stages: ["peri", "meno"], partnerIds: ["oura-ring"], inviteCode: "LAKE2026", admins: ["ana@lakeside.example"] });
  for (const [body, why] of [[{ slug: "x", name: "A" }, "short slug"], [{ slug: "cyra", name: "A" }, "Solia's slug"], [{ slug: "lakeside" }, "no name"], [{ slug: "lakeside", name: "A", stages: [] }, "no stage"], [{ slug: "lakeside", name: "A", stages: ["cycle", "menu"] }, "unknown stage"], [{ slug: "lakeside", name: "A", partnerIds: ["nope"] }, "unknown product"], [{ slug: "lakeside", name: "A", inviteCode: "ab" }, "short code"], [{ slug: "lakeside", name: "A", admins: ["not-an-email"] }, "bad admin"], [{ slug: "lakeside", name: "A", plan: "gold" }, "unknown field"], [{ slug: "lakeside", name: "<b>A</b>" }, "markup"]]) {
    assert.equal(cleanOrg(body, { create: true, productIds: ["oura-ring"] }).status, 400, why);
  }
  assert.equal(cleanOrg({ slug: "other" }, {}).status, 400, "the slug can't be changed");
  const pub = publicOrg({ slug: "lakeside", name: "L", theme: THEME, stages: ["peri"], partnerIds: null, inviteCode: "LAKE2026", admins: ["a@b.example"] });
  assert.ok(!("inviteCode" in pub) && !("admins" in pub));
  assert.equal(pub.poweredBy, "Solia Health");
});

/* ---------- the routes, in process ---------- */
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "orgs-test-"));
process.on("exit", () => fs.rmSync(dir, { recursive: true, force: true }));
let now = T0;
const inbox = [], appCodes = [];
const mailer = { ready: true, async send(to, subject, text) { inbox.push({ to, subject, text }); } };
const sender = { ready: true, dev: false, async send(to, code) { appCodes.push({ to, code }); } };
const store = new JsonStore(dir);
const fast = 1000;
// an older bootstrap row with the wrong palette: fixed on start
fs.writeFileSync(path.join(dir, "orgs.json"), JSON.stringify([{ slug: "cyra", name: "Solia Health", theme: { primary: "#8E3B5E", paper: "#F6F1EC", accent: "#DD8A4E" }, stages: ["cycle", "fertility", "peri", "meno"], partnerIds: null, createdAt: "2026-01-01T00:00:00.000Z" }]));
const ctx = { config: { authSecret: SECRET, production: true, baseUrl: "https://api.solia.example", accounts: { startPerMinute: fast, verifyPerMinute: fast, perMinute: fast, codesPerAddress: fast }, shop: { startPerMinute: fast, verifyPerMinute: fast, writePerMinute: fast, readPerMinute: fast, codesPerAddress: fast }, orgs: { publicPerMinute: fast, joinPerMinute: fast, readPerMinute: fast, writePerMinute: fast } }, store, onShutdown: [] };
const app = express(); app.use(express.json());
for (const [mod, opts] of [[accounts, { clock: () => now, sweepMs: 0, sender }], [shop, { clock: () => now, sweepMs: 0, mailer, owners: ["owner@solia.example"], tapFlushMs: 0 }], [orgs, { clock: () => now }]]) {
  const r = express.Router(); mod.mount(r, ctx, opts); app.use(mod.basePath, r);
}
const srv = await new Promise((r) => { const s = app.listen(0, "127.0.0.1", () => r(s)); });
const B = `http://127.0.0.1:${srv.address().port}`;
const req = (method, p, body, token, headers = {}) => fetch(`${B}${p}`, { method, headers: { ...(body !== undefined && !Buffer.isBuffer(body) ? { "content-type": "application/json" } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers }, body: body === undefined ? undefined : Buffer.isBuffer(body) ? body : JSON.stringify(body) });
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
let owner, partner, product;

test("the bootstrap org wears Solia's real palette tokens", async () => {
  await ctx.shopReady; await ctx.orgsReady;
  const r = await (await req("GET", "/api/orgs/cyra/config")).json();
  assert.deepEqual(r.theme, { primary: "#5B54A6", accent: "#A8486E", dark: { primary: "#B9B3F2", accent: "#F0A3C0" } });
  assert.deepEqual(r.stages, ["cycle", "ttc", "preg", "peri", "meno"]);
});

test("roles: owner creates and edits; a partner gets 403; nobody signed in gets 401; config stays public", async () => {
  owner = await portalSignIn("owner@solia.example");
  assert.equal((await req("POST", "/api/shop/invites", { email: "pat@oura.example", brandIds: ["oura"] }, owner)).status, 201);
  partner = await portalSignIn("pat@oura.example");
  product = (await (await req("GET", "/api/shop/products", undefined, owner)).json()).products[0].id;
  const body = { slug: "lakeside", name: "Lakeside Clinic", theme: THEME, stages: ["peri", "meno"], partnerIds: [product], admins: ["ana@lakeside.example"] };
  for (const [m, p, b] of [["GET", "/api/orgs"], ["POST", "/api/orgs", body], ["PATCH", "/api/orgs/lakeside", { name: "X" }], ["POST", "/api/orgs/lakeside/logo", PNG], ["DELETE", "/api/orgs/lakeside/logo"]]) {
    assert.equal((await req(m, p, b)).status, 401, `anonymous ${m} ${p}`);
    assert.equal((await req(m, p, b, partner)).status, 403, `partner ${m} ${p}`);
    assert.equal((await req(m, p, b, undefined, { "x-admin-key": "anything" })).status, 401, `the old admin key opens nothing: ${m} ${p}`);
  }
  const c = await req("POST", "/api/orgs", body, owner);
  assert.equal(c.status, 201);
  const org = (await c.json()).org;
  assert.match(org.inviteCode, /^[A-Z0-9]{8}$/, "a code is made when none is given");
  assert.equal((await req("POST", "/api/orgs", body, owner)).status, 409, "slug taken");
  assert.equal((await req("PATCH", "/api/orgs/lakeside", { theme: { ...THEME, primary: "#FFD6E0" } }, owner)).status, 400, "colours checked on the server");
  assert.equal((await req("PATCH", "/api/orgs/lakeside", { inviteCode: "LAKE2026" }, owner)).status, 200);
  assert.equal((await req("PATCH", "/api/orgs/cyra", { name: "X" }, owner)).status, 404, "Solia's own org isn't edited here");
  const pub = await (await req("GET", "/api/orgs/lakeside/config")).json();
  assert.deepEqual(Object.keys(pub).sort(), ["logo", "name", "partnerIds", "poweredBy", "slug", "stages", "theme", "version"]);
  assert.doesNotMatch(JSON.stringify(pub), /LAKE2026|ana@/);
  const list = await (await req("GET", "/api/orgs", undefined, owner)).json();
  assert.equal(list.orgs.length, 1);
  assert.deepEqual(list.orgs[0].admins, ["ana@lakeside.example"]);
});

test("logo: PNG/JPEG/WebP only, at most 64 KB, returned inside the config", async () => {
  assert.equal((await req("POST", "/api/orgs/lakeside/logo", Buffer.from("not an image at all"), owner, { "content-type": "application/octet-stream" })).status, 415);
  assert.equal((await req("POST", "/api/orgs/lakeside/logo", Buffer.alloc(70 * 1024, 1), owner, { "content-type": "application/octet-stream" })).status, 413);
  assert.equal((await req("POST", "/api/orgs/lakeside/logo", PNG, owner, { "content-type": "image/png" })).status, 201);
  const pub = await (await req("GET", "/api/orgs/lakeside/config")).json();
  assert.match(pub.logo, /^data:image\/png;base64,/);
});

test("join by slug or code: a daily total and the config; with a sign-in the account stores the org; leave forgets it", async () => {
  const a = await req("POST", "/api/orgs/join", { slug: "lakeside" });
  assert.equal(a.status, 200);
  const j = await a.json();
  assert.equal(j.org.name, "Lakeside Clinic"); assert.equal(j.account, false);
  assert.doesNotMatch(JSON.stringify(j), /LAKE2026|ana@/);
  const maya = await appSignIn("maya@x.example");
  const b = await (await req("POST", "/api/orgs/join", { code: "lake 2026".replace(" ", "") }, maya.token)).json();
  assert.equal(b.account, true);
  assert.equal(acct("maya@x.example").orgSlug, "lakeside");
  assert.equal((await req("POST", "/api/orgs/join", { code: "NOPE1234" })).status, 404);
  assert.equal((await req("POST", "/api/orgs/join", { slug: "cyra" })).status, 404, "Solia itself isn't joined");
  assert.equal((await req("POST", "/api/orgs/join", { slug: "lakeside", stage: "peri" })).status, 400, "nothing else may be sent");
  assert.equal((await req("POST", "/api/orgs/join", {})).status, 400);
  const joins = JSON.parse(fs.readFileSync(path.join(dir, "org_joins.json"), "utf8"));
  assert.deepEqual(joins, [{ day: "2026-11-25", slug: "lakeside", joins: 2 }], "one total per org per day, nothing about who");
  assert.equal((await req("POST", "/api/orgs/leave", {}, maya.token)).status, 204);
  assert.equal(acct("maya@x.example").orgSlug, null);
  assert.equal((await req("POST", "/api/orgs/leave", {})).status, 204, "without a sign-in nothing changes");
});

test("cleanup", async () => { await new Promise((r) => srv.close(r)); for (const fn of ctx.onShutdown) await fn(); });
