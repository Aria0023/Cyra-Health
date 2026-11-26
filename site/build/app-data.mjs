/* Everything the website says that the app already knows, read from the app's own modules at build time
   (docs/plans/website.md Task 2: "generate or import so the site and the app cannot drift"). The modules are loaded through
   Vite (the same config and the same environment files as the app's production build), so prices, plan lines, privacy
   rows, the stage illustrations, the icons and the palette tokens are the app's, not copies of them.
   Returns plain data only: strings, numbers and static SVG markup. */
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/** The five life stages, in the registration's order, with the art key and the palette each one wears in the app. */
const STAGES = [
  { key: "cycle", card: "My Cycle", stage: "periods", stageName: "My Cycle" },
  { key: "ttc", card: "Trying to conceive", stage: "periods", stageName: "Trying to Conceive" },
  { key: "preg", card: "Pregnant", stage: "preg", stageName: "Pregnancy" },
  { key: "peri", card: "Perimenopause", stage: "peri", stageName: "Perimenopause" },
  { key: "meno", card: "Menopause & beyond", stage: "peri", stageName: "Menopause" },
];
const ICONS = ["lock", "shield", "clock", "chart", "clipboard", "calendar", "watch", "breath", "bag", "sparkle", "book", "note", "bowl", "check", "bell", "share", "user", "heart", "chevron", "download"];

/** The website's own public address, for canonical links, sharing cards and the sitemap: VITE_SITE_URL when set (a
    custom domain), else the address Render gives the static site at build time (RENDER_EXTERNAL_URL), else "" (then no
    absolute address is written anywhere). An https origin only; a path, query or anything else is dropped. */
export function siteUrl(...candidates) {
  for (const v of candidates) {
    const s = String(v || "").trim();
    try { const u = new URL(s); if (u.protocol === "https:" && u.hostname.includes(".")) return u.origin; } catch { /* not an address */ }
  }
  return "";
}

/* This helper server only loads modules for Node (ssrLoadModule); it serves no browser, so it needs no dependency
   pre-bundling. The React plugin asks for some anyway; without this, closing the server can cancel that work mid-way and
   esbuild prints "The build was canceled" into the build log. */
const noPrebundle = { name: "solia-site-no-prebundle", enforce: "post", configResolved(c) { c.optimizeDeps.noDiscovery = true; c.optimizeDeps.include = []; } };

let cached = null;

/** Loads the app's modules once per process. `env` is extra environment for the load (tests pin store links with it). */
export async function loadAppData() {
  if (cached) return cached;
  const { createServer, loadEnv } = await import("vite");
  const React = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const vite = await createServer({ root: ROOT, mode: "production", appType: "custom", logLevel: "silent" /* a module that fails to load still throws below; this only hides Vite's note when the helper server closes */, server: { middlewareMode: true, hmr: false, watch: null }, optimizeDeps: { noDiscovery: true, include: [] }, plugins: [noPrebundle] });
  try {
    const load = (p) => vite.ssrLoadModule(p);
    const [constants, pricing, plans, trial, pro, features, flows, taps, feedback, links, disclosures, signin, shop, devices, learn, home, guide, onboarding, mind, org, art, icon, brand, purchase, ui] = await Promise.all([
      "/src/lib/constants.js", "/src/lib/pricing.js", "/src/lib/plans.js", "/src/lib/trial.js", "/src/components/ProSheet.jsx", "/src/lib/features.js",
      "/src/lib/privacyFlows.js", "/src/lib/shopTaps.js", "/src/lib/feedback.js", "/src/lib/links.js", "/src/lib/disclosures.js", "/src/lib/signin.js",
      "/src/lib/shop.js", "/src/lib/devices.js", "/src/lib/learn.js", "/src/lib/home.js", "/src/lib/guide.js", "/src/lib/onboarding.js", "/src/lib/mind.js",
      "/src/lib/org.js", "/src/components/StageArt.jsx", "/src/components/Icon.jsx", "/src/components/BrandMark.jsx", "/src/lib/purchase.js", "/src/locales/en-ui.js",
    ].map(load));
    const svg = (C, props) => renderToStaticMarkup(React.createElement(C, props));
    const F = features.DEFAULT_FEATURES;
    const en = ui.default || ui.EN_UI || Object.values(ui)[0];
    const t = (k) => { const v = en[k]; if (typeof v !== "string") throw new Error(`[solia] the app has no string "${k}" any more: update the website`); return v; };
    const tiles = plans.webTiles();
    const affiliates = JSON.parse(fs.readFileSync(path.join(ROOT, "src", "config", "affiliates.json"), "utf8"));
    const legalDraft = fs.readdirSync(path.join(ROOT, "public", "legal")).filter((f) => f.endsWith(".html")).some((f) => /class="draft"/.test(fs.readFileSync(path.join(ROOT, "public", "legal", f), "utf8")));
    const palette = (s) => { const p = constants.stagePalettes(s.stage, s.stageName)[0]; return { light: { primary: p.primary, accent: p.accent }, dark: { primary: p.dark.primary, accent: p.dark.accent } }; };
    const base = constants.PALETTES.periods[0];
    const pick = (o, keys) => Object.fromEntries(keys.map((k) => [k, o[k]]));
    const PALETTE_KEYS = ["primary", "accent", "paper", "card", "ink", "soft", "line"];
    cached = {
      tokens: {
        palette: { light: pick(base, PALETTE_KEYS), dark: pick(base.dark, PALETTE_KEYS), id: base.id },
        scheme: { light: { ...constants.SCHEME_TOKENS.light }, dark: { ...constants.SCHEME_TOKENS.dark } },
        shape: { ...constants.STYLE_SHAPE.soft },
        stages: Object.fromEntries(STAGES.map((s) => [s.key, palette(s)])),
      },
      stages: STAGES.map((s) => ({ key: s.key, label: s.card, sub: onboarding.STAGE_CARDS.find(([l]) => l === s.card)[1], art: svg(art.default, { k: s.key }) })),
      icons: Object.fromEntries(ICONS.map((name) => [name, svg(icon.default, { name, size: 22 })])),
      brandMark: svg(brand.default, { size: 40 }),
      features: { ...F },
      splash: { slogan: t("splash.slogan"), track: t("splash.trackIn30SecondsA"), patterns: t("splash.seeYourRealPatterns"), evidence: t("splash.walkIntoAppointmentsWithEvidence"), privacyTitle: t("splash.yourPrivacyPlainly"), privacy: t("splash.yourHealthLogLivesOn"), guidance: t("splash.guidanceNeverADiagnosisFor") },
      logSheet: t("logSheet.oneTapOpensTheRight"), supportLine: mind.SUPPORT_LINE,
      app: { oneStage: t("you.cyraIsShapedAroundOne"), reminders: t("onb.youCanChangeThisAnytime"), calendar: t("cal.loggedPeriodsPredictionsAndThe"), menoCalendar: t("cal.loggedDaysAndAnyBleeding") },
      pricing: {
        tiles, trialDays: trial.TRIAL_DAYS, keep: pricing.KEEP_LINE, cancel: { ...pricing.CANCEL_LINES }, webOnly: plans.PLANS_COPY.webOnly, best: plans.PLANS_COPY.best,
        terms: Object.fromEntries(["annual", "monthly"].map((id) => { const ref = pricing.PRO_PRODUCTS[id].ref; return [id, pricing.planLines(id, { priceString: ref, price: Number(ref.replace(/[^\d.]/g, "")) }).terms]; })),
        duringFreeWeek: plans.freeWeekLine({ where: "store", daysLeft: 1, tiles }),
        freeWeekHelp: feedback.helpItems({ trialGate: false }).find((i) => i.id === "free-week").a,
        freeKeeps: pro.FREE_KEEPS_TRIAL,
      },
      pro: { adds: pro.proAddsFor(!!F.ai, !!F.cloudBackup, true).map(([ic, title, body]) => ({ icon: ic, title, body })) },
      privacy: {
        copy: { intro: flows.FLOW_COPY.intro, label: flows.FLOW_COPY.label, names: { ...flows.FLOW_COPY.names }, lines: { ...flows.FLOW_COPY.lines }, short: { ...flows.FLOW_COPY.short }, other: { ...flows.FLOW_COPY.other }, states: { ...flows.FLOW_COPY.states }, summary: flows.FLOW_COPY.details.summary, backupLocked: flows.FLOW_COPY.details.backupLocked },
        whoKnows: purchase.STORE_LINES.whoKnows, restoreNone: purchase.STORE_LINES.restoredNone,
        org: { privacy: org.ORG_COPY.privacy, totals: org.ORG_COPY.totals, joinWhat: org.ORG_COPY.joinWhat },
        storeCopy: disclosures.storeCopyLine(false),
      },
      help: Object.fromEntries(feedback.helpItems({ trialGate: false, native: true, server: true, wearables: !!F.wearables, deviceSync: !!F.deviceSync, accounts: !!F.cloudBackup }).map((i) => [i.id, i])),
      deletion: {
        wipeWeb: disclosures.wipeConfirm(F, false, false).trim(), wipePhone: disclosures.wipeConfirm(F, true, false).trim(),
        moreWeb: disclosures.wipeMore(F, false), morePhone: disclosures.wipeMore(F, true),
        accountLine: disclosures.ACCOUNT_DELETE_LINE,
        account: signin.SIGNIN_COPY.deleteBody, accountButton: signin.SIGNIN_COPY.deleteAcct, accountConfirm: signin.SIGNIN_COPY.deleteGo,
        cantPullBack: disclosures.consentDetails(F, true).find((l) => l.startsWith("Deleting can't pull back")) || null,
      },
      shop: { lead: shop.SHOP_COPY.lead(true), privacy: shop.SHOP_COPY.privacy, notAdvice: shop.SHOP_COPY.notAdvice, affiliateLabel: shop.SHOP_COPY.affiliate, affiliateLine: shop.AFFILIATE_LINE, affiliateCount: Object.entries(affiliates).filter(([k, v]) => !k.startsWith("_") && (typeof v === "string" ? v : v && v.url)).length, tapName: taps.TAP_COPY.name, tapLine: taps.TAP_COPY.line },
      devices: { lead: devices.DEVICE_COPY.lead },
      learn: { fertile: learn.LEARN.find((e) => e.id === "fertile").body },
      home: { sharpens: home.HERO_COPY.sharpens },
      guide: { patterns: guide.VIEW_HINTS.patterns },
      practices: mind.PRACTICES.map((p) => ({ title: p.title, free: p.free === true })),
      symptoms: { peri: Object.values(constants.SYM), cycle: Object.values(constants.PSYM), preg: Object.values(constants.GSYM) },
      links: { appStore: links.APP_STORE_URL, playStore: links.PLAY_STORE_URL, appStoreId: links.APP_STORE_ID, supportEmail: feedback.SUPPORT_EMAIL, supportHref: feedback.supportHref(feedback.SUPPORT_EMAIL) },
      legalDraft,
      feedback: { send: feedback.FEEDBACK_COPY.sendFeedback, problem: feedback.FEEDBACK_COPY.reportProblem, warn: feedback.FEEDBACK_COPY.warn, line: feedback.FEEDBACK_COPY.flowLine },
      store: { restoreWeb: purchase.STORE_LINES.restoreWeb, restoredNone: purchase.STORE_LINES.restoredNone },
      site: { url: siteUrl(loadEnv("production", ROOT, "VITE_").VITE_SITE_URL, process.env.RENDER_EXTERNAL_URL) },
    };
    return cached;
  } finally { await vite.close(); }
}
