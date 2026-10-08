/* Static libraries, option lists, palettes and copy tables. Every value here is
   normative (see docs/CYRA-BUILD-SPEC.md); nothing in this file holds state. */

export const SYM = { hf: "Hot flashes", ns: "Night sweats", fog: "Brain fog", mood: "Mood swings", slp: "Sleep disruption", ach: "Joint aches", dry: "Vaginal dryness", pal: "Heart flutters", hda: "Headaches", lib: "Libido change", anx: "Anxiety", itc: "Skin/itching" };
export const SYMS = Object.keys(SYM);
export const PSYM = { crm: "Cramps", hda: "Headaches", blo: "Bloating", mood: "Mood swings", ten: "Breast tenderness", acn: "Skin breakouts", bak: "Back pain", nau: "Nausea", cra: "Cravings", lib: "Libido change" };
export const GSYM = { nau: "Nausea", hb: "Heartburn", swl: "Swelling", bak: "Back pain", crp: "Cramping", dzy: "Dizziness", brx: "Braxton-Hicks", con: "Constipation" };

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
export const QUICK_Q = {
  periods: ["Any cramps or bloating?", "How's your energy?", "Mood today?"],
  peri: ["Any hot flashes or night sweats?", "How did you sleep?", "How's your focus?"],
  preg: ["Any nausea or heartburn?", "Swelling anywhere?", "Energy today?"],
};

export const SCALES = [
  { id: "fatigue", label: "Fatigue", low: "Energized", high: "Wiped out" },
  { id: "pain", label: "Pain", low: "None", high: "Severe" },
  { id: "moodq", label: "Mood", low: "Low", high: "Great" },
  { id: "stress", label: "Stress", low: "Calm", high: "Maxed" },
];
export const FLOW = [["spot", "Spotting"], ["light", "Light"], ["med", "Medium"], ["heavy", "Heavy"], ["flood", "Flooding"]];
export const DISCHARGE = [["none", "None"], ["creamy", "Creamy"], ["eggwhite", "Egg-white"], ["sticky", "Sticky"], ["watery", "Watery"], ["unusual", "Unusual"]];
export const ODOR = [["none", "Nothing unusual"], ["mild", "Mild change"], ["strong", "Strong"], ["fishy", "Fishy"], ["yeasty", "Yeasty / sour"]];
export const BODYODOR = [["same", "Same as usual"], ["stronger", "Stronger"], ["changed", "Different"]];

export const STAGES = [
  { id: "periods", label: "My Cycle", who: "periods & PMS" },
  { id: "preg", label: "Pregnancy", who: "week by week" },
  { id: "peri", label: "Peri · Meno", who: "the transition" },
];

export const SHELF = [
  { id: "midi", brand: "Midi Health", name: "Menopause-trained clinician (insurance accepted)", price: "Covered by many plans", ev: "Clinical care", tone: "strong", m: ["hf", "ns", "fog", "slp"], stages: ["peri"] },
  { id: "restfully", brand: "Restfully", name: "6-week CBT-I sleep program", price: "$49", ev: "Strong evidence", tone: "strong", m: ["slp"], stages: ["peri", "periods"] },
  { id: "emberline", brand: "Emberline", name: "Wearable heat wrap for cramps", price: "$42", ev: "Comfort with evidence", tone: "strong", m: ["crm"], stages: ["periods"] },
  { id: "mineral", brand: "Mineral & Co.", name: "Magnesium glycinate, 90 nights", price: "$24", ev: "Mixed evidence", tone: "mixed", m: ["slp", "mood", "crm"], stages: ["peri", "periods"] },
  { id: "verdana", brand: "Verdana", name: "Prenatal essentials + folate", price: "$28", ev: "Strong evidence", tone: "strong", m: ["fat"], stages: ["preg"] },
  { id: "nightfall", brand: "Nightfall", name: "Cooling sleep set", price: "$68", ev: "Comfort, not a treatment", tone: "comfort", m: ["ns", "hf"], stages: ["peri"] },
];

/* Stage palettes — the app's mood shifts with life stage.
   peri/meno: cool, calming, trust-building (teal + sage + lavender)
   pregnancy: soft pink + teal with warm neutrals
   cycle:     fresh dusty blue + soft coral, young without being girly */
export const PALETTES = {
  peri: [
    { id: "teal", name: "Teal & Lavender", note: "Clinical calm", primary: "#2C6A61", accent: "#5A6A9E", paper: "#E4EBE7", card: "#FFFFFF", ink: "#17241F", soft: "#4E625B", line: "#6E8A7F" },
    { id: "dusk", name: "Dusty Blue & Sage", note: "Steady, grounded", primary: "#3A5F80", accent: "#607C69", paper: "#E5EAEF", card: "#FFFFFF", ink: "#16212B", soft: "#4D5F6E", line: "#73889F" },
    { id: "lav", name: "Lavender & Moss", note: "Soft, restorative", primary: "#5B4E85", accent: "#6A7B5C", paper: "#EAE6F0", card: "#FFFFFF", ink: "#1E1A2A", soft: "#5A5270", line: "#897EA8" },
  ],
  preg: [
    { id: "rose", name: "Teal & Dusty Rose", note: "Warm & reassuring", primary: "#2F736E", accent: "#B8505E", paper: "#EFE2E1", card: "#FFFFFF", ink: "#241A1D", soft: "#6B585B", line: "#9A7B79" },
    { id: "sage", name: "Sage & Warm Sand", note: "Earthy, gentle", primary: "#4F7355", accent: "#A06836", paper: "#EDE7DD", card: "#FFFFFF", ink: "#1F2620", soft: "#5C6459", line: "#908373" },
    { id: "coral", name: "Muted Blue & Coral", note: "Fresh, modern", primary: "#37627E", accent: "#CA4B2A", paper: "#E6EBEF", card: "#FFFFFF", ink: "#152029", soft: "#4F6070", line: "#73889F" },
  ],
  periods: [
    { id: "blue", name: "Dusty Blue & Coral", note: "Fresh, youthful", primary: "#33567D", accent: "#B9513C", paper: "#E3E9F0", card: "#FFFFFF", ink: "#141E29", soft: "#4E6070", line: "#70859D" },
    { id: "plum", name: "Plum & Peach", note: "Soft, expressive", primary: "#6B3F63", accent: "#BF5729", paper: "#EFE5EC", card: "#FFFFFF", ink: "#231825", soft: "#5F4E5C", line: "#967E91" },
    { id: "mint", name: "Deep Mint & Clay", note: "Clean, calm", primary: "#2F6B5C", accent: "#B65B42", paper: "#E3EDE8", card: "#FFFFFF", ink: "#15241E", soft: "#4C6259", line: "#698C7D" },
  ],
};

export const ORGS = {
  cyra: { slug: "cyra", name: "Cyra", tag: "Health", theme: { primary: "#7A2F4E", paper: "#EDE4DC", card: "#FFFFFF", accent: "#AB6229", ink: "#241A28", soft: "#5B4E63", line: "#927F6F" }, partnerIds: null, plan: "Consumer (D2C)" },
  bloom: { slug: "bloom", name: "Bloom", tag: "by AcmeCare", theme: { primary: "#2F5D50", paper: "#F2F5F1", card: "#FBFDFA", accent: "#C89A5B", ink: "#26332E", soft: "#5F6E67", line: "#DCE3DD" }, partnerIds: ["midi", "restfully"], plan: "Employer benefit (500 seats)" },
};


/* Data-viz ramp: saturated and readable, independent of UI chrome colors. */
export const RAMPS = {
  peri:    { good: [26, 168, 148], mid: [246, 189, 74], rough: [140, 74, 168] },
  preg:    { good: [42, 176, 158], mid: [249, 176, 104], rough: [222, 84, 112] },
  periods: { good: [46, 154, 198], mid: [250, 186, 82], rough: [226, 88, 74] },
};

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

