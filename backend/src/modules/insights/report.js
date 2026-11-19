// The weekly owner report: schedule, settings, preview and send (docs/plans/tracking-reports.md Task 4). OWNER ONLY.
// The report's words and numbers are built in ./weekly.js from TOTALS ONLY; this file reads the totals, asks Claude for
// the short summary (through the ai module's client; a plain template when there is no key or the call fails), emails it
// with the existing Resend sender, and makes sure a week is never sent twice.
//
//   GET  /api/insights/weekly           settings and status: on/off, recipients, last and next send, whether email and AI are set up
//   PUT  /api/insights/weekly           { enabled?, recipients? } (recipients: at most 10 valid addresses; default = ADMIN_EMAILS)
//   POST /api/insights/weekly/preview   builds the report for the latest complete week and returns exactly what would be sent
//   POST /api/insights/weekly/send      { previewId? } sends now: the previewed draft when its id is given (so what was
//                                       read is what is sent), else a fresh one. Never changes the weekly schedule.
//
// Schedule: checked when the server starts and every hour (an in-process timer); due every Monday 14:00 UTC, and for
// three days after it if the server was down. The slot is written to the store ("insights_weekly", DATA_DIR) BEFORE the
// emails go out, so a restart or a second instance can't send the same week twice. Without a persistent DATA_DIR the
// stamp is lost on a redeploy and a redeploy inside those three days sends the week again: attach a disk (render.yaml).
//
// What goes where: the totals JSON goes to Anthropic (when ANTHROPIC_API_KEY is set) to write the summary, and the
// finished email goes to Resend for delivery. Both hold business totals and brand / product names only: no personal
// data and no health data (the server has none). Logs: never an address or the report's text; fixed categories only.
import crypto from "crypto";
import { slotToSend, dueSlot, nextSlot, weekOf, buildTotals, composeReport, cleanSummary, cleanRecipients, WEEKLY_SYSTEM, weeklyPrompt } from "./weekly.js";
import { RcError } from "../subscriptions/revenuecat.js";
import { isEmail, normEmail } from "../accounts/index.js";

const DRAFT_TTL_MS = 30 * 60_000;

export function mountWeekly(router, { ctx, store, clock, reading, writing, sending, owner, rc, affiliates, impact, mailer, production, timerMs = 3_600_000, spend = null }) {
  const { audit, owners } = ctx.portal;
  const now = () => new Date(clock()).toISOString();
  const mail = mailer
    ? { ready: true, dev: false, send: (to, subject, text) => mailer.send(to, subject, text) }
    : production ? { ready: false, dev: false } : { ready: true, dev: true, send: async (to, subject) => { console.log(`[cyra] insights (development, RESEND_API_KEY not set): the weekly report "${subject}" was not emailed`); } };

  /* ---------- settings ---------- */
  async function state() {
    const row = await store.findOne("insights_weekly", (r) => r.key === "state");
    return { enabled: row ? row.enabled !== false : true, recipients: Array.isArray(row?.recipients) && row.recipients.length ? row.recipients : null, lastSlot: row?.lastSlot || null, lastSentAt: row?.lastSentAt || null, lastResult: row?.lastResult || null };
  }
  const saveState = (patch) => store.apply("insights_weekly", (rows) => { const r = rows.find((x) => x.key === "state"); if (r) Object.assign(r, patch); else rows.push({ key: "state", enabled: true, recipients: null, lastSlot: null, lastSentAt: null, lastResult: null, ...patch }); });
  const recipientsOf = (st) => st.recipients || owners();

  /* ---------- the totals ---------- */
  async function gather(slotMs) {
    const week = weekOf(slotMs);
    const brands = new Map((await store.find("shop_brands")).map((b) => [b.id, b.name]));
    const products = await store.find("shop_products");
    const pname = new Map(products.map((p) => [p.id, p.published?.name || p.name]));
    let rcPart = { configured: !!rc?.configured, missing: rc?.missing || [] };
    if (rc?.configured) {
      try { rcPart = { configured: true, metrics: (await rc.metrics()).metrics }; }
      catch (e) { rcPart = { configured: true, error: e instanceof RcError ? e.cat : "RevenueCat could not be read" }; }
    }
    let imPart = { configured: !!impact?.configured, missing: impact?.missing || [] };
    if (impact?.configured) {
      const a = await affiliates.impactPerformance(week.from, week.to), b = await affiliates.impactPerformance(week.prevFrom, week.prevTo);
      imPart = a.error || b.error ? { configured: true, error: a.error || b.error } : { configured: true, now: a.rows, before: b.rows };
    }
    const azMeta = await affiliates.amazonMeta();
    await ctx.shopFlushTaps?.();
    return buildTotals({
      week, nowMs: clock(),
      accounts: (await store.find("accounts")).map((a) => ({ provider: a.provider, createdAt: a.createdAt, lastSeenDay: a.lastSeenDay })),
      taps: await store.find("shop_taps", (r) => r.day >= week.prevFrom && r.day <= week.to),
      names: { product: (id) => pname.get(id), brand: (id) => brands.get(id) },
      rc: rcPart, impact: imPart,
      amazon: azMeta ? { uploadedAt: azMeta.uploadedAt, days: await affiliates.amazonDays() } : null,
      applications: (await store.find("shop_applications")).map((a) => ({ status: a.status, at: a.at })),
      products: products.map((p) => ({ status: p.status })),
      partners: (await store.find("shop_partners")).length,
      aiUsage: (await store.find("ai_usage")).map((r) => ({ id: `:${String(r.id || "").split(":").pop()}`, evidence: r.evidence, chat: r.chat, weekly: r.weekly })),
      aiCost: spend ? await spend.forWeek(week) : null,
      // feedback from the app: COUNTS only. The text is never read here and never goes to Anthropic or into the email.
      feedback: (await store.find("feedback")).map((r) => ({ status: r.status === "handled" ? "handled" : "open", day: typeof r.day === "string" ? r.day : "" })),
    });
  }

  /** The summary from Claude, or "" with the reason the plain template is used. Never throws. */
  async function summarise(totals) {
    const write = ctx.aiWrite;
    if (typeof write !== "function") return { summary: "", why: "ANTHROPIC_API_KEY isn't set on the server" };
    try {
      const s = cleanSummary(await write({ system: WEEKLY_SYSTEM, prompt: weeklyPrompt(totals), maxTokens: 4000, timeoutMs: 60_000 }));
      return s ? { summary: s, why: null } : { summary: "", why: "the AI's answer couldn't be used" };
    } catch (e) {
      const kind = String(e?.cat || "the AI call failed").slice(0, 80);
      console.warn(`[cyra] insights: weekly summary (${kind}); sending the plain template`);
      return { summary: "", why: kind };
    }
  }
  async function build(slotMs) {
    const totals = await gather(slotMs);
    const { summary, why } = await summarise(totals);
    return { ...composeReport(totals, summary), why, totals, week: totals.week };
  }
  async function deliver(report, to) {
    if (!mail.ready) return { ok: false, sent: 0, failed: to.length, error: "email isn't set up on this server (RESEND_API_KEY and EMAIL_FROM)" };
    let sent = 0, failed = 0, cat = null;
    for (const addr of to) {
      try { await mail.send(addr, report.subject, report.text); sent++; }
      catch (e) { failed++; cat = String(e?.cat || "the email provider could not be reached").slice(0, 80); }
    }
    if (failed) console.warn(`[cyra] insights: weekly report: ${failed} of ${to.length} not sent (${cat})`);
    return { ok: sent > 0, sent, failed, error: failed ? cat : null, ...(mail.dev ? { dev: true } : {}) };
  }

  /* ---------- the schedule ---------- */
  let running = false;
  /** Sends the due week, once. → null (nothing due) | the result. */
  async function tick() {
    if (running) return null;
    running = true;
    try {
      const st = await state();
      const slot = slotToSend({ nowMs: clock(), enabled: st.enabled, lastSlot: st.lastSlot });
      if (!slot) return null;
      const to = recipientsOf(st);
      if (!mail.ready || !to.length) return null; // nothing to send with or to: the slot stays open until its grace ends
      await saveState({ lastSlot: slot }); // claimed before anything is sent: a restart from here on never sends this week again
      const report = await build(Date.parse(slot));
      const result = await deliver(report, to);
      await saveState({ lastSentAt: now(), lastResult: { ...result, writer: report.writer, week: report.week, scheduled: true } });
      await audit("system", "weekly report", `report:${report.week.from}`, { sent: result.sent, failed: result.failed, writer: report.writer });
      return result;
    } catch { console.warn("[cyra] insights: the weekly report could not be built"); return null; }
    finally { running = false; }
  }
  if (timerMs > 0) {
    const first = setTimeout(() => { tick(); }, 60_000); first.unref?.();
    const timer = setInterval(() => { tick(); }, timerMs); timer.unref?.();
    ctx.onShutdown?.push(async () => { clearTimeout(first); clearInterval(timer); });
  }
  ctx.insightsWeeklyTick = tick; // tests

  /* ---------- routes ---------- */
  const drafts = new Map(); // id → { report, at }
  const view = async () => {
    const st = await state(), t = clock();
    return { enabled: st.enabled, recipients: recipientsOf(st), usingOwners: !st.recipients, lastSentAt: st.lastSentAt, lastResult: st.lastResult, nextAt: st.enabled ? nextSlot(t) : null, nextWeek: (({ from, to }) => ({ from, to }))(weekOf(Date.parse(nextSlot(t)))),
      dueNow: !!slotToSend({ nowMs: t, enabled: st.enabled, lastSlot: st.lastSlot }) && mail.ready && recipientsOf(st).length > 0, // this week's is still to go out, at the next hourly check
      week: (({ from, to }) => ({ from, to }))(weekOf(dueSlot(t))), email: mail.ready ? (mail.dev ? "development" : "ready") : "not set up", ai: typeof ctx.aiWrite === "function" };
  };
  router.get("/weekly", reading, owner, async (req, res) => res.json(await view()));

  router.put("/weekly", writing, owner, async (req, res) => {
    const b = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};
    const unknown = Object.keys(b).filter((k) => k !== "enabled" && k !== "recipients");
    if (unknown.length) return res.status(400).json({ error: `unknown field: ${unknown.slice(0, 3).join(", ").slice(0, 60)}` });
    const patch = {};
    if ("enabled" in b) { if (typeof b.enabled !== "boolean") return res.status(400).json({ error: "enabled must be true or false" }); patch.enabled = b.enabled; }
    if ("recipients" in b) {
      if (b.recipients == null || (typeof b.recipients === "string" && !b.recipients.trim())) patch.recipients = null; // back to the owners
      else {
        if (typeof b.recipients === "string" && b.recipients.length > 2000) return res.status(400).json({ error: "recipients is too long" });
        const c = cleanRecipients(b.recipients, { isEmail, normEmail });
        if (c.error) return res.status(400).json({ error: c.error });
        patch.recipients = c.value;
      }
    }
    if (!Object.keys(patch).length) return res.status(400).json({ error: "send enabled or recipients" });
    await saveState(patch);
    await audit(req.portal.email, "weekly report settings", "report:weekly", { ...("enabled" in patch ? { enabled: patch.enabled } : {}), ...("recipients" in patch ? { recipients: patch.recipients ? patch.recipients.length : "owners" } : {}) });
    res.json(await view());
  });

  router.post("/weekly/preview", sending, owner, async (req, res) => {
    const t = clock();
    for (const [id, d] of drafts) if (t - d.at > DRAFT_TTL_MS) drafts.delete(id);
    const report = await build(dueSlot(t));
    const id = crypto.randomBytes(9).toString("base64url");
    drafts.set(id, { report, at: t });
    while (drafts.size > 5) drafts.delete(drafts.keys().next().value);
    res.json({ id, subject: report.subject, text: report.text, writer: report.writer, why: report.why, week: report.week, recipients: recipientsOf(await state()), goodForMinutes: DRAFT_TTL_MS / 60_000 });
  });

  router.post("/weekly/send", sending, owner, async (req, res) => {
    const id = typeof req.body?.previewId === "string" ? req.body.previewId.slice(0, 40) : null;
    const t = clock();
    let report;
    if (id) {
      const d = drafts.get(id);
      if (!d || t - d.at > DRAFT_TTL_MS) return res.status(409).json({ error: "that preview has expired: preview again, then send" });
      report = d.report;
    } else report = await build(dueSlot(t));
    const st = await state(), to = recipientsOf(st);
    if (!to.length) return res.status(400).json({ error: "there is nobody to send it to: add a recipient, or set ADMIN_EMAILS" });
    if (!mail.ready) return res.status(503).json({ error: "email isn't set up on this server: set RESEND_API_KEY and EMAIL_FROM" });
    const result = await deliver(report, to);
    await saveState({ lastSentAt: now(), lastResult: { ...result, writer: report.writer, week: report.week, scheduled: false } });
    await audit(req.portal.email, "send weekly report", `report:${report.week.from}`, { sent: result.sent, failed: result.failed, writer: report.writer });
    if (!result.ok) return res.status(502).json({ error: `nothing was sent: ${result.error || "the email provider could not be reached"}` });
    if (id) drafts.delete(id);
    res.json({ ...result, writer: report.writer, week: report.week, recipients: to.length });
  });

  return { tick, build, recipients: async () => recipientsOf(await state()) };
}
