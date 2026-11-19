/* Feedback and Help (docs/plans/launch-tools.md Task 3). The API build against the mock backend: You → Help's answers,
   the sheet's warning, and "What will be sent" — the one request, made only by Send, has a body that equals the preview
   exactly; signed in with the reply switch off it carries no sign-in token and no email; with it on, her account email
   and her token. The privacy dashboard lists it. The build without a server shows the answers and the support email
   link only, and makes no request at all. */
import { test, expect } from "@playwright/test";
import { register } from "./lib/onboard.mjs";
import { gotoTab } from "./lib/nav.mjs";
import { mockApi, newApiState, TOKEN } from "./lib/api.mjs";

const API_URL = () => process.env.E2E_API_URL;
const posts = (state) => state.sent.filter((r) => r.path === "/api/feedback");
/** The preview as an object: each row's key and the text shown for it (the yes/no field reads "Yes"). */
const previewOf = async (sheet) => Object.fromEntries((await sheet.locator("[data-feedback-preview] .fbrow").evaluateAll((rows) => rows.map((r) => [r.dataset.key, r.querySelector("dd").textContent]))).map(([k, v]) => [k, k === "reply" ? v === "Yes" : v]));

test("Send feedback: nothing is sent before Send, and the request body equals the preview exactly", async ({ page }) => {
  const state = newApiState();
  await mockApi(page, state);
  await register(page, { url: API_URL(), stage: "My Cycle", pcos: "no", signin: "email" });
  await gotoTab(page, "You");
  const help = page.locator("#you-help");
  await expect(help.getByRole("heading", { level: 2 })).toContainText("Questions and feedback");
  for (const q of ["How does the free week work?", "How do I cancel Pro?", "Where does my data live?", "How do I connect a watch or ring?"]) await expect(help.getByRole("button", { name: q })).toHaveAttribute("aria-expanded", "false");
  await help.getByRole("button", { name: "Where does my data live?" }).click();
  await expect(help.locator('[data-help="data"]')).toContainText("What you log is kept on this device. Solia Health's servers don't keep a copy.");
  await expect(help.locator('[data-help="free-week"]')).toContainText("This version has no free-week limit"); // this bundle has no store, so no gate
  await expect(help.locator(".helpmail")).toHaveCount(0); // VITE_SUPPORT_EMAIL is unset in this bundle: no link

  await help.getByRole("button", { name: "Send feedback" }).click();
  const sheet = page.getByRole("dialog", { name: "Send feedback" });
  await expect(sheet).toBeVisible();
  await expect(sheet.locator("#fb-warn")).toHaveText("Please don't include health details. Nothing from your log is attached.");
  const send = sheet.getByRole("button", { name: "Send", exact: true });
  await expect(send).toBeDisabled();
  const reply = sheet.getByRole("switch", { name: "It's OK to reply to me" });
  await expect(reply).toHaveAttribute("aria-checked", "false");
  await sheet.getByRole("button", { name: "What will be sent" }).click();
  await expect(sheet).toContainText("Type your message to see exactly what will be sent.");
  await sheet.getByLabel("Your feedback").fill("  The calendar is lovely.\nMore colours please.  ");
  await expect(sheet.locator("#fb-count")).toHaveText("44 of 2000 characters");
  await expect(sheet).toContainText("Exactly this, and only when you press Send:");
  const shown = await previewOf(sheet);
  expect(shown).toEqual({ kind: "feedback", message: "The calendar is lovely.\nMore colours please.", build: "BUILD 2026.10.07-D", platform: "web", language: "en" });
  await expect(sheet).toContainText("no sign-in, so Solia Health can't tell who sent it");
  await page.waitForTimeout(300);
  expect(posts(state), "typing, toggling and opening the preview send nothing").toEqual([]);

  await send.click();
  await expect(page.locator(".toast")).toContainText("Thank you. Your feedback was sent.");
  await expect(sheet).toHaveCount(0);
  expect(posts(state).length).toBe(1);
  const r = posts(state)[0];
  expect(r.method).toBe("POST");
  expect(r.body, "the body is the preview, and nothing else").toEqual(shown);
  expect(Object.keys(r.body)).toEqual(["kind", "message", "build", "platform", "language"]);
  expect(r.auth, "reply off: no sign-in token, though she is signed in").toBeNull();
  expect(r.cookie).toBeNull();
  expect(r.referer).toBeNull();
  expect(r.search).toBe("");
  expect(r.headers.filter((h) => /^(authorization|cookie|referer|x-cyra|x-solia)/.test(h))).toEqual([]);
  expect(JSON.stringify(r.body)).not.toMatch(/maya|example\.com|periods|My Cycle|acct_/);

  // Report a problem, with the reply switch on: her account email and her token go with it, and the preview says so
  await help.getByRole("button", { name: "Report a problem" }).click();
  const sheet2 = page.getByRole("dialog", { name: "Report a problem" });
  await sheet2.getByLabel("What went wrong?").fill("The chart is blank");
  await sheet2.getByRole("switch", { name: "It's OK to reply to me" }).click();
  await expect(sheet2.locator("#fb-reply-d")).toContainText("maya@example.com");
  await sheet2.getByRole("button", { name: "What will be sent" }).click();
  const shown2 = await previewOf(sheet2);
  expect(shown2).toEqual({ kind: "problem", message: "The chart is blank", build: "BUILD 2026.10.07-D", platform: "web", language: "en", reply: true, email: "maya@example.com" });
  await expect(sheet2).toContainText("It's sent with your sign-in, so Solia Health's server links it to your account and deletes it if you delete your account.");
  expect(posts(state).length).toBe(1);
  // a refusal is said plainly and nothing is lost
  state.feedbackStatus = 429;
  await sheet2.getByRole("button", { name: "Send", exact: true }).click();
  await expect(sheet2.getByRole("alert")).toContainText("this one wasn't sent");
  await expect(sheet2.getByLabel("What went wrong?")).toHaveValue("The chart is blank");
  state.feedbackStatus = 201;
  await sheet2.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.locator(".toast")).toContainText("Thank you. Your report was sent.");
  const r2 = posts(state).at(-1);
  expect(r2.body).toEqual(shown2);
  expect(r2.auth).toBe(`Bearer ${TOKEN}`);
  expect(posts(state).length).toBe(3);

  // the kind can be switched inside the sheet; too long can't be sent; Cancel sends nothing
  await help.getByRole("button", { name: "Send feedback" }).click();
  const sheet3 = page.getByRole("dialog", { name: "Send feedback" });
  await sheet3.getByRole("button", { name: "A problem", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Report a problem" })).toBeVisible();
  await expect(page.locator("#fb-text")).toHaveAttribute("maxlength", "2000");
  await page.locator("#fb-text").fill("x".repeat(2100));
  await expect(page.locator("#fb-text")).toHaveValue("x".repeat(2000));
  await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(posts(state).length).toBe(3);

  // You → Privacy & your data lists it, truthfully
  const privacy = page.locator("#you-privacy");
  await privacy.getByRole("button", { name: "How this works" }).click();
  await expect(privacy).toContainText("or you take it out yourself as a backup, file or summary, or type it into feedback you send.");
  const row = privacy.locator(".flowrow", { hasText: "Feedback you send" });
  await expect(row.locator(".flowstate")).toHaveText("When you send one");
  await expect(row).toContainText("Only when you press Send in You → Help: your message, whether it's feedback or a problem, the app version, web, iOS or Android, and the app's language. Nothing from your log is attached.");
  await row.getByRole("button", { name: "Details" }).click();
  await expect(row).toContainText("It's kept for 365 days, then deleted.");
  await expect(row).toContainText("Feedback is never sent to the AI.");
  await expect(page.locator("#you-signin")).toContainText("and any feedback you sent with \"It's OK to reply to me\" on");
});

test("signed out: the sheet has no reply switch and sends no email", async ({ page }) => {
  const state = newApiState({ providers: { apple: false, google: false, facebook: false, email: false } });
  await mockApi(page, state);
  await register(page, { url: API_URL(), stage: "My Cycle", pcos: "no" });
  await gotoTab(page, "You");
  await page.locator("#you-help").getByRole("button", { name: "Report a problem" }).click();
  const sheet = page.getByRole("dialog", { name: "Report a problem" });
  await expect(sheet.getByRole("switch")).toHaveCount(0);
  await sheet.getByLabel("What went wrong?").fill("Can't sign in");
  await sheet.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.locator(".toast")).toContainText("Thank you. Your report was sent.");
  expect(posts(state)[0].body).toEqual({ kind: "problem", message: "Can't sign in", build: "BUILD 2026.10.07-D", platform: "web", language: "en" });
  expect(posts(state)[0].auth).toBeNull();
});

test("a build without a server: Help's answers and the support email link only; no request", async ({ page }) => {
  const api = [];
  page.on("request", (r) => { if (/\/api\//.test(r.url())) api.push(r.url()); });
  await register(page, { stage: "My Cycle", pcos: "no" });
  await gotoTab(page, "You");
  const help = page.locator("#you-help");
  await expect(help.getByRole("button", { name: "How do I cancel Pro?" })).toBeVisible();
  await expect(help.getByRole("button", { name: "Send feedback" })).toHaveCount(0);
  await expect(help.getByRole("button", { name: "Report a problem" })).toHaveCount(0);
  await expect(help.locator(".helpmailline")).toHaveText("Need help? Write to help@solia.example");
  await expect(help.getByRole("link", { name: "help@solia.example" })).toHaveAttribute("href", "mailto:help@solia.example?subject=Solia%20Health%20support");
  await help.getByRole("button", { name: "How does the free week work?" }).click();
  await expect(help.locator('[data-help="free-week"]')).toContainText("Your first 7 days include everything. After that, saving new entries needs Pro."); // this bundle has the trial gate
  await help.getByRole("button", { name: "How do I connect a watch or ring?" }).click();
  await expect(help.locator('[data-help="watch"]')).toContainText("need the Solia Health phone app");
  await expect(page.locator("#you-privacy")).not.toContainText("Feedback you send");
  expect(api).toEqual([]);
});
