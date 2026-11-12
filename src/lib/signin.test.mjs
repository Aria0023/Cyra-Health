// Task 1 (sign-in required): the REQUIRE switch, the modes the sign-in step can be in, the session kept on the device,
// and copy that stays literally true (no "anonymous", the account never holds the log, Apple first).
import test from "node:test";
import assert from "node:assert/strict";
import { parseRequire, signinMode, canSkip, gateNeeded, cleanSignin, sessionFrom, whoLine, firstNameOf, cleanCode, isEmailAddress, PROVIDERS, SIGNIN_COPY, signinInBuild } from "./signin.js";

const TOKEN = `${"a".repeat(40)}.${"b".repeat(43)}`;
const S = { token: TOKEN, id: "acct_1234567890", provider: "google", email: "maya@example.com", name: "Maya Lin", createdAt: "2026-11-12T10:00:00.000Z" };

test("signin: VITE_REQUIRE_SIGNIN is on unless it says false", () => {
  for (const v of [undefined, "", "true", "TRUE", "1", "yes"]) assert.equal(parseRequire(v), true, String(v));
  for (const v of ["false", " FALSE ", "False"]) assert.equal(parseRequire(v), false, v);
});

test("signin: the modes — no server, checking, offline, unset, optional, required", () => {
  const all = { providers: { apple: true, google: true, facebook: false, email: true } };
  assert.equal(signinMode({ build: true, server: false, config: all }), "none");
  assert.equal(signinMode({ build: false, server: true, config: all }), "none");
  assert.equal(signinMode({ build: true, server: true, config: null }), "checking");
  assert.equal(signinMode({ build: true, server: true, config: "offline" }), "offline");
  assert.equal(signinMode({ build: true, server: true, config: { providers: {} } }), "unset");
  assert.equal(signinMode({ build: true, server: true, config: { providers: { email: true } }, require: true }), "required");
  assert.equal(signinMode({ build: true, server: true, config: all, require: false }), "optional");
  assert.deepEqual(["none", "checking", "offline", "unset", "optional", "required"].map(canSkip), [true, false, false, true, true, false], "no skip while required, checking or offline");
  assert.equal(gateNeeded({ mode: "required", signedIn: false }), true);
  for (const mode of ["none", "checking", "offline", "unset", "optional"]) assert.equal(gateNeeded({ mode, signedIn: false }), false, `${mode}: an existing record opens`);
  assert.equal(gateNeeded({ mode: "required", signedIn: true }), false);
  assert.equal(signinInBuild({ signin: true }, true), true);
  assert.equal(signinInBuild({ signin: true }, false), false);
});

test("signin: the session kept on the device is exactly six checked fields", () => {
  assert.deepEqual(cleanSignin(S), S);
  assert.deepEqual(cleanSignin({ ...S, extra: "x", health: [1] }), S);
  for (const bad of [null, "x", { ...S, token: "nope" }, { ...S, provider: "twitter" }, { ...S, id: "" }]) assert.equal(cleanSignin(bad), null);
  assert.deepEqual(sessionFrom({ token: TOKEN, account: { id: S.id, provider: "google", email: S.email, name: S.name, createdAt: S.createdAt } }), S);
  assert.equal(sessionFrom({}), null);
});

test("signin: who is signed in, in plain words; first name; code and email input", () => {
  assert.equal(whoLine({ ...S, provider: "email" }), "maya@example.com");
  assert.equal(whoLine(S), "maya@example.com (Google)");
  assert.equal(whoLine({ ...S, provider: "facebook", email: "" }), "Maya Lin (Facebook)");
  assert.equal(whoLine({ ...S, provider: "apple", email: "", name: "" }), "your Apple account");
  assert.equal(firstNameOf(S), "Maya");
  assert.equal(cleanCode(" 12 34-56 7"), "123456");
  assert.ok(isEmailAddress("maya@example.com") && !isEmailAddress("maya@") && !isEmailAddress(""));
});

test("signin: Apple first, then Google and Facebook; copy stays literally true", () => {
  assert.deepEqual(PROVIDERS.map(([id]) => id), ["apple", "google", "facebook"]);
  const all = JSON.stringify(SIGNIN_COPY);
  assert.doesNotMatch(all, /anonymous|we don't know who you are/i);
  assert.match(SIGNIN_COPY.shared[0], /Never your health log/);
  assert.match(SIGNIN_COPY.deleteBody, /isn't touched/);
  assert.match(SIGNIN_COPY.whyNone, /no server/);
});
