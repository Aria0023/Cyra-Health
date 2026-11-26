/* The ad kit (docs/plans/website.md Task 4): the words and the pictures for ads and for the store listings, in one place.
   - AD_CONCEPTS: three concepts (privacy first, life stages, quick log), each with headlines (at most 30 and at most 40
     characters), primary text, descriptions and a call to action, and the picture's own words.
   - STORE_LISTING: the App Store / Google Play listing text within each store's limits.
   - adCards(d): the twelve pictures (three concepts × 1080×1080, 1080×1350, 1080×1920, 1200×628), drawn by
     site/cards.mjs into docs/marketing/ads/ at 2x from real app screenshots and the app's Soft tokens. Light only.
   - adsMarkdown(d): docs/marketing/ADS.md, generated from this file (npm run site:ads writes it; a unit test fails when
     it is out of date, when a line is over its limit, or when a line names no source file).
   Every line is a public claim and has to be literally true of the build, like the website's: each has `src`, the app
   or backend file that makes it true. Wording rules the lines were written to are in RULES below; they are a working
   checklist, NOT legal advice.
   Nothing here is shipped in dist/: site/build/site.mjs copies only site/img/. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ROOT } from "./build/app-data.mjs";
import { cardDocument, brandLine, phoneFigure } from "./cards.mjs";
import { esc } from "./pages/copy.mjs";

export const ADS_DIR = path.join(ROOT, "docs", "marketing", "ads");
export const ADS_FILE = path.join(ROOT, "docs", "marketing", "ADS.md");
export const LIMITS = Object.freeze({ headline30: 30, headline40: 40, description: 90, primary: 125, cta: 20, name: 30, subtitle: 30, short: 80, promo: 170, keywords: 100 });
export const AD_SIZES = Object.freeze([
  { id: "1080x1080", width: 1080, height: 1080, layout: "square", use: "Feed, square (Meta, LinkedIn, Pinterest)" },
  { id: "1080x1350", width: 1080, height: 1350, layout: "tall", use: "Feed, 4:5 portrait (Meta)" },
  { id: "1080x1920", width: 1080, height: 1920, layout: "tall story", use: "Stories and Reels, 9:16 (Meta, TikTok, Snapchat). The words start below the top 14%, where the platform puts its own header; the bottom 20%, where it puts its button, holds only the picture" },
  { id: "1200x628", width: 1200, height: 628, layout: "wide", use: "Landscape link ads (Google responsive display, Meta link ads, X)" },
]);

const UI = "src/locales/en-ui.js";
const L = (text, src) => Object.freeze({ text, src });

/** Built from the app's data so a sentence the app owns is the app's sentence. */
export function adConcepts(d) {
  const stages = d.stages.map((s) => s.label);
  const practices = d.practices.length;
  return [
    {
      id: "privacy-first", name: "Privacy first", shot: "home",
      image: { headline: L("A health log that lives on your device.", `${UI} splash.yourHealthLogLivesOn; src/lib/storage.js`), sub: L("Cycle, pregnancy and menopause tracking. No ad networks, no trackers.", "src/lib/onboarding.js STAGE_CARDS; package.json (no advertising or analytics dependency); e2e/privacy.spec.mjs") },
      headlines30: [L("A health log on your device", "src/lib/storage.js"), L("No ad networks. No trackers.", "package.json (no advertising or analytics dependency); e2e/privacy.spec.mjs; public/legal/privacy.html section 6"), L("Cycle tracking, on your device", "src/lib/storage.js; src/lib/onboarding.js STAGE_CARDS")],
      headlines40: [L("A health log that lives on your device", `${UI} splash.yourHealthLogLivesOn; src/lib/storage.js`), L("Cycle tracking without ad trackers", "package.json (no advertising or analytics dependency); e2e/privacy.spec.mjs"), L("You choose what leaves your phone", "src/lib/privacyFlows.js flowRows; src/lib/features.js")],
      primary: [
        L("The health log stays on the device. Each feature that sends anything says exactly what, before it is turned on.", `${UI} splash.yourHealthLogLivesOn; src/lib/features.js; src/lib/privacyFlows.js`),
        L("Cycle, pregnancy and menopause tracking with no ad networks and no third-party analytics or tracking code.", "src/lib/onboarding.js STAGE_CARDS; package.json; public/legal/privacy.html section 6; e2e/privacy.spec.mjs"),
      ],
      primaryLong: [L(`${d.splash.privacy.replace("Your health log lives on your device.", "With Solia Health, your health log lives on your device.")} Cycle, fertility, pregnancy, perimenopause and menopause tracking, with no ad networks and no third-party analytics or tracking code.`, `${UI} splash.yourHealthLogLivesOn; src/lib/onboarding.js STAGE_CARDS; package.json; public/legal/privacy.html section 6`)],
      descriptions: [L("The log stays on the device. Solia Health's servers don't keep a copy.", "src/lib/disclosures.js storeCopyLine; src/lib/storage.js"), L("Delete everything from the app at any time.", "src/lib/disclosures.js consentDeleteFact; src/components/DataControls.jsx")],
      cta: L("Learn more", "label"),
    },
    {
      id: "life-stages", name: "Life stages", shot: null,
      image: { headline: L("One app, five life stages.", "src/lib/onboarding.js STAGE_CARDS"), sub: L(d.app.oneStage, `${UI} you.cyraIsShapedAroundOne; src/lib/onboarding.js primaryStage`) },
      headlines30: [L("One app, five life stages", "src/lib/onboarding.js STAGE_CARDS"), L("From cycles to menopause", "src/lib/onboarding.js STAGE_CARDS"), L("One stage at a time", `${UI} you.cyraIsShapedAroundOne`)],
      headlines40: [L("Cycle, pregnancy and menopause, one app", "src/lib/onboarding.js STAGE_CARDS"), L("One app from cycles through menopause", "src/lib/onboarding.js STAGE_CARDS"), L("Change stage and keep everything logged", `${UI} you.cyraIsShapedAroundOne`)],
      primary: [
        L("One app for cycles, trying to conceive, pregnancy, perimenopause and menopause. One stage at a time.", `src/lib/onboarding.js STAGE_CARDS, primaryStage; ${UI} you.cyraIsShapedAroundOne`),
        L("Period predictions as a range of days and an estimated fertile window. Solia Health is not a contraceptive.", "src/lib/engine.js; src/lib/learn.js LEARN fertile; src/lib/signals.js"),
      ],
      primaryLong: [L(`Solia Health has five stages: ${stages.slice(0, -1).join(", ")} and ${stages[stages.length - 1]}. The app is set up for one at a time, and changing it keeps everything logged. Period predictions are a range of days, the fertile window is an estimate, and Solia Health is not a contraceptive.`, `src/lib/onboarding.js STAGE_CARDS, primaryStage; ${UI} you.cyraIsShapedAroundOne; src/lib/engine.js; src/lib/learn.js LEARN fertile`)],
      descriptions: [L("One stage at a time. Changing it keeps everything logged.", `${UI} you.cyraIsShapedAroundOne`), L("Estimates, not contraception. Guidance, never a diagnosis.", `src/screens/CalendarScreen.jsx; ${UI} splash.guidanceNeverADiagnosisFor`)],
      cta: L("Learn more", "label"),
    },
    {
      id: "quick-log", name: "Quick log", shot: "log",
      image: { headline: L(d.splash.track, `${UI} splash.trackIn30SecondsA`), sub: L("Tap what you notice. See what tends to go together in your log.", "src/lib/routes.js LOG_ITEMS; src/lib/guide.js VIEW_HINTS.patterns") },
      headlines30: [L("Track in 30 seconds a day", `${UI} splash.trackIn30SecondsA`), L("One reminder at most", `${UI} onb.youCanChangeThisAnytime`), L("A one-page doctor summary", "src/screens/ReportScreen.jsx; e2e/smoke.spec.mjs")],
      headlines40: [L("Log symptoms, sleep and mood in a tap", "src/lib/routes.js LOG_ITEMS"), L("See what tends to go together in a log", "src/lib/guide.js VIEW_HINTS.patterns"), L("A one-page summary for appointments", "src/screens/ReportScreen.jsx; e2e/smoke.spec.mjs")],
      primary: [
        L("Symptoms, sleep, mood, movement, medicines and notes each open from one button. One reminder at most.", `src/lib/routes.js LOG_ITEMS; ${UI} onb.youCanChangeThisAnytime`),
        L("Patterns shows what tends to go together in a log. The Report makes a one-page summary for appointments.", "src/lib/guide.js VIEW_HINTS.patterns; src/screens/ReportScreen.jsx; e2e/smoke.spec.mjs"),
      ],
      primaryLong: [L(`Symptoms, sleep, mood, movement, medicines and notes each open from one button. ${d.guide.patterns} Solia Health sends one reminder at most and never a second nudge, the Report makes a one-page summary for appointments on the device, and ${practices === 11 ? "eleven" : practices} guided practices are free.`, `src/lib/routes.js LOG_ITEMS; src/lib/guide.js VIEW_HINTS.patterns; ${UI} onb.youCanChangeThisAnytime; src/screens/ReportScreen.jsx; src/lib/mind.js PRACTICES`)],
      descriptions: [L("One reminder at most, never a second nudge.", `${UI} onb.youCanChangeThisAnytime`), L("Patterns are worked out on the device.", "src/lib/patterns.js; src/lib/insights.js; e2e/privacy.spec.mjs")],
      cta: L("Learn more", "label"),
    },
  ];
}

/** Store listing text. Neither store allows prices, "free", rankings or other apps' names in the name or subtitle. */
export function storeListing(d) {
  return {
    name: L("Solia Health", "capacitor.config.json appName"),
    subtitle: L("Cycle to menopause, on device", "src/lib/onboarding.js STAGE_CARDS; src/lib/storage.js"),
    short: L("Cycle, pregnancy and menopause tracking. The log stays on your device.", "src/lib/onboarding.js STAGE_CARDS; src/lib/storage.js"),
    promo: L(`Track in 30 seconds a day, see what tends to go together in your log, and bring a one-page summary to appointments. ${d.app.oneStage.split(". ")[0]}.`, `${UI} splash.trackIn30SecondsA; src/lib/guide.js VIEW_HINTS.patterns; src/screens/ReportScreen.jsx; ${UI} you.cyraIsShapedAroundOne`),
    keywords: L("period,cycle,ovulation,fertility,pregnancy,perimenopause,menopause,symptom,tracker,pcos,log,journal", "src/lib/onboarding.js STAGE_CARDS; src/lib/modules.js (pcos); src/lib/storage.js"),
  };
}

/** The rules the lines were written to. A working checklist for whoever places the ads; not legal advice. */
export const RULES = Object.freeze([
  ["Meta (Facebook, Instagram): personal attributes", ["No line says or implies that the reader has a health condition, is pregnant, is trying to conceive or is in menopause. The lines describe the app (“a health log”, “five life stages”), never the reader’s body.", "No “Are you…?”, “Struggling with…?”, “Your PCOS”, “Your pregnancy”. “Your device” and “your log” are about a phone and a file, not a condition."]],
  ["Meta: health and wellness, and reproductive health", ["No before-and-after, no body image, no negative self-perception, no promise of a result.", "Meta asks that ads for reproductive health products be shown to adults only: set the audience to 18+ when you place them. That is an ad setting, not a statement about who may use the app (the app’s minimum age is still an open question for the attorney).", "Do not build audiences from health interests or from lists of users, and do not install the Meta pixel or SDK. The website and the app have neither, and a unit test fails if the website loads anything from another origin."]],
  ["Google Ads: healthcare and medicines", ["No claim to diagnose, treat, cure or prevent anything, and no claim about a medicine. The fertility lines say “estimated” and “Solia Health is not a contraceptive.”", "Birth control and fertility products are restricted in some countries: check the country list before running the life-stages concept outside the United States."]],
  ["Google Ads: personalised advertising, health", ["Health is a sensitive category: no remarketing lists, no customer match and no similar audiences for these ads, and no line that implies knowledge of the reader’s health.", "Run them on keywords and context instead. The website has no Google tag, so there is nothing to remarket from."]],
  ["Apple App Store Review Guidelines 1.4.1 and 5.1.3", ["1.4.1 (medical apps): no accuracy claim is made. Predictions are described as estimates and ranges; “not a contraceptive” and “never a diagnosis” are in the kit.", "5.1.3 (health data): health data may not be used for advertising, marketing or data mining. The app keeps the log on the device and sends none of it to an ad or analytics service; do not change that to measure these ads.", "Store metadata: no price, “free”, ranking or other app’s name in the name, subtitle or keywords."]],
  ["Google Play: health apps and store listing", ["The short description makes no medical claim and uses no ranking word, emoji or ALL CAPS.", "The Data safety form and the delete-account address (docs/STORE-SETUP.md sections 2 and 9) must match what the listing says about privacy."]],
  ["FTC: truth in advertising", ["The kit says “no ad networks” and “no trackers”, not “no ads” and not “private”: the Shop lists products, some through affiliate links, and optional features send what she chooses to a server, so the broader words would say more than the build does.", "Every line is literally true of the build and names the file that makes it true. There is no testimonial, rating, user count, award, “clinically proven” or “doctor recommended”, and no health outcome is promised, so no line needs clinical substantiation.", "Subscription terms (price, renewal, how to cancel) are on the website’s pricing section and in the app before purchase; an ad that names a price must name the renewal too. None of these lines names a price."]],
  ["FTC Health Breach Notification Rule", ["A health app that shares identifiable health information without the person’s authorisation has a reportable breach, and that includes sending it to an ad platform. Never upload a user list, an email list or app events to an ad platform to target or measure these ads.", "The app has no advertising or analytics SDK. Keep it that way."]],
  ["Affiliate disclosure", ["None of these ads promotes a product from the Shop. If one ever does, the ad itself must say that Solia Health may earn a commission, clearly and next to the claim.", "In the app each affiliate link is labelled “Affiliate link”; the website says so under “Shop by need”."]],
  ["State law", ["Washington’s My Health My Data Act, and similar laws in Nevada and Connecticut, forbid geofencing around health care facilities and require consent before consumer health data is collected or shared: do not target these ads by location near clinics, and do not use health data for targeting."]],
]);

const stageTiles = (d) => `<ul class="stages">${d.stages.map((s) => `<li data-stage="${s.key}">${s.art}${esc(s.label)}</li>`).join("")}</ul>`;

/** The pictures: one per concept and size, into docs/marketing/ads/<concept>-<size>.jpg. */
export function adCards(d) {
  const cards = [];
  for (const c of adConcepts(d)) {
    for (const size of AD_SIZES) {
      const wide = size.layout === "wide", story = size.layout.includes("story"), square = size.layout === "square";
      const art = c.shot ? phoneFigure(c.shot) : stageTiles(d);
      const vars = c.shot
        ? (wide ? "--h1:7;--sub:3.3;--phone:42;" : story ? "--h1:7.6;--sub:3.5;--phone:62;" : square ? "--h1:6.4;--sub:2.9;--phone:44;" : "--h1:6.8;--sub:3.1;--phone:56;")
        : (wide ? "--h1:7.4;--sub:3.4;" : story ? "--h1:8.4;--sub:3.7;" : square ? "--h1:7.2;--sub:3.1;" : "--h1:7.6;--sub:3.3;");
      const text = `<div class="text">${brandLine(d)}<h1>${esc(c.image.headline.text)}</h1><p class="sub">${esc(c.image.sub.text)}</p></div>`;
      const body = `<div class="card ${size.layout}${c.shot ? "" : " tiles"}">${text}<div class="art">${art}</div></div>`;
      cards.push({ out: path.join(ADS_DIR, `${c.id}-${size.id}.jpg`), width: size.width, height: size.height, scale: 2, type: "jpeg", quality: 90, html: cardDocument(d, { width: size.width, height: size.height, vars, body }) });
    }
  }
  return cards;
}

const cell = (s) => String(s).replace(/\|/g, "\\|");
const rows = (kind, limit, lines) => lines.map((l) => `| ${kind} | ${cell(l.text)} | ${l.text.length}${limit ? ` / ${limit}` : ""} | ${cell(l.src)} |`);

/** docs/marketing/ADS.md. */
export function adsMarkdown(d) {
  const out = [
    "# Solia Health ad kit: pictures and words",
    "",
    "Generated by `npm run site:ads` from `site/ads.mjs`. Do not edit by hand: `npm run test:unit` fails when this file and",
    "`site/ads.mjs` differ, when a line is over its limit, or when a line names no file that makes it true.",
    "",
    "**This is not legal advice.** The checklist at the end is the set of rules these lines were written to, as the person",
    "who wrote them understood the platforms' published policies. No outside page could be opened while this was written,",
    "so none of it was checked against today's policy text. Have your attorney review the kit and the checklist before any",
    "ad runs, and read each platform's current policy when you place it.",
    "",
    "## How to use it",
    "",
    "- **The website promotes the app. That is the whole plan** (owner decision 2026-11-26): no ad network code, no tracking",
    "  pixel and no analytics on the website or in the app. These ads link to the website's front page (or to the store",
    "  pages once they exist); what happens after the click is not measured by any ad platform, on purpose.",
    "- **Every line is a public claim**, like the website's. Each row names the app or backend file that makes it true. If the",
    "  app changes, regenerate this file and reread the lines.",
    "- **Pictures** are in `docs/marketing/ads/` as JPEG at twice the named size (a 1080×1080 picture is 2160×2160 pixels),",
    "  light only, drawn from real app screenshots (`site/img/`, example data) with the app's own colours and typefaces.",
    "  They are not part of the website build and are never deployed.",
    "- **The call to action** is the platform's own button. Use \"Learn more\" while the apps are not in the stores, and the",
    "  platform's download button once they are.",
    "",
    "## The pictures",
    "",
    "| Size | Use | Files |",
    "| --- | --- | --- |",
    ...AD_SIZES.map((s) => `| ${s.width}×${s.height} | ${s.use} | ${adConcepts(d).map((c) => `\`${c.id}-${s.id}.jpg\``).join(", ")} |`),
    "",
  ];
  for (const c of adConcepts(d)) {
    out.push(`## Concept: ${c.name}`, "", `Pictures: \`docs/marketing/ads/${c.id}-*.jpg\`${c.shot ? ` (the app's ${c.shot === "home" ? "Home screen" : "Log something sheet"}, example data)` : " (the five stage illustrations from the app)"}.`, "",
      "| Line | Words | Characters | Made true by |", "| --- | --- | --- | --- |",
      ...rows("On the picture: headline", null, [c.image.headline]), ...rows("On the picture: line under it", null, [c.image.sub]),
      ...rows("Headline (30)", LIMITS.headline30, c.headlines30), ...rows("Headline (40)", LIMITS.headline40, c.headlines40),
      ...rows("Primary text (125)", LIMITS.primary, c.primary), ...rows("Primary text, long", null, c.primaryLong), ...rows("Description", LIMITS.description, c.descriptions), ...rows("Call to action", LIMITS.cta, [c.cta]), "");
  }
  const s = storeListing(d);
  out.push("## App Store and Google Play listing text", "",
    "| Field | Words | Characters | Made true by |", "| --- | --- | --- | --- |",
    ...rows("Name (App Store and Play, 30)", LIMITS.name, [s.name]), ...rows("Subtitle (App Store, 30)", LIMITS.subtitle, [s.subtitle]),
    ...rows("Short description (Play, 80)", LIMITS.short, [s.short]), ...rows("Promotional text (App Store, 170)", LIMITS.promo, [s.promo]),
    ...rows("Keywords (App Store, 100, comma-separated)", LIMITS.keywords, [s.keywords]), "",
    "The long description for either store can be taken from the website's sections; every sentence there is listed with its",
    "source in `docs/plans/website-claims.md`.", "",
    "## The rules these lines were written to (not legal advice)", "");
  for (const [title, points] of RULES) { out.push(`### ${title}`, ...points.map((p) => `- ${p}`), ""); }
  out.push("### Before any ad runs", "- [ ] The attorney has read this file and `docs/PRIVACY-AUDIT.md` (\"The Solia Health website\").", "- [ ] Each platform's current policy has been read where the ad is placed; this checklist was written without access to them.", "- [ ] The audience is adults, with no health-interest targeting, no uploaded lists and no location targeting near clinics.", "- [ ] No pixel, tag or SDK has been added to the website or the app to measure the ads.", "- [ ] The store links are set (docs/STORE-SETUP.md section 8), or the ad's button says \"Learn more\" and goes to the website.", "");
  return out.join("\n");
}

/* npm run site:ads            writes docs/marketing/ADS.md and draws the twelve pictures
   npm run site:ads -- --md    only the words
   npm run site:ads -- --check exits 1 if docs/marketing/ADS.md is out of date */
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { loadAppData } = await import("./build/app-data.mjs");
  const d = await loadAppData();
  const md = adsMarkdown(d);
  if (process.argv.includes("--check")) {
    if ((fs.existsSync(ADS_FILE) ? fs.readFileSync(ADS_FILE, "utf8") : "") !== md) { console.error("[solia] docs/marketing/ADS.md is out of date: run npm run site:ads -- --md"); process.exit(1); }
    console.log("[solia] docs/marketing/ADS.md is up to date");
  } else {
    fs.mkdirSync(path.dirname(ADS_FILE), { recursive: true });
    fs.writeFileSync(ADS_FILE, md);
    console.log(`[solia] wrote ${path.relative(ROOT, ADS_FILE)}`);
    if (!process.argv.includes("--md")) { const { draw } = await import("./cards.mjs"); await draw(adCards(d)); }
  }
}
