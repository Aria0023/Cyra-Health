// Account smoke test (calm R9): the backup module's optional accounts keep an opaque, client-encrypted blob under a
// random id, a hash of the email and a hash of a write token, and nothing else. It uses the app's own code
// (src/lib/account.js for the lookup and token, src/lib/backup.js for the encryption) so the server is tested against
// exactly what the app sends. In-process on :3118 with an injected clock: create, a second device signs in (meta + load +
// decrypt), versions and 409 on a stale base, "any" overwrites, wrong passphrase / unknown email both 404 (no
// enumeration), the wrong-passphrase back-off (429), one email with another passphrase is another account, per-email cap,
// size cap, TTL (accountTtlDays), the id routes can't reach an account blob, delete removes row and file, and logs never
// hold a body, an email, a lookup, a token or an id. Then a development server on :3119 mounts it and allows the
// preflight of the account headers, and production config (config/app.json) does not list the module.
// Usage: node scripts/account-smoke.js
import express from "express";
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { JsonStore } from "../src/core/store.js";
import { mount, basePath, hashToken, LOOKUP_RE } from "../src/modules/backup/index.js";
import { credentialsFor, accountTransport } from "../../src/lib/account.js";
import { backupKey, encryptWithKey, openBackup, decryptBackup } from "../../src/lib/backup.js";

const out = (s) => process.stdout.write(`${s}\n`);
const assert = (c, m) => { if (!c) { process.stderr.write(`FAIL: ${m}\n`); process.exitCode = 1; } else out(`ok   ${m}`); };
const DIR = "./data-account-test", BLOBS = `${DIR}/blobs`, DAY = 86_400_000;
fs.rmSync(DIR, { recursive: true, force: true });
fs.mkdirSync(DIR, { recursive: true });
const logs = [];
const orig = { log: console.log, warn: console.warn, error: console.error };
for (const k of ["log", "warn", "error"]) console[k] = (...a) => { logs.push(a.map(String).join(" ")); };

let now = Date.now();
const clock = () => now;
const app = express(); app.use(express.json());
const store = new JsonStore(DIR), router = express.Router();
const ctx = { config: { backup: { maxBytes: 64 * 1024, ttlDays: 1, accountTtlDays: 365, perAccount: 2, failsPerAccount: 4, maxRows: 50, maxTotalBytes: 10 * 1024 * 1024, perMinute: 1000, dir: BLOBS } }, store };
mount(router, ctx, { clock, sweepMs: 0 });
app.use(basePath, router);
const srv = await new Promise((r) => { const s = app.listen(3118, () => r(s)); });
const BASE = "http://127.0.0.1:3118";
const request = (p, init) => fetch(`${BASE}${p}`, init);
const T = accountTransport({ request, enabled: true, gate: () => true });
const rows = () => { try { return JSON.parse(fs.readFileSync(`${DIR}/backups.json`, "utf8")); } catch { return []; } };
const listAll = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? listAll(path.join(d, e.name)) : [path.join(d, e.name)]));
const onDisk = () => listAll(DIR).map((f) => fs.readFileSync(f).toString("latin1")).join("\n");
const rejects = async (p, code) => { try { await p; return false; } catch (e) { return e.code === code ? e : false; } };

const EMAIL = "Aria.Test@Example.com", PASS = "a long passphrase 1";
const MARKER = "JOURNAL-MARKER-41c9", NOTE = "my private note about cramps";
const record = { v: 1, stage: "periods", days: [{ date: "2026-10-01", sym: { crm: 2 }, note: NOTE }], journal: [{ t: MARKER }] };
const secrets = [];
try {
  const cred = await credentialsFor(EMAIL, PASS);
  secrets.push(cred.lookup, cred.token, "aria.test@example.com", EMAIL, PASS);
  assert(LOOKUP_RE.test(cred.lookup) && /^[A-Za-z0-9_-]{43}$/.test(cred.token), "the app derives a 43-character lookup and write token");
  assert((await credentialsFor("  aria.test@EXAMPLE.com ", PASS)).lookup === cred.lookup, "the email is normalised before hashing (case, spaces)");
  const k = await backupKey(PASS);
  const env1 = await encryptWithKey(record, k);

  // ---- create ----
  const made = await T.save(env1, cred, "new");
  assert(made.version === 1 && made.expiresAt === new Date(now + 365 * DAY).toISOString(), `create: version 1, kept 365 days after the last write (${made.expiresAt})`);
  const r0 = rows()[0];
  assert(rows().length === 1 && Object.keys(r0).sort().join() === "createdAt,emailHash,expiresAt,id,kind,size,tokenHash,updatedAt,version", `store: the row is exactly ${Object.keys(r0).sort().join(", ")}`);
  assert(r0.kind === "account" && r0.emailHash === cred.lookup && r0.tokenHash === hashToken(cred.token) && /^[A-Za-z0-9_-]{22}$/.test(r0.id) && r0.id !== cred.lookup, "store: a random id, the email's hash, the token's hash");
  const disk = onDisk();
  assert(!disk.includes(MARKER) && !disk.includes(NOTE) && !disk.includes("aria.test@example.com") && !disk.includes(EMAIL) && !disk.includes(cred.token) && !disk.includes(PASS), "disk: no plaintext, no email, no token and no passphrase anywhere");
  assert(JSON.parse(fs.readFileSync(path.join(BLOBS, `${r0.id}.bin`), "utf8")).ct === env1.ct, "disk: the blob is the encrypted envelope as sent");
  assert(await rejects(T.save(env1, cred, "new"), "CONFLICT"), "create again with the same email and passphrase: 409 (the app offers Sign in)");

  // ---- a second device signs in ----
  const cred2 = await credentialsFor(EMAIL, PASS);
  const m = await T.meta(cred2);
  assert(m.version === 1 && m.size === r0.size, "meta: version and size");
  const got = await T.load(cred2);
  const opened = await openBackup(got.envelope, PASS);
  assert(got.version === 1 && JSON.stringify(opened.state) === JSON.stringify(record) && opened.key === k.key && opened.salt === k.salt, "sign in: load + decrypt with the passphrase gives the record and the same key");
  assert(JSON.stringify(await decryptBackup(got.envelope, PASS)) === JSON.stringify(record), "the envelope opens with plain decryptBackup too (same format as a backup file)");

  // ---- versions, conflict, any ----
  now += 1000;
  const env2 = await encryptWithKey({ ...record, days: [] }, k);
  const v2 = await T.save(env2, cred, 1);
  assert(v2.version === 2, "back up on top of version 1: version 2");
  const c = await rejects(T.save(env1, cred2, 1), "CONFLICT");
  assert(c && c.version === 2 && typeof c.updatedAt === "string", "a device still on version 1: 409 with the newer version (\"The backup is newer\")");
  const v3 = await T.save(env1, cred2, "any");
  assert(v3.version === 3, "Keep this device's log (base any): overwrites, version 3");

  // ---- wrong passphrase, unknown email: the same 404; back-off ----
  const wrong = await credentialsFor(EMAIL, "not the passphrase");
  const unknown = await credentialsFor("nobody@example.com", PASS);
  secrets.push(wrong.token, unknown.lookup);
  const a1 = await rejects(T.load(wrong), "NO_ACCOUNT"), a2 = await rejects(T.load(unknown), "NO_ACCOUNT");
  const r404a = await request("/api/backup/account", { headers: { "x-cyra-account": wrong.lookup, authorization: `Bearer ${wrong.token}` } });
  const r404b = await request("/api/backup/account", { headers: { "x-cyra-account": unknown.lookup, authorization: `Bearer ${unknown.token}` } });
  assert(a1 && a2 && r404a.status === 404 && r404b.status === 404 && JSON.stringify(await r404a.json()) === JSON.stringify(await r404b.json()), "wrong passphrase and unknown email: identical 404s (no enumeration)");
  let r = await request("/api/backup/account", { headers: { "x-cyra-account": cred.lookup } });
  assert(r.status === 401, "no write token: 401");
  r = await request("/api/backup/account", { headers: { "x-cyra-account": "short", authorization: `Bearer ${cred.token}` } });
  assert(r.status === 401, "a malformed lookup: 401");
  await rejects(T.meta(wrong), "NO_ACCOUNT"); await rejects(T.meta(wrong), "NO_ACCOUNT"); // 3rd and 4th refusals for this email (failsPerAccount 4)
  assert(await rejects(T.load(cred), "BUSY"), "after 4 refused tries for one email: 429, even with the right passphrase");
  now += 16 * 60_000;
  assert((await T.meta(cred)).version === 3, "the back-off ends 15 minutes after the refusals");

  // ---- another passphrase for the same email is another account; per-email cap ----
  const other = await credentialsFor(EMAIL, "a different passphrase");
  secrets.push(other.token);
  const ko = await backupKey("a different passphrase");
  assert((await T.save(await encryptWithKey({ v: 1, stage: "peri" }, ko), other, "new")).version === 1, "same email, another passphrase: a separate account (version 1)");
  assert((await T.meta(cred)).version === 3, "…and the first account is untouched");
  const third = await credentialsFor(EMAIL, "yet another passphrase");
  assert(await rejects(T.save(env1, third, "new"), "FULL"), "a third account for one email (perAccount 2): 507");

  // ---- size cap, content type, base ----
  r = await request("/api/backup/account", { method: "PUT", headers: { "x-cyra-account": cred.lookup, authorization: `Bearer ${cred.token}`, "content-type": "application/octet-stream", "x-cyra-base": "any" }, body: Buffer.alloc(64 * 1024 + 1, 1) });
  assert(r.status === 413 && (await T.meta(cred)).version === 3, "over maxBytes: 413 and the backup is intact");
  r = await request("/api/backup/account", { method: "PUT", headers: { "x-cyra-account": cred.lookup, authorization: `Bearer ${cred.token}`, "content-type": "application/json", "x-cyra-base": "any" }, body: JSON.stringify(record) });
  assert(r.status === 415, "as application/json: 415");
  r = await request("/api/backup/account", { method: "PUT", headers: { "x-cyra-account": cred.lookup, authorization: `Bearer ${cred.token}`, "content-type": "application/octet-stream", "x-cyra-base": "latest" }, body: "x" });
  assert(r.status === 400, "an unknown x-cyra-base: 400");
  assert(await rejects(T.save(env1, cred, 7), "CONFLICT"), "a base that isn't the server's version: 409");

  // ---- the id routes never reach an account ----
  const id = rows().find((x) => x.emailHash === cred.lookup && x.tokenHash === hashToken(cred.token)).id;
  r = await request(`/api/backup/${id}`, { headers: { authorization: `Bearer ${cred.token}` } });
  assert(r.status === 404, "GET /api/backup/:id with the account's id and token: 404 (accounts only through /account)");

  // ---- TTL ----
  now += 366 * DAY;
  assert(await rejects(T.meta(other), "NO_ACCOUNT"), "a year and a day after its last write: gone (404), row deleted");
  assert(!rows().some((x) => x.tokenHash === hashToken(other.token)), "…its row is deleted on the spot");
  now -= 366 * DAY;

  // ---- delete ----
  assert(await T.remove(cred) === true, "delete: 200");
  assert(!rows().some((x) => x.id === id) && !fs.existsSync(path.join(BLOBS, `${id}.bin`)), "delete: the row and the file are gone");
  assert(await rejects(T.load(cred), "NO_ACCOUNT") && await rejects(T.remove(cred), "GONE"), "after delete: load 404, delete again 404");

  // ---- logs ----
  const all = logs.join("\n");
  assert(!secrets.some((x) => all.includes(x)) && !all.includes(MARKER) && !all.includes(env1.ct.slice(0, 40)) && !all.includes(id), `logs: no email, lookup, token, passphrase, body or id (${logs.length} lines)`);
} finally {
  srv.close();
}

let dev = null;
try {
  dev = spawn("node", ["server.js"], { env: { ...process.env, PORT: "3119", NODE_ENV: "", CYRA_CONFIG: "", DATA_DIR: `${DIR}/dev`, CORS_ORIGIN: "https://app.example" }, stdio: ["ignore", "pipe", "pipe"] });
  let devOut = "";
  dev.stdout.on("data", (d) => { devOut += d; }); dev.stderr.on("data", (d) => { devOut += d; });
  for (let i = 0; i < 80 && !/backend listening/.test(devOut); i++) await new Promise((r) => setTimeout(r, 100));
  const pre = await fetch("http://127.0.0.1:3119/api/backup/account", { method: "OPTIONS", headers: { origin: "https://app.example", "access-control-request-method": "PUT", "access-control-request-headers": "x-cyra-account, x-cyra-base, authorization, content-type" } });
  const allowH = pre.headers.get("access-control-allow-headers") || "";
  assert(pre.status === 204 && /x-cyra-account/.test(allowH) && /x-cyra-base/.test(allowH) && /x-cyra-version/.test(pre.headers.get("access-control-expose-headers") || ""), "CORS: the account headers may be sent and the version header read");
  const DT = accountTransport({ request: (p, init) => fetch(`http://127.0.0.1:3119${p}`, init), enabled: true, gate: () => true });
  const dc = await credentialsFor("dev@example.com", "dev passphrase 1");
  const dk = await backupKey("dev passphrase 1");
  assert((await DT.save(await encryptWithKey({ v: 1, stage: "preg" }, dk), dc, "new")).version === 1 && (await DT.remove(dc)) === true, "development server (config/app-dev.json): create and delete through server.js");
  const prod = JSON.parse(fs.readFileSync("config/app.json", "utf8"));
  assert(!prod.modules.includes("backup"), `production config/app.json does not mount backup (${prod.modules.join(", ")})`);
} finally {
  dev?.kill();
  await new Promise((r) => setTimeout(r, 200));
  fs.rmSync(DIR, { recursive: true, force: true });
  Object.assign(console, orig);
}
out(process.exitCode ? "ACCOUNT SMOKE: FAILURES" : "ACCOUNT SMOKE: all passed");
