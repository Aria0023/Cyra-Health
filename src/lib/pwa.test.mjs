/* Unit tests for the installable web app's pure helpers (lib/pwa.js, spec A14.1). Run with
   `npm run test:unit`. Checks: iPhone / iPad detection (iPadOS desktop mode included), the
   install-mode precedence (the phone app never offers install; standalone beats everything), the
   Home tip's rule (3 logged days, never once hidden or installed, only with the record in
   IndexedDB), the device-only installHint value and its one-way merge, and when a waiting
   worker is adopted silently instead of offered. */
import test from "node:test";
import assert from "node:assert/strict";
import { isIOSDevice, installModeFor, showInstallHint, offersInstall, cleanInstallHint, mergeInstallHint, updateAction, INSTALL_HINT_AFTER, SHELL_CACHE_PREFIX } from "./pwa.js";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const IPAD_DESKTOP = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";
const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36";

test("isIOSDevice: iPhone, iPad in desktop mode, not a Mac or Android", () => {
  assert.equal(isIOSDevice(IPHONE, "iPhone", 5), true);
  assert.equal(isIOSDevice(IPAD_DESKTOP, "MacIntel", 5), true);
  assert.equal(isIOSDevice(IPAD_DESKTOP, "MacIntel", 0), false);
  assert.equal(isIOSDevice(ANDROID, "Linux armv8l", 5), false);
  assert.equal(isIOSDevice(undefined, undefined, undefined), false);
});

test("installModeFor: native > standalone > ios > prompt > none", () => {
  assert.equal(installModeFor({ native: true, standalone: true, ios: true, hasPrompt: true }), "none");
  assert.equal(installModeFor({ native: true, hasPrompt: true }), "none");
  assert.equal(installModeFor({ standalone: true, ios: true, hasPrompt: true }), "standalone");
  assert.equal(installModeFor({ ios: true, hasPrompt: true }), "ios");
  assert.equal(installModeFor({ hasPrompt: true }), "prompt");
  assert.equal(installModeFor({}), "none");
  assert.equal(installModeFor(), "none");
});

test("showInstallHint: from INSTALL_HINT_AFTER days, prompt/ios only, never once hidden or installed, only when stored", () => {
  assert.equal(INSTALL_HINT_AFTER, 1); // L11: the first saved check-in
  const base = { daysLogged: 1, installHint: null, stored: true };
  assert.equal(showInstallHint({ ...base, mode: "prompt", daysLogged: 0 }), false);
  assert.equal(showInstallHint({ ...base, mode: "prompt" }), true);
  assert.equal(showInstallHint({ ...base, mode: "ios" }), true);
  assert.equal(showInstallHint({ ...base, mode: "ios", daysLogged: 0 }), false);
  assert.equal(showInstallHint({ ...base, mode: "none" }), false);
  assert.equal(showInstallHint({ ...base, mode: "standalone" }), false);
  assert.equal(showInstallHint({ ...base, mode: "prompt", installHint: "dismissed" }), false);
  assert.equal(showInstallHint({ ...base, mode: "prompt", installHint: "installed" }), false);
  assert.equal(showInstallHint({ ...base, mode: "prompt", stored: false }), false);
  assert.equal(showInstallHint({ ...base, mode: "prompt", installHint: "junk" }), true); // junk reads as null
});

test("offersInstall: prompt or ios with the record stored", () => {
  assert.equal(offersInstall({ mode: "prompt", stored: true }), true);
  assert.equal(offersInstall({ mode: "ios", stored: true }), true);
  assert.equal(offersInstall({ mode: "prompt", stored: false }), false);
  assert.equal(offersInstall({ mode: "none", stored: true }), false);
  assert.equal(offersInstall({ mode: "standalone", stored: true }), false);
});

test("cleanInstallHint accepts only dismissed / installed", () => {
  assert.equal(cleanInstallHint("dismissed"), "dismissed");
  assert.equal(cleanInstallHint("installed"), "installed");
  for (const junk of [null, undefined, "", "yes", 1, 0, true, {}, [], { v: "installed" }, "Installed"]) assert.equal(cleanInstallHint(junk), null);
});

test("mergeInstallHint is commutative and monotonic (installed > dismissed > null)", () => {
  assert.equal(mergeInstallHint(null, "dismissed"), "dismissed");
  assert.equal(mergeInstallHint("dismissed", null), "dismissed");
  assert.equal(mergeInstallHint("dismissed", "installed"), "installed");
  assert.equal(mergeInstallHint("installed", "dismissed"), "installed");
  assert.equal(mergeInstallHint("installed", null), "installed");
  assert.equal(mergeInstallHint(null, null), null);
  assert.equal(mergeInstallHint("junk", 7), null);
  const vals = [null, "dismissed", "installed", "junk"];
  for (const a of vals) for (const b of vals) assert.equal(mergeInstallHint(a, b), mergeInstallHint(b, a), `${a} / ${b}`);
});

test("updateAction: adopt only the same non-empty entry", () => {
  assert.equal(updateAction("/assets/index-abc.js", "/assets/index-abc.js"), "adopt");
  assert.equal(updateAction("/assets/index-abc.js", "/assets/index-def.js"), "prompt");
  assert.equal(updateAction("/assets/index-abc.js", null), "prompt");
  assert.equal(updateAction("/assets/index-abc.js", undefined), "prompt");
  assert.equal(updateAction(null, "/assets/index-abc.js"), "prompt");
  assert.equal(updateAction("", ""), "prompt");
});

test("the shell cache prefix matches public/sw.js", () => {
  assert.equal(SHELL_CACHE_PREFIX, "cyra-shell-");
});
