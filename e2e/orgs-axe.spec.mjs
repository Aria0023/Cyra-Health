/* axe-core on the organization parts in the app (docs/plans/upgrade-enterprise.md Task 3), light and dark, in Soft and
   Aura: registration's stage step with the invite code (and its error), the stage step after joining, Home and the
   header wearing the organization, You → Your profile's organization card, the ?org= join sheet. Targets at 44px. */
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { register, emailSignIn } from "./lib/onboard.mjs";
import { gotoTab, gotoYou, setStyle } from "./lib/nav.mjs";
import { mockApi, newApiState } from "./lib/api.mjs";

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"];
const LOGO = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const LAKESIDE = { version: 1, slug: "lakeside", name: "Lakeside Clinic", logo: LOGO, theme: { primary: "#2F5D50", accent: "#8A4E18", dark: { primary: "#8AC2B0", accent: "#D8A96A" } }, stages: ["peri", "meno"], partnerIds: null, poweredBy: "Solia Health" };
const audit = async (page, name) => {
  const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  expect(r.violations.map((v) => `${v.id} (${v.impact}): ${v.help} — ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`), `${name}: axe violations`).toEqual([]);
};
const targets = async (page, sel, name) => {
  const small = await page.locator(sel).evaluateAll((els) => els.filter((el) => el.offsetParent !== null).map((el) => { const r = el.getBoundingClientRect(); return { t: (el.textContent || el.getAttribute("aria-label") || el.id || "").trim().slice(0, 30), h: Math.round(r.height) }; }).filter((x) => x.h < 44));
  expect(small, `${name}: targets under 44px`).toEqual([]);
};

for (const scheme of ["light", "dark"]) {
  test(`organization parts, ${scheme}`, async ({ browser }) => {
    test.setTimeout(180_000);
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce", colorScheme: scheme });
    const page = await ctx.newPage();
    const state = newApiState({ orgs: { lakeside: LAKESIDE }, orgCodes: { LAKE2026: "lakeside" } });
    await mockApi(page, state);
    await page.goto(`${process.env.E2E_API_URL}/`);
    await page.getByRole("button", { name: "Get started" }).click();
    await emailSignIn(page);
    await expect(page.getByRole("heading", { name: "Where are you right now?" })).toBeVisible();
    await audit(page, `stage step with the invite code ${scheme}`);
    await targets(page, ".orgcode input, .orgcode button", `invite code ${scheme}`);
    await page.locator("#reg-org-code").fill("NOPE99");
    await page.getByRole("button", { name: "Join", exact: true }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    await audit(page, `invite code error ${scheme}`);
    await page.locator("#reg-org-code").fill("LAKE2026");
    await page.getByRole("button", { name: "Join", exact: true }).click();
    await expect(page.locator(".stagecard")).toHaveCount(2);
    await audit(page, `stage step joined ${scheme}`);
    await register(page, { resume: true, signin: null, stage: "Perimenopause", pcos: "no" });
    for (const style of ["Soft", "Aura"]) {
      await setStyle(page, style);
      await gotoTab(page, "Home");
      await expect(page.locator("header.mast .orgname")).toHaveText("Lakeside Clinic");
      await audit(page, `Home wearing the organization ${style} ${scheme}`);
      await gotoYou(page, "Your profile");
      await audit(page, `You → Your profile, organization card ${style} ${scheme}`);
      await targets(page, "#you-org button", `organization card ${style} ${scheme}`);
    }
    await page.locator("#you-org").getByRole("button", { name: "Leave Lakeside Clinic" }).click();
    await expect(page.locator("#you-org .orgcode")).toBeVisible();
    await audit(page, `You → Your profile, no organization ${scheme}`);
    await page.waitForTimeout(1200); // the record saves
    await page.goto(`${process.env.E2E_API_URL}/?org=lakeside`);
    await expect(page.locator("#org-join")).toBeVisible();
    await audit(page, `join sheet ${scheme}`);
    await targets(page, "#org-join button", `join sheet ${scheme}`);
    await ctx.close();
  });
}
