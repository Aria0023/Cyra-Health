// Multi-tenant white-labeling. An org owns: branding/theme, enabled life
// stages, and its partner lineup (subset or override of the global catalog).
// Designed for the app to call GET /api/orgs/:slug/config at boot (same binary,
// per-org experience); the shipped app doesn't yet, and this module is not mounted
// with NODE_ENV=production. Write operations require x-admin-key (demo auth).
export function mount(router, ctx) {
  const { store, config } = ctx;
  const admin = (req, res) => {
    if ((req.get("x-admin-key") || "") !== config.adminKey) {
      res.status(401).json({ error: "admin key required" });
      return false;
    }
    return true;
  };

  // Bootstrap the default Cyra org on first run.
  (async () => {
    if (!(await store.findOne("orgs", (o) => o.slug === "cyra"))) {
      await store.insert("orgs", {
        slug: "cyra", name: "Cyra Health",
        theme: { primary: "#8E3B5E", paper: "#F6F1EC", accent: "#DD8A4E" },
        stages: ["cycle", "fertility", "peri", "meno"],
        partnerIds: null, // null = all global partners
        createdAt: new Date().toISOString(),
      });
    }
  })();

  router.post("/", async (req, res) => {
    if (!admin(req, res)) return;
    const { slug, name, theme, stages, partnerIds } = req.body || {};
    if (!slug || !name) return res.status(400).json({ error: "slug and name required" });
    if (await store.findOne("orgs", (o) => o.slug === slug))
      return res.status(409).json({ error: "slug taken" });
    const org = { slug, name, theme: theme || {}, stages: stages || ["peri", "meno"], partnerIds: partnerIds || null, createdAt: new Date().toISOString() };
    await store.insert("orgs", org);
    res.json(org);
  });

  router.get("/", async (req, res) => {
    if (!admin(req, res)) return;
    res.json(await store.find("orgs"));
  });

  // Public app-boot config: branding + this org's shelf. Same endpoint the
  // white-labeled phone app hits on launch.
  router.get("/:slug/config", async (req, res) => {
    const org = await store.findOne("orgs", (o) => o.slug === req.params.slug);
    if (!org) return res.status(404).json({ error: "unknown org" });
    const partners = config.partners
      .filter((p) => p.shelf && (!org.partnerIds || org.partnerIds.includes(p.id)))
      .map((p) => ({ id: p.id, brand: p.name, offer: p.shelf.title, price: p.shelf.price, evidence: p.shelf.evidence, stages: p.stages }));
    res.json({ org: org.name, slug: org.slug, theme: org.theme, stages: org.stages, shelf: partners });
  });
}
