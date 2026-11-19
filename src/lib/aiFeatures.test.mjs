/* Unit tests for lib/aiFeatures.js (calm R8). */
import test from "node:test";
import assert from "node:assert/strict";
import { cleanAiPrefs, cleanAiChat, cleanAiWeekly, aiOffer, AI_COPY, CHAT_MAX, askCard, ASK_COPY } from "./aiFeatures.js";

test("prefs: off unless a real true", () => {
  assert.deepEqual(cleanAiPrefs(undefined), { weekly: false, chat: false, labs: false });
  assert.deepEqual(cleanAiPrefs({ weekly: "yes", chat: 1, labs: true }), { weekly: false, chat: false, labs: true });
  // Meal photos: its two keys exist only when really true, so a record saved before it stays byte-for-byte valid
  assert.deepEqual(cleanAiPrefs({ meals: "yes", hideCal: 1 }), { weekly: false, chat: false, labs: false });
  assert.deepEqual(cleanAiPrefs({ meals: true, hideCal: true, more: 1 }), { weekly: false, chat: false, labs: false, meals: true, hideCal: true });
  assert.equal(aiOffer({ flag: true, server: true, canMeals: true }).meals, true);
  assert.equal(aiOffer({ flag: true, server: false, canMeals: true }).meals, false);
  assert.match(AI_COPY.offLine, /^Each of these is off until you turn it on\./);
});

test("chat history: roles, cap, no extra fields", () => {
  const raw = [...Array.from({ length: 50 }, (_, i) => ({ role: i % 2 ? "cyra" : "me", text: `t${i}`, at: "2026-10-29", ask: i === 49 ? "Q?" : undefined })), { role: "x", text: "no" }, { role: "me", text: " " }, null];
  const c = cleanAiChat(raw);
  assert.equal(c.length, CHAT_MAX);
  assert.ok(c.every((m) => !("at" in m)));
  assert.equal(c[c.length - 1].ask, "Q?");
  assert.deepEqual(cleanAiChat("x"), []);
});

test("write-up: kept or null", () => {
  assert.equal(cleanAiWeekly(null), null);
  assert.equal(cleanAiWeekly({ writeup: " " }), null);
  assert.deepEqual(cleanAiWeekly({ writeup: "w", ask: "", day: "bad" }), { writeup: "w", ask: null, day: null });
});

test("offer: needs the flag, a server and the plan", () => {
  assert.deepEqual(aiOffer({}), { any: false, weekly: false, chat: false, meals: false });
  assert.deepEqual(aiOffer({ flag: true, server: false, canWeekly: true, canChat: true }), { any: false, weekly: false, chat: false, meals: false });
  assert.deepEqual(aiOffer({ flag: true, server: true }), { any: true, weekly: false, chat: false, meals: false });
  assert.deepEqual(aiOffer({ flag: true, server: true, canWeekly: true, canChat: true }), { any: true, weekly: true, chat: true, meals: false });
});

test("copy keeps the tone rules", () => {
  const all = Object.values(AI_COPY).join(" ");
  assert.ok(!/streak|score|grade|perfect|fail(ed|ure)?\b|out of 100/i.test(all));
  assert.ok(/every time/.test(AI_COPY.weeklyAdds) && /every time/.test(AI_COPY.chatAdds), "previewed before every send");
});

test("Ask Solia card: coming soon without the flag, a server or a set-up AI", () => {
  const pro = { canChat: true, chatOn: true, canEvidence: true };
  assert.deepEqual(askCard({}), { state: "soon" });
  assert.deepEqual(askCard({ flag: true, server: false, ...pro }), { state: "soon" });
  assert.deepEqual(askCard({ flag: false, server: true, ...pro }), { state: "soon" });
  assert.deepEqual(askCard({ flag: true, server: true, serverAi: "unset", ...pro }), { state: "soon" });
});

test("Ask Solia card: guest, plans, then the box with what her plan and switch allow", () => {
  const here = { flag: true, server: true };
  assert.deepEqual(askCard({ ...here, guest: true, canChat: true, chatOn: true, canEvidence: true }), { state: "guest" });
  assert.deepEqual(askCard({ ...here }), { state: "plans" });
  assert.deepEqual(askCard({ ...here, chatOn: true }), { state: "plans" }, "a switch without the plan opens nothing");
  assert.deepEqual(askCard({ ...here, canChat: true, chatOn: true, canEvidence: true }), { state: "ask", chat: true, chatOff: false, evidence: true });
  assert.deepEqual(askCard({ ...here, canChat: true, chatOn: false, canEvidence: true }), { state: "ask", chat: false, chatOff: true, evidence: true });
  assert.deepEqual(askCard({ ...here, serverAi: "ready", canChat: true, chatOn: true }), { state: "ask", chat: true, chatOff: false, evidence: false });
});

test("Ask Solia copy: names the page its link opens, and keeps the tone rules", () => {
  assert.equal(ASK_COPY.turnOn, "Turn on in You \u2192 Solia Health's AI");
  assert.ok(!/streak|score|grade|diagnos/i.test(Object.values(ASK_COPY).join(" ")));
});
