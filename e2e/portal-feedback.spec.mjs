/* The portal's Feedback inbox (docs/plans/launch-tools.md Task 3) against a real development backend: what the app
   posts shows newest first; filters by kind and by open / handled; mark handled, reopen, delete; a mailto reply link
   only where she allowed a reply; the open count on Overview and in the weekly report (a count, never the text);
   unknown fields never reach the page; the text is not in the server's log; a partner can't see any of it. */
import { test, expect } from "@playwright/test";
import { startBackend, portalSignIn, portalToken, OWNER } from "./lib/portal.mjs";

let be;
test.beforeAll(async () => { be = await startBackend(); });
test.afterAll(async () => { await be?.stop(); });
const nav = (page, name) => page.getByRole("navigation", { name: "Portal" }).getByRole("link", { name, exact: true }).click();
const post = (body, token) => fetch(`${be.url}/api/feedback`, { method: "POST", headers: { "content-type": "application/json", origin: "https://app.solia.example", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
const base = { build: "BUILD 2026.10.07-D", platform: "ios", language: "en" };

test("Feedback inbox: newest first, filters, handled, delete, reply link, Overview and weekly counts; owner only", async ({ page, browser }) => {
  // an app account, signed in the way the app does it, for the message that allows a reply
  const email = "maya@clinic.example";
  await fetch(`${be.url}/api/accounts/email/start`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }) });
  await expect.poll(() => be.codeFor(email)).not.toBeNull();
  const session = await (await fetch(`${be.url}/api/accounts/email/verify`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, code: be.codeFor(email) }) })).json();
  expect((await post({ kind: "feedback", message: "Love the calendar ZEBRATEXT1", ...base, stage: "ttc", deviceId: "dev-77", email }, session.token)).status).toBe(201);
  expect((await post({ kind: "problem", message: "The chart is blank\nsince the update ZEBRATEXT2", ...base, platform: "android", reply: true, email }, session.token)).status).toBe(201);
  expect((await post({ kind: "problem", message: "x", ...base, reply: true, email })).status, "reply without her session").toBe(401);

  await portalSignIn(page, be, OWNER, "Overview");
  const card = page.getByRole("region", { name: "Feedback" });
  await expect(card.locator('[data-stat="ov-fb-open"] b')).toHaveText("2");
  await card.getByRole("link", { name: "Read feedback" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Feedback" })).toBeFocused();
  await expect(page.getByRole("navigation", { name: "Portal" }).getByRole("link", { name: "Feedback" })).toHaveAttribute("aria-current", "page");
  const items = page.locator("[data-feedback]");
  await expect(items).toHaveCount(2);
  await expect(items.nth(0)).toHaveAttribute("data-kind", "problem"); // newest first
  await expect(items.nth(0).locator(".fb-text")).toHaveText("The chart is blank\nsince the update ZEBRATEXT2");
  await expect(items.nth(0)).toContainText("Android · BUILD 2026.10.07-D · en");
  await expect(items.nth(0).locator("[data-reply]")).toHaveAttribute("href", `mailto:${email}?subject=Your%20message%20to%20Solia%20Health`);
  await expect(items.nth(1).locator("[data-reply]")).toHaveCount(0);
  await expect(items.nth(1)).toContainText("Sent without a reply address");
  const text = await page.locator("main").innerText();
  for (const s of ["ttc", "dev-77", session.account.id]) expect(text).not.toContain(s);
  expect(text.split(email).length - 1, "her address shows once: on the message she allowed a reply to").toBe(1);

  // filters
  await page.getByRole("group", { name: "Kind" }).getByRole("button", { name: "Feedback", exact: true }).click();
  await expect(items).toHaveCount(1);
  await expect(items.first()).toContainText("Love the calendar ZEBRATEXT1");
  await page.getByRole("group", { name: "Kind" }).getByRole("button", { name: "All kinds" }).click();
  // mark handled: it leaves "Open", shows under "Handled", and the count drops
  await items.nth(0).getByRole("button", { name: /^Mark handled/ }).click();
  await expect(page.locator(".msgbox")).toContainText("Marked handled.");
  await expect(items).toHaveCount(1);
  await expect(page.locator('[data-stat="fb-open"] b')).toHaveText("1");
  await page.getByRole("group", { name: "Status" }).getByRole("button", { name: "Handled" }).click();
  await expect(items).toHaveCount(1);
  await expect(items.first()).toHaveAttribute("data-status", "handled");
  await items.first().getByRole("button", { name: /^Reopen/ }).click();
  await expect(page.locator("[data-empty]")).toHaveText("No messages match these filters.");
  await page.getByRole("group", { name: "Status" }).getByRole("button", { name: "All", exact: true }).click();
  await expect(items).toHaveCount(2);
  // delete
  page.once("dialog", (d) => d.accept());
  await items.nth(1).getByRole("button", { name: /^Delete/ }).click();
  await expect(page.locator(".msgbox")).toContainText("Deleted.");
  await expect(items).toHaveCount(1);
  await expect(page.locator('[data-stat="fb-total"] b')).toHaveText("1");
  await expect(page.locator("main")).toContainText("The text is never sent to the AI or put in the weekly report, which carries the count of open messages only.");

  // the weekly report: the count, never the text
  await nav(page, "Weekly report");
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(page.locator(".mail-body")).toContainText("FEEDBACK FROM THE APP (counts only; read it in the portal)\n- Open: 1 (");
  expect(await page.locator(".mail-body").innerText()).not.toMatch(/ZEBRATEXT|chart is blank/);
  // never logged
  expect(be.log()).not.toMatch(/ZEBRATEXT|chart is blank|Love the calendar/);

  // deleting her account deletes the message she linked to it
  expect((await fetch(`${be.url}/api/accounts/me`, { method: "DELETE", headers: { authorization: `Bearer ${session.token}` } })).status).toBe(204);
  await nav(page, "Feedback");
  await page.getByRole("group", { name: "Status" }).getByRole("button", { name: "All", exact: true }).click();
  await expect(page.locator("[data-empty]")).toHaveText("No feedback yet.");

  // a partner: no link, the route falls back, the API answers 403
  const token = await portalToken(page);
  expect((await fetch(`${be.url}/api/shop/invites`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify({ email: "pat@oura.example", brandIds: ["oura"] }) })).status).toBe(201);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const pp = await ctx.newPage();
  await portalSignIn(pp, be, "pat@oura.example", "Products");
  await expect(pp.getByRole("navigation", { name: "Portal" }).getByRole("link", { name: "Feedback" })).toHaveCount(0);
  await pp.goto(`${be.url}/portal/#/feedback`);
  await expect(pp.getByRole("heading", { level: 1, name: "Products" })).toBeVisible();
  const ptoken = await portalToken(pp);
  expect((await fetch(`${be.url}/api/feedback`, { headers: { authorization: `Bearer ${ptoken}` } })).status).toBe(403);
  expect((await fetch(`${be.url}/api/feedback`)).status).toBe(401);
  await ctx.close();
});
