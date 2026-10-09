// "You're not alone" pulse: anonymous weekly counts with a display threshold.
//
//   POST /api/pulse/tally { stage, events: [...] }
//        Sent by a device whose owner turned on "Share anonymous weekly counts", at
//        most once a day, for the day(s) before. The body is exactly {stage, events}:
//        the life stage and a few yes/no event ids from that stage's allowlist below.
//        Any other field (a token, a date, a value) is refused with 400, so there is
//        no token and nothing that identifies a device. Each event in a tally adds 1
//        to this ISO week's count for (stage, event), all in one write, so a tally is
//        counted whole or not at all. What is written to disk: rows of
//        {week, stage, event, count}. Nothing else — no address, no time of the tally.
//        Rate limits, in memory only: 30 tallies a minute per client address and 600 a
//        minute overall. The address is held only as sha256(daily random salt +
//        address) and dropped about a minute (60-65 s) after its last tally.
//   GET  /api/pulse
//        { week, k, stages: { peri: [{ id, what, count }], periods: [...], preg: [...] } }
//        Every stage at once, for the last CLOSED ISO week, so loading the counts tells
//        the server nothing about the reader's life stage or health — only what any
//        request carries (IP address, user agent, which app or site it came from) — and
//        a single contribution can't be seen arriving. count is null until at least k (default 50) contributions are
//        counted — a display threshold on contributions, not a proof of k distinct
//        people. A `stage` query is refused (400) so an older client that would send
//        its life stage fails closed.
import { rateLimiter } from "../../core/memory.js";

export const basePath = "/api/pulse";

export const EVENTS = {
  peri: [["hf", "logged hot flashes"], ["ns", "logged night sweats"], ["rough_night", "had a rough night's sleep"]],
  periods: [["crm", "logged cramps"], ["mood_dip", "logged mood swings before their period"], ["heavy_day", "logged a heavy day"]],
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
/** The last closed ISO week — the one GET /api/pulse publishes. */
export const lastClosedWeek = (now = Date.now()) => isoWeek(new Date(now - 7 * 86400000));

export function mount(router, ctx) {
  const { store, config } = ctx;
  const K = config.pulse?.k || 50;
  const allow = rateLimiter({ perMinute: config.pulse?.perMinute || 30, globalPerMinute: config.pulse?.globalPerMinute || 600 });

  router.post("/tally", async (req, res) => {
    if (!allow(req.ip)) return res.status(429).json({ error: "slow down" });
    const body = req.body;
    if (!body || typeof body !== "object" || Array.isArray(body)) return res.status(400).json({ error: "send {stage, events}" });
    if (Object.keys(body).some((k) => k !== "stage" && k !== "events")) return res.status(400).json({ error: "a tally is exactly {stage, events} — no other fields are accepted" });
    const { stage, events } = body;
    if (typeof stage !== "string" || !Object.hasOwn(EVENTS, stage)) return res.status(400).json({ error: "stage must be peri, periods or preg" });
    const valid = new Set(EVENTS[stage].map(([id]) => id));
    if (!Array.isArray(events) || events.length === 0 || events.length > 16 || !events.every((e) => typeof e === "string" && valid.has(e))) return res.status(400).json({ error: `events must be one or more of: ${[...valid].join(", ")}` });
    const week = isoWeek();
    const evs = [...new Set(events)];
    // One write for the whole tally: if it fails, nothing of it is counted (the device then
    // re-sends it on a later day), so an error answer never follows a partial count.
    await store.apply("pulse", (rows) => {
      for (const ev of evs) {
        const row = rows.find((r) => r.week === week && r.stage === stage && r.event === ev);
        if (row) row.count += 1; else rows.push({ week, stage, event: ev, count: 1 });
      }
    });
    res.json({ ok: true, week, counted: evs.length });
  });

  router.get("/", async (req, res) => {
    if (Object.hasOwn(req.query || {}, "stage")) return res.status(400).json({ error: "GET /api/pulse takes no stage: it returns every stage" });
    const week = lastClosedWeek();
    const rows = await store.find("pulse", (r) => r.week === week);
    const stages = Object.fromEntries(
      Object.entries(EVENTS).map(([stage, list]) => [stage, list.map(([id, what]) => { const n = rows.find((r) => r.stage === stage && r.event === id)?.count || 0; return { id, what, count: n >= K ? n : null }; })])
    );
    res.set("cache-control", "public, max-age=300");
    res.json({ week, k: K, stages });
  });
}
