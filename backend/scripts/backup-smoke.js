// Backup smoke test (local-first L4, owner decision D3): the encrypted cloud backup module keeps opaque
// bytes and nothing else. In-process on :3116 (like push-smoke) with an injected clock: create, read,
// replace and delete with a random id + write token (only its hash kept), exact bytes back, the size,
// row and total caps, 415/400/401/404/413/429/507, ids that can't reach outside its folder, expiry on
// read and by the sweep (orphan files too), and logs that never hold a body, a token or an id. Then a
// development server on :3117 mounts it, and a browser may preflight its PUT.
// Usage: node scripts/backup-smoke.js
import express from "express";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { spawn } from "child_process";
import { JsonStore } from "../src/core/store.js";
import { mount, basePath, ID_RE, TOKEN_RE, hashToken } from "../src/modules/backup/index.js";

const out = (s) => process.stdout.write(`${s}\n`);
const assert = (c, m) => { if (!c) { process.stderr.write(`FAIL: ${m}\n`); process.exitCode = 1; } else out(`ok   ${m}`); };
const DIR = "./data-backup-test", BLOBS = `${DIR}/blobs`, DAY = 86_400_000, HOUR = 3_600_000;
fs.rmSync(DIR, { recursive: true, force: true });
fs.mkdirSync(DIR, { recursive: true });

// Everything the module logs is captured (and kept off the console) so it can be searched.
const logs = [];
const orig = { log: console.log, warn: console.warn, error: console.error };
for (const k of ["log", "warn", "error"]) console[k] = (...a) => { logs.push(a.map(String).join(" ")); };

let now = Date.now();
const clock = () => now;
const start = async (cfg, port) => {
  const app = express(); app.use(express.json()); // as in server.js: the JSON parser runs first and must leave octet-stream alone
  const store = new JsonStore(DIR), router = express.Router(), ctx = { config: { backup: cfg, storage: { dir: DIR } }, store };
  mount(router, ctx, { clock, sweepMs: 0 });
  app.use(basePath, router);
  const srv = await new Promise((r) => { const s = app.listen(port, () => r(s)); });
  return { srv, ctx, B: `http://127.0.0.1:${port}${basePath}` };
};
const rows = () => { try { return JSON.parse(fs.readFileSync(`${DIR}/backups.json`, "utf8")); } catch { return []; } };
const blobFile = (id) => path.join(BLOBS, `${id}.bin`);
const listAll = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? listAll(path.join(d, e.name)) : [path.join(d, e.name)]));
const bodyWith = (n, marker = "") => { const b = crypto.randomBytes(n); if (marker) b.write(marker, 100, "latin1"); return b; };
const octet = (body, extra = {}) => ({ headers: { "content-type": "application/octet-stream", ...extra }, body });
const auth = (t) => ({ authorization: `Bearer ${t}` });

const MARKER = "BODY-MARKER-7f3a";
const tokens = [], ids = [];
const { srv, ctx, B } = await start({ maxBytes: 2048, ttlDays: 1, maxRows: 3, maxTotalBytes: 5000, perMinute: 1000, dir: BLOBS }, 3116);
let dev = null, srv2 = null;
try {
  // ---- create ----
  const t0 = now;
  const first = bodyWith(1000, MARKER);
  let r = await fetch(B, { method: "POST", ...octet(first) });
  const A = await r.json();
  tokens.push(A.token); ids.push(A.id);
  assert(r.status === 201 && ID_RE.test(A.id) && TOKEN_RE.test(A.token) && A.expiresAt === new Date(t0 + DAY).toISOString(), `POST: 201 with a 128-bit id, a 256-bit token and expiresAt = now + ttl (${A.expiresAt})`);
  assert(r.headers.get("cache-control") === "no-store", "POST: cache-control no-store");
  assert(fs.readFileSync(blobFile(A.id)).equals(first), "disk: the blob file holds exactly the bytes sent");
  assert(rows().length === 1 && Object.keys(rows()[0]).sort().join() === "createdAt,expiresAt,id,size,tokenHash,updatedAt", `store: the row is exactly ${Object.keys(rows()[0] || {}).sort().join(", ")}`);
  assert(rows()[0].tokenHash === hashToken(A.token) && rows()[0].size === 1000, "store: only the token's hash and the size");
  const onDisk = () => listAll(DIR).map((f) => fs.readFileSync(f)).map((b) => b.toString("latin1")).join("\n");
  assert(!onDisk().includes(A.token), "disk: the token string is in no file");

  // ---- read ----
  r = await fetch(`${B}/${A.id}`);
  assert(r.status === 401, `GET without a token: 401 (${r.status})`);
  r = await fetch(`${B}/${A.id}`, { headers: auth("b".repeat(43)) });
  assert(r.status === 404, `GET with a wrong 43-character token: 404 (${r.status})`);
  r = await fetch(`${B}/${A.id}`, { headers: auth(A.token) });
  const got = Buffer.from(await r.arrayBuffer());
  assert(r.status === 200 && got.equals(first) && r.headers.get("content-type") === "application/octet-stream" && r.headers.get("cache-control") === "no-store" && r.headers.get("x-content-type-options") === "nosniff", "GET with the token: 200, identical bytes, octet-stream, no-store, nosniff");

  // ---- replace ----
  now += HOUR;
  const second = bodyWith(2000);
  r = await fetch(`${B}/${A.id}`, { method: "PUT", ...octet(second, auth(A.token)) });
  const put = await r.json();
  assert(r.status === 200 && put.ok === true && put.expiresAt === new Date(now + DAY).toISOString(), `PUT: 200 and the TTL starts again from the write (${put.expiresAt})`);
  r = await fetch(`${B}/${A.id}`, { headers: auth(A.token) });
  assert(Buffer.from(await r.arrayBuffer()).equals(second) && rows()[0].size === 2000 && rows()[0].createdAt === t0 && rows()[0].updatedAt === now, "PUT: a later GET returns the new bytes; size and updatedAt follow");
  const expA = rows()[0].expiresAt;
  now += 60_000;
  await fetch(`${B}/${A.id}`, { headers: auth(A.token) });
  assert(rows()[0].expiresAt === expA, "GET: a read doesn't extend the TTL");
  r = await fetch(`${B}/${A.id}`, { method: "PUT", ...octet(second, auth("c".repeat(43))) });
  assert(r.status === 404, "PUT with a wrong token: 404");

  // ---- refusals ----
  const files0 = fs.readdirSync(BLOBS).length;
  r = await fetch(B, { method: "POST", ...octet(bodyWith(2049)) });
  assert(r.status === 413 && rows().length === 1 && fs.readdirSync(BLOBS).length === files0, `POST over maxBytes: 413, no new row or file (${r.status})`);
  r = await fetch(`${B}/${A.id}`, { method: "PUT", ...octet(bodyWith(2049), auth(A.token)) });
  assert(r.status === 413 && fs.readFileSync(blobFile(A.id)).equals(second), "PUT over maxBytes: 413 and the old blob is intact");
  r = await fetch(B, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ days: [{ sym: 1 }] }) });
  assert(r.status === 415 && rows().length === 1, `POST as application/json: 415 (${r.status})`);
  r = await fetch(B, { method: "POST", headers: { "content-type": "text/plain" }, body: "hello" });
  assert(r.status === 415, "POST as text/plain: 415");
  r = await fetch(B, { method: "POST", ...octet(Buffer.alloc(0)) });
  assert(r.status === 400 && rows().length === 1, `POST with an empty body: 400 (${r.status})`);
  r = await fetch(`${B}/${A.id}`, { headers: { authorization: `Bearer ${A.token}x` } });
  assert(r.status === 401, "a malformed authorization header: 401");
  fs.writeFileSync(`${DIR}/x.bin`, "sentinel");
  const outside = () => fs.readFileSync(`${DIR}/x.bin`, "utf8") === "sentinel";
  for (const bad of ["..%2Fx", "..%2F..%2Fx", "short", "A".repeat(23), "A".repeat(21) + "%2F"]) {
    const codes = [];
    codes.push((await fetch(`${B}/${bad}`, { headers: auth(A.token) })).status);
    codes.push((await fetch(`${B}/${bad}`, { method: "DELETE", headers: auth(A.token) })).status);
    codes.push((await fetch(`${B}/${bad}`, { method: "PUT", ...octet(bodyWith(10), auth(A.token)) })).status);
    assert(codes.every((c) => c === 404) && outside(), `id ${decodeURIComponent(bad)}: GET/DELETE/PUT 404 and nothing outside the folder touched (${codes.join(",")})`);
  }

  // ---- caps ----
  r = await fetch(B, { method: "POST", ...octet(bodyWith(2000)) });
  const Bb = await r.json(); tokens.push(Bb.token); ids.push(Bb.id);
  assert(r.status === 201, "a second blob: 201");
  r = await fetch(B, { method: "POST", ...octet(bodyWith(1500)) });
  assert(r.status === 507 && rows().length === 2, `over maxTotalBytes (2000 + 2000 + 1500 > 5000): 507 (${r.status})`);
  now += 12 * HOUR;
  r = await fetch(B, { method: "POST", ...octet(bodyWith(900)) });
  const C = await r.json(); tokens.push(C.token); ids.push(C.id);
  assert(r.status === 201 && rows().length === 3, "a third blob within the total: 201");
  r = await fetch(B, { method: "POST", ...octet(bodyWith(10)) });
  assert(r.status === 507 && rows().length === 3, `a fourth row over maxRows (3): 507 (${r.status})`);
  r = await fetch(`${B}/${C.id}`, { method: "PUT", ...octet(bodyWith(2048), auth(C.token)) });
  assert(r.status === 507 && fs.readFileSync(blobFile(C.id)).length === 900, "a replace that would go over maxTotalBytes (4900 - 900 + 2048): 507, the old blob kept");
  assert(JSON.stringify(await ctx.backupStats()) === JSON.stringify({ rows: 3, bytes: 4900 }), "backupStats: 3 rows, 4900 bytes");

  // ---- expiry: on read, and by the sweep ----
  now = Math.max(...rows().filter((x) => x.id !== C.id).map((x) => x.expiresAt)) + 1000; // A and B have expired; C (written 12 h later) has not
  r = await fetch(`${B}/${A.id}`, { headers: auth(A.token) });
  assert(r.status === 404 && !rows().some((x) => x.id === A.id) && !fs.existsSync(blobFile(A.id)), "an expired blob: 404, and its row and file are deleted on the spot");
  const oldOrphan = path.join(BLOBS, `${"O".repeat(22)}.bin`), newOrphan = path.join(BLOBS, `${"N".repeat(22)}.bin`), oldTmp = path.join(BLOBS, `${"T".repeat(22)}.0123456789ab.tmp`);
  for (const f of [oldOrphan, newOrphan, oldTmp]) fs.writeFileSync(f, "x");
  fs.utimesSync(oldOrphan, (now - 2 * HOUR) / 1000, (now - 2 * HOUR) / 1000);
  fs.utimesSync(oldTmp, (now - 2 * HOUR) / 1000, (now - 2 * HOUR) / 1000);
  fs.utimesSync(newOrphan, now / 1000, now / 1000);
  const swept = await ctx.backupSweep();
  assert(swept.expired === 1 && !rows().some((x) => x.id === Bb.id) && !fs.existsSync(blobFile(Bb.id)), "sweep: the other expired row and its file are deleted");
  assert(rows().some((x) => x.id === C.id) && fs.existsSync(blobFile(C.id)), "sweep: a live blob is kept");
  assert(!fs.existsSync(oldOrphan) && !fs.existsSync(oldTmp) && fs.existsSync(newOrphan) && swept.orphans === 2, "sweep: row-less .bin/.tmp files over an hour old are removed, a fresh one is left");

  // ---- delete ----
  r = await fetch(`${B}/${C.id}`, { method: "DELETE", headers: auth(C.token) });
  assert(r.status === 200 && (await r.json()).ok === true, "DELETE with the token: 200");
  r = await fetch(`${B}/${C.id}`, { headers: auth(C.token) });
  assert(r.status === 404 && !fs.existsSync(blobFile(C.id)) && rows().length === 0, "after DELETE: 404, the file and the row are gone");

  // ---- rate limit ----
  ({ srv: srv2 } = await start({ maxBytes: 2048, ttlDays: 1, maxRows: 100, maxTotalBytes: 50000, perMinute: 2, dir: BLOBS }, 3115));
  const codes = [];
  for (let i = 0; i < 3; i++) { const x = await fetch("http://127.0.0.1:3115/api/backup", { method: "POST", ...octet(bodyWith(10)) }); codes.push(x.status); if (x.status === 201) { const j = await x.json(); tokens.push(j.token); ids.push(j.id); } }
  assert(codes.join() === "201,201,429", `rate limit (perMinute 2): ${codes.join(", ")}`);

  // ---- logging and the source itself ----
  const all = logs.join("\n");
  assert(/\[cyra\] backup: on \(max 2048 bytes each, kept 1 days after the last write\)/.test(all), "log: the mount line");
  assert(/body refused \(entity\.too\.large\)/.test(all), "log: a refused body names only the error type");
  assert(!all.includes(MARKER) && !tokens.some((t) => all.includes(t)) && !ids.some((id) => all.includes(id)), `log: no body, no token and no id (${logs.length} lines)`);
  const src = fs.readFileSync("src/modules/backup/index.js", "utf8").replace(/^\s*\/\/.*$/gm, "");
  assert(!/JSON\.parse/.test(src) && !/console\.\w+\([^)]*(req\.body|token|req\.params)/.test(src), "source: no JSON.parse of a body, no console call with a body, token or id");
} finally {
  srv.close(); srv2?.close();
}

// ---- a development server mounts it, and a browser may preflight its PUT ----
try {
  dev = spawn("node", ["server.js"], { env: { ...process.env, PORT: "3117", NODE_ENV: "", CYRA_CONFIG: "", DATA_DIR: `${DIR}/dev`, CORS_ORIGIN: "https://app.example" }, stdio: ["ignore", "pipe", "pipe"] });
  let devOut = "";
  dev.stdout.on("data", (d) => { devOut += d; }); dev.stderr.on("data", (d) => { devOut += d; });
  for (let i = 0; i < 80 && !/backend listening/.test(devOut); i++) await new Promise((r) => setTimeout(r, 100));
  assert(/module mounted: backup/.test(devOut), "development (config/app-dev.json): module mounted: backup");
  const pre = await fetch("http://127.0.0.1:3117/api/backup/x", { method: "OPTIONS", headers: { origin: "https://app.example", "access-control-request-method": "PUT" } });
  assert(pre.status === 204 && /\bPUT\b/.test(pre.headers.get("access-control-allow-methods") || ""), `CORS: a browser may send PUT (${pre.headers.get("access-control-allow-methods")})`);
  const made = await fetch("http://127.0.0.1:3117/api/backup", { method: "POST", ...octet(bodyWith(64)) });
  assert(made.status === 201, "development: POST /api/backup through server.js (global JSON parser first) → 201");
} finally {
  dev?.kill();
  await new Promise((r) => setTimeout(r, 200));
  fs.rmSync(DIR, { recursive: true, force: true });
  Object.assign(console, orig);
}
out(process.exitCode ? "BACKUP SMOKE: FAILURES" : "BACKUP SMOKE: all passed");
