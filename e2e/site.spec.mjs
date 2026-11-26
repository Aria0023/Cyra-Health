/* The website (docs/plans/website.md Task 2). What the page tells a visitor about itself has to be true in a real
   browser: it asks no other origin for anything, sets no cookie, keeps nothing, and creates no database or worker; its
   own strict policy blocks nothing it needs. Plus the basics a marketing page must not get wrong: one h1, landmarks, a
   skip link, sized pictures that load, 44px targets, no sideways scroll, links that go somewhere. */
import { test, expect } from "@playwright/test";
import { SITE_PAGES, WIDTHS, openSitePage } from "./lib/site.mjs";
import { SITE_ADDRESS } from "./lib/serve.mjs";

const SITE = () => process.env.E2E_SITE_URL;

for (const width of WIDTHS) {
  test(`at ${width}px: no request leaves this origin, no cookie, nothing stored, nothing blocked; pictures, targets and layout hold`, async ({ page, context }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 800 });
    const origin = new URL(SITE()).origin;
    const requests = [], errors = [], setCookie = [];
    page.on("request", (r) => { if (!r.url().startsWith("data:")) requests.push(r.url()); });
    page.on("response", (r) => { if (r.headers()["set-cookie"]) setCookie.push(r.url()); });
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
    page.on("pageerror", (e) => errors.push(String(e)));
    for (const p of SITE_PAGES) {
      errors.length = 0;
      await openSitePage(page, p);
      // 404 answers log "Failed to load resource" for the page itself: that is the page's own status, not a blocked file
      expect(errors.filter((e) => !(p.status === 404 && /404/.test(e))), `${p.id}: console errors (a policy violation shows here)`).toEqual([]);
      // structure
      await expect(page.locator("h1")).toHaveCount(1);
      for (const role of ["banner", "main", "contentinfo"]) await expect(page.getByRole(role)).toHaveCount(1);
      expect(await page.getByRole("navigation").count()).toBeGreaterThanOrEqual(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `${p.id}: no sideways scroll`).toBe(true);
      // every picture loaded at its declared shape
      const pics = await page.evaluate(() => [...document.images].map((i) => ({ src: i.currentSrc, ok: i.complete && i.naturalWidth > 0, ratio: i.naturalWidth / i.naturalHeight, attr: Number(i.getAttribute("width")) / Number(i.getAttribute("height")), alt: i.alt })));
      for (const pic of pics) { expect(pic.ok, pic.src).toBe(true); expect(Math.abs(pic.ratio - pic.attr), `${pic.src}: width/height match the file`).toBeLessThan(0.01); expect(pic.alt.length).toBeGreaterThan(20); }
      // targets: every button-like link, nav link, footer link and question is at least 44px tall
      const small = await page.evaluate(() => [...document.querySelectorAll(".btn, .top-nav a, .foot-nav a, .brand, summary")].filter((el) => el.offsetParent !== null).map((el) => ({ text: el.textContent.trim().slice(0, 30), h: Math.round(el.getBoundingClientRect().height) })).filter((x) => x.h < 44));
      expect(small, `${p.id}: targets under 44px`).toEqual([]);
      // the faces really are Fraunces and Karla, from this origin
      const faces = await page.evaluate(() => ({ h1: getComputedStyle(document.querySelector("h1")).fontFamily, body: getComputedStyle(document.body).fontFamily, loaded: [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family.replace(/["']/g, "")) }));
      expect(faces.h1).toContain("Fraunces Variable"); expect(faces.body).toContain("Karla Variable");
      expect(faces.loaded).toEqual(expect.arrayContaining(["Fraunces Variable", "Karla Variable"]));
    }
    // the claims of "Does the website track me?"
    expect(requests.filter((u) => !u.startsWith(origin)), "requests to another origin").toEqual([]);
    expect(setCookie, "responses that set a cookie").toEqual([]);
    expect(await context.cookies(), "cookies").toEqual([]);
    expect(await page.evaluate(() => [localStorage.length, sessionStorage.length, document.cookie])).toEqual([0, 0, ""]);
    expect(await page.evaluate(async () => (await indexedDB.databases()).length), "no database").toBe(0);
    expect(await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length), "no worker").toBe(0);
    expect(await page.evaluate(async () => (await caches.keys()).length), "no cache").toBe(0);
  });
}

test("the front page: skip link, section links, questions by keyboard, every link goes somewhere, the web app opens", async ({ page, request }) => {
  await openSitePage(page, SITE_PAGES[0]);
  // the skip link is the first stop and lands on the content
  await page.keyboard.press("Tab");
  await expect(page.locator(".skip")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#content$/);
  // the store lines are text, not links, while no store address is set
  await expect(page.locator(".hero .soon")).toHaveText(["Coming soon to the App Store", "Coming soon to Google Play"]);
  await expect(page.locator('.hero a[href*="apple.com"], .hero a[href*="google.com"]')).toHaveCount(0);
  // a question opens and closes from the keyboard
  const q = page.locator("#q-tracking");
  await expect(q).not.toHaveAttribute("open", "");
  await q.locator("summary").focus();
  await page.keyboard.press("Enter");
  await expect(q).toHaveAttribute("open", "");
  await expect(q).toContainText("These website pages set no cookies, keep nothing in your browser and load nothing from any other site");
  await expect(q).toContainText("our hosting provider (Render) receives the usual request details when a page loads, such as your IP address and browser type");
  await page.keyboard.press("Enter");
  await expect(q).not.toHaveAttribute("open", "");
  // the pricing is the app's
  await expect(page.locator("#pricing .plan-price")).toHaveText(["7 days free", "$100 a year", "$9.95 a month"]);
  await expect(page.locator("#pricing")).toContainText("Prices are set by the App Store and Google Play and can differ by country");
  await expect(page.locator("#pricing")).toContainText("If Pro ends, nothing you logged is changed or deleted, and you can always open, export or delete it.");
  // every link on every page answers
  const seen = new Set();
  for (const p of SITE_PAGES) {
    await openSitePage(page, p);
    // (the canonical link names the site's public address and is never fetched)
    const hrefs = await page.evaluate(() => [...document.querySelectorAll('a[href], link[href]:not([rel="canonical"]), script[src], img[src], source[srcset]')].map((el) => el.getAttribute("href") || el.getAttribute("src") || el.getAttribute("srcset")));
    for (const h of hrefs) if (!h.startsWith("#") && !h.startsWith("mailto:")) seen.add(h.split("#")[0]);
  }
  for (const h of seen) { expect(h.startsWith("/"), `${h} stays on this site`).toBe(true); expect((await request.get(`${SITE()}${h}`)).status(), h).toBe(200); }
  // "Open the web app" is the app
  await openSitePage(page, SITE_PAGES[0]);
  await page.locator(".hero").getByRole("link", { name: "Open the web app" }).click();
  await expect(page).toHaveURL(`${SITE()}/app/`);
  await expect(page.getByRole("button", { name: "Get started" })).toBeVisible();
});

/* Task 3: the store and law pages, and what search engines and sharing cards are told. */
test("support and delete-account: the real steps, the support address only when it is set, what is kept and for how long", async ({ page }) => {
  const byId = (id) => SITE_PAGES.find((p) => p.id === id);
  // this bundle has a support address (e2e/lib/serve.mjs BUILD_ENV)
  await openSitePage(page, byId("support"));
  await expect(page.locator("#help ~ p").first()).toContainText("Write to us.");
  await expect(page.getByRole("link", { name: "help@solia.example" })).toHaveAttribute("href", "mailto:help@solia.example?subject=Solia%20Health%20support");
  await expect(page.locator("main")).toContainText("Cancel any time in Settings → your name → Subscriptions.");
  await expect(page.locator("main")).toContainText("Cancel any time in Google Play → Payments & subscriptions → Subscriptions.");
  await expect(page.locator("main")).toContainText("Open You → Plan & account and tap Restore purchases.");
  await expect(page.locator("main")).toContainText("call your local emergency number (911 in the United States)");
  await openSitePage(page, byId("delete-account"));
  await expect(page.locator("#account + ol li")).toHaveText(["Open Solia Health and tap You.", "Open Plan & account.", "Tap Delete account, then Delete my account."]);
  await expect(page.locator("#everything + ol li")).toHaveText(["Open Solia Health and tap You.", "Open Privacy & your data.", "Tap Delete everything and confirm."]);
  for (const s of ["It is deleted 365 days after it arrived.", "kept 400 days", "Deleting your account does not cancel Pro.", "At once. When you confirm, Solia Health's server removes the account and every signed-in session in the same request"]) await expect(page.locator("main")).toContainText(s);
  await expect(page.locator("#request ~ p").first().getByRole("link")).toHaveAttribute("href", "mailto:help@solia.example?subject=Delete%20my%20Solia%20Health%20account");
  // the other bundle has none: no invented address, and the page says so
  const other = process.env.E2E_API_SITE_URL;
  await openSitePage(page, byId("support"), { site: other });
  await expect(page.locator('a[href^="mailto:"]')).toHaveCount(0);
  await expect(page.locator("#help ~ p").first()).toContainText("In the app. Open You → Help & about.");
  await openSitePage(page, byId("delete-account"), { site: other });
  await expect(page.locator('a[href^="mailto:"]')).toHaveCount(0);
  await expect(page.locator("#request ~ p").first()).toHaveText("By email. An email address for deletion requests has not been set up yet. Until it is, use the steps above in the app.");
  // and the front page's footer and questions now lead to the two pages
  await openSitePage(page, SITE_PAGES[0]);
  await expect(page.locator(".foot-nav").getByRole("link", { name: "Support" })).toHaveAttribute("href", "/support/");
  await expect(page.locator(".foot-nav").getByRole("link", { name: "Delete your account" })).toHaveAttribute("href", "/delete-account/");
});

test("search and sharing: canonical, the card and its 1200x630 image, no rating anywhere, robots, sitemap, the app is noindex", async ({ page, request }) => {
  const site = process.env.E2E_SITE_URL;
  for (const p of SITE_PAGES.filter((x) => !x.status)) {
    await openSitePage(page, p);
    const path = p.id === "home" ? "/" : p.path;
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `${SITE_ADDRESS}${path}`);
    const meta = (sel) => page.locator(`meta[${sel}]`).getAttribute("content");
    expect(await meta('property="og:url"')).toBe(`${SITE_ADDRESS}${path}`);
    expect(await meta('property="og:title"')).toBe(await page.title());
    expect(await meta('property="og:description"')).toBe(await meta('name="description"'));
    expect(await meta('property="og:image"')).toBe(`${SITE_ADDRESS}/site/img/og.jpg`);
    expect([await meta('property="og:image:width"'), await meta('property="og:image:height"'), await meta('name="twitter:card"')]).toEqual(["1200", "630", "summary_large_image"]);
    expect((await meta('property="og:image:alt"')).length).toBeGreaterThan(40);
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
  }
  // the card's picture is this site's own file, and really 1200x630
  const og = await request.get(`${site}/site/img/og.jpg`);
  expect(og.status()).toBe(200); expect(og.headers()["content-type"]).toBe("image/jpeg");
  await page.goto(`${site}/site/img/og.jpg`);
  expect(await page.evaluate(() => [document.images[0].naturalWidth, document.images[0].naturalHeight])).toEqual([1200, 630]);
  // SoftwareApplication, on the front page only, with no rating or review
  await openSitePage(page, SITE_PAGES[0]);
  const ld = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent());
  expect(ld["@type"]).toBe("SoftwareApplication");
  expect(ld.name).toBe("Solia Health");
  expect(ld.operatingSystem, "no store address is set, so only the web is named").toBe("Web");
  expect(ld.offers).toEqual({ "@type": "Offer", price: "0", priceCurrency: "USD", description: "The web app is free to use." });
  expect(JSON.stringify(ld)).not.toMatch(/aggregateRating|ratingValue|ratingCount|"review|award|interactionStatistic|downloads/i);
  for (const p of SITE_PAGES.slice(1)) { await openSitePage(page, p); await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(0); }
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex"); // the 404 page (the last one)
  // robots.txt and sitemap.xml
  const robots = await request.get(`${site}/robots.txt`);
  expect(robots.headers()["content-type"]).toContain("text/plain");
  expect(await robots.text()).toBe(`# Solia Health\nUser-agent: *\nAllow: /\n\nSitemap: ${SITE_ADDRESS}/sitemap.xml\n`);
  const sitemap = await (await request.get(`${site}/sitemap.xml`)).text();
  expect([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])).toEqual([`${SITE_ADDRESS}/`, `${SITE_ADDRESS}/support/`, `${SITE_ADDRESS}/delete-account/`]);
  // the app is not for search engines; the legal drafts keep their own noindex
  expect(await (await request.get(`${site}/app/`)).text()).toContain('<meta name="robots" content="noindex" />');
  expect(await (await request.get(`${site}/legal/privacy.html`)).text()).toContain('<meta name="robots" content="noindex, nofollow">');
  // a build that doesn't know its address writes no canonical link and no sitemap, rather than a guessed one
  const other = process.env.E2E_API_SITE_URL;
  await openSitePage(page, SITE_PAGES[0], { site: other });
  await expect(page.locator('link[rel="canonical"], meta[property="og:url"]')).toHaveCount(0);
  expect(await page.locator('meta[property="og:image"]').getAttribute("content")).toBe("/site/img/og.jpg");
  expect((await request.get(`${other}/sitemap.xml`)).status()).toBe(404);
  expect(await (await request.get(`${other}/robots.txt`)).text()).toBe("# Solia Health\nUser-agent: *\nAllow: /\n");
});

