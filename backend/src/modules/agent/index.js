// Agentic layer: an agent = task + tools + a pluggable reasoning provider.
// Providers (src/modules/agent/providers/):
//   anthropic.js — real LLM reasoning via ANTHROPIC_API_KEY (tool-use loop)
//   rules.js     — deterministic fallback, zero setup, same interface
// Set "agent.provider" in config/app-dev.json. Add tools in TOOLS below —
// both providers pick them up automatically. Development only: not mounted with
// NODE_ENV=production. /run passes the posted object to the provider as given and has
// no authentication, so it must only ever receive opaque userRefs and aggregates.
export function mount(router, ctx) {
  const { store, config } = ctx;

  const TOOLS = {
    get_metrics: {
      description: "Fetch a user's normalized wearable metrics. Args: {userRef, days}",
      run: async ({ userRef, days = 30 }) => {
        const from = new Date(Date.now() - days * 86400000);
        return store.find("metrics", (m) => m.userRef === userRef && new Date(m.date) >= from);
      },
    },
    get_catalog: {
      description: "Fetch shelf partners for a life stage. Args: {stage}",
      run: async ({ stage }) =>
        ctx.config.partners
          .filter((p) => p.shelf && (!stage || (p.stages || []).includes(stage)))
          .map((p) => ({ id: p.id, name: p.name, offer: p.shelf.title, evidence: p.shelf.evidence })),
    },
    get_partner_stats: {
      description: "Aggregate referral stats for a partner. Args: {partnerId}",
      run: async ({ partnerId }) => {
        const evts = await store.find("events", (e) => e.partnerId === partnerId);
        return {
          clicks: evts.filter((e) => e.type === "click").length,
          newPatients: evts.filter((e) => e.isNewPatient).length,
        };
      },
    },
  };

  // POST /api/agent/run  { task: "weekly_insight" | "partner_brief", userRef?, stage?, partnerId? }
  router.post("/run", async (req, res) => {
    const providerName = config.agent?.provider || "rules";
    try {
      const provider = await import(`./providers/${providerName}.js`);
      const result = await provider.run(req.body || {}, TOOLS, config);
      res.json({ provider: providerName, ...result });
    } catch (e) {
      res.status(500).json({ error: e.message, provider: providerName });
    }
  });
}
