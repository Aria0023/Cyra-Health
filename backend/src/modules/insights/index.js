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
//   GET /api/insights/affiliates · GET /impact/campaigns · POST/DELETE /amazon
//                                 Solia's shop taps beside Impact's clicks, sales and commission per brand, and the
//                                 uploaded Amazon Associates totals (affiliates.js; Impact's endpoints are in impact.js)
//   GET/PUT /api/insights/weekly · POST /weekly/preview · POST /weekly/send
//                                 the weekly owner report by email: every Monday 14:00 UTC, from totals only, written by
//                                 Claude when a key is set, else a plain template (report.js, weekly.js)
// Needs the shop module (the portal's sign-in) mounted before it; reads the accounts module's collection.
import { rateLimiter } from "../../core/memory.js";
import { peopleStats, dayOf } from "./people.js";
import { impactClient } from "./impact.js";
import { mountAffiliates } from "./affiliates.js";
import { mountWeekly } from "./report.js";
import { revenueCat } from "../subscriptions/revenuecat.js";
import { resendMailer } from "../accounts/index.js";

export const basePath = "/api/insights";

export function mount(router, ctx, { clock = Date.now, impact: impactOpt = null, rc: rcOpt = null, mailer, timerMs } = {}) {
  const { config, store } = ctx;
  if (!ctx.portal) throw new Error("insights needs the shop module (the portal's sign-in) mounted before it");
  const { auth } = ctx.portal;
  const cfg = config.insights || {};
  const L = {
    read: rateLimiter({ perMinute: cfg.readPerMinute || 120 }),
    write: rateLimiter({ perMinute: cfg.writePerMinute || 20, globalPerMinute: 200 }),
    send: rateLimiter({ perMinute: cfg.sendPerMinute || 6, globalPerMinute: 30 }), // a preview may call the AI; a send emails
  };
  ctx.onShutdown?.push(async () => { for (const l of Object.values(L)) l.stop(); });
  const limited = (lim) => (req, res, next) => (lim(req.ip) ? next() : res.status(429).json({ error: "too many requests — try again in a minute" }));
  const reading = limited(L.read), writing = limited(L.write);
  const owner = auth("owner");
  const impact = impactOpt || impactClient();

  /* ---------- people: counts only ---------- */
  router.get("/people", reading, owner, async (req, res) => {
    const t = clock();
    res.json({ asOf: dayOf(t), ...peopleStats(await store.find("accounts"), t) });
  });

  /* ---------- affiliates: Impact and the Amazon upload ---------- */
  const affiliates = mountAffiliates(router, { ctx, store, clock, reading, writing, owner, impact });

  /* ---------- the weekly owner report ---------- */
  mountWeekly(router, { ctx, store, clock, reading, writing, sending: limited(L.send), owner, rc: rcOpt || revenueCat(), affiliates, impact,
    mailer: mailer !== undefined ? mailer : resendMailer(), production: !!config.production, ...(timerMs !== undefined ? { timerMs } : {}) });

  router.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
    console.warn(`[cyra] insights: ${String(err?.type || err?.code || "error").slice(0, 40)}`);
    if (!res.headersSent) res.status(err?.status && err.status < 500 ? err.status : 500).json({ error: "something went wrong" });
  });
}
