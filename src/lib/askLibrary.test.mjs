/* Unit tests for Ask Cyra's written library (lib/askLibrary.js) and its backend mirror
   (backend/src/modules/ai/tasks.js, the deterministic fallback). Run with `npm run test:unit`.
   Checks: the two lists stay in step (same red flags, same entries in the same order), the four
   POTS entries sit at the top in the design's order, the design's probe questions land where they
   should on both sides, the POTS patterns never catch the bare words that belong to other topics,
   and the POTS answers carry no diagnosis, banned wording or amounts. */
import test from "node:test";
import assert from "node:assert/strict";
import { RED_FLAGS, LIBRARY, answerLocally } from "./askLibrary.js";
import { RED_FLAGS as B_RED_FLAGS, LIBRARY as B_LIBRARY } from "../../backend/src/modules/ai/tasks.js";
import { POTS_BANNED } from "./potsConstants.js";

const SIDES = [["client", RED_FLAGS, LIBRARY], ["backend", B_RED_FLAGS, B_LIBRARY]];
const POTS_N = 4;
const POTS_ASK = [
  "Is a recumbent-first exercise plan right for me, and could I have post-exertional malaise?",
  "What daily fluid and salt goal is right for me, given my blood pressure, heart and kidneys?",
  "Could my cycle (or pregnancy, or menopause) be changing my POTS symptoms, and should that change my plan?",
  "Could a standing test or tilt-table test help explain why I feel unwell when I stand, and should we check for other causes?",
];
// The same route answerLocally and the backend fallback take: red flags first, then the first library hit.
const route = (rf, lib, q) => (rf.test(q) ? "urgent" : lib.findIndex((e) => e.re.test(q)));
const idxOf = (lib, needle) => lib.findIndex((e) => e.re.source.includes(needle));

test("client and backend libraries match (parity)", () => {
  assert.equal(B_RED_FLAGS.source, RED_FLAGS.source, "RED_FLAGS source");
  assert.equal(B_RED_FLAGS.flags, RED_FLAGS.flags, "RED_FLAGS flags");
  assert.equal(B_LIBRARY.length, LIBRARY.length, "same number of entries");
  LIBRARY.forEach((e, i) => {
    const b = B_LIBRARY[i];
    assert.equal(b.re.source, e.re.source, `entry ${i} regex source`);
    assert.equal(b.re.flags, e.re.flags, `entry ${i} regex flags`);
    assert.equal(b.answer, e.answer, `entry ${i} answer`);
    assert.equal(b.source_note, e.source_note, `entry ${i} source_note`);
    assert.equal(b.ask, e.ask, `entry ${i} ask`);
  });
});

test("RED_FLAGS is unchanged and still first", () => {
  // The pre-POTS source, verbatim (design §7, owner decision D10).
  assert.equal(RED_FLAGS.source, "chest pain|can'?t breathe|short(ness)? of breath|faint|passed out|soak(ing|ed)? (a |one )?(pad|tampon)|every hour|hourly|bleeding (heavily|through)|large clots|severe headache|vision (change|blur)|suicid|kill myself|self[- ]harm|end my life|(no|less|reduced) (fetal |baby )?move|baby (isn'?t|is not|stopped) moving|fever (over|above|of) (39|102|103)|severe (pain|swelling)|seizure|collapsed");
  for (const [side, rf, lib] of SIDES) {
    for (const q of ["I feel faint", "I passed out after standing, is it POTS?", "chest pain with POTS", "short of breath when I stand up", "vision blur when I get up with POTS"]) {
      assert.equal(route(rf, lib, q), "urgent", `${side}: ${q}`);
    }
  }
  const r = answerLocally("I feel faint when I stand, could it be POTS?");
  assert.equal(r.urgent, true);
});

test("the four POTS entries are at the top, in order", () => {
  for (const [side, , lib] of SIDES) {
    assert.ok(lib.length >= POTS_N + 10, `${side}: existing entries kept`);
    POTS_ASK.forEach((ask, i) => assert.equal(lib[i].ask, ask, `${side}: entry ${i + 1}`));
    for (const e of lib.slice(POTS_N)) assert.ok(!/\bpots\b/i.test(e.answer), `${side}: only the POTS entries talk about POTS`);
  }
});

test("design probe questions route as listed, on both sides", () => {
  for (const [side, rf, lib] of SIDES) {
    const exercise = idxOf(lib, "yoga"), hotFlash = idxOf(lib, "hot flash");
    assert.ok(exercise >= POTS_N && hotFlash >= POTS_N, `${side}: existing entries found`);
    const want = [
      ["can I exercise with POTS", 0],
      ["how much salt for POTS", 1],
      ["is POTS worse on my period", 2],
      ["dizzy when I stand up", 3],
      ["I feel faint", "urgent"],
      ["is exercise safe in pregnancy", exercise],
      ["hot flashes at night", hotFlash],
      ["what is postural tachycardia syndrome", 3],
      // extra cases in the same spirit
      ["POTS exercise", 0],
      ["what workouts are OK with pots", 0],
      ["electrolyte drinks and POTS", 1],
      ["does POTS change in pregnancy", 2],
      ["POTS and perimenopause", 2],
      ["heart racing when I stand", 3],
      ["lightheaded getting up in the morning", 3],
      ["orthostatic hypotension", 3],
      ["what is a tilt table test", 3],
      ["dysautonomia", 3],
    ];
    for (const [q, i] of want) assert.equal(route(rf, lib, q), i, `${side}: "${q}"`);
    // These belong to the existing topics (or to none): never a POTS entry.
    for (const q of ["tachycardia in pregnancy", "heart flutters perimenopause", "is salt bad for blood pressure", "salt tablets", "exercise intolerance", "postural changes in pregnancy", "orthostatic", "deconditioning after illness", "water retention before my period"]) {
      const got = route(rf, lib, q);
      assert.ok(got === "urgent" || got === -1 || got >= POTS_N, `${side}: "${q}" → ${got}`);
    }
  }
  assert.equal(route(RED_FLAGS, LIBRARY, "exercise intolerance"), idxOf(LIBRARY, "yoga"), "falls through to the existing exercise entry");
  assert.equal(route(RED_FLAGS, LIBRARY, "salt tablets"), -1, "no entry");
});

test("answerLocally returns a POTS entry with its source and question", () => {
  const r = answerLocally("can I exercise with POTS");
  assert.equal(r.matched, true);
  assert.equal(r.urgent, false);
  assert.equal(r.ask_your_doctor, POTS_ASK[0]);
  assert.match(r.source_note, /NG206/);
});

test("POTS answers: no diagnosis, no banned wording, no amounts", () => {
  const DOSE_RE = /\b\d+(\.\d+)?\s?(mg|g|mcg)\b/;
  for (const e of LIBRARY.slice(0, POTS_N)) {
    for (const s of [e.answer, e.source_note, e.ask]) {
      assert.ok(!POTS_BANNED.test(s), `banned wording: ${s}`);
      // The salt-to-sodium conversion is a label fact, not an amount to take; nothing else may hold a number.
      const t = s.replace("1 gram of salt has about 390 mg of sodium", "");
      assert.ok(!DOSE_RE.test(t), `amount: ${s}`);
      assert.ok(!/\b\d+(\.\d+)?\s?(litres?|liters?|L|ml|grams?|tablets?)\b/i.test(t), `amount: ${s}`);
    }
  }
  assert.match(LIBRARY[3].answer, /Cyra can't diagnose POTS; only a clinician can\.$/);
});
