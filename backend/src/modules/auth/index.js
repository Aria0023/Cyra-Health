// Enterprise login: org-scoped signed tokens (demo implementation of the
// real thing — swap verify/sign for OIDC/SSO per org in production).
import crypto from "crypto";
const sign = (payload, secret) => {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
};
export const verify = (token, secret) => {
  const [body, sig] = (token || "").split(".");
  if (!body || !sig) return null;
  const good = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return null;
  const p = JSON.parse(Buffer.from(body, "base64url").toString());
  return p.exp > Date.now() ? p : null;
};
export function mount(router, ctx) {
  const { store, config } = ctx;
  router.post("/login", async (req, res) => {
    const { userRef, orgSlug } = req.body || {};
    const org = await store.findOne("orgs", (o) => o.slug === orgSlug);
    const user = await store.findOne("users", (u) => u.userRef === userRef && u.orgSlug === orgSlug);
    if (!org || !user) return res.status(401).json({ error: "unknown user/org" });
    if (user.status !== "active") return res.status(403).json({ error: "suspended" });
    const token = sign({ userRef, orgSlug, role: user.role, exp: Date.now() + 86400000 }, config.authSecret);
    res.json({ token, role: user.role, org: org.name });
  });
  router.get("/me", (req, res) => {
    const p = verify(req.get("authorization")?.replace("Bearer ", ""), ctx.config.authSecret);
    p ? res.json(p) : res.status(401).json({ error: "invalid token" });
  });
}
