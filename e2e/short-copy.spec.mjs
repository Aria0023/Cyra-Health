/* Shorter visible copy (2026-11-25, docs/plans/critique-fixes.md Task 4): each heavy block shows ONE plain sentence; the
   full text, word for word, is under the app's Details, closed until she opens it. The API build against the mock backend. */
import { test, expect } from "@playwright/test";
import { register } from "./lib/onboard.mjs";
import { gotoYou, gotoTab, openLog } from "./lib/nav.mjs";
import { mockApi, newApiState } from "./lib/api.mjs";
import { plateFile } from "./lib/photo.mjs";

const API_URL = () => process.env.E2E_API_URL;
/** The Details right after `lead` inside `scope`: closed, holding `full`; opening it shows `full`. */
async function folded(scope, full) {
  const panel = scope.locator(".morewrap .bodypanel.more", { hasText: full }).last(); // the innermost (a Details may sit inside another)
  await expect(panel).toBeHidden();
  await expect(panel).toContainText(full);
  await panel.locator("xpath=..").getByRole("button").first().click();
  await expect(panel).toBeVisible();
}

test("meal photo send sheet and the AI send sheet: one line, the rest under Details", async ({ page }) => {
  const state = newApiState({ meal: () => ({ status: 200, json: { provider: "x", food: true, sure: "medium", total: { low: 1, high: 2 }, items: [{ name: "Rice", portion: "a cup", low: 1, high: 2 }] } }), chat: () => ({ status: 200, json: { answer: "Steadier." } }) });
  await mockApi(page, state);
  await register(page, { url: API_URL(), stage: "My Cycle", pcos: "no", signin: "email" });
  await gotoYou(page, "Your profile");
  await page.locator("#you-modules").getByRole("switch", { name: "Meal notes" }).click();
  await gotoYou(page, "Solia Health's AI");
  await page.locator("#you-ai").getByRole("switch", { name: "Meal photos" }).click();
  await page.locator("#meal-on-sheet").getByRole("button", { name: "Turn on meal photos" }).click(); // 2026-11-26: the switch opens the confirmation
  await page.locator("#you-ai").getByRole("switch", { name: "Chat about your log" }).click();
  const log = await openLog(page);
  await log.getByRole("button", { name: "Meals", exact: true }).click();
  await page.locator("#meals-sheet .mealslots").getByRole("button", { name: "Lunch", exact: true }).click();
  await page.locator('#meals-sheet input[data-pick="camera"]').setInputFiles(plateFile(800, 600));
  const send = page.locator("#meal-send-sheet");
  await expect(send.locator(".aisend-lead")).toHaveText("Only this photo, with your sign-in so it counts toward this month, goes through Solia Health's server to Anthropic, which keeps it for a limited time; nothing from your log goes, and Solia Health's server doesn't keep it.");
  await expect(send.getByRole("heading", { name: "What goes with it" })).toBeHidden();
  await folded(send, "Exactly the photo below goes through Solia Health's server to Anthropic, maker of the Claude AI");
  await expect(send.getByRole("heading", { name: "What goes with it" })).toBeVisible();
  await expect(send).toContainText("Nothing from your log: no stage, no notes, no meal details.");
  await send.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.locator("#meals-sheet .v2sheet-close").click();
  // the chat's send sheet
  await gotoTab(page, "Mind");
  await page.locator(".subnav").getByRole("button", { name: "Journey", exact: true }).click();
  await page.locator("#ai-chat-q").fill("What stands out?");
  await page.locator("#ai-chat").getByRole("button", { name: "Preview and send" }).click();
  const ai = page.locator("#ai-send-sheet");
  await expect(ai.locator(".aisend-lead")).toHaveText("Only the text below goes, through Solia Health's server, to Anthropic, which keeps it for a limited time; Solia Health's server doesn't keep it.");
  await folded(ai, "Exactly the text below goes through Solia Health's server to Anthropic, maker of the Claude AI, which keeps it for a limited time.");
  expect(state.sent.filter((r) => /\/api\/ai\//.test(r.path) && r.method === "POST")).toHaveLength(0);
});

test("feedback foot, privacy rows, sign-in and the Shop footer: one line, the rest under Details", async ({ page }) => {
  const state = newApiState();
  await mockApi(page, state);
  // sign-in step
  await page.goto(`${API_URL()}/`);
  await page.getByRole("button", { name: "Get started" }).click();
  await expect(page.locator(".signin-sharedshort")).toHaveText("Signing in gives Solia Health's server an account (how you signed in, and your email or name), kept until you delete it, and never your health log.");
  await expect(page.getByRole("button", { name: "What signing in shares" })).toHaveAttribute("aria-expanded", "false");
  await page.getByRole("button", { name: "Try it first" }).click();
  await register(page, { url: API_URL(), stage: "My Cycle", pcos: "no", signin: null, resume: true });
  // the feedback sheet's preview foot
  await gotoYou(page, "Help & about");
  await page.locator("#you-help").getByRole("button", { name: "Send feedback" }).click();
  const fb = page.getByRole("dialog", { name: "Send feedback" });
  await fb.getByRole("button", { name: "What will be sent" }).click();
  await fb.getByLabel("Your feedback").fill("Lovely calendar.");
  await expect(fb.locator(".fbfoot")).toHaveText("Nothing else goes: nothing from your log and no sign-in, and Solia Health's team keeps it for 365 days.");
  await folded(fb, "Like any request, it shows your device's internet address");
  await expect(fb).toContainText("It's kept for 365 days, then deleted.");
  await fb.getByRole("button", { name: "Close" }).first().click();
  // privacy rows with more than two sentences
  await gotoYou(page, "Privacy & your data");
  const privacy = page.locator("#you-privacy");
  await privacy.getByRole("button", { name: "How this works" }).click();
  const row = privacy.locator(".flowrow", { hasText: "Feedback you send" });
  await expect(row.locator(".flowline")).toHaveText("Only when you press Send: your message, the app's version, platform and language, and your email only if you allow a reply, go to Solia Health's server, which keeps them for 365 days.");
  await folded(row, "Nothing from your log is attached.");
  for (const r of await privacy.locator(".flowline").allInnerTexts()) expect(r.split(/(?<=\.)\s+(?=[A-Z])/).length, r).toBeLessThanOrEqual(2);
  // the Shop footer
  await page.locator("header.mast").getByRole("button", { name: "Shop", exact: true }).click();
  const foot = page.locator("main.shoppage .shopfoot");
  await expect(foot.locator(".shopfoot-short")).toHaveText("Matched on this device; nothing about you is sent.");
  await folded(foot, "An affiliate link tells that shop you came from Solia Health");
});
