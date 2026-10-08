// Payout calculator: replays attributed events against each partner's
// configured fee model. GET /api/payouts?from=ISO&to=ISO
export function mount(router, ctx) {
  const { store, config } = ctx;

  router.get("/", async (req, res) => {
    const from = req.query.from ? new Date(req.query.from) : new Date(0);
    const to = req.query.to ? new Date(req.query.to) : new Date();
    const events = await store.find(
      "events",
      (e) => e.type !== "click" && new Date(e.at) >= from && new Date(e.at) <= to
    );

    const lines = config.partners.map((partner) => {
      const evts = events.filter((e) => e.partnerId === partner.id);
      const fee = partner.feeModel || {};
      let owedCents = 0;
      let basis = "";
      if (fee.type === "new_patient_bounty") {
        const n = evts.filter((e) => e.isNewPatient).length;
        owedCents = n * fee.amountCents;
        basis = `${n} new patients × $${(fee.amountCents / 100).toFixed(2)}`;
      } else if (fee.type === "per_visit_fee") {
        const n = evts.length;
        owedCents = n * fee.amountCents;
        basis = `${n} events × $${(fee.amountCents / 100).toFixed(2)}`;
      } else if (fee.type === "commission_pct") {
        const gross = evts.reduce((a, e) => a + (e.amountCents || 0), 0);
        owedCents = Math.round((gross * fee.pct) / 100);
        basis = `${fee.pct}% of $${(gross / 100).toFixed(2)} attributed sales`;
      }
      return {
        partnerId: partner.id,
        partnerName: partner.name,
        feeModel: fee.type,
        basis,
        owedCents,
        owed: `$${(owedCents / 100).toFixed(2)}`,
      };
    });

    res.json({
      period: { from: from.toISOString(), to: to.toISOString() },
      totalOwed: `$${(lines.reduce((a, l) => a + l.owedCents, 0) / 100).toFixed(2)}`,
      lines,
    });
  });
}
