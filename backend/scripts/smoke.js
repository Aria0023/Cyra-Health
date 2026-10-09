// End-to-end smoke test of the partner/referral demo (development mode only — these
// modules are not mounted with NODE_ENV=production):
// link -> click -> conversion webhook -> visit -> payouts -> report.
// Usage: start a development server (node server.js), then
//   node scripts/smoke.js                    # against http://localhost:3000
//   BASE=http://127.0.0.1:3290 node scripts/smoke.js
import crypto from "crypto";
const B = (process.env.BASE || "http://localhost:3000").replace(/\/$/, "");
const j = (r) => r.json();
const assert = (c, m) => { if (!c) { console.error("FAIL:", m); process.exitCode = 1; } else console.log("ok  ", m); };
const post = (url, body, headers = {}) =>
  fetch(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });

// 1. App requests a referral link for an opaque user hash
const userRef = `u_${crypto.randomBytes(8).toString("hex")}`;
const link = await j(await post(`${B}/api/referrals/link`, { userRef, partnerId: "midi" }));
console.log("link:", link);
assert(/^[a-f0-9]{10}$/.test(link.code || "") && /\/r\/[a-f0-9]{10}$/.test(link.url || ""), "referral link created");

// 2. User clicks it (redirect recorded)
const click = await fetch(`${B}/r/${link.code}`, { redirect: "manual" });
console.log("click -> redirect:", click.status, click.headers.get("location"));
assert(click.status === 302 && (click.headers.get("location") || "").includes(`ref=${link.code}`), "click redirects to the partner with the code");

// 3. Midi sends a signed conversion webhook (first visit = new patient)
const sign = (body) => crypto.createHmac("sha256", process.env.PARTNER_MIDI_WEBHOOK_SECRET || "midi-demo-secret-change-me").update(JSON.stringify(body)).digest("hex");
const patient = `midi_pt_${crypto.randomBytes(4).toString("hex")}`;
let body = { type: "conversion", code: link.code, externalUserHash: patient };
const conv = await j(await post(`${B}/api/webhooks/midi`, body, { "x-cyra-signature": sign(body) }));
console.log("conversion:", conv);
assert(conv.ok && conv.attributed && conv.isNewPatient === true, "first conversion = new patient");

// 4. Same patient returns for a follow-up visit (NOT a new bounty)
body = { type: "visit", code: link.code, externalUserHash: patient };
const visit = await j(await post(`${B}/api/webhooks/midi`, body, { "x-cyra-signature": sign(body) }));
console.log("follow-up:", visit);
assert(visit.ok && visit.isNewPatient === false, "follow-up visit is not a new patient");

// 5. Bad signature is rejected
const bad = await post(`${B}/api/webhooks/midi`, body, { "x-cyra-signature": "deadbeef" });
console.log("bad signature status:", bad.status);
assert(bad.status === 401, "bad signature rejected");

// 6. Payouts + aggregate report
const payouts = await j(await fetch(`${B}/api/payouts`));
console.log("payouts:", JSON.stringify(payouts, null, 1));
assert(Array.isArray(payouts.lines) && payouts.lines.some((l) => l.partnerId === "midi" || /Midi/.test(l.partnerName || "")), "payouts list Midi");
const report = await j(await fetch(`${B}/api/reports/partners/midi`));
console.log("report:", report);
assert(report.newPatients >= 1 && report.clicks >= 1, "aggregate report counts clicks and new patients");

// 7. Stage-filtered catalog
const catalog = await j(await fetch(`${B}/api/catalog?stage=peri`));
console.log("catalog(peri):", catalog.map((i) => i.brand));
assert(Array.isArray(catalog) && catalog.length > 0, "catalog filtered by stage");
console.log(process.exitCode ? "REFERRAL SMOKE: FAILURES" : "REFERRAL SMOKE: all passed");
