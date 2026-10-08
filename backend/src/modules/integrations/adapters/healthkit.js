// HealthKit/Health Connect: the APP reads on-device and pushes already-normalized
// samples (preferred privacy path — cloud storage of these is optional).
export function normalize(body) {
  return (body.samples || []).filter((s) => s.userRef && s.date && s.type && s.value != null);
}
