/* axe-core on Help and the feedback sheet (docs/plans/launch-tools.md Task 3), the API build, light and dark: You →
   Help with an answer open; the sheet empty; with a message, the reply switch on and "What will be sent" open; with
   an error; and the privacy dashboard's "Feedback you send" row. The build without a server: Help with the support
   email link. Buttons, the switch, the box and the link are checked at 44px. */
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { register } from "./lib/onboard.mjs";
import { gotoYou } from "./lib/nav.mjs";
import { mockApi, newApiState } from "./lib/api.mjs";
import { settled } from "./lib/settle.mjs";

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"];
const audit = async (page, name) => {
  await settled(page);
  const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const bad = r.violations.map((v) => `${v.id} (${v.impact}): ${v.help} — ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
  expect(bad, `${name}: axe violations`).toEqual([]);
};
const targets = async (page, sel, name) => {
  const small = await page.locator(sel).evaluateAll((els) => els.filter((el) => el.offsetParent !== null).map((el) => { const r = el.getBoundingClientRect(); return { t: (el.textContent || el.getAttribute("aria-label") || el.id || "").trim().slice(0, 30), h: Math.round(r.height), w: Math.round(r.width) }; }).filter((x) => x.h < 44 || x.w < 44));
  expect(small, `${name}: targets under 44px`).toEqual([]);
};

for (const scheme of ["light", "dark"]) {
  test(`Help and the feedback sheet, ${scheme}`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce", colorScheme: scheme });
    const page = await ctx.newPage();
    const state = newApiState();
    await mockApi(page, state);
    await register(page, { url: process.env.E2E_API_URL, stage: "Perimenopause", pcos: "no", signin: "email" });
    await gotoYou(page, "Help & about");
    const help = page.locator("#you-help");
    await help.scrollIntoViewIfNeeded();
    await help.getByRole("button", { name: "How do I cancel Pro?" }).click();
    await audit(page, `You → Help & about ${scheme}`);
    await targets(page, "#you-help button, #you-help a", `Help ${scheme}`);
    await help.getByRole("button", { name: "Report a problem" }).click();
    const sheet = page.getByRole("dialog", { name: "Report a problem" });
    await expect(sheet.getByRole("heading", { name: "Report a problem" })).toBeFocused();
    await audit(page, `feedback sheet, empty ${scheme}`);
    await sheet.getByLabel("What went wrong?").fill("The chart is blank since the update.");
    await sheet.getByRole("switch", { name: "It's OK to reply to me" }).click();
    await sheet.getByRole("button", { name: "What will be sent" }).click();
    await expect(sheet.locator("[data-feedback-preview] .fbrow")).toHaveCount(7);
    await audit(page, `feedback sheet with the preview open ${scheme}`);
    await targets(page, "#feedback-sheet button, #feedback-sheet textarea", `feedback sheet ${scheme}`);
    state.feedbackStatus = 500;
    await sheet.getByRole("button", { name: "Send", exact: true }).click();
    await expect(sheet.getByRole("alert")).toBeVisible();
    await audit(page, `feedback sheet with an error ${scheme}`);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(help.getByRole("button", { name: "Report a problem" })).toBeFocused();
    await gotoYou(page, "Privacy & your data");
    const privacy = page.locator("#you-privacy");
    await privacy.getByRole("button", { name: "How this works" }).click();
    const row = privacy.locator(".flowrow", { hasText: "Feedback you send" });
    await row.getByRole("button", { name: "Details" }).click();
    await row.scrollIntoViewIfNeeded();
    await audit(page, `privacy dashboard with the feedback row ${scheme}`);
    await ctx.close();
  });

  test(`Help without a server: the support email link, ${scheme}`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce", colorScheme: scheme });
    const page = await ctx.newPage();
    await register(page, { stage: "My Cycle", pcos: "no" });
    await gotoYou(page, "Help & about");
    const help = page.locator("#you-help");
    await help.scrollIntoViewIfNeeded();
    await help.getByRole("button", { name: "How do I connect a watch or ring?" }).click();
    await expect(help.getByRole("link", { name: "help@solia.example" })).toBeVisible();
    await audit(page, `Help with the email link ${scheme}`);
    await targets(page, "#you-help button, #you-help a", `Help, no server ${scheme}`);
    await ctx.close();
  });
}
