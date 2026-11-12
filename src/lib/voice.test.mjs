import test from "node:test";
import assert from "node:assert/strict";
import { voiceCue, VOICE_LINES, clipId, cleanManifest, pickVoice, BREATH_CUES } from "./voice.js";
import { PRACTICES } from "./mind.js";

test("VOICE_LINES holds every breathing cue and every step, once", () => {
  for (const c of Object.values(BREATH_CUES)) assert.ok(VOICE_LINES.includes(c));
  for (const p of PRACTICES) for (const s of p.steps || []) assert.ok(VOICE_LINES.includes(s.text));
  assert.equal(new Set(VOICE_LINES).size, VOICE_LINES.length);
});

test("clipId is stable, 8 hex characters, ignores outer and repeated spaces, and differs between lines", () => {
  assert.match(clipId("Breathe in"), /^[0-9a-f]{8}$/);
  assert.equal(clipId("Breathe in"), clipId("  Breathe   in "));
  assert.equal(new Set(VOICE_LINES.map(clipId)).size, VOICE_LINES.length);
});

test("voiceCue: breath phases and step text", () => {
  assert.equal(voiceCue("breath", { phase: "in" }), "Breathe in");
  assert.equal(voiceCue("steps", { text: "Look around." }), "Look around.");
  assert.equal(voiceCue("breath", null), "");
});

test("cleanManifest keeps only well-formed clip entries", () => {
  assert.equal(cleanManifest(null), null);
  assert.equal(cleanManifest({ clips: {} }), null);
  assert.equal(cleanManifest({ clips: { "../x": "a.mp3", abcdef12: "../evil.mp3" } }), null);
  assert.deepEqual(cleanManifest({ voice: "Calm", clips: { abcdef12: "abcdef12.mp3" } }), { voice: "Calm", clips: { abcdef12: "abcdef12.mp3" } });
});

test("pickVoice prefers natural female English voices over the default", () => {
  const v = (name, lang = "en-US", extra = {}) => ({ name, lang, localService: true, ...extra });
  assert.equal(pickVoice([v("Fred", "en-US", { default: true }), v("Samantha"), v("Ava (Premium)")]).name, "Ava (Premium)");
  assert.equal(pickVoice([v("Daniel", "en-GB", { default: true }), v("Google UK English Female", "en-GB", { localService: false })]).name, "Google UK English Female");
  assert.equal(pickVoice([v("Microsoft David"), v("Microsoft Jenny Online (Natural) - English (United States)")]).name.startsWith("Microsoft Jenny"), true);
  assert.equal(pickVoice([v("Fred", "en-US", { default: true }), v("Thomas", "fr-FR")]).name, "Fred");
  assert.equal(pickVoice([v("Thomas", "fr-FR")]), null);
});
