/* POTS add-on: static libraries, thresholds and copy (docs/CYRA-BUILD-SPEC.md A13).
   Nothing here holds state. Every id, threshold and sentence is normative; the clinical
   figures and every safety sentence need clinician sign-off before release (Q1), and the
   medicine library needs pharmacist review. No dose appears anywhere in this file.

   Ids: built-in symptoms are p_*, built-in triggers t_*, her own symptoms c_*, her own
   triggers x_*. All match /^(p|t|c|x)_[a-z0-9]{1,16}$/ and none can equal a weekly-count
   flag id (hf, ns, crm, mood, nau, swl) or a SYM / PSYM / GSYM key, so POTS data can never
   be mistaken for a check-in symptom or reach weekly counts (lib/pulse.js eventsForDay). */

/** The 17 built-in POTS symptoms, in default chip order. Labels are the chip text and the
    aria-label stem ("Dizzy or lightheaded, severity 2 of 3"). */
export const POTS_SYM = [
  { id: "p_psy", label: "Nearly fainting" },
  { id: "p_dzy", label: "Dizzy or lightheaded" },
  { id: "p_pal", label: "Racing or pounding heart" },
  { id: "p_fog", label: "Brain fog" },
  { id: "p_fat", label: "Fatigue" },
  { id: "p_adr", label: "Adrenaline surges" },
  { id: "p_sob", label: "Short of breath" },
  { id: "p_hda", label: "Headache" },
  { id: "p_gi", label: "Nausea or tummy trouble" },
  { id: "p_heat", label: "Heat intolerance" },
  { id: "p_trem", label: "Shaky or tremor" },
  { id: "p_pool", label: "Blood pooling (red or purple legs)" },
  { id: "p_exint", label: "Exercise intolerance" },
  { id: "p_chest", label: "Chest discomfort" },
  { id: "p_vis", label: "Vision dimming" },
  { id: "p_cold", label: "Cold hands or feet" },
  { id: "p_slp", label: "Unrefreshing sleep" },
];

/** The 15 built-in triggers. t_period and t_premens are her own tags, shown in every stage;
    cycle groups come from logged period starts, never from these tags. */
export const POTS_TRIG = [
  { id: "t_heat", label: "Heat or hot weather" },
  { id: "t_shower", label: "Hot shower or bath" },
  { id: "t_stand", label: "Standing still a long time" },
  { id: "t_meal", label: "A big meal" },
  { id: "t_alcohol", label: "Alcohol" },
  { id: "t_period", label: "On my period" },
  { id: "t_premens", label: "Week before my period" },
  { id: "t_illness", label: "Being ill" },
  { id: "t_travel", label: "Travel" },
  { id: "t_lowfluid", label: "Not much to drink" },
  { id: "t_stress", label: "Stress" },
  { id: "t_exertion", label: "Exertion" },
  { id: "t_morning", label: "Getting up in the morning" },
  { id: "t_caffeine", label: "Caffeine" },
  { id: "t_poorsleep", label: "Poor sleep" },
];

/** Stand-test "How do you feel?" chips, in display order, and the symptom id each records. */
export const RUNNER_FEEL = [
  { id: "p_dzy", label: "Dizzy" },
  { id: "p_pal", label: "Racing heart" },
  { id: "p_vis", label: "Vision dimming" },
  { id: "p_gi", label: "Sick" },
  { id: "p_trem", label: "Shaky" },
  { id: "p_sob", label: "Short of breath" },
  { id: "p_chest", label: "Chest pain" },
];
/** Feel chips that raise the lie-down interrupt card while upright (A13.4). */
export const FEEL_STOP = ["p_vis", "p_gi", "p_sob"];

/** Check-in symptom ids that overlap a POTS symptom, per stage (the "Already in today's
    check-in" line and the report's overlap column). Read only; POTS never writes them. */
export const POTS_RELATED = {
  peri: ["fog", "pal", "hda", "slp"],
  periods: ["hda", "nau"],
  preg: ["dzy", "nau"],
};

/** Medicines and supports: names, classes and a plain line only. Never a dose, an amount
    or timing advice. `kind` only pre-selects the Type row (rx / otc / supp / aid).
    Needs pharmacist review before release. */
export const POTS_MED_LIB = [
  { id: "fludro", name: "Fludrocortisone", cls: "Mineralocorticoid", line: "Helps the body hold on to salt and water", kind: "rx" },
  { id: "mido", name: "Midodrine", cls: "Alpha-1 agonist", line: "Tightens blood vessels", kind: "rx" },
  { id: "prop", name: "Propranolol", cls: "Beta blocker", line: "Slows the heart rate", kind: "rx" },
  { id: "meto", name: "Metoprolol", cls: "Beta blocker", line: "Slows the heart rate", kind: "rx" },
  { id: "biso", name: "Bisoprolol", cls: "Beta blocker", line: "Slows the heart rate", kind: "rx" },
  { id: "bb", name: "Another beta blocker", cls: "Beta blocker", line: "", kind: "rx" },
  { id: "ivab", name: "Ivabradine", cls: "Heart-rate-lowering (If-channel blocker)", line: "Slows the heart rate in a different way", kind: "rx" },
  { id: "pyri", name: "Pyridostigmine", cls: "Acetylcholinesterase inhibitor", line: "Strengthens nerve signals to the heart and blood vessels", kind: "rx" },
  { id: "droxi", name: "Droxidopa", cls: "Norepinephrine precursor", line: "Supports blood pressure on standing", kind: "rx" },
  { id: "desmo", name: "Desmopressin", cls: "Vasopressin analogue", line: "Helps the body hold water", kind: "rx" },
  { id: "clon", name: "Clonidine", cls: "Central sympatholytic", line: "Calms the \"fight or flight\" system", kind: "rx" },
  { id: "mdopa", name: "Methyldopa", cls: "Central sympatholytic", line: "Calms the \"fight or flight\" system", kind: "rx" },
  { id: "ssri", name: "SSRI or SNRI", cls: "Antidepressant class, sometimes used in POTS", line: "", kind: "rx" },
  { id: "ahist", name: "H1 or H2 antihistamine", cls: "Antihistamine", line: "Often used when mast cells are involved", kind: "otc" },
  { id: "rx", name: "Other prescription", cls: "", line: "", kind: "rx" },
  { id: "iron", name: "Iron", cls: "Supplement", line: "", kind: "supp" },
  { id: "mag", name: "Magnesium", cls: "Supplement", line: "", kind: "supp" },
  { id: "b12", name: "Vitamin B12", cls: "Supplement", line: "", kind: "supp" },
  { id: "supp", name: "Other supplement", cls: "Supplement", line: "", kind: "supp" },
  { id: "comp_waist", name: "Compression (waist-high)", cls: "Support", line: "", kind: "aid" },
  { id: "comp_leg", name: "Compression (leg)", cls: "Support", line: "", kind: "aid" },
  { id: "binder", name: "Abdominal binder", cls: "Support", line: "", kind: "aid" },
  { id: "bed", name: "Raised head of bed", cls: "Support", line: "", kind: "aid" },
];

/** Standing-test and input constants (A13.4). Sources: Sheldon RS et al., Heart Rhythm
    2015 (HRS: >= 30 bpm within 10 min, >= 40 at ages 12-19); Freeman R et al., Clin Auton Res
    2011 (OH >= 20/10 within 3 min); Fanciulli A et al., Clin Auton Res 2018 (supine
    hypertension >= 140/90); AHA (hypertensive crisis >= 180/120). The sustained-pair rule and
    every live-interrupt threshold are Cyra's operational reading and need sign-off (Q1). */
export const THRESH = {
  hr: 30, hrTeen: 40,                 // heart-rate rise threshold
  pairMinMin: 3, pairGapMax: 5,       // sustained pair: later reading at minute >= 3, <= 5 min apart
  upMaxMin: 10.5, completeMin: 9.5,   // upright readings counted up to 10:30; "complete" reaches minute 9.5
  countedBand: 6,                     // counted-pulse caveat when |peak rise - thr| <= 6
  restHigh: 100, hr120: 120,
  ohSys: 20, ohDia: 10, ohMin: 3,     // orthostatic BP drop within 3 minutes
  supineSys: 140, supineDia: 90, supineTests: 2,
  crisisSys: 180, crisisDia: 120,     // live crisis interrupt
  lowSys: 80,                         // live low-BP interrupt (upright)
  hrFall: 20, hrHigh: 170,            // live interrupts that need no BP
  staleMin: 30,                       // a running test untouched this long is "interrupted" at launch
  repeatMin: 30,                      // "Took my meds" skips a medicine taken this recently
  range: { hr: [30, 220], sys: [60, 260], dia: [30, 160] },   // input sanity; outside = not stored
  // Live safety checks use the value as typed, up to these caps (beyond them it can only be a
  // typo): a confirmed HR of 230 or a BP of 270/130 still raises its card, though it isn't stored.
  plaus: { hr: [20, 300], sys: [40, 300], dia: [20, 250] },
};

/** The one emergency phrase every card uses (owner decision D11). */
export const EMERGENCY = "your local emergency number (911 in the US)";

/** Safety copy: the UrgentCard variants (ESC 2018 syncope guidance and AHA guidance,
    paraphrased) and the stand-test live interrupts. Clinician sign-off required (Q1). */
export const SAFETY_COPY = {
  urgent: {
    test: "Call your local emergency number (911 in the US) if you faint and hit your head, or have chest pain, trouble breathing, a racing heartbeat that doesn't settle after lying down, confusion, or weakness on one side.",
    faint: [
      { lead: "Get help now: call your local emergency number (911 in the US)", text: " if someone who fainted can't be woken, isn't breathing normally, has a seizure, or if there's chest pain, severe shortness of breath, or new weakness, numbness, confusion or trouble speaking." },
      { lead: "Get checked the same day", text: " if a faint happened during exercise or while lying down; came with chest pain, shortness of breath, or a pounding or irregular heartbeat just before; caused an injury or a knock to the head; took more than a minute or so to come round or left you confused; or was your first ever faint." },
      { lead: "Otherwise:", text: " lie down with your legs raised until you feel steady, sip a drink once you're fully alert, and tell your clinician soon, especially if fainting is new or happening more." },
    ],
    faintInjury: "You were hurt when you fainted. Get checked today. Call your local emergency number (911 in the US) if you hit your head and feel confused, sick or very sleepy, or have chest pain or trouble breathing.",
    chest: "Chest pain or tightness needs checking. If it's new, severe, spreads to your arm, jaw or back, or comes with shortness of breath, sweating or fainting, call your local emergency number now (911 in the US). If it's your usual POTS pattern and settles when you lie down, note it for your clinician.",
    breath: "If you're struggling to breathe, your lips look blue, or it came on suddenly with chest pain, call your local emergency number now (911 in the US). Otherwise, call your clinician today.",
    pregSuffix: "…and call your maternity team today.",
  },
  interrupt: {
    feel: { copy: "Lie down now and raise your legs. You can stop here.", stop: "Stop and lie down", go: "I feel okay, continue" },
    hrFall: { copy: "Your heart rate just fell quickly after rising. That can happen before a faint. Lie down now and raise your legs. You can stop here.", stop: "Stop and lie down", go: "I feel okay, continue" },
    hrHigh: { copy: "That's a very fast heart rate. Lie down now and raise your legs. If it doesn't settle within a few minutes of lying down, or you have chest pain, trouble breathing or feel faint, call your local emergency number (911 in the US).", stop: "Stop and lie down", go: "I feel okay, continue" },
    bpCrisis: { copy: "That's a very high reading. Sit or lie down, rest 5 minutes, and measure again. If it's still that high, or you have chest pain, shortness of breath, back pain, numbness or weakness, vision changes or trouble speaking, call your local emergency number (911 in the US).", stop: "Stop the test", go: "Recheck" },
    bpLow: { copy: "Your blood pressure has dropped. Lie down now and raise your legs. You can stop here.", stop: "Stop and lie down", go: "I feel okay, continue" },
  },
};

/** Guideline context for the goal sheet's "What guidelines say" Details. Paragraphs are
    lists of segments; { b } is shown bold. The figures paragraph ships only once the
    clinical reviewer has checked it against HRS 2015 and CCS 2020 (Q1): until then
    GUIDE_VERIFIED stays false and the figure-free paragraph is used instead. Never a
    default, never pre-filled. */
export const GUIDE_VERIFIED = false;
const GUIDE_FIGURES = ["Expert guidance for adults with POTS often mentions about 2 to 3 litres of fluid a day and about 10 to 12 grams of salt (sodium chloride), which is roughly 4 to 5 grams of sodium, ", { b: "only when a clinician agrees" }, ". (Heart Rhythm Society 2015; Canadian Cardiovascular Society 2020.) Clinicians adjust these for each person. They aren't a goal Cyra sets for you."];
const GUIDE_NO_FIGURES = ["Expert guidance for adults with POTS often suggests more fluid and more salt than usual, only when a clinician agrees (Heart Rhythm Society 2015; Canadian Cardiovascular Society 2020). Clinicians set the amounts for each person."];
export const GUIDE_COPY = [
  GUIDE_VERIFIED ? GUIDE_FIGURES : GUIDE_NO_FIGURES,
  ["Salt and sodium are different numbers. 1 gram of salt has about 390 mg of sodium. Food labels usually list sodium."],
  [{ b: "Don't raise salt or fluids without your clinician's OK if you have" }, " high blood pressure; heart, kidney or liver disease; have been told to limit salt or fluids; or are pregnant. High blood pressure in pregnancy, including pre-eclampsia, makes this especially important. Some POTS medicines also change what's right for you."],
];

/** Words POTS output must never contain: no diagnosis stated, hedged ("you may have POTS",
    "consistent with POTS") or denied ("you don't have POTS", "rules out POTS"), no test called
    positive / negative / (ab)normal, and no "late" or "missed". Checked by unit tests over
    every string the POTS engine returns and by e2e checks of the rendered POTS screens; it
    is not a whole-bundle grep (other screens legitimately say "Rh-negative"). */
export const POTS_BANNED = /\byou(?:['’]ve)?\s+(?:(?:may|might|probably|likely|could|would|definitely|certainly|do not|don['’]t|do)\s+)?(?:have|got)\s+POTS\b(?! whether)|\b(?:consistent with|suggest(?:s|ive of)?|confirms?|rules? out|indicates?|points? to)\s+POTS\b|\bdiagnosed with\b|\b(positive|negative|abnormal|normal result)\b|\b(late|missed)\b/i;
