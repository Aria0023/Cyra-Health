/* The registration walker: splash → (Create your account) → Stage → (PCOS) → Device → Cycle | Pregnancy → Consent → the app. Labels come
   from src/lib/onboarding.js (STAGE_CARDS, PCOS_ANSWERS, CYCLE_LENS) and src/locales/en-ui.js. */
import { expect } from "@playwright/test";

export const STAGES = ["My Cycle", "Trying to conceive", "Pregnant", "Perimenopause", "Menopause & beyond"];
export const PCOS = { yes: "Yes, diagnosed", suspect: "I suspect it", no: "No", unsaid: "Prefer not to say" };

/** Opens the app and registers. Resolves once the nav pill is on screen. */
export async function register(page, { url = process.env.E2E_URL, stage = "My Cycle", also = [], pcos = "yes", name = "", cycleLen = "24–31 days", lastPeriod = null, dueDate = null, hash = "", signin = "skip" } = {}) {
  await page.goto(`${url}/${hash}`);
  await page.getByRole("button", { name: "Get started" }).click();
  // Create your account (Task 1), in builds with sign-in: "skip" = Continue without an account (no server, or none set up);
  // "email" = sign in with the mock's email code (e2e/lib/api.mjs); null = the caller already did it.
  if (signin === "skip") {
    await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
    await page.getByRole("button", { name: "Continue without an account" }).click();
  } else if (signin === "email") {
    await emailSignIn(page); // a finished sign-in moves on to the stage step by itself
    await expect(page.getByRole("heading", { name: "Where are you right now?" })).toBeVisible();
  }
  // Stage
  await page.locator(".stagecard", { hasText: stage }).first().click();
  // Other cards that fit too (multi-pick, e.g. My Cycle and Perimenopause); `stage` is the one the flow follows.
  for (const s of also) await page.locator(".stagecard", { hasText: s }).first().click();
  await next(page);
  // PCOS (cycle stages only)
  if (!["Pregnant", "Menopause & beyond"].includes(stage)) {
    if (pcos) await page.getByRole("button", { name: PCOS[pcos] || pcos, exact: true }).click();
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
  // Registration never asks about devices (connected later from Home or You)
  await expect(page.getByRole("heading", { name: "Your data and your choices" })).toBeVisible();
  // Consent: only the agreement box is required; nothing is pre-ticked
  await page.getByRole("checkbox", { name: /I agree to/ }).click();
  await page.getByRole("button", { name: "Enter Solia Health" }).click();
  await expect(page.locator(".navpill")).toBeVisible();
  await expect(page.locator(".viewpanel main h1")).toBeVisible();
}

async function next(page) {
  await page.getByRole("button", { name: "Continue", exact: true }).click();
}

/** Signs in with the email code on the sign-in step or gate (the mock's code is 123456). */
export async function emailSignIn(page, email = "maya@example.com", code = "123456") {
  await page.getByRole("button", { name: "Continue with email" }).click();
  await page.getByLabel("Your email").fill(email);
  await page.getByRole("button", { name: "Send me a code" }).click();
  await page.getByLabel("6-digit code").fill(code);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByLabel("6-digit code")).toHaveCount(0);
}
