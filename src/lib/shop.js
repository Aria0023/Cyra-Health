/* Shop by need (2026-11-14, docs/plans/partner-learn-glucose-shop.md Task C): a small catalog of real, widely sold
   products and services by category, matched ON THE DEVICE to her stage and modules. Replaces the earlier care shelf's
   placeholder brands. Pure: no React, storage or network; the owner-edited affiliate links (src/config/affiliates.json)
   are passed in, so the tests read the same file.

   Rules:
   - Matching happens here, on the device: her stage and modules choose which categories come first. Nothing about her
     is sent anywhere, and a link never carries her stage, an id or any UTM with health information.
   - An item with an affiliate URL shows "Affiliate link" and AFFILIATE_LINE; an item without one shows the plain brand
     link and no affiliate label, so the claim stays true. Affiliate tags are public by design, never a secret.
   - Every "why" is one plain line with an honest evidence label (strong / mixed / comfort / clinical) and a named
     source, registered in docs/CLINICIAN-REVIEW.md "Shop by need".
   - Never shown in insights, Patterns findings, urgent guidance, notifications or onboarding. FEATURES.shop turns the
     whole thing off.
   - Where it opens from (2026-11-16, owner decision: the shop may appear on Home): the header's labelled "Shop" pill on
     the five main tabs, a "Shop by need" card on Home she can hide (and bring back from You), a row at the bottom of
     the "+" sheet, the entry card at the top of You, and the quiet contextual links. */

export const SHOP_COPY = Object.freeze({
  eyebrow: "Shop by need",
  title: "Products and services, by need",
  lead: "Real products people often use at your stage, with an honest note on the evidence. Matched on this device; nothing about you is sent.",
  forYou: "For your stage first",
  catLab: "Category",
  affiliate: "Affiliate link",
  open: (brand) => `Visit ${brand}`,
  tryIt: "Add to what I'm trying",
  privacy: "An affiliate link tells that shop you came from Solia Health; a plain brand link doesn't. Neither carries anything about you: no stage, no log, no id. Links open in your browser.",
  notAdvice: "Not medical advice, and not an endorsement of any product as a treatment. Ask your clinician what fits you.",
  sheetTitle: "Shop by need",
});
export const AFFILIATE_LINE = "Solia Health may earn a commission if you buy through this link. It never changes what we show you.";

export const SHOP_CATEGORIES = Object.freeze([
  Object.freeze({ id: "fertility", label: "Ovulation & fertility" }),
  Object.freeze({ id: "pregnancy", label: "Pregnancy" }),
  Object.freeze({ id: "labs", label: "Lab tests" }),
  Object.freeze({ id: "glucose", label: "Blood sugar" }),
  Object.freeze({ id: "wearables", label: "Wearables" }),
  Object.freeze({ id: "periods", label: "Periods" }),
  Object.freeze({ id: "meno", label: "Perimenopause & menopause" }),
  Object.freeze({ id: "sleep", label: "Sleep" }),
]);
export const TONE_LABEL = Object.freeze({ strong: "Strong evidence", mixed: "Mixed evidence", comfort: "Comfort", clinical: "Clinical care" });

/* Named sources for the "why" lines (confirm editions at clinician review). */
export const SHOP_SOURCES = Object.freeze({
  manders2015: "Manders M, et al. Timed intercourse for couples trying to conceive. Cochrane Database of Systematic Reviews, 2015",
  medlineOvTest: "MedlinePlus (NIH), Ovulation home test",
  su2017: "Su HW, et al. Detection of ovulation, a review of currently available methods. Bioengineering & Translational Medicine, 2017",
  uspstfFolic: "US Preventive Services Task Force, Folic Acid Supplementation to Prevent Neural Tube Defects, 2023",
  cdcFolic: "CDC, Folic Acid",
  medlinePregTest: "MedlinePlus (NIH), Pregnancy test",
  fdaStelo: "FDA news release, FDA Clears First Over-the-Counter Continuous Glucose Monitor, March 2024",
  fdaLingo: "FDA 510(k) clearance of Abbott's over-the-counter Lingo and Libre Rio systems, June 2024",
  niddkCgm: "NIDDK (NIH), Continuous Glucose Monitoring",
  maijala2019: "Maijala A, et al. Nocturnal finger skin temperature in menstrual cycle tracking (Oura ring). BMC Women's Health, 2019",
  medlinePulse: "MedlinePlus (NIH), Pulse",
  jo2018: "Jo J, Lee SH. Heat therapy for primary dysmenorrhea: a systematic review and meta-analysis. Scientific Reports, 2018",
  noTrial: "No trial evidence; listed as a comfort item",
  nams2022: "The 2022 Hormone Therapy Position Statement of The North American Menopause Society. Menopause, 2022",
  qaseem2016: "Qaseem A, et al. Management of Chronic Insomnia Disorder in Adults: A Clinical Practice Guideline From the American College of Physicians. Annals of Internal Medicine, 2016",
  medlineTsh: "MedlinePlus (NIH), TSH (Thyroid-stimulating hormone) Test",
  medlineA1c: "MedlinePlus (NIH), Hemoglobin A1C (HbA1c) Test",
  teede2023: "Teede HJ, et al. Recommendations from the 2023 International Evidence-based Guideline for the Assessment and Management of Polycystic Ovary Syndrome. Journal of Clinical Endocrinology & Metabolism, 2023",
  asrm2020: "Practice Committee of the American Society for Reproductive Medicine. Testing and interpreting measures of ovarian reserve: a committee opinion. Fertility and Sterility, 2020",
  nice2015: "NICE guideline NG23, Menopause: identification and management (2015, updated 2024)",
});

/* kind: what "Add to what I'm trying" files it as (lib/trying.js TRY_KINDS); null = not something she takes or does daily. */
const I = (o) => Object.freeze({ ...o, stages: Object.freeze(o.stages || []), modules: Object.freeze(o.modules || []) });
const ITEMS = [
  // Ovulation & fertility (Trying to conceive first)
  I({ id: "easyhome-lh", category: "fertility", brand: "Easy@Home", name: "Ovulation (LH) test strips", url: "https://www.easyhomefertility.com/", stages: ["ttc"], kind: null,
    why: "Finds the LH surge that usually comes a day or two before ovulation, to help time sex.", tone: "mixed", ev: "Mixed evidence on pregnancy rates", src: ["manders2015", "medlineOvTest"] }),
  I({ id: "clearblue-ovulation", category: "fertility", brand: "Clearblue", name: "Digital Ovulation Test", url: "https://www.clearblue.com/", stages: ["ttc"], kind: null,
    why: "The same LH check with a digital readout instead of reading lines.", tone: "mixed", ev: "Mixed evidence on pregnancy rates", src: ["manders2015", "medlineOvTest"] }),
  I({ id: "mira", category: "fertility", brand: "Mira", name: "Fertility hormone monitor", url: "https://www.miracare.com/", stages: ["ttc"], kind: null,
    why: "Reads hormone levels in urine at home and charts them in an app.", tone: "mixed", ev: "Early evidence", src: ["su2017"] }),
  I({ id: "inito", category: "fertility", brand: "Inito", name: "Fertility monitor", url: "https://www.inito.com/", stages: ["ttc"], kind: null,
    why: "Reads several fertility hormones from one urine strip with your phone.", tone: "mixed", ev: "Early evidence", src: ["su2017"] }),
  I({ id: "proov", category: "fertility", brand: "Proov", name: "PdG test strips", url: "https://proovtest.com/", stages: ["ttc"], kind: null,
    why: "Checks for a progesterone marker in urine in the days after ovulation.", tone: "mixed", ev: "Early evidence", src: ["su2017"] }),
  I({ id: "easyhome-bbt", category: "fertility", brand: "Easy@Home", name: "Basal body thermometer", url: "https://www.easyhomefertility.com/", stages: ["ttc"], kind: null,
    why: "Reads to two decimals, for charting the small rise that follows ovulation.", tone: "mixed", ev: "Shows ovulation after it happens", src: ["su2017"] }),
  I({ id: "prenatal", category: "fertility", also: ["pregnancy"], brand: "Nature Made", name: "Prenatal multivitamin with folic acid", url: "https://www.naturemade.com/", stages: ["ttc", "preg"], kind: "supp",
    why: "Folic acid before and in early pregnancy lowers the risk of neural tube defects.", tone: "strong", ev: "Strong evidence (folic acid)", src: ["uspstfFolic", "cdcFolic"] }),
  // Pregnancy
  I({ id: "pregnancy-test", category: "pregnancy", also: ["fertility"], brand: "First Response", name: "Early Result pregnancy test", url: "https://www.firstresponse.com/", stages: ["ttc", "preg"], kind: null,
    why: "Home tests detect the pregnancy hormone hCG; a positive is worth confirming with a clinician.", tone: "strong", ev: "Reliable from a missed period", src: ["medlinePregTest"] }),
  // Blood sugar
  I({ id: "stelo", category: "glucose", brand: "Dexcom", name: "Stelo over-the-counter CGM", url: "https://www.stelo.com/", modules: ["pcos"], kind: null,
    why: "A glucose sensor sold without a prescription in the US, for adults not using insulin.", tone: "clinical", ev: "FDA-cleared device", src: ["fdaStelo", "niddkCgm"] }),
  I({ id: "lingo", category: "glucose", brand: "Abbott", name: "Lingo glucose biosensor", url: "https://www.hellolingo.com/", modules: ["pcos"], kind: null,
    why: "An over-the-counter sensor and app for adults not using insulin.", tone: "clinical", ev: "FDA-cleared device", src: ["fdaLingo", "niddkCgm"] }),
  I({ id: "libre", category: "glucose", brand: "FreeStyle Libre", name: "CGM, by prescription", url: "https://www.freestyle.abbott/", modules: ["pcos"], kind: null,
    why: "A prescription CGM. Ask your clinician whether it fits you.", tone: "clinical", ev: "Prescription device", src: ["niddkCgm"] }),
  // Wearables
  I({ id: "oura", category: "wearables", brand: "Oura", name: "Oura Ring", url: "https://ouraring.com/", kind: null,
    why: "Reads nightly temperature, heart rate, HRV and sleep; connects to Solia Health.", tone: "mixed", ev: "Useful trends, not a diagnosis", src: ["maijala2019"] }),
  I({ id: "apple-watch", category: "wearables", brand: "Apple", name: "Apple Watch", url: "https://www.apple.com/watch/", kind: null,
    why: "Recent models read wrist temperature at night, plus heart rate and sleep, through Apple Health.", tone: "mixed", ev: "Useful trends, not a diagnosis", src: ["medlinePulse"] }),
  I({ id: "garmin", category: "wearables", brand: "Garmin", name: "Garmin smartwatch", url: "https://www.garmin.com/", kind: null,
    why: "Reads heart rate, HRV and sleep; connects through the Fitbit · Garmin · Whoop row.", tone: "mixed", ev: "Useful trends, not a diagnosis", src: ["medlinePulse"] }),
  I({ id: "fitbit", category: "wearables", brand: "Fitbit", name: "Fitbit tracker", url: "https://www.fitbit.com/", kind: null,
    why: "Reads heart rate, sleep and, on some models, skin temperature.", tone: "mixed", ev: "Useful trends, not a diagnosis", src: ["medlinePulse"] }),
  I({ id: "whoop", category: "wearables", brand: "Whoop", name: "Whoop strap", url: "https://www.whoop.com/", kind: null,
    why: "A screenless strap that reads heart rate, HRV, skin temperature and sleep.", tone: "mixed", ev: "Useful trends, not a diagnosis", src: ["medlinePulse"] }),
  // Periods
  I({ id: "heat-wrap", category: "periods", brand: "ThermaCare", name: "Menstrual heat wraps", url: "https://www.thermacare.com/", stages: ["periods"], kind: "aid",
    why: "Heat on the lower belly eased period cramps in trials.", tone: "strong", ev: "Strong evidence", src: ["jo2018"] }),
  I({ id: "period-underwear", category: "periods", brand: "Thinx", name: "Period underwear", url: "https://www.thinx.com/", stages: ["periods"], kind: "aid",
    why: "Reusable underwear that absorbs flow, for comfort and fewer pads.", tone: "comfort", ev: "Comfort, not a treatment", src: ["noTrial"] }),
  // Perimenopause & menopause
  I({ id: "midi", category: "meno", brand: "Midi Health", name: "Menopause-trained clinicians, by video", url: "https://www.joinmidi.com/", stages: ["peri"], kind: "care",
    why: "Clinicians who focus on perimenopause and menopause care, including treatment options.", tone: "clinical", ev: "Clinical care", src: ["nams2022"] }),
  I({ id: "cooling-bedding", category: "meno", brand: "Slumber Cloud", name: "Cooling bedding", url: "https://slumbercloud.com/", stages: ["peri"], kind: "aid",
    why: "Bedding made to feel cooler, which some people find helps with night sweats.", tone: "comfort", ev: "Comfort, not a treatment", src: ["noTrial"] }),
  // Sleep
  I({ id: "sleepio", category: "sleep", brand: "Sleepio", name: "Digital CBT-I program", url: "https://www.sleepio.com/", kind: "program",
    why: "Cognitive behavioural therapy for insomnia (CBT-I) is the first-line treatment for long-term insomnia.", tone: "strong", ev: "Strong evidence (CBT-I)", src: ["qaseem2016"] }),
  I({ id: "cbti-coach", category: "sleep", brand: "US Department of Veterans Affairs", name: "CBT-i Coach app (free)", url: "https://mobile.va.gov/app/cbt-i-coach", kind: "program",
    why: "A free app that guides you through CBT-I steps, best used alongside a clinician.", tone: "strong", ev: "Strong evidence (CBT-I)", src: ["qaseem2016"] }),
  // Lab tests (2026-11-15, owner update): ordered online by her, with the sample at a lab or by a home kit. Trying to
  // conceive and PCOS see this category early (shopCategories). No contraception services are listed.
  I({ id: "quest-thyroid", category: "labs", brand: "Quest Diagnostics", name: "Thyroid tests you order online", url: "https://www.questhealth.com/", stages: ["periods", "ttc", "peri"], kind: null, avail: "lab",
    covers: "Thyroid blood tests, such as TSH", why: "Thyroid problems can change periods and fertility; a TSH blood test is the usual first check.", tone: "clinical", ev: "Lab test; go over results with a clinician", src: ["medlineTsh"] }),
  I({ id: "labcorp-a1c", category: "labs", also: ["glucose"], brand: "Labcorp OnDemand", name: "HbA1c blood sugar test you order online", url: "https://www.ondemand.labcorp.com/", modules: ["pcos"], kind: null, avail: "lab",
    covers: "HbA1c: your average blood sugar over about three months", why: "PCOS guidelines advise checking blood sugar from time to time; HbA1c is one common way.", tone: "clinical", ev: "Lab test; go over results with a clinician", src: ["teede2023", "medlineA1c"] }),
  I({ id: "everly-fertility", category: "labs", also: ["fertility"], brand: "Everlywell", name: "Women's Fertility Test", url: "https://www.everlywell.com/", stages: ["ttc"], kind: null, avail: "home",
    covers: "Reproductive hormones and thyroid (TSH) from a finger-prick sample", why: "Hormone levels can point to things worth discussing with a clinician, but they can't tell you whether you'll get pregnant.", tone: "mixed", ev: "Limited value for predicting fertility", src: ["asrm2020"] }),
  I({ id: "everly-peri", category: "labs", also: ["meno"], brand: "Everlywell", name: "Perimenopause Test", url: "https://www.everlywell.com/", stages: ["peri"], kind: null, avail: "home",
    covers: "Hormones such as FSH and estradiol", why: "Over 45, perimenopause is usually recognised from symptoms; hormone levels swing from day to day, so one test says little.", tone: "mixed", ev: "Rarely needed to recognise perimenopause", src: ["nice2015"] }),
];
/* Where it comes from and what it covers, for the product cards (2026-11-15). avail → AVAIL_LABEL; covers is one short,
   factual line (registered in docs/CLINICIAN-REVIEW.md with the why). */
const MORE = Object.freeze({
  "easyhome-lh": { avail: "online", covers: "LH, the hormone that surges before ovulation" },
  "clearblue-ovulation": { avail: "stores", covers: "LH, with a digital result" },
  mira: { avail: "online", covers: "Fertility hormones in urine, read by a small monitor" },
  inito: { avail: "online", covers: "Several fertility hormones on one strip" },
  proov: { avail: "online", covers: "PdG, a progesterone marker in urine" },
  "easyhome-bbt": { avail: "online", covers: "Basal body temperature, to two decimals" },
  prenatal: { avail: "stores", covers: "Folic acid and other vitamins for pregnancy" },
  "pregnancy-test": { avail: "stores", covers: "hCG, the pregnancy hormone" },
  stelo: { avail: "online", covers: "Glucose, read by a sensor on your arm" },
  lingo: { avail: "online", covers: "Glucose, read by a sensor on your arm" },
  libre: { avail: "rx", covers: "Glucose, read by a sensor on your arm" },
  oura: { avail: "online", covers: "Sleep, heart rate, HRV and temperature" },
  "apple-watch": { avail: "stores", covers: "Heart rate, sleep and wrist temperature on recent models" },
  garmin: { avail: "stores", covers: "Heart rate, HRV and sleep" },
  fitbit: { avail: "stores", covers: "Heart rate and sleep" },
  whoop: { avail: "online", covers: "Heart rate, HRV, skin temperature and sleep" },
  "heat-wrap": { avail: "stores", covers: "Steady heat for period cramps" },
  "period-underwear": { avail: "online", covers: "Absorbs period flow" },
  midi: { avail: "visit", covers: "Perimenopause and menopause care by video" },
  "cooling-bedding": { avail: "online", covers: "Bedding that feels cooler" },
  sleepio: { avail: "app", covers: "A self-guided CBT-I course" },
  "cbti-coach": { avail: "app", covers: "CBT-I tools and a sleep diary" },
});
export const SHOP_ITEMS = Object.freeze(ITEMS.map((i) => (MORE[i.id] ? Object.freeze({ ...i, ...MORE[i.id] }) : i)));
export const AVAIL_LABEL = Object.freeze({
  home: "Kit sent to your home", lab: "Sample taken at a lab", visit: "Online visit", app: "In an app", online: "Sold online",
  stores: "Sold online and in stores", rx: "By prescription",
});
export const SHOP_IDS = Object.freeze(SHOP_ITEMS.map((i) => i.id));

const httpsOnly = (v) => {
  const s = String(v || "").trim();
  try { return /^https:\/\//i.test(s) ? new URL(s).href : ""; } catch { return ""; }
};
/* An affiliates.json value is a URL string, or { "url": "...", "price": "From $89" } (2026-11-15: the owner's optional price,
   copied from the brand's own site). */
const affEntry = (affiliates, id) => { const v = affiliates && affiliates[id]; return v && typeof v === "object" ? v : { url: v, price: "" }; };
/** The link to show for an item: { href, affiliate }. An https affiliate URL from the owner's file wins; otherwise the
    brand's own page, with no affiliate label. Nothing about her is ever added to either. */
export function linkFor(item, affiliates = {}) {
  const aff = httpsOnly(affEntry(affiliates, item.id).url);
  return aff ? { href: aff, affiliate: true } : { href: item.url, affiliate: false };
}
/** rel for a link: sponsored only when it is an affiliate link. */
export const relFor = (link) => (link.affiliate ? "noopener noreferrer sponsored" : "noopener noreferrer");

/** The category order for her, matched on the device. ctx: { stage, ttc, pcos, glucose }. Every category is listed;
    hers come first. */
export function shopCategories({ stage = "periods", ttc = false, pcos = false, glucose = false } = {}) {
  const first = [];
  if (ttc) first.push("fertility", "labs", "pregnancy");
  if (stage === "preg") first.push("pregnancy");
  if (pcos || glucose) first.push("glucose");
  if (pcos) first.push("labs");
  if (stage === "peri") first.push("meno", "labs");
  if (stage === "periods" && !ttc) first.push("periods");
  first.push("wearables", "sleep");
  const ids = [...new Set([...first, ...SHOP_CATEGORIES.map((c) => c.id)])];
  return ids.map((id) => SHOP_CATEGORIES.find((c) => c.id === id));
}
/** The items of a category (its own and those that also belong there), with an optional employer allow-list (ORGS partnerIds). */
export function shopItems(category, { allow = null } = {}) {
  return SHOP_ITEMS.filter((i) => (i.category === category || (i.also || []).includes(category)) && (!allow || allow.includes(i.id)));
}
/** The sources of an item, as plain titles. */
export const itemSources = (item) => (item.src || []).map((k) => SHOP_SOURCES[k]).filter(Boolean);

/* ---------- the Shop page (2026-11-15, plans-shop-page Task 3 and the owner's design update) ---------- */
export const SHOP_PAGE_COPY = Object.freeze({
  title: "Shop by need",
  lead: "Real products and services for your stage, with an honest note on the evidence.",
  footMatched: "Matched on this device; nothing about you is sent.",
  back: "Back",
  byNeed: "By need",
  byBrand: "By brand",
  viewLab: "Browse",
  needLab: "Needs, yours first",
  brandLab: "Brands",
  allBrands: "All brands",
  soldBy: (brand) => `Sold by ${brand}`,
  learnMore: "Learn more",
  learnMoreOf: (name) => `Learn more about ${name}`,
  priceNote: (brand) => `Price set by ${brand}; check their site.`,
  noPrice: "No price is shown here: check the brand's site.",
  reviewed: "Clinician reviewed",
  noneHere: "Nothing here for this plan.",
  footHead: "About this shop",
  footList: "The product list comes from Solia Health's server, like loading a web page: the request carries nothing about you.",
  fromBrand: (brand) => `From ${brand}:`,
  footLearns: "What the shop learns: nothing from Solia Health. Matching happens on this device. A shop learns only that you visited, and, through an affiliate link, that you came from Solia Health.",
  entryTitle: "Shop by need",
  entryLine: "Real products for your stage",
  headerLabel: "Shop",
  /* 2026-11-16 (docs/plans/shop-findable-visuals.md Task 1): Home's card, the "+" sheet's row, the one-time hint. */
  homeLine: (words) => `Real products for ${words}`,
  homeBrowse: "Browse the shop",
  homeHide: "Hide",
  homeHidden: "Hidden from Home. You can bring it back from You.",
  homeShow: "Show the shop card on Home",
  homeShown: "The shop card is back on Home.",
  sheetRow: "Shop by need",
  coach: "New: Shop by need",
  coachOk: "Got it",
  coachLab: "New in this update",
});
/* Her stage in words, for Home's card ("Real products for perimenopause"). ctx: { stage, ttc, meno }. */
export function stageWords({ stage = "periods", ttc = false, meno = false } = {}) {
  if (stage === "preg") return "pregnancy";
  if (ttc) return "trying to conceive";
  if (meno) return "menopause";
  if (stage === "peri") return "perimenopause";
  return "your cycle";
}
/* The device-only record key shopHint (never in a backup): { home: "hidden" | null, coach: true | false }. home is
   "hidden" once she taps Hide on Home's shop card (You brings it back); coach is true once this device has shown the
   one-time "New: Shop by need" hint. */
export const cleanShopHint = (v) => ({ home: v && typeof v === "object" && v.home === "hidden" ? "hidden" : null, coach: !!(v && typeof v === "object" && v.coach === true) });
/* Brand types for the section header's small tag, and one line about each brand (registered in docs/CLINICIAN-REVIEW.md).
   mono overrides the two-letter monogram where the initials would read oddly. */
export const BRANDS = Object.freeze({
  "Easy@Home": { tag: "AT-HOME TESTS", about: "Home ovulation and pregnancy tests and a basal thermometer." },
  Clearblue: { tag: "AT-HOME TESTS", about: "Home pregnancy and ovulation tests." },
  Mira: { tag: "AT-HOME TESTS", about: "A home hormone monitor that reads urine test wands, with an app." },
  Inito: { tag: "AT-HOME TESTS", about: "A fertility monitor that works with your phone and reads urine test strips." },
  Proov: { tag: "AT-HOME TESTS", about: "Home urine tests for ovulation markers, including PdG." },
  "Nature Made": { tag: "SUPPLEMENTS", about: "Vitamins and supplements sold in US stores." },
  "First Response": { tag: "AT-HOME TESTS", about: "Home pregnancy and ovulation tests." },
  Dexcom: { tag: "GLUCOSE SENSOR", about: "Makes continuous glucose monitors, including Stelo, sold without a prescription in the US." },
  Abbott: { tag: "GLUCOSE SENSOR", about: "Makes the Lingo glucose biosensor, sold without a prescription in the US." },
  "FreeStyle Libre": { tag: "GLUCOSE SENSOR", about: "Abbott's continuous glucose monitors, by prescription.", mono: "FL" },
  Oura: { tag: "WEARABLE", about: "A smart ring that reads sleep, heart rate and temperature." },
  Apple: { tag: "WEARABLE", about: "Apple Watch, read through Apple Health on iPhone." },
  Garmin: { tag: "WEARABLE", about: "Smartwatches and fitness trackers." },
  Fitbit: { tag: "WEARABLE", about: "Fitness trackers and smartwatches." },
  Whoop: { tag: "WEARABLE", about: "A screenless wearable strap, sold as a membership." },
  ThermaCare: { tag: "PERIOD CARE", about: "Heat wraps that warm up when opened." },
  Thinx: { tag: "PERIOD CARE", about: "Reusable period underwear." },
  "Midi Health": { tag: "TELEHEALTH", about: "A US telehealth service for perimenopause and menopause care." },
  "Slumber Cloud": { tag: "HOME COMFORT", about: "Bedding made with fabrics meant to feel cooler." },
  Sleepio: { tag: "SLEEP PROGRAM", about: "A digital CBT-I program for insomnia." },
  "US Department of Veterans Affairs": { tag: "FREE APP", about: "Free mental health and sleep apps from the US VA.", mono: "VA" },
  "Quest Diagnostics": { tag: "LAB NETWORK", about: "A US lab network; on its consumer site you order a test and give the sample at a Quest location.", mono: "QD" },
  "Labcorp OnDemand": { tag: "LAB NETWORK", about: "Labcorp's consumer site: you order a test online and give the sample at a Labcorp location or with a home kit.", mono: "LC" },
  Everlywell: { tag: "AT-HOME TESTS", about: "Home test kits: you collect a sample and mail it to a lab." },
});
/** The brand's two-letter monogram: an override, the first letters of its first two words, or its first two letters. */
export function monogram(brand) {
  const b = BRANDS[brand];
  if (b && b.mono) return b.mono;
  const words = String(brand || "").split(/[^A-Za-z]+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return (words[0] || "?").slice(0, 2).toUpperCase();
}
/* The brand's hue (2026-11-15 polish): one of the shop's own hues (lib/constants.js SHOP_HUES; not a stage UI palette,
   not a data-viz ramp), fixed per brand so brands side by side in a need look different. */
export const BRAND_HUE = Object.freeze({
  "Quest Diagnostics": "teal", "Labcorp OnDemand": "blue", Everlywell: "coral",
  "Easy@Home": "rose", Clearblue: "indigo", Mira: "violet", Inito: "cyan", Proov: "plum", "Nature Made": "green", "First Response": "coral",
  Dexcom: "green", Abbott: "blue", "FreeStyle Libre": "amber",
  Oura: "amber", Apple: "indigo", Garmin: "cyan", Fitbit: "teal", Whoop: "rose",
  ThermaCare: "coral", Thinx: "plum", "Midi Health": "violet", "Slumber Cloud": "blue", Sleepio: "indigo", "US Department of Veterans Affairs": "blue",
});
export const SHOP_HUE_IDS = Object.freeze(["teal", "blue", "coral", "violet", "green", "amber", "rose", "indigo", "cyan", "plum"]);
/** The hue of a brand (a fallback from its name for a brand without one in BRAND_HUE). */
export function brandHue(brand) {
  if (BRAND_HUE[brand]) return BRAND_HUE[brand];
  let h = 0; for (const ch of String(brand || "")) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return SHOP_HUE_IDS[h % SHOP_HUE_IDS.length];
}
/** The brands of a list of items, in order of first appearance. */
export const brandsOf = (items) => [...new Set(items.map((i) => i.brand))];
/** Items grouped by brand, in order of first appearance: [{ brand, items }]. */
export const groupByBrand = (items) => brandsOf(items).map((brand) => ({ brand, items: items.filter((i) => i.brand === brand) }));
/** Every item, optionally of one brand, with an employer allow-list. */
export const allItems = ({ brand = null, allow = null } = {}) => SHOP_ITEMS.filter((i) => (!brand || i.brand === brand) && (!allow || allow.includes(i.id)));

const PRICE_RE = /^(From |About )?[$£€]\d[\d.,]{0,8}( (a|per) (month|year|test|kit))?$/;
/** The owner's price for an item (affiliates.json { url, price }), shown only when present and plainly a price. */
export function priceFor(item, affiliates = {}) {
  const p = String(affEntry(affiliates, item.id).price || "").trim();
  return PRICE_RE.test(p) ? p : null;
}
/* Product images (owner design update, item 4): only files the owner placed in public/shop/ from an affiliate program's
   creative kit, declared in src/config/shop-images.json ({ "<item id>": "<item id>.webp" | ".jpg" }). Never a hotlinked
   brand image; anything else (or nothing) shows the calm illustrated placeholder. */
export function imageFor(item, manifest = {}) {
  const f = manifest && manifest[item.id];
  return typeof f === "string" && (f === `${item.id}.webp` || f === `${item.id}.jpg`) ? `shop/${f}` : null;
}
/* "Clinician reviewed" (item 6): only for an item whose docs/CLINICIAN-REVIEW.md entry is marked signed and whose id the
   owner then lists in src/config/shop-reviewed.json "signed" (shop.test.mjs checks the two agree). None are signed yet. */
export const isReviewed = (item, signed = []) => Array.isArray(signed) && signed.includes(item.id);
/** The icon of a category, for the image placeholder. */
export const CATEGORY_ICON = Object.freeze({ fertility: "teststrip", pregnancy: "heart", labs: "clipboard", glucose: "drop", wearables: "watch", periods: "drop", meno: "sun", sleep: "moon" });
