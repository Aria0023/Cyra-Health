/* Task 3: every practice free (no Pro chip) with an optional voice guide; Pro "Ask with evidence" against the mocked
   backend (API build, proDev = Pro): the exact body is previewed, only the question (and the summary when ticked) is
   sent, the answer shows numbered source links, and a red-flag question is answered on the device and never sent. */
import { test, expect } from "@playwright/test";
import { register } from "./lib/onboard.mjs";
import { gotoTab, gotoSegment } from "./lib/nav.mjs";
import { mockApi, newApiState } from "./lib/api.mjs";

const ANSWER = { provider: "claude-opus-5-5", answer: "Several non-hormonal options reduce hot flashes. [1][2]\n\nThe evidence for supplements is mixed. [3]", sources: [{ n: 1, title: "Hot flashes | MedlinePlus", url: "https://medlineplus.gov/hotflashes.html" }, { n: 2, title: "Fezolinetant trial", url: "https://pubmed.ncbi.nlm.nih.gov/123/" }, { n: 3, title: "Black cohosh", url: "https://www.ncbi.nlm.nih.gov/books/1/" }] };

test("practices: every one opens (no Pro chip), and the voice guide speaks the breathing cues", async ({ page }) => {
  // A build without recorded clips: the device voice speaks.
  await page.route("**/voice/manifest.json", (r) => r.fulfill({ status: 404, body: "" }));
  await page.addInitScript(() => {
    window.__spoken = [];
    if (window.speechSynthesis) window.speechSynthesis.speak = (u) => { window.__spoken.push(u.text); };
  });
  await register(page, { stage: "Perimenopause" });
  await gotoTab(page, "Mind"); await gotoSegment(page, "Practices");
  await expect(page.locator(".practicespage .v-pro")).toHaveCount(0);
  await expect(page.locator(".prow-btn.locked")).toHaveCount(0);
  await page.locator('.prow-btn[data-practice="box"]').first().click();
  const sheet = page.locator("#practice-sheet");
  await expect(sheet).toBeVisible();
  const voice = sheet.getByRole("switch", { name: "Voice guide" });
  await expect(voice).toHaveAttribute("aria-checked", "false");
  await voice.click();
  await expect(voice).toHaveAttribute("aria-checked", "true");
  await expect(sheet).toContainText("built-in voice reads each step aloud. Nothing is recorded or sent.");
  await sheet.getByRole("button", { name: "Start" }).click();
  await expect.poll(() => page.evaluate(() => window.__spoken)).toContain("Breathe in");
});

test("voice guide plays the recorded calm voice when this build ships clips", async ({ page }) => {
  const { clipId } = await import("../src/lib/voice.js");
  const inId = clipId("Breathe in");
  await page.route("**/voice/manifest.json", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ voice: "Recorded calm voice", clips: { [inId]: `${inId}.mp3` } }) }));
  await page.addInitScript(() => {
    window.__played = []; window.__spoken = [];
    window.Audio = function (src) { this.src = src; this.play = () => { window.__played.push(src); return Promise.resolve(); }; this.pause = () => {}; };
    if (window.speechSynthesis) window.speechSynthesis.speak = (u) => { window.__spoken.push(u.text); };
  });
  await register(page, { stage: "Perimenopause" });
  await gotoTab(page, "Mind"); await gotoSegment(page, "Practices");
  await page.locator('.prow-btn[data-practice="slow"]').first().click();
  const sheet = page.locator("#practice-sheet");
  const voice = sheet.getByRole("switch", { name: "Voice guide" });
  await voice.click();
  await expect(sheet).toContainText("A calm recorded voice guides each step.");
  await sheet.getByRole("button", { name: "Start" }).click();
  await expect.poll(() => page.evaluate(() => window.__played)).toEqual(expect.arrayContaining([expect.stringContaining(`voice/${inId}.mp3`)]));
  // "and out" has no clip in this manifest, so the device voice speaks it.
  await expect.poll(() => page.evaluate(() => window.__spoken), { timeout: 15000 }).toContain("and out");
});

test("Ask with evidence: preview, send only what was shown, numbered sources; a red flag is never sent", async ({ page }) => {
  const state = newApiState({ evidence: () => ({ status: 200, json: ANSWER }) });
  await mockApi(page, state);
  await register(page, { url: process.env.E2E_API_URL, stage: "Perimenopause", signin: "email" });
  await gotoTab(page, "Mind"); await gotoSegment(page, "Journey");
  const card = page.locator("#ai-evidence");
  await expect(card.getByRole("heading", { name: "Ask with evidence" })).toBeVisible();
  await card.getByLabel("Your question").fill("Do non-hormonal treatments help hot flashes?");
  await card.getByRole("checkbox", { name: "Include a summary of my log" }).click();
  await card.getByRole("button", { name: "Review and send" }).click();
  const sheet = page.locator("#ai-send-sheet");
  await expect(sheet.getByRole("heading", { name: "What Solia Health will send" })).toBeVisible();
  await expect(sheet).toContainText("Anthropic's search provider runs the search");
  const shown = JSON.parse(await sheet.locator(".aisend-json").textContent());
  expect(Object.keys(shown).sort()).toEqual(["question", "summary"]);
  expect(state.sent.some((r) => r.path === "/api/ai/evidence")).toBe(false); // nothing before Send
  await sheet.getByRole("button", { name: "Send", exact: true }).click();
  await expect(card.locator(".evsrcs li")).toHaveCount(3);
  await expect(card.locator(".evmark")).toHaveCount(3);
  await expect(card.getByRole("link", { name: /Hot flashes \| MedlinePlus/ })).toHaveAttribute("href", "https://medlineplus.gov/hotflashes.html");
  await expect(card).toContainText("Guidance, not a diagnosis or dosing advice");
  const sent = state.sent.filter((r) => r.path === "/api/ai/evidence");
  expect(sent).toHaveLength(1);
  expect(sent[0].body).toEqual(shown);
  // a red flag: answered here, never sent
  await card.getByLabel("Your question").fill("I'm soaking a pad every hour and feel faint");
  await card.getByRole("button", { name: "Review and send" }).click();
  await expect(card).toContainText("Your question wasn't sent anywhere.");
  await expect(page.locator("#ai-send-sheet")).toHaveCount(0);
  expect(state.sent.filter((r) => r.path === "/api/ai/evidence")).toHaveLength(1);
  // a refusal and no-sources say so plainly
  state.evidence = () => ({ status: 200, json: { refused: true, answer: "", sources: [] } });
  await card.getByLabel("Your question").fill("Another question about cycles?");
  await card.getByRole("button", { name: "Review and send" }).click();
  await page.locator("#ai-send-sheet").getByRole("button", { name: "Send", exact: true }).click();
  await expect(card).toContainText("This one can't be answered here. Please ask your clinician.");
  state.evidence = () => ({ status: 502, json: { error: "no-sources" } });
  await card.getByRole("button", { name: "Review and send" }).click();
  await page.locator("#ai-send-sheet").getByRole("button", { name: "Send", exact: true }).click();
  await expect(card).toContainText("No sources could be found for that just now");
});

test("the Pro sheet leads with Ask with evidence and no longer sells practices", async ({ page }) => {
  await mockApi(page, newApiState());
  await register(page, { url: process.env.E2E_API_URL, stage: "My Cycle", signin: "email" });
  await gotoTab(page, "You");
  await page.locator("#you-plan").getByRole("button", { name: /See what Pro adds|See Pro plans/ }).click();
  const items = page.locator("#pro-sheet .prolist li b");
  await expect(items.first()).toHaveText("Ask with evidence");
  await expect(page.locator("#pro-sheet")).not.toContainText("practices library");
  await expect(page.locator("#pro-sheet .profree")).toContainText("every guided practice with its voice guide");
});
