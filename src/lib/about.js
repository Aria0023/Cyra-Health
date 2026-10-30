/* You tab copy that is data, not layout (calm R7). Pure: no imports, no storage, no network.
   - BUILD_STAMP: the one place the build stamp is written (the splash and About & legal both render it).
   - MODULE_ADDS: the one-line "what it adds" under each module switch on You. Each sentence names only what that
     module does in this build (PCOS: the signals sheet, the long-cycle count, the pattern questions; POTS: the tools
     the POTS page has; fertility signs: the Today group). Listed in docs/CLINICIAN-REVIEW.md.
   - PLAN_COPY: the Plan card. Free is the whole app today; Pro is described, never sold here. Calm R8: "Restore purchases"
     asks lib/purchase.js, which has no store connected in this version and says so; "nothing to buy" stays true.
   - ACCOUNT_LINES / NOT_MEDICAL / AI_OFF_LINE: sentences that must stay literally true of the build. */
export const BUILD_STAMP = "BUILD 2026.10.07-D";

export const MODULE_ADDS = Object.freeze({
  pcos: "Adds a PCOS signals log, a count of cycles longer than 35 days and pattern questions about sleep, cravings, movement and cycle length. It does not diagnose PCOS.",
  pots: "Adds a guided standing test, drinks and salt, symptoms, medicines, an exercise plan and a clinician report, opened from Home.",
  fert: "Adds cervical mucus, ovulation tests and basal temperature to your log, marked on your Calendar.",
});
export const MODULE_ADDS_IDS = Object.freeze(Object.keys(MODULE_ADDS));

export const PLAN_COPY = Object.freeze({
  eyebrow: "Your plan",
  free: "Heard Health Free",
  test: "Heard Health Pro (test build)",
  body: "Everything you need to log, follow your cycle and bring a clear summary to an appointment is free. Pro adds more depth for anyone who wants it.",
  see: "See what Pro adds",
  none: "There's nothing to buy in this version.",
  testNote: "This is a test build: Pro's parts are unlocked here for checking. Nothing is bought.",
  restore: "Restore purchases",
});

export const ACCOUNT_LINES = Object.freeze({
  none: "No account. Your log lives on this device.",
  named: "No account. Your log lives on this device, and your name stays with it.",
  more: "Heard Health keeps no account or profile of you. Your name and email, if you gave them, stay on this device and go into an encrypted backup only if you save one.",
  // calm R9: a build that offers the optional account (the AccountCard's footer instead of `more`)
  moreAccount: "Heard Health keeps no profile of you. Your name and email, if you gave them, stay on this device and go into an encrypted backup only if you save one or make an account; your account itself never holds your email, only a one-way hash of it.",
});
export const NOT_MEDICAL = "Heard Health is not a medical device. It shows patterns from what you log and plain-language information. It does not diagnose, treat or replace your clinician.";
export const AI_OFF_LINE = "Questions are answered on this device from Heard Health's written library and aren't sent anywhere.";

/** The account line for an `acct` ({name, email, anon}): a name is mentioned only when she gave one. */
export const accountLine = (acct) => (acct && !acct.anon && String(acct.name || "").trim() ? ACCOUNT_LINES.named : ACCOUNT_LINES.none);
