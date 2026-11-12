// Task 3: Ask with evidence — the body she's shown is exactly what goes, the answer's [n] marks, the sources kept, and the
// offer (Pro + ai flag + server); and the voice guide's cues.
import test from "node:test";
import assert from "node:assert/strict";
import { evidenceBody, evidenceOffer, answerParts, cleanSources, EVIDENCE_COPY } from "./evidence.js";
import { voiceCue, pickVoice } from "./voice.js";

test("evidence: the body is the question (trimmed, 500 max) and the summary only when ticked", () => {
  assert.deepEqual(evidenceBody("  Does CBT help sleep?  "), { question: "Does CBT help sleep?" });
  const s = { kind: "cyra-summary", version: 1 };
  assert.deepEqual(evidenceBody("q?", s), { question: "q?", summary: s });
  assert.equal(evidenceBody("x".repeat(900)).question.length, 500);
});

test("evidence: offered with the ai flag and a server; open only with Pro", () => {
  assert.deepEqual(evidenceOffer({ flag: true, server: true, pro: false }), { shown: true, open: false });
  assert.deepEqual(evidenceOffer({ flag: true, server: true, pro: true }), { shown: true, open: true });
  assert.deepEqual(evidenceOffer({ flag: true, server: false, pro: true }), { shown: false, open: false });
});

test("evidence: [n] marks become links; sources are https and numbered", () => {
  assert.deepEqual(answerParts("Helps. [1][2]\n\nMixed. [3]"), [[{ text: "Helps. " }, { n: 1 }, { n: 2 }], [{ text: "Mixed. " }, { n: 3 }]]);
  assert.deepEqual(cleanSources([{ n: 1, url: "https://medlineplus.gov/a", title: " A " }, { n: 2, url: "http://cdc.gov/x", title: "B" }, { n: 3, url: "https://nih.gov/" }]), [{ n: 1, url: "https://medlineplus.gov/a", title: "A" }, { n: 3, url: "https://nih.gov/", title: "nih.gov" }]);
  assert.match(EVIDENCE_COPY.sendLines(null)[0][1], /Anthropic's search provider runs the search/);
  assert.match(EVIDENCE_COPY.foot, /not a diagnosis or dosing advice/);
});

test("voice guide: short cues for breathing, the step's text for steps; an English voice", () => {
  assert.equal(voiceCue("breath", { phase: "in" }), "Breathe in");
  assert.equal(voiceCue("breath", { phase: "out" }), "and out");
  assert.equal(voiceCue("steps", { text: "Name five things you can see." }), "Name five things you can see.");
  assert.equal(voiceCue("steps", null), "");
  const vs = [{ lang: "fr-FR", default: true }, { lang: "en-GB", localService: true }, { lang: "en-US", default: true }];
  assert.equal(pickVoice(vs).lang, "en-US");
  assert.equal(pickVoice([{ lang: "fr-FR" }]), null);
});
