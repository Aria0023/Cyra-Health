/* Ask Cyra starter questions. Every string here is answered by the written library on this device
   (lib/askLibrary.js answerLocally(q).matched === true; asserted in askLibrary.test.mjs), so a tap on one
   never reaches Cyra's AI or the network. STARTERS: a short list per stage for the Ask tab (plus the
   POTS extra, offered only with the POTS add-on on). INSIGHT_STARTERS: the question each Patterns
   insight card hands to Ask ("Ask about this →"), keyed by the insight's symptom id. */

export const STARTERS = {
  peri: ["Does hormone therapy raise cancer risk?", "What helps hot flashes without hormones?", "Why can't I sleep?", "Am I in perimenopause?", "Why am I so tired?"],
  periods: ["Why are my cramps worse some months?", "Is a heavy period normal?", "When is my fertile window?", "Why can't I sleep?", "Why am I so tired?"],
  preg: ["Is it safe to exercise?", "Is this discharge normal?", "Why am I so tired?", "Why can't I sleep?"],
  pots: ["Why do I feel dizzy when I stand?"],
};

export const INSIGHT_STARTERS = {
  hf: "What helps hot flashes without hormones?",
  slp: "Why can't I sleep?",
  var: "Am I in perimenopause?",
  crm: "Why are my cramps worse some months?",
};
