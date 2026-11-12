/* Task 1, sign-in required: the API build (e2e/lib/serve.mjs) against the mock backend (e2e/lib/api.mjs).
   - required: "Create your account" first, Apple first, no skip; a wrong then a right email code; the app opens;
     You → Account names her; sign out brings the one-time sign-in screen; Google (a mocked redirect) signs her back in;
     delete account (confirmed) says her log stays; nothing from her log went to the server.
   - no sign-in set up on the server: "Continue without an account", said plainly.
   - an existing record (made while sign-in wasn't set up) is asked to sign in once when it becomes required; its log stays.
   - the no-server build: the step explains there is no server and makes no request (privacy.spec.mjs checks the rest). */
import { test, expect } from "@playwright/test";
import { register, emailSignIn } from "./lib/onboard.mjs";
import { gotoTab } from "./lib/nav.mjs";
import { mockApi, newApiState } from "./lib/api.mjs";

const API_URL = () => process.env.E2E_API_URL;

test("required: Create your account comes first, Apple first, no skip; a wrong then a right email code", async ({ page }) => {
  const state = newApiState();
  await mockApi(page, state);
  await page.goto(`${API_URL()}/`);
  await page.getByRole("button", { name: "Get started" }).click();
  await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
  const btns = page.locator(".signin-list .signinbtn");
  await expect(btns).toHaveText(["Continue with Apple", "Continue with Google", "Continue with Facebook", "Continue with email"]);
  await expect(page.getByRole("button", { name: "Continue without an account" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Continue", exact: true })).toHaveCount(0);
  // a wrong code, then the right one
  await page.getByRole("button", { name: "Continue with email" }).click();
  await page.getByLabel("Your email").fill("maya@example.com");
  await page.getByRole("button", { name: "Send me a code" }).click();
  await expect(page.getByText("We sent a 6-digit code to maya@example.com")).toBeVisible();
  await page.getByLabel("6-digit code").fill("000000");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "That code isn't right" })).toBeVisible();
  await page.getByLabel("6-digit code").fill("123456");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  // signing in moves on to the stage step; the rest of registration is unchanged
  await expect(page.getByRole("heading", { name: "Where are you right now?" })).toBeVisible();
  await page.getByRole("button", { name: "Back" }).click();
  await expect(page.locator(".signin-done")).toContainText("Signed in as maya@example.com.");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Where are you right now?" })).toBeVisible();
  expect(state.sent.map((r) => r.path)).toEqual(["/api/accounts/config", "/api/accounts/email/start", "/api/accounts/email/verify", "/api/accounts/email/verify"]);
});

test("required, end to end: email sign-in → app → You → sign out → gate → Google → delete account", async ({ page }) => {
  const state = newApiState();
  await mockApi(page, state);
  await register(page, { url: API_URL(), stage: "Perimenopause", signin: "email" });
  await gotoTab(page, "You");
  const card = page.locator("#you-signin");
  await expect(card).toContainText("Signed in as maya@example.com");
  await expect(page.locator("#you-account")).toHaveCount(0); // "No account needed" would no longer be true
  await card.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("heading", { name: "Sign in to keep going" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue without an account" })).toHaveCount(0);
  // Google: the start URL redirects straight back with a one-time code (the mock), which the app redeems
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await expect(page.locator(".navpill")).toBeVisible();
  await gotoTab(page, "You");
  await expect(page.locator("#you-signin")).toContainText("maya@google.example (Google)");
  // delete the account: confirm, then the gate again; her log stays on this device
  await page.locator("#you-signin").getByRole("button", { name: "Delete account" }).click();
  await expect(page.locator("#signin-del")).toContainText("Your health log on this device isn't touched");
  await page.getByRole("button", { name: "Delete my account" }).click();
  await expect(page.getByRole("heading", { name: "Sign in to keep going" })).toBeVisible();
  expect(state.sent.some((r) => r.method === "DELETE" && r.path === "/api/accounts/me" && r.auth === `Bearer ${"t".repeat(40)}.${"s".repeat(43)}`)).toBe(true);
  // nothing from her log ever went to the server: every body is an email, a code or a provider code
  for (const r of state.sent) if (r.body) for (const k of Object.keys(r.body)) expect(["email", "code", "verifier"]).toContain(k);
});

test("no sign-in set up on the server: continue without an account, said plainly", async ({ page }) => {
  const state = newApiState({ providers: { apple: false, google: false, facebook: false, email: false } });
  await mockApi(page, state);
  await page.goto(`${API_URL()}/`);
  await page.getByRole("button", { name: "Get started" }).click();
  await expect(page.getByText("Sign-in isn't set up on this server yet, so you can continue without an account.")).toBeVisible();
  await page.getByRole("button", { name: "Continue without an account" }).click();
  await expect(page.getByRole("heading", { name: "Where are you right now?" })).toBeVisible();
});

test("an existing record is asked to sign in once when sign-in becomes required; its log stays", async ({ page }) => {
  const state = newApiState({ providers: { apple: false, google: false, facebook: false, email: false } });
  await mockApi(page, state);
  await register(page, { url: API_URL(), stage: "My Cycle", name: "Maya" });
  await expect(page.locator(".viewpanel main h1")).toContainText("Maya");
  state.providers = { apple: true, google: true, facebook: true, email: true };
  await page.waitForTimeout(1500); // the record's save on this device settles
  await page.reload();
  await expect(page.getByRole("heading", { name: "Sign in to keep going" })).toBeVisible();
  await expect(page.getByText("Your log stays on this device")).toBeVisible();
  await emailSignIn(page);
  await expect(page.locator(".viewpanel main h1")).toContainText("Maya");
  await page.waitForTimeout(1500);
  await page.reload();
  await expect(page.locator(".navpill")).toBeVisible(); // once: the session is kept on this device
  await expect(page.getByRole("heading", { name: "Sign in to keep going" })).toHaveCount(0);
});

test("the no-server build: the step says there's no server and asks nothing", async ({ page }) => {
  const api = [];
  page.on("request", (r) => { if (/\/api\//.test(r.url())) api.push(r.url()); });
  await page.goto(`${process.env.E2E_URL}/`);
  await page.getByRole("button", { name: "Get started" }).click();
  await expect(page.getByText("This version of Solia Health has no server, so there's no account to make.")).toBeVisible();
  await expect(page.locator(".signinbtn")).toHaveCount(0);
  expect(api).toEqual([]);
});
