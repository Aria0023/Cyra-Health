/* Privacy: this build (no VITE_API_BASE) makes no request off its own origin while registering and using every tab,
   and with the AI features off an Ask question makes zero /api calls. */
import { test, expect } from "@playwright/test";
import { register } from "./lib/onboard.mjs";
import { gotoTab, gotoSegment, openLog, closeSheet, TABS } from "./lib/nav.mjs";

test("no request leaves the app's own origin; Ask with AI off makes no /api call", async ({ page }) => {
  const origin = new URL(process.env.E2E_URL).origin;
  const offOrigin = [], api = [];
  page.on("request", (r) => {
    const u = r.url();
    if (u.startsWith("data:") || u.startsWith("blob:")) return;
    if (!u.startsWith(origin)) offOrigin.push(u);
    if (/\/api\//.test(u)) api.push(u);
  });
  await register(page, { stage: "My Cycle", pcos: "suspect" });
  for (const tab of TABS) await gotoTab(page, tab);
  await openLog(page); await closeSheet(page);
  await gotoTab(page, "Body"); await gotoSegment(page, "Calendar"); await gotoSegment(page, "Cycles");
  await gotoTab(page, "Patterns"); await gotoSegment(page, "Report");
  // Ask: the library answers on the device; with no server the AI opt-in is not offered and nothing is sent
  await gotoTab(page, "Mind"); await gotoSegment(page, "Journey");
  const ask = page.locator("#ask-q");
  await ask.fill("Does exercise help with PCOS?");
  await page.getByRole("button", { name: /^Ask/ }).first().click();
  await page.waitForTimeout(800);
  expect(offOrigin, `requests off ${origin}`).toEqual([]);
  expect(api, "/api calls").toEqual([]);
});
