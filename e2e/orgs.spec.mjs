/* Organizations in the app (docs/plans/upgrade-enterprise.md Task 3, src/lib/org.js), in the API build against the mock:
   - registration: an optional invite code; joining sends only the code (with her sign-in, since she is signed in); the
     stage cards are the organization's; the app wears its name, logo and colours (light and dark), "Powered by Solia
     Health" stays; the Shop shows only its lineup; the privacy line is where she joins;
   - a ?org= link opens "Join <name>?"; nothing is joined (or counted) until Join; leaving restores Solia's look;
   - a colour that fails AA in the answer is refused on the device too (the app keeps Solia's look). */
import { test, expect } from "@playwright/test";
import { register, emailSignIn } from "./lib/onboard.mjs";
import { gotoYou } from "./lib/nav.mjs";
import { mockApi, newApiState } from "./lib/api.mjs";

const LOGO = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const LAKESIDE = { version: 1, slug: "lakeside", name: "Lakeside Clinic", logo: LOGO, theme: { primary: "#2F5D50", accent: "#8A4E18", dark: { primary: "#8AC2B0", accent: "#D8A96A" } }, stages: ["peri", "meno"], partnerIds: ["midi", "cooling-bedding", "sleepio"], poweredBy: "Solia Health" };
const PRIV = "Your organization sees how many people joined, never what you log.";
const primary = (page) => page.evaluate(() => getComputedStyle(document.querySelector(".cy")).getPropertyValue("--primary").trim().toUpperCase());

test("registration: an invite code; only the code goes; its stages, look and Shop; Powered by Solia Health stays", async ({ page }) => {
  const state = newApiState({ orgs: { lakeside: LAKESIDE }, orgCodes: { LAKE2026: "lakeside" } });
  await mockApi(page, state);
  await page.goto(`${process.env.E2E_API_URL}/`);
  await page.getByRole("button", { name: "Get started" }).click();
  await emailSignIn(page);
  await expect(page.getByRole("heading", { name: "Where are you right now?" })).toBeVisible();
  await expect(page.locator(".stagecard")).toHaveCount(5);
  const field = page.locator("#reg-org-code");
  await expect(page.locator(".orgcode")).toContainText(PRIV);
  await field.fill("nope99");
  await page.getByRole("button", { name: "Join", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("That invite code isn't known. Check it with your organization.");
  await field.fill("lake-2026");
  await page.getByRole("button", { name: "Join", exact: true }).click();
  await expect(page.locator(".toast")).toHaveText("You joined Lakeside Clinic.");
  const joins = state.sent.filter((r) => r.path === "/api/orgs/join");
  expect(joins.map((r) => r.body)).toEqual([{ code: "NOPE99" }, { code: "LAKE2026" }]);
  expect(joins.at(-1).auth).toMatch(/^Bearer /); // signed in: her account notes the organization
  await expect(page.locator(".stagecard b")).toHaveText(["Perimenopause", "Menopause & beyond"]);
  await expect(page.locator(".obwrap .mark")).toContainText("Lakeside Clinic");
  await expect(page.locator(".obwrap .mark")).toContainText("Powered by Solia Health");
  await register(page, { resume: true, signin: null, stage: "Perimenopause", pcos: "no" });
  const mark = page.locator("header.mast .mark");
  await expect(mark.locator(".orgname")).toHaveText("Lakeside Clinic");
  await expect(mark.locator(".sub")).toHaveText("Powered by Solia Health");
  await expect(mark.locator("img.orglogo")).toHaveAttribute("src", LOGO);
  expect(await primary(page)).toBe("#2F5D50");
  // the Shop shows only the organization's lineup
  await page.locator("header.mast").getByRole("button", { name: /Shop/ }).click();
  const ids = await page.locator(".shopcard").evaluateAll((els) => [...new Set(els.map((e) => e.dataset.item))]);
  expect(ids.length).toBeGreaterThan(0);
  for (const id of ids) expect(LAKESIDE.partnerIds).toContain(id);
  // nothing about her was in any org request
  for (const r of state.sent.filter((x) => x.path.startsWith("/api/orgs"))) expect(Object.keys(r.body || {}).every((k) => k === "code" || k === "slug")).toBe(true);
});

test("dark mode wears the organization's dark colours", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: "dark", reducedMotion: "reduce" });
  const page = await ctx.newPage();
  const state = newApiState({ orgs: { lakeside: LAKESIDE } });
  await mockApi(page, state);
  await register(page, { url: process.env.E2E_API_URL, stage: "Perimenopause", pcos: "no", signin: "email" });
  await page.waitForTimeout(1200); // the record saves
  await page.goto(`${process.env.E2E_API_URL}/?org=lakeside`);
  await page.locator("#org-join").getByRole("button", { name: "Join", exact: true }).click();
  await expect(page.locator("header.mast .orgname")).toHaveText("Lakeside Clinic");
  expect(await primary(page)).toBe("#8AC2B0");
  await ctx.close();
});

test("a ?org= link: Join <name>?, nothing joined until Join; You → Your profile; leaving restores Solia's look", async ({ page }) => {
  const state = newApiState({ orgs: { lakeside: LAKESIDE } });
  await mockApi(page, state);
  await register(page, { url: process.env.E2E_API_URL, stage: "My Cycle", pcos: "no", signin: "guest" });
  const solia = await primary(page);
  await page.waitForTimeout(1200); // the record saves
  await page.goto(`${process.env.E2E_API_URL}/?org=lakeside`);
  const sheet = page.locator("#org-join");
  await expect(sheet.getByRole("heading", { name: "Join Lakeside Clinic?" })).toBeVisible();
  await expect(sheet).toContainText(PRIV);
  await expect(sheet).toContainText("Joining sends only the organization's name or code, and with your sign-in, your account notes which organization you joined.");
  expect(await page.evaluate(() => window.location.search)).toBe(""); // the link is taken out of the address bar
  expect(state.sent.filter((r) => r.path === "/api/orgs/join")).toHaveLength(0); // nothing joined yet
  await sheet.getByRole("button", { name: "Not now" }).first().click();
  await expect(sheet).toHaveCount(0);
  expect(await primary(page)).toBe(solia);
  await page.waitForTimeout(1200); // the record saves
  await page.goto(`${process.env.E2E_API_URL}/?org=lakeside`);
  await page.locator("#org-join").getByRole("button", { name: "Join", exact: true }).click();
  const join = state.sent.filter((r) => r.path === "/api/orgs/join");
  expect(join.map((r) => [r.body, r.auth])).toEqual([[{ slug: "lakeside" }, null]]); // a guest: no sign-in goes
  await expect(page.locator("header.mast .orgname")).toHaveText("Lakeside Clinic");
  await gotoYou(page, "Your profile");
  const card = page.locator("#you-org");
  await expect(card).toContainText("You're using Lakeside Clinic's version of Solia Health.");
  await expect(card).toContainText(PRIV);
  await card.getByRole("button", { name: "Leave Lakeside Clinic" }).click();
  await expect(page.locator(".toast")).toHaveText("You left the organization. Solia Health's own look is back.");
  await expect(page.locator("header.mast .orgname")).toHaveText("Solia");
  expect(await primary(page)).toBe(solia);
  expect(state.sent.filter((r) => r.path === "/api/orgs/leave")).toHaveLength(0); // a guest: nothing to tell the server
  // remembered on this device: join again by code from You, reload, still there
  state.orgCodes.LAKE2026 = "lakeside";
  await card.locator("#you-org-code").fill("LAKE2026");
  await card.getByRole("button", { name: "Join", exact: true }).click();
  await expect(page.locator("header.mast .orgname")).toHaveText("Lakeside Clinic");
  await page.waitForTimeout(1200);
  await page.reload();
  await expect(page.locator("header.mast .orgname")).toHaveText("Lakeside Clinic");
});

test("an answer with a colour that fails AA is refused on the device: Solia's look stays", async ({ page }) => {
  const bad = { ...LAKESIDE, theme: { ...LAKESIDE.theme, primary: "#FFD6E0" } };
  const state = newApiState({ orgs: { lakeside: bad } });
  await mockApi(page, state);
  await register(page, { url: process.env.E2E_API_URL, stage: "My Cycle", pcos: "no", signin: "email" });
  await page.waitForTimeout(1200); // the record saves
  await page.goto(`${process.env.E2E_API_URL}/?org=lakeside`);
  await expect(page.locator(".toast")).toHaveText("That organization link isn't known.");
  await expect(page.locator("#org-join")).toHaveCount(0);
  await expect(page.locator("header.mast .orgname")).toHaveText("Solia");
});
