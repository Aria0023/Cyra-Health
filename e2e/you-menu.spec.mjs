/* You as a short menu (docs/plans/visible-features.md Task 3, src/lib/youMenu.js). You shows her stage card and one
   row per page; each row opens its page inside the You tab (#/you/<slug>), the "You" link and the browser's Back
   return to the menu with focus on the row; every card keeps its id on exactly one page; the five tabs are unchanged. */
import { test, expect } from "@playwright/test";
import { register } from "./lib/onboard.mjs";
import { gotoTab, gotoSegment, gotoYou, YOU_PAGES } from "./lib/nav.mjs";
import { mockApi, newApiState } from "./lib/api.mjs";

/* Each page: its slug, the row's id, and the cards this bundle (no server; My Cycle, PCOS yes) must show there. */
const PAGES = [
  { title: "Your profile", slug: "profile", row: "you-row-profile", cards: ["you-stage", "you-about", "you-modules", "you-partner"] },
  { title: "Privacy & your data", slug: "privacy", row: "you-row-privacy", cards: ["you-privacy", "you-ai-link"] },
  { title: "Solia Health's AI", slug: "ai", row: "you-row-ai", cards: ["you-ai"] },
  { title: "Plan & account", slug: "plan", row: "you-row-plan", cards: ["you-plan", "you-account"] },
  { title: "Devices & reminders", slug: "devices", row: "you-row-devices", cards: ["you-sources", "you-checkins"] },
  { title: "App settings", slug: "settings", row: "you-row-app", cards: ["you-appearance", "you-tour", "you-home-cards"] },
  { title: "Help & about", slug: "help", row: "you-row-help", cards: ["you-help", "you-learn", "you-shop", "you-about-legal"] },
];
const hash = (page) => page.evaluate(() => window.location.hash);
const saved = (page) => page.waitForTimeout(1200); // the record saves 400 ms after the last change

test("the menu: her stage card, then seven rows in order; the five tabs are unchanged", async ({ page }) => {
  await register(page, { stage: "My Cycle", pcos: "yes", name: "Maya" });
  await expect(page.getByRole("tab")).toHaveText(["Home", "Body", "Mind", "Patterns", "You"]);
  await gotoTab(page, "You");
  await expect(page.locator(".viewpanel main h1")).toHaveText("Maya");
  await expect(page.locator(".youmenu .youstage")).toContainText("My Cycle");
  await expect(page.locator(".youmenu .youstage").getByRole("button", { name: /change/ })).toBeVisible();
  const rows = page.locator(".youmenu .yourow");
  await expect(rows.locator("b")).toHaveText(YOU_PAGES);
  expect(YOU_PAGES[1]).toBe("Privacy & your data"); // the second row
  await expect(rows.nth(0)).toContainText("Your stage, about you and condition modules");
  await expect(rows.nth(2)).toContainText("Its switches, and exactly what each one sends");
  // Plan & account carries the live plan state: the same words as the header's plan badge
  const badge = (await page.locator("header.mast .planbadge").textContent()).trim();
  await expect(rows.nth(3).locator(".yourow-state")).toHaveText(badge);
  expect(badge).toMatch(/^Free week · \d days left$/);
  // nothing but the stage card and the menu: the long page is gone
  await expect(page.locator(".youmenu .v2card")).toHaveCount(1);
  for (const r of await rows.all()) { const b = await r.boundingBox(); expect(b.height).toBeGreaterThanOrEqual(44); expect(b.width).toBeGreaterThanOrEqual(300); }
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThan(1500); // a short page
});

test("each row opens its page with its cards; focus moves to the page's heading and back to the row", async ({ page }) => {
  await register(page, { stage: "My Cycle", pcos: "yes" });
  await gotoTab(page, "You");
  const seen = [];
  for (const p of PAGES) {
    await page.locator(`#${p.row}`).click();
    const h1 = page.locator(".yousub h1");
    await expect(h1).toHaveText(p.title);
    await expect(h1).toBeFocused();
    expect(await hash(page)).toBe(`#/you/${p.slug}`);
    await expect(page.getByRole("tab", { name: "You", exact: true })).toHaveAttribute("aria-selected", "true");
    await expect(page.locator(".youmenu")).toHaveCount(0);
    for (const id of p.cards) await expect(page.locator(`#${id}`), `${p.title}: #${id}`).toBeVisible();
    seen.push(...await page.locator('.yousub [id^="you-"]').evaluateAll((els) => els.map((e) => e.id).filter((id) => /^you-[a-z]+(-[a-z]+)?$/.test(id) && id !== "you-back")));
    await expect(page.locator("main")).toHaveCount(1);
    const back = page.locator(".yousub").getByRole("button", { name: "You", exact: true });
    expect((await back.boundingBox()).height).toBeGreaterThanOrEqual(44);
    await back.click();
    await expect(page.locator(".youmenu")).toBeVisible();
    await expect(page.locator(`#${p.row}`)).toBeFocused();
    expect(await hash(page)).toBe("");
  }
  // no card id shows on two pages
  const cards = seen.filter((id) => PAGES.some((p) => p.cards.includes(id)));
  expect(new Set(cards).size).toBe(cards.length);
});

test("the browser's Back returns to the menu with focus on the row; Forward opens the page again", async ({ page }) => {
  await register(page, { stage: "My Cycle", pcos: "no" });
  await gotoTab(page, "You");
  await page.locator("#you-row-plan").click();
  await expect(page.locator(".yousub h1")).toHaveText("Plan & account");
  await page.goBack();
  await expect(page.locator(".youmenu")).toBeVisible();
  await expect(page.locator("#you-row-plan")).toBeFocused();
  expect(await hash(page)).toBe("");
  await expect(page.locator(".navpill")).toBeVisible(); // still in the app
  await page.goForward();
  await expect(page.locator(".yousub h1")).toHaveText("Plan & account");
  await expect(page.locator("#you-plan")).toBeVisible();
  expect(await hash(page)).toBe("#/you/plan");
  // the "You" link after Forward works the same
  await page.locator("#you-back").click();
  await expect(page.locator("#you-row-plan")).toBeFocused();
  // page to page (Privacy & your data → Solia Health's AI) keeps one history entry: Back is the menu
  await page.locator("#you-row-privacy").click();
  await page.locator("#you-ai-link").getByRole("button", { name: "Solia Health's AI" }).click();
  await expect(page.locator(".yousub h1")).toHaveText("Solia Health's AI");
  await expect(page.locator(".yousub h1")).toBeFocused();
  expect(await hash(page)).toBe("#/you/ai");
  await page.goBack();
  await expect(page.locator(".youmenu")).toBeVisible();
  await expect(page.locator("#you-row-ai")).toBeFocused();
});

test("deep links: #/you/<slug> opens the page (at launch and while open); the You tab always opens the menu", async ({ page }) => {
  await register(page, { stage: "Perimenopause", pcos: "no" });
  await saved(page);
  for (const p of PAGES) {
    await page.evaluate((h) => { window.location.hash = h; }, `#/you/${p.slug}`);
    await expect(page.locator(".yousub h1")).toHaveText(p.title);
    await expect(page.locator(`#${p.cards[0]}`)).toBeVisible();
  }
  // at launch
  await page.goto(`${process.env.E2E_URL}/#/you/privacy`);
  await expect(page.locator(".yousub h1")).toHaveText("Privacy & your data");
  await expect(page.locator("#you-privacy")).toBeVisible();
  // the "You" link on a page opened by its link goes to the menu and clears the address
  await page.locator("#you-back").click();
  await expect(page.locator(".youmenu")).toBeVisible();
  await expect(page.locator("#you-row-privacy")).toBeFocused();
  expect(await hash(page)).toBe("");
  // an unknown page is the menu; the old #/settings is the menu too
  await page.evaluate(() => { window.location.hash = "#/you/nothing"; });
  await expect(page.locator(".youmenu")).toBeVisible();
  await gotoTab(page, "Home");
  await page.evaluate(() => { window.location.hash = "#/settings"; });
  await expect(page.locator(".youmenu")).toBeVisible();
  // leaving a page by a tab clears the address, and You opens on the menu, not on the page she last had open
  await page.locator("#you-row-app").click();
  expect(await hash(page)).toBe("#/you/settings");
  await gotoTab(page, "Body");
  expect(await hash(page)).toBe("");
  await gotoTab(page, "You");
  await expect(page.locator(".youmenu")).toBeVisible();
  // tapping You while on a page goes back to the menu
  await page.locator("#you-row-help").click();
  await page.getByRole("tab", { name: "You", exact: true }).click();
  await expect(page.locator(".youmenu")).toBeVisible();
  expect(await hash(page)).toBe("");
});

test("ways in from elsewhere open the right page: the header's sliders button; the build stamp; Restore purchases in two taps", async ({ page }) => {
  await register(page, { stage: "My Cycle", pcos: "no" });
  await gotoTab(page, "You");
  // the header's sliders button on You opens Devices & reminders at Check-ins (the Settings sheet is never drawn on You)
  await page.locator("header.mast").getByRole("button", { name: "Check-in settings" }).click();
  await expect(page.locator(".yousub h1")).toHaveText("Devices & reminders");
  await expect(page.locator("#you-checkins")).toBeFocused();
  await expect(page.locator("#settings-sheet")).toHaveCount(0);
  await page.locator("header.mast").getByRole("button", { name: "Check-in settings" }).click(); // again, already there
  await expect(page.locator("#you-checkins")).toBeFocused();
  // the build stamp is on Help & about, once
  await gotoYou(page, "Help & about");
  await expect(page.locator(".youbuild")).toHaveCount(1);
  await expect(page.locator(".youbuild")).toContainText("BUILD 2026.10.07-D");
  // Restore purchases: two taps from the You tab (the row, then the button)
  await gotoTab(page, "You");
  await page.locator("#you-row-plan").click();
  await page.locator("#you-plan").getByRole("button", { name: "Restore purchases", exact: true }).click();
  await expect(page.locator(".toast")).toBeVisible();
});

test("App settings: the voice guide is the same switch as inside a practice; the style picker still styles the app", async ({ page }) => {
  await page.route("**/voice/manifest.json", (r) => r.fulfill({ status: 404, body: "" }));
  await register(page, { stage: "My Cycle", pcos: "no" });
  await gotoYou(page, "App settings");
  const sw = page.locator("#you-voice").getByRole("switch", { name: "Voice guide in practices" });
  await expect(sw).toHaveAttribute("aria-checked", "false");
  await sw.click();
  await expect(sw).toHaveAttribute("aria-checked", "true");
  await gotoTab(page, "Mind"); await gotoSegment(page, "Practices");
  await page.locator('.prow-btn[data-practice="box"]').first().click();
  await expect(page.locator("#practice-sheet").getByRole("switch", { name: "Voice guide" })).toHaveAttribute("aria-checked", "true");
  await page.locator("#practice-sheet").getByRole("switch", { name: "Voice guide" }).click();
  await page.keyboard.press("Escape");
  await gotoYou(page, "App settings");
  await expect(sw).toHaveAttribute("aria-checked", "false");
  await page.getByRole("radio", { name: "Aura", exact: true }).click();
  await expect(page.locator(".cy")).toHaveAttribute("data-style", "aura");
  await page.locator("#you-back").click();
  await expect(page.locator(".youmenu")).toBeVisible();
  await expect(page.locator(".cy")).toHaveAttribute("data-style", "aura");
});

test("the API build, signed in: Solia Health's AI is two taps from You; the account and Delete account are on Plan & account", async ({ page }) => {
  await mockApi(page, newApiState());
  await register(page, { url: process.env.E2E_API_URL, stage: "Perimenopause", pcos: "no", signin: "email" });
  await gotoTab(page, "You");
  await page.locator(".youmenu .yourow", { hasText: "Solia Health's AI" }).click(); // You → Solia Health's AI, as the app's sentences say
  await expect(page.locator("#you-ai").getByRole("switch", { name: "Chat about your log" })).toBeVisible();
  await expect(page.locator("#you-ai").getByRole("switch", { name: "Weekly write-up" })).toBeVisible();
  await page.locator("#you-back").click();
  await page.locator(".youmenu .yourow", { hasText: "Privacy & your data" }).click();
  await page.locator("#you-privacy").getByRole("button", { name: "How this works" }).click();
  await expect(page.locator("#you-privacy")).toContainText("Turn it on or off in You → Solia Health's AI.");
  await page.locator("#you-back").click();
  await page.locator(".youmenu .yourow", { hasText: "Plan & account" }).click();
  await expect(page.locator("#you-signin")).toContainText("Signed in as maya@example.com");
  await expect(page.locator("#you-signin").getByRole("button", { name: "Delete account", exact: true })).toBeVisible();
});
