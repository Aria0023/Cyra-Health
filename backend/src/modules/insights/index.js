// Insights for the partner portal's owners (docs/plans/tracking-reports.md): totals only, owner only.
// Business numbers about the product as a whole: never anyone's health data (the server has none), never a list of
// people, never an email address, an account id or anything about one person.
//
// Who may do what: EVERY route here is OWNER-ONLY (the portal's owner role, ADMIN_EMAILS), checked on the server for
// every request through the shop module's portal sign-in (ctx.portal.auth). A partner gets 403 on all of them; a
// partner's own brands' shop tap totals are the shop module's GET /api/shop/taps.
//
//   GET /api/insights/people      account and sign-in totals: how many accounts, new per day (30 days), used in the last
//                                 1 / 7 / 30 days, by sign-in method. Counts only (people.js).
// Needs the shop module (the portal's sign-in) mounted before it; reads the accounts module's collection.
import { rateLimiter } from "../../core/memory.js";
import { peopleStats, dayOf } from "./people.js";

export const basePath = "/api/insights";

export function mount(router, ctx, { clock = Date.now } = {}) {
  const { config, store } = ctx;
  if (!ctx.portal) throw new Error("insights needs the shop module (the portal's sign-in) mounted before it");
  const { auth } = ctx.portal;
  const cfg = config.insights || {};
  const L = { read: rateLimiter({ perMinute: cfg.readPerMinute || 120 }) };
  ctx.onShutdown?.push(async () => { for (const l of Object.values(L)) l.stop(); });
  const limited = (lim) => (req, res, next) => (lim(req.ip) ? next() : res.status(429).json({ error: "too many requests — try again in a minute" }));
  const reading = limited(L.read);
  const owner = auth("owner");

  /* ---------- people: counts only ---------- */
  router.get("/people", reading, owner, async (req, res) => {
    const t = clock();
    res.json({ asOf: dayOf(t), ...peopleStats(await store.find("accounts"), t) });
  });

  router.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
    console.warn(`[cyra] insights: ${String(err?.type || err?.code || "error").slice(0, 40)}`);
    if (!res.headersSent) res.status(err?.status && err.status < 500 ? err.status : 500).json({ error: "something went wrong" });
  });
}
