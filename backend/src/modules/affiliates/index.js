// Affiliate portal: DTC brands & clinics apply to join the Shelf; admins
// review; approved affiliates become partner configs (with contract terms).
export function mount(router, ctx) {
  const { store, config } = ctx;
  const admin = (req, res) => {
    if ((req.get("x-admin-key") || "") !== config.adminKey) { res.status(401).json({ error: "admin key required" }); return false; }
    return true;
  };
  router.post("/apply", async (req, res) => {
    const { company, contact, category, proposedFee } = req.body || {};
    if (!company || !contact || !category) return res.status(400).json({ error: "company, contact, category required" });
    const app = { id: `aff_${Date.now()}`, company, contact, category, proposedFee: proposedFee || null, status: "pending", at: new Date().toISOString() };
    await store.insert("affiliates", app);
    res.json(app);
  });
  router.get("/", async (req, res) => { if (!admin(req, res)) return; res.json(await store.find("affiliates")); });
  router.patch("/:id", async (req, res) => {
    if (!admin(req, res)) return;
    const n = await store.update("affiliates", (a) => a.id === req.params.id, { status: req.body?.status || "approved" });
    res.json({ updated: n });
  });
}
