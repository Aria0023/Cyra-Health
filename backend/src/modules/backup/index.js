// Encrypted cloud backup (owner decision D3; local-first L4): a scaffold that keeps opaque blobs.
// NOT MOUNTED IN PRODUCTION: config/app.json doesn't list it (config/app-dev.json does). Before it is
// listed there it needs persistent storage (Render's instance disk is wiped on every deploy), the
// app-side screen that shows her the id + write token as a recovery code, and the privacy copy that
// says Cyra never receives the backup file rewritten in the same change (docs/PRIVACY-AUDIT.md, L4).
//
// What a blob is: the app's cyra-backup envelope (src/lib/backup.js), already encrypted on her device
// with AES-256-GCM under a key that only her passphrase derives (PBKDF2, 600,000 rounds). This server
// never sees the passphrase, and it never parses, inspects, decrypts or logs a body: the bytes go to
// disk as they arrive and come back as they are.
//
//   POST   /api/backup        body: the bytes (application/octet-stream only)
//                             → 201 { id, token, expiresAt }. id = 16 random bytes, token = 32 random
//                             bytes, both base64url. The token is returned this once; only its
//                             SHA-256 hash is kept, so the server can check it but never give it back.
//   PUT    /api/backup/:id    authorization: Bearer <token>, body: the new bytes → 200 { ok, expiresAt }
//                             (replaces the blob and starts its TTL again)
//   GET    /api/backup/:id    authorization: Bearer <token> → 200 the exact bytes (a read doesn't
//                             extend the TTL)
//   DELETE /api/backup/:id    authorization: Bearer <token> → 200 { ok: true } (row and file gone)
//
// Every answer carries cache-control: no-store. An unknown id, a malformed id, a wrong token and an
// expired blob all answer the same 404 (an expired one is deleted on the spot), so the answers say
// nothing about which ids exist. A missing or malformed authorization header is 401.
// Limits (config.backup): maxBytes per blob (default 4 MiB; larger → 413), maxRows blobs and
// maxTotalBytes in all (default 10,000 and 1 GiB; over either → 507), ttlDays after the last write
// (default 90), and an in-memory rate limit (perMinute per client address, default 10, and
// globalPerMinute overall, default 300; the address is held only as a daily-salted hash for about a
// minute, core/memory.js). A body that isn't application/octet-stream → 415; an empty one → 400.
// Storage: metadata rows in the store's "backups" collection, exactly { id, tokenHash, size,
// createdAt, updatedAt, expiresAt } (ms numbers; never an address, user agent or token), and the
// bytes in <dir>/<id>.bin, written to <id>.<random>.tmp first and then renamed, so a replace is
// all or nothing. dir = config.backup.dir or <DATA_DIR | storage.dir | ./data>/backup. An id is
// checked against ID_RE before any path is built from it. A sweep (hourly, and once at mount)
// deletes expired rows with their files, and .bin/.tmp files with no row that are over an hour old.
// The only log lines: the mount line below, "body refused (<error type>)" and "storage error
// (<code>)". Never a body, a token, an id or an address.
import crypto from "crypto";
import fs from "fs";
import path from "path";
import express from "express";
import { rateLimiter } from "../../core/memory.js";

export const basePath = "/api/backup";
export const ID_RE = /^[A-Za-z0-9_-]{22}$/;
/** An account's lookup key: the app's SHA-256 hash of her normalised email, base64url (src/lib/account.js lookupFor). */
export const LOOKUP_RE = /^[A-Za-z0-9_-]{43}$/;
export const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;
/** sha256(token) as base64url: what the row keeps instead of the token. */
export const hashToken = (t) => crypto.createHash("sha256").update(String(t)).digest("base64url");

const COLL = "backups";
const OCTET = /^application\/octet-stream\b/i;
const BEARER = /^Bearer ([A-Za-z0-9_-]{43})$/;
const HOUR = 3_600_000, DAY = 86_400_000;
const FILE_RE = /^([A-Za-z0-9_-]{22})(\.bin|\.[0-9a-f]{12}\.tmp)$/;
const BASE_RE = /^(new|any|[1-9][0-9]{0,8})$/;
const ACCOUNT = "account";

export function mount(router, ctx, { clock = () => Date.now(), sweepMs = 3_600_000 } = {}) {
  const { store, config } = ctx;
  const c = config.backup || {};
  const maxBytes = c.maxBytes ?? 4194304, ttlDays = c.ttlDays ?? 90, maxRows = c.maxRows ?? 10000, maxTotalBytes = c.maxTotalBytes ?? 1073741824;
  const ttlMs = ttlDays * DAY;
  const dir = c.dir || path.join((process.env.DATA_DIR || "").trim() || config.storage?.dir || "./data", "backup");
  fs.mkdirSync(dir, { recursive: true });
  const allow = rateLimiter({ perMinute: c.perMinute ?? 10, globalPerMinute: c.globalPerMinute ?? 300 });
  const accountTtlMs = (c.accountTtlDays ?? 365) * DAY, perAccount = c.perAccount ?? 3;
  /* Wrong-passphrase back-off (calm R9): at most `failsPerAccount` refused attempts per account lookup in 15 minutes,
     then 429 for that lookup until they age out. In memory only (never on disk), keyed by the lookup hash the request
     carried (never an address), each entry dropped 15 minutes after its last refusal. Unknown lookups count the same
     way, so the answer says nothing about which emails have an account. */
  const failsPer = c.failsPerAccount ?? 10, FAIL_WINDOW = 15 * 60_000;
  const fails = new Map();
  const recentFails = (k) => { const from = clock() - FAIL_WINDOW; const a = (fails.get(k) || []).filter((t) => t > from); if (a.length) fails.set(k, a); else fails.delete(k); return a; };
  const failTimer = setInterval(() => { for (const k of [...fails.keys()]) recentFails(k); }, 60_000); failTimer.unref?.();
  ctx.backupFails = () => fails.size;
  const blobPath = (id) => { if (!ID_RE.test(id)) throw new Error("bad id"); return path.join(dir, `${id}.bin`); };
  const storageError = (res, e) => { console.warn(`[cyra] backup: storage error (${String(e?.code || "unknown").slice(0, 24)})`); res.status(500).json({ error: "storage error" }); };
  const unlinkQuiet = (p) => fs.promises.unlink(p).catch(() => { /* already gone */ });
  // Writes, deletes and sweeps run one at a time, so the caps and the row/file pairs stay consistent.
  let chain = Promise.resolve();
  const serial = (fn) => { const run = chain.then(fn, fn); chain = run.catch(() => {}); return run; };
  const writeBlob = async (id, buf) => {
    const tmp = path.join(dir, `${id}.${crypto.randomBytes(6).toString("hex")}.tmp`);
    try { await fs.promises.writeFile(tmp, buf); await fs.promises.rename(tmp, blobPath(id)); }
    catch (e) { await unlinkQuiet(tmp); throw e; }
  };
  const noStore = (req, res, next) => { res.set("cache-control", "no-store"); next(); };
  const limit = (req, res, next) => (allow(req.ip) ? next() : res.status(429).json({ error: "slow down" }));
  const octet = (req, res, next) => (OCTET.test(req.get("content-type") || "") ? next() : res.status(415).json({ error: "send the encrypted backup as application/octet-stream" }));
  const raw = express.raw({ type: "application/octet-stream", limit: maxBytes });
  // The body parser's own errors are answered here, so Express's default handler (which logs) never sees them.
  const rawError = (err, req, res, next) => {
    if (!err) return next();
    console.warn(`[cyra] backup: body refused (${String(err.type || "unreadable").slice(0, 40)})`);
    if (err.type === "entity.too.large") return res.status(413).json({ error: "backup too large" });
    return res.status(400).json({ error: "body could not be read" });
  };
  const bytes = (req, res, next) => (Buffer.isBuffer(req.body) && req.body.length > 0 ? next() : res.status(400).json({ error: "send the encrypted backup as the request body" }));
  /* The row for :id when the bearer token matches and it hasn't expired (an expired one is deleted now);
     otherwise the answer is sent here and null comes back. */
  const live = async (req, res) => {
    const m = BEARER.exec(req.get("authorization") || "");
    if (!m) { res.status(401).json({ error: "send the backup's write token" }); return null; }
    const id = req.params.id;
    const gone = () => { res.status(404).json({ error: "not found" }); return null; };
    if (typeof id !== "string" || !ID_RE.test(id)) return gone();
    const row = await store.findOne(COLL, (r) => r.id === id && r.kind !== ACCOUNT);
    if (!row) return gone();
    const a = Buffer.from(hashToken(m[1])), b = Buffer.from(String(row.tokenHash));
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return gone();
    if (!(row.expiresAt > clock())) { await serial(async () => { await store.remove(COLL, (r) => r.id === id); await unlinkQuiet(blobPath(id)); }); return gone(); }
    return row;
  };
  const stats = async () => { const rows = await store.find(COLL); return { rows: rows.length, bytes: rows.reduce((n, r) => n + (r.size || 0), 0) }; };

  router.use(noStore);

  /* ---------- Accounts (calm R9): email + passphrase, both turned into keys on her device ----------
     A request names the account with two headers the app derives on the device (src/lib/account.js):
       x-cyra-account: the SHA-256 hash of her normalised email (43 base64url characters; never the email)
       authorization: Bearer <write token> (43 characters, from her passphrase through PBKDF2 600,000 rounds and an
                      HMAC; never the passphrase, and a different key from the one that encrypts the backup)
     One account = one row with that hash AND that token's hash: the same email with another passphrase is another
     account, so no answer ever says whether an email has an account (a wrong passphrase and an unknown email both
     answer 404). Rows: { id, kind: "account", emailHash, tokenHash, version, size, createdAt, updatedAt, expiresAt }
     — id is random and never leaves the server; the bytes are <dir>/<id>.bin like any other blob.
       GET    /api/backup/account/meta  → 200 { version, updatedAt, expiresAt, size }
       GET    /api/backup/account       → 200 the exact bytes (x-cyra-version, x-cyra-updated headers)
       PUT    /api/backup/account       x-cyra-base: new | <version> | any, body: the bytes (octet-stream)
                                         → 201 (new) / 200 { version, updatedAt, expiresAt }
                                         → 409 { version, updatedAt } when the backup isn't the one she last had
       DELETE /api/backup/account       → 200 { ok: true } (row and file gone at once)
     TTL: accountTtlDays (default 365) after the last write; a read doesn't extend it. perAccount (default 3) accounts
     per email hash (507 beyond). The same size, row, total and rate limits as every blob, plus the back-off above. */
  const acctAuth = (req, res) => {
    const lookup = req.get("x-cyra-account") || "", m = BEARER.exec(req.get("authorization") || "");
    if (!LOOKUP_RE.test(lookup) || !m) { res.status(401).json({ error: "send the account's lookup and write token" }); return null; }
    if (recentFails(lookup).length >= failsPer) { res.status(429).json({ error: "too many tries, wait a few minutes" }); return null; }
    return { lookup, tokenHash: hashToken(m[1]) };
  };
  const sameHash = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
  /** The live account row for these credentials (an expired one is deleted now), or null. */
  const acctRow = async (cred) => {
    const rows = await store.find(COLL, (r) => r.kind === ACCOUNT && r.emailHash === cred.lookup);
    const row = rows.find((r) => sameHash(r.tokenHash, cred.tokenHash)) || null;
    if (row && !(row.expiresAt > clock())) { await serial(async () => { await store.remove(COLL, (r) => r.id === row.id); await unlinkQuiet(blobPath(row.id)); }); return null; }
    return row;
  };
  const refused = (res, cred) => { const a = recentFails(cred.lookup); a.push(clock()); fails.set(cred.lookup, a); res.status(404).json({ error: "not found" }); };
  const meta = (row) => ({ version: row.version, updatedAt: new Date(row.updatedAt).toISOString(), expiresAt: new Date(row.expiresAt).toISOString(), size: row.size });

  router.get("/account/meta", limit, async (req, res) => {
    try {
      const cred = acctAuth(req, res); if (!cred) return;
      const row = await acctRow(cred);
      if (!row) return refused(res, cred);
      res.json(meta(row));
    } catch (e) { if (!res.headersSent) storageError(res, e); }
  });

  router.get("/account", limit, async (req, res) => {
    try {
      const cred = acctAuth(req, res); if (!cred) return;
      const row = await acctRow(cred);
      if (!row) return refused(res, cred);
      let buf;
      try { buf = await fs.promises.readFile(blobPath(row.id)); }
      catch (e) {
        if (e?.code !== "ENOENT") return storageError(res, e);
        await serial(() => store.remove(COLL, (r) => r.id === row.id));
        return res.status(404).json({ error: "not found" });
      }
      res.set({ "content-type": "application/octet-stream", "x-content-type-options": "nosniff", "x-cyra-version": String(row.version), "x-cyra-updated": new Date(row.updatedAt).toISOString() });
      res.status(200).end(buf);
    } catch (e) { if (!res.headersSent) storageError(res, e); }
  });

  // The credentials and the base are checked before the body is read; a refused PUT never reaches the parser.
  router.put("/account", limit, octet, (req, res, next) => {
    const cred = acctAuth(req, res); if (!cred) return;
    const base = req.get("x-cyra-base") || "";
    if (!BASE_RE.test(base)) return res.status(400).json({ error: "send x-cyra-base: new, any or the version you last had" });
    req.cyraAccount = { ...cred, base };
    next();
  }, raw, rawError, bytes, async (req, res) => {
    const { lookup, tokenHash, base } = req.cyraAccount;
    try {
      await serial(async () => {
        const row = await acctRow({ lookup, tokenHash });
        const now = clock(), expiresAt = now + accountTtlMs;
        const { rows: n, bytes: total } = await stats();
        if (!row) {
          if (base !== "new") return refused(res, { lookup });
          const same = await store.find(COLL, (r) => r.kind === ACCOUNT && r.emailHash === lookup);
          if (same.length >= perAccount || n >= maxRows || total + req.body.length > maxTotalBytes) return res.status(507).json({ error: "cloud backup is full right now" });
          const id = crypto.randomBytes(16).toString("base64url");
          await writeBlob(id, req.body);
          const fresh = { id, kind: ACCOUNT, emailHash: lookup, tokenHash, version: 1, size: req.body.length, createdAt: now, updatedAt: now, expiresAt };
          try { await store.insert(COLL, fresh); } catch (e) { await unlinkQuiet(blobPath(id)); throw e; }
          return res.status(201).json(meta(fresh));
        }
        if (base !== "any" && base !== String(row.version)) return res.status(409).json({ error: "the backup changed", version: row.version, updatedAt: new Date(row.updatedAt).toISOString() });
        if (total - (row.size || 0) + req.body.length > maxTotalBytes) return res.status(507).json({ error: "cloud backup is full right now" });
        await writeBlob(row.id, req.body);
        const next = { size: req.body.length, updatedAt: now, expiresAt, version: row.version + 1 };
        await store.update(COLL, (r) => r.id === row.id, next);
        res.json(meta({ ...row, ...next }));
      });
    } catch (e) { if (!res.headersSent) storageError(res, e); }
  });

  router.delete("/account", limit, async (req, res) => {
    try {
      const cred = acctAuth(req, res); if (!cred) return;
      const row = await acctRow(cred);
      if (!row) return refused(res, cred);
      await serial(async () => { await store.remove(COLL, (r) => r.id === row.id); await unlinkQuiet(blobPath(row.id)); });
      res.json({ ok: true });
    } catch (e) { if (!res.headersSent) storageError(res, e); }
  });

  router.post("/", limit, octet, raw, rawError, bytes, async (req, res) => {
    try {
      await serial(async () => {
        const { rows, bytes: total } = await stats();
        if (rows >= maxRows || total + req.body.length > maxTotalBytes) return res.status(507).json({ error: "cloud backup is full right now" });
        const id = crypto.randomBytes(16).toString("base64url"), token = crypto.randomBytes(32).toString("base64url");
        const now = clock(), expiresAt = now + ttlMs;
        await writeBlob(id, req.body);
        try { await store.insert(COLL, { id, tokenHash: hashToken(token), size: req.body.length, createdAt: now, updatedAt: now, expiresAt }); }
        catch (e) { await unlinkQuiet(blobPath(id)); throw e; }
        res.status(201).json({ id, token, expiresAt: new Date(expiresAt).toISOString() });
      });
    } catch (e) { if (!res.headersSent) storageError(res, e); }
  });

  router.put("/:id", limit, octet, async (req, res, next) => { try { if (await live(req, res)) next(); } catch (e) { storageError(res, e); } }, raw, rawError, bytes, async (req, res) => {
    const id = req.params.id;
    try {
      await serial(async () => {
        const row = await store.findOne(COLL, (r) => r.id === id && r.kind !== ACCOUNT);
        if (!row) return res.status(404).json({ error: "not found" }); // deleted meanwhile
        const { bytes: total } = await stats();
        if (total - (row.size || 0) + req.body.length > maxTotalBytes) return res.status(507).json({ error: "cloud backup is full right now" });
        const now = clock(), expiresAt = now + ttlMs;
        await writeBlob(id, req.body);
        await store.update(COLL, (r) => r.id === id, { size: req.body.length, updatedAt: now, expiresAt });
        res.json({ ok: true, expiresAt: new Date(expiresAt).toISOString() });
      });
    } catch (e) { if (!res.headersSent) storageError(res, e); }
  });

  router.get("/:id", limit, async (req, res) => {
    try {
      const row = await live(req, res);
      if (!row) return;
      let buf;
      try { buf = await fs.promises.readFile(blobPath(row.id)); }
      catch (e) {
        if (e?.code !== "ENOENT") return storageError(res, e);
        await serial(() => store.remove(COLL, (r) => r.id === row.id)); // its file is gone: so is the backup
        return res.status(404).json({ error: "not found" });
      }
      res.set({ "content-type": "application/octet-stream", "x-content-type-options": "nosniff" });
      res.status(200).end(buf);
    } catch (e) { if (!res.headersSent) storageError(res, e); }
  });

  router.delete("/:id", limit, async (req, res) => {
    try {
      const row = await live(req, res);
      if (!row) return;
      await serial(async () => { await store.remove(COLL, (r) => r.id === row.id); await unlinkQuiet(blobPath(row.id)); });
      res.json({ ok: true });
    } catch (e) { if (!res.headersSent) storageError(res, e); }
  });

  /** Deletes expired rows and their files, and row-less .bin/.tmp files over an hour old. */
  const sweep = () => serial(async () => {
    const now = clock();
    const expired = await store.find(COLL, (r) => !(r.expiresAt > now));
    if (expired.length) {
      await store.remove(COLL, (r) => !(r.expiresAt > now));
      for (const r of expired) if (ID_RE.test(r.id)) await unlinkQuiet(blobPath(r.id));
    }
    const keep = new Set((await store.find(COLL)).map((r) => r.id));
    let orphans = 0;
    for (const f of await fs.promises.readdir(dir)) {
      const m = FILE_RE.exec(f);
      if (!m || (m[2] === ".bin" && keep.has(m[1]))) continue;
      const st = await fs.promises.stat(path.join(dir, f)).catch(() => null);
      if (st && now - st.mtimeMs > HOUR) { await unlinkQuiet(path.join(dir, f)); orphans++; }
    }
    return { expired: expired.length, orphans };
  }).catch((e) => { console.warn(`[cyra] backup: storage error (${String(e?.code || "unknown").slice(0, 24)})`); return { expired: 0, orphans: 0 }; });
  ctx.backupSweep = sweep;
  ctx.backupStats = stats;
  sweep();
  if (sweepMs > 0) setInterval(sweep, sweepMs).unref();
  console.log(`[cyra] backup: on (max ${maxBytes} bytes each, kept ${ttlDays} days after the last write)`);
}
