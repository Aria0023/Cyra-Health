// Account and sign-in totals for the portal's People page (docs/plans/tracking-reports.md Task 2). Pure: rows in,
// COUNTS out. Nothing here returns an email, a name, an account id or a list of people, and nothing reads health data
// (the server has none). The only per-account fields read are provider, createdAt and lastSeenDay (a UTC date the
// accounts module notes at most once a day on sign-in or GET /api/accounts/me: no time of day, no address).
const DAY = 86_400_000;
export const PROVIDERS = Object.freeze(["apple", "google", "facebook", "email"]);
export const dayOf = (ms) => new Date(ms).toISOString().slice(0, 10);
/** The first UTC day of a window of `days` days ending today. */
export const sinceDay = (days, nowMs) => dayOf(nowMs - (days - 1) * DAY);
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** accounts → { total, byProvider, newByDay[30], new7, new30, newPrev7, active1, active7, active30, activePrev7, neverSeen }. */
export function peopleStats(accounts, nowMs = Date.now()) {
  const today = dayOf(nowMs), d7 = sinceDay(7, nowMs), d14 = sinceDay(14, nowMs), d30 = sinceDay(30, nowMs);
  const byProvider = Object.fromEntries(PROVIDERS.map((p) => [p, 0]));
  const perDay = new Map();
  for (let i = 29; i >= 0; i--) perDay.set(dayOf(nowMs - i * DAY), 0);
  const out = { total: 0, byProvider, newByDay: [], new7: 0, new30: 0, newPrev7: 0, active1: 0, active7: 0, active30: 0, activePrev7: 0, neverSeen: 0 };
  for (const a of Array.isArray(accounts) ? accounts : []) {
    if (!a || typeof a !== "object") continue;
    out.total++;
    if (Object.hasOwn(byProvider, a.provider)) byProvider[a.provider]++;
    const made = typeof a.createdAt === "string" && !Number.isNaN(Date.parse(a.createdAt)) ? dayOf(Date.parse(a.createdAt)) : null;
    if (made && made <= today) {
      if (perDay.has(made)) perDay.set(made, perDay.get(made) + 1);
      if (made >= d7) out.new7++; else if (made >= d14) out.newPrev7++;
      if (made >= d30) out.new30++;
    }
    const seen = typeof a.lastSeenDay === "string" && DAY_RE.test(a.lastSeenDay) && a.lastSeenDay <= today ? a.lastSeenDay : null;
    if (!seen) { out.neverSeen++; continue; }
    if (seen === today) out.active1++;
    if (seen >= d7) out.active7++; else if (seen >= d14) out.activePrev7++;
    if (seen >= d30) out.active30++;
  }
  out.newByDay = [...perDay].map(([day, count]) => ({ day, count }));
  return out;
}
