// Organization dashboards (docs/plans/upgrade-enterprise.md Task 4): TOTALS ONLY, for an organization's admins (the emails
// listed on it, signed in to the same portal) and for owners. Never a list of people, never an email, never an account id,
// never health data (the server has none). Every number under SMALL (10) is answered as "fewer than 10" by the server
// itself, so a small group can't be told apart on the page or in the API.
//
//   GET /api/orgs/mine          the organizations this sign-in may see: an owner every one, an org admin only theirs
//   GET /api/orgs/:slug/stats   people joined (the daily join totals, all time), signed-in accounts that joined it, Pro
//                               subscribers among those accounts (RevenueCat, when configured), joins per week (12 weeks)
// Who: ctx.portal.auth("org") (an owner, or an org admin) and then, for /:slug/stats, the slug must be one of the sign-in's
// own organizations unless it is an owner: an org admin asking for another organization gets 403 (the same answer
// whether it exists or not). Partners and anyone else get 403; nobody signed in 401.

export const SMALL = 10;
export const WEEKS = 12;
const DAY = 86_400_000;
/** n → { value: n } or { value: null, fewerThan: 10 } (and a word for the page). */
export const masked = (n) => (Number.isFinite(n) && n >= SMALL ? { value: n, text: String(n) } : { value: null, fewerThan: SMALL, text: `fewer than ${SMALL}` });
/** The Monday (UTC) of the week a day is in, as YYYY-MM-DD. */
export const weekOf = (day) => { const t = Date.parse(`${day}T00:00:00Z`); const d = new Date(t); return new Date(t - ((d.getUTCDay() + 6) % 7) * DAY).toISOString().slice(0, 10); };

/** org_joins rows → { joined, byWeek: [{ week, joins }] } for the last WEEKS weeks up to `now` (raw numbers). */
export function joinTotals(rows, slug, now) {
  const mine = (rows || []).filter((r) => r && r.slug === slug && Number.isFinite(r.joins));
  const joined = mine.reduce((n, r) => n + r.joins, 0);
  const thisWeek = weekOf(new Date(now).toISOString().slice(0, 10));
  const weeks = Array.from({ length: WEEKS }, (_, i) => new Date(Date.parse(`${thisWeek}T00:00:00Z`) - (WEEKS - 1 - i) * 7 * DAY).toISOString().slice(0, 10));
  const by = new Map(weeks.map((w) => [w, 0]));
  for (const r of mine) { const w = weekOf(r.day); if (by.has(w)) by.set(w, by.get(w) + r.joins); }
  return { joined, byWeek: weeks.map((w) => ({ week: w, joins: by.get(w) })) };
}

export function mountStats(router, { store, auth, limited, clock, rc, isSolia, ttlMs = 10 * 60_000 }) {
  const org = auth("org");
  const mayRead = (who, slug) => who.role === "owner" || (Array.isArray(who.orgSlugs) && who.orgSlugs.includes(slug));
  const proCache = new Map(); // slug → { at, n } — a count only
  async function proCount(slug, ids) {
    if (!rc || !rc.configured) return { unavailable: "RevenueCat isn't set up on this server (REVENUECAT_SECRET_KEY, REVENUECAT_PROJECT_ID)" };
    const c = proCache.get(slug);
    if (c && clock() - c.at < ttlMs) return { n: c.n };
    let n = 0;
    try { for (const id of ids.slice(0, 2000)) if (await rc.active(id)) n += 1; } catch { return { unavailable: "RevenueCat didn't answer; try again later" }; }
    proCache.set(slug, { at: clock(), n });
    return { n };
  }

  router.get("/mine", limited, org, async (req, res) => {
    const all = (await store.find("orgs")).filter((o) => !isSolia(o) && mayRead(req.portal, o.slug));
    res.json({ orgs: all.map((o) => ({ slug: o.slug, name: o.name })), role: req.portal.role });
  });

  router.get("/:slug/stats", limited, org, async (req, res) => {
    const slug = String(req.params.slug || "").toLowerCase();
    if (!mayRead(req.portal, slug)) return res.status(403).json({ error: "you can see only your own organization" });
    const o = await store.findOne("orgs", (x) => x.slug === slug && !isSolia(x));
    if (!o) return res.status(404).json({ error: "unknown organization" });
    const t = clock();
    const { joined, byWeek } = joinTotals(await store.find("org_joins"), slug, t);
    const ids = (await store.find("accounts")).filter((a) => a.orgSlug === slug).map((a) => a.id);
    const pro = await proCount(slug, ids);
    res.json({
      slug, name: o.name, asOf: new Date(t).toISOString().slice(0, 10), small: SMALL,
      joined: masked(joined), signedIn: masked(ids.length),
      pro: pro.unavailable ? { value: null, unavailable: pro.unavailable, text: "not available" } : masked(pro.n),
      joinsByWeek: byWeek.map((w) => ({ week: w.week, ...masked(w.joins) })),
    });
  });
}
