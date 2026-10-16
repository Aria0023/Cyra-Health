/* Unit tests for the pregnancy roadmap (UI M1): the "Next visit" sentence is derived from PRENATAL, never hard-coded.
   Run with `npm run test:unit`. */
import test from "node:test";
import assert from "node:assert/strict";
import { roadmapAdvice } from "./engine.js";
import { PRENATAL, prenatalWhen } from "./constants.js";

test("roadmapAdvice: names the item in window and the next opening week, differently at weeks 22, 30 and 41", () => {
  const w22 = roadmapAdvice(22), w30 = roadmapAdvice(30), w41 = roadmapAdvice(41);
  assert.equal(w22, "You're at week 22: Anatomy scan is in its window now, and Glucose screening opens at week 24 — ask about it at your next visit.");
  assert.equal(w30, "You're at week 30: Tdap vaccine is in its window now, and RSV vaccine (seasonal) opens at week 32 — ask about it at your next visit.");
  assert.equal(w41, "You're at week 41: Post-dates monitoring is in its window now — ask about it at your next visit.");
  assert.equal(new Set([w22, w30, w41]).size, 3);
  // Nothing hard-codes the old 24/27 pair: past the glucose window neither number appears.
  assert.ok(!/\b(24|27)\b/.test(w30) && !/\b(24|27)\b/.test(w41));
  // The week-30 sentence does not mention the glucose screen at all; week 22 says it opens at 24 only because PRENATAL says so.
  assert.ok(!/[Gg]lucose/.test(w30));
  assert.equal(PRENATAL.flatMap((g) => g.items).find((m) => m.label === "Glucose screening").from, 24);
});

test("roadmapAdvice: a quiet week names what opens next; past 42 weeks only the postpartum visits are left", () => {
  assert.equal(roadmapAdvice(23), "You're at week 23: nothing is due this week; Glucose screening opens at week 24.");
  assert.equal(roadmapAdvice(14), "You're at week 14: nothing is due this week; Serum screen (if no NIPT) opens at week 15.");
  assert.equal(roadmapAdvice(43), "You're past 42 weeks — the postpartum visits are what's left.");
  // The postpartum items never read as "opens at week 43".
  for (let w = 0; w <= 42; w++) assert.ok(!/week 4[3-9]|week 99/.test(roadmapAdvice(w)), `week ${w}`);
});

test("prenatalWhen (SH-15): 'Weeks 24–28', 'Any week', and the two postpartum phrasings — never 'Weeks any'", () => {
  const flat = PRENATAL.flatMap((g) => g.items);
  const by = (label) => flat.find((m) => m.label === label);
  assert.equal(prenatalWhen(by("Glucose screening")), "Weeks 24–28");
  assert.equal(prenatalWhen(by("Folate + vaccines")), "Any week");
  assert.equal(prenatalWhen(by("Early postpartum contact")), "Within 3 weeks of birth");
  assert.equal(prenatalWhen(by("Comprehensive postpartum visit")), "By 12 weeks after birth");
  for (const m of flat) assert.ok(!/any$/i.test(prenatalWhen(m)) || prenatalWhen(m) === "Any week");
});
