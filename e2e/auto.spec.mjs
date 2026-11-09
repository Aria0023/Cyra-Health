/* Auto-tracked acceptance (docs/plans/auto-tracked-spike.md). S1: the demo-wearables build connects a source to 90 days
   of illustrative readings. S2: the "Today's auto-tracked" card above Quick log, Looks right (no day entry written), Skip
   this night, the cycle markers, the two pattern cards' home, the clinician table, and the card's screenshots. */
import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { register } from "./lib/onboard.mjs";
import { gotoTab, gotoSegment, toast, gotoGallery } from "./lib/nav.mjs";
import { pdfPages } from "./lib/pdf.mjs";

const WORDS = /^(at your usual|lower than usual|higher than usual|(lower|higher), usual for your [a-z]+ days|a few more nights will show your usual|no reading|left out)$/;
const connectDemo = async (page) => {
  await page.getByRole("button", { name: /^Wearables/ }).click();
  const door = page.locator("#home-wear");
  await expect(door).toBeVisible();
  await door.getByRole("button", { name: "Connect" }).first().click();
  await expect(toast(page)).toContainText("90 days of illustrative data");
};

test("S1: connecting a demo source brings 90 days of illustrative readings and says so", async ({ page }) => {
  await register(page, { stage: "My Cycle", pcos: "yes" });
  await connectDemo(page);
  await expect(toast(page)).toContainText("Demo mode");
  await expect(page.getByRole("button", { name: /^Wearables/ })).toContainText("1 connected");
});

test("S2: the card above Quick log; Looks right confirms without writing a day; Skip this night; the markers; the table", async ({ page }) => {
  await register(page, { stage: "My Cycle", pcos: "yes", name: "Maya" });
  await gotoTab(page, "You");
  await expect(page.locator(".youstage .youfact")).toContainText("75 days logged");
  await gotoTab(page, "Home");
  await connectDemo(page);
  const card = page.locator("#auto-tracked");
  await expect(card).toBeVisible();
  await expect(card).toContainText("Today's auto-tracked");
  await expect(card).toContainText(/synced/);
  // above the Quick log
  const [cardBox, qlBox] = await Promise.all([card.boundingBox(), page.locator(".quicklog").boundingBox()]);
  expect(cardBox.y).toBeLessThan(qlBox.y);
  // four rows, words only
  const rows = card.locator(".autorow");
  await expect(rows).toHaveCount(4);
  await expect(rows.locator(".autolab")).toHaveText(["Sleep", "Temperature", "HRV", "Resting HR"]);
  for (const w of await rows.locator(".autoword").allTextContents()) expect(w).toMatch(WORDS);
  expect(await card.locator(".autorows").textContent()).not.toMatch(/\d/); // words, never a number
  await expect(card).toContainText("Illustrative readings from this demo build");
  await expect(card).toContainText("Confirm today (10 s)");
  // Body rail: the auto-tracked step leads, not yet done
  await expect(page.locator(".railcard .steprail .step").first()).toContainText("Auto-tracked");
  // Looks right
  await card.getByRole("button", { name: "Looks right", exact: true }).click();
  await expect(toast(page)).toContainText("Nothing was added to your log");
  await expect(card.getByRole("button", { name: /Looks right/ })).toBeDisabled();
  await expect(card).toContainText("Confirmed");
  await expect(page.locator(".todayline")).toContainText("auto-tracked, looks right");
  await expect(page.locator(".railcard .steprail .step").first()).toHaveClass(/done/);
  // no synthetic day entry: still 75 days logged
  await gotoTab(page, "You");
  await expect(page.locator(".youstage .youfact")).toContainText("75 days logged");
  await gotoTab(page, "Home");
  // Skip this night → the reason picker → nightSkips; Undo brings it back
  await card.getByRole("button", { name: "Skip this night" }).click();
  await expect(card.getByRole("group", { name: "Why skip this night?" })).toBeVisible();
  await card.getByRole("button", { name: "Alcohol" }).click();
  await expect(card).toContainText("Skipped: alcohol");
  await card.getByRole("button", { name: "Undo" }).click();
  await expect(card.getByRole("button", { name: "Skip this night" })).toBeVisible();
  // Add anything else? opens the symptom chips
  await card.getByRole("button", { name: "Add anything else?" }).click();
  await expect(page.locator(".viewpanel main h1")).toBeVisible();
  await expect(page.getByRole("tab", { name: "Body" })).toHaveAttribute("aria-selected", "true");
  // Body → Cycles: a marker per cycle, guidance words only
  await gotoSegment(page, "Cycles");
  const marks = page.locator(".cycmark");
  expect(await marks.count()).toBeGreaterThan(1);
  for (const m of await marks.allTextContents()) expect(m).toMatch(/^(Temperature rise seen · day \d+( · luteal \d+ days)?|No sustained rise seen this cycle|Not enough nights)$/);
  expect(await marks.allTextContents()).toContainEqual(expect.stringMatching(/^Temperature rise seen · day 15/));
  await expect(page.getByRole("button", { name: "How the temperature rise is read" })).toBeVisible();
  expect(await page.locator(".cyclespage").textContent()).not.toMatch(/contracept/i); // My Cycle: the TTC line is not shown
  // Patterns → Report: the preview shows the table and the PDF is still one page
  await gotoTab(page, "Patterns");
  await gotoSegment(page, "Report");
  await expect(page.locator(".cstable")).toBeVisible();
  expect(await page.locator(".cstable tbody tr").count()).toBeGreaterThan(0);
  await expect(page.locator(".cstable")).toContainText(/seen, day 15/);
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /Download PDF/ }).click()]);
  const bytes = fs.readFileSync(await dl.path());
  expect(pdfPages(bytes)).toBe(1);
  fs.mkdirSync("e2e/shots", { recursive: true });
  fs.writeFileSync("e2e/shots/clinician-summary-table.pdf", bytes);
});

test("S2: Trying to conceive shows the contraception line once under the cycles list", async ({ page }) => {
  await register(page, { stage: "Trying to conceive", pcos: "no" });
  await connectDemo(page);
  await gotoTab(page, "Body");
  await gotoSegment(page, "Cycles");
  await expect(page.locator(".cycttc")).toHaveCount(1);
  await expect(page.locator(".cycttc")).toHaveText("Solia Health is not a contraceptive.");
});

test("S2 shots: the card in Soft light, Clear dark and Bloom light", async ({ page }) => {
  await register(page, { stage: "My Cycle", pcos: "yes", name: "Maya" });
  await connectDemo(page);
  fs.mkdirSync("e2e/shots", { recursive: true });
  for (const [style, scheme] of [["Soft", "light"], ["Clear", "dark"], ["Bloom", "light"]]) {
    await page.emulateMedia({ colorScheme: scheme });
    await gotoTab(page, "You");
    await page.getByRole("radio", { name: style }).click();
    await gotoTab(page, "Home");
    const card = page.locator("#auto-tracked");
    await card.scrollIntoViewIfNeeded();
    await expect(card).toBeVisible();
    await expect(page.locator(".toast.show")).toHaveCount(0, { timeout: 12_000 }); // a clean shot, no toast over it
    await card.screenshot({ path: `e2e/shots/card-${style.toLowerCase()}-${scheme}.png` });
  }
  await gotoTab(page, "Body"); await gotoSegment(page, "Cycles");
  await expect(page.locator(".toast.show")).toHaveCount(0, { timeout: 12_000 });
  await page.locator(".cyclespage").screenshot({ path: "e2e/shots/cycles-markers-bloom-light.png" });
  await gotoTab(page, "Patterns"); await gotoSegment(page, "Report");
  await expect(page.locator(".toast.show")).toHaveCount(0, { timeout: 12_000 });
  await page.locator(".cspreview").first().screenshot({ path: "e2e/shots/report-preview-table.png" });
  await gotoTab(page, "You");
  await page.locator("#you-sources").getByRole("button", { name: "How this is going" }).click();
  await page.locator("#you-sources").screenshot({ path: "e2e/shots/data-sources-bloom-light.png" });
});

/* ---------- S3: Data sources, the demo switch, the deep link a notification opens, the gallery ---------- */
test("S3: You → Data sources manages the source; How this is going counts the Looks right; #/confirm/<day> writes a confirmation", async ({ page }) => {
  await register(page, { stage: "My Cycle", pcos: "yes", name: "Maya" });
  await gotoTab(page, "You");
  const card = page.locator("#you-sources");
  await expect(card).toBeVisible();
  await expect(card).toContainText("Data sources");
  // the demo-wearables build offers Oura and Fitbit · Garmin · Whoop here (the on-phone source only in the phone app)
  await expect(card.locator(".srcrow")).toHaveCount(2);
  await expect(card.locator('.srcrow[data-source="oura"] .srcstatus')).toContainText("Not connected");
  await expect(card.locator('.srcrow[data-source="oura"] .srcwhere')).toContainText("Through Solia Health's server");
  // the demo switch brings the demo rows (and the Home card)
  const demo = card.getByRole("switch", { name: "Demo readings" });
  await expect(demo).toHaveAttribute("aria-checked", "false");
  await demo.click();
  await expect(toast(page)).toContainText("90 days of illustrative data");
  await expect(demo).toHaveAttribute("aria-checked", "true");
  await expect(card.locator('.srcrow[data-source="oura"] .srcstatus')).toContainText(/Connected · Last sync .* · \d+ nights on this device/);
  // How this is going: nothing confirmed yet, a source connected since today
  await card.getByRole("button", { name: "How this is going" }).click();
  await expect(card.locator(".srcgoing")).toContainText("No night confirmed yet.");
  await expect(card.locator(".srckept")).toContainText("Kept on this device, never sent.");
  // the deep link a notification's Looks right opens: #/confirm/<today> writes the confirmation and lands on Home
  const today = new Date(); const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  await page.evaluate((h) => { window.location.hash = h; }, `#/confirm/${iso}`);
  await expect(toast(page)).toContainText("Nothing was added to your log");
  await expect(page.getByRole("tab", { name: "Home" })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#auto-tracked")).toContainText("Confirmed");
  expect(page.url()).not.toContain("#/confirm");
  await gotoTab(page, "You");
  await card.getByRole("button", { name: "How this is going" }).click();
  await expect(card.locator(".srcgoing")).toContainText(/1 night confirmed with Looks right since \d{4}-\d{2}-\d{2}\./);
  // Pause → the row says so and the Home door's Sync is refused; Resume
  await card.locator('.srcrow[data-source="oura"]').getByRole("button", { name: "Pause" }).click();
  await expect(card.locator('.srcrow[data-source="oura"] .srcstatus')).toContainText("Paused");
  await card.locator('.srcrow[data-source="oura"]').getByRole("button", { name: "Resume" }).click();
  await expect(card.locator('.srcrow[data-source="oura"] .srcstatus')).toContainText("Connected");
  // Disconnect with "Delete readings too" (on by default): the rows go, the Home card goes
  await card.locator('.srcrow[data-source="oura"]').getByRole("button", { name: "Disconnect", exact: true }).click();
  const confirm = card.getByRole("group", { name: "Disconnect Oura Ring?" });
  await expect(confirm.getByRole("checkbox")).toHaveAttribute("aria-checked", "true");
  await confirm.getByRole("button", { name: "Disconnect", exact: true }).click();
  await expect(toast(page)).toContainText("Its readings were removed from this device");
  await expect(card.locator('.srcrow[data-source="oura"] .srcstatus')).toContainText("Not connected");
  await expect(demo).toHaveAttribute("aria-checked", "false");
  await gotoTab(page, "Home");
  await expect(page.locator("#auto-tracked")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Wearables/ })).toContainText("optional");
});

test("S3 gallery: the card in all five styles and the notification mock; shots", async ({ page }) => {
  await gotoGallery(page, { stage: "cycle", scheme: "light", style: "soft" });
  await expect(page.locator(".dgstyles .autocard")).toHaveCount(5);
  await expect(page.locator(".dgstyles .cy[data-style]")).toHaveCount(5);
  const mock = page.getByRole("group", { name: "Notification mock" });
  await expect(mock).toContainText("Last night synced. Looks right?");
  await expect(mock.getByRole("button", { name: "Looks right" })).toBeVisible();
  await expect(mock.getByRole("button", { name: "Open" })).toBeVisible();
  fs.mkdirSync("e2e/shots", { recursive: true });
  await page.locator(".dgstyles").screenshot({ path: "e2e/shots/gallery-card-five-styles.png" });
  await mock.screenshot({ path: "e2e/shots/gallery-notification-mock.png" });
  await gotoGallery(page, { stage: "cycle", scheme: "dark", style: "clear" });
  await expect(page.locator(".dgstyles .autocard")).toHaveCount(5);
});
