// Local-first L4: build-time feature flags (lib/features.js). Run: npm run test:unit
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FEATURE_NAMES, DEFAULT_FEATURES, FEATURE_MODULE, FEATURES, parseFeatures, unknownFeatures, feature, remindersInBuild } from "./features.js";

const DEFAULTS = { wearables: false, counts: false, ai: true, webReminders: true, cloudBackup: false, signin: false };
const only = (...on) => Object.fromEntries(FEATURE_NAMES.map((n) => [n, on.includes(n)]));

test("features: unset, empty or blank gives a fresh copy of the shipping defaults", () => {
  for (const raw of [undefined, null, "", "   "]) {
    const f = parseFeatures(raw);
    assert.deepEqual(f, DEFAULTS, `parseFeatures(${JSON.stringify(raw)})`);
    assert.notEqual(f, DEFAULT_FEATURES);
    f.wearables = true;
    assert.equal(DEFAULT_FEATURES.wearables, false, "mutating the copy leaves the defaults alone");
  }
  assert.deepEqual({ ...DEFAULT_FEATURES }, DEFAULTS);
  assert.ok(Object.isFrozen(DEFAULT_FEATURES));
});

test("features: all, none, lists replace the defaults, case-insensitive, unknown names ignored", () => {
  for (const raw of ["all", " ALL ", "all,wearables", "ai,all"]) assert.deepEqual(parseFeatures(raw), only(...FEATURE_NAMES), raw);
  assert.deepEqual(parseFeatures("none"), only());
  assert.deepEqual(parseFeatures("counts, ai"), only("counts", "ai"));
  assert.deepEqual(parseFeatures("WebReminders"), only("webReminders"));
  assert.deepEqual(parseFeatures("bogus"), only());
  assert.deepEqual(parseFeatures("ai,bogus"), only("ai"));
  assert.deepEqual(parseFeatures(",,signin,,"), only("signin"));
  assert.deepEqual(Object.keys(parseFeatures("none")), [...FEATURE_NAMES], "always all six keys");
});

test("features: unknownFeatures names only the words that are neither a feature nor all/none", () => {
  assert.deepEqual(unknownFeatures("ai,bogus,all"), ["bogus"]);
  assert.deepEqual(unknownFeatures("none"), []);
  assert.deepEqual(unknownFeatures(undefined), []);
  assert.deepEqual(unknownFeatures("Wearables, COUNTS, x, y"), ["x", "y"]);
});

test("features: in Node (no import.meta.env) FEATURES is the frozen default set", () => {
  assert.deepEqual({ ...FEATURES }, DEFAULTS);
  assert.ok(Object.isFrozen(FEATURES));
  assert.equal(feature("ai"), true);
  assert.equal(feature("wearables"), false);
  assert.equal(feature("nope"), false);
});

test("features: remindersInBuild — phones always, the web only with webReminders", () => {
  assert.equal(remindersInBuild(true, parseFeatures("none")), true);
  assert.equal(remindersInBuild(false, parseFeatures("none")), false);
  assert.equal(remindersInBuild(false, DEFAULT_FEATURES), true);
  assert.equal(remindersInBuild(false), true, "defaults to this build's FEATURES");
});

test("features: FEATURE_MODULE maps exactly the six flags; the source has no import", () => {
  assert.deepEqual(Object.keys(FEATURE_MODULE).sort(), [...FEATURE_NAMES].sort());
  assert.ok(Object.isFrozen(FEATURE_MODULE) && Object.isFrozen(FEATURE_NAMES));
  const src = readFileSync(new URL("./features.js", import.meta.url), "utf8");
  assert.ok(!/^\s*import\s/m.test(src), "features.js imports nothing (vite.config.js and Node load it)");
  assert.match(src, /parseFeatures\(import\.meta\.env\?\.VITE_FEATURES\)/, "optional chaining keeps it importable in Node");
});

test("features: the production backend mirrors the default build (D2)", () => {
  const prod = JSON.parse(readFileSync(new URL("../../backend/config/app.json", import.meta.url), "utf8"));
  const dev = JSON.parse(readFileSync(new URL("../../backend/config/app-dev.json", import.meta.url), "utf8"));
  const want = FEATURE_NAMES.filter((n) => DEFAULT_FEATURES[n]).map((n) => FEATURE_MODULE[n]).sort();
  assert.deepEqual([...prod.modules].sort(), want);
  assert.deepEqual(want, ["ai", "push"]);
  assert.ok(!prod.modules.includes("backup"), "the backup module is not mounted in production");
  for (const m of Object.values(FEATURE_MODULE)) assert.ok(dev.modules.includes(m), `app-dev.json lists ${m}`);
});
