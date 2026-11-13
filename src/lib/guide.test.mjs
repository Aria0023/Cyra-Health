/* lib/guide.js (owner request 2026-11-12): Getting started for the first week, a one-time tip per view, and a replay. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { VIEW_HINTS, GUIDE_DAYS, cleanGuide, hintFor, markSeen, replayGuide, guideActive, firstSteps, gettingStarted } from "./guide.js";
import { viewsOf } from "./routes.js";

const BASE = { startIso: "2026-11-12", todayIso: "2026-11-12" };

test("every view a tab hosts has a tip, in plain words", () => {
  for (const preg of [false, true]) for (const tab of ["body", "mind", "patterns", "you"]) for (const [id] of viewsOf(tab, { preg })) assert.ok(VIEW_HINTS[id], `${tab}/${id}`);
  for (const t of Object.values(VIEW_HINTS)) { assert.ok(t.length < 200, t); assert.ok(!/\b(simply|just|easy|obviously)\b/i.test(t), t); }
});

test("a tip shows once: markSeen hides it, replay brings it back", () => {
  assert.equal(hintFor(null, "patterns"), VIEW_HINTS.patterns);
  const g = markSeen(null, "patterns");
  assert.equal(hintFor(g, "patterns"), null);
  assert.equal(hintFor(g, "home"), null, "Home has no tip: it has Getting started");
  assert.deepEqual(markSeen(g, "patterns"), g);
  assert.deepEqual(markSeen(g, "nope"), g);
  assert.equal(hintFor(replayGuide("2026-12-01"), "patterns"), VIEW_HINTS.patterns);
});

test("cleanGuide keeps only what it should", () => {
  assert.deepEqual(cleanGuide(null), { seen: [], off: false, replay: null });
  assert.deepEqual(cleanGuide({ seen: ["you", "x", "today"], off: "yes", replay: "soon" }), { seen: ["today", "you"], off: false, replay: null });
  assert.deepEqual(cleanGuide({ seen: [], off: true, replay: "2026-11-12" }), { seen: [], off: true, replay: "2026-11-12" });
});

test("Getting started runs for the first week, or a week after a replay, unless hidden", () => {
  assert.equal(GUIDE_DAYS, 7);
  assert.equal(guideActive(null, BASE), true);
  assert.equal(guideActive(null, { startIso: "2026-11-12", todayIso: "2026-11-18" }), true);
  assert.equal(guideActive(null, { startIso: "2026-11-12", todayIso: "2026-11-19" }), false);
  assert.equal(guideActive(replayGuide("2026-12-01"), { startIso: "2026-11-12", todayIso: "2026-12-03" }), true);
  assert.equal(guideActive({ off: true }, BASE), false);
  assert.equal(guideActive(null, { startIso: null, todayIso: "2026-11-12" }), false);
});

test("one step at a time, in order, each finished step dropping out", () => {
  let s = gettingStarted(null, BASE);
  assert.equal(s.id, "gs-checkin"); assert.equal(s.eyebrow, "Getting started · 1 of 5"); assert.deepEqual(s.action, { label: "Start my check-in", log: "symptoms" });
  assert.deepEqual(s.alt, { label: "Hide getting started", hideGuide: true });
  assert.equal("done" in s, false);
  s = gettingStarted(null, { ...BASE, logged: true });
  assert.equal(s.id, "gs-period"); assert.equal(s.eyebrow, "Getting started · 2 of 5");
  s = gettingStarted(markSeen(null, "patterns"), { ...BASE, logged: true, periodKnown: true });
  assert.equal(s.id, "gs-practice");
  s = gettingStarted(null, { ...BASE, logged: true, periodKnown: true, practiced: true, backedUp: true });
  assert.equal(s.id, "gs-patterns", "Patterns unseen is the one left");
  assert.equal(gettingStarted(markSeen(null, "patterns"), { ...BASE, logged: true, periodKnown: true, practiced: true, backedUp: true }), null);
});

test("pregnancy and menopause skip the period step; pregnancy points at the roadmap", () => {
  for (const o of [{ preg: true }, { meno: true }]) assert.ok(!firstSteps(o).some((x) => x.id === "gs-period"));
  const s = gettingStarted(null, { ...BASE, preg: true, logged: true });
  assert.equal(s.id, "gs-patterns"); assert.deepEqual(s.action, { label: "Open the roadmap", view: "mile" });
  assert.equal(s.eyebrow, "Getting started · 2 of 4");
});

test("guide.js imports nothing and has no I/O", () => {
  const code = readFileSync(new URL("./guide.js", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.ok(!/\bimport\s/.test(code));
  for (const w of ["fetch", "localStorage", "indexedDB", "import.meta"]) assert.ok(!code.includes(w), w);
});
