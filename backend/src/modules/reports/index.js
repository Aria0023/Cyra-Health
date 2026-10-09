// Aggregate-only partner reporting: counts, never identities.
// This is the artifact your partner contract's audit clause points at.
export function mount(router, ctx) {
  const { store, config } = ctx;

  router.get("/partners/:id", async (req, res) => {
    const partner = config.partners.find((p) => p.id === req.params.id);
    if (!partner) return res.status(404).json({ error: "unknown partner" });
    const events = await store.find("events", (e) => e.partnerId === partner.id);
    const uniquePatients = new Set(
      events.filter((e) => e.externalUserHash).map((e) => e.externalUserHash)
    );
    res.json({
      partner: partner.name,
      clicks: events.filter((e) => e.type === "click").length,
      newPatients: events.filter((e) => e.isNewPatient).length,
      totalVisits: events.filter((e) => e.type === "visit" || e.type === "conversion").length,
      uniqueReferredPatients: uniquePatients.size,
      note: "Aggregate counts only. This report contains no user identities or health data.",
    });
  });
}
