/* axe-core on the portal's launch tools (docs/plans/launch-tools.md), light and dark, phone and wide, against a real
   development backend (e2e/lib/portal.mjs): Readiness with rows in every status and after both live checks; AI costs
   with a real request's totals, its chart and tables, a form error and a budget past 80%, and the Overview's card.
   The Feedback inbox empty, with messages (a reply link, a long unbroken message), a handled one, and the Overview's
   count. Every target is checked at 44px. */
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { startBackend, portalSignIn, OWNER } from "./lib/portal.mjs";
import { startAnthropic } from "./lib/anthropic.mjs";
import { settled } from "./lib/settle.mjs";

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"];
const audit = async (page, name) => {
  await settled(page);
  const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const bad = r.violations.map((v) => `${v.id} (${v.impact}): ${v.help} — ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
  expect(bad, `${name}: axe violations`).toEqual([]);
  const small = await page.evaluate(() => [...document.querySelectorAll("main button, main a.btn, main select, main input:not([type=checkbox]):not([type=file]):not([tabindex='-1']), main textarea, main summary, #nav a, .who button")]
    .filter((el) => el.offsetParent !== null).map((el) => { const r = el.getBoundingClientRect(); return { t: el.textContent.trim().slice(0, 30) || el.id, h: r.height }; }).filter((x) => x.h < 44));
  expect(small, `${name}: targets under 44px`).toEqual([]);
};
const nav = (page, name) => page.getByRole("navigation", { name: "Portal" }).getByRole("link", { name, exact: true }).click();

for (const scheme of ["light", "dark"]) {
  test(`portal launch tools, ${scheme}`, async ({ browser }) => {
    const ai = await startAnthropic();
    ai.state.usage = { input_tokens: 1_000_000, output_tokens: 100_000 };
    const be = await startBackend({ env: { ...ai.env, GOOGLE_CLIENT_ID: "x".repeat(20), GOOGLE_CLIENT_SECRET: "x".repeat(20), FACEBOOK_APP_ID: "x".repeat(20) } });
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce", colorScheme: scheme });
    const page = await ctx.newPage();
    try {
      await portalSignIn(page, be, OWNER, "Overview");
      // Readiness (Task 1): ready, not set up and problem rows; then after the two checks
      await nav(page, "Readiness");
      await expect(page.locator('[data-row="signin-facebook"]')).toHaveAttribute("data-status", "problem");
      await audit(page, `readiness ${scheme}`);
      await page.getByRole("button", { name: "Check storage" }).click();
      await expect(page.locator("#ready-disk-out")).toContainText("Storage works");
      await page.getByRole("button", { name: "Send me a test email" }).click();
      await expect(page.locator(".msgbox")).toContainText("nothing was sent");
      await audit(page, `readiness after the checks ${scheme}`);
      await page.setViewportSize({ width: 1200, height: 900 });
      await audit(page, `readiness, wide ${scheme}`);
      // AI costs (Task 2): empty, then with one real request, an error, a budget past 80%, and the Overview card
      await page.setViewportSize({ width: 390, height: 844 });
      await nav(page, "AI costs");
      await expect(page.locator('[data-stat="ai-month"] b')).toHaveText("$0.00");
      await audit(page, `ai costs, empty ${scheme}`);
      await nav(page, "Weekly report");
      await page.getByRole("button", { name: "Preview", exact: true }).click();
      await expect(page.locator(".mail-body")).toBeVisible();
      await nav(page, "AI costs");
      await expect(page.locator('[data-stat="ai-month"] b')).toHaveText("$6.00");
      await page.getByLabel("Budget in US dollars per month").fill("lots");
      await page.getByRole("button", { name: "Save budget" }).click();
      await expect(page.getByRole("alert")).toBeVisible();
      await audit(page, `ai costs with an error ${scheme}`);
      await page.getByLabel("Budget in US dollars per month").fill("7");
      await page.getByRole("button", { name: "Save budget" }).click();
      await expect(page.locator("[data-budget]")).toHaveAttribute("data-budget", "warn");
      await audit(page, `ai costs past 80% ${scheme}`);
      await page.setViewportSize({ width: 1200, height: 900 });
      await audit(page, `ai costs, wide ${scheme}`);
      await page.setViewportSize({ width: 390, height: 844 });
      await nav(page, "Overview");
      await expect(page.locator('[data-stat="ov-ai-month"] b')).toHaveText("$6.00");
      await audit(page, `overview with the AI costs card ${scheme}`);
      await nav(page, "Readiness");
      await expect(page.locator('[data-row="ai-budget"]')).toHaveAttribute("data-status", "problem");
      await audit(page, `readiness with the budget row ${scheme}`);
      // Feedback (Task 3): empty, with messages (one with a reply link), a handled one, and the Overview count
      await nav(page, "Feedback");
      await expect(page.locator("[data-empty]")).toBeVisible();
      await audit(page, `feedback, empty ${scheme}`);
      const email = "maya@clinic.example";
      await fetch(`${be.url}/api/accounts/email/start`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }) });
      await expect.poll(() => be.codeFor(email)).not.toBeNull();
      const session = await (await fetch(`${be.url}/api/accounts/email/verify`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, code: be.codeFor(email) }) })).json();
      const post = (body, token) => fetch(`${be.url}/api/feedback`, { method: "POST", headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ build: "BUILD 2026.10.07-D", platform: "web", language: "en", ...body }) });
      await post({ kind: "feedback", message: "A long message without spaces: " + "x".repeat(300) });
      await post({ kind: "problem", message: "The chart is blank\nsince the update.", reply: true, email }, session.token);
      await nav(page, "Overview");
      await expect(page.locator('[data-stat="ov-fb-open"] b')).toHaveText("2");
      await audit(page, `overview with the feedback count ${scheme}`);
      await nav(page, "Feedback");
      await expect(page.locator("[data-feedback]")).toHaveCount(2);
      await audit(page, `feedback with messages ${scheme}`);
      await page.locator("[data-feedback]").first().getByRole("button", { name: /^Mark handled/ }).click();
      await page.getByRole("group", { name: "Status" }).getByRole("button", { name: "All", exact: true }).click();
      await expect(page.locator('[data-feedback][data-status="handled"]')).toHaveCount(1);
      await audit(page, `feedback with a handled message ${scheme}`);
      await page.setViewportSize({ width: 1200, height: 900 });
      await audit(page, `feedback, wide ${scheme}`);
    } finally { await ctx.close(); await be.stop(); await ai.stop(); }
  });
}
