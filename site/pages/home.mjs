/* The front page (docs/plans/website.md Task 2), section by section in the brief's order. Wherever the app already has
   the sentence, the page uses the app's own string (ctx.d, read by site/build/app-data.mjs); the rest is written here
   and names the file that makes it true. No testimonials, numbers of users, ratings, awards or health promises. */
import { LABEL } from "./copy.mjs";
import { head, header, footer, phone, iconChip, hrefFor } from "./layout.mjs";

const UI = "src/locales/en-ui.js";
const FLOWS = "src/lib/privacyFlows.js";
const PRICING = "src/lib/pricing.js";

export const HOME_TITLE = "Solia Health: cycle, pregnancy and menopause tracking that lives on your device";
export const HOME_SOURCE = "src/lib/onboarding.js STAGE_CARDS (the five stages); src/lib/storage.js (the record is kept on the device)";
export const HOME_DESCRIPTION = { text: "Solia Health tracks your cycle, fertility, pregnancy, perimenopause and menopause. Your health log lives on your device.", source: HOME_SOURCE };

function storeButtons(ctx, c) {
  const { links } = ctx.d;
  const src = "src/lib/links.js APP_STORE_URL / PLAY_STORE_URL (VITE_APP_STORE_URL, VITE_PLAY_STORE_URL at build time)";
  const apple = links.appStore
    ? `<a class="btn btn-primary" href="${links.appStore}" rel="noopener">${c.t("Get it on the App Store", src)}</a>`
    : `<span class="soon">${c.t("Coming soon to the App Store", src)}</span>`;
  const play = links.playStore
    ? `<a class="btn btn-primary" href="${links.playStore}" rel="noopener">${c.t("Get it on Google Play", src)}</a>`
    : `<span class="soon">${c.t("Coming soon to Google Play", src)}</span>`;
  const both = links.appStore || links.playStore;
  return `<div class="cta">
${apple}
${play}
<a class="btn ${both ? "btn-quiet" : "btn-primary"}" href="/app/">${c.t("Open the web app", "site/build/hosting.mjs APP_BASE: the web app is served at /app/")}</a>
</div>`;
}

function hero(ctx, c) {
  const { d } = ctx;
  return `<section class="hero" aria-labelledby="hero-h">
<div class="wrap hero-in">
<div class="hero-text">
<p class="slogan">${c.t(d.splash.slogan, `${UI} splash.slogan`)}</p>
<h1 id="hero-h">${c.t("Cycle, fertility, pregnancy, perimenopause and menopause tracking that lives on your device.", "src/lib/onboarding.js STAGE_CARDS (My Cycle, Trying to conceive, Pregnant, Perimenopause, Menopause & beyond); src/lib/storage.js (the record: IndexedDB in a browser, the app's own files on a phone)")}</h1>
<p class="lead">${c.t(d.splash.privacy.replace(/^Your health log lives on your device\. /, ""), `${UI} splash.yourHealthLogLivesOn (second sentence); docs/PRIVACY-AUDIT.md`)}</p>
${storeButtons(ctx, c)}
<ul class="points">
<li>${iconChip(ctx, "clock")}<span>${c.t(d.splash.track, `${UI} splash.trackIn30SecondsA`)}</span></li>
<li>${iconChip(ctx, "chart")}<span>${c.t(d.splash.patterns, `${UI} splash.seeYourRealPatterns`)}</span></li>
<li>${iconChip(ctx, "clipboard")}<span>${c.t(d.splash.evidence, `${UI} splash.walkIntoAppointmentsWithEvidence`)}</span></li>
</ul>
<p class="fine">${c.t(d.splash.guidance, `${UI} splash.guidanceNeverADiagnosisFor`)}</p>
</div>
<div class="hero-art">
${phone(ctx, c, "home", { eager: true })}
</div>
</div>
</section>`;
}

function privacy(ctx, c) {
  const { d } = ctx;
  const P = d.privacy.copy;
  const F = d.features;
  const row = (name, nameSrc, line, lineSrc, more = "") => `<li><p><strong>${c.t(name, nameSrc)}.</strong> ${c.t(line, lineSrc)}${more}</p></li>`;
  const flow = (id, short = false) => row(P.names[id], `${FLOWS} FLOW_COPY.names.${id}`, short ? P.short[id] : P.lines[id], `${FLOWS} FLOW_COPY.${short ? "short" : "lines"}.${id}`);
  const account = P.other.signin.replace(/^Your Solia Health account: /, "");
  const off = [
    F.ai && flow("ai"), F.ai && flow("aiWeekly", true), F.ai && flow("aiChat", true), F.ai && flow("aiMeals", true),
    F.wearables && flow("wearables"),
    F.webReminders && row(P.names.remindersWeb, `${FLOWS} FLOW_COPY.names.remindersWeb`, P.lines.remindersWeb, `${FLOWS} FLOW_COPY.lines.remindersWeb`, ` ${c.h(`On a phone, reminders are different: ${lower(P.lines.remindersPhone)}`, `${FLOWS} FLOW_COPY.lines.remindersPhone; src/lib/notifications.js (the phone schedules local notifications)`)}`),
    F.shop && row(d.shop.tapName, "src/lib/shopTaps.js TAP_COPY.name", d.shop.tapLine, "src/lib/shopTaps.js TAP_COPY.line; backend/src/modules/shop (shop_taps)"),
  ].filter(Boolean);
  const self = [
    flow("feedback", true),
    row(P.names.files, `${FLOWS} FLOW_COPY.names.files`, P.lines.files, `${FLOWS} FLOW_COPY.lines.files`, ` ${c.t(P.backupLocked.replace("on this device", "on your device"), `${FLOWS} FLOW_COPY.details.backupLocked; src/lib/backup.js`)}`),
    F.signin && row("Your Solia Health account", `${FLOWS} FLOW_COPY.other.signin`, account.replace(/^when you sign in/, "When you sign in"), `${FLOWS} FLOW_COPY.other.signin; backend/src/modules/accounts/index.js`),
    row("Pro", `${PRICING} ENTITLEMENT`, d.privacy.whoKnows, "src/lib/purchase.js STORE_LINES.whoKnows; src/lib/purchase.test.mjs"),
    row("An organization you join", "src/lib/org.js", d.privacy.org.joinWhat, "src/lib/org.js ORG_COPY.joinWhat; backend/src/modules/orgs/index.js", ` ${c.t(d.privacy.org.privacy, "src/lib/org.js ORG_COPY.privacy; backend/src/modules/orgs/stats.js")}`),
  ].filter(Boolean);
  return `<section class="band" id="privacy" aria-labelledby="privacy-h">
<div class="wrap">
<h2 id="privacy-h">${c.t(d.splash.privacyTitle, `${UI} splash.yourPrivacyPlainly`)}</h2>
<div class="privacy">
<div class="stays">
${iconChip(ctx, "lock")}
<h3>${c.t("What stays on your device", "public/legal/privacy.html section 2")}</h3>
<p>${c.h("<strong>Your health log lives on your device.</strong> On a phone it is kept in the app's own storage; on the web, in your browser's storage.", `${UI} splash.yourHealthLogLivesOn; src/lib/storage.js (IndexedDB on the web, and on a phone the app's own files, kept out of iCloud and device backup)`)} ${c.t(d.privacy.storeCopy, "src/lib/disclosures.js storeCopyLine (a build without the optional backup account, the shipping default)")}</p>
<ul class="ticks">
${[
    "Check-ins, symptoms, moods, sleep and notes",
    "Your cycle and period log, fertility signs and pregnancy details",
    "Journal entries, appointments and medicines",
    "The patterns, predictions and reports the app works out from your log",
    "Readings from Apple Health or Health Connect, if you allow them",
  ].map((li) => `<li>${ctx.d.icons.check}<span>${c.t(li, "public/legal/privacy.html section 2; src/lib/record.js (the record's keys); src/lib/wearables.js (Apple Health / Health Connect are read on the phone)")}</span></li>`).join("\n")}
</ul>
<p>${c.h(`<strong>That also means Solia Health can't get it back for you.</strong> ${escKeep(d.help.data.a[1].replace(/^That also means Solia Health can't get it back for you\. /, ""))}`, "src/lib/feedback.js helpItems (Where does my data live?); src/lib/backup.js")}</p>
</div>
<div class="leaves">
<h3>${c.t("What can leave it, and only when you choose", `${FLOWS} FLOW_COPY.label`)}</h3>
<p>${c.t("Each of these does nothing until you use it, and the app says exactly what it sends where you turn it on. A version of the app that doesn't offer one of them sends nothing for it.", "src/lib/features.js (header: every opt-in starts off and says what it sends, and a feature that is off makes no request); src/lib/privacyFlows.js flowRows")}</p>
<h4><span class="state">${c.t("Off until you turn it on", "src/lib/features.js; src/lib/privacyFlows.js flowRows (state off)")}</span></h4>
<ul class="rows">
${off.join("\n")}
</ul>
<h4><span class="state">${c.t("Only when you do it yourself", "src/lib/privacyFlows.js flowRows (states you / send); src/lib/signin.js; src/lib/purchase.js; src/lib/orgLive.js")}</span></h4>
<ul class="rows">
${self.join("\n")}
</ul>
<p class="fine">${c.t(P.other.server, `${FLOWS} FLOW_COPY.other.server; backend/src/core/memory.js`)}</p>
<p>${c.h("<strong>No ads and no trackers.</strong> The app has no advertising and no third-party analytics or tracking code.", "package.json (no such dependency); public/legal/privacy.html (the short version, section 6); docs/MONETIZATION.md section 6; e2e/privacy.spec.mjs")} <a href="/legal/privacy.html">${c.t("Read the Privacy Policy", "public/legal/privacy.html")}</a></p>
</div>
</div>
</div>
</section>`;
}

/* Sentence case for an app sentence used mid-sentence ("Your phone shows…" → "your phone shows…"). */
const lower = (s) => s.charAt(0).toLowerCase() + s.slice(1);
/* The app's strings are plain text: escape them when they sit inside authored HTML. */
const escKeep = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function stages(ctx, c) {
  const { d } = ctx;
  const fertile = d.learn.fertile;
  const text = {
    cycle: ["Log periods and symptoms such as cramps, bloating and mood swings, and see your cycle day and the range of days your next period is likely to start.", "src/lib/constants.js PSYM; src/lib/home.js heroModel; src/lib/engine.js (the prediction is a range)"],
    ttc: [`An estimated fertile window, worked out from your past cycle lengths, with ovulation tests, cervical mucus and temperature to add detail. ${fertile[4]}`, "src/lib/learn.js LEARN fertile; src/lib/fertility.js; src/lib/signals.js"],
    preg: ["Your week and trimester from your due date, symptoms such as nausea and heartburn, a kick counter, and the usual prenatal visits to plan for.", "src/lib/home.js heroModel (preg); src/lib/constants.js GSYM, PRENATAL; src/locales/en-ui.js pregBody.kickCounter"],
    peri: ["Hot flashes, night sweats, brain fog and sleep, beside periods that are changing. Cycles vary more in perimenopause, so a prediction's range is wider.", "src/lib/constants.js SYM; src/screens/CalendarScreen.jsx (\"Cycles vary more in perimenopause, so the range is wider.\"); src/lib/engine.js"],
    meno: [`Symptoms, sleep and mood, with no cycle to predict. ${d.app.menoCalendar.replace(/^Logged days and any bleeding you note\. /, "")} Any bleeding you note is kept in your log.`, `${UI} cal.loggedDaysAndAnyBleeding; src/lib/home.js heroModel (meno)`],
  };
  return `<section class="band band-tint" id="stages" aria-labelledby="stages-h">
<div class="wrap">
<h2 id="stages-h">${c.t("Five life stages, one at a time", "src/lib/onboarding.js STAGE_CARDS, primaryStage (one experience per person)")}</h2>
<p class="lead">${c.h(`You choose the stage you are in, and the whole app is set up for it. <strong>One stage at a time.</strong> ${escKeep(d.app.oneStage.replace(/^One stage at a time\. /, ""))}`, `src/lib/onboarding.js primaryStage; ${UI} you.cyraIsShapedAroundOne`)}</p>
<ol class="stages">
${d.stages.map((s) => `<li class="stage" data-stage="${s.key}">
<div class="stage-art">${s.art}</div>
<h3>${c.t(s.label, "src/lib/onboarding.js STAGE_CARDS")}</h3>
<p class="stage-sub">${c.t(s.sub, "src/lib/onboarding.js STAGE_CARDS")}</p>
<p>${c.t(text[s.key][0], text[s.key][1])}</p>
</li>`).join("\n")}
</ol>
<p class="fine">${c.h("<strong>Living with PCOS?</strong> An optional module adds PCOS signals to My Cycle, Trying to conceive and Perimenopause.", "src/lib/modules.js (the pcos module); src/lib/onboarding.js (the PCOS question, cycle stages only); e2e/lib/onboard.mjs")}</p>
</div>
</section>`;
}

function features(ctx, c) {
  const { d } = ctx;
  const count = d.practices.length;
  const words = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
  const allFree = d.practices.every((p) => p.free);
  const affiliate = d.shop.affiliateCount > 0
    ? `Some product links are affiliate links, labelled "${d.shop.affiliateLabel}" in the app. ${d.shop.affiliateLine.replace("this link", "one")}`
    : `Some product links may be affiliate links, labelled "${d.shop.affiliateLabel}" in the app. ${d.shop.affiliateLine.replace("this link", "one")}`;
  const show = (id, shot, title, titleSrc, paras, flip = false) => `<div class="show${flip ? " show-flip" : ""}" id="${id}">
<div class="show-text">
<h3>${c.t(title, titleSrc)}</h3>
${paras.map(([html, src]) => `<p>${c.h(html, src)}</p>`).join("\n")}
</div>
<div class="show-art">
${phone(ctx, c, shot)}
</div>
</div>`;
  return `<section class="band" id="features" aria-labelledby="features-h">
<div class="wrap">
<h2 id="features-h">${c.t("What it does", LABEL)}</h2>
${show("f-log", "log", "A quick log, and a 30-second check-in", `${UI} splash.trackIn30SecondsA; src/screens/HomeScreen.jsx (Quick log)`, [
    [`<strong>Tap what you notice.</strong> Symptoms, sleep, mood, movement, medicines and notes each open from the plus button, along with your period in every stage except pregnancy. ${escKeep(d.logSheet)}`, `src/lib/routes.js LOG_ITEMS, logItemsFor; src/App.jsx (period: stage !== "preg"); ${UI} logSheet.oneTapOpensTheRight`],
    [`<strong>One reminder at most.</strong> ${escKeep(d.app.reminders.replace(/^You can change this anytime in Settings\. /, ""))}`, `${UI} onb.youCanChangeThisAnytime; src/lib/notifications.js`],
  ])}
${show("f-patterns", "patterns", "Patterns from your own log", "src/lib/patterns.js; src/lib/insights.js", [
    [`<strong>What tends to go together.</strong> ${escKeep(d.guide.patterns)}`, "src/lib/guide.js VIEW_HINTS.patterns"],
    ["<strong>Worked out on your device.</strong> Patterns, the weekly review and the cycle timeline are calculated on your device from what you logged; nothing is sent anywhere to make them.", "src/lib/patterns.js, src/lib/insights.js (pure: no network); docs/MONETIZATION.md section 2; e2e/privacy.spec.mjs"],
  ], true)}
${show("f-calendar", "calendar", "A calendar with honest predictions", `${UI} cal.loggedPeriodsPredictionsAndThe`, [
    [`<strong>A range, not a promise.</strong> ${escKeep(d.app.calendar)}`, `${UI} cal.loggedPeriodsPredictionsAndThe; src/screens/CalendarScreen.jsx`],
    [`<strong>${escKeep(d.home.sharpens)}</strong> Your next period is shown as a range of days. ${escKeep(d.learn.fertile[2])}`, "src/lib/home.js HERO_COPY.sharpens; src/lib/engine.js; src/lib/learn.js LEARN fertile"],
    [`<strong>Estimates, not contraception.</strong> ${escKeep(d.learn.fertile[4])}`, "src/screens/CalendarScreen.jsx (\"Estimates — not contraception.\"); src/lib/learn.js; src/lib/signals.js"],
  ])}
${show("f-report", "report", "A one-page summary for your doctor", "src/screens/ReportScreen.jsx (\"A one-page clinician summary, made on this device. Free, always.\"); e2e/smoke.spec.mjs (the PDF is one page)", [
    ["<strong>Made on your device.</strong> The Report turns your log into a one-page clinician summary you can download as a PDF. It is free, with or without Pro.", "src/screens/ReportScreen.jsx; src/lib/pdf.js; src/lib/trial.js (exports stay open after the free week); e2e/smoke.spec.mjs"],
    [`<strong>It goes only where you take it.</strong> You can print it, copy it or share it yourself. ${escKeep(d.privacy.copy.lines.files.replace(/^They go only where you save or send them\. /, "").replace("don't receive them", "don't receive it"))}`, `${FLOWS} FLOW_COPY.lines.files, FLOW_COPY.details.summary; src/screens/ReportScreen.jsx`],
  ], true)}
<div class="trio">
<div class="trio-item">
${iconChip(ctx, "watch")}
<h3>${c.t("Devices, if you want them", "src/lib/devices.js DEVICE_COPY")}</h3>
<p>${c.h(`<strong>Optional.</strong> ${escKeep(d.devices.lead.replace(/^Optional\. /, ""))}`, "src/lib/devices.js DEVICE_COPY.lead")}</p>
<p class="fine">${c.t("Apple Health and Health Connect are read on the phone, by the iPhone and Android apps: those readings are never sent to a server.", "src/lib/feedback.js helpItems (How do I connect a watch or ring?); src/lib/wearables.js; src/lib/devices.js")}</p>
</div>
<div class="trio-item">
${iconChip(ctx, "breath")}
<h3>${c.t("Guided practices", "src/lib/mind.js PRACTICES")}</h3>
<p>${c.h(`<strong>${cap(words[count] || String(count))} short practices${allFree ? ", all free" : ""}.</strong> ${escKeep(d.practices[0].title)}, ${escKeep(d.practices[2].title)}, a ${escKeep(lower(d.practices[9].title))} and more, each with an optional voice guide.`, "src/lib/mind.js PRACTICES (the count, the titles and free: true are read at build time); src/lib/voice.js; src/components/ProSheet.jsx FREE_KEEPS")}</p>
<p class="fine">${c.t(d.supportLine, "src/lib/mind.js SUPPORT_LINE")}</p>
</div>
<div class="trio-item">
${iconChip(ctx, "bag")}
<h3>${c.t("Shop by need", "src/lib/shop.js SHOP_COPY.eyebrow")}</h3>
<p>${c.h(`<strong>Matched on your device.</strong> Real products people often use at your stage, with an honest note on the evidence. Your stage and what you log are never sent.`, "src/lib/shop.js SHOP_COPY.lead (matching runs on the device; her stage and log are never sent)")}</p>
<p>${c.t(affiliate, "src/lib/shop.js SHOP_COPY.affiliate, AFFILIATE_LINE; src/config/affiliates.json (how many links are affiliate links is counted at build time); public/legal/privacy.html section 5")}</p>
<p class="fine">${c.t(d.shop.notAdvice, "src/lib/shop.js SHOP_COPY.notAdvice")}</p>
</div>
</div>
</div>
</section>`;
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function pro(ctx, c) {
  const { d } = ctx;
  return `<section class="band" id="pro" aria-labelledby="pro-h">
<div class="wrap">
<div class="pro">
<div class="pro-head">
<h2 id="pro-h">${c.t("What Pro adds", "src/components/ProSheet.jsx (the sheet's title)")}</h2>
<p class="lead">${c.h(`<strong>Pro is part of the iPhone and Android apps.</strong> ${escKeep(d.pricing.webOnly.replace(/^Pro is sold only in the iPhone and Android apps\. /, ""))}`, "src/lib/plans.js PLANS_COPY.webOnly; src/lib/purchase.js (no store on the web)")}</p>
</div>
<ul class="pro-list">
${d.pro.adds.map((a) => `<li>${iconChip(ctx, a.icon)}<p><strong>${c.t(a.title, "src/components/ProSheet.jsx proAddsFor (PRO_LOG, PRO_EVIDENCE, PRO_AI, PRO_MEAL)")}.</strong> ${c.t(a.body, "src/components/ProSheet.jsx proAddsFor; src/lib/plan.js PRO_PLAN")}</p></li>`).join("\n")}
</ul>
<p class="fine">${c.t("Each AI feature is off until you turn it on, and needs Solia Health's server.", "src/lib/features.js; src/lib/aiFeatures.js; src/components/ProSheet.jsx (\"the AI lines need the ai flag and a server\")")} ${c.t(d.pricing.freeKeeps, "src/components/ProSheet.jsx FREE_KEEPS_TRIAL; src/lib/trial.js")}</p>
</div>
</div>
</section>`;
}

function pricing(ctx, c) {
  const { d } = ctx;
  const p = d.pricing;
  const [yearly, monthly] = p.tiles;
  const during = p.duringFreeWeek.replace(/^You can subscribe now\. Your free week isn't extended: /, "");
  if (during === p.duringFreeWeek) throw new Error("[solia] src/lib/plans.js freeWeekLine changed its wording: update site/pages/home.mjs");
  const webFree = p.freeWeekHelp[0].replace(/^This version has/, "The web app has");
  if (webFree === p.freeWeekHelp[0]) throw new Error("[solia] src/lib/feedback.js helpItems (free-week) changed its wording: update site/pages/home.mjs");
  const tile = (t, terms) => `<li class="plan${t.best ? " plan-best" : ""}">
${t.best ? `<p class="plan-badge">${c.t(p.best, "src/lib/plans.js PLANS_COPY.best")}</p>` : ""}
<h3>${c.t(t.title, "src/lib/pricing.js planLines; src/lib/plans.js webTiles")}</h3>
<p class="plan-price">${c.t(t.price, "src/lib/pricing.js PRO_PRODUCTS (the US reference price); src/lib/plans.js webTiles")}</p>
${t.note ? `<p class="plan-note">${c.t(t.note, "src/lib/pricing.js perMonthOf; src/lib/plans.js webTiles")}</p>` : ""}
${t.trial ? `<p class="plan-trial">${c.t(cap(t.trial), "src/lib/plans.js PLANS_COPY.trialBadge; src/lib/pricing.js PRO_PRODUCTS.annual.trialDays; docs/STORE-SETUP.md")}</p>` : ""}
<p class="plan-terms">${c.t(terms, "src/lib/pricing.js planLines (terms), with the reference price")}</p>
</li>`;
  return `<section class="band band-tint" id="pricing" aria-labelledby="pricing-h">
<div class="wrap">
<h2 id="pricing-h">${c.t("Pricing", LABEL)}</h2>
<p class="lead">${c.t("A free week first, then Pro by the month or the year, in the iPhone and Android apps.", "src/lib/trial.js TRIAL_DAYS; src/lib/pricing.js PRO_PRODUCTS; docs/MONETIZATION.md sections 1a and 1c")}</p>
<ul class="plans">
<li class="plan">
<h3>${c.t("Free week", "src/lib/trial.js")}</h3>
<p class="plan-price">${c.t(`${p.trialDays} days free`, "src/lib/trial.js TRIAL_DAYS")}</p>
<p class="plan-note">${c.t("No card, and nothing to cancel.", "src/lib/trial.js (the week is counted on the device; no purchase is involved)")}</p>
<p class="plan-terms">${c.t(p.freeWeekHelp[1], "src/lib/feedback.js helpItems (How does the free week work?); src/lib/trial.js")}</p>
</li>
${tile(yearly, p.terms.annual)}
${tile(monthly, p.terms.monthly)}
</ul>
<ul class="terms">
<li>${c.h("<strong>These are reference prices.</strong> They are Solia Health's US prices as built into this version of the website. Prices are set by the App Store and Google Play and can differ by country; the app shows the store's own price before you subscribe.", "src/lib/pricing.js (header: on a phone only the store's price is shown, and the web names the US reference price); src/lib/plans.js planTiles; docs/STORE-SETUP.md")}</li>
<li>${c.h("<strong>It renews until you cancel.</strong> Each plan renews automatically at the end of its month or year.", "src/lib/pricing.js planLines (\"Renews every … until you cancel.\")")}</li>
<li>${c.h(`<strong>To cancel on iPhone.</strong> ${escKeep(p.cancel["app-store"])}`, "src/lib/pricing.js CANCEL_LINES.app-store")}</li>
<li>${c.h(`<strong>To cancel on Android.</strong> ${escKeep(p.cancel.play)}`, "src/lib/pricing.js CANCEL_LINES.play")}</li>
<li>${c.h(`<strong>Subscribing during the free week doesn't extend it.</strong> ${escKeep(cap(during))}`, "src/lib/plans.js freeWeekLine; src/lib/trial.js; src/lib/pricing.js PRO_PRODUCTS (trialDays)")}</li>
<li>${c.h(`<strong>Your log stays yours.</strong> ${escKeep(p.keep)}`, "src/lib/pricing.js KEEP_LINE; src/lib/trial.js")}</li>
<li>${c.h(`<strong>Nothing is sold on the web.</strong> ${escKeep(webFree)}`, "src/lib/plans.js PLANS_COPY.webOnly; src/lib/feedback.js helpItems (trialGate off: the web build); src/lib/trial.js (the gate is on only where she can pay)")}</li>
</ul>
</div>
</section>`;
}

function orgs(ctx, c) {
  const { d } = ctx;
  const mail = d.links.supportEmail;
  return `<section class="band" id="organizations" aria-labelledby="orgs-h">
<div class="wrap orgs">
<h2 id="orgs-h">${c.t("For clinics and employers", "src/lib/org.js; backend/src/modules/orgs/index.js")}</h2>
<div class="orgs-text">
<p>${c.h("<strong>A version in your own look.</strong> A clinic or employer can offer Solia Health under its own name, logo and colours, with the life stages and products it chooses. People join with an invite code or a link.", "src/lib/org.js (cleanOrgConfig, orgTheme, stageCardsFor); backend/src/modules/orgs/index.js; e2e/orgs.spec.mjs")}</p>
<p>${c.h("<strong>Totals only.</strong> The organization's admins see how many people joined, how many of them have an account or Pro, and joins per week. Any number under 10 shows as “fewer than 10”, and they never see a name, an email or anything a person logs.", "src/lib/org.js ORG_COPY.totals; backend/src/modules/orgs/stats.js (masked); backend/test/orgs-stats.test.mjs; e2e/portal-dashboard.spec.mjs")}</p>
${mail ? `<p>${c.h(`<strong>To set one up,</strong> write to <a href="${d.links.supportHref}">${escKeep(mail)}</a>.`, "src/lib/feedback.js SUPPORT_EMAIL (VITE_SUPPORT_EMAIL at build time)")}</p>` : ""}
</div>
</div>
</section>`;
}

function questions(ctx, c) {
  const { d } = ctx;
  const support = hrefFor(ctx, "support", null);
  const del = hrefFor(ctx, "delete-account", null);
  const q = (id, question, qSrc, body) => `<details class="q" id="${id}">
<summary><h3>${c.t(question, qSrc)}</h3>${d.icons.chevron}</summary>
<div class="q-body">
${body}
</div>
</details>`;
  const para = (html, src) => `<p>${c.h(html, src)}</p>`;
  return `<section class="band band-tint" id="questions" aria-labelledby="questions-h">
<div class="wrap narrow">
<h2 id="questions-h">${c.t("Questions", LABEL)}</h2>
${q("q-medical", "Is Solia Health a medical device, or a diagnosis?", "public/legal/medical-disclaimer.html", [
    para("<strong>No.</strong> Solia Health shows patterns from what you log and plain-language information. It does not diagnose, treat, cure or prevent any condition and does not replace your clinician. It has not been reviewed or cleared by the U.S. Food and Drug Administration.", "public/legal/medical-disclaimer.html (\"Solia Health is not a medical device\"); public/legal/terms.html"),
    `<p>${c.t(d.splash.guidance, `${UI} splash.guidanceNeverADiagnosisFor`)} <a href="/legal/medical-disclaimer.html">${c.t("Read the medical disclaimer", "public/legal/medical-disclaimer.html")}</a></p>`,
  ].join("\n"))}
${q("q-contraception", "Can I use it as birth control?", "src/lib/learn.js; public/legal/medical-disclaimer.html", [
    para(`<strong>No.</strong> ${escKeep(d.learn.fertile[4])} ${escKeep(d.learn.fertile[1])}`, "src/lib/learn.js LEARN fertile; src/lib/signals.js"),
    para("Period, ovulation and fertile-window predictions are estimates and can be wrong.", "public/legal/medical-disclaimer.html (\"Not for birth control\"); src/screens/CalendarScreen.jsx (\"Estimates — not contraception.\")"),
  ].join("\n"))}
${q("q-data", "Where is my data?", "src/lib/feedback.js helpItems (Where does my data live?)", [
    para(`<strong>On the device you use Solia Health on.</strong> On a phone it is kept in the app's own storage; on the web, in your browser's storage. ${escKeep(d.privacy.storeCopy)}`, "src/lib/storage.js; src/lib/disclosures.js storeCopyLine; src/lib/feedback.js helpItems"),
    para(escKeep(d.help.data.a[1]), "src/lib/feedback.js helpItems; src/lib/backup.js"),
    para("The phone apps and the web app each keep their own log.", "src/lib/storage.js (one record per app install or browser; no sync in the shipping features: src/lib/features.js DEFAULT_FEATURES.cloudBackup is false)"),
  ].join("\n"))}
${q("q-cancel", "How do I cancel?", "src/lib/feedback.js helpItems (How do I cancel Pro?)", [
    ...d.help.cancel.a.map((a) => para(escKeep(a), "src/lib/feedback.js helpItems (How do I cancel Pro?)")),
    para(`<strong>On iPhone.</strong> ${escKeep(d.pricing.cancel["app-store"])}`, "src/lib/pricing.js CANCEL_LINES.app-store"),
    para(`<strong>On Android.</strong> ${escKeep(d.pricing.cancel.play)}`, "src/lib/pricing.js CANCEL_LINES.play"),
    support ? `<p><a href="${support}">${c.t("More help on the Support page", LABEL)}</a></p>` : "",
  ].join("\n"))}
${q("q-delete", "How do I delete my account and data?", "src/lib/disclosures.js; src/lib/signin.js", [
    para(`<strong>In the app, at any time.</strong> You → Privacy &amp; your data → Delete everything erases your log on that device. ${escKeep(d.deletion.accountLine)}`, "src/components/DataControls.jsx (Delete everything); src/lib/youMenu.js (the page names); src/lib/disclosures.js ACCOUNT_DELETE_LINE, wipeConfirm; e2e/store-checks.spec.mjs"),
    para("To delete only the account and keep your log: You → Plan &amp; account → Delete account.", "src/components/AccountParts.jsx; src/lib/signin.js SIGNIN_COPY.deleteAcct; backend/src/modules/accounts/index.js (DELETE /api/accounts/me); e2e/store-checks.spec.mjs"),
    del ? `<p><a href="${del}">${c.t("What is deleted, and how to ask without the app", LABEL)}</a></p>` : "",
  ].join("\n"))}
${q("q-tracking", "Does the website track me?", "site/pages/layout.mjs CSP; src/lib/site.test.mjs", [
    para("<strong>No.</strong> These website pages set no cookies, keep nothing in your browser and load nothing from any other site: no analytics, no advertising pixels, and no fonts or scripts from elsewhere.", "site/pages/layout.mjs CSP (the browser refuses anything from another origin); src/lib/site.test.mjs and e2e/site.spec.mjs (fail on another origin, a cookie or stored data)"),
    para("The front page runs one small script. It looks, on your device, for a Solia Health log already in this browser so it can open the web app for you. It sends nothing.", "site/static/go.js; src/lib/site.test.mjs (go.js makes no request and stores nothing)"),
    para("<strong>The usual caveat.</strong> Like any web host, our hosting provider (Render) receives the usual request details when a page loads, such as your IP address and browser type.", "render.yaml (the site is a Render static site); public/legal/privacy.html (\"Every connection to our server\")"),
    para("The web app at /app/ is separate from these pages: it keeps your log in this browser, on your device.", "src/lib/storage.js; site/build/hosting.mjs APP_BASE"),
  ].join("\n"))}
</div>
</section>`;
}

export function homePage(ctx, c) {
  const { d } = ctx;
  const banner = d.links.appStoreId ? `<meta name="apple-itunes-app" content="app-id=${d.links.appStoreId}">\n` : "";
  return `${head(ctx, c, { title: HOME_TITLE, titleSource: HOME_SOURCE, description: HOME_DESCRIPTION, redirect: true, extra: banner + (ctx.headExtra?.home || "") })}
<body>
${header(ctx, c, { home: true })}
<main id="content">
${hero(ctx, c)}
${privacy(ctx, c)}
${stages(ctx, c)}
${features(ctx, c)}
${pro(ctx, c)}
${pricing(ctx, c)}
${orgs(ctx, c)}
${questions(ctx, c)}
</main>
${footer(ctx, c)}
</body>
</html>
`;
}

export const NOT_FOUND_TITLE = "Page not found · Solia Health";
export function notFoundPage(ctx, c) {
  return `${head(ctx, c, { title: NOT_FOUND_TITLE, description: { text: "This page doesn't exist.", source: LABEL }, noindex: true })}
<body>
${header(ctx, c)}
<main id="content">
<section class="band lone">
<div class="wrap narrow">
<h1>${c.t("This page doesn't exist", LABEL)}</h1>
<p class="lead">${c.t("The address may have changed. The web app is at /app/.", "site/build/hosting.mjs APP_BASE; render.yaml (unknown addresses get 404.html)")}</p>
<div class="cta">
<a class="btn btn-primary" href="/?site=1">${c.t("Go to the Solia Health website", LABEL)}</a>
<a class="btn btn-quiet" href="/app/">${c.t("Open the web app", "site/build/hosting.mjs APP_BASE: the web app is served at /app/")}</a>
</div>
</div>
</section>
</main>
${footer(ctx, c)}
</body>
</html>
`;
}
