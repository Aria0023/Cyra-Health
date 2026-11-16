// Unit tests for the shop module (partner portal, docs/plans/partner-portal.md Task 1): roles, a partner can never
// publish or set evidence / why / clinician status, the public feed has published items only, image validation by magic
// bytes and size, code expiry, the portal token's own key, invites, applications, audit and the CSV export.
// In process, with an injected clock and a capturing mailer; the store is a JsonStore in a temp directory.
// Usage: cd backend && npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import express from "express";
import { JsonStore } from "../src/core/store.js";
import { mount, basePath, imageType, ownersFrom, cleanPatch, buildCatalog, portalKey, IMAGE_MAX_BYTES } from "../src/modules/shop/index.js";
import { cleanUrl, cleanText, cleanPrice, cleanIds, CATEGORIES, ARTS } from "../src/modules/shop/vocab.js";
import { accountKeys, signToken } from "../src/modules/accounts/index.js";

const SECRET = "unit-test-secret-1234567890";
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]), Buffer.from("IHDR"), Buffer.alloc(40, 1)]);
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(40, 2)]);
const WEBP = Buffer.concat([Buffer.from("RIFF"), Buffer.from([40, 0, 0, 0]), Buffer.from("WEBPVP8 "), Buffer.alloc(40, 3)]);

/* ---------- pure parts ---------- */
test("imageType: PNG, JPEG and WebP by magic bytes; anything else is refused", () => {
  assert.equal(imageType(PNG), "png");
  assert.equal(imageType(JPG), "jpeg");
  assert.equal(imageType(WEBP), "webp");
  assert.equal(imageType(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>")), null, "SVG (can carry script)");
  assert.equal(imageType(Buffer.from("GIF89a" + "x".repeat(40))), null, "GIF");
  assert.equal(imageType(Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WAVEfmt "), Buffer.alloc(20)])), null, "a RIFF that isn't WebP");
  assert.equal(imageType(Buffer.from([0x89, 0x50])), null, "too short");
  assert.equal(imageType("not a buffer"), null);
});

test("vocab: https-only URLs with a real host; capped text; plain prices; known ids", () => {
  assert.equal(cleanUrl("https://www.oura.com/x?a=1").value, "https://www.oura.com/x?a=1");
  for (const bad of ["http://oura.com/", "javascript:alert(1)", "data:text/html,x", "https://user:pw@oura.com/", "https://localhost/", "https://127.0.0.1/", "https://oura", "ftp://oura.com", `https://a.com/${"x".repeat(600)}`, 42]) assert.ok(cleanUrl(bad).error, String(bad).slice(0, 40));
  assert.equal(cleanUrl("").value, "", "optional and empty");
  assert.ok(cleanUrl("", { required: true }).error);
  assert.equal(cleanText("  a\u0000b ‮c\n d ", 20).value, "ab c d", "control and bidi characters gone, whitespace collapsed");
  assert.ok(cleanText("x".repeat(21), 20).error);
  assert.ok(cleanText({}, 20).error);
  assert.equal(cleanPrice("From $89").value, "From $89");
  assert.ok(cleanPrice("Only $89!!! Buy now").error);
  assert.deepEqual(cleanIds(["sleep", "sleep", "labs"], CATEGORIES).value, ["sleep", "labs"]);
  assert.ok(cleanIds(["sleep", "<script>"], CATEGORIES).error);
});

test("ownersFrom: a comma list of valid, normalised addresses", () => {
  assert.deepEqual(ownersFrom(" Owner@Solia.example , not-an-email,, b@x.example,owner@solia.example"), ["owner@solia.example", "b@x.example"]);
  assert.deepEqual(ownersFrom(""), []);
});

test("cleanPatch: a partner may not set owner-only fields; unknown fields are refused", () => {
  for (const k of ["why", "evidence", "sources", "categories", "stages", "modules", "kind", "clinicianStatus", "brandId"]) {
    const r = cleanPatch({ name: "X", [k]: k === "evidence" ? { tone: "strong", label: "x" } : k === "clinicianStatus" ? "signed" : [] }, "partner", "product");
    assert.equal(r.status, 403, k); assert.match(r.error, new RegExp(k));
  }
  assert.equal(cleanPatch({ status: "published" }, "partner", "product").status, 400, "status is never a field");
  assert.equal(cleanPatch({ status: "published" }, "owner", "product").status, 400, "not even for an owner: publishing is its own action");
  assert.equal(cleanPatch({ hue: "teal" }, "partner", "brand").status, 403);
  assert.deepEqual(cleanPatch({ name: " Ring ", price: "$299" }, "partner", "product").patch, { name: "Ring", price: "$299" });
});

test("art (2026-11-16): the illustration is owner-only, a known id or null; the public catalog carries it", () => {
  assert.equal(cleanPatch({ art: "smart-ring" }, "partner", "product").status, 403);
  assert.deepEqual(cleanPatch({ art: "smart-ring" }, "owner", "product").patch, { art: "smart-ring" });
  assert.deepEqual(cleanPatch({ art: "" }, "owner", "product").patch, { art: null });
  assert.deepEqual(cleanPatch({ art: null }, "owner", "product").patch, { art: null });
  for (const bad of ["nope", "<svg>", 3, ["cgm-a"]]) assert.equal(cleanPatch({ art: bad }, "owner", "product").status, 400);
  assert.equal(ARTS.length, 23);
  const snap = { brandId: "b", name: "Ring", url: "https://b.com/r", categories: ["wearables"], art: "smart-ring" };
  const out = buildCatalog([{ id: "b", published: { name: "B", website: "https://b.com/" } }], [{ id: "r", status: "published", published: snap }, { id: "old", status: "published", published: { ...snap, art: undefined } }]);
  assert.equal(out.products[0].art, "smart-ring");
  assert.ok(!JSON.parse(JSON.stringify(out)).products[1].art, "a product published before the field existed has none: the app draws its need's default");
});

test("buildCatalog: published snapshots only; no editor, audit or working copy", () => {
  const b = { id: "b", name: "B", published: { name: "B", monogram: "B", hue: "teal", tag: "", about: "", website: "https://b.com/", imageId: null }, updatedBy: "p@x.example" };
  const live = { id: "p1", brandId: "b", name: "Draft name", status: "draft", published: { brandId: "b", name: "Live name", url: "https://b.com/" }, updatedBy: "p@x.example" };
  const draft = { id: "p2", brandId: "b", name: "New", status: "pending", published: null };
  const archived = { id: "p3", brandId: "b", status: "archived", published: { brandId: "b", name: "Gone" } };
  const c = buildCatalog([b], [live, draft, archived]);
  assert.deepEqual(c.products.map((p) => [p.id, p.name]), [["p1", "Live name"]]);
  assert.ok(!JSON.stringify(c).includes("p@x.example") && !JSON.stringify(c).includes("Draft name"));
  assert.deepEqual(Object.keys(c.brands[0]).sort(), ["about", "hue", "id", "imageId", "monogram", "name", "tag", "website"]);
});

/* ---------- the routes, in process ---------- */
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "shop-test-"));
process.on("exit", () => fs.rmSync(dir, { recursive: true, force: true }));
let now = Date.UTC(2026, 10, 15);
const inbox = [];
const mailer = { ready: true, async send(to, subject, text) { inbox.push({ to, subject, text }); } };
const store = new JsonStore(dir);
const ctx = { config: { authSecret: SECRET, production: true, baseUrl: "https://api.solia.example", shop: { startPerMinute: 1000, verifyPerMinute: 1000, writePerMinute: 1000, readPerMinute: 1000, uploadPerMinute: 1000, applyPerMinute: 1000, applyGlobalPerMinute: 1000, catalogPerMinute: 1000, codesPerAddress: 1000 } }, store, onShutdown: [] };
const app = express(); app.use(express.json());
const router = express.Router(); mount(router, ctx, { clock: () => now, sweepMs: 0, mailer, owners: ["owner@solia.example"] }); app.use(basePath, router);
const srv = await new Promise((r) => { const s = app.listen(0, "127.0.0.1", () => r(s)); });
const B = `http://127.0.0.1:${srv.address().port}${basePath}`;
const req = (method, p, body, token, headers = {}) => fetch(`${B}${p}`, { method, headers: { ...(body !== undefined && !Buffer.isBuffer(body) ? { "content-type": "application/json" } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers }, body: body === undefined ? undefined : Buffer.isBuffer(body) ? body : JSON.stringify(body) });
const codeFor = (email) => /(\d{6})/.exec(inbox.filter((m) => m.to === email && /code/.test(m.subject)).at(-1)?.subject || "")?.[1];
async function signIn(email) {
  assert.equal((await req("POST", "/auth/start", { email })).status, 200);
  const r = await req("POST", "/auth/verify", { email, code: codeFor(email) });
  assert.equal(r.status, 200, `sign-in ${email}`);
  return (await r.json()).token;
}
const rows = (c) => { try { return JSON.parse(fs.readFileSync(path.join(dir, `${c}.json`), "utf8")); } catch { return []; } };
let owner, partner;

test("seed: the bundled catalog is imported once, as published", async () => {
  await ctx.shopReady;
  const c = await (await req("GET", "/catalog")).json();
  assert.ok(c.brands.length >= 20 && c.products.length >= 20, `${c.brands.length} brands, ${c.products.length} products`);
  assert.ok(c.products.some((p) => p.id === "easyhome-lh" && p.evidence?.tone === "mixed" && p.sources.length && p.clinicianStatus === "awaiting"));
  assert.equal(rows("shop_meta").filter((m) => m.key === "seeded").length, 1);
});

test("catalog: ETag and Cache-Control; If-None-Match answers 304; query parameters change nothing", async () => {
  const r = await req("GET", "/catalog");
  const etag = r.headers.get("etag");
  assert.match(r.headers.get("cache-control"), /public, max-age=\d+/);
  assert.ok(etag);
  assert.equal((await req("GET", "/catalog", undefined, null, { "if-none-match": etag })).status, 304);
  const q = await req("GET", "/catalog?stage=ttc&pcos=1&id=abc");
  assert.equal(q.headers.get("etag"), etag, "the same catalog for everyone");
});

test("sign-in: only owners and invited partners get a code; same answer for anyone else; codes expire", async () => {
  const before = inbox.length;
  const r = await req("POST", "/auth/start", { email: "stranger@x.example" });
  assert.equal(r.status, 200); assert.deepEqual(await r.json(), { sent: true });
  assert.equal(inbox.length, before, "no mail to an address without access");
  assert.equal((await req("POST", "/auth/verify", { email: "stranger@x.example", code: "123456" })).status, 401);
  // expiry
  await req("POST", "/auth/start", { email: "owner@solia.example" });
  const late = codeFor("owner@solia.example");
  now += 10 * 60_000 + 1;
  const e = await req("POST", "/auth/verify", { email: "owner@solia.example", code: late });
  assert.equal(e.status, 401); assert.equal((await e.json()).why, "expired");
  owner = await signIn("owner@solia.example");
  const me = await (await req("GET", "/me", undefined, owner)).json();
  assert.deepEqual(me.me, { email: "owner@solia.example", role: "owner", brandIds: null });
});

test("portal tokens: an app sign-in token never opens the portal; tampered tokens and expired sessions are refused", async () => {
  const appToken = signToken({ a: "owner@solia.example", s: "x", x: now + 1e9, aud: "portal" }, accountKeys(SECRET).token);
  assert.equal((await req("GET", "/me", undefined, appToken)).status, 401, "the app's key is not the portal's");
  assert.notDeepEqual(portalKey(SECRET), accountKeys(SECRET).token);
  assert.equal((await req("GET", "/me", undefined, `${owner.slice(0, -2)}xx`)).status, 401);
  assert.equal((await req("GET", "/brands")).status, 401, "no token");
  const t = await signIn("owner@solia.example");
  now += 8 * 3_600_000 + 1;
  assert.equal((await req("GET", "/me", undefined, t)).status, 401, "8 hours later");
  owner = await signIn("owner@solia.example");
});

test("owner: invites a partner to one brand; the partner gets an email with the portal address", async () => {
  assert.equal((await req("POST", "/invites", { email: "pat@oura.example", brandIds: ["nope"] }, owner)).status, 400);
  const r = await req("POST", "/invites", { email: " Pat@Oura.example ", brandIds: ["oura"] }, owner);
  assert.equal(r.status, 201);
  const j = await r.json();
  assert.equal(j.partner.email, "pat@oura.example"); assert.deepEqual(j.partner.brandIds, ["oura"]); assert.equal(j.emailed, true);
  assert.match(inbox.at(-1).text, /https:\/\/api\.solia\.example\/portal\//);
  partner = await signIn("pat@oura.example");
  assert.deepEqual((await (await req("GET", "/me", undefined, partner)).json()).me, { email: "pat@oura.example", role: "partner", brandIds: ["oura"] });
  assert.equal(rows("shop_partners").find((p) => p.email === "pat@oura.example").status, "active");
});

test("partner: sees only its brands; owner-only routes are 403", async () => {
  const brands = (await (await req("GET", "/brands", undefined, partner)).json()).brands;
  assert.deepEqual(brands.map((b) => b.id), ["oura"]);
  const products = (await (await req("GET", "/products", undefined, partner)).json()).products;
  assert.deepEqual(products.map((p) => p.id), ["oura"]);
  for (const [m, p, body] of [["POST", "/brands", { name: "Mine", website: "https://mine.com/" }], ["GET", "/partners"], ["POST", "/invites", { email: "x@y.example", brandIds: ["oura"] }], ["GET", "/applications"], ["GET", "/audit"], ["POST", "/brands/oura/publish", {}]]) {
    assert.equal((await req(m, p, body, partner)).status, 403, `${m} ${p}`);
  }
  assert.equal((await req("PATCH", "/brands/whoop", { about: "x" }, partner)).status, 404, "another brand");
  assert.equal((await req("PATCH", "/products/whoop", { name: "x" }, partner)).status, 404, "another brand's product");
  assert.equal((await req("POST", "/products", { brandId: "whoop", name: "X", url: "https://whoop.com/" }, partner)).status, 404);
});

test("partner can NOT publish or set why, evidence, sources, categories or clinician status", async () => {
  for (const body of [{ why: "Cures everything" }, { evidence: { tone: "strong", label: "Strong evidence" } }, { clinicianStatus: "signed" }, { sources: ["Me"] }, { categories: ["sleep"] }, { stages: ["ttc"] }, { modules: ["pcos"] }, { kind: "rx" }]) {
    const r = await req("PATCH", "/products/oura", body, partner);
    assert.equal(r.status, 403, JSON.stringify(body)); assert.match((await r.json()).error, /only an owner/);
  }
  for (const a of ["publish", "unpublish", "archive", "restore"]) assert.equal((await req("POST", `/products/oura/${a}`, {}, partner)).status, 403, a);
  const created = await req("POST", "/products", { brandId: "oura", name: "Oura Ring 5", url: "https://ouraring.com/", why: "x" }, partner);
  assert.equal(created.status, 403, "not even on create");
  const p = rows("shop_products").find((x) => x.id === "oura");
  assert.equal(p.clinicianStatus, "awaiting"); assert.notEqual(p.why, "Cures everything");
});

test("partner edits are reviewed: the live catalog keeps the published copy until an owner publishes", async () => {
  const before = (await (await req("GET", "/catalog")).json()).products.find((p) => p.id === "oura");
  const e = await req("PATCH", "/products/oura", { name: "Oura Ring 4", price: "From $349", url: "https://ouraring.com/ring" }, partner);
  assert.equal(e.status, 200);
  assert.equal((await e.json()).product.status, "draft");
  assert.equal((await req("PATCH", "/products/oura", { url: "http://ouraring.com/" }, partner)).status, 400, "https only");
  assert.equal((await req("PATCH", "/products/oura", { price: "cheap!!" }, partner)).status, 400);
  const live = (await (await req("GET", "/catalog")).json()).products.find((p) => p.id === "oura");
  assert.deepEqual(live, before, "nothing changed in the app yet");
  assert.equal((await req("POST", "/products/oura/submit", {}, partner)).status, 200);
  assert.equal(rows("shop_products").find((x) => x.id === "oura").status, "pending");
  const pub = await req("POST", "/products/oura/publish", {}, owner);
  assert.equal(pub.status, 200);
  const after = (await (await req("GET", "/catalog")).json()).products.find((p) => p.id === "oura");
  assert.equal(after.name, "Oura Ring 4"); assert.equal(after.price, "From $349");
});

test("partner creates a draft; it is not in the feed until an owner sets categories and publishes", async () => {
  const r = await req("POST", "/products", { brandId: "oura", name: "Oura Gen 4 sizing kit", url: "https://ouraring.com/sizing", availability: "online", covers: "Ring sizes to try at home" }, partner);
  assert.equal(r.status, 201);
  const { product } = await r.json();
  assert.equal(product.status, "draft"); assert.equal(product.clinicianStatus, "awaiting"); assert.deepEqual(product.categories, []);
  const feed = async () => (await (await req("GET", "/catalog")).json()).products.map((p) => p.id);
  assert.ok(!(await feed()).includes(product.id));
  await req("POST", `/products/${product.id}/submit`, {}, partner);
  assert.ok(!(await feed()).includes(product.id), "pending is not published");
  assert.equal((await req("POST", `/products/${product.id}/publish`, {}, owner)).status, 400, "needs a category first");
  assert.equal((await req("PATCH", `/products/${product.id}`, { categories: ["wearables"], evidence: { tone: "comfort", label: "Comfort, not a treatment" }, clinicianStatus: "signed" }, owner)).status, 200);
  assert.equal((await req("POST", `/products/${product.id}/publish`, {}, owner)).status, 200);
  const live = (await (await req("GET", "/catalog")).json()).products.find((p) => p.id === product.id);
  assert.equal(live.clinicianStatus, "signed");
  assert.equal((await req("POST", `/products/${product.id}/unpublish`, {}, owner)).status, 200);
  assert.ok(!(await feed()).includes(product.id));
  assert.equal((await req("POST", `/products/${product.id}/archive`, {}, owner)).status, 200);
  assert.equal((await req("PATCH", `/products/${product.id}`, { name: "Again" }, partner)).status, 409, "archived: a partner can't edit");
  assert.equal((await req("POST", `/products/${product.id}/publish`, {}, owner)).status, 409, "restore first");
  assert.equal((await req("POST", `/products/${product.id}/restore`, {}, owner)).status, 200);
});

test("images: PNG/JPEG/WebP up to 1 MB, checked by magic bytes; served with long cache; only your own image can be attached", async () => {
  const up = await req("POST", "/images", PNG, partner, { "content-type": "image/png" });
  assert.equal(up.status, 201);
  const { image } = await up.json();
  assert.match(image.id, /^[a-f0-9]{24}$/);
  const g = await req("GET", `/images/${image.id}`);
  assert.equal(g.status, 200); assert.equal(g.headers.get("content-type"), "image/png");
  assert.match(g.headers.get("cache-control"), /max-age=31536000/); assert.equal(g.headers.get("x-content-type-options"), "nosniff");
  assert.ok(Buffer.from(await g.arrayBuffer()).equals(PNG));
  assert.equal((await req("POST", "/images", JPG, partner, { "content-type": "image/jpeg" })).status, 201);
  assert.equal((await req("POST", "/images", WEBP, partner, { "content-type": "application/octet-stream" })).status, 201, "the type comes from the bytes");
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script>${" ".repeat(40)}</svg>`);
  assert.equal((await req("POST", "/images", svg, partner, { "content-type": "image/png" })).status, 415, "a lying content type");
  assert.equal((await req("POST", "/images", Buffer.concat([PNG, Buffer.alloc(IMAGE_MAX_BYTES)]), partner, { "content-type": "image/png" })).status, 413);
  assert.equal((await req("POST", "/images", PNG, null, { "content-type": "image/png" })).status, 401);
  assert.equal((await req("GET", "/images/../../shop_partners")).status, 404);
  assert.equal((await req("GET", "/images/zzzz")).status, 404);
  assert.equal((await req("PATCH", "/products/oura", { imageId: image.id }, partner)).status, 200);
  const ownerImg = (await (await req("POST", "/images", PNG, owner, { "content-type": "image/png" })).json()).image;
  assert.equal((await req("PATCH", "/products/oura", { imageId: ownerImg.id }, partner)).status, 400, "someone else's upload");
  assert.equal((await req("PATCH", "/products/oura", { imageId: "f".repeat(24) }, partner)).status, 400, "no such image");
});

test("applications: public form, validated, then an owner approves (brand + invite) or rejects", async () => {
  assert.equal((await req("POST", "/apply", { company: "Lumen", email: "hi@lumen.example", category: "sleep", website: "http://lumen.com/" })).status, 400, "https only");
  assert.equal((await req("POST", "/apply", { company: "", email: "bad", category: "x", website: "" })).status, 400);
  const ok = await req("POST", "/apply", { company: "Lumen Sleep", email: "hi@lumen.example", category: "sleep", website: "https://lumen.com/", note: "We make a sleep mask." });
  assert.equal(ok.status, 201); assert.deepEqual(await ok.json(), { received: true });
  assert.equal((await req("POST", "/apply", { company: "Bot", email: "b@b.example", category: "sleep", website: "https://b.com/", nickname: "x" })).status, 200);
  const apps = (await (await req("GET", "/applications", undefined, owner)).json()).applications;
  assert.equal(apps.length, 1, "the honeypot one was not kept");
  const a = await req("POST", `/applications/${apps[0].id}/approve`, {}, owner);
  assert.equal(a.status, 200);
  const j = await a.json();
  assert.equal(j.brand.name, "Lumen Sleep"); assert.deepEqual(j.partner.brandIds, [j.brand.id]);
  assert.equal(inbox.at(-1).to, "hi@lumen.example");
  assert.equal((await req("POST", `/applications/${apps[0].id}/approve`, {}, owner)).status, 409, "decided once");
  const lumen = await signIn("hi@lumen.example");
  assert.deepEqual((await (await req("GET", "/brands", undefined, lumen)).json()).brands.map((b) => b.id), [j.brand.id]);
  assert.ok(!(await (await req("GET", "/catalog")).json()).brands.some((b) => b.id === j.brand.id), "a brand with nothing published isn't in the feed");
});

test("removing a partner ends its sessions at once", async () => {
  const t = await signIn("hi@lumen.example");
  assert.equal((await req("DELETE", `/partners/${encodeURIComponent("hi@lumen.example")}`, undefined, owner)).status, 204);
  assert.equal((await req("GET", "/me", undefined, t)).status, 401);
  assert.equal((await req("POST", "/auth/sign-out", {}, partner)).status, 204);
  assert.equal((await req("GET", "/me", undefined, partner)).status, 401, "signed out");
  partner = await signIn("pat@oura.example");
});

test("audit: every change says who, what and when; the public feed never names anyone", async () => {
  const a = (await (await req("GET", "/audit", undefined, owner)).json()).audit;
  const acts = a.map((x) => `${x.by} ${x.action} ${x.target}`);
  for (const want of ["pat@oura.example edit product:oura", "pat@oura.example submit product:oura", "owner@solia.example publish product:oura", "owner@solia.example invite person:pat@oura.example", "seed import catalog"]) assert.ok(acts.includes(want), want);
  assert.ok(a.every((x) => x.at && x.by && x.action));
  const feed = await (await req("GET", "/catalog")).text();
  for (const s of ["@solia.example", "@oura.example", "updatedBy", "audit", "status"]) assert.ok(!feed.includes(s), s);
});

test("CSV export: scoped to the partner's brands; formula cells are neutralised", async () => {
  await req("PATCH", "/products/oura", { name: "=HYPERLINK(\"https://evil.example\")" }, partner);
  const r = await req("GET", "/products.csv", undefined, partner);
  assert.equal(r.status, 200); assert.match(r.headers.get("content-type"), /text\/csv/);
  const csv = await r.text();
  const lines = csv.trim().split("\r\n");
  assert.match(lines[0], /^id,brand,name,status,live/);
  assert.ok(lines.slice(1).every((l) => /,Oura,/.test(l)), "only Oura rows");
  assert.ok(csv.includes(`"'=HYPERLINK(""https://evil.example"")"`), "a leading = is prefixed with '");
});

test("a production server without an email key: sign-in answers 503, the catalog still works", async () => {
  const s2 = new JsonStore(fs.mkdtempSync(path.join(os.tmpdir(), "shop-test2-")));
  const c2 = { config: { authSecret: SECRET, production: true }, store: s2, onShutdown: [] };
  const a2 = express(); a2.use(express.json()); const r2 = express.Router(); mount(r2, c2, { sweepMs: 0, mailer: null, owners: ["o@x.example"] }); a2.use(basePath, r2);
  const s = await new Promise((r) => { const x = a2.listen(0, "127.0.0.1", () => r(x)); });
  try {
    const base = `http://127.0.0.1:${s.address().port}${basePath}`;
    assert.deepEqual(await (await fetch(`${base}/auth/config`)).json(), { email: false, sso: [] });
    assert.equal((await fetch(`${base}/auth/start`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "o@x.example" }) })).status, 503);
    assert.equal((await fetch(`${base}/catalog`)).status, 200);
  } finally { s.close(); for (const fn of c2.onShutdown) await fn(); }
});

test("rate limits: code requests are limited per client", async () => {
  const s3 = new JsonStore(fs.mkdtempSync(path.join(os.tmpdir(), "shop-test3-")));
  const c3 = { config: { authSecret: SECRET, production: false }, store: s3, onShutdown: [] };
  const a3 = express(); a3.use(express.json()); const r3 = express.Router(); mount(r3, c3, { sweepMs: 0, mailer, owners: [] }); a3.use(basePath, r3);
  const s = await new Promise((r) => { const x = a3.listen(0, "127.0.0.1", () => r(x)); });
  try {
    const base = `http://127.0.0.1:${s.address().port}${basePath}`;
    const st = [];
    for (let i = 0; i < 7; i++) st.push((await fetch(`${base}/auth/start`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: `n${i}@x.example` }) })).status);
    assert.deepEqual(st, [200, 200, 200, 200, 200, 429, 429]);
    const ap = [];
    for (let i = 0; i < 4; i++) ap.push((await fetch(`${base}/apply`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ company: "C", email: "c@c.example", category: "sleep", website: "https://c.com/" }) })).status);
    assert.deepEqual(ap, [201, 201, 201, 429]);
  } finally { s.close(); for (const fn of c3.onShutdown) await fn(); }
});

test("close", async () => { srv.close(); for (const fn of ctx.onShutdown) await fn(); });
