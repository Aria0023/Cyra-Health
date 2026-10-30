/* Unit tests for lib/aiFeatures.js (calm R8). */
import test from "node:test";
import assert from "node:assert/strict";
import { cleanAiPrefs, cleanAiChat, cleanAiWeekly, aiOffer, AI_COPY, CHAT_MAX } from "./aiFeatures.js";

test("prefs: off unless a real true", () => {
  assert.deepEqual(cleanAiPrefs(undefined), { weekly: false, chat: false, labs: false });
  assert.deepEqual(cleanAiPrefs({ weekly: "yes", chat: 1, labs: true }), { weekly: false, chat: false, labs: true });
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
  assert.deepEqual(aiOffer({}), { any: false, weekly: false, chat: false });
  assert.deepEqual(aiOffer({ flag: true, server: false, canWeekly: true, canChat: true }), { any: false, weekly: false, chat: false });
  assert.deepEqual(aiOffer({ flag: true, server: true }), { any: true, weekly: false, chat: false });
  assert.deepEqual(aiOffer({ flag: true, server: true, canWeekly: true, canChat: true }), { any: true, weekly: true, chat: true });
});

test("copy keeps the tone rules", () => {
  const all = Object.values(AI_COPY).join(" ");
  assert.ok(!/streak|score|grade|perfect|fail(ed|ure)?\b|out of 100/i.test(all));
  assert.ok(/every time/.test(AI_COPY.weeklyAdds) && /every time/.test(AI_COPY.chatAdds), "previewed before every send");
});
