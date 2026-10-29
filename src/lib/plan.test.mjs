/* Unit tests for lib/plan.js (L3, owner decision D1: one free plan, the export-limit mechanism tested
   with a configured limit). Run with `npm run test:unit`. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FREE_PLAN, PLAN, PLAN_FEATURES, DEV_PRO_PLAN, planFor, can, monthKey, exportsUsed, exportsLeft, noteExport } from "./plan.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");

test("FREE_PLAN is the D1 entitlements object", () => {
  assert.deepEqual(FREE_PLAN, { tier: "free", pdfExportsPerMonth: null, aiPatternReports: false, extraCustomisation: false, cloudBackup: false, fullPractices: false });
  assert.ok(Object.isFrozen(FREE_PLAN));
  assert.equal(PLAN, FREE_PLAN);
  assert.deepEqual([...PLAN_FEATURES], ["pdfExport", "aiPatternReports", "extraCustomisation", "cloudBackup", "fullPractices"]);
  assert.ok(Object.isFrozen(PLAN_FEATURES));
});

test("can(): free core on, paid extensions off, unknown off", () => {
  assert.equal(can("pdfExport"), true);
  assert.equal(can("aiPatternReports"), false);
  assert.equal(can("extraCustomisation"), false);
  assert.equal(can("cloudBackup"), false);
  assert.equal(can("x"), false);
  assert.equal(can(undefined), false);
  assert.equal(can("tier"), false);
  assert.equal(can("pdfExportsPerMonth"), false);
});

test("can() follows a configured plan", () => {
  const paid = { ...FREE_PLAN, cloudBackup: true, aiPatternReports: true };
  assert.equal(can("cloudBackup", paid), true);
  assert.equal(can("aiPatternReports", paid), true);
  assert.equal(can("extraCustomisation", paid), false);
  // Only a real true opens a paid extension.
  assert.equal(can("cloudBackup", { ...FREE_PLAN, cloudBackup: "yes" }), false);
  const none = { ...FREE_PLAN, pdfExportsPerMonth: 0 };
  assert.equal(can("pdfExport", none), false);
  assert.equal(exportsLeft(null, { plan: none }), 0);
});

test("free plan: unlimited and nothing recorded", () => {
  assert.equal(exportsLeft(null), null);
  assert.equal(exportsLeft({ month: monthKey(), n: 99 }), null);
  assert.equal(exportsLeft("junk"), null);
  const tally = { month: monthKey(), n: 2 };
  const before = { ...tally };
  assert.equal(noteExport(tally), null);
  assert.equal(noteExport(null), null);
  assert.deepEqual(tally, before);
});

test("a configured limit of 3 counts down per local month", () => {
  const plan = { ...FREE_PLAN, pdfExportsPerMonth: 3 };
  const now = new Date(2026, 9, 15);
  let tally = null;
  assert.equal(exportsLeft(tally, { plan, now }), 3);
  const seen = [];
  for (let i = 1; i <= 4; i++) {
    const next = noteExport(tally, { plan, now });
    assert.notEqual(next, tally, "a new object every time");
    assert.deepEqual(next, { month: "2026-10", n: i });
    tally = next;
    seen.push(exportsLeft(tally, { plan, now }));
  }
  assert.deepEqual(seen, [2, 1, 0, 0], "never negative");
  assert.equal(tally.n, 4);
  // A new local month starts again.
  assert.equal(exportsLeft(tally, { plan, now: new Date(2026, 10, 1) }), 3);
  assert.deepEqual(noteExport(tally, { plan, now: new Date(2026, 10, 1) }), { month: "2026-11", n: 1 });
  // December rolls over into January.
  assert.equal(exportsLeft({ month: "2026-12", n: 3 }, { plan, now: new Date(2026, 11, 31) }), 0);
  assert.equal(exportsLeft({ month: "2026-12", n: 3 }, { plan, now: new Date(2027, 0, 1) }), 3);
  // The input tally is never changed.
  const t = { month: "2026-10", n: 1 };
  noteExport(t, { plan, now });
  assert.deepEqual(t, { month: "2026-10", n: 1 });
});

test("garbage tallies count as nothing used; bad limits fail closed", () => {
  for (const t of [{ month: 5 }, { month: monthKey(), n: "2" }, { month: monthKey(), n: -1 }, { month: monthKey(), n: 1.5 }, [], null, undefined, "x"]) assert.equal(exportsUsed(t), 0, JSON.stringify(t));
  assert.equal(exportsUsed({ month: monthKey(), n: 2 }), 2);
  for (const bad of [-1, "3", 2.5, NaN, true]) assert.equal(exportsLeft(null, { plan: { ...FREE_PLAN, pdfExportsPerMonth: bad } }), 0, String(bad));
});

test("monthKey is the local calendar month", () => {
  assert.equal(monthKey(new Date(2026, 0, 31, 23, 59)), "2026-01");
  assert.equal(monthKey(new Date(2026, 11, 1, 0, 1)), "2026-12");
  assert.match(monthKey(), /^\d{4}-\d{2}$/);
});

test("plan.js imports nothing and does no I/O", () => {
  const code = stripComments(readFileSync(join(HERE, "plan.js"), "utf8"));
  assert.ok(!/\bimport\s/.test(code) && !/\bimport\s*\(/.test(code) && !/\brequire\s*\(/.test(code), "no import");
  for (const w of ["fetch", "XMLHttpRequest", "sendBeacon", "indexedDB", "localStorage", "sessionStorage", "import.meta"]) assert.ok(!code.includes(w), `plan.js mentions ${w}`);
});

test("calm R5: fullPractices is Pro only; the proDev dev flag picks DEV_PRO_PLAN, nothing else does", () => {
  assert.equal(can("fullPractices"), false);
  assert.equal(can("fullPractices", { ...FREE_PLAN, fullPractices: "yes" }), false, "fails closed");
  assert.equal(planFor({}), PLAN);
  assert.equal(planFor(), PLAN);
  assert.equal(planFor({ proDev: "true" }), PLAN);
  assert.equal(planFor({ devGallery: true }), PLAN);
  assert.equal(planFor({ proDev: true }), DEV_PRO_PLAN);
  assert.ok(Object.isFrozen(DEV_PRO_PLAN));
  assert.equal(can("fullPractices", DEV_PRO_PLAN), true);
  assert.equal(can("cloudBackup", DEV_PRO_PLAN), false, "cloud backup needs its build flag and a server too");
  assert.equal(DEV_PRO_PLAN.pdfExportsPerMonth, null, "the basic PDF stays free and unlimited");
});
