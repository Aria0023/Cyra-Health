// Wearable integration hub.
// A source is config (config/integrations/*.json) + an adapter (adapters/<adapter>.js)
// that maps the source's raw payload to Cyra's normalized metric schema:
//   { userRef, date: "YYYY-MM-DD", type: "temp_deviation"|"hrv"|"sleep_score"|"resting_hr", value: Number }
// Add a wearable = drop one config file (+ adapter if the shape is new). Nothing else changes.
import crypto from "crypto";

export function mount(router, ctx) {
  const { store, config } = ctx;

  router.get("/sources", (req, res) =>
    res.json(config.integrations.map(({ secret, ...safe }) => safe))
  );

  // POST /api/integrations/:sourceId/ingest  (HMAC-signed, like partner webhooks)
  router.post("/:sourceId/ingest", async (req, res) => {
    const source = config.integrations.find((s) => s.id === req.params.sourceId);
    if (!source) return res.status(404).json({ error: "unknown source" });

    const sig = req.get("x-cyra-signature") || "";
    const expected = crypto.createHmac("sha256", source.secret).update(req.rawBody || "").digest("hex");
    const a = Buffer.from(sig), b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b))
      return res.status(401).json({ error: "bad signature" });

    const adapter = await import(`./adapters/${source.adapter}.js`);
    const metrics = adapter.normalize(req.body, source);
    if (!metrics.length) return res.status(400).json({ error: "no recognizable metrics" });
    for (const m of metrics) await store.insert("metrics", { ...m, sourceId: source.id, at: new Date().toISOString() });
    res.json({ ok: true, ingested: metrics.length, source: source.id });
  });

  // GET /api/integrations/metrics?userRef=&from=&to=
  router.get("/metrics", async (req, res) => {
    const { userRef, from, to } = req.query;
    if (!userRef) return res.status(400).json({ error: "userRef required" });
    const f = from ? new Date(from) : new Date(0), t = to ? new Date(to) : new Date();
    const rows = await store.find("metrics", (m) =>
      m.userRef === userRef && new Date(m.date) >= f && new Date(m.date) <= t
    );
    res.json(rows);
  });
}
