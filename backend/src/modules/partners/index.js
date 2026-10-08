// Partners are pure config: drop a JSON file in config/partners/ and the
// partner exists — routes, referral links, webhooks, payouts all pick it up.
// Fee models supported (see payouts module):
//   { "type": "new_patient_bounty", "amountCents": N }  — one-time per new patient
//   { "type": "per_visit_fee",      "amountCents": N }  — flat fee per visit event
//   { "type": "commission_pct",     "pct": N }          — % of reported order amount
export function mount(router, ctx) {
  router.get("/", (req, res) => {
    // Public-safe view: never expose webhook secrets.
    res.json(
      ctx.config.partners.map(({ webhookSecret, ...safe }) => safe)
    );
  });

  router.get("/:id", (req, res) => {
    const p = ctx.config.partners.find((x) => x.id === req.params.id);
    if (!p) return res.status(404).json({ error: "unknown partner" });
    const { webhookSecret, ...safe } = p;
    res.json(safe);
  });
}
