/* Static libraries, option lists, palettes and copy tables. Every value here is
   normative (see docs/CYRA-BUILD-SPEC.md); nothing in this file holds state. */

/* Low energy (L6, decision D8: the brief names energy). Its id is the last key of both check-in libraries; L8 reads it from here. */
export const ENERGY_ID = "eng";
export const SYM = { hf: "Hot flashes", ns: "Night sweats", fog: "Brain fog", mood: "Mood swings", slp: "Sleep disruption", ach: "Joint aches", dry: "Vaginal dryness", pal: "Heart flutters", hda: "Headaches", lib: "Libido change", anx: "Anxiety", itc: "Skin/itching", [ENERGY_ID]: "Low energy" };
export const SYMS = Object.keys(SYM);
export const PSYM = { crm: "Cramps", hda: "Headaches", blo: "Bloating", mood: "Mood swings", ten: "Breast tenderness", acn: "Skin breakouts", bak: "Back pain", nau: "Nausea", cra: "Cravings", lib: "Libido change", [ENERGY_ID]: "Low energy" };
export const GSYM = { nau: "Nausea", hb: "Heartburn", swl: "Swelling", bak: "Back pain", crp: "Cramping", dzy: "Dizziness", brx: "Braxton-Hicks", con: "Constipation" };
/* Every check-in symptom id (cycle and perimenopause libraries) → its label. Her list can borrow from the other
   stage's library (lib/daylog.js), so the labels for any tracked id come from here. */
export const ALL_SYM = { ...SYM, ...PSYM };
/* Day-score divisor (spec §6.3): the library sizes when the score was defined. Fixed, so adding a symptom to a
   library or to her list never rescales a past day; every tracked symptom still adds its severity. */
export const SCORE_SCALE = Object.freeze({ peri: 12, periods: 10, preg: 8 });
/* What the "Your symptoms" sheet calls the other stage's library ("Add from the perimenopause list"). */
export const OTHER_LIST = Object.freeze({ periods: "perimenopause list", peri: "cycle list" });

/* Scales & body signals logged separately from yes/no symptoms */
/* Connection & intimacy — built on the dyadic/desire literature:
   relationship context predicts desire far more than hormone levels (SWAN),
   nurturant vs sexual contact move hormones differently (Steroid/Peptide
   theory), and the field's own gap is same-sex dyads — so nothing here
   assumes a partner's gender or a single partner. */
export const CONNECT = {
  closeness: { label: "Closeness today", low: "Distant", high: "Very close" },
  desire:    { label: "Desire", low: "None", high: "Strong" },
  friction:  { label: "Tension or conflict", low: "None", high: "A lot" },
  load:      { label: "Fairness of the mental load", low: "Mostly on me", high: "Shared" },
};
export const INTIMACY = [["none", "None"], ["affection", "Affection"], ["sexual", "Sexual"], ["both", "Both"]];
export const AFTER = [["better", "Felt better after"], ["same", "About the same"], ["worse", "Felt worse"], ["pain", "Pain or dryness"]];
export const RELATIONSHIP = [["partnered", "Partnered"], ["multi", "More than one partner"], ["single", "Single / solo"], ["na", "Prefer not to say"]];

/* Check-in cadence — the user sets the tempo; the app never nags. */
export const CADENCE = [
  { id: "daily", label: "Daily", desc: "30-second check-in, once a day" },
  { id: "weekdays", label: "Weekdays", desc: "Skip weekends" },
  { id: "3x", label: "3× a week", desc: "Mon · Wed · Fri" },
  { id: "weekly", label: "Weekly", desc: "One reflective check-in" },
  { id: "me", label: "When I feel like it", desc: "No reminders at all" },
];
/* Quick check-in (spec A8): three questions per stage, each with four answers that read as answers to
   that question. Answers are saved as 0-3 in order (the index is the value QUICK_MAP folds onto the
   hero symptom), so "Rough night" on "How did you sleep?" is the same 2 "Yes" used to be. QuickCheckin.jsx
   is the only reader. The pregnancy card is never rendered (Pregnancy Today has no quick mode). */
const QUICK_D = ["No / fine", "A little", "Yes", "A lot"];
export const QUICK_Q = {
  periods: [
    { q: "Any cramps or bloating?", a: QUICK_D },
    { q: "Any headaches?", a: QUICK_D },
    { q: "Mood today?", a: ["Steady", "A bit off", "Low", "Really low"] },
  ],
  peri: [
    { q: "Any hot flashes or night sweats?", a: QUICK_D },
    { q: "How did you sleep?", a: ["Slept well", "So-so", "Rough night", "Barely slept"] },
    { q: "How's your focus?", a: ["Sharp", "A bit foggy", "Foggy", "Can't think"] },
  ],
  preg: [
    { q: "Any nausea or heartburn?", a: QUICK_D },
    { q: "Swelling anywhere?", a: QUICK_D },
    { q: "Energy today?", a: QUICK_D },
  ],
};
/* The hero symptom each quick question is saved as (spec A8: quick answers map onto hero
   symptoms so patterns still compute). Every target is a tracked SYM / PSYM key. */
export const QUICK_MAP = {
  periods: { q1: "crm", q2: "hda", q3: "mood" },
  peri: { q1: "hf", q2: "slp", q3: "fog" },
};

export const SCALES = [
  { id: "fatigue", label: "Fatigue", low: "Energized", high: "Wiped out" },
  { id: "pain", label: "Pain", low: "None", high: "Severe" },
  { id: "moodq", label: "Mood", low: "Low", high: "Great" },
  { id: "stress", label: "Stress", low: "Calm", high: "Maxed" },
];
export const FLOW = [["spot", "Spotting"], ["light", "Light"], ["med", "Medium"], ["heavy", "Heavy"], ["flood", "Flooding"]];
export const DISCHARGE = [["none", "None"], ["creamy", "Creamy"], ["eggwhite", "Egg-white"], ["sticky", "Sticky"], ["watery", "Watery"], ["unusual", "Unusual"]];
/* Fertility signs (L7, decision D6): UI option lists for Today's "Fertility signs" group (lib/fertility.js), not data-viz
   colours. "none" on the ovulation test means "Not tested" and is never saved (an absent opk is "not tested"). */
export const CERVICAL_MUCUS = [["dry", "Dry"], ["sticky", "Sticky"], ["creamy", "Creamy"], ["watery", "Watery"], ["eggwhite", "Egg-white"]];
export const OVULATION_TEST = [["none", "Not tested"], ["neg", "Negative"], ["pos", "Positive"]];
/* The stage label that marks Trying to conceive (stage "periods"): written by finishReg and engine routeIntake, read by
   lib/fertility.js isTTC (re-exported there as TTC_NAME) and equal to lib/record.js PHASES.ttc.stageName. */
export const TTC_NAME = "Trying to Conceive";
export const ODOR = [["none", "Nothing unusual"], ["mild", "Mild change"], ["strong", "Strong"], ["fishy", "Fishy"], ["yeasty", "Yeasty / sour"]];
export const BODYODOR = [["same", "Same as usual"], ["stronger", "Stronger"], ["changed", "Different"]];

/* Pregnancy — the evidence-based low-risk prenatal schedule (spec §7), read by MilestonesScreen (every item,
   status-tagged against the current week), engine.roadmapAdvice() (the derived "Next visit" sentence) and the
   pregnancy Home insight. `from`/`to` are the item's window in weeks; `when` overrides the "Weeks {w}" eyebrow
   where a week range would read wrong (UI M1). */
export const PRENATAL = [
  { tri: "First trimester", items: [
    { w: "8–10", from: 8, to: 10, label: "Initial visit + full labs", note: "Blood type & Rh, antibody screen, blood count, immunity (rubella, varicella), hepatitis B & C, HIV, syphilis, urine culture, gonorrhea/chlamydia." },
    { w: "8–12", from: 8, to: 12, label: "Dating ultrasound", note: "Confirms due date — the anchor for everything after." },
    { w: "10+", from: 10, to: 13, label: "Genetic screening (NIPT)", note: "Cell-free DNA from week 10, or combined nuchal scan at 11–13. Optional, your call." },
    { w: "any", when: "Any week", from: 0, to: 13, label: "Folate + vaccines", note: "Prenatal vitamin with folate; flu and COVID vaccines recommended in any trimester." },
  ]},
  { tri: "Second trimester", items: [
    { w: "15–20", from: 15, to: 20, label: "Serum screen (if no NIPT)", note: "The quad screen window, for those who skipped cell-free DNA." },
    { w: "18–22", from: 18, to: 22, label: "Anatomy scan", note: "The big ultrasound — organs, growth, placenta position." },
    { w: "24–28", from: 24, to: 28, label: "Glucose screening", note: "One-hour 50g screen for gestational diabetes; repeat blood count for anemia rides along." },
    { w: "27–36", from: 27, to: 36, label: "Tdap vaccine", note: "Every pregnancy — it's how baby gets whooping-cough protection before their own shots." },
    { w: "28", from: 28, to: 28, label: "RhoGAM (if Rh-negative)", note: "Only applies if your blood type is Rh-negative — your week-8 labs answered that." },
  ]},
  { tri: "Third trimester", items: [
    { w: "28+", from: 28, to: 40, label: "Daily kick awareness", note: "From 28 weeks, the movement pattern matters — a real change in the pattern is a call-today, not a wait." },
    { w: "32–36", from: 32, to: 36, label: "RSV vaccine (seasonal)", note: "Given Sept–Jan in the US to protect baby's first RSV season." },
    { w: "36–37", from: 36, to: 37, label: "GBS swab", note: "Quick routine test; a positive just means antibiotics in labor." },
    { w: "36", from: 36, to: 40, label: "Position check + weekly visits", note: "Baby's position confirmed; cadence steps up to weekly." },
    { w: "41", from: 41, to: 42, label: "Post-dates monitoring", note: "Extra monitoring from 41 weeks; induction offered by 41–42 — evidence favors not going far past." },
  ]},
  { tri: "After birth", items: [
    { w: "<3wk", when: "Within 3 weeks of birth", from: 43, to: 99, label: "Early postpartum contact", note: "Within 3 weeks of delivery — mood, feeding, recovery, blood pressure." },
    { w: "≤12wk", when: "By 12 weeks after birth", from: 43, to: 99, label: "Comprehensive postpartum visit", note: "The full check by 12 weeks. Postpartum care is care, not a formality." },
  ]},
];
/* The eyebrow over a roadmap item: its `when` override, else "Weeks {w}". */
export const prenatalWhen = (m) => m.when || `Weeks ${m.w}`;

export const STAGES = [
  { id: "periods", label: "My Cycle", who: "periods & PMS" },
  { id: "preg", label: "Pregnancy", who: "week by week" },
  { id: "peri", label: "Peri · Meno", who: "the transition" },
];

/* Care shelf. `m`: the symptom ids an item is matched on, in every stage it lists
   (SYM ids for peri, PSYM ids for periods; "rough" = nights logged as rough).
   `partner`: true only once a signed partner agreement exists — it drives the
   "Partner" pill. None exists yet, so every item is false and no commission is claimed. */
export const SHELF = [
  { id: "midi", brand: "Midi Health", name: "Menopause-trained clinician", price: "Insurance accepted by many plans", ev: "Clinical care", tone: "clinical", m: ["hf", "ns", "fog", "slp"], stages: ["peri"], partner: false },
  { id: "restfully", brand: "Restfully", name: "6-week CBT-I sleep program", price: "$49", ev: "Strong evidence", tone: "strong", m: ["slp", "rough"], stages: ["peri", "periods"], partner: false },
  { id: "emberline", brand: "Emberline", name: "Wearable heat wrap for cramps", price: "$42", ev: "Comfort with evidence", tone: "strong", m: ["crm"], stages: ["periods"], partner: false },
  { id: "mineral", brand: "Mineral & Co.", name: "Magnesium glycinate, 90 nights", price: "$24", ev: "Mixed evidence", tone: "mixed", m: ["slp", "mood", "crm"], stages: ["peri", "periods"], partner: false },
  // Prenatal basics are offered for the stage, not matched to a symptom (and the pregnancy experience has no Care tab).
  { id: "verdana", brand: "Verdana", name: "Prenatal essentials + folate", price: "$28", ev: "Strong evidence", tone: "strong", m: [], stages: ["preg"], partner: false },
  { id: "nightfall", brand: "Nightfall", name: "Cooling sleep set", price: "$68", ev: "Comfort, not a treatment", tone: "comfort", m: ["ns", "hf"], stages: ["peri"], partner: false },
];

/* Stage palettes (design system v2, calm R1; plan §6): warm airy off-white paper and white cards in light, deep
   navy-charcoal paper and raised navy cards in dark, shared by every stage, and ONE muted, pastel-leaning accent per
   stage carried by --primary: My Cycle & Trying to conceive = periwinkle/sky, Perimenopause = lavender, Pregnancy =
   rose, Menopause & beyond = soft teal (stagePalettes below puts the teal first for Menopause, which shares the "peri"
   stage id). --accent is a quiet companion hue. The pastel itself lives in the tints (--tint-*, color-mix of the
   primary into the card) and the wash; the token values here are the AA-valid tones of each hue.
   Each entry carries the seven UI tokens for light and a `dark` object with the same seven (L2, decision D9). Dark
   rule: paper is the darkest surface, card one step lighter, and primary and accent are light tones of the same hue,
   so text on a filled primary uses --on-primary. Every set passes WCAG AA for text (4.5:1) and 3:1 for UI boundaries
   on paper AND card, light and dark (lib/appearance.test.mjs; numbers in docs/CYRA-BUILD-SPEC.md §8.5). */
export const PALETTES = {
  peri: [
    { id: "lavender", name: "Lavender & Sky", note: "Soft, restorative", primary: "#6B52A8", accent: "#3D6E9E", paper: "#FAF7F4", card: "#FFFFFF", ink: "#1E2132", soft: "#585C72", line: "#8A8DA3", dark: { paper: "#131520", card: "#1C1F2D", ink: "#E9EAF3", soft: "#A5A9C0", line: "#6D7290", primary: "#C2AEF2", accent: "#9CC2EC" } },
    { id: "seafoam", name: "Soft Teal & Lilac", note: "Clear, steady", primary: "#297070", accent: "#7150A6", paper: "#FAF7F4", card: "#FFFFFF", ink: "#1E2132", soft: "#585C72", line: "#8A8DA3", dark: { paper: "#131520", card: "#1C1F2D", ink: "#E9EAF3", soft: "#A5A9C0", line: "#6D7290", primary: "#86D2C9", accent: "#C6AEF2" } },
    { id: "dusk", name: "Dusk Blue & Rose", note: "Quiet, grounded", primary: "#3E5F8C", accent: "#A84E6E", paper: "#FAF7F4", card: "#FFFFFF", ink: "#1E2132", soft: "#585C72", line: "#8A8DA3", dark: { paper: "#131520", card: "#1C1F2D", ink: "#E9EAF3", soft: "#A5A9C0", line: "#6D7290", primary: "#9DBBE6", accent: "#EFA3BE" } },
  ],
  preg: [
    { id: "rose", name: "Rose & Lavender", note: "Warm & reassuring", primary: "#A3456A", accent: "#6550A0", paper: "#FAF7F4", card: "#FFFFFF", ink: "#1E2132", soft: "#585C72", line: "#8A8DA3", dark: { paper: "#131520", card: "#1C1F2D", ink: "#E9EAF3", soft: "#A5A9C0", line: "#6D7290", primary: "#F2A5C0", accent: "#C2B0F0" } },
    { id: "blush", name: "Blush & Teal", note: "Gentle, fresh", primary: "#9C4A5A", accent: "#297070", paper: "#FAF7F4", card: "#FFFFFF", ink: "#1E2132", soft: "#585C72", line: "#8A8DA3", dark: { paper: "#131520", card: "#1C1F2D", ink: "#E9EAF3", soft: "#A5A9C0", line: "#6D7290", primary: "#EFAAB6", accent: "#86D2C9" } },
    { id: "apricot", name: "Apricot & Sky", note: "Sunny, calm", primary: "#9C4D2C", accent: "#2A6694", paper: "#FAF7F4", card: "#FFFFFF", ink: "#1E2132", soft: "#585C72", line: "#8A8DA3", dark: { paper: "#131520", card: "#1C1F2D", ink: "#E9EAF3", soft: "#A5A9C0", line: "#6D7290", primary: "#F2B08E", accent: "#8EC3EC" } },
  ],
  periods: [
    { id: "periwinkle", name: "Periwinkle & Rose", note: "Fresh, light", primary: "#4A5DB0", accent: "#B04B72", paper: "#FAF7F4", card: "#FFFFFF", ink: "#1E2132", soft: "#585C72", line: "#8A8DA3", dark: { paper: "#131520", card: "#1C1F2D", ink: "#E9EAF3", soft: "#A5A9C0", line: "#6D7290", primary: "#A7B5F4", accent: "#F0A0BE" } },
    { id: "sky", name: "Sky & Peach", note: "Bright, easy", primary: "#2A6694", accent: "#A8552F", paper: "#FAF7F4", card: "#FFFFFF", ink: "#1E2132", soft: "#585C72", line: "#8A8DA3", dark: { paper: "#131520", card: "#1C1F2D", ink: "#E9EAF3", soft: "#A5A9C0", line: "#6D7290", primary: "#8EC3EC", accent: "#F2AE8A" } },
    { id: "lilac", name: "Lilac & Sage", note: "Soft, expressive", primary: "#7150A6", accent: "#4F7A5C", paper: "#FAF7F4", card: "#FFFFFF", ink: "#1E2132", soft: "#585C72", line: "#8A8DA3", dark: { paper: "#131520", card: "#1C1F2D", ink: "#E9EAF3", soft: "#A5A9C0", line: "#6D7290", primary: "#C6AEF2", accent: "#A6CDB0" } },
  ],
};
/* The palette list for her stage, in the order the palette sheet shows it and palIdx counts it. Menopause & beyond
   shares the "peri" stage id with Perimenopause but wears the soft teal first (plan §6), so a Menopause record at
   palIdx.peri 0 shows teal and a Perimenopause one lavender; the alternates follow in the same order otherwise.
   stageName is the label the app shows ("Menopause" picks the teal-first order; record.js PHASES.meno.stageName). */
export const MENO_NAME = "Menopause";
export const stagePalettes = (stage, stageName) => {
  const ps = PALETTES[stage] || PALETTES.peri;
  return stage === "peri" && stageName === MENO_NAME ? [ps[1], ps[0], ps[2]] : ps;
};

export const ORGS = {
  cyra: { slug: "cyra", name: "Cyra", tag: "Health", theme: { primary: "#5B54A6", paper: "#FAF7F4", card: "#FFFFFF", ink: "#1E2132", soft: "#585C72", line: "#8A8DA3", accent: "#A8486E", dark: { paper: "#131520", card: "#1C1F2D", ink: "#E9EAF3", soft: "#A5A9C0", line: "#6D7290", primary: "#B9B3F2", accent: "#F0A3C0" } }, partnerIds: null, plan: "Consumer (D2C)" },
  bloom: { slug: "bloom", name: "Bloom", tag: "by AcmeCare", theme: { primary: "#2F5D50", paper: "#F2F5F1", card: "#FBFDFA", accent: "#C89A5B", ink: "#26332E", soft: "#5F6E67", line: "#DCE3DD", dark: { paper: "#141713", card: "#1E221D", ink: "#E2ECE8", soft: "#9AAFA5", line: "#6F7971", primary: "#8AC2B0", accent: "#D8A96A" } }, partnerIds: ["midi", "restfully"], plan: "Employer benefit (500 seats)" },
};

/* Status and surface tokens that are not part of a palette, for each scheme (UI side, never data
   colours). styles.js writes `light` into the .cy rule and `dark` into .cy[data-scheme="dark"].
   The light values are the literals the stylesheet used before L2, unchanged. Filled primary and
   danger controls carry --on-primary / --on-bad text (white in light, the dark paper in dark,
   because the dark primary is a light tone); the toast is an inverse surface with --on-ink text. */
export const SCHEME_TOKENS = {
  light: {
    "--good": "#43604F", "--bad": "#A04545", "--bad-bg": "#FBEEEA", "--bad-chip": "#F3DBDB", "--err-line": "#E0A99B", "--err-edge": "#E7C3B8",
    "--ev-mixed-bg": "#FBEEE2", "--ev-mixed-ink": "#8A4E18", "--ev-comfort-bg": "#EDE7EF", "--ev-comfort-ink": "#6E6076",
    "--on-primary": "#FFF", "--on-bad": "#FFF", "--on-ink": "#FFF", "--knob": "#FFF", "--knob-edge": "rgba(0,0,0,.12)",
    "--halo": "rgba(255,255,255,.7)", "--mark-edge": "rgba(0,0,0,.35)", "--cell-edge": "rgba(0,0,0,.14)", "--toast-dot": "var(--accent)",
    "--sh-card": "0 1px 2px rgba(30,33,50,.04), 0 10px 28px -12px rgba(30,33,50,.14)", "--sh-opt": "0 1px 2px rgba(30,33,50,.05)", "--sh-meter": "0 1px 3px rgba(30,33,50,.06)",
    "--sh-sheet": "0 -2px 6px rgba(30,33,50,.04), 0 18px 48px -12px rgba(30,33,50,.22)", "--sh-thumb": "0 1px 2px rgba(0,0,0,.2)", "--sh-toast": "0 4px 14px rgba(0,0,0,.18)",
    // v2 (calm R1): the hairline on container surfaces (decorative; controls keep --line at 3:1), the faint pastel wash at
    // the top of the paper (lavender → sky → pink, 6%), the domain tints and the lifted shadow of the nav pill and "+".
    "--edge": "#ECE7E3", "--wash-a": "rgba(150,120,230,.06)", "--wash-b": "rgba(100,165,235,.06)", "--wash-c": "rgba(240,130,175,.06)",
    "--tint-mind": "#EAF1FB", "--tint-body": "#F5EDF8", "--tint-patterns": "#FDF0E6", "--tint-you": "#F2F0ED",
    "--sh-lift": "0 2px 6px rgba(30,33,50,.06), 0 14px 32px -10px rgba(30,33,50,.24)", "--scrim": "rgba(30,33,50,.34)",
  },
  dark: {
    "--good": "#8FCBA4", "--bad": "#F29B91", "--bad-bg": "#3B2120", "--bad-chip": "#4A2826", "--err-line": "#B4685F", "--err-edge": "#6E3B36",
    "--ev-mixed-bg": "#3D2C1B", "--ev-mixed-ink": "#F0BC86", "--ev-comfort-bg": "#302A36", "--ev-comfort-ink": "#D3C6DC",
    "--on-primary": "var(--paper)", "--on-bad": "var(--paper)", "--on-ink": "var(--paper)", "--knob": "#EEF1F0", "--knob-edge": "rgba(0,0,0,.5)",
    "--halo": "rgba(0,0,0,.55)", "--mark-edge": "rgba(255,255,255,.55)", "--cell-edge": "rgba(255,255,255,.16)", "--toast-dot": "color-mix(in srgb, var(--accent) 60%, var(--paper))",
    "--sh-card": "0 1px 2px rgba(0,0,0,.3)", "--sh-opt": "0 1px 2px rgba(0,0,0,.3)", "--sh-meter": "0 1px 3px rgba(0,0,0,.35)",
    "--sh-sheet": "0 4px 16px rgba(0,0,0,.5)", "--sh-thumb": "0 1px 2px rgba(0,0,0,.6)", "--sh-toast": "0 4px 16px rgba(0,0,0,.55)",
    "--edge": "#2C3044", "--wash-a": "rgba(150,120,230,.07)", "--wash-b": "rgba(100,165,235,.06)", "--wash-c": "rgba(240,130,175,.05)",
    "--tint-mind": "#1F2A40", "--tint-body": "#2A2339", "--tint-patterns": "#30261F", "--tint-you": "#262836",
    "--sh-lift": "0 2px 6px rgba(0,0,0,.35), 0 14px 32px -10px rgba(0,0,0,.6)", "--scrim": "rgba(0,0,0,.58)",
  },
};


/* ---- Data viz (kept apart from PALETTES and SCHEME_TOKENS; never derived from a UI palette) ----
   Patterns charts: every symptom belongs to one family, and each family has one fixed data-viz colour
   (categorical, separate from the UI palettes). Colours are the reference categorical slots red, blue,
   green, amber and aqua, checked all-pairs on white: colour-blind separation >= 6.9 dE, so the charts
   always pair colour with a label, the legend and the tap-for-detail card.
   `dark` is the same family on a dark card, validated with the dataviz validator
   (validate_palette.js "#DF445B,#3987E5,#117E00,#C38606,#00A994" --mode dark --pairs all) against every
   dark card colour in PALETTES and ORGS: all checks pass, CVD 8.2, normal vision 17.8, all >= 3:1.
   Marks read them as CSS variables (--fam-*, from vizVars), never as literals. */
export const FAMILIES = [
  { id: "heat", label: "Heat", color: "#E34948", dark: "#DF445B" },
  { id: "sleep", label: "Sleep", color: "#2A78D6", dark: "#3987E5" },
  { id: "mind", label: "Mind", color: "#008300", dark: "#117E00" },
  { id: "pain", label: "Pain", color: "#EDA100", dark: "#C38606" },
  { id: "body", label: "Body", color: "#1BAF7A", dark: "#00A994" },
];
export const SYM_FAMILY = {
  hf: "heat", ns: "heat",
  slp: "sleep",
  // Low energy is the everyday "tired", so a rough night and a flat next day share the Sleep colour.
  [ENERGY_ID]: "sleep",
  fog: "mind", mood: "mind", anx: "mind",
  ach: "pain", hda: "pain", crm: "pain", bak: "pain", ten: "pain",
  dry: "body", pal: "body", lib: "body", itc: "body", blo: "body", nau: "body", acn: "body", cra: "body",
};
/* A family's colour as a CSS variable (undefined without a family). The value follows the scheme on
   screen (vizVars below, set inline on .cy), so marks never carry a literal colour. */
export const famVar = (fam) => (fam ? `var(--fam-${fam})` : undefined);
/* The family colour for a symptom id (undefined when the id has no family, so CSS falls back to --primary).
   Used only on data-bearing marks: chart dots, the Home today-line dot, the severity dots on a check-in chip. */
export const famColor = (id) => famVar(SYM_FAMILY[id]);

/* Data-viz ramp: saturated and readable, independent of UI chrome colors. The light ramps are
   owner-approved and unchanged. RAMPS_DARK keeps each stage's three anchors separable on the dark
   cards: validated with the dataviz validator (--mode dark --pairs all) against that stage's three
   dark cards and ORGS.cyra's (CVD 12.1 / 8.6 / 8.5, normal vision 19.3 / 18.0 / 16.7); interpolated
   calendar fills stay >= 3.2:1 on the dark cards and inkOn (lib/engine.js) >= 4.58:1 on every fill. */
export const RAMPS = {
  peri:    { good: [26, 168, 148], mid: [246, 189, 74], rough: [140, 74, 168] },
  preg:    { good: [42, 176, 158], mid: [249, 176, 104], rough: [222, 84, 112] },
  periods: { good: [46, 154, 198], mid: [250, 186, 82], rough: [226, 88, 74] },
};
export const RAMPS_DARK = {
  peri:    { good: [0, 159, 139], mid: [189, 137, 0], rough: [150, 83, 178] },
  preg:    { good: [0, 159, 142], mid: [198, 129, 55], rough: [219, 41, 84] },
  periods: { good: [39, 149, 193], mid: [194, 134, 3], rough: [212, 64, 64] },
};
/* Soft ramp (calm R1, plan §6): one ordinal, single-hue periwinkle ramp for sparklines and plain bars, low step to
   high, kept apart from the UI palettes like every data colour. Validated with the dataviz validator --ordinal:
   light on #FFFFFF and #FAF7F4 (light end 2.51:1, ΔL >= 0.06, hue spread 6°), dark on #1C1F2D (light end 2.68:1, hue
   spread 4°). Marks read it as --soft-1..--soft-4 (vizVars). */
export const SOFT_RAMP = Object.freeze({ light: Object.freeze(["#A39BE4", "#857AD6", "#675CC2", "#4B42A4"]), dark: Object.freeze(["#5E56B0", "#7A70D0", "#988FE4", "#B8B1F4"]) });
/* The ramp for a stage and scheme (peri's for any other stage). */
export const rampOf = (stage, scheme = "light") => { const R = scheme === "dark" ? RAMPS_DARK : RAMPS; return R[stage] || R.peri; };
/* A ramp anchor ("good" | "mid" | "rough") as a CSS variable, for the POTS charts. */
export const rampVar = (k) => `var(--ramp-${k})`;
/* The data-viz custom properties for the scheme on screen, set inline on .cy beside the palette ones. */
export const vizVars = (scheme, stage) => ({
  ...Object.fromEntries(FAMILIES.map((f) => [`--fam-${f.id}`, scheme === "dark" ? f.dark : f.color])),
  ...Object.fromEntries(["good", "mid", "rough"].map((k) => [`--ramp-${k}`, `rgb(${rampOf(stage, scheme)[k].join(",")})`])),
  ...Object.fromEntries(SOFT_RAMP[scheme === "dark" ? "dark" : "light"].map((c, i) => [`--soft-${i + 1}`, c])),
});

export const READS = {
  menstrual: ["Why cramps peak on day 1–2", "Prostaglandins drive them — which is why anti-inflammatories and heat both genuinely work."],
  follicular: ["Your estrogen upswing", "Energy and mood often climb now; a good week for harder workouts."],
  fertile: ["The fertile window, honestly", "Body signs beat any app's guess — here's why we show a range, not a day."],
  luteal: ["Luteal sleep, explained", "Progesterone raises body temperature ~0.3°C — why sleep feels lighter this week."],
};
export const PREG_TIPS = {
  1: ["Folate matters most right now", "It's the best-evidenced supplement in medicine for this trimester."],
  2: ["Week 22: the kicking era", "Movement patterns become trackable — that's why the kick counter exists."],
  3: ["Third trimester sleep", "Side-sleeping with pillow support has real evidence behind it."],
};

