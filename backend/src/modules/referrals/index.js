// Referral engine (development only: not mounted with NODE_ENV=production, and the
// shipped app doesn't call it). userRef is stored as given, so callers must send an
// opaque, client-generated hash — never a name or email. No symptom data is accepted.
import crypto from "crypto";

export function mount(router, ctx) {
  const { store, config } = ctx;

  // POST /api/referrals/link  { userRef, partnerId } -> { code, url }
  router.post("/link", async (req, res) => {
    const { userRef, partnerId } = req.body || {};
    const partner = config.partners.find((p) => p.id === partnerId);
    if (!userRef || !partner)
      return res.status(400).json({ error: "userRef and valid partnerId required" });

    // Reuse an existing active code for this user+partner (stable attribution).
    let ref = await store.findOne(
      "referrals",
      (r) => r.userRef === userRef && r.partnerId === partnerId
    );
    if (!ref) {
      ref = {
        code: crypto.randomBytes(5).toString("hex"),
        userRef,
        partnerId,
        createdAt: new Date().toISOString(),
        clicks: 0,
      };
      await store.insert("referrals", ref);
    }
    res.json({
      code: ref.code,
      url: `${config.baseUrl}/r/${ref.code}`,
    });
  });

  // GET /api/referrals/:code -> referral record (internal/dashboard use)
  router.get("/:code", async (req, res) => {
    const ref = await store.findOne("referrals", (r) => r.code === req.params.code);
    if (!ref) return res.status(404).json({ error: "unknown code" });
    res.json(ref);
  });
}

// Redirect handler lives at root (/r/:code), not under /api — mounted by server.
export async function redirectHandler(ctx, req, res) {
  const { store, config } = ctx;
  const ref = await store.findOne("referrals", (r) => r.code === req.params.code);
  if (!ref) return res.status(404).send("Unknown referral");
  const partner = config.partners.find((p) => p.id === ref.partnerId);
  await store.update("referrals", (r) => r.code === ref.code, { clicks: ref.clicks + 1 });
  await store.insert("events", {
    type: "click",
    code: ref.code,
    partnerId: ref.partnerId,
    at: new Date().toISOString(),
  });
  const url = new URL(partner.landingUrl);
  url.searchParams.set(partner.refParam || "ref", ref.code);
  res.redirect(302, url.toString());
}
