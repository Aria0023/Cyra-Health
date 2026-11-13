import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SAVED_LINE, CHECKIN_SAVED } from "./saved.js";

test("one way to say it was kept, and the check-in's clear finish", () => {
  assert.equal(SAVED_LINE, "Saved ✓");
  assert.equal(CHECKIN_SAVED, "Today's check-in is saved ✓");
});

test("every on-the-spot save in App.jsx confirms through savedIf, which stays quiet when a save was refused", () => {
  const app = readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
  assert.ok(app.includes("const savedIf = (r) => { if (r !== false) ping(SAVED_LINE); };"));
  for (const h of ["setSleepH(", "setMeal(", "togglePcos(", "setMoodDay(l, todayIso, { mood: v })", "toggleFeeling(", "[logDay]: { ...(l[logDay] || {}), [mid]", "[sheetDay]: { ...(l[sheetDay] || {}), [mid]"]) {
    const line = app.split("\n").find((l) => l.includes(h));
    assert.ok(line && line.includes("savedIf("), h);
  }
});
