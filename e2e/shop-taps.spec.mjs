/* Anonymous shop tap counts (docs/plans/tracking-reports.md Task 1), the API build against the mock backend: opening a
   product ("Visit <brand>" or its picture) sends one POST whose body is exactly { productId }, with no sign-in token, no
   cookie and no referrer, even though she is signed in; the Shop footer and the privacy dashboard say so; with her
   switch off nothing is sent and the footer says nothing is. Since 2026-11-25 the switch is OFF until she turns it on
   (in the Shop footer or in You → Privacy & your data). The build without a server (the other bundle) never sends
   a tap and has no switch. */
import { test, expect } from "@playwright/test";
import { register } from "./lib/onboard.mjs";
import { gotoYou } from "./lib/nav.mjs";
import { mockApi, newApiState } from "./lib/api.mjs";

const API_URL = () => process.env.E2E_API_URL;
const openShop = (page) => page.locator("header.mast").getByRole("button", { name: "Shop", exact: true }).click();
const taps = (state) => state.sent.filter((r) => r.path === "/api/shop/tap");
/** Brand sites are never really opened: every request off the app and the mock API is answered with an empty page. */
const stubShops = (page) => page.context().route(/^https:\/\/(?!api\.solia\.test)/, (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<title>shop</title>" }));

test("opening a product sends exactly { productId }: no token, no cookie, no referrer; the switch turns it off", async ({ page }) => {
  const state = newApiState();
  await mockApi(page, state);
  await stubShops(page);
  await register(page, { url: API_URL(), stage: "Trying to conceive", pcos: "no", signin: "email" });
  await openShop(page);
  const shop = page.locator("main.shoppage");
  // 2026-11-25 (critique-fixes Task 3): OFF until she turns it on; the footer offers the switch once, quietly
  const foot = shop.locator(".shopfoot");
  await expect(foot).toContainText("Help Solia Health see which products people open?");
  const ask = foot.getByRole("switch", { name: "Count my taps anonymously" });
  await expect(ask).toHaveAttribute("aria-checked", "false");
  await expect(foot).toContainText("Matched on this device; nothing about you is sent.");
  await expect(foot).not.toContainText("anonymous tap");
  const [popup0] = await Promise.all([page.waitForEvent("popup"), shop.locator('.shopcard[data-item="easyhome-lh"]').getByRole("link", { name: /Visit Easy@Home/ }).click()]);
  await popup0.close();
  await page.waitForTimeout(500);
  expect(taps(state), "off by default: opening a product sends nothing").toEqual([]);
  await ask.click();
  await expect(ask).toHaveAttribute("aria-checked", "true");
  await expect(page.locator(".toast")).toContainText("Shop taps are now counted anonymously from this device.");
  await expect(shop.locator(".shopfoot")).toContainText("When you open a product, Solia Health counts one anonymous tap for that product. It isn't linked to you or to anything you log.");
  await expect(shop.locator(".shopfoot")).toContainText("Matched on this device: your stage and what you log are never sent.");
  await expect(shop.locator(".shopfoot")).not.toContainText("nothing about you is sent");
  expect(taps(state), "looking at the page sends no tap").toEqual([]);

  // "Visit <brand>": the link still opens (a new tab) and one tap is sent
  const card = shop.locator('.shopcard[data-item="easyhome-lh"]');
  const [popup] = await Promise.all([page.waitForEvent("popup"), card.getByRole("link", { name: /Visit Easy@Home/ }).click()]);
  await popup.close();
  await expect.poll(() => taps(state).length).toBe(1);
  const t = taps(state)[0];
  expect(t.method).toBe("POST");
  expect(t.body, "the whole body").toEqual({ productId: "easyhome-lh" });
  expect(t.search).toBe("");
  expect(t.auth, "no sign-in token, though she is signed in").toBeNull();
  expect(t.cookie).toBeNull();
  expect(t.referer, "no referrer").toBeNull();
  expect(t.headers.filter((h) => /^(authorization|cookie|referer|x-cyra|x-solia)/.test(h))).toEqual([]);
  await expect(page.evaluate(() => JSON.stringify(Object.keys(localStorage)))).resolves.not.toContain("tap");

  // the product picture opens the same page and counts the same way
  const [popup2] = await Promise.all([page.waitForEvent("popup"), card.locator(".shopimg").click()]);
  await popup2.close();
  await expect.poll(() => taps(state).length).toBe(2);
  expect(taps(state)[1].body).toEqual({ productId: "easyhome-lh" });

  // a server that refuses the tap never gets in the way of the link
  state.tapStatus = 500;
  const [popup3] = await Promise.all([page.waitForEvent("popup"), card.getByRole("link", { name: /Visit Easy@Home/ }).click()]);
  await popup3.close();
  await expect.poll(() => taps(state).length).toBe(3);
  state.tapStatus = 204;

  // You → Privacy & your data: the row says exactly what is sent, and its switch turns it off
  await shop.getByRole("button", { name: "Back" }).click();
  await gotoYou(page, "Privacy & your data");
  const privacy = page.locator("#you-privacy");
  await privacy.getByRole("button", { name: "How this works" }).click();
  const row = privacy.locator(".flowrow", { hasText: "Count my shop taps anonymously" });
  await expect(row).toContainText("When you open a product in the Shop, Solia Health's server gets that product's id and nothing else, and adds one to that product's total for the day. No account, no device id, no stage and nothing you logged goes with it.");
  const sw = row.getByRole("switch", { name: "Count my shop taps anonymously" });
  await expect(sw).toHaveAttribute("aria-checked", "true");
  await expect(privacy).toContainText("Turned on now: Count my shop taps anonymously.");
  await sw.click();
  await expect(sw).toHaveAttribute("aria-checked", "false");
  await expect(page.locator(".toast")).toContainText("Shop taps are no longer counted from this device.");
  await gotoYou(page, "Help & about");
  await expect(page.locator("#you-shop")).toContainText("Matched on this device; nothing about you is sent.");

  await openShop(page);
  await expect(shop.locator(".shopfoot")).toContainText("Matched on this device; nothing about you is sent.");
  await expect(shop.locator(".shopfoot")).not.toContainText("anonymous tap");
  const [popup4] = await Promise.all([page.waitForEvent("popup"), shop.locator('.shopcard[data-item="easyhome-lh"]').getByRole("link", { name: /Visit Easy@Home/ }).click()]);
  await popup4.close();
  const [popup5] = await Promise.all([page.waitForEvent("popup"), shop.locator('.shopcard[data-item="easyhome-lh"] .shopimg').click()]);
  await popup5.close();
  await page.waitForTimeout(500);
  expect(taps(state).length, "switch off: no tap request at all").toBe(3);

  // the choice is this device's: it is still off after a reload
  await page.reload();
  await gotoYou(page, "Privacy & your data");
  await page.locator("#you-privacy").getByRole("button", { name: "How this works" }).click();
  await expect(page.locator("#you-privacy").getByRole("switch", { name: "Count my shop taps anonymously" })).toHaveAttribute("aria-checked", "false");
});

test("a build without a server sends no tap and shows no switch", async ({ page }) => {
  await stubShops(page);
  const api = [];
  page.on("request", (r) => { if (/\/api\//.test(r.url())) api.push(r.url()); });
  await register(page, { stage: "Trying to conceive", pcos: "no" });
  await openShop(page);
  const shop = page.locator("main.shoppage");
  await expect(shop.locator(".shopfoot")).toContainText("Matched on this device; nothing about you is sent.");
  await expect(shop.locator(".shopfoot")).not.toContainText("anonymous tap");
  const [popup] = await Promise.all([page.waitForEvent("popup"), shop.locator('.shopcard[data-item="easyhome-lh"]').getByRole("link", { name: /Visit Easy@Home/ }).click()]);
  await popup.close();
  await shop.getByRole("button", { name: "Back" }).click();
  await gotoYou(page, "Privacy & your data");
  await expect(page.locator("#you-privacy")).not.toContainText("Count my shop taps anonymously");
  expect(api).toEqual([]);
});
