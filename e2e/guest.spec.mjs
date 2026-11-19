/* The guest window (owner request 2026-11-16, lib/guest.js), in the API build against the mock backend (sign-in required):
   - "Create your account" offers the sign-ins, Apple first, AND "Try it first" with the whole story once; as a guest the
     whole app works with saving, Home shows one quiet line (hidden for the day with one tap), You → Plan & account says until when,
     and the server holds nothing about her: the only request about accounts is "which sign-ins do you have?".
   - 49 hours later, on the next open: "Your 2 guest days are up". No skip. The encrypted backup and Delete everything
     work right there without signing in. After signing in she is back in the app with what she logged, and isn't asked again.
   - a clock moved back doesn't reopen the window; Delete everything from that screen really deletes. */
import { test, expect } from "@playwright/test";
import path from "node:path";
import { register, emailSignIn } from "./lib/onboard.mjs";
import { gotoTab, gotoYou } from "./lib/nav.mjs";
import { mockApi, newApiState } from "./lib/api.mjs";

const API_URL = () => process.env.E2E_API_URL;
const HOUR = 3600000;
const START = new Date("2026-11-16T10:00:00"); // a Monday, local time: the window ends Wednesday at 10:00
const SHOTS = process.env.GUEST_SHOTS || "";
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name), fullPage: true }); };

/** Registers as a guest, saves a check-in and lets the record's save settle. */
async function tryFirst(page, state, { name = "Maya" } = {}) {
  await page.clock.install({ time: START });
  await mockApi(page, state);
  await register(page, { url: API_URL(), stage: "My Cycle", pcos: "no", name, signin: "guest" });
  await gotoTab(page, "Body");
  await page.getByRole("button", { name: "Save today's check-in" }).click();
  await gotoTab(page, "Body");
  await expect(page.locator(".savedline")).toContainText("Today's check-in is saved.");
  await gotoTab(page, "Home");
}
const laterOpen = async (page, hours) => {
  await page.clock.runFor(2000); // the autosave (400 ms) writes the record
  await page.clock.setSystemTime(new Date(START.getTime() + hours * HOUR));
  await page.reload();
};

test("guest window: try it first → the guest line → 49 hours later the gate, with backup and delete → sign in → back in the app with her data", async ({ page }) => {
  const state = newApiState();
  await page.clock.install({ time: START });
  await mockApi(page, state);
  await page.goto(`${API_URL()}/`);
  await page.getByRole("button", { name: "Get started" }).click();
  await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
  // the sign-ins are all there, Apple first, and the one skip is "Try it first", with the story told once
  await expect(page.locator(".signin-list .signinbtn")).toHaveText(["Continue with Apple", "Continue with Google", "Continue with Facebook", "Continue with email"]);
  const tryBox = page.locator(".signin-try");
  await expect(tryBox).toContainText("try Solia Health as a guest for 2 days before you make an account");
  await expect(tryBox).toContainText("Solia Health's server holds no account for you");
  await expect(tryBox).toContainText("2 days as a guest, then a free account to keep going."); // this build has no free-week gate: no "7 days", no Pro
  await expect(page.getByText(/7 days free in all|then Pro/)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Continue without an account" })).toHaveCount(0);
  await shot(page, "1-signin-step-try-it-first.png");
  await page.getByRole("button", { name: "Try it first" }).click();
  await register(page, { url: API_URL(), stage: "My Cycle", pcos: "no", name: "Maya", signin: null, resume: true });

  // Home: one quiet line with the deadline, a way to create the account and "Hide for today"
  const bar = page.locator(".guestbar");
  await expect(bar).toContainText("You're trying Solia Health as a guest. Create an account by Wednesday, 10:00 AM to keep going.");
  await expect(bar).toContainText("2 days as a guest, then a free account to keep going.");
  await expect(bar.getByRole("button", { name: "Create account" })).toBeVisible();
  await shot(page, "2-home-guest-line.png");
  // the whole app works, with saving
  await gotoTab(page, "Body");
  await page.getByRole("button", { name: "Save today's check-in" }).click();
  await gotoTab(page, "Body");
  await expect(page.locator(".savedline")).toContainText("Today's check-in is saved.");
  // You → Plan & account says she's a guest and until when, always
  await gotoYou(page, "Plan & account");
  const card = page.locator("#you-guest");
  await expect(card).toContainText("You're trying Solia Health as a guest until Wednesday, 10:00 AM.");
  await expect(card).toContainText("Solia Health's server holds no account for you");
  await expect(page.locator("#you-signin")).toHaveCount(0);
  await shot(page, "3-you-guest-card.png");
  // "Create account" opens the same choices in a sheet, with no skip; closing it changes nothing
  await card.getByRole("button", { name: "Create account" }).click();
  const sheet = page.locator("#guest-create");
  await expect(sheet.getByRole("heading", { name: "Create your account" })).toBeVisible();
  await expect(sheet.locator(".signinbtn").first()).toHaveText("Continue with Apple");
  await expect(sheet.getByRole("button", { name: "Try it first" })).toHaveCount(0);
  await sheet.getByRole("button", { name: "Close" }).click();
  // Home's line hides for the day with one tap and doesn't come back on the same day
  await gotoTab(page, "Home");
  await page.locator(".guestbar").getByRole("button", { name: "Hide for today" }).click();
  await expect(page.locator(".guestbar")).toHaveCount(0);
  await page.clock.runFor(2000);
  await page.reload();
  await expect(page.locator(".navpill")).toBeVisible(); // still a guest: no gate inside the window
  await expect(page.locator(".guestbar")).toHaveCount(0);
  // as a guest the server knows nothing about her: the only accounts request asks which sign-ins exist, and nothing carried a body
  const acct = state.sent.filter((r) => r.path.startsWith("/api/accounts") || r.path.startsWith("/api/oauth"));
  expect([...new Set(acct.map((r) => r.path))]).toEqual(["/api/accounts/config"]);
  for (const r of state.sent) { expect(r.body, r.path).toBeNull(); expect(r.auth, r.path).toBeNull(); }

  // 49 hours after she started, on the next open: the gate, with the guest wording and no skip
  await laterOpen(page, 49);
  await expect(page.getByRole("heading", { name: "Your 2 guest days are up" })).toBeVisible();
  await expect(page.getByText("Sign in to keep going. Everything you logged is still on this device.")).toBeVisible();
  await expect(page.locator(".navpill")).toHaveCount(0);
  await expect(page.locator(".signin-list .signinbtn").first()).toHaveText("Continue with Apple");
  for (const skip of ["Try it first", "Continue without an account", "Continue for now"]) await expect(page.getByRole("button", { name: skip })).toHaveCount(0);
  // her data is still hers without signing in: the encrypted backup downloads...
  const data = page.locator(".gatedata");
  await expect(data.getByRole("heading", { name: "Back up or delete your data without signing in" })).toBeVisible();
  await expect(data).toContainText("1 day logged");
  await shot(page, "4-gate-after-48-hours.png");
  await data.getByRole("button", { name: "Encrypted backup" }).click();
  await data.getByLabel("Backup passphrase", { exact: true }).fill("correct horse battery");
  await data.getByLabel("Repeat backup passphrase").fill("correct horse battery");
  const dl = page.waitForEvent("download");
  await data.getByRole("button", { name: "Download encrypted backup" }).click();
  expect((await dl).suggestedFilename()).toMatch(/\.(json|cyra)$/);
  // ...and Delete everything is offered (and can be backed out of)
  await data.getByRole("button", { name: "Delete everything" }).click();
  await expect(data.locator("#data-wipe-panel")).toContainText("Delete everything on this device?");
  await shot(page, "5-gate-backup-and-delete.png");
  await data.getByRole("button", { name: "Keep my data" }).click();
  await expect(data.locator("#data-wipe-panel")).toHaveCount(0);

  // signing in: straight back in the app, with her name and what she logged
  await emailSignIn(page);
  await expect(page.locator(".navpill")).toBeVisible();
  await expect(page.locator(".viewpanel main h1")).toContainText("Maya");
  await expect(page.locator(".guestbar")).toHaveCount(0);
  await gotoYou(page, "Plan & account");
  await expect(page.locator("#you-signin")).toContainText("Signed in as maya@example.com");
  await expect(page.locator("#you-guest")).toHaveCount(0);
  await gotoYou(page, "Privacy & your data");
  await expect(page.locator('[data-fact="days"]')).toContainText("1 day logged");
  // and she isn't asked again
  await page.clock.runFor(2000);
  await page.reload();
  await expect(page.locator(".navpill")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your 2 guest days are up" })).toHaveCount(0);
  // nothing from her log ever went to the server: every body is an email or a code
  for (const r of state.sent) if (r.body) for (const k of Object.keys(r.body)) expect(["email", "code", "verifier"]).toContain(k);
});

test("guest window: moving the clock back doesn't reopen it; a server that can't be reached never locks her out", async ({ page }) => {
  const state = newApiState();
  await tryFirst(page, state);
  await laterOpen(page, 49);
  await expect(page.getByRole("heading", { name: "Your 2 guest days are up" })).toBeVisible();
  // the clock goes back to the first hour: this device remembers the latest time it saw
  await page.clock.runFor(2000);
  await page.clock.setSystemTime(new Date(START.getTime() + 1 * HOUR));
  await page.reload();
  await expect(page.getByRole("heading", { name: "Your 2 guest days are up" })).toBeVisible();
  // the server can't be reached: the app opens as before rather than locking her out, and asks again when it can
  await page.unroute("**/*");
  await page.route("https://api.solia.test/**", (route) => route.abort());
  await page.reload();
  await expect(page.locator(".navpill")).toBeVisible();
  await expect(page.locator(".viewpanel main h1")).toContainText("Maya");
  await page.unroute("https://api.solia.test/**");
  await mockApi(page, state);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Your 2 guest days are up" })).toBeVisible();
});

test("guest window: Delete everything works from the gate without signing in", async ({ page }) => {
  const state = newApiState();
  await tryFirst(page, state);
  await laterOpen(page, 50);
  await expect(page.getByRole("heading", { name: "Your 2 guest days are up" })).toBeVisible();
  const data = page.locator(".gatedata");
  await data.getByRole("button", { name: "Delete everything" }).click();
  await data.getByRole("button", { name: "Yes, delete it all" }).click();
  await expect(page.getByRole("button", { name: "Get started" })).toBeVisible();
  // nothing is left on this device, and no account was ever made or deleted
  expect(state.sent.filter((r) => r.path.startsWith("/api/accounts") && r.path !== "/api/accounts/config")).toEqual([]);
  await page.reload();
  await expect(page.getByRole("button", { name: "Get started" })).toBeVisible();
});

test("guest window: signing in from Home's line inside the window ends it; signing out then asks to sign in, as before", async ({ page }) => {
  const state = newApiState();
  await tryFirst(page, state);
  await page.locator(".guestbar").getByRole("button", { name: "Create account" }).click();
  const sheet = page.locator("#guest-create");
  await expect(sheet).toContainText("Everything you logged as a guest stays on this device");
  await emailSignIn(page);
  await expect(page.locator("#guest-create")).toHaveCount(0);
  await expect(page.locator(".guestbar")).toHaveCount(0);
  await expect(page.locator(".viewpanel main h1")).toContainText("Maya"); // exactly where she was
  await gotoYou(page, "Plan & account");
  await expect(page.locator("#you-signin")).toContainText("Signed in as maya@example.com");
  await page.locator("#you-signin").getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("heading", { name: "Sign in to keep going" })).toBeVisible(); // not a guest again
});
