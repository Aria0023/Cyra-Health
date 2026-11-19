// The weekly owner report (docs/plans/tracking-reports.md Task 4). Pure parts: when it is due, the week it covers, the
// TOTALS it is built from, what counts as unusual, and the email's words. No store, clock or network in this file.
//
// Schedule: every Monday 14:00 UTC, covering the seven UTC days before that Monday (Monday to Sunday) and compared with
// the seven before those. index.js checks hourly and keeps the last slot it sent in the store (DATA_DIR), written
// BEFORE the email goes out, so a restart can never send the same week twice (at most once; a crash mid-send skips it).
//
// Totals only: every field below is a count or a sum over all accounts, taps, campaigns or applications, plus the names
// of brands and products (business data). No email address, account id, device, address or anything a person logged can
// be in it: the server holds no health data at all. backend/test/insights-weekly.test.mjs checks the JSON's keys against
// an allowlist and that no "@" appears.
export const WEEKLY_SLOT = Object.freeze({ weekday: 1, hour: 14 }); // Monday, 14:00 UTC
export const WEEKLY_GRACE_MS = 3 * 86_400_000; // a server that was down on Monday still sends until Thursday 14:00 UTC
export const TOTALS_LINE = "Totals only; no personal or health data.";
const DAY = 86_400_000;
const dayOf = (ms) => new Date(ms).toISOString().slice(0, 10);

/** The latest Monday 14:00 UTC at or before `nowMs`, in ms. */
export function dueSlot(nowMs) {
  const d = new Date(nowMs);
  const base = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), WEEKLY_SLOT.hour);
  let back = (d.getUTCDay() - WEEKLY_SLOT.weekday + 7) % 7;
  if (back === 0 && nowMs < base) back = 7;
  return base - back * DAY;
}
/** The slot (ISO) to send now, or null: switched off, already sent for this slot, or the slot is older than the grace. */
export function slotToSend({ nowMs, enabled, lastSlot = null, graceMs = WEEKLY_GRACE_MS } = {}) {
  if (!enabled) return null;
  const slot = dueSlot(nowMs), iso = new Date(slot).toISOString();
  if (lastSlot && lastSlot >= iso) return null;
  return nowMs - slot <= graceMs ? iso : null;
}
/** The next Monday 14:00 UTC after `nowMs`, ISO. */
export const nextSlot = (nowMs) => new Date(dueSlot(nowMs) + 7 * DAY).toISOString();
/** The week a slot reports on: the 7 UTC days before the slot's day, and the 7 before those. */
export function weekOf(slotMs) {
  const start = Date.UTC(new Date(slotMs).getUTCFullYear(), new Date(slotMs).getUTCMonth(), new Date(slotMs).getUTCDate());
  return { from: dayOf(start - 7 * DAY), to: dayOf(start - DAY), prevFrom: dayOf(start - 14 * DAY), prevTo: dayOf(start - 8 * DAY) };
}

const int = (v) => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : 0);
const money = (v) => (Number.isFinite(Number(v)) ? Math.round(Number(v) * 100) / 100 : 0);
const label = (v, max = 80) => String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/@/g, " at ").trim().slice(0, max);

/** Week-over-week moves of more than 30% (or from nothing to 5 or more). pairs: [{ metric, now, before }]. */
export function unusualMoves(pairs, threshold = 0.3) {
  const out = [];
  for (const p of pairs) {
    const now = Number(p.now), before = Number(p.before);
    if (!Number.isFinite(now) || !Number.isFinite(before)) continue;
    if (before > 0) { const change = (now - before) / before; if (Math.abs(change) > threshold) out.push({ metric: p.metric, thisWeek: now, weekBefore: before, changePercent: Math.round(change * 100) }); }
    else if (before === 0 && now >= 5) out.push({ metric: p.metric, thisWeek: now, weekBefore: 0, changePercent: null });
  }
  return out;
}

/**
 * Everything the report says, as one JSON of totals. `src` is what index.js read:
 *   week { from, to, prevFrom, prevTo }, accounts [{ provider, createdAt, lastSeenDay }], taps [{ day, productId, brandId, taps }],
 *   names { product(id), brand(id) }, rc { configured, missing, metrics, error }, impact { configured, missing, now[], before[], error },
 *   amazon { uploadedAt, days[] } | null, applications [{ status, at }], products [{ status }], partners (count),
 *   aiUsage [{ id: "<account>:<YYYY-MM>", evidence, chat, weekly }], nowMs,
 *   aiCost { weekUsd, monthUsd, budgetUsd, budgetPercent } | null (insights/spend.js: an estimate from token totals)
 * Only counts and sums leave this function; no row is copied through.
 */
export function buildTotals(src) {
  const w = src.week, today = dayOf(src.nowMs), d30 = dayOf(src.nowMs - 29 * DAY);
  const inWeek = (day) => day >= w.from && day <= w.to, inPrev = (day) => day >= w.prevFrom && day <= w.prevTo;
  // people
  const acc = { total: 0, newThisWeek: 0, newWeekBefore: 0, activeSinceWeekStart: 0, activeLast30Days: 0, bySignIn: { apple: 0, google: 0, facebook: 0, email: 0 } };
  for (const a of src.accounts || []) {
    acc.total++;
    if (Object.hasOwn(acc.bySignIn, a.provider)) acc.bySignIn[a.provider]++;
    const made = typeof a.createdAt === "string" ? a.createdAt.slice(0, 10) : "";
    if (inWeek(made)) acc.newThisWeek++; else if (inPrev(made)) acc.newWeekBefore++;
    const seen = typeof a.lastSeenDay === "string" && a.lastSeenDay <= today ? a.lastSeenDay : "";
    if (seen && seen >= w.from) acc.activeSinceWeekStart++;
    if (seen && seen >= d30) acc.activeLast30Days++;
  }
  // shop taps
  const per = new Map();
  let taps = 0, tapsBefore = 0;
  for (const r of src.taps || []) {
    if (inWeek(r.day)) { taps += int(r.taps); const p = per.get(r.productId) || { productId: r.productId, brandId: r.brandId, taps: 0 }; p.taps += int(r.taps); per.set(r.productId, p); }
    else if (inPrev(r.day)) tapsBefore += int(r.taps);
  }
  const top = [...per.values()].sort((a, b) => b.taps - a.taps).slice(0, 5).map((p) => ({ product: label(src.names?.product?.(p.productId) || p.productId), brand: label(src.names?.brand?.(p.brandId) || p.brandId), taps: p.taps }));
  // subscriptions (RevenueCat's own overview numbers; its periods are RevenueCat's, not this week's)
  const rc = src.rc || {};
  const subscriptions = !rc.configured ? { connected: false, notSet: (rc.missing || []).map((m) => label(m, 40)) }
    : rc.error ? { connected: true, error: label(rc.error, 80) }
      : { connected: true, numbers: (rc.metrics || []).map((m) => ({ id: label(m.id, 40), name: label(m.name, 60), value: money(m.value), unit: label(m.unit, 10), period: label(m.period, 10) })) };
  // affiliates
  const sum = (rows) => (rows || []).reduce((t, r) => ({ clicks: t.clicks + int(r.clicks), sales: t.sales + int(r.actions), saleAmount: money(t.saleAmount + Number(r.saleAmount || 0)), commission: money(t.commission + Number(r.commission || 0)) }), { clicks: 0, sales: 0, saleAmount: 0, commission: 0 });
  const im = src.impact || {};
  const impact = !im.configured ? { connected: false, notSet: (im.missing || []).map((m) => label(m, 40)) }
    : im.error ? { connected: true, error: label(im.error, 80) }
      : { connected: true, thisWeek: sum(im.now), weekBefore: sum(im.before) };
  let amazon = null;
  if (src.amazon && Array.isArray(src.amazon.days)) {
    const t = { items: 0, revenue: 0, earnings: 0, daysCovered: 0 };
    for (const d of src.amazon.days) if (inWeek(d.day)) { t.items += int(d.items); t.revenue = money(t.revenue + d.revenue); t.earnings = money(t.earnings + d.earnings); t.daysCovered++; }
    amazon = { uploadedOn: label(String(src.amazon.uploadedAt || "").slice(0, 10), 10), ...t };
  }
  // partners
  const apps = src.applications || [];
  const partners = {
    applicationsWaiting: apps.filter((a) => a.status === "pending").length,
    applicationsThisWeek: apps.filter((a) => inWeek(String(a.at || "").slice(0, 10))).length,
    productsWaitingForReview: (src.products || []).filter((p) => p.status === "pending").length,
    partners: int(src.partners),
  };
  // AI use: this calendar month so far, summed over every account
  const month = w.to.slice(0, 7);
  const ai = { month, evidenceQuestions: 0, chatMessages: 0, weeklyWriteUps: 0 };
  for (const r of src.aiUsage || []) if (typeof r.id === "string" && r.id.endsWith(`:${month}`)) { ai.evidenceQuestions += int(r.evidence); ai.chatMessages += int(r.chat); ai.weeklyWriteUps += int(r.weekly); }
  if (src.aiCost) { ai.estimatedCostThisWeekUsd = money(src.aiCost.weekUsd); ai.estimatedCostMonthUsd = money(src.aiCost.monthUsd); ai.monthlyBudgetUsd = src.aiCost.budgetUsd == null ? null : money(src.aiCost.budgetUsd); ai.budgetUsedPercent = src.aiCost.budgetPercent == null ? null : int(src.aiCost.budgetPercent); }
  const pairs = [{ metric: "New accounts", now: acc.newThisWeek, before: acc.newWeekBefore }, { metric: "Shop taps", now: taps, before: tapsBefore }];
  if (impact.thisWeek) pairs.push({ metric: "Affiliate clicks (Impact)", now: impact.thisWeek.clicks, before: impact.weekBefore.clicks }, { metric: "Affiliate sales (Impact)", now: impact.thisWeek.sales, before: impact.weekBefore.sales }, { metric: "Affiliate commission (Impact)", now: impact.thisWeek.commission, before: impact.weekBefore.commission });
  return { week: { from: w.from, to: w.to }, weekBefore: { from: w.prevFrom, to: w.prevTo }, people: acc, subscriptions, shop: { taps, tapsWeekBefore: tapsBefore, mostOpened: top }, affiliates: { impact, amazon }, partners, ai, unusual: unusualMoves(pairs) };
}

const n = (v) => Number(v || 0).toLocaleString("en-US");
const amt = (v) => Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const rcValue = (m) => (m.unit === "$" ? `$${amt(m.value)}` : m.unit === "%" ? `${n(m.value)}%` : n(m.value));

/** The numbers as plain text: the same lines whether or not the AI wrote a summary above them. */
export function numbersText(t) {
  const L = [];
  const p = t.people;
  L.push("PEOPLE");
  L.push(`- Accounts: ${n(p.total)} in all; ${n(p.newThisWeek)} new this week (${n(p.newWeekBefore)} the week before)`);
  L.push(`- Used their account: ${n(p.activeSinceWeekStart)} since ${t.week.from}; ${n(p.activeLast30Days)} in the last 30 days`);
  L.push(`- By sign-in: Apple ${n(p.bySignIn.apple)}, Google ${n(p.bySignIn.google)}, Facebook ${n(p.bySignIn.facebook)}, email ${n(p.bySignIn.email)}`);
  L.push("", "SUBSCRIPTIONS (RevenueCat's overview numbers, over RevenueCat's own periods)");
  const s = t.subscriptions;
  if (!s.connected) L.push(`- Not connected${s.notSet?.length ? ` (${s.notSet.join(", ")} not set on the server)` : ""}.`);
  else if (s.error) L.push(`- RevenueCat couldn't be read: ${s.error}.`);
  else if (!s.numbers.length) L.push("- RevenueCat returned no numbers.");
  else for (const m of s.numbers) L.push(`- ${m.name}: ${rcValue(m)}`);
  L.push("", "SHOP");
  L.push(`- Product taps: ${n(t.shop.taps)} (${n(t.shop.tapsWeekBefore)} the week before)`);
  if (t.shop.mostOpened.length) t.shop.mostOpened.forEach((x, i) => L.push(`  ${i + 1}. ${x.product} (${x.brand}): ${n(x.taps)}`));
  L.push("", "AFFILIATES");
  const im = t.affiliates.impact;
  if (!im.connected) L.push(`- Impact: not connected${im.notSet?.length ? ` (${im.notSet.join(", ")} not set on the server)` : ""}.`);
  else if (im.error) L.push(`- Impact couldn't be read: ${im.error}.`);
  else L.push(`- Impact: ${n(im.thisWeek.clicks)} clicks, ${n(im.thisWeek.sales)} sales, ${amt(im.thisWeek.saleAmount)} in sales, ${amt(im.thisWeek.commission)} commission (week before: ${n(im.weekBefore.clicks)} clicks, ${n(im.weekBefore.sales)} sales, ${amt(im.weekBefore.commission)} commission)`);
  const az = t.affiliates.amazon;
  if (!az) L.push("- Amazon Associates: no report uploaded.");
  else if (!az.daysCovered) L.push(`- Amazon Associates: the report uploaded ${az.uploadedOn} has no rows for this week.`);
  else L.push(`- Amazon Associates (report uploaded ${az.uploadedOn}, ${n(az.daysCovered)} of 7 days): ${n(az.items)} items shipped, ${amt(az.revenue)} revenue, ${amt(az.earnings)} earnings`);
  const pa = t.partners;
  L.push("", "PARTNERS");
  L.push(`- Applications waiting: ${n(pa.applicationsWaiting)} (${n(pa.applicationsThisWeek)} received this week)`);
  L.push(`- Products waiting for your review: ${n(pa.productsWaitingForReview)}`);
  L.push(`- Partners with portal access: ${n(pa.partners)}`);
  L.push("", `AI USE (${t.ai.month} so far, all accounts together)`);
  L.push(`- Evidence questions: ${n(t.ai.evidenceQuestions)}; chat messages: ${n(t.ai.chatMessages)}; weekly write-ups: ${n(t.ai.weeklyWriteUps)}`);
  if (t.ai.estimatedCostMonthUsd != null) L.push(`- Estimated AI cost: $${amt(t.ai.estimatedCostThisWeekUsd)} this week; $${amt(t.ai.estimatedCostMonthUsd)} in ${t.ai.month} so far${t.ai.monthlyBudgetUsd != null ? ` (${n(t.ai.budgetUsedPercent)}% of the $${amt(t.ai.monthlyBudgetUsd)} monthly budget)` : ""}. An estimate from token totals; Anthropic's console is the bill of record.`);
  L.push("", "WORTH A LOOK (moved more than 30% week over week)");
  if (!t.unusual.length) L.push("- Nothing moved more than 30%.");
  else for (const u of t.unusual) L.push(`- ${u.metric}: ${n(u.thisWeek)} this week, ${n(u.weekBefore)} the week before${u.changePercent == null ? " (from nothing)" : ` (${u.changePercent > 0 ? "up" : "down"} ${Math.abs(u.changePercent)}%)`}`);
  return L.join("\n");
}

export const WRITER_LINE = Object.freeze({
  claude: "The summary at the top was written by Claude (Anthropic) from the numbers below it; the numbers are the source.",
  template: "No AI summary this week: this is the plain template with the same numbers.",
});

/** { subject, text } — exactly what is emailed. summary: the AI's paragraph(s), or "" for the plain template. */
export function composeReport(totals, summary = "") {
  const s = String(summary || "").trim();
  const text = [
    "Solia Health weekly report",
    `Week of ${totals.week.from} to ${totals.week.to} (UTC), compared with ${totals.weekBefore.from} to ${totals.weekBefore.to}`,
    "",
    ...(s ? [s, ""] : []),
    "THE NUMBERS",
    "",
    numbersText(totals),
    "",
    s ? WRITER_LINE.claude : WRITER_LINE.template,
    TOTALS_LINE,
    "Sent because the weekly report is on in the Solia Health partner portal (Weekly report). Turn it off or change who gets it there.",
  ].join("\n");
  return { subject: `Solia Health weekly report: ${totals.week.from} to ${totals.week.to}`, text, writer: s ? "claude" : "template" };
}

export const WEEKLY_SYSTEM = `You write the short weekly business summary for the owners of Solia Health, a women's health app. You are given one JSON object of TOTALS for the week (accounts, subscriptions, shop taps, affiliate results, partner activity, AI use). It contains no personal data and no health data, and you must not speculate about any individual.
Rules: use only the numbers in the JSON, exactly as given; never invent, estimate or extrapolate a number, a cause or a name. If a section says it is not connected or had an error, say that in a few words and move on. Mention every entry in "unusual" plainly (what moved, from what to what). Do not give medical or legal advice. Plain text only: no markdown, no bullet symbols, no headings, no greeting and no sign-off. At most 160 words, in two or three short paragraphs, most important first.`;
export const weeklyPrompt = (totals) => `This week's totals as JSON:\n${JSON.stringify(totals)}\n\nWrite the summary.`;

/** The AI's text made safe for a plain-text email, or "" when it is unusable (then the template is sent). */
export function cleanSummary(v) {
  if (typeof v !== "string") return "";
  const s = v.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0009\u000b-\u001f\u007f‪-‮⁦-⁩]/g, "").replace(/\n{3,}/g, "\n\n").trim();
  if (s.length < 20 || s.length > 2500) return "";
  if (/https?:\/\/|www\.|@/i.test(s)) return ""; // a summary of totals has no reason to hold a link or an address
  return s;
}

const EMAIL_CAP = 10;
/** A recipients value (text or array) → { value: [emails] } | { error }. isEmail / normEmail come from the accounts module. */
export function cleanRecipients(v, { isEmail, normEmail }) {
  const list = (Array.isArray(v) ? v : String(v ?? "").split(/[\s,;]+/)).map((x) => normEmail(String(x))).filter(Boolean);
  const uniq = [...new Set(list)];
  if (!uniq.length) return { error: "name at least one address" };
  if (uniq.length > EMAIL_CAP) return { error: `at most ${EMAIL_CAP} addresses` };
  const bad = uniq.find((e) => !isEmail(e));
  if (bad) return { error: "one of the addresses isn't a valid email address" };
  return { value: uniq };
}
