/* Shop by need (Task C, 2026-11-14), its own page since 2026-11-15 (docs/plans/plans-shop-page.md Task 3 and the owner's
   design update). With src/config/affiliates.json committed empty, every link is the brand's own page with no affiliate
   label, no price and no "Clinician reviewed" badge; with src/config/shop-images.json empty, every card shows its
   illustration with an "Illustration" tag (no <img>; 2026-11-16, Task 2). Links are checked, never followed: the app sends nothing.
   2026-11-16 (docs/plans/shop-findable-visuals.md Task 1, easier to find): the header's labelled "Shop" pill, Home's
   "Shop by need" card (Hide, and You brings it back), the "+" sheet's row, the entry card at the top of You, and the
   one-time "New: Shop by need" hint. */
import { test, expect } from "@playwright/test";
import { register } from "./lib/onboard.mjs";
import { gotoTab, openLog, toast } from "./lib/nav.mjs";

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
  await gotoTab(page, "You");
  // the single, distinct entry card on You
  const entry = page.locator("#you-shop");
  await expect(entry).toContainText("Shop by need");
  await expect(entry).toContainText("Real products for your stage");
  await entry.getByRole("button", { name: "Shop by need" }).click();
  await page$(page).getByRole("button", { name: "Back" }).click();
  await expect(entry.getByRole("button", { name: "Shop by need" })).toBeFocused(); // Back returns to the card she came from
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
  await expect(lh.locator("img")).toHaveCount(0); // no licensed image yet: the item's illustration, tagged as one
  await expect(lh.locator(".shopimg svg.shopart")).toHaveAttribute("data-art", "lh-strips");
  await expect(lh.locator(".shopimg svg.shopart")).toHaveAttribute("aria-hidden", "true");
  await expect(lh.locator(".shopimg-tag")).toHaveText("Illustration");
  await expect(shop.locator(".shopimg-tag")).toHaveCount(await shop.locator(".shopcard").count()); // every card without a photo says so
  await expect(shop.locator(".shopfoot")).toContainText("Pictures marked Illustration are drawings, not photos of the product.");
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

test("the shop never shows in insights or Patterns; on Home only its own card; a tab switch closes the page", async ({ page }) => {
  await register(page, { stage: "Perimenopause", pcos: "no" });
  // Home (owner decision 2026-11-16): one card of its own under Quick log, never inside the insight, the patterns card or the POTS card
  await expect(page.locator("#home-shop")).toHaveCount(1);
  await expect(page.locator(".shoplink, .shopcard")).toHaveCount(0);
  await expect(page.locator(".insightcard, .homepatterns, .stepcard").locator(".shophome, .shoplink, .shopthumb")).toHaveCount(0);
  await expect(page.locator(".insightcard")).not.toContainText(/shop/i);
  await gotoTab(page, "Patterns");
  await expect(page.locator(".shoplink, .shopcard, .shophome, .shopthumb")).toHaveCount(0);
  await page.locator("header.mast").getByRole("button", { name: "Shop", exact: true }).click();
  await expect(page$(page)).toBeVisible();
  await gotoTab(page, "Home");
  await expect(page$(page)).toHaveCount(0);
});

test("Home: the Shop by need card sits under Quick log, opens the shop, hides, and comes back from You", async ({ page }) => {
  await register(page, { stage: "Trying to conceive", pcos: "no" });
  const card = page.locator("#home-shop");
  await expect(card.getByRole("heading", { level: 2, name: "Shop by need" })).toBeVisible();
  await expect(card).toContainText("Real products for trying to conceive");
  await expect(card.locator(".shopthumb")).toHaveCount(3); // three thumbnails from her first need
  await expect(card.locator(".shopthumb").first()).toHaveAttribute("data-item", "easyhome-lh");
  // below the hero and Quick log, above Today's insight
  const y = async (sel) => (await page.locator(sel).first().boundingBox()).y;
  expect(await y("#home-shop")).toBeGreaterThan(await y(".homehero"));
  expect(await y("#home-shop")).toBeGreaterThan(await y(".quicklog"));
  expect(await y("#home-shop")).toBeLessThan(await y(".insightcard"));
  const browse = card.getByRole("button", { name: "Browse the shop" });
  const hide = card.getByRole("button", { name: "Hide the shop card" });
  for (const b of [browse, hide]) { const box = await b.boundingBox(); expect(box.height).toBeGreaterThanOrEqual(44); expect(box.width).toBeGreaterThanOrEqual(44); }
  await browse.click();
  await expect(page$(page).getByRole("heading", { level: 1, name: "Shop by need" })).toBeFocused();
  await expect(page$(page).getByRole("group", { name: "Needs, yours first" }).getByRole("button", { pressed: true })).toHaveText("Ovulation & fertility");
  await page$(page).getByRole("button", { name: "Back" }).click();
  await expect(browse).toBeFocused();
  // Hide: remembered on this device, also after a reload
  await hide.click();
  await expect(toast(page)).toContainText("Hidden from Home. You can bring it back from You.");
  await expect(card).toHaveCount(0);
  await page.waitForTimeout(1500); // the record's autosave has run
  await page.reload();
  await expect(page.locator(".navpill")).toBeVisible();
  await expect(page.locator(".quicklog")).toBeVisible();
  await expect(card).toHaveCount(0);
  // You brings it back
  await gotoTab(page, "You");
  await page.locator("#you-shop").getByRole("button", { name: "Show the shop card on Home" }).click();
  await expect(toast(page)).toContainText("The shop card is back on Home.");
  await expect(page.locator("#you-shop").getByRole("button", { name: "Show the shop card on Home" })).toHaveCount(0);
  await gotoTab(page, "Home");
  await expect(card).toBeVisible();
});

test("Home's line names each stage in words", async ({ browser }) => {
  for (const [stage, words] of [["My Cycle", "your cycle"], ["Pregnant", "pregnancy"], ["Perimenopause", "perimenopause"], ["Menopause & beyond", "menopause"]]) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await register(page, { stage, pcos: "no" });
    await expect(page.locator("#home-shop .shophome-line")).toHaveText(`Real products for ${words}`);
    await ctx.close();
  }
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
  await expect(page.locator(".navpill button, .navpill [role=tab]")).toHaveCount(6); // still five tabs and the +
  await expect(page.getByRole("tab")).toHaveCount(5);
});

test("You: the Shop entry card is in the top group, right under her stage", async ({ page }) => {
  await register(page, { stage: "Perimenopause", pcos: "no" });
  await gotoTab(page, "You");
  const order = await page.locator("main.youpage > .v2card, main.youpage > section").evaluateAll((els) => els.map((e) => e.id || e.className));
  expect(order[0]).toContain("youstage");
  expect(order[1]).toBe("you-shop");
  expect(order.indexOf("you-shop")).toBeLessThan(order.indexOf("you-privacy"));
  await expect(page.locator("#you-shop").getByRole("button", { name: "Show the shop card on Home" })).toHaveCount(0); // nothing is hidden yet
});

test("the one-time hint: New: Shop by need under the pill, once, dismissible, never a focus trap", async ({ page }) => {
  await register(page, { stage: "My Cycle", pcos: "no" });
  const pill = page.locator("header.mast").getByRole("button", { name: "Shop", exact: true });
  const coach = page.locator(".shopcoach");
  await expect(coach).toBeVisible();
  await expect(coach).toContainText("New: Shop by need");
  await expect(pill).toHaveAttribute("aria-describedby", "shop-coach-t");
  await expect(page.locator("[role=dialog]")).toHaveCount(0); // a note in the page, not a dialog
  // it sits right under the header's pill and covers nothing
  const cb = await coach.boundingBox(); const pb = await pill.boundingBox();
  expect(cb.y).toBeGreaterThanOrEqual(pb.y + pb.height);
  expect(await coach.evaluate((el) => getComputedStyle(el).position)).not.toBe("fixed");
  expect(await coach.evaluate((el) => getComputedStyle(el).animationName)).toBe("none"); // nothing moves (reduced motion or not)
  // Tab moves through it and on: focus is never held
  await pill.focus();
  await page.keyboard.press("Tab"); // settings
  await page.keyboard.press("Tab");
  await expect(coach.getByRole("button", { name: "Got it" })).toBeFocused();
  await page.keyboard.press("Tab");
  expect(await page.evaluate(() => !document.activeElement.closest(".shopcoach"))).toBe(true);
  const ok = coach.getByRole("button", { name: "Got it" });
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

test("a narrow phone (360px): the Shop pill keeps its icon and label on one header row", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await register(page, { stage: "My Cycle", pcos: "no", name: "Alexandra" });
  const pill = page.locator("header.mast").getByRole("button", { name: "Shop", exact: true });
  await expect(pill.locator("span")).toBeVisible();
  const ys = await page.locator("header.mast > .mark, header.mast > button").evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return Math.round(r.top + r.height / 2); }));
  expect(Math.max(...ys) - Math.min(...ys)).toBeLessThanOrEqual(4); // one row
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await ctx.close();
});

test("product pictures: an illustration per product type, 4:3, a click target that is not a second tab stop", async ({ page }) => {
  await register(page, { stage: "My Cycle", pcos: "no" });
  // Home's thumbnails are the same drawings
  await expect(page.locator("#home-shop .shopthumb svg.shopart")).toHaveCount(3);
  await expect(page.locator("#home-shop .shopthumb svg.shopart").first()).toHaveAttribute("data-art", "heat-wrap");
  await expect(page.locator("#home-shop .shophome-thumbs")).toHaveAttribute("aria-hidden", "true");
  await page.locator("header.mast").getByRole("button", { name: "Shop", exact: true }).click();
  const shop = page$(page);
  await shop.getByRole("button", { name: "By brand" }).click();
  // every bundled item draws the art its catalog entry names; the three glucose sensors use two variants
  const drawn = await shop.locator(".shopcard").evaluateAll((els) => Object.fromEntries(els.map((e) => [e.dataset.item, e.querySelector("svg.shopart")?.dataset.art])));
  expect(Object.keys(drawn).length).toBe(26);
  expect(drawn).toMatchObject({ oura: "smart-ring", "apple-watch": "watch-square", garmin: "watch-round", fitbit: "fitness-band", whoop: "fabric-strap", stelo: "cgm-a", lingo: "cgm-b", libre: "cgm-a", midi: "video-visit", "quest-thyroid": "lab-visit", "everly-peri": "lab-kit", prenatal: "vitamins" });
  expect(new Set(Object.values(drawn)).size).toBe(23);
  // gradient and filter ids never collide between two cards with the same drawing
  expect(await shop.evaluate((m) => { const ids = [...m.querySelectorAll("svg.shopart [id]")].map((e) => e.id); return ids.length === new Set(ids).size && ids.length > 250; })).toBe(true);
  // phones: the picture is 4:3, also in the sideways list
  const img = shop.locator('.shopcard[data-item="easyhome-lh"] .shopimg');
  const box = await img.boundingBox();
  expect(Math.abs(box.width / box.height - 4 / 3)).toBeLessThan(0.02);
  // the picture goes where "Visit <brand>" goes, but only the button is a control
  expect(await img.evaluate((el) => [el.tabIndex, el.getAttribute("role"), el.closest("a"), getComputedStyle(el).cursor])).toEqual([-1, null, null, "pointer"]);
  const card = shop.locator('.shopcard[data-item="easyhome-lh"]');
  await card.getByRole("link", { name: /Visit Easy@Home/ }).evaluate((a) => a.addEventListener("click", (e) => { e.preventDefault(); a.dataset.went = String(Number(a.dataset.went || 0) + 1); }));
  await img.click({ position: { x: 40, y: 80 } });
  await expect(card.getByRole("link", { name: /Visit Easy@Home/ })).toHaveAttribute("data-went", "1");
  expect(await card.locator("a, button, [tabindex]").evaluateAll((els) => els.filter((e) => e.tabIndex >= 0).map((e) => e.textContent.trim().slice(0, 14)))).toEqual(["Visit Easy@Hom", "Learn more"]);
  // nothing moves with reduced motion (the harness asks for it): no zoom on hover, even on a wide screen
  await page.setViewportSize({ width: 1280, height: 900 });
  await card.hover();
  expect(await card.locator("svg.shopart").evaluate((el) => getComputedStyle(el).transform)).toBe("none");
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
