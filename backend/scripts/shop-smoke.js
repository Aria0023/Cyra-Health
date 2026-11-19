// Shop / partner portal smoke test (docs/plans/partner-portal.md Task 1): a real production-mode server (NODE_ENV=production,
// real-looking secrets, ADMIN_EMAILS) with a local mock of Resend's HTTPS API (RESEND_API_BASE), so the whole path runs
// end to end: the seeded public catalog (CORS, ETag, 304), owner sign-in by email code, inviting a partner, the partner's
// edit + image upload + submit, the owner's publish, and the catalog showing it. Then what is on disk (no health field)
// and in the log (never an email address or a code with a key set). Last, a development server without RESEND_API_KEY
// logs the code. Usage: node scripts/shop-smoke.js
import http from "http";
import fs from "fs";
import crypto from "crypto";
import { spawn } from "child_process";

const assert = (c, m) => { if (!c) { console.error("FAIL:", m); process.exitCode = 1; } else console.log("ok  ", m); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const waitFor = async (url) => { for (let i = 0; i < 80; i++) { try { if ((await fetch(url)).ok) return; } catch { /* not yet */ } await sleep(100); } throw new Error("backend did not start"); };

const inbox = [];
const resend = http.createServer((req, res) => {
  let raw = ""; req.on("data", (c) => (raw += c)); req.on("end", () => {
    if (req.method === "POST" && req.url === "/emails" && req.headers.authorization === "Bearer re_test_key") { inbox.push(JSON.parse(raw)); res.writeHead(200, { "content-type": "application/json" }); return res.end("{\"id\":\"e\"}"); }
    res.writeHead(401); res.end();
  });
});
await new Promise((r) => resend.listen(3987, r));

const DATA = "./data-shop-smoke";
fs.rmSync(DATA, { recursive: true, force: true });
const start = (env, port) => {
  let out = "";
  const proc = spawn("node", ["server.js"], { env: { ...process.env, PORT: String(port), DATA_DIR: DATA, CYRA_CONFIG: "", CORS_ORIGIN: "https://app.example", PUBLIC_BASE_URL: `http://127.0.0.1:${port}`, ...env }, stdio: ["ignore", "pipe", "pipe"] });
  proc.stdout.on("data", (d) => { out += d; }); proc.stderr.on("data", (d) => { out += d; });
  return { proc, log: () => out };
};
const real = () => crypto.randomBytes(32).toString("hex");
const P = 3140, B = `http://127.0.0.1:${P}/api/shop`;
const srv = start({ NODE_ENV: "production", ADMIN_KEY: real(), AUTH_SECRET: real(), ADMIN_EMAILS: "Owner@Solia.example", RESEND_API_KEY: "re_test_key", RESEND_API_BASE: "http://127.0.0.1:3987", EMAIL_FROM: "Solia Health <portal@solia.example>" }, P);
const call = (method, path, body, token, headers = {}) => fetch(`${B}${path}`, { method, headers: { ...(body !== undefined && !Buffer.isBuffer(body) ? { "content-type": "application/json" } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers }, body: body === undefined ? undefined : Buffer.isBuffer(body) ? body : JSON.stringify(body) });
const codeOf = (to) => /(\d{6})/.exec(inbox.filter((m) => m.to[0] === to && /code/i.test(m.subject)).at(-1)?.subject || "")?.[1];
async function signIn(email) {
  await call("POST", "/auth/start", { email });
  await sleep(50);
  const r = await call("POST", "/auth/verify", { email, code: codeOf(email) });
  return r.ok ? (await r.json()).token : null;
}
try {
  await waitFor(`http://127.0.0.1:${P}/health`);
  assert(/module mounted: shop/.test(srv.log()), "production: the shop module is mounted");
  // public catalog
  const c = await fetch(`${B}/catalog`, { headers: { origin: "https://app.example" } });
  const cj = await c.json();
  assert(c.status === 200 && cj.products.length >= 20 && cj.brands.length >= 20, `catalog: the bundled items are published on first start (${cj.brands.length} brands, ${cj.products.length} products)`);
  assert(c.headers.get("access-control-allow-origin") === "https://app.example" && /max-age/.test(c.headers.get("cache-control") || "") && c.headers.get("etag"), "catalog: CORS for the app, Cache-Control and an ETag");
  assert((await fetch(`${B}/catalog`, { headers: { "if-none-match": c.headers.get("etag") } })).status === 304, "catalog: an unchanged catalog answers 304");
  // owner
  const owner = await signIn("owner@solia.example");
  assert(!!owner && inbox.at(-1).from.includes("portal@solia.example"), "owner: an ADMIN_EMAILS address signs in with an emailed code");
  assert((await call("POST", "/auth/start", { email: "nobody@else.example" })).status === 200 && !inbox.some((m) => m.to[0] === "nobody@else.example"), "an address without access gets the same answer and no email");
  const inv = await call("POST", "/invites", { email: "pat@oura.example", brandIds: ["oura"] }, owner);
  assert(inv.status === 201 && inbox.at(-1).to[0] === "pat@oura.example" && inbox.at(-1).text.includes(`http://127.0.0.1:${P}/portal/`), "owner: invites a partner; the invitation names the portal address");
  // partner
  const partner = await signIn("pat@oura.example");
  assert(!!partner, "partner: signs in with an emailed code");
  assert((await call("PATCH", "/products/oura", { evidence: { tone: "strong", label: "Strong evidence" } }, partner)).status === 403 && (await call("POST", "/products/oura/publish", {}, partner)).status === 403, "partner: can't set evidence or publish");
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]), Buffer.from("IHDR"), Buffer.alloc(64, 7)]);
  const up = await call("POST", "/images", png, partner, { "content-type": "image/png" });
  const img = up.ok ? (await up.json()).image : null;
  assert(up.status === 201 && img && (await call("POST", "/images", Buffer.from("<svg onload=alert(1)>" + " ".repeat(40)), partner, { "content-type": "image/png" })).status === 415, "partner: a PNG uploads; an SVG named image/png is refused");
  assert((await call("PATCH", "/products/oura", { name: "Oura Ring 4", imageId: img?.id }, partner)).status === 200 && (await call("POST", "/products/oura/submit", {}, partner)).status === 200, "partner: edits the product and submits it for review");
  assert(((await (await fetch(`${B}/catalog`)).json()).products.find((p) => p.id === "oura") || {}).name === "Oura Ring", "catalog: still the published copy while it waits");
  assert((await call("POST", "/products/oura/publish", {}, owner)).status === 200, "owner: publishes");
  const live = (await (await fetch(`${B}/catalog`)).json()).products.find((p) => p.id === "oura");
  assert(live.name === "Oura Ring 4" && live.imageId === img.id, "catalog: the published edit and its image");
  const g = await fetch(`${B}/images/${img.id}`);
  assert(g.status === 200 && g.headers.get("content-type") === "image/png" && /immutable/.test(g.headers.get("cache-control") || ""), "image: served with a long cache");
  // anonymous shop taps (docs/plans/tracking-reports.md Task 1): totals only
  const pre = await fetch(`${B}/tap`, { method: "OPTIONS", headers: { origin: "https://app.example", "access-control-request-method": "POST", "access-control-request-headers": "content-type" } });
  const tap = (body, headers = {}) => fetch(`${B}/tap`, { method: "POST", headers: { "content-type": "application/json", origin: "https://app.example", ...headers }, body: JSON.stringify(body) });
  const t1 = await tap({ productId: "oura" }, { cookie: "who=maya", "x-forwarded-for": "198.51.100.77" });
  assert(pre.status === 204 && t1.status === 204 && !t1.headers.get("set-cookie") && (await tap({ productId: "mira" })).status === 204, "tap: the app's cross-origin POST is accepted and answered with an empty 204, no cookie");
  assert((await tap({ productId: "nope-not-a-product" })).status === 404 && (await tap({ productId: "oura", stage: "peri" })).status === 400, "tap: an unknown id and a body with anything else are refused");
  const ownerTaps = await (await call("GET", "/taps?days=7", undefined, owner)).json();
  const partnerTaps = await (await call("GET", "/taps?days=7", undefined, partner)).json();
  assert(ownerTaps.total === 2 && partnerTaps.total === 1 && partnerTaps.brands.length === 1 && partnerTaps.brands[0].brandId === "oura" && (await call("GET", "/taps")).status === 401, "taps: the owner sees every brand's totals, the partner only its own, nobody without a sign-in");
  const tapDisk = fs.readFileSync(`${DATA}/shop_taps.json`, "utf8");
  assert(JSON.parse(tapDisk).every((r) => Object.keys(r).sort().join() === "brandId,day,productId,taps") && !/198\.51\.100|maya/.test(tapDisk) && !/198\.51\.100|\/tap/.test(srv.log()), "taps: the disk holds one total per product per day and nothing else; the log holds nothing about a tap");
  // disk and log
  const partnerCode = codeOf("pat@oura.example"); const disk = fs.readdirSync(DATA).filter((f) => f.startsWith("shop_")).map((f) => fs.readFileSync(`${DATA}/${f}`, "utf8")).join("\n");
  assert(!/"(symptoms|mood|days|cycleLen|lastPeriod|dueDate|log)"\s*:/.test(disk) && !new RegExp(`"${partnerCode}"`).test(disk) && !disk.includes(partner.split(".")[1]), "disk: business data only — no health field, no code, no token");
  assert(!/@solia\.example|@oura\.example/.test(srv.log()) && !srv.log().includes(codeOf("owner@solia.example")), "log: no email address and no code in production");
} finally { srv.proc.kill(); }

// development without a key: the code goes to the console
{
  const d = start({ NODE_ENV: "", AUTH_SECRET: real(), ADMIN_EMAILS: "dev@solia.example", RESEND_API_KEY: "", EMAIL_FROM: "", DATA_DIR: `${DATA}-dev` }, P + 1);
  try {
    await waitFor(`http://127.0.0.1:${P + 1}/health`);
    const r = await fetch(`http://127.0.0.1:${P + 1}/api/shop/auth/start`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "dev@solia.example" }) });
    const j = await r.json(); await sleep(100);
    assert(r.status === 200 && j.dev === true && /sign-in code for dev@solia\.example is \d{6}/.test(d.log()), "development without RESEND_API_KEY: the code is logged on the server");
  } finally { d.proc.kill(); }
}
resend.close();
await sleep(200);
fs.rmSync(DATA, { recursive: true, force: true }); fs.rmSync(`${DATA}-dev`, { recursive: true, force: true });
console.log(process.exitCode ? "SHOP SMOKE: FAILURES" : "SHOP SMOKE: all passed");
