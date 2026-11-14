/* Learn (2026-11-14, docs/plans/partner-learn-glucose-shop.md Task A3): a small on-device library of plain-language
   explainers. Each is 3 to 6 short sentences and a "Sources" list of named sources. Pure data plus two lookups: no
   React, storage or network, and nothing is fetched when she opens one.

   Reached from You → Learn and from the "What does this mean?" links beside the related screen elements (the cycle ring
   and its phase, the fertile-window row, fertility signs, the auto-tracked card, the glucose card). General education
   only: never a diagnosis, never a target or a dose for her, never contraception. Every sentence is listed in
   docs/CLINICIAN-REVIEW.md under "Learn" with its sources (learn.test.mjs fails when an explainer is missing there). */

export const LEARN_COPY = Object.freeze({
  eyebrow: "Learn",
  title: "Plain-language explainers",
  lead: "Short answers to what people often ask, with where they come from. They're read on this device; opening one sends nothing.",
  link: "What does this mean?",
  sources: "Sources",
  foot: "General information, not medical advice. Your clinician can tell you what it means for you.",
});

/* Named sources. Titles as published; confirm editions at clinician review (docs/CLINICIAN-REVIEW.md "Learn"). */
export const LEARN_SOURCES = Object.freeze({
  acogCycle: "ACOG Committee Opinion 651, Menstruation in Girls and Adolescents: Using the Menstrual Cycle as a Vital Sign (2015, reaffirmed)",
  nichdMenses: "NICHD (NIH), About Menstruation",
  nhsFertility: "NHS, Periods and fertility in the menstrual cycle",
  wilcox1995: "Wilcox AJ, Weinberg CR, Baird DD. Timing of sexual intercourse in relation to ovulation. New England Journal of Medicine, 1995",
  medlineOvTest: "MedlinePlus (NIH), Ovulation home test",
  su2017: "Su HW, et al. Detection of ovulation, a review of currently available methods. Bioengineering & Translational Medicine, 2017",
  acogPcos: "ACOG FAQ, Polycystic Ovary Syndrome (PCOS)",
  nhsPcos: "NHS, Polycystic ovary syndrome",
  nichdPcos: "NICHD (NIH), Polycystic Ovary Syndrome (PCOS)",
  acogMeno: "ACOG FAQ, The Menopause Years",
  niaMeno: "National Institute on Aging (NIH), What Is Menopause?",
  medlinePulse: "MedlinePlus (NIH), Pulse",
  maijala2019: "Maijala A, et al. Nocturnal finger skin temperature in menstrual cycle tracking: ambulatory pilot study using a wearable Oura ring. BMC Women's Health, 2019",
  niddkCgm: "NIDDK (NIH), Continuous Glucose Monitoring",
  cdcGlucose: "CDC, Monitoring Your Blood Sugar",
  battelino2019: "Battelino T, et al. Clinical Targets for Continuous Glucose Monitoring Data Interpretation: Recommendations From the International Consensus on Time in Range. Diabetes Care, 2019",
});

const E = (id, title, body, sources) => Object.freeze({ id, title, body: Object.freeze(body), sources: Object.freeze(sources) });
export const LEARN = Object.freeze([
  E("cycle", "The menstrual cycle and its phases", [
    "A cycle runs from the first day of one period to the day before the next.",
    "Many adults have cycles between 21 and 35 days, and the length can vary from month to month.",
    "The period days come first. Then, in the follicular phase, an egg matures, and ovulation usually happens once in each cycle.",
    "The luteal phase follows ovulation and lasts until the next period, often about two weeks.",
    "Solia Health names the phase from your logged period starts, so it's an estimate.",
  ], ["acogCycle", "nichdMenses", "nhsFertility"]),
  E("fertile", "What the fertile window is, and why it's an estimate", [
    "The fertile window is the days in a cycle when pregnancy is most likely: about the five days before ovulation and the day of it.",
    "Ovulation moves from cycle to cycle, so no app can know the exact days ahead of time.",
    "Solia Health works the window out from your past cycle lengths and widens it when your cycles vary.",
    "Signs like ovulation tests, cervical mucus and temperature can add detail about the cycle you're in.",
    "Solia Health is not a contraceptive.",
  ], ["wilcox1995", "nhsFertility"]),
  E("lh", "Ovulation tests (LH)", [
    "Ovulation tests check urine for luteinizing hormone (LH), which rises sharply a day or two before ovulation.",
    "A positive test means the surge was found, so ovulation is likely soon. It doesn't confirm that ovulation happened.",
    "Testing at about the same time each day, and following the kit's instructions, gives the clearest results.",
    "Some conditions, such as PCOS, can cause positive tests without ovulation, so ask your clinician if results are confusing.",
  ], ["medlineOvTest", "su2017"]),
  E("bbt", "Basal body temperature", [
    "Basal body temperature is your temperature at rest, taken before you get up.",
    "After ovulation it usually rises a little, by about 0.2 to 0.5 °C, and stays up until the next period.",
    "The rise shows after ovulation has happened, so it helps you see a pattern over cycles rather than predict this month.",
    "Illness, alcohol, travel and short sleep can all move the reading.",
  ], ["su2017", "nhsFertility"]),
  E("mucus", "Cervical mucus", [
    "Cervical mucus changes through the cycle as hormones change.",
    "After a period it is often dry or sticky, then creamier, then clear, stretchy and slippery, like raw egg white.",
    "The egg-white kind usually appears in the days before ovulation, when the fertile window is open.",
    "Patterns differ between people, so it helps to notice your own over a few cycles.",
  ], ["nhsFertility", "su2017"]),
  E("irregular", "Irregular cycles and PCOS basics", [
    "Cycles that are often shorter than 21 days, longer than 35 days, or very different from one month to the next are worth raising with a clinician.",
    "Polycystic ovary syndrome (PCOS) is a common hormone condition and one of the usual reasons for long or irregular cycles.",
    "It is diagnosed by a clinician from cycles, signs such as extra hair or acne, blood tests and sometimes an ultrasound. An app can't diagnose it.",
    "PCOS is also linked with how the body handles insulin, which is why blood sugar can come up at check-ups.",
  ], ["acogPcos", "nhsPcos", "nichdPcos"]),
  E("peri", "Perimenopause signs", [
    "Perimenopause is the years before periods stop for good, often starting in the 40s.",
    "Periods may come closer together or further apart, and be lighter or heavier.",
    "Hot flashes, night sweats, poorer sleep, mood changes and vaginal dryness are common.",
    "Menopause is reached 12 months after the last period.",
    "Talk with your clinician about symptoms that bother you; there are options that help.",
  ], ["acogMeno", "niaMeno"]),
  E("wearables", "Resting heart rate, HRV and temperature from a wearable", [
    "Resting heart rate is how many times your heart beats a minute at rest. Heart rate variability (HRV) is how much the time between beats changes.",
    "Watches and rings also read skin or wrist temperature at night, usually as a change from your own usual.",
    "These readings shift with sleep, stress, illness, alcohol and the menstrual cycle, so they're most useful compared with your own past nights.",
    "They can't diagnose a condition or confirm ovulation, and different devices measure in different ways.",
  ], ["medlinePulse", "maijala2019"]),
  E("glucose", "Blood glucose, CGMs and time in range", [
    "Blood glucose is the sugar in your blood. It rises after eating and falls with activity and overnight.",
    "A continuous glucose monitor (CGM) is a small sensor worn on the skin that reads glucose every few minutes, day and night.",
    "Time in range is the share of the day your readings sit inside a range. The right range is different for different people.",
    "Solia Health shows your readings without judging them, and never sets a target, an alert or a dose. Ask your clinician about your targets.",
  ], ["niddkCgm", "cdcGlucose", "battelino2019"]),
]);
export const LEARN_IDS = Object.freeze(LEARN.map((e) => e.id));
/** The explainer for an id, or null. */
export const learnOf = (id) => LEARN.find((e) => e.id === id) || null;
/** Its sources as plain titles. */
export const learnSources = (e) => (e ? e.sources.map((s) => LEARN_SOURCES[s]).filter(Boolean) : []);
/** The explainers a stage shows first on You → Learn (every one is always listed). */
export function learnFor({ stage = "periods", ttc = false, meno = false, glucose = false } = {}) {
  const first = stage === "preg" ? ["glucose", "wearables"] : stage === "peri" ? (meno ? ["peri", "wearables"] : ["peri", "cycle", "wearables"])
    : ttc ? ["fertile", "lh", "bbt", "mucus", "cycle"] : ["cycle", "fertile", "irregular"];
  if (glucose && !first.includes("glucose")) first.push("glucose");
  return [...first, ...LEARN_IDS.filter((id) => !first.includes(id))].map(learnOf);
}
