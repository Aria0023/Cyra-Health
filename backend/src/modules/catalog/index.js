// Shelf catalog API: the app fetches its stage-filtered Shelf from here,
// so partner lineups are updatable without shipping a new app build.
export function mount(router, ctx) {
  router.get("/", (req, res) => {
    const stage = req.query.stage;
    let items = ctx.config.partners.filter((p) => p.shelf);
    if (stage) items = items.filter((p) => (p.stages || []).includes(stage));
    res.json(
      items.map((p) => ({
        partnerId: p.id,
        brand: p.name,
        name: p.shelf.title,
        price: p.shelf.price,
        evidence: p.shelf.evidence,
        blurb: p.shelf.blurb,
        stages: p.stages,
        matches: p.shelf.matches,
      }))
    );
  });
}
