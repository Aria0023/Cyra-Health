// User control plane. Server stores only: opaque userRef hash, org, role,
// status — never names, emails, or health data (identity lives in your IdP;
// symptoms live on-device). Roles: member | org_admin.
export function mount(router, ctx) {
  const { store, config } = ctx;
  const admin = (req, res) => {
    if ((req.get("x-admin-key") || "") !== config.adminKey) {
      res.status(401).json({ error: "admin key required" });
      return false;
    }
    return true;
  };

  router.post("/", async (req, res) => {
    if (!admin(req, res)) return;
    const { userRef, orgSlug, role } = req.body || {};
    const org = await store.findOne("orgs", (o) => o.slug === orgSlug);
    if (!userRef || !org) return res.status(400).json({ error: "userRef and valid orgSlug required" });
    if (await store.findOne("users", (u) => u.userRef === userRef))
      return res.status(409).json({ error: "user exists" });
    const user = { userRef, orgSlug, role: role || "member", status: "active", createdAt: new Date().toISOString() };
    await store.insert("users", user);
    res.json(user);
  });

  router.get("/", async (req, res) => {
    if (!admin(req, res)) return;
    const { orgSlug } = req.query;
    const users = await store.find("users", (u) => !orgSlug || u.orgSlug === orgSlug);
    res.json({ count: users.length, users });
  });

  router.patch("/:userRef", async (req, res) => {
    if (!admin(req, res)) return;
    const patch = {};
    if (req.body?.role) patch.role = req.body.role;
    if (req.body?.status) patch.status = req.body.status; // active | suspended
    const n = await store.update("users", (u) => u.userRef === req.params.userRef, patch);
    res.json({ updated: n });
  });
}
