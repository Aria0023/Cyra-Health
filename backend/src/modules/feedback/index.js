// Feedback from the app, and its inbox for the portal's owners (docs/plans/launch-tools.md Task 3).
// The first FREE TEXT a user can send to this server. She is asked not to include health details and nothing from her
// log is attached, but whatever she types is stored as she wrote it: treat the "feedback" collection as possibly
// holding health details (docs/PRIVACY-AUDIT.md; counsel note in public/legal/health-data.html).
//
//   POST   /api/feedback            public. Body (anything else is DROPPED, never stored):
//                                     { kind: "feedback" | "problem", message (1..2000 characters), build, platform, language }
//                                     { ..., reply: true, email }  only with her "It's OK to reply to me" switch on
//   GET    /api/feedback            OWNER: newest first; ?kind=feedback|problem  ?status=open|handled; { items, open, total }
//   PATCH  /api/feedback/:id        OWNER: { status: "open" | "handled" }
//   DELETE /api/feedback/:id        OWNER: deletes it
//
// What is stored per message ("feedback" collection):
//   { id, day (the UTC DATE it arrived, no time of day), kind, message, build, platform, language, status, handledDay }
//   and, ONLY when she chose reply: { reply: true, email, accountId }.
// Reply: the request must carry her Solia Health session (Authorization: Bearer), and the email kept is her ACCOUNT's
// (the body's must match it), so nobody can attach someone else's address. Without reply nothing links the message to an
// account: a session token on such a request is not even looked at.
// Kept 365 days from the day it arrived, then deleted (on every write and read, and hourly). A message linked to an
// account is deleted with the account (the accounts module's delete hook).
// Rate limit: in memory per address (core/memory.js: a salted hash, dropped about a minute after the last request).
// NEVER LOGGED: no message, email or body reaches the log; a failure logs a fixed category only (server.js gives this
// path its own JSON parser so a body that can't be parsed isn't logged by Express either). Never sent to Anthropic:
// the weekly owner report gets the COUNT of open messages only.
// Needs the shop module (the portal's sign-in) mounted before it for the owner routes; the accounts module for reply.
import crypto from "crypto";
import { rateLimiter } from "../../core/memory.js";
import { normEmail, isEmail } from "../accounts/index.js";

export const basePath = "/api/feedback";
export const FEEDBACK_MAX = 2000;
export const FEEDBACK_KEEP_DAYS = 365;
export const KINDS = Object.freeze(["feedback", "problem"]);
export const PLATFORMS = Object.freeze(["web", "ios", "android"]);
const DAY = 86_400_000;
const dayOf = (ms) => new Date(ms).toISOString().slice(0, 10);
const line = (v, max) => String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);

/** Her text: plain line endings, no control characters, trimmed. Never shortened (too long is refused). */
export const cleanMessage = (v) => (typeof v === "string" ? v.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, "").trim() : "");

/**
 * The whitelist. body → { value: { kind, message, build, platform, language, reply, email } } | { error }.
 * Only these fields are read; every other field of the body is dropped here and never reaches the store.
 */
export function validateFeedback(b) {
  if (!b || typeof b !== "object" || Array.isArray(b)) return { error: "send a JSON object" };
  if (!KINDS.includes(b.kind)) return { error: "kind must be feedback or problem" };
  if (typeof b.message !== "string") return { error: "message must be text" };
  const message = cleanMessage(b.message);
  if (!message) return { error: "the message is empty" };
  if (message.length > FEEDBACK_MAX) return { error: `the message is longer than ${FEEDBACK_MAX} characters` };
  const reply = b.reply === true;
  const email = reply ? normEmail(b.email) : "";
  if (reply && !isEmail(email)) return { error: "reply needs your account email" };
  return { value: { kind: b.kind, message, build: line(b.build, 40), platform: PLATFORMS.includes(b.platform) ? b.platform : "web", language: /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$/.test(String(b.language ?? "")) ? String(b.language) : "en", reply, email } };
}

/** The rows to keep: those that arrived within the last `days` days. */
export const keepSince = (nowMs, days = FEEDBACK_KEEP_DAYS) => dayOf(nowMs - days * DAY);

export function mount(router, ctx, { clock = Date.now, sweepMs = 3_600_000 } = {}) {
  const { config, store } = ctx;
  const cfg = config.feedback || {};
  const L = {
    send: rateLimiter({ perMinute: cfg.perMinute || 5, globalPerMinute: cfg.globalPerMinute || 120 }),
    read: rateLimiter({ perMinute: cfg.readPerMinute || 120 }),
    write: rateLimiter({ perMinute: cfg.writePerMinute || 60 }),
  };
  const noStore = (res) => res.set("cache-control", "no-store");
  const tooMany = (res) => res.status(429).json({ error: "too many requests — try again in a minute" });

  /** Deletes what is older than 365 days. Never throws. */
  async function prune() {
    const cut = keepSince(clock());
    try { return await store.remove("feedback", (r) => !(typeof r.day === "string" && r.day >= cut)); } catch { return 0; }
  }
  let timer = null;
  if (sweepMs > 0) { timer = setInterval(() => { prune(); }, sweepMs); timer.unref?.(); }
  ctx.onShutdown?.push(async () => { if (timer) clearInterval(timer); for (const l of Object.values(L)) l.stop(); });
  ctx.feedbackPrune = prune; // tests

  // Deleted with the account: only messages she chose to link (reply) carry an account id at all.
  ctx.onAccountDelete ||= [];
  ctx.onAccountDelete.push(async ({ id }) => { if (id) await store.remove("feedback", (r) => r.accountId === id); });

  router.post("/", async (req, res) => {
    noStore(res);
    if (!L.send(req.ip)) return tooMany(res);
    const v = validateFeedback(req.body);
    if (v.error) return res.status(400).json({ error: v.error });
    const f = v.value;
    const row = { id: crypto.randomBytes(9).toString("base64url"), day: dayOf(clock()), kind: f.kind, message: f.message, build: f.build, platform: f.platform, language: f.language, status: "open", handledDay: null };
    if (f.reply) {
      const w = typeof ctx.accountWho === "function" ? await ctx.accountWho(req) : null;
      if (!w) return res.status(401).json({ error: "sign in again to allow a reply, or send it without one" });
      if (!isEmail(w.acct.email) || normEmail(w.acct.email) !== f.email) return res.status(400).json({ error: "reply needs your account email" });
      Object.assign(row, { reply: true, email: normEmail(w.acct.email), accountId: w.acct.id });
    }
    try { await prune(); await store.insert("feedback", row); }
    catch { console.warn("[cyra] feedback: a message could not be saved"); return res.status(500).json({ error: "something went wrong" }); }
    res.status(201).json({ ok: true });
  });

  /* ---------- the owners' inbox ---------- */
  const publicRow = (r) => ({ id: r.id, day: r.day, kind: r.kind, message: r.message, build: r.build, platform: r.platform, language: r.language, status: r.status === "handled" ? "handled" : "open", handledDay: r.handledDay || null, reply: r.reply === true, email: r.reply === true ? r.email : null });
  ctx.feedbackCounts = async (fromDay = null, toDay = null) => { // counts only: the weekly report and the Overview
    await prune();
    const rows = await store.find("feedback");
    return { open: rows.filter((r) => r.status !== "handled").length, total: rows.length, received: fromDay ? rows.filter((r) => r.day >= fromDay && r.day <= (toDay || "9999")).length : null };
  };
  if (ctx.portal) {
    const owner = ctx.portal.auth("owner"), { audit } = ctx.portal;
    const reading = (req, res, next) => (L.read(req.ip) ? next() : tooMany(res)), writing = (req, res, next) => (L.write(req.ip) ? next() : tooMany(res));
    router.get("/", reading, owner, async (req, res) => {
      noStore(res);
      await prune();
      const all = await store.find("feedback");
      const kind = KINDS.includes(req.query.kind) ? req.query.kind : null, status = ["open", "handled"].includes(req.query.status) ? req.query.status : null;
      const items = all.map(publicRow).filter((r) => (!kind || r.kind === kind) && (!status || r.status === status)).reverse();
      res.json({ items, open: all.filter((r) => r.status !== "handled").length, total: all.length, keptDays: FEEDBACK_KEEP_DAYS });
    });
    router.get("/count", reading, owner, async (req, res) => { noStore(res); const c = await ctx.feedbackCounts(); res.json({ open: c.open, total: c.total }); });
    router.patch("/:id", writing, owner, async (req, res) => {
      noStore(res);
      const status = req.body?.status;
      if (status !== "open" && status !== "handled") return res.status(400).json({ error: "status must be open or handled" });
      const id = String(req.params.id).slice(0, 40);
      const n = await store.update("feedback", (r) => r.id === id, { status, handledDay: status === "handled" ? dayOf(clock()) : null });
      if (!n) return res.status(404).json({ error: "that message isn't here any more" });
      await audit(req.portal.email, status === "handled" ? "feedback handled" : "feedback reopened", `feedback:${id}`, {});
      res.json({ item: publicRow(await store.findOne("feedback", (r) => r.id === id)) });
    });
    router.delete("/:id", writing, owner, async (req, res) => {
      noStore(res);
      const id = String(req.params.id).slice(0, 40);
      const n = await store.remove("feedback", (r) => r.id === id);
      if (!n) return res.status(404).json({ error: "that message isn't here any more" });
      await audit(req.portal.email, "feedback deleted", `feedback:${id}`, {});
      res.sendStatus(204);
    });
  }

  router.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
    console.warn(`[cyra] feedback: ${String(err?.type || err?.code || "error").slice(0, 40)}`);
    if (!res.headersSent) res.status(err?.status && err.status < 500 ? err.status : 500).json({ error: "something went wrong" });
  });
}
