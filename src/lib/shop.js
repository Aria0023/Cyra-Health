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
     whole thing off. */

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
});

/* kind: what "Add to what I'm trying" files it as (lib/trying.js TRY_KINDS); null = not something she takes or does daily. */
const I = (o) => Object.freeze({ ...o, stages: Object.freeze(o.stages || []), modules: Object.freeze(o.modules || []) });
export const SHOP_ITEMS = Object.freeze([
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
]);
export const SHOP_IDS = Object.freeze(SHOP_ITEMS.map((i) => i.id));

const httpsOnly = (v) => {
  const s = String(v || "").trim();
  try { return /^https:\/\//i.test(s) ? new URL(s).href : ""; } catch { return ""; }
};
/** The link to show for an item: { href, affiliate }. An https affiliate URL from the owner's file wins; otherwise the
    brand's own page, with no affiliate label. Nothing about her is ever added to either. */
export function linkFor(item, affiliates = {}) {
  const aff = httpsOnly(affiliates && affiliates[item.id]);
  return aff ? { href: aff, affiliate: true } : { href: item.url, affiliate: false };
}
/** rel for a link: sponsored only when it is an affiliate link. */
export const relFor = (link) => (link.affiliate ? "noopener noreferrer sponsored" : "noopener noreferrer");

/** The category order for her, matched on the device. ctx: { stage, ttc, pcos, glucose }. Every category is listed;
    hers come first. */
export function shopCategories({ stage = "periods", ttc = false, pcos = false, glucose = false } = {}) {
  const first = [];
  if (ttc) first.push("fertility", "pregnancy");
  if (stage === "preg") first.push("pregnancy");
  if (pcos || glucose) first.push("glucose");
  if (stage === "peri") first.push("meno");
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
