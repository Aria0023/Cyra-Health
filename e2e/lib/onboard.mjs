/* The registration walker: splash → Stage → (PCOS) → Device → Cycle | Pregnancy → Consent → the app. Labels come
   from src/lib/onboarding.js (STAGE_CARDS, PCOS_ANSWERS, CYCLE_LENS) and src/locales/en-ui.js. */
import { expect } from "@playwright/test";

export const STAGES = ["My Cycle", "Trying to conceive", "Pregnant", "Perimenopause", "Menopause & beyond"];
export const PCOS = { yes: "Yes, diagnosed", suspect: "I suspect it", no: "No", unsaid: "Prefer not to say" };

/** Opens the app and registers. Resolves once the nav pill is on screen. */
export async function register(page, { url = process.env.E2E_URL, stage = "My Cycle", pcos = "yes", name = "", cycleLen = "24–31 days", lastPeriod = null, dueDate = null, hash = "" } = {}) {
  await page.goto(`${url}/${hash}`);
  await page.getByRole("button", { name: "Get started" }).click();
  // Stage
  await page.locator(".stagecard", { hasText: stage }).first().click();
  await next(page);
  // PCOS (cycle stages only)
  if (!["Pregnant", "Menopause & beyond"].includes(stage)) {
    if (pcos) await page.getByRole("button", { name: PCOS[pcos] || pcos }).click();
    await next(page);
  }
  // Device: name and email are optional
  if (name) await page.getByPlaceholder("First name (optional)").fill(name);
  await next(page);
  if (stage === "Pregnant") {
    if (dueDate) await page.locator('input[type="date"]').fill(dueDate);
    await next(page);
  } else if (stage !== "Menopause & beyond") {
    await page.getByRole("button", { name: cycleLen, exact: true }).click();
    if (lastPeriod) await page.locator('input[type="date"]').fill(lastPeriod);
    await next(page);
  }
  // Consent: only the agreement box is required; nothing is pre-ticked
  await page.getByRole("checkbox", { name: /I agree to/ }).click();
  await page.getByRole("button", { name: "Enter Solia Health" }).click();
  await expect(page.locator(".navpill")).toBeVisible();
  await expect(page.locator(".viewpanel main h1")).toBeVisible();
}

async function next(page) {
  await page.getByRole("button", { name: "Continue", exact: true }).click();
}
