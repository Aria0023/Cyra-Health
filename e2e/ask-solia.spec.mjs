/* Home's "Ask Solia" card and the write-up on Home (docs/plans/visible-features.md Task 1).
   - the build without a server: a "Coming soon" card that says AI isn't connected, with no action but ×; hiding it is a
     device preference and You brings it back;
   - the API build (proDev = Pro, mocked backend): with the chat switch off the card says so and links to You → Solia
     Health's AI without turning anything on; with it on, "Ask" opens the chat with the question typed in and NOT sent
     (nothing goes until the chat's own Preview and send, then Send); "Ask with evidence" does the same for that card;
   - a guest gets the existing "Create account" sheet;
   - the weekly write-up, once she has one, shows on Home under Today's insight and leads Patterns. */
import { test, expect } from "@playwright/test";
import { register } from "./lib/onboard.mjs";
import { gotoTab, toast } from "./lib/nav.mjs";
import { mockApi, newApiState } from "./lib/api.mjs";

const aiSent = (state) => state.sent.filter((r) => r.method === "POST" && r.path.startsWith("/api/ai/"));
const aiSwitch = (page, name) => page.locator("#you-ai").getByRole("switch", { name });

test("no server: a Coming soon card with no dead buttons; hide it, and You brings it back", async ({ page }) => {
  await register(page, { stage: "My Cycle" });
  const card = page.locator("#home-ask");
  await expect(card).toHaveAttribute("data-state", "soon");
  await expect(card.getByRole("heading", { name: "Ask Solia" })).toBeVisible();
  await expect(card).toContainText("Coming soon");
  await expect(card).toContainText("Solia Health's AI isn't connected in this build yet, so there is nothing to ask here for now.");
  await expect(card.locator("button")).toHaveCount(1); // only ×
  await expect(card.locator("textarea")).toHaveCount(0);
  // it sits right under the hero, before Quick log
  expect(await page.evaluate(() => { const a = document.querySelector("#home-ask"), h = document.querySelector(".homehero"), q = document.querySelector(".quicklog"); return !!(h.compareDocumentPosition(a) & 4) && !!(a.compareDocumentPosition(q) & 4); })).toBe(true);
  await card.getByRole("button", { name: "Hide the Ask Solia card" }).click();
  await expect(toast(page)).toContainText("Ask Solia is hidden.");
  await expect(card).toHaveCount(0);
  await expect(page.locator("#quicklog-t")).toBeFocused();
  await page.waitForTimeout(1200); // the record saves 400 ms after the last change
  await page.reload();
  await expect(page.locator(".navpill")).toBeVisible();
  await expect(page.locator("#home-ask")).toHaveCount(0); // kept on this device
  await gotoTab(page, "You");
  const sw = page.getByRole("switch", { name: "Ask Solia on Home" });
  await expect(sw).toHaveAttribute("aria-checked", "false");
  await sw.click();
  await expect(toast(page)).toContainText("Ask Solia is back on Home.");
  await gotoTab(page, "Home");
  await expect(page.locator("#home-ask")).toBeVisible();
});

test("Pro: the switch-off line links to You → Solia Health's AI; Ask types the question into the chat and sends nothing", async ({ page }) => {
  const state = newApiState({ chat: () => ({ status: 200, json: { answer: "Your sleep looks steadier in the last two cycles." } }), evidence: () => ({ status: 200, json: { answer: "It can help. [1]", sources: [{ n: 1, title: "MedlinePlus", url: "https://medlineplus.gov/x.html" }] } }) });
  await mockApi(page, state);
  await register(page, { url: process.env.E2E_API_URL, stage: "Perimenopause", signin: "email" });
  const card = page.locator("#home-ask");
  await expect(card).toHaveAttribute("data-state", "ask");
  // the chat switch is off: said, with the way to it; Ask with evidence needs no switch
  await expect(card).toContainText("Chat about your log is off.");
  await expect(card.getByRole("button", { name: "Ask", exact: true })).toHaveCount(0);
  await expect(card.getByRole("button", { name: "Ask with evidence" })).toBeVisible();
  await card.getByRole("button", { name: "Turn on in You → Solia Health's AI" }).click();
  await expect(page.locator("#you-ai")).toBeInViewport();
  await expect(page.locator("#you-ai").getByRole("heading", { name: "Solia Health's AI" })).toBeVisible();
  await expect(aiSwitch(page, "Chat about your log")).toHaveAttribute("aria-checked", "false"); // the link turned nothing on
  await aiSwitch(page, "Chat about your log").click();
  await gotoTab(page, "Home");
  await expect(card).not.toContainText("Chat about your log is off.");
  await card.getByLabel("Your question").fill("What stands out in my last two cycles?");
  await card.getByRole("button", { name: "Ask", exact: true }).click();
  // the existing chat, in Mind → Journey, with her question typed in and the box focused; nothing sent, no sheet
  await expect(page.locator(".viewpanel main h1")).toHaveText("Journey");
  const box = page.locator("#ai-chat-q");
  await expect(box).toHaveValue("What stands out in my last two cycles?");
  await expect(box).toBeFocused();
  await expect(page.locator("#ai-send-sheet")).toHaveCount(0);
  await expect(page.locator("#ai-chat .aimsg")).toHaveCount(0);
  expect(aiSent(state)).toHaveLength(0);
  // the existing flow from there: preview, then her Send
  await page.locator("#ai-chat").getByRole("button", { name: "Preview and send" }).click();
  const sheet = page.locator("#ai-send-sheet");
  await expect(sheet.getByRole("heading", { name: "What Solia Health will send" })).toBeVisible();
  expect(aiSent(state)).toHaveLength(0);
  await sheet.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.locator("#ai-chat .aimsg.cyra")).toContainText("Your sleep looks steadier");
  expect(aiSent(state).map((r) => r.path)).toEqual(["/api/ai/chat"]);
  expect(aiSent(state)[0].body.question).toBe("What stands out in my last two cycles?");
  // coming back to Journey later doesn't type it again
  await gotoTab(page, "Home"); await gotoTab(page, "Mind");
  await expect(page.locator("#ai-chat-q")).toHaveValue("");
  // Ask with evidence: the same, into that card's box
  await gotoTab(page, "Home");
  await card.getByLabel("Your question").fill("Does magnesium help sleep?");
  await card.getByRole("button", { name: "Ask with evidence" }).click();
  await expect(page.locator("#ai-evidence-q")).toHaveValue("Does magnesium help sleep?");
  await expect(page.locator("#ai-evidence-q")).toBeFocused();
  await expect(page.locator("#ai-send-sheet")).toHaveCount(0);
  expect(aiSent(state).map((r) => r.path)).toEqual(["/api/ai/chat"]);
});

test("a guest: the card offers the existing Create account sheet", async ({ page }) => {
  await mockApi(page, newApiState());
  await register(page, { url: process.env.E2E_API_URL, stage: "My Cycle", signin: "guest" });
  const card = page.locator("#home-ask");
  await expect(card).toHaveAttribute("data-state", "guest");
  await expect(card).toContainText("Solia Health's AI is part of Pro and needs an account.");
  await expect(card.locator("textarea")).toHaveCount(0);
  await card.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("dialog")).toContainText("Create your account");
});

test("the weekly write-up shows on Home under Today's insight and leads Patterns", async ({ page }) => {
  const state = newApiState({ weekly: () => ({ status: 200, json: { writeup: "Hot flashes came up on 9 days.\n\nSleep was steadier in weeks you moved more.", ask_your_doctor: "Are night sweats worth a visit?" } }) });
  await mockApi(page, state);
  await register(page, { url: process.env.E2E_API_URL, stage: "Perimenopause", signin: "email" });
  await expect(page.locator("#home-writeup")).toHaveCount(0); // none yet
  await gotoTab(page, "You");
  await aiSwitch(page, "Weekly write-up").click();
  await gotoTab(page, "Patterns");
  // without a write-up the card keeps its place below the patterns
  expect(await page.evaluate(() => !!(document.querySelector(".patternspage .v2card").compareDocumentPosition(document.querySelector("#ai-writeup")) & 4) && document.querySelector(".patternspage .v2card").id !== "ai-writeup")).toBe(true);
  await page.locator("#ai-writeup").getByRole("button", { name: "Prepare a write-up" }).click();
  await page.locator("#ai-send-sheet").getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.locator("#ai-writeup .aiout")).toContainText("Hot flashes came up on 9 days.");
  expect(await page.evaluate(() => document.querySelector(".patternspage .v2card").id)).toBe("ai-writeup"); // now it leads the page
  await gotoTab(page, "Home");
  const home = page.locator("#home-writeup");
  await expect(home.getByRole("heading", { name: "Solia Health's write-up" })).toBeVisible();
  await expect(home).toContainText("Hot flashes came up on 9 days.");
  await expect(home).toContainText("Are night sweats worth a visit?");
  await expect(home).toContainText("Written by Solia Health's AI (Claude, made by Anthropic) from your summary.");
  await expect(home).toContainText("Associations to raise with your clinician, not a diagnosis or medical advice.");
  expect(await page.evaluate(() => !!(document.querySelector(".insightcard").compareDocumentPosition(document.querySelector("#home-writeup")) & 4))).toBe(true);
  await home.getByRole("button", { name: "Open in Patterns" }).click();
  await expect(page.locator(".viewpanel main h1")).toHaveText("What your log is showing");
  await expect(page.locator("#ai-writeup .aiout")).toBeFocused();
  // switching the write-up off clears it everywhere (the existing rule)
  await gotoTab(page, "You");
  await aiSwitch(page, "Weekly write-up").click();
  await gotoTab(page, "Home");
  await expect(page.locator("#home-writeup")).toHaveCount(0);
});
