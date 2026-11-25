/* Home's "Connect a device" card stands apart (docs/plans/upgrade-enterprise.md Task 5): a tinted surface with a coloured
   left edge, the device rows' icon chips and a filled "See devices", in all nine styles, light and dark (API build, the
   card sits in Home's "More for today"). axe 0 violations (colour contrast included); the button at 44px; the card's
   surface differs from the page's other cards'. */
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { openHomeMore, setStyle, gotoTab } from "./lib/nav.mjs";
import { register } from "./lib/onboard.mjs";
import { mockApi, newApiState } from "./lib/api.mjs";

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"];
const STYLES = ["Soft", "Mono", "Clear", "Journal", "Aura", "Sky", "Blush", "Mint", "Sunset"];

for (const scheme of ["light", "dark"]) {
  test(`the devices card in every style, ${scheme}`, async ({ browser }) => {
    test.setTimeout(240_000);
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce", colorScheme: scheme });
    const page = await ctx.newPage();
    await mockApi(page, newApiState({ sources: { healthkit: "on-device", oura: true, terra: false } }));
    await register(page, { url: process.env.E2E_API_URL, stage: "Perimenopause", pcos: "no", signin: "email" });
    for (const style of STYLES) {
      await setStyle(page, style);
      await gotoTab(page, "Home");
      await openHomeMore(page);
      const card = page.locator("#home-devices");
      await card.scrollIntoViewIfNeeded();
      await expect(card.locator(".devhome-chips .devicon")).toHaveCount(3);
      const go = card.getByRole("button", { name: "See devices" });
      await expect(go).toHaveClass(/\bcta\b/);
      const b = await go.boundingBox(); expect(b.height, `${style} ${scheme}`).toBeGreaterThanOrEqual(44);
      const look = await page.evaluate(() => {
        const c = getComputedStyle(document.querySelector("#home-devices"));
        const other = [...document.querySelectorAll(".homev2 .v2card")].find((x) => x.id !== "home-devices" && x.offsetParent);
        return { bg: c.backgroundImage + c.backgroundColor, edge: c.borderLeftWidth, other: other ? getComputedStyle(other).backgroundImage + getComputedStyle(other).backgroundColor : null };
      });
      expect(look.edge, `${style} ${scheme}: the coloured edge`).toBe("4px");
      expect(look.bg, `${style} ${scheme}: its own surface`).not.toBe(look.other);
      const r = await new AxeBuilder({ page }).include("#home-devices").withTags(TAGS).analyze();
      expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`), `devices card ${style} ${scheme}`).toEqual([]);
    }
    const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
    expect(r.violations.map((v) => v.id), `Home with the card, Sunset ${scheme}`).toEqual([]);
    await ctx.close();
  });
}
