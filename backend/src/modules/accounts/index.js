// Accounts (owner request 2026-11-12, docs/plans/account-wearables-evidence.md Task 1): sign-in with Apple, Google,
// Facebook or a one-time email code. The server keeps the ACCOUNT RECORD ONLY — never health data:
//   { id, provider, key, email, name, createdAt }
//     id         random, 22 characters (what the app's session token names)
//     provider   "apple" | "google" | "facebook" | "email"
//     key        HMAC-SHA256(AUTH_SECRET-derived key, "<provider>:<provider account id or email>"), so the same
//                sign-in finds the same account again without the provider's raw account id being stored
//     email      the sign-in email: the address she typed (email), or the one Apple/Google verified (for Apple this
//                may be a private relay address). Facebook gives no "verified" signal, so a Facebook account keeps
//                no email (the oauth module never passes an unverified one on).
//     name       the display name the provider sent, if any (never asked for by email sign-in)
//     createdAt  ISO time
// and one row per signed-in device in "account_sessions": { sid (SHA-256 of the session id), accountId, createdAt }.
// Both collections live in the JSON store under DATA_DIR like the other modules. Nothing else is kept: no IP
// address, no device name, no check-in, no health field.
//
//   GET    /api/accounts/config               { providers: { apple, google, facebook, email } } — which sign-ins work here
//   POST   /api/accounts/email/start {email}  sends a 6-digit code (10 minutes, 5 tries); { sent: true[, dev: true] }
//   POST   /api/accounts/email/verify {email, code} → { token, account }
//   POST   /api/accounts/provider {code[, verifier]} → { token, account }: completes an Apple/Google/Facebook sign-in
//          started at /api/oauth/:provider/start (the oauth module's one-time code, taken here instead of /exchange)
//   GET    /api/accounts/me                    (Authorization: Bearer <token>) → { account }
//   POST   /api/accounts/sign-out              ends this device's session (always 204)
//   DELETE /api/accounts/me                    deletes the account record and every session of it (204)
//
// Email codes: sent through Resend's HTTPS API with fetch (RESEND_API_KEY, EMAIL_FROM). Without a key, a development
// server writes the code to its own console and answers { dev: true }; a production server reports email sign-in as
// not configured (503). Codes are kept only in memory, as a salted hash, and are gone on expiry, on use, after the
// fifth wrong try, or at restart. Requests are rate-limited per client (salted, daily-rotated hash; core/memory.js)
// and per address (3 codes per 10 minutes).
//
// Session token: base64url(JSON { a: account id, s: session id, x: expiry ms }) + "." + HMAC-SHA256 signature with a
// key derived from AUTH_SECRET (HKDF, its own label). It lives on her device in a device-only slot that never goes
// into a backup. Signing out deletes the session row, so the token stops working even before it expires (180 days).
//
// Logs: never an email address, a code, a token or a name in production — only fixed categories.
import crypto from "crypto";
import { rateLimiter } from "../../core/memory.js";

export const basePath = "/api/accounts";

const env = (k) => (process.env[k] || "").trim();
const DAY = 86_400_000;
export const CODE_TTL_MS = 10 * 60_000;
export const CODE_TRIES = 5;
export const TOKEN_DAYS = 180;
const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;
export const normEmail = (v) => (typeof v === "string" ? v.trim().toLowerCase() : "");
export const isEmail = (v) => { const e = normEmail(v); return e.length <= 254 && EMAIL_RE.test(e); };
const text = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** The HMAC key for account lookups and session tokens, derived from AUTH_SECRET (never the secret itself). */
export function accountKeys(secret) {
  if (!secret) throw new Error("AUTH_SECRET is required for accounts");
  const k = (label) => Buffer.from(crypto.hkdfSync("sha256", Buffer.from(String(secret), "utf8"), Buffer.from("cyra-accounts-v1"), Buffer.from(label), 32));
  return { lookup: k("account lookup"), token: k("session token") };
}
/** HMAC lookup key for one sign-in ("google:<sub>", "email:<address>"). */
export const lookupKey = (key, provider, subject) => crypto.createHmac("sha256", key).update(`${provider}:${subject}`).digest("base64url");

/* ---------- session tokens ---------- */
export function signToken(payload, key) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${crypto.createHmac("sha256", key).update(body).digest("base64url")}`;
}
/** The payload, or null when malformed, forged or expired. */
export function openToken(token, key, now = Date.now()) {
  const t = String(token || "");
  if (t.length > 600 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(t)) return null;
  const [body, sig] = t.split(".");
  const want = Buffer.from(crypto.createHmac("sha256", key).update(body).digest("base64url"));
  const got = Buffer.from(sig);
  if (want.length !== got.length || !crypto.timingSafeEqual(want, got)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    return p && typeof p.a === "string" && typeof p.s === "string" && typeof p.x === "number" && p.x > now ? p : null;
  } catch { return null; }
}
const sidHash = (sid) => crypto.createHash("sha256").update(String(sid)).digest("base64url");

/* ---------- one-time email codes (memory only) ---------- */
/** issue(email) → the 6-digit code (kept only as a salted hash); check(email, code) → "ok" | "wrong" | "expired" | "locked" | "none".
    A code is single use, expires after ttlMs, and is dropped after `tries` wrong attempts. */
export function codeBook({ ttlMs = CODE_TTL_MS, tries = CODE_TRIES, clock = Date.now, sweepMs = 30_000 } = {}) {
  const salt = crypto.randomBytes(16);
  const h = (email, code) => crypto.createHash("sha256").update(salt).update(`${email}\n${code}`).digest();
  const m = new Map(); // email → { hash, exp, left }
  const sweep = () => { const now = clock(); for (const [k, v] of m) if (v.exp <= now) m.delete(k); };
  const timer = sweepMs > 0 ? setInterval(sweep, sweepMs) : null;
  timer?.unref?.();
  return {
    issue(email) {
      const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
      m.set(email, { hash: h(email, code), exp: clock() + ttlMs, left: tries });
      return code;
    },
    check(email, code) {
      const e = m.get(email);
      if (!e) return "none";
      if (e.exp <= clock()) { m.delete(email); return "expired"; }
      const c = String(code || "").replace(/\s+/g, "");
      if (/^\d{6}$/.test(c) && crypto.timingSafeEqual(h(email, c), e.hash)) { m.delete(email); return "ok"; }
      e.left -= 1;
      if (e.left <= 0) { m.delete(email); return "locked"; }
      return "wrong";
    },
    drop(email) { m.delete(email); },
    sweep,
    get size() { return m.size; },
    stop() { if (timer) clearInterval(timer); },
  };
}

/** Per-address limit: at most `max` codes per `windowMs` for one email (memory only, entries dropped when stale). */
export function perAddress({ max = 3, windowMs = 10 * 60_000, clock = Date.now } = {}) {
  const m = new Map();
  return (email) => {
    const now = clock();
    for (const [k, arr] of m) { const keep = arr.filter((t) => t > now - windowMs); if (keep.length) m.set(k, keep); else m.delete(k); }
    const arr = m.get(email) || [];
    if (arr.length >= max) return false;
    arr.push(now); m.set(email, arr);
    return true;
  };
}

/* ---------- sending the code ---------- */
export function emailSender({ production }) {
  const key = env("RESEND_API_KEY"), from = env("EMAIL_FROM");
  const base = (env("RESEND_API_BASE") || "https://api.resend.com").replace(/\/$/, ""); // tests only (accounts-smoke)
  if (key && from) {
    return {
      ready: true, dev: false,
      async send(to, code) {
        const r = await fetch(`${base}/emails`, {
          method: "POST",
          headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
          body: JSON.stringify({
            from, to: [to], subject: `Your Solia Health sign-in code: ${code}`,
            text: `Your Solia Health sign-in code is ${code}.\n\nIt works once, for 10 minutes. If you didn't ask for it, you can ignore this email: nothing happens without the code.\n\nSolia Health never asks for this code by phone or message.`,
          }),
          signal: AbortSignal.timeout(10_000),
        });
        if (!r.ok) throw Object.assign(new Error("send"), { cat: `email provider answered ${r.status}` });
      },
    };
  }
  if (!production) {
    return {
      ready: true, dev: true,
      async send(to, code) { console.log(`[cyra] accounts (development, RESEND_API_KEY not set): sign-in code for ${to} is ${code}`); },
    };
  }
  return { ready: false, dev: false, async send() { throw Object.assign(new Error("send"), { cat: "email not configured" }); } };
}

/** What the app sees of an account. */
export const publicAccount = (a) => ({ id: a.id, provider: a.provider, email: a.email || "", name: a.name || "", createdAt: a.createdAt });

export function mount(router, ctx, { clock = Date.now, sweepMs = 30_000, sender = null } = {}) {
  const { config, store } = ctx;
  const keys = accountKeys(config.authSecret);
  const send = sender || emailSender({ production: !!config.production });
  const cfg = config.accounts || {};
  const codes = codeBook({ ttlMs: cfg.codeTtlMs || CODE_TTL_MS, tries: cfg.codeTries || CODE_TRIES, clock, sweepMs });
  const perEmail = perAddress({ max: cfg.codesPerAddress || 3, clock });
  const startLimit = rateLimiter({ perMinute: cfg.startPerMinute || 5, globalPerMinute: cfg.startGlobalPerMinute || 300 });
  const verifyLimit = rateLimiter({ perMinute: cfg.verifyPerMinute || 20 });
  const otherLimit = rateLimiter({ perMinute: cfg.perMinute || 60 });
  ctx.onShutdown?.push(async () => { codes.stop(); startLimit.stop(); verifyLimit.stop(); otherLimit.stop(); });
  ctx.accountCodeCount = () => codes.size; // tests

  const noStore = (res) => res.set("cache-control", "no-store");
  const oauthProviders = () => { try { return ctx.oauth?.configured?.() || {}; } catch { return {}; } };

  async function signInAs(provider, subject, { email = "", name = "" } = {}) {
    const key = lookupKey(keys.lookup, provider, subject);
    let acct = await store.findOne("accounts", (a) => a.key === key);
    if (!acct) {
      acct = { id: crypto.randomBytes(16).toString("base64url").slice(0, 22), provider, key, email: text(email, 320), name: text(name, 200), createdAt: new Date(clock()).toISOString() };
      await store.insert("accounts", acct);
    } else {
      // Keep what the provider says now (Apple sends the name only on a first authorization: an empty one keeps the old).
      const patch = {};
      if (email && email !== acct.email) patch.email = text(email, 320);
      if (name && name !== acct.name) patch.name = text(name, 200);
      if (Object.keys(patch).length) { await store.update("accounts", (a) => a.id === acct.id, patch); acct = { ...acct, ...patch }; }
    }
    const sid = crypto.randomBytes(24).toString("base64url");
    await store.insert("account_sessions", { sid: sidHash(sid), accountId: acct.id, createdAt: new Date(clock()).toISOString() });
    const token = signToken({ a: acct.id, s: sid, x: clock() + TOKEN_DAYS * DAY }, keys.token);
    return { token, account: publicAccount(acct) };
  }

  /** The signed-in account for this request, or null. */
  async function who(req) {
    const m = /^Bearer\s+(\S+)$/.exec(req.get("authorization") || "");
    const p = m && openToken(m[1], keys.token, clock());
    if (!p) return null;
    const s = await store.findOne("account_sessions", (r) => r.sid === sidHash(p.s) && r.accountId === p.a);
    if (!s) return null;
    const acct = await store.findOne("accounts", (a) => a.id === p.a);
    return acct ? { acct, sid: sidHash(p.s) } : null;
  }

  router.get("/config", (req, res) => {
    noStore(res);
    const p = oauthProviders();
    res.json({ providers: { apple: p.apple === true, google: p.google === true, facebook: p.facebook === true, email: send.ready === true } });
  });

  router.post("/email/start", async (req, res) => {
    noStore(res);
    if (!startLimit(req.ip)) return res.status(429).json({ error: "too many requests — try again in a minute" });
    const email = normEmail(req.body?.email);
    if (!isEmail(email)) return res.status(400).json({ error: "email address not valid" });
    if (!send.ready) return res.status(503).json({ error: "email sign-in is not set up on this server" });
    if (!perEmail(email)) return res.status(429).json({ error: "too many codes for this address — try again in a few minutes" });
    const code = codes.issue(email);
    try { await send.send(email, code); }
    catch (e) { codes.drop(email); console.warn(`[cyra] accounts: code not sent (${e?.cat || "network"})`); return res.status(502).json({ error: "the code couldn't be sent — try again" }); }
    res.json({ sent: true, ...(send.dev ? { dev: true } : {}) });
  });

  router.post("/email/verify", async (req, res) => {
    noStore(res);
    if (!verifyLimit(req.ip)) return res.status(429).json({ error: "too many tries — wait a minute" });
    const email = normEmail(req.body?.email);
    if (!isEmail(email)) return res.status(400).json({ error: "email address not valid" });
    const r = codes.check(email, req.body?.code);
    if (r === "wrong") return res.status(401).json({ error: "that code isn't right", why: "wrong" });
    if (r === "locked") return res.status(401).json({ error: "too many wrong codes — ask for a new one", why: "locked" });
    if (r !== "ok") return res.status(401).json({ error: "that code has expired — ask for a new one", why: "expired" });
    res.json(await signInAs("email", email, { email }));
  });

  router.post("/provider", async (req, res) => {
    noStore(res);
    if (!otherLimit(req.ip)) return res.status(429).json({ error: "too many requests — try again in a minute" });
    const h = ctx.oauth?.take ? ctx.oauth.take(String(req.body?.code || ""), req.body?.verifier) : null;
    if (!h || !h.subject) return res.status(404).json({ error: "sign-in code unknown, used, or expired" });
    res.json(await signInAs(h.identity.provider, h.subject, { email: h.identity.emailVerified ? h.identity.email : "", name: h.identity.name }));
  });

  router.get("/me", async (req, res) => {
    noStore(res);
    if (!otherLimit(req.ip)) return res.status(429).json({ error: "too many requests — try again in a minute" });
    const w = await who(req);
    if (!w) return res.status(401).json({ error: "not signed in" });
    res.json({ account: publicAccount(w.acct) });
  });

  router.post("/sign-out", async (req, res) => {
    noStore(res);
    const w = await who(req);
    if (w) await store.remove("account_sessions", (r) => r.sid === w.sid);
    res.sendStatus(204);
  });

  router.delete("/me", async (req, res) => {
    noStore(res);
    if (!otherLimit(req.ip)) return res.status(429).json({ error: "too many requests — try again in a minute" });
    const w = await who(req);
    if (!w) return res.status(401).json({ error: "not signed in" });
    await store.remove("account_sessions", (r) => r.accountId === w.acct.id);
    await store.remove("accounts", (a) => a.id === w.acct.id);
    res.sendStatus(204);
  });
}
