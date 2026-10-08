// "You're not alone" pulse: anonymous weekly aggregates with k-anonymity.
//
//   POST /api/pulse/tally { stage, token, events: [...] }
//        An opted-in device reports which allowlisted events happened this week.
//        No dates, no values, no identity. `token` is a random value the device
//        makes up for the week; it is used ONLY to de-duplicate contributions in
//        memory and is never written to disk. What is persisted: counts.
//   GET  /api/pulse?stage=peri
//        { week, stage, k, items: [{ id, what, count }] } — count is null until at
//        least k (default 50) distinct contributors reached it.
import crypto from "crypto";

export const basePath = "/api/pulse";

export const EVENTS = {
  peri: [["hf", "logged hot flashes"], ["rough_night", "had a rough night's sleep"], ["report", "opened their doctor report"]],
  periods: [["crm", "logged cramps"], ["mood_dip", "tracked a mood dip before their period"], ["heavy_day", "logged a heavy day"]],
  preg: [["nau", "logged nausea"], ["kicks", "counted kicks"], ["swl", "logged swelling"]],
};

export function isoWeek(d = new Date()) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y = t.getUTCFullYear();
  const w = Math.ceil(((t - Date.UTC(y, 0, 1)) / 86400000 + 1) / 7);
  return `${y}-W${String(w).padStart(2, "0")}`;
}

export function mount(router, ctx) {
  const { store, config } = ctx;
  const K = config.pulse?.k || 50;
  const seen = new Map(); // `${week}|${stage}|${event}` → Set(hash(token)); memory only, cleared as weeks roll over
  const hits = new Map(); // per-IP rate limit for tallies
  const allow = (ip) => { const now = Date.now(), arr = (hits.get(ip) || []).filter((t) => t > now - 60_000); if (arr.length >= 30) { hits.set(ip, arr); return false; } arr.push(now); hits.set(ip, arr); return true; };

  router.post("/tally", async (req, res) => {
    if (!allow(req.ip || "anon")) return res.status(429).json({ error: "slow down" });
    const { stage, token, events } = req.body || {};
    if (!EVENTS[stage]) return res.status(400).json({ error: "stage must be peri, periods or preg" });
    if (typeof token !== "string" || !/^[A-Za-z0-9_-]{16,64}$/.test(token)) return res.status(400).json({ error: "token must be a random 16-64 char string" });
    const valid = new Set(EVENTS[stage].map(([id]) => id));
    const evs = Array.isArray(events) ? [...new Set(events.filter((e) => valid.has(e)))] : [];
    const week = isoWeek();
    const h = crypto.createHash("sha256").update(`${week}:${token}`).digest("base64url");
    for (const k of seen.keys()) if (!k.startsWith(`${week}|`)) seen.delete(k);
    let counted = 0;
    for (const ev of evs) {
      const key = `${week}|${stage}|${ev}`;
      const set = seen.get(key) || new Set();
      if (set.has(h)) continue;
      set.add(h); seen.set(key, set); counted++;
      const row = await store.findOne("pulse", (r) => r.week === week && r.stage === stage && r.event === ev);
      if (row) await store.update("pulse", (r) => r.week === week && r.stage === stage && r.event === ev, { count: row.count + 1 });
      else await store.insert("pulse", { week, stage, event: ev, count: 1 });
    }
    res.json({ ok: true, week, counted });
  });

  router.get("/", async (req, res) => {
    const stage = String(req.query.stage || "");
    if (!EVENTS[stage]) return res.status(400).json({ error: "stage must be peri, periods or preg" });
    const week = isoWeek();
    const rows = await store.find("pulse", (r) => r.week === week && r.stage === stage);
    res.set("cache-control", "public, max-age=60");
    res.json({ week, stage, k: K, items: EVENTS[stage].map(([id, what]) => { const n = rows.find((r) => r.event === id)?.count || 0; return { id, what, count: n >= K ? n : null }; }) });
  });
}
