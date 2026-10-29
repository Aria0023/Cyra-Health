// Navigation model (calm R2). Run with: node --test src/lib/*.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { TABS, TAB_IDS, viewsOf, tabOf, viewForTab, parseRoute, routeOf, LOG_ITEMS, logItemsFor } from "./routes.js";

const PREG = { preg: true }, MENO = { meno: true };

test("five tabs in every stage: Home, Body, Mind, Patterns, You", () => {
  assert.deepEqual(TABS.map((t) => t.label), ["Home", "Body", "Mind", "Patterns", "You"]);
  for (const o of [{}, PREG, MENO]) for (const t of TAB_IDS) assert.ok(viewsOf(t, o).length >= 1, `${t} has a view`);
});

test("old screens fold into the new tabs", () => {
  const want = { home: "home", today: "body", cal: "body", cycles: "body", connect: "mind", ask: "mind", patterns: "patterns", report: "patterns", you: "you" };
  for (const [v, t] of Object.entries(want)) assert.equal(tabOf(v), t, v);
  for (const [v, t] of Object.entries({ home: "home", today: "body", cal: "body", connect: "mind", ask: "mind", mile: "patterns", you: "you" })) assert.equal(tabOf(v, PREG), t, `preg ${v}`);
  assert.equal(tabOf("report", PREG), null); // pregnancy has no Report
  assert.equal(tabOf("cycles", MENO), null); // nor menopause a cycles list
  assert.equal(tabOf("nope"), null);
  // Segment labels (spec R2): Body Logs | Calendar | Cycles; Mind Today | Journey (Practices joins in R5); Patterns Patterns | Report.
  assert.deepEqual(viewsOf("body").map(([, l]) => l), ["Logs", "Calendar", "Cycles"]);
  assert.deepEqual(viewsOf("mind").map(([, l]) => l), ["Today", "Journey"]);
  assert.deepEqual(viewsOf("patterns").map(([, l]) => l), ["Patterns", "Report"]);
  assert.deepEqual(viewsOf("body", MENO).map(([, l]) => l), ["Logs", "Calendar"]);
  assert.equal(viewsOf("mind").some(([, l]) => /Practices/.test(l)), false);
});

test("viewForTab: the last view she had in a tab, else its first", () => {
  assert.equal(viewForTab("body"), "today");
  assert.equal(viewForTab("body", { body: "cal" }), "cal");
  assert.equal(viewForTab("body", { body: "report" }), "today");
  assert.equal(viewForTab("body", { body: "cycles" }, MENO), "today");
  assert.equal(viewForTab("patterns", {}, PREG), "mile");
  assert.equal(viewForTab("nope"), null);
});

test("parseRoute: new links, old links redirect, other hashes are not routes", () => {
  assert.deepEqual(parseRoute("#/body"), { tab: "body", view: "today" });
  assert.deepEqual(parseRoute("#/body/calendar"), { tab: "body", view: "cal" });
  assert.deepEqual(parseRoute("#/Body/Cycles/"), { tab: "body", view: "cycles" });
  assert.deepEqual(parseRoute("#/patterns/report"), { tab: "patterns", view: "report" });
  assert.deepEqual(parseRoute("#/mind/journey"), { tab: "mind", view: "ask" });
  assert.deepEqual(parseRoute("#/body/nonsense"), { tab: "body", view: "today" });
  // Old tab names.
  assert.deepEqual(parseRoute("#/today"), { tab: "body", view: "today" });
  assert.deepEqual(parseRoute("#/calendar"), { tab: "body", view: "cal" });
  assert.deepEqual(parseRoute("#/report"), { tab: "patterns", view: "report" });
  assert.deepEqual(parseRoute("#/ask"), { tab: "mind", view: "ask" });
  assert.deepEqual(parseRoute("#/connect"), { tab: "mind", view: "connect" });
  assert.deepEqual(parseRoute("#/care"), { tab: "you", view: "you", section: "care" });
  assert.deepEqual(parseRoute("#/milestones", PREG), { tab: "patterns", view: "mile" });
  assert.equal(parseRoute("#/report", PREG), null);
  assert.deepEqual(parseRoute("#/cycles", MENO), null);
  for (const h of ["", "#", "#restored", "#restored=rem", "#restore", "#oauth=abc", "#/dev/ui", "#/dev/ui?stage=preg", "#/today/x", "#/nope", null, undefined]) assert.equal(parseRoute(h), null, String(h));
});

test("routeOf round-trips through parseRoute", () => {
  for (const o of [{}, PREG, MENO]) for (const t of TAB_IDS) for (const [v] of viewsOf(t, o)) assert.equal(parseRoute(routeOf(v, o), o).view, v, `${v} ${JSON.stringify(o)}`);
  assert.equal(routeOf("cal"), "#/body/calendar");
  assert.equal(routeOf("home"), "#/home");
  assert.equal(routeOf("today"), "#/body");
});

test("log sheet items: Symptoms · Period · Sleep · Mood · Move · Meds · Note, each only where its logger exists", () => {
  assert.deepEqual(LOG_ITEMS.map((i) => i.label), ["Symptoms", "Period", "Sleep", "Mood", "Move", "Meds", "Note", "PCOS signals"]);
  assert.deepEqual(logItemsFor().map((i) => i.id), LOG_ITEMS.map((i) => i.id).filter((id) => id !== "pcos"));
  assert.deepEqual(logItemsFor({ pcos: true }).map((i) => i.id), LOG_ITEMS.map((i) => i.id));
  assert.deepEqual(logItemsFor({ move: false, period: false }).map((i) => i.label), ["Symptoms", "Sleep", "Mood", "Meds", "Note"]);
});

test("routes.js is pure", () => {
  const src = fs.readFileSync(new URL("./routes.js", import.meta.url), "utf8");
  assert.equal(/^import /m.test(src), false);
  for (const bad of [/fetch\(/, /localStorage/, /sessionStorage/, /indexedDB/i, /window\./, /document\./]) assert.equal(bad.test(src), false, `found ${bad}`);
});
