/* The free week (lib/trial.js, owner decision 2026-11-12), in the harness build (dev flag trialGate: the gate without a
   store). Day 1 shows the days left; after 7 days a check-in can't be saved, the plans sheet explains why, and what she
   logged is still there to open. */
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { register } from "./lib/onboard.mjs";
import { gotoTab, toast } from "./lib/nav.mjs";

const DAY = 86400000;

test("free week: days left on Home; after it, saving opens 'Your free week is over' and changes nothing", async ({ page }) => {
  const start = new Date("2026-11-12T10:00:00");
  await page.clock.install({ time: start });
  await register(page, { stage: "My Cycle", pcos: "no" });
  const bar = page.locator(".trialbar");
  await expect(bar).toContainText("Free week: 7 days left.");

  // Inside the free week a check-in saves.
  await gotoTab(page, "Body");
  await page.getByRole("button", { name: "Save today's check-in" }).click();
  // (the toast can be replaced by a milestone note, so check the check-in's own saved line)
  await gotoTab(page, "Body");
  await expect(page.locator(".savedline")).toContainText("Today's check-in is saved.");

  // Let the autosave run (it waits 400 ms), then eight days later, without Pro
  await page.clock.runFor(2000);
  await page.clock.setSystemTime(new Date(start.getTime() + 8 * DAY));
  await page.reload();
  await expect(page.locator(".trialbar")).toContainText("Your free week is over.");
  await gotoTab(page, "Body");
  await page.getByRole("button", { name: "Save today's check-in" }).click();
  const sheet = page.locator("#pro-sheet");
  await expect(sheet.getByRole("heading", { name: "Your free week is over" })).toBeVisible();
  await expect(sheet).toContainText("open it, export it or delete it any time, with or without Pro");
  await expect(sheet).toContainText("Keep logging after your free week");
  await expect(toast(page)).not.toContainText("saved");
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"]).analyze();
  expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
  await sheet.getByRole("button", { name: "Done" }).click();

  // You: the plan card says so, and the first check-in is still in her record.
  await gotoTab(page, "You");
  await expect(page.locator("#you-plan")).toContainText("Your free week is over.");
  // Her record (IndexedDB or localStorage, whichever this browser uses) still has the day she logged in her free week.
  const rec = await page.evaluate(async () => {
    const out = [Object.keys(localStorage).map((k) => localStorage.getItem(k)).join("\n")];
    for (const { name } of await indexedDB.databases()) {
      const db = await new Promise((ok, no) => { const r = indexedDB.open(name); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); });
      for (const store of db.objectStoreNames) {
        const all = await new Promise((ok) => { const r = db.transaction(store).objectStore(store).getAll(); r.onsuccess = () => ok(r.result); r.onerror = () => ok([]); });
        out.push(JSON.stringify(all));
      }
      db.close();
    }
    return out.join("\n");
  });
  expect(rec).toContain('"date":"2026-11-12"');
});
