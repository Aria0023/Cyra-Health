/* axe-core on Task 1's screens, light and dark: "Create your account" (the choices, the email form and the code form),
   the one-time sign-in screen for an existing record, and You → Account with its delete confirm. 0 violations. */
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { register } from "./lib/onboard.mjs";
import { gotoTab } from "./lib/nav.mjs";
import { mockApi, newApiState } from "./lib/api.mjs";

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"];
const audit = async (page, name) => {
  const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const bad = r.violations.map((v) => `${v.id} (${v.impact}): ${v.help} — ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
  expect(bad, `${name}: axe violations`).toEqual([]);
};

for (const scheme of ["light", "dark"]) {
  test(`sign-in screens, ${scheme}`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce", colorScheme: scheme });
    const page = await ctx.newPage();
    const state = newApiState({ providers: { apple: true, google: true, facebook: false, email: true } });
    await mockApi(page, state);
    await page.goto(`${process.env.E2E_API_URL}/`);
    await page.getByRole("button", { name: "Get started" }).click();
    await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
    await page.getByText("What signing in shares").click();
    await audit(page, `Create your account ${scheme}`);
    await page.getByRole("button", { name: "Continue with email" }).click();
    await page.getByLabel("Your email").fill("maya@example.com");
    await page.getByRole("button", { name: "Send me a code" }).click();
    await page.getByLabel("6-digit code").fill("999999");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByRole("alert").filter({ hasText: "isn't right" })).toBeVisible();
    await audit(page, `email code with an error ${scheme}`);
    await page.getByLabel("6-digit code").fill("123456");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Where are you right now?" })).toBeVisible();
    await page.getByRole("button", { name: "Back" }).click();
    await expect(page.locator(".signin-done")).toBeVisible();
    await audit(page, `signed in ${scheme}`);
    await ctx.close();
  });

  test(`the one-time sign-in screen and You → Account, ${scheme}`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce", colorScheme: scheme });
    const page = await ctx.newPage();
    const state = newApiState();
    await mockApi(page, state);
    await register(page, { url: process.env.E2E_API_URL, stage: "Menopause & beyond", signin: "email" });
    await gotoTab(page, "You");
    await page.locator("#you-signin").getByRole("button", { name: "Delete account" }).click();
    await audit(page, `You → Account, delete confirm ${scheme}`);
    await page.locator("#you-signin").getByRole("button", { name: "Cancel" }).click();
    await page.locator("#you-signin").getByRole("button", { name: "Sign out" }).click();
    await expect(page.getByRole("heading", { name: "Sign in to keep going" })).toBeVisible();
    await audit(page, `sign-in gate ${scheme}`);
    await ctx.close();
  });
}
