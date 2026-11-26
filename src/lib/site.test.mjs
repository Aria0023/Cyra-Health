/* The website and the web app's address (docs/plans/website.md). Run with `npm run test:unit`.
   Task 1: the hosting rules the local server follows are the ones render.yaml gives Render; the retiring worker at
   /sw.js only deletes the old shell, unregisters and reloads; the one script on "/" asks nothing of a network and
   stores nothing; the phone build is not the web build.
   Task 2: the site's colours and faces are the app's tokens; prices, plan lines and privacy rows are the app's own
   strings; no page references another origin, sets a cookie or carries an inline script or style; every word a page
   shows is in the claims register with a source file that exists; the copy rules of the brief hold. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { APP_BASE, REWRITES, NO_CACHE, fileFor, rewriteFor } from "../../site/build/hosting.mjs";
import { nativeDistProblems } from "../../site/build/native-check.mjs";
import { renderPages, siteCss, siteFonts, siteContext, ASSETS } from "../../site/build/site.mjs";
import { loadAppData } from "../../site/build/app-data.mjs";
import { tokensCss } from "../../site/build/tokens.mjs";
import { claimsMarkdown, CLAIMS_FILE } from "../../site/build/claims.mjs";
import { LABEL, plain } from "../../site/pages/copy.mjs";
import { CSP } from "../../site/pages/layout.mjs";
import { PALETTES, SCHEME_TOKENS, STYLE_SHAPE, stagePalettes, RAMPS, RAMPS_DARK, SOFT_RAMP, FAMILIES } from "./constants.js";
import { PRO_PRODUCTS, KEEP_LINE, CANCEL_LINES } from "./pricing.js";
import { TRIAL_DAYS } from "./trial.js";
import { webTiles } from "./plans.js";
import { DEFAULT_FEATURES } from "./features.js";
import { FLOW_COPY } from "./privacyFlows.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

/* ---------- hosting ---------- */

test("render.yaml gives Render the rules the local server follows", () => {
  const yaml = read("render.yaml");
  const site = yaml.slice(yaml.indexOf("name: cyra-health"), yaml.indexOf("name: cyra-backend"));
  assert.match(site, /buildCommand: npm install && npm run build\n/);
  assert.match(site, /staticPublishPath: \.\/dist\n/);
  const routes = [...site.matchAll(/- type: rewrite\n\s+source: (\S+)\n\s+destination: (\S+)/g)].map(([, source, destination]) => ({ source, destination }));
  assert.deepEqual(routes, REWRITES.map((r) => ({ ...r })));
  assert.ok(!routes.some((r) => r.source === "/*"), "no catch-all rewrite: an unknown address is a 404");
  const headers = [...site.matchAll(/- path: (\S+)\n\s+name: Cache-Control\n\s+value: no-cache/g)].map((m) => m[1]);
  assert.deepEqual(headers.sort(), [...NO_CACHE].sort());
  for (const p of ["/index.html", "/sw.js", `${APP_BASE}index.html`, `${APP_BASE}sw.js`, `${APP_BASE}manifest.webmanifest`]) assert.ok(NO_CACHE.includes(p), `${p} is revalidated`);
});

test("fileFor and rewriteFor: files first, /app/* to the app, nothing climbs out", () => {
  assert.equal(fileFor("/"), "index.html");
  assert.equal(fileFor("/app/"), "app/index.html");
  assert.equal(fileFor("/legal/privacy.html"), "legal/privacy.html");
  assert.equal(fileFor("/support/"), "support/index.html");
  assert.equal(fileFor("/a%20b.txt"), "a b.txt");
  for (const bad of ["/../x", "/a/../../x", "/%2e%2e/x", "/a\0b", "x", "/%zz"]) assert.equal(fileFor(bad), null, bad);
  assert.equal(rewriteFor("/app/anything/here"), "/app/index.html");
  assert.equal(rewriteFor("/app/"), "/app/index.html");
  for (const p of ["/", "/nope", "/legal/nope.html", "/application", "/apps/x"]) assert.equal(rewriteFor(p), null, p);
});

test("the web build and the phone build are different commands, and Capacitor refuses the web build", () => {
  const pkg = JSON.parse(read("package.json"));
  assert.equal(pkg.scripts.build, "node scripts/build-web.mjs");
  assert.equal(pkg.scripts["build:native"], "vite build");
  assert.equal(pkg.scripts["cap:sync"], "npm run build:native && cap sync");
  assert.equal(pkg.scripts["capacitor:copy:before"], "node site/build/native-check.mjs");
  assert.equal(JSON.parse(read("capacitor.config.json")).webDir, "dist");
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "solia-native-"));
  try {
    assert.equal(nativeDistProblems(tmp).length, 1, "an empty folder is refused");
    fs.writeFileSync(path.join(tmp, "index.html"), '<!doctype html><body><div id="root"></div></body>');
    fs.mkdirSync(path.join(tmp, "legal")); fs.writeFileSync(path.join(tmp, "sw.js"), "");
    assert.deepEqual(nativeDistProblems(tmp), [], "the app at the root, with its legal pages and worker file: the phone build");
    fs.mkdirSync(path.join(tmp, "app")); fs.writeFileSync(path.join(tmp, "app", "index.html"), "");
    assert.deepEqual(nativeDistProblems(tmp), ["app/index.html belongs to the website"]);
    fs.mkdirSync(path.join(tmp, "site")); fs.writeFileSync(path.join(tmp, "404.html"), "");
    assert.deepEqual(nativeDistProblems(tmp), ["app/index.html belongs to the website", "site belongs to the website", "404.html belongs to the website"]);
    fs.writeFileSync(path.join(tmp, "index.html"), "<!doctype html><body><main></main></body>");
    assert.ok(nativeDistProblems(tmp).includes("index.html is not the app's page"));
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

/* ---------- the retiring worker (/sw.js) ---------- */

function loadRetiring() {
  const listeners = {};
  const log = { deleted: [], unregistered: 0, navigated: [], skipWaiting: 0, order: [] };
  const store = new Map([
    ["cyra-shell-old1", new Set(["/index.html", "/assets/index-old.js"])],
    ["cyra-shell-new1", new Set(["/app/index.html", "/app/assets/index-new.js"])],
    ["someone-elses", new Set(["/index.html"])],
  ]);
  const self = {
    addEventListener: (type, fn) => { listeners[type] = fn; },
    skipWaiting: () => { log.skipWaiting++; },
    registration: { unregister: async () => { log.unregistered++; log.order.push("unregister"); return true; } },
    clients: { matchAll: async (o) => { log.matchAll = o; return [{ url: "https://x.test/", navigate: async (u) => { log.navigated.push(u); log.order.push("navigate"); } }, { url: "https://x.test/app/", navigate: async () => { throw new Error("not controlled"); } }]; } },
  };
  const caches = {
    keys: async () => [...store.keys()],
    open: async (name) => ({ match: async (p) => (store.get(name)?.has(p) ? {} : undefined) }),
    delete: async (name) => { log.deleted.push(name); log.order.push("delete"); return store.delete(name); },
  };
  vm.runInNewContext(read("site/static/sw.js"), { self, caches });
  return { listeners, log, store };
}

test("the retiring worker deletes only the old shell's caches, unregisters, then reloads its pages", async () => {
  const w = loadRetiring();
  assert.deepEqual(Object.keys(w.listeners).sort(), ["activate", "install"], "no fetch, push or message handler");
  w.listeners.install({});
  assert.equal(w.log.skipWaiting, 1);
  let done;
  w.listeners.activate({ waitUntil: (p) => { done = p; } });
  await done;
  assert.deepEqual(w.log.deleted, ["cyra-shell-old1"], "the new app's cache and other caches stay");
  assert.equal(w.log.unregistered, 1);
  assert.deepEqual(w.log.navigated, ["https://x.test/"], "each page is reloaded at its own address; one that refuses is skipped");
  assert.deepEqual({ ...w.log.matchAll }, { type: "window" });
  assert.deepEqual(w.log.order, ["delete", "unregister", "navigate"]);
  const src = read("site/static/sw.js");
  assert.ok(!/indexedDB|fetch\(|\.put\(|importScripts|postMessage/.test(src), "it opens no database, fetches nothing and keeps nothing");
});

/* ---------- the script on "/" (go.js) ---------- */

/* A fake window for go.js: the address, display mode and IndexedDB contents are given; replace() and the wait flag are recorded. */
function runGo({ search = "", hash = "", standalone = false, iosStandalone = false, db = "none", noIdb = false } = {}) {
  const log = { replaced: null, wait: [], opened: [], aborted: 0, timers: [] };
  const root = { setAttribute: (k) => { log.wait.push(`+${k}`); }, removeAttribute: (k) => { log.wait.push(`-${k}`); } };
  const open = () => {
    const req = { transaction: { abort: () => { log.aborted++; } } };
    queueMicrotask(() => {
      if (db === "none") { req.onupgradeneeded?.(); req.onerror?.({ preventDefault() {} }); return; }
      const stores = db === "empty-db" ? [] : ["state"];
      const value = db === "record" ? { v: 1 } : undefined;
      req.result = {
        objectStoreNames: { contains: (n) => stores.includes(n) },
        close: () => { log.closed = true; },
        transaction: (name, mode) => { log.mode = mode; return { objectStore: () => ({ get: (key) => { log.key = key; const g = {}; queueMicrotask(() => { g.result = value; g.onsuccess?.(); }); return g; } }) }; },
      };
      req.onsuccess?.();
    });
    return req;
  };
  const window = {
    location: { search, hash, replace: (u) => { log.replaced = u; } },
    matchMedia: (q) => ({ matches: standalone && /display-mode: standalone/.test(q) }),
    navigator: { standalone: iosStandalone },
    setTimeout: (fn, ms) => { log.timers.push(ms); return 1; },
    indexedDB: noIdb ? undefined : { open: (name, version) => { log.opened.push([name, version]); return open(); } },
  };
  vm.runInNewContext(read("site/static/go.js"), { window, document: { documentElement: root } });
  return new Promise((resolve) => setTimeout(() => resolve(log), 5));
}

test("go.js: an existing record, an installed app or an app link goes to /app/ with the query and hash kept", async () => {
  assert.equal((await runGo({ db: "record" })).replaced, "/app/");
  assert.equal((await runGo({ db: "record", search: "?x=1", hash: "#pricing" })).replaced, "/app/?x=1#pricing");
  assert.equal((await runGo({ standalone: true })).replaced, "/app/");
  assert.equal((await runGo({ iosStandalone: true })).replaced, "/app/");
  assert.equal((await runGo({ hash: "#/you/privacy" })).replaced, "/app/#/you/privacy");
  assert.equal((await runGo({ hash: "#oauth=abc" })).replaced, "/app/#oauth=abc");
  assert.equal((await runGo({ search: "?org=lakeside" })).replaced, "/app/?org=lakeside");
  assert.equal((await runGo({ search: "?utm=x&org=lakeside", hash: "#/shop" })).replaced, "/app/?utm=x&org=lakeside#/shop");
  // an app link never waits for the database
  assert.deepEqual((await runGo({ hash: "#/you" })).opened, []);
});

test("go.js: a first-time visitor, ?site=1 and a browser without IndexedDB see the website", async () => {
  for (const db of ["none", "empty-db", "no-record"]) {
    const log = await runGo({ db });
    assert.equal(log.replaced, null, db);
    assert.deepEqual(log.wait, ["+data-wait", "-data-wait"], `${db}: hidden only while the record is looked up`);
  }
  assert.equal((await runGo({ db: "none" })).aborted, 1, "looking never creates the database");
  const kept = await runGo({ db: "record", search: "?site=1" });
  assert.equal(kept.replaced, null); assert.deepEqual(kept.opened, []); assert.deepEqual(kept.wait, []);
  assert.equal((await runGo({ db: "record", search: "?a=1&site=1", standalone: true, hash: "#/you" })).replaced, null, "?site=1 wins over everything");
  assert.equal((await runGo({ search: "?website=1", db: "none" })).replaced, null);
  const none = await runGo({ noIdb: true });
  assert.equal(none.replaced, null); assert.deepEqual(none.wait, []);
  const looked = await runGo({ db: "record" });
  assert.deepEqual(looked.opened, [["cyra", undefined]], "opened without a version, so nothing is upgraded");
  assert.equal(looked.key, "v1"); assert.equal(looked.mode, "readonly");
  assert.deepEqual(looked.timers, [700], "the page is shown after 700 ms whatever the database does");
});

test("go.js is the record's real address: the same database, store and key lib/storage.js uses", () => {
  const storage = read("src/lib/storage.js");
  assert.match(storage, /const DB = "cyra", STORE = "state", KEY = "v1"/);
  const go = read("site/static/go.js");
  for (const s of ['indexedDB.open("cyra")', '"state"', '.get("v1")']) assert.ok(go.includes(s), s);
  assert.ok(!/fetch\(|XMLHttpRequest|sendBeacon|document\.cookie|localStorage|sessionStorage|\.put\(|\.add\(|\.delete\(|createObjectStore|import\(/.test(go), "no request, no cookie, nothing stored or changed");
});

/* ---------- pages (Task 2) ---------- */

const D = await loadAppData();
const PAGES = renderPages(D);
const page = (rel) => PAGES.find((p) => p.rel === rel);
const HOME = page("index.html").html;
const CSS = siteCss(D);
const withLinks = (links) => renderPages({ ...D, links: { ...D.links, ...links } }).find((p) => p.rel === "index.html").html;

test("every site page is a complete, accessible document; only the front page loads go.js", () => {
  assert.ok(page("index.html") && page("404.html"));
  for (const { rel, html } of PAGES) {
    assert.match(html, /^<!doctype html>\n<html lang="en">/, rel);
    assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1">/, rel);
    assert.match(html, /<meta name="color-scheme" content="light dark">/, rel);
    assert.equal((html.match(/<h1[\s>]/g) || []).length, 1, `${rel}: one h1`);
    assert.equal((html.match(/<title>/g) || []).length, 1, `${rel}: one title`);
    assert.match(html, /<meta name="description" content="[^"]{10,}">/, rel);
    assert.match(html, /<a class="skip" href="#content">/, `${rel}: a skip link`);
    for (const landmark of ["<header", "<main id=\"content\">", "<nav", "<footer"]) assert.ok(html.includes(landmark), `${rel}: ${landmark}`);
    assert.equal(/<script src="\/site\/go\.js\?v=[0-9a-f]{10}"><\/script>/.test(html), rel === "index.html", `${rel}: go.js`);
    assert.ok(!html.includes("BUILD 2026.10.07-D"), `${rel}: the build stamp stays in the app, once`);
    // heading levels never skip one
    const levels = [...html.matchAll(/<h([1-6])[\s>]/g)].map((m) => Number(m[1]));
    levels.forEach((l, i) => assert.ok(i === 0 ? l === 1 : l <= levels[i - 1] + 1, `${rel}: h${l} after h${levels[i - 1]}`));
    // ids are unique and every in-page link has its target
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
    assert.equal(new Set(ids).size, ids.length, `${rel}: duplicate id`);
    for (const [, hash] of html.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.includes(hash), `${rel}: #${hash} has no target`);
  }
  const homeIds = [...HOME.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  for (const { rel, html } of PAGES) for (const [, hash] of html.matchAll(/href="\/\?site=1#([^"]+)"/g)) assert.ok(homeIds.includes(hash), `${rel}: /?site=1#${hash} has no target on the front page`);
});

test("the sections come in the brief's order", () => {
  const order = ["hero-h", "privacy-h", "stages-h", "features-h", "pro-h", "pricing-h", "orgs-h", "questions-h", "<footer"].map((id) => HOME.indexOf(id.startsWith("<") ? id : `id="${id}"`));
  assert.ok(order.every((i) => i > 0), "every section is there");
  assert.deepEqual([...order].sort((a, b) => a - b), order);
  const qs = ["q-medical", "q-contraception", "q-data", "q-cancel", "q-delete", "q-tracking"].map((id) => HOME.indexOf(`id="${id}"`));
  assert.ok(qs.every((i) => i > 0) && [...qs].sort((a, b) => a - b).every((v, i) => v === qs[i]), "the six questions, in order");
  for (const href of ["/legal/privacy.html", "/legal/health-data.html", "/legal/terms.html", "/legal/medical-disclaimer.html"]) { assert.ok(HOME.includes(`href="${href}"`), href); assert.ok(fs.existsSync(path.join(ROOT, "public", href)), `${href} exists`); }
  assert.match(HOME, /Consumer Health Data Privacy Policy<\/a> <span class="foot-note">\(Washington My Health My Data Act\)/);
  assert.ok(HOME.includes("© Solia Health"));
});

/* The claim "this website loads nothing from another origin and sets no cookie" (Questions → Does the website track me?). */
test("no page, stylesheet or script references another origin, sets a cookie, or carries inline script or style", () => {
  const sameOrigin = (u) => u.startsWith("/") && !u.startsWith("//");
  for (const { rel, html } of PAGES) {
    assert.ok(html.includes(`<meta http-equiv="Content-Security-Policy" content="${CSP}">`), `${rel}: the policy`);
    for (const m of html.matchAll(/<(link|script|img|source|iframe|video|audio|object|embed|form|use|image)\b[^>]*>/g)) {
      const tag = m[0];
      assert.ok(!/<(iframe|video|audio|object|embed|form)\b/.test(tag), `${rel}: ${tag}`);
      for (const [, attr, url] of tag.matchAll(/\s(href|src|srcset|action|data|poster)="([^"]*)"/g)) for (const u of url.split(",").map((x) => x.trim().split(/\s+/)[0])) assert.ok(sameOrigin(u), `${rel}: ${attr}="${u}" leaves this origin`);
    }
    for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) assert.ok(/\ssrc="\//.test(m[1]) && !m[2].trim() || /type="application\/ld\+json"/.test(m[1]), `${rel}: an inline script`);
    assert.ok(!/<style\b|\sstyle="|\son[a-z]+="|javascript:/i.test(html), `${rel}: inline style, an event attribute or a javascript: link`);
    assert.ok(!/http-equiv="(set-cookie|refresh)"/i.test(html), `${rel}: a cookie or refresh meta`);
    // a link that leaves the site is only ever a store page, set at build time
    for (const [, href] of html.matchAll(/<a\b[^>]*\shref="([^"]+)"/g)) assert.ok(sameOrigin(href) || href.startsWith("#") || href.startsWith("mailto:"), `${rel}: <a href="${href}">`);
  }
  for (const [, u] of CSS.matchAll(/url\(([^)]+)\)/g)) assert.ok(sameOrigin(u.replace(/["']/g, "")), `site.css: url(${u})`);
  assert.ok(!/@import/.test(CSS), "site.css imports nothing");
  assert.equal(CSP.includes("'unsafe-inline'") || CSP.includes("*") || /https?:/.test(CSP), false, "the policy allows this origin only");
  for (const d of ["default-src 'none'", "script-src 'self'", "style-src 'self'", "img-src 'self'", "font-src 'self'", "form-action 'none'", "base-uri 'none'"]) assert.ok(CSP.includes(d), d);
});

test("download buttons: unset says Coming soon and links nowhere; set links the store pages and adds Apple's banner", () => {
  assert.deepEqual(D.links, { appStore: "", playStore: "", appStoreId: "", supportEmail: "", supportHref: "" }, "the repository's defaults: nothing set");
  assert.ok(HOME.includes('<span class="soon">Coming soon to the App Store</span>') && HOME.includes('<span class="soon">Coming soon to Google Play</span>'));
  assert.ok(!/apps\.apple\.com|play\.google\.com|apple-itunes-app/.test(HOME));
  assert.match(HOME, /<a class="btn btn-primary" href="\/app\/">Open the web app<\/a>/);
  const set = withLinks({ appStore: "https://apps.apple.com/us/app/solia-health/id1234567890", playStore: "https://play.google.com/store/apps/details?id=com.cyrahealth.app", appStoreId: "1234567890" });
  assert.ok(set.includes('<a class="btn btn-primary" href="https://apps.apple.com/us/app/solia-health/id1234567890" rel="noopener">Get it on the App Store</a>'));
  assert.ok(set.includes('<a class="btn btn-primary" href="https://play.google.com/store/apps/details?id=com.cyrahealth.app" rel="noopener">Get it on Google Play</a>'));
  assert.ok(set.includes('<meta name="apple-itunes-app" content="app-id=1234567890">'));
  assert.ok(!set.includes("Coming soon"));
  const one = withLinks({ playStore: "https://play.google.com/store/apps/details?id=com.cyrahealth.app" });
  assert.ok(one.includes("Coming soon to the App Store") && one.includes("Get it on Google Play") && !one.includes("apple-itunes-app"));
  // the support address appears only when set
  assert.ok(!HOME.includes("mailto:"));
  assert.ok(withLinks({ supportEmail: "help@solia.example", supportHref: "mailto:help@solia.example?subject=Solia%20Health%20support" }).includes('<a href="mailto:help@solia.example?subject=Solia%20Health%20support">help@solia.example</a>'));
});

test("prices, plan lines and the cancel and keep lines are the app's own, never retyped", () => {
  const [yearly, monthly] = webTiles();
  for (const s of [yearly.price, yearly.note, monthly.price, KEEP_LINE, `${TRIAL_DAYS} days free`, "Best value"]) assert.ok(HOME.includes(s), s);
  assert.ok(HOME.includes(`${PRO_PRODUCTS.annual.ref} a year`) && HOME.includes(`${PRO_PRODUCTS.monthly.ref} a month`));
  for (const line of Object.values(CANCEL_LINES)) assert.ok(plain(HOME).includes(line), line);
  assert.ok(plain(HOME).includes(`Free for ${PRO_PRODUCTS.annual.trialDays} days, then ${PRO_PRODUCTS.annual.ref} a year. Renews every year until you cancel.`));
  assert.ok(plain(HOME).includes("Prices are set by the App Store and Google Play and can differ by country"));
  assert.ok(plain(HOME).includes("Nothing is sold on the web."));
  // no price is written in the site's own source: every "$" comes from the app's modules
  for (const f of ["site/pages/home.mjs", "site/pages/layout.mjs", "site/css/site.css"]) assert.ok(!/\$\d/.test(read(f)), `${f}: a price typed by hand`);
});

test("the privacy rows are the app's rows for the features this build ships, and nothing it doesn't ship is claimed", () => {
  const text = plain(HOME);
  assert.ok(text.includes("Your health log lives on your device."));
  for (const id of ["ai", "wearables", "remindersWeb", "files"]) assert.ok(text.includes(FLOW_COPY.lines[id]), `row ${id}`);
  for (const id of ["aiWeekly", "aiChat", "aiMeals", "feedback"]) assert.ok(text.includes(FLOW_COPY.short[id]), `row ${id}`);
  assert.equal(DEFAULT_FEATURES.counts, false); assert.equal(DEFAULT_FEATURES.cloudBackup, false);
  assert.ok(!text.includes(FLOW_COPY.lines.counts) && !text.includes(FLOW_COPY.lines.cloud) && !/weekly counts|cloud backup/i.test(text), "features the shipping build doesn't offer are not described");
  assert.ok(text.includes("Solia Health is not a contraceptive."));
  assert.ok(text.includes("Some product links may be affiliate links") && text.includes("Solia Health may earn a commission if you buy through one."), "the affiliate disclosure, true with no affiliate link configured");
  const some = renderPages({ ...D, shop: { ...D.shop, affiliateCount: 3 } }).find((p) => p.rel === "index.html").html;
  assert.ok(plain(some).includes("Some product links are affiliate links"));
});

test("copy rules: no testimonials, numbers of users, ratings, awards, outcome promises, HIPAA or age claims", () => {
  for (const { rel, html } of PAGES) {
    const text = plain(html.replace(/<head>[\s\S]*?<\/head>/, (h) => h.replace(/<(link|script)[^>]*>/g, "")));
    const banned = [/testimonial/i, /\b\d[\d,.]*\+?\s*(million|thousand|k)?\s*(users|women|people|downloads|reviews)\b/i, /★|⭐|\bstars?\b|\brated\b|\brating/i, /award/i, /as seen in|featured in/i,
      /clinically (proven|tested|validated)/i, /doctor[- ]recommended|recommended by (doctors|clinicians)/i, /HIPAA/i, /\bcures?\b(?! or prevent)/i, /guarantee/i, /\b(1[2-9]|21)\+|years? (old|of age)|\bminimum age|\bunder 1[38]\b|\bover 1[38]\b/i,
      /\byour (PCOS|endometriosis|infertility|condition|diagnosis|disease)\b/i, /#1|\bbest\b(?! value)|most accurate|most trusted|leading/i, /\bFDA[- ](approved|cleared)\b(?<!not been reviewed or cleared)/i];
    for (const re of banned) assert.ok(!re.test(text), `${rel}: ${re} matched "${(text.match(re) || [""])[0]}"`);
  }
  assert.ok(plain(HOME).includes("It has not been reviewed or cleared by the U.S. Food and Drug Administration."));
});

test("every word a page shows is in the claims register, and every source names a file that exists", () => {
  for (const { rel, html, claims } of PAGES) {
    // visible text, alt text and labels, and the head's title and description
    let rest = plain(html.replace(/<svg[\s\S]*?<\/svg>/g, " ")) + " " + [...html.matchAll(/\s(?:alt|aria-label|content)="([^"]*)"/g)].map((m) => plain(m[1])).join(" ");
    const technical = [CSP, "width=device-width, initial-scale=1", "light dark", "no-referrer", "noindex", D.tokens.palette.light.paper, D.tokens.palette.dark.paper];
    for (const t of technical) rest = rest.split(t).join(" ");
    for (const c of [...claims].sort((a, b) => b.text.length - a.text.length)) { assert.ok(c.text.length > 0, `${rel}: an empty claim`); rest = rest.split(c.text).join(" "); }
    assert.equal(rest.replace(/[\s.,;:()→]+/g, ""), "", `${rel}: text that is not in the register`);
    for (const c of claims) {
      if (c.source === LABEL) continue;
      for (const part of c.source.split(/; (?![^()]*\))/)) { // "; " between entries, not inside a note in brackets
        const file = part.split(/[ :,]/)[0];
        assert.ok(/^(src|backend|site|public|docs|e2e|scripts)\/|^(package\.json|render\.yaml|capacitor\.config\.json)$/.test(file), `${rel}: "${c.text.slice(0, 40)}…" names no file (${part})`);
        const exists = file.includes("*") ? fs.readdirSync(path.join(ROOT, path.dirname(file))).length > 0 : fs.existsSync(path.join(ROOT, file));
        assert.ok(exists, `${rel}: source ${file} does not exist ("${c.text.slice(0, 40)}…")`);
      }
    }
  }
  assert.equal(fs.readFileSync(CLAIMS_FILE, "utf8"), claimsMarkdown(D), "docs/plans/website-claims.md is out of date: run npm run site:claims");
});

/* ---------- the look (Task 2): the app's Soft tokens, not copies ---------- */

test("the site's colours are the app's Soft tokens, generated; site.css itself holds no colour", () => {
  const base = PALETTES.periods[0];
  const tokens = tokensCss(D.tokens);
  assert.equal(D.tokens.palette.id, "periwinkle");
  for (const k of ["primary", "accent", "paper", "card", "ink", "soft", "line"]) {
    assert.ok(tokens.includes(`--${k}:${base[k]}`), `light --${k}`);
    assert.ok(tokens.includes(`--${k}:${base.dark[k]}`), `dark --${k}`);
  }
  for (const scheme of ["light", "dark"]) for (const [k, v] of Object.entries(SCHEME_TOKENS[scheme])) assert.ok(tokens.includes(`${k}:${v}`), `${scheme} ${k}`);
  assert.equal(base.primary, SCHEME_TOKENS.light["--brand"], "the site's palette is the brand's colour");
  assert.ok(tokens.includes(`--ff-display:${STYLE_SHAPE.soft["--ff-display"]}`) && tokens.includes(`--ff-body:${STYLE_SHAPE.soft["--ff-body"]}`));
  assert.match(tokens, /@media \(prefers-color-scheme:dark\)\{:root\{/);
  // each life stage wears the palette the app gives it
  const stage = { cycle: stagePalettes("periods", "My Cycle")[0], ttc: stagePalettes("periods", "Trying to Conceive")[0], preg: stagePalettes("preg", "Pregnancy")[0], peri: stagePalettes("peri", "Perimenopause")[0], meno: stagePalettes("peri", "Menopause")[0] };
  for (const [k, p] of Object.entries(stage)) { assert.ok(tokens.includes(`[data-stage="${k}"]{--primary:${p.primary};--accent:${p.accent}}`), k); assert.ok(tokens.includes(`[data-stage="${k}"]{--primary:${p.dark.primary};--accent:${p.dark.accent}}`), `${k} dark`); }
  assert.notEqual(stage.meno.primary, stage.peri.primary, "Menopause wears the soft teal, Perimenopause the lavender");
  // the hand-written stylesheet: tokens only
  const own = read("site/css/site.css").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.deepEqual(own.match(/#[0-9a-fA-F]{3,8}\b|\b(rgb|rgba|hsl|hsla|oklch|oklab|lab|lch)\(/g) || [], [], "a colour literal in site/css/site.css");
  assert.deepEqual(own.match(/\b(white|black|red|blue|green|gray|grey|purple|pink|orange|yellow|navy|teal|silver|gold|beige|ivory|lavender|coral|salmon|crimson|indigo|violet|magenta|cyan|maroon|olive|lime|aqua|fuchsia|tan|khaki|plum|orchid|peru|sienna|snow|linen)\b(?=[^-{]*[;}])/g) || [], [], "a named colour in site/css/site.css");
  // UI palettes and data-viz ramps stay separate: no ramp or family colour reaches the site
  const viz = new Set([...Object.values(RAMPS), ...Object.values(RAMPS_DARK)].flat(Infinity).concat(SOFT_RAMP.light, SOFT_RAMP.dark, FAMILIES.flatMap((f) => Object.values(f).filter((v) => typeof v === "string" && v.startsWith("#")))).map((v) => String(v).toLowerCase()));
  const used = new Set((CSS.match(/#[0-9a-fA-F]{6}\b/g) || []).map((v) => v.toLowerCase()));
  const ui = new Set([...Object.values(PALETTES).flat().flatMap((p) => [...Object.values(p), ...Object.values(p.dark)]), ...Object.values(SCHEME_TOKENS.light), ...Object.values(SCHEME_TOKENS.dark)].filter((v) => typeof v === "string").flatMap((v) => v.match(/#[0-9a-fA-F]{6}\b/g) || []).map((v) => v.toLowerCase()));
  for (const c of used) assert.ok(ui.has(c), `${c} in the site's CSS is not a UI token`);
  for (const c of used) assert.ok(!viz.has(c) || ui.has(c), `${c} is a data-viz colour`);
  assert.ok(!/--ramp-|--fam-/.test(CSS));
});

test("the faces are the app's own font files, served by the site itself", () => {
  const { css, files } = siteFonts();
  assert.deepEqual(files.map((f) => f.name).sort(), ["fraunces-latin-ext-opsz-normal.woff2", "fraunces-latin-opsz-normal.woff2", "karla-latin-ext-wght-normal.woff2", "karla-latin-wght-normal.woff2"]);
  for (const f of files) assert.ok(fs.statSync(f.from).size > 1000, f.name);
  assert.equal((css.match(/@font-face/g) || []).length, 4);
  assert.ok(css.includes("font-family: 'Fraunces Variable'") && css.includes("font-family: 'Karla Variable'"));
  assert.ok(STYLE_SHAPE.soft["--ff-display"].startsWith("'Fraunces Variable'") && STYLE_SHAPE.soft["--ff-body"].startsWith("'Karla Variable'"), "the same family names the app's tokens ask for");
  for (const [, u] of css.matchAll(/url\(([^)]+)\)/g)) assert.ok(u.startsWith(`${ASSETS}fonts/`) && files.some((f) => u.endsWith(f.name)), u);
  const main = read("src/main.jsx");
  assert.ok(main.includes("@fontsource-variable/fraunces/opsz.css") && main.includes("@fontsource-variable/karla/index.css"), "the same packages the app imports");
  for (const p of siteContext(D).assets.preload) assert.ok(files.some((f) => p.endsWith(f.name)), p);
  for (const f of ["OFL-Fraunces.txt", "OFL-Karla.txt"]) assert.ok(fs.existsSync(path.join(ROOT, "public", "fonts", f)), `${f}: the licence text ships with the app`);
});

test("screenshots are committed, sized and described; the stage illustrations and icons are the app's", () => {
  const shots = JSON.parse(read("site/img/shots.json"));
  const used = [...HOME.matchAll(/<img src="\/site\/img\/([^"]+)" width="(\d+)" height="(\d+)" alt="([^"]+)"/g)];
  assert.equal(used.length, 5, "five phones on the front page");
  assert.equal((HOME.match(/<img\b/g) || []).length, used.length, "every img has src, width, height and alt");
  for (const [, file, w, h, alt] of used) {
    const s = Object.values(shots).find((x) => x.light === file);
    assert.ok(s, file);
    assert.deepEqual([Number(w), Number(h)], [s.width, s.height]);
    assert.ok(alt.length > 40 && /example data/.test(alt), `${file}: the alt text says what is shown and that the data is an example`);
    for (const f of [s.light, s.dark]) { const b = fs.readFileSync(path.join(ROOT, "site", "img", f)); assert.equal(b.subarray(0, 4).toString(), "RIFF"); assert.equal(b.subarray(8, 12).toString(), "WEBP"); assert.ok(b.length < 120_000, `${f} is ${b.length} bytes`); }
    assert.ok(HOME.includes(`<source media="(prefers-color-scheme: dark)" srcset="/site/img/${s.dark}">`), `${file}: its dark twin`);
  }
  assert.equal((HOME.match(/fetchpriority="high"/g) || []).length, 1, "only the first phone loads eagerly");
  assert.equal((HOME.match(/loading="lazy"/g) || []).length, 4);
  assert.deepEqual([...HOME.matchAll(/<li class="stage" data-stage="([a-z]+)">/g)].map((m) => m[1]), ["cycle", "ttc", "preg", "peri", "meno"]);
  assert.deepEqual([...HOME.matchAll(/<svg class="stageart" data-art="([a-z]+)"/g)].map((m) => m[1]), ["cycle", "ttc", "preg", "peri", "meno"], "StageArt, rendered from src/components/StageArt.jsx");
  assert.ok(HOME.includes('<svg class="brandmark" aria-hidden="true"'));
  assert.ok(!/<svg(?![^>]*aria-hidden="true")/.test(HOME), "every drawing is decorative: the words beside it carry the meaning");
});
