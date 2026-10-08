// Partner webhook receiver. Partners POST signed events:
//   { type: "conversion" | "visit", code, externalUserHash, amountCents? }
// Signature: HMAC-SHA256 of raw body with the partner's webhookSecret,
// sent in header `x-cyra-signature`.
//
// Attribution logic:
//   - event.code must match a referral within the partner's attributionWindowDays
//   - first "conversion" per (partner, externalUserHash) = NEW PATIENT (bounty)
//   - subsequent "visit" events are recorded for per-visit fees / aggregate reports
import crypto from "crypto";

export function mount(router, ctx) {
  const { store, config } = ctx;

  router.post("/:partnerId", async (req, res) => {
    const partner = config.partners.find((p) => p.id === req.params.partnerId);
    if (!partner) return res.status(404).json({ error: "unknown partner" });

    const sig = req.get("x-cyra-signature") || "";
    const expected = crypto
      .createHmac("sha256", partner.webhookSecret)
      .update(req.rawBody || "")
      .digest("hex");
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b))
      return res.status(401).json({ error: "bad signature" });

    const { type, code, externalUserHash, amountCents } = req.body || {};
    if (!["conversion", "visit"].includes(type) || !code || !externalUserHash)
      return res.status(400).json({ error: "type, code, externalUserHash required" });

    const ref = await store.findOne(
      "referrals",
      (r) => r.code === code && r.partnerId === partner.id
    );
    if (!ref) return res.status(422).json({ error: "unattributed: unknown code" });

    const windowDays = partner.attributionWindowDays ?? 90;
    const ageDays = (Date.now() - new Date(ref.createdAt)) / 86400000;
    if (ageDays > windowDays)
      return res.status(422).json({ error: "unattributed: outside window" });

    const priorConversion = await store.findOne(
      "events",
      (e) =>
        e.partnerId === partner.id &&
        e.externalUserHash === externalUserHash &&
        e.type === "conversion"
    );
    const isNewPatient = type === "conversion" && !priorConversion;

    const event = {
      type,
      code,
      partnerId: partner.id,
      externalUserHash,
      amountCents: amountCents ?? null,
      isNewPatient,
      at: new Date().toISOString(),
    };
    await store.insert("events", event);
    res.json({ ok: true, attributed: true, isNewPatient });
  });
}
