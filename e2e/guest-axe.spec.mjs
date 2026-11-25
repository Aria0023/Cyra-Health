/* axe-core on the guest window's new states (lib/guest.js), light and dark: "Create your account" with "Try it first",
   Home's guest line, You → Plan & account as a guest, the "Create your account" sheet, and the screen after the window with
   its backup and delete panels open. 0 violations. */
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { register } from "./lib/onboard.mjs";
import { gotoYou } from "./lib/nav.mjs";
import { mockApi, newApiState } from "./lib/api.mjs";

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"];
const audit = async (page, name) => {
  const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const bad = r.violations.map((v) => `${v.id} (${v.impact}): ${v.help} — ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
  expect(bad, `${name}: axe violations`).toEqual([]);
};
const START = new Date("2026-11-16T10:00:00");

for (const scheme of ["light", "dark"]) {
  test(`guest window screens, ${scheme}`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce", colorScheme: scheme });
    const page = await ctx.newPage();
    await page.clock.install({ time: START });
    await mockApi(page, newApiState());
    await page.goto(`${process.env.E2E_API_URL}/`);
    await page.getByRole("button", { name: "Get started" }).click();
    await expect(page.getByRole("button", { name: "Try it first" })).toBeVisible();
    await audit(page, `Create your account with Try it first ${scheme}`);
    await page.getByRole("button", { name: "Try it first" }).click();
    await register(page, { url: process.env.E2E_API_URL, stage: "Perimenopause", pcos: "no", signin: null, resume: true });
    await page.clock.runFor(2000); // Home's guest line shows in the window's last 12 hours (2026-11-25)
    await page.clock.setSystemTime(new Date(START.getTime() + 40 * 3600000));
    await page.reload();
    await expect(page.locator(".guestbar")).toBeVisible();
    await audit(page, `Home with the guest line ${scheme}`);
    await gotoYou(page, "Plan & account");
    await expect(page.locator("#you-guest")).toBeVisible();
    await audit(page, `You as a guest ${scheme}`);
    await page.locator("#you-guest").getByRole("button", { name: "Create account" }).click();
    await expect(page.locator("#guest-create")).toBeVisible();
    await audit(page, `Create your account sheet ${scheme}`);
    await page.locator("#guest-create").getByRole("button", { name: "Close" }).click();
    // after the window
    await page.clock.runFor(2000);
    await page.clock.setSystemTime(new Date(START.getTime() + 49 * 3600000));
    await page.reload();
    await expect(page.getByRole("heading", { name: "Your 2 guest days are up" })).toBeVisible();
    await audit(page, `guest gate ${scheme}`);
    await page.locator(".gatedata").getByRole("button", { name: "Encrypted backup" }).click();
    await audit(page, `guest gate, backup panel ${scheme}`);
    await page.locator(".gatedata").getByRole("button", { name: "Delete everything" }).click();
    await expect(page.locator("#data-wipe-panel")).toBeVisible();
    await audit(page, `guest gate, delete confirm ${scheme}`);
    await ctx.close();
  });
}
