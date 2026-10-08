// FHIR R4 interoperability. The app POSTs its on-device summary; we build a
// standards-compliant Bundle (patient-generated health data) and, on user
// instruction, push it: partner API, org's FHIR endpoint (Epic/Cerner via
// SMART on FHIR in production), or secure fax. Patient-directed push keeps
// the clean compliance posture discussed earlier.
export function mount(router, ctx) {
  const { store } = ctx;
  const obs = (code, display, value, unit, userRef) => ({
    resourceType: "Observation", status: "final",
    category: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/observation-category", code: "survey" }] }],
    code: { coding: [{ system: "http://loinc.org", code, display }], text: display },
    subject: { reference: `Patient/${userRef}`, display: "pseudonymous" },
    effectiveDateTime: new Date().toISOString(),
    valueQuantity: unit ? { value, unit } : undefined,
    valueString: unit ? undefined : String(value),
  });

  router.post("/bundle", async (req, res) => {
    const { userRef, symptoms = {}, cycleLengths = [], wearables = {} } = req.body || {};
    if (!userRef) return res.status(400).json({ error: "userRef required" });
    const entries = [];
    Object.entries(symptoms).forEach(([name, freq]) =>
      entries.push(obs("75325-1", `Symptom: ${name}`, freq, null, userRef)));
    if (cycleLengths.length)
      entries.push(obs("49033-4", "Menstrual cycle lengths (days)", cycleLengths.join(", "), null, userRef));
    if (wearables.avg_temp_deviation_c != null)
      entries.push(obs("8310-5", "Body temperature deviation", wearables.avg_temp_deviation_c, "Cel", userRef));
    if (wearables.avg_sleep_score != null)
      entries.push(obs("93832-4", "Sleep quality score", wearables.avg_sleep_score, "{score}", userRef));
    const bundle = { resourceType: "Bundle", type: "collection", timestamp: new Date().toISOString(), entry: entries.map((r) => ({ resource: r })) };
    res.json(bundle);
  });

  // Patient-directed push. destination: partner:<id> | fhir:<orgSlug> | fax:<number>
  router.post("/push", async (req, res) => {
    const { userRef, destination, bundle } = req.body || {};
    if (!userRef || !destination || !bundle) return res.status(400).json({ error: "userRef, destination, bundle required" });
    const record = { userRef, destination, resources: bundle.entry?.length || 0, status: "delivered (simulated)", consent: "patient-directed", at: new Date().toISOString() };
    await store.insert("fhir_outbox", record);
    res.json({ ok: true, ...record });
  });

  router.get("/outbox", async (req, res) => res.json(await store.find("fhir_outbox")));
}
