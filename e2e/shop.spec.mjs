/* Shop by need (Task C, 2026-11-14), its own page since 2026-11-15 (docs/plans/plans-shop-page.md Task 3 and the owner's
   design update). With src/config/affiliates.json committed empty, every link is the brand's own page with no affiliate
   label, no price and no "Clinician reviewed" badge; with src/config/shop-images.json empty, every card shows the calm
   placeholder (no <img>). Links are checked, never followed: the app sends nothing.
   2026-11-19 (docs/plans/visible-features.md Task 2, the entry points only): the header's labelled "Shop" pill, the
   "+" sheet's row and the one-time "New: Shop by need" hint; the header (with the plan badge) at 320px and 390px. */
import { test, expect } from "@playwright/test";
import { register } from "./lib/onboard.mjs";
import { gotoTab, openLog, setStyle, gotoYou } from "./lib/nav.mjs";

const page$ = (page) => page.locator("main.shoppage");

test("the header's labelled Shop pill opens the Shop page on every main tab; Back returns to where she came from, focus on the h1", async ({ page }) => {
  await register(page, { stage: "Trying to conceive", pcos: "no" });
  for (const tab of ["Home", "Body", "Mind", "Patterns", "You"]) {
    await gotoTab(page, tab);
    const bag = page.locator("header.mast").getByRole("button", { name: "Shop", exact: true });
    await expect(bag).toBeVisible();
    const box = await bag.boundingBox();
    expect(box.width).toBeGreaterThanOrEqual(44); expect(box.height).toBeGreaterThanOrEqual(44);
    await expect(bag.locator("span")).toHaveText("Shop"); // a visible label beside the icon, not an icon alone
    await expect(bag.locator("span")).toBeVisible();
    await expect(bag.locator("svg")).toBeVisible();
    await bag.click();
    await expect(page$(page).getByRole("heading", { level: 1, name: "Shop by need" })).toBeFocused();
    await expect(page.locator("main")).toHaveCount(1); // the page replaces the view under the tab
    await expect(page.getByRole("tab", { name: tab, exact: true })).toHaveAttribute("aria-selected", "true");
    await page$(page).getByRole("button", { name: "Back" }).click();
    await expect(page$(page)).toHaveCount(0);
    await expect(bag).toBeFocused();
    await expect(page.getByRole("tab", { name: tab, exact: true })).toHaveAttribute("aria-selected", "true");
  }
});

test("Trying to conceive: needs first, products grouped by brand, plain brand links that carry nothing", async ({ page }) => {
  const outside = [];
  page.on("request", (r) => { if (!r.url().startsWith(process.env.E2E_URL)) outside.push(r.url()); });
  await register(page, { stage: "Trying to conceive", pcos: "no" });
  await gotoYou(page, "Help & about");
  // the single, distinct entry card on You
  const entry = page.locator("#you-shop");
  await expect(entry).toContainText("Shop by need");
  await expect(entry).toContainText("Real products for your stage");
  await entry.getByRole("button", { name: "Shop by need" }).click();
  const shop = page$(page);
  const chips = shop.getByRole("group", { name: "Needs, yours first" }).getByRole("button");
  await expect(chips.first()).toHaveText("Ovulation & fertility");
  await expect(chips.first()).toHaveAttribute("aria-pressed", "true");
  await expect(chips.nth(1)).toHaveText("Lab tests"); // lab tests early for Trying to conceive
  // grouped by brand: a band per brand, then its cards
  const band = shop.locator(".shopbrand").first();
  await expect(band.getByRole("heading", { level: 2 })).toHaveText("Easy@Home");
  await expect(band.locator(".shopband-tag")).toHaveText("AT-HOME TESTS");
  const lh = shop.locator('.shopcard[data-item="easyhome-lh"]');
  await expect(lh.getByRole("heading", { level: 3 })).toHaveText("Ovulation (LH) test strips");
  await expect(lh).toContainText("Sold online");
  await expect(lh).toContainText("Sold by Easy@Home");
  await expect(lh).toContainText("Mixed evidence on pregnancy rates");
  await expect(lh.locator("img")).toHaveCount(0); // no licensed image yet: the placeholder
  await expect(lh.locator(".shopprice")).toHaveCount(0); // no price set
  await lh.getByRole("button", { name: "Learn more" }).click();
  await expect(lh).toContainText("No price is shown here: check the brand's site.");
  await expect(lh).toContainText("Cochrane");
  const a = lh.getByRole("link", { name: /Visit Easy@Home/ });
  await expect(a).toHaveAttribute("href", "https://www.easyhomefertility.com/");
  await expect(a).toHaveAttribute("target", "_blank");
  await expect(a).toHaveAttribute("rel", "noopener noreferrer");
  await expect(shop.getByText("Affiliate link", { exact: true })).toHaveCount(0);
  await expect(shop).not.toContainText("may earn a commission");
  await expect(shop.getByText("Clinician reviewed")).toHaveCount(0);
  await expect(shop.locator(".shopfoot")).toContainText("Neither carries anything about you");
  await expect(shop.locator(".shopfoot")).toContainText("Not medical advice");
  // lab tests
  await chips.nth(1).click();
  await expect(shop.locator('.shopcard[data-item="everly-fertility"]')).toContainText("Women's Fertility Test");
  await expect(shop.locator(".shopbrand h2")).toContainText(["Quest Diagnostics", "Labcorp OnDemand", "Everlywell"]);
  // by brand: "All brands" first, then a brand filters
  await shop.getByRole("button", { name: "By brand" }).click();
  const brands = shop.getByRole("group", { name: "Brands" }).getByRole("button");
  await expect(brands.first()).toHaveText("All brands");
  await expect(brands.first()).toHaveAttribute("aria-pressed", "true");
  await shop.getByRole("group", { name: "Brands" }).getByRole("button", { name: "Everlywell" }).click();
  await expect(shop.locator(".shopcard")).toHaveCount(2);
  await expect(shop.locator(".shopbrand h2")).toHaveText(["Everlywell"]);
  for (const link of await shop.locator(".shopgo").all()) expect(await link.getAttribute("href")).not.toMatch(/[?&](utm_|stage|ttc|pcos|id=)/i);
  expect(outside).toEqual([]);
});

test("deep links: #/shop, #/shop/<need>, and the old #/care and #/shelf open the page", async ({ page }) => {
  await register(page, { stage: "Perimenopause", pcos: "no" });
  for (const [hash, first] of [["#/shop", "Perimenopause & menopause"], ["#/shop/sleep", "Sleep"], ["#/care", "Perimenopause & menopause"], ["#/shelf", "Perimenopause & menopause"]]) {
    await page.evaluate((h) => { window.location.hash = h; }, hash);
    const shop = page$(page);
    await expect(shop.getByRole("heading", { level: 1, name: "Shop by need" })).toBeVisible();
    await expect(shop.getByRole("group", { name: "Needs, yours first" }).getByRole("button", { pressed: true })).toHaveText(first);
    await shop.getByRole("button", { name: "Back" }).click();
    await expect(shop).toHaveCount(0);
  }
});

test("PCOS on: blood sugar first; the device sheet's quiet link opens wearables; the glucose card links to blood sugar", async ({ page }) => {
  await register(page, { stage: "My Cycle", pcos: "yes" });
  await page.locator("header.mast").getByRole("button", { name: "Shop", exact: true }).click();
  await expect(page$(page).getByRole("group", { name: "Needs, yours first" }).getByRole("button").first()).toHaveText("Blood sugar");
  await page$(page).getByRole("button", { name: "Back" }).click();
  await gotoTab(page, "Body");
  await page.locator(".bodydevbtn").click();
  await page.locator("#devices-sheet").getByRole("button", { name: "Don't have a device? See options" }).click();
  await expect(page.locator("#devices-sheet")).toHaveCount(0);
  await expect(page$(page).getByRole("button", { name: "Wearables" })).toHaveAttribute("aria-pressed", "true");
  await expect(page$(page).locator('.shopcard[data-item="oura"]')).toBeVisible();
  await page$(page).getByRole("button", { name: "Back" }).click();
  await expect(page.getByRole("tab", { name: "Body", exact: true })).toHaveAttribute("aria-selected", "true");
  await page.locator(".bodydevbtn").click();
  await page.locator('#devices-sheet .devrow[data-device="dexcom"]').getByRole("button", { name: "Connect" }).click();
  await page.locator("#devices-sheet .v2sheet-close").click();
  await page.locator("#body-glucose").getByRole("button", { name: "Blood sugar options" }).click();
  await expect(page$(page).getByRole("button", { name: "Blood sugar" })).toHaveAttribute("aria-pressed", "true");
  await expect(page$(page).locator('.shopcard[data-item="labcorp-a1c"]')).toBeVisible();
});

test("the shop never shows in insights, Patterns or Home; a tab switch closes the page", async ({ page }) => {
  await register(page, { stage: "Perimenopause", pcos: "no" });
  await expect(page.locator(".shoplink, .shopcard")).toHaveCount(0);
  await gotoTab(page, "Patterns");
  await expect(page.locator(".shoplink, .shopcard")).toHaveCount(0);
  await page.locator("header.mast").getByRole("button", { name: "Shop", exact: true }).click();
  await expect(page$(page)).toBeVisible();
  await gotoTab(page, "Home");
  await expect(page$(page)).toHaveCount(0);
});

test("wide screens: 2 to 4 columns of cards; phones: one", async ({ page }) => {
  await register(page, { stage: "My Cycle", pcos: "no" });
  await page.locator("header.mast").getByRole("button", { name: "Shop", exact: true }).click();
  await page$(page).getByRole("button", { name: "Ovulation & fertility" }).click();
  // phones: a brand with 2+ products scrolls sideways (a list; the next card peeks); a single product stays full width
  const multi = page$(page).locator(".shopgrid.multi").first();
  await expect(multi).toHaveCSS("overflow-x", "auto");
  expect(await multi.evaluate((u) => u.tagName === "UL" && u.scrollWidth > u.clientWidth)).toBe(true);
  await page$(page).getByRole("button", { name: "Wearables" }).click();
  const cols = async () => page$(page).locator(".shopbrand").evaluateAll((els) => Math.max(...els.map((e) => getComputedStyle(e.querySelector(".shopgrid")).gridTemplateColumns.split(" ").length)));
  expect(await cols()).toBeLessThanOrEqual(1);
  await page.setViewportSize({ width: 1280, height: 900 });
  expect(await cols()).toBeGreaterThanOrEqual(3);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.setViewportSize({ width: 800, height: 900 });
  expect(await cols()).toBeGreaterThanOrEqual(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("the + sheet: a Shop by need row at the bottom, under a divider", async ({ page }) => {
  await register(page, { stage: "My Cycle", pcos: "no" });
  const sheet = await openLog(page);
  const row = sheet.getByRole("button", { name: "Shop by need" });
  await expect(row).toBeVisible();
  expect((await row.boundingBox()).height).toBeGreaterThanOrEqual(44);
  // the last control in the sheet, in a block with a top border
  expect(await sheet.locator("button").last().evaluate((b) => b.classList.contains("logshop-go"))).toBe(true);
  expect(await sheet.locator(".logshop").evaluate((d) => parseFloat(getComputedStyle(d).borderTopWidth))).toBeGreaterThanOrEqual(1);
  expect((await row.boundingBox()).y).toBeGreaterThan((await sheet.locator(".logtiles").boundingBox()).y);
  await row.click();
  await expect(page.getByRole("dialog", { name: "Log something" })).toHaveCount(0);
  await expect(page$(page).getByRole("heading", { level: 1, name: "Shop by need" })).toBeFocused();
  await page$(page).getByRole("button", { name: "Back" }).click();
  await expect(page$(page)).toHaveCount(0);
  await expect(page.getByRole("tab")).toHaveCount(5); // still five tabs
  await expect(page.getByRole("tab")).toHaveText(["Home", "Body", "Mind", "Patterns", "You"]);
});

test("the one-time hint: New: Shop by need under the pill, once, dismissible, never a focus trap", async ({ page }) => {
  await register(page, { stage: "My Cycle", pcos: "no" });
  const pill = page.locator("header.mast").getByRole("button", { name: "Shop", exact: true });
  const coach = page.locator(".shopcoach");
  await expect(coach).toBeVisible();
  await expect(coach).toContainText("New: Shop by need");
  await expect(pill).toHaveAttribute("aria-describedby", "shop-coach-t");
  await expect(page.locator("[role=dialog]")).toHaveCount(0); // a note in the page, not a dialog
  // it sits under the header's pill and covers nothing
  const cb = await coach.boundingBox(); const pb = await pill.boundingBox();
  expect(cb.y).toBeGreaterThanOrEqual(pb.y + pb.height);
  expect(await coach.evaluate((el) => getComputedStyle(el).position)).not.toBe("fixed");
  expect(await coach.evaluate((el) => getComputedStyle(el).animationName)).toBe("none"); // nothing moves
  // Tab moves through it and on: focus is never held
  const ok = coach.getByRole("button", { name: "Got it" });
  await ok.focus();
  await page.keyboard.press("Tab");
  expect(await page.evaluate(() => !document.activeElement.closest(".shopcoach"))).toBe(true);
  expect((await ok.boundingBox()).height).toBeGreaterThanOrEqual(44);
  await ok.click();
  await expect(coach).toHaveCount(0);
  await expect(pill).toBeFocused();
  await expect(pill).not.toHaveAttribute("aria-describedby", /.+/);
  // once: not after a tab switch, and not after a reload
  await gotoTab(page, "Body"); await gotoTab(page, "Home");
  await expect(coach).toHaveCount(0);
  await page.waitForTimeout(1500); // the record's autosave has run
  await page.reload();
  await expect(page.locator(".navpill")).toBeVisible();
  await expect(page.locator(".quicklog")).toBeVisible();
  await expect(coach).toHaveCount(0);
});

test("the one-time hint leaves when she opens the shop, and is counted as shown right away", async ({ page }) => {
  await register(page, { stage: "My Cycle", pcos: "no" });
  await expect(page.locator(".shopcoach")).toBeVisible();
  await page.locator("header.mast").getByRole("button", { name: "Shop", exact: true }).click();
  await expect(page.locator(".shopcoach")).toHaveCount(0);
  await page$(page).getByRole("button", { name: "Back" }).click();
  await expect(page.locator(".quicklog")).toBeVisible();
  await expect(page.locator(".shopcoach")).toHaveCount(0);
  await page.waitForTimeout(1500); // the record's autosave has run
  await page.reload();
  await expect(page.locator(".quicklog")).toBeVisible();
  await expect(page.locator(".shopcoach")).toHaveCount(0);
});

/* The header carries the brand, the plan badge, the Shop pill and the settings button (2026-11-25, critique-fixes Task 1:
   her name and the palette button are gone) on ONE row at 320px and 390px: nothing may overlap, be cut off, wrap or push
   the page sideways, in any style. Under 375px the Shop pill shows only its bag, and its name stays "Shop". */
for (const width of [320, 390]) {
  test(`the header fits on one row at ${width}px in every style: brand, plan badge, Shop, settings`, async ({ browser }) => {
    test.setTimeout(180_000);
    const ctx = await browser.newContext({ viewport: { width, height: 844 }, reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await register(page, { stage: "My Cycle", pcos: "no", name: "Alexandra" });
    await page.locator(".shopcoach").getByRole("button", { name: "Got it" }).click();
    for (const style of ["Soft", "Mono", "Clear", "Journal", "Aura", "Sky", "Blush", "Mint", "Sunset"]) {
      await setStyle(page, style);
      await gotoTab(page, "Home");
      const pill = page.locator("header.mast").getByRole("button", { name: "Shop", exact: true });
      if (width >= 375) await expect(pill.locator("span")).toBeVisible();
      else expect(await pill.locator("span").evaluate((e) => e.getBoundingClientRect().width)).toBeLessThanOrEqual(1); // the bag only; the name "Shop" stays
      await expect(page.locator("header.mast .planbadge")).toBeVisible();
      const r = await page.locator("header.mast").evaluate((mast) => {
        const boxes = [...mast.children].filter((e) => e.offsetParent !== null).map((e) => { const b = e.getBoundingClientRect(); return { n: e.className, l: b.left, r: b.right, t: b.top, b: b.bottom, clip: e.scrollWidth > e.clientWidth + 1 && !e.classList.contains("acctchip") }; });
        const overlaps = [];
        for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) { const a = boxes[i], c = boxes[j]; if (a.l < c.r - 0.5 && c.l < a.r - 0.5 && a.t < c.b - 0.5 && c.t < a.b - 0.5) overlaps.push(`${a.n} / ${c.n}`); }
        return { overlaps, outside: boxes.filter((b) => b.l < -0.5 || b.r > window.innerWidth + 0.5).map((b) => b.n), clipped: boxes.filter((b) => b.clip).map((b) => b.n), sideways: document.documentElement.scrollWidth > window.innerWidth };
      });
      expect(r, `${style} at ${width}px`).toEqual({ overlaps: [], outside: [], clipped: [], sideways: false });
      const row = await page.locator("header.mast").evaluate((mast) => {
        const kids = [...mast.children].filter((e) => e.offsetParent !== null && !e.matches(".shopcoach, .updrow"));
        const b = kids.map((e) => e.getBoundingClientRect());
        return { names: kids.map((e) => e.getAttribute("aria-label") || e.textContent.trim()), oneRow: Math.max(...b.map((x) => x.top)) < Math.min(...b.map((x) => x.bottom)) };
      });
      expect(row, `${style} at ${width}px`).toEqual({ names: ["SoliaHealth", "Free week · 7 days left. Open plans.", "Shop", "Check-in settings"], oneRow: true });
      for (const b of await page.locator("header.mast > button").all()) { const box = await b.boundingBox(); expect(box.height, `${style} ${width}px target`).toBeGreaterThanOrEqual(44); expect(box.width).toBeGreaterThanOrEqual(44); }
    }
    await ctx.close();
  });
}
