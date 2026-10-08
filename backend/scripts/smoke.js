// End-to-end smoke test: link -> click -> conversion webhook -> visit -> payouts -> report
import crypto from "crypto";
const B = "http://localhost:3000";
const j = (r) => r.json();
const post = (url, body, headers = {}) =>
  fetch(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });

// 1. App requests a referral link for an opaque user hash
const link = await j(await post(`${B}/api/referrals/link`, { userRef: "u_9f2ab", partnerId: "midi" }));
console.log("link:", link);

// 2. User clicks it (redirect recorded)
const click = await fetch(link.url, { redirect: "manual" });
console.log("click -> redirect:", click.status, click.headers.get("location"));

// 3. Midi sends a signed conversion webhook (first visit = new patient)
const sign = (body) => crypto.createHmac("sha256", "midi-demo-secret-change-me").update(JSON.stringify(body)).digest("hex");
let body = { type: "conversion", code: link.code, externalUserHash: "midi_pt_771" };
console.log("conversion:", await j(await post(`${B}/api/webhooks/midi`, body, { "x-cyra-signature": sign(body) })));

// 4. Same patient returns for a follow-up visit (NOT a new bounty)
body = { type: "visit", code: link.code, externalUserHash: "midi_pt_771" };
console.log("follow-up:", await j(await post(`${B}/api/webhooks/midi`, body, { "x-cyra-signature": sign(body) })));

// 5. Bad signature is rejected
const bad = await post(`${B}/api/webhooks/midi`, body, { "x-cyra-signature": "deadbeef" });
console.log("bad signature status:", bad.status);

// 6. Payouts + aggregate report
console.log("payouts:", JSON.stringify(await j(await fetch(`${B}/api/payouts`)), null, 1));
console.log("report:", await j(await fetch(`${B}/api/reports/partners/midi`)));

// 7. Stage-filtered catalog
console.log("catalog(peri):", (await j(await fetch(`${B}/api/catalog?stage=peri`))).map((i) => i.brand));
