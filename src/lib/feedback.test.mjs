// Feedback and Help (lib/feedback.js, docs/plans/launch-tools.md Task 3): the payload is a strict whitelist and the
// preview is built from that same object; the email goes only with the reply switch and only for a signed-in account
// with an email; the request carries a token only with reply; the Help answers are true of the build they describe.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FEEDBACK_PATH, FEEDBACK_MAX, FEEDBACK_COPY, HELP_COPY, feedbackPayload, previewRows, sendFeedback, canReply, cleanMessage, cleanSupportEmail, supportHref, helpItems, SUPPORT_EMAIL } from "./feedback.js";

const base = { kind: "feedback", message: "The calendar is lovely", build: "BUILD 2026.10.07-D", platform: "ios", language: "en" };
const maya = { id: "acct_1", provider: "email", email: "maya@x.example", name: "Maya" };

test("feedback: the payload is exactly five fields, or seven with reply; nothing else can get in", () => {
  const p = feedbackPayload({ ...base, stage: "ttc", days: [{ flow: 3 }], deviceId: "d", account: maya, token: "t" });
  assert.deepEqual(p, { kind: "feedback", message: "The calendar is lovely", build: "BUILD 2026.10.07-D", platform: "ios", language: "en" });
  assert.deepEqual(Object.keys(p), ["kind", "message", "build", "platform", "language"], "signed in, reply off: no email, no account");
  const r = feedbackPayload({ ...base, kind: "problem", reply: true, account: maya });
  assert.deepEqual(r, { kind: "problem", message: "The calendar is lovely", build: "BUILD 2026.10.07-D", platform: "ios", language: "en", reply: true, email: "maya@x.example" });
  assert.ok(!("id" in r) && !("name" in r) && !("accountId" in r));
  assert.deepEqual(Object.keys(feedbackPayload({ ...base, reply: true, account: null })), ["kind", "message", "build", "platform", "language"], "reply without an account adds nothing");
  assert.deepEqual(Object.keys(feedbackPayload({ ...base, reply: true, account: { id: "a", email: "" } })), ["kind", "message", "build", "platform", "language"], "an account without an email can't be replied to");
  assert.deepEqual(Object.keys(feedbackPayload({ ...base, reply: "yes", account: maya })), ["kind", "message", "build", "platform", "language"], "reply must be exactly true");
  assert.equal(feedbackPayload({ ...base, message: "   " }), null);
  assert.equal(feedbackPayload({ ...base, kind: "rant" }), null);
  assert.equal(feedbackPayload({ ...base, message: "x".repeat(FEEDBACK_MAX + 1) }), null, "too long is never shortened and sent");
  assert.equal(feedbackPayload({ ...base, message: "x".repeat(FEEDBACK_MAX) }).message.length, FEEDBACK_MAX);
  assert.deepEqual([feedbackPayload({ ...base, platform: "windows", language: "xx_YY!" })].map((x) => [x.platform, x.language]), [["web", "en"]]);
  assert.equal(cleanMessage("  a\r\nb\u0007 "), "a\nb");
  assert.equal(canReply(maya), true); assert.equal(canReply(null), false); assert.equal(canReply({ email: "nope" }), false);
});

test("feedback: the preview has one row per payload key, in order, with her words as typed", () => {
  const p = feedbackPayload({ ...base, kind: "problem", message: "Line one\nLine two", reply: true, account: maya });
  const rows = previewRows(p);
  assert.deepEqual(rows.map((r) => r[0]), Object.keys(p));
  assert.deepEqual(rows, [["kind", "Kind (feedback or problem)", "problem"], ["message", "Your message", "Line one\nLine two"], ["build", "App version", "BUILD 2026.10.07-D"], ["platform", "Platform (web, ios or android)", "ios"], ["language", "App language", "en"], ["reply", "OK to reply", "Yes"], ["email", "Your account email", "maya@x.example"]]);
  assert.deepEqual(previewRows(feedbackPayload(base)).map((r) => r[0]), ["kind", "message", "build", "platform", "language"]);
  assert.deepEqual(previewRows(null), []);
});

test("feedback: one POST with exactly the payload; a token only with reply; no cookie, no referrer", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => { calls.push({ url, init }); return { ok: true, status: 201 }; };
  const anon = feedbackPayload(base);
  assert.deepEqual(await sendFeedback(anon, { base: "https://api.example", token: "TOKEN", fetchImpl }), { ok: true });
  assert.equal(calls[0].url, `https://api.example${FEEDBACK_PATH}`);
  assert.deepEqual(JSON.parse(calls[0].init.body), anon);
  assert.deepEqual(calls[0].init.headers, { "content-type": "application/json" }, "signed in, reply off: the token is not sent");
  assert.deepEqual([calls[0].init.method, calls[0].init.credentials, calls[0].init.referrerPolicy, calls[0].init.cache], ["POST", "omit", "no-referrer", "no-store"]);
  const rep = feedbackPayload({ ...base, reply: true, account: maya });
  await sendFeedback(rep, { base: "https://api.example", token: "TOKEN", fetchImpl });
  assert.equal(calls[1].init.headers.authorization, "Bearer TOKEN");
  assert.deepEqual(JSON.parse(calls[1].init.body), rep);
  // nothing is sent without a payload or a server
  assert.deepEqual(await sendFeedback(null, { base: "https://api.example", fetchImpl }), { ok: false, why: "server" });
  assert.deepEqual(await sendFeedback(anon, { base: "", fetchImpl }), { ok: false, why: "server" });
  assert.equal(calls.length, 2);
  for (const [status, why] of [[429, "limit"], [401, "signin"], [400, "server"], [500, "server"]]) assert.deepEqual(await sendFeedback(anon, { base: "https://api.example", fetchImpl: async () => ({ ok: false, status }) }), { ok: false, why });
  assert.deepEqual(await sendFeedback(anon, { base: "https://api.example", fetchImpl: async () => { throw new Error("offline"); } }), { ok: false, why: "network" });
  for (const why of ["limit", "signin", "server", "network"]) assert.ok(FEEDBACK_COPY.err[why].includes("sent"), why);
});

test("feedback: the sentences the brief pins, and the support address from build config", () => {
  assert.equal(FEEDBACK_COPY.warn, "Please don't include health details. Nothing from your log is attached.");
  assert.equal(FEEDBACK_COPY.replyName, "It's OK to reply to me");
  assert.equal(FEEDBACK_COPY.previewLabel, "What will be sent");
  assert.equal(FEEDBACK_COPY.sendFeedback, "Send feedback"); assert.equal(FEEDBACK_COPY.reportProblem, "Report a problem");
  assert.equal(FEEDBACK_MAX, 2000);
  assert.match(FEEDBACK_COPY.flowDetail2, /kept for 365 days, then deleted/);
  assert.match(FEEDBACK_COPY.flowDetail3, /never sent to the AI/);
  assert.equal(SUPPORT_EMAIL, "", "unset in Node: hidden");
  assert.equal(cleanSupportEmail(" help@solia.example "), "help@solia.example");
  for (const bad of ["", null, "help", "a@b", "Help <help@solia.example>", "a@b.example, c@d.example", "mailto:a@b.example", "a b@c.example"]) assert.equal(cleanSupportEmail(bad), "", String(bad));
  assert.equal(supportHref("help@solia.example"), "mailto:help@solia.example?subject=Solia%20Health%20support");
  assert.equal(supportHref(""), "");
  assert.ok(HELP_COPY.title && HELP_COPY.eyebrow === "Help");
  const src = readFileSync(new URL("./feedback.js", import.meta.url), "utf8");
  assert.ok(!/^\s*import\s/m.test(src), "feedback.js imports nothing");
  assert.ok(!/localStorage|indexedDB|navigator\./.test(src), "it reads no storage and no device");
});

test("help: four answers, each matching the build it is given", () => {
  const ids = (f) => helpItems(f).map((i) => i.id);
  assert.deepEqual(ids({}), ["free-week", "cancel", "data", "watch"]);
  const text = (f, id) => helpItems(f).find((i) => i.id === id).a.join(" ");
  assert.match(text({ trialGate: true }, "free-week"), /^Your first 7 days include everything\. After that, saving new entries needs Pro\./);
  assert.match(text({ trialGate: false }, "free-week"), /^This version has no free-week limit/);
  assert.match(text({}, "cancel"), /Solia Health can't cancel it for you/);
  assert.match(text({}, "cancel"), /deleting your Solia Health account or removing the app doesn't cancel a subscription/);
  assert.match(text({ accounts: false }, "data"), /Solia Health's servers don't keep a copy\./);
  assert.match(text({ accounts: true }, "data"), /keep no readable copy: only your encrypted account backup, if you make one\./);
  assert.match(text({}, "watch"), /^This version of Solia Health doesn't connect to a watch or ring/);
  const phone = text({ deviceSync: true, native: true, wearables: true, server: true }, "watch");
  assert.match(phone, /Apple Health \(iPhone\) or Health Connect \(Android\)/); assert.match(phone, /never sent to a server/); assert.match(phone, /An Oura ring can also be connected/);
  const web = text({ deviceSync: true, native: false, wearables: true, server: true }, "watch");
  assert.match(web, /^An Oura ring is connected from You → Devices & reminders/); assert.match(web, /need the Solia Health phone app/); assert.doesNotMatch(web, /never sent to a server/);
  assert.doesNotMatch(text({ deviceSync: true, native: true, wearables: true, server: false }, "watch"), /Oura/, "no server, no Oura");
  for (const f of [{}, { trialGate: true, native: true, server: true, wearables: true, deviceSync: true, accounts: true }]) for (const it of helpItems(f)) { assert.ok(it.q.endsWith("?")); assert.ok(it.a.length >= 1 && it.a.every((p) => typeof p === "string" && p.length > 20)); }
});
