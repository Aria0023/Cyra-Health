/* The portal's Weekly report page (docs/plans/tracking-reports.md Task 4) against a real development backend and a local
   stand-in for Anthropic (e2e/lib/anthropic.mjs): the owner sees when the next report goes out and to whom, previews
   exactly what would be sent (Claude's summary above the totals, "Totals only; no personal or health data."), sends
   that same text, turns the schedule off and changes the recipients; when the AI call fails the preview is the plain
   template with the same numbers; a partner has no Weekly report page. A development server writes the email to its
   console instead of sending it. */
import { test, expect } from "@playwright/test";
import { startBackend, portalSignIn, portalToken, appAccount, OWNER } from "./lib/portal.mjs";
import { startAnthropic, SUMMARY } from "./lib/anthropic.mjs";

const nav = (page, name) => page.getByRole("navigation", { name: "Portal" }).getByRole("link", { name, exact: true }).click();
const tap = (base, productId) => fetch(`${base}/api/shop/tap`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ productId }) });

test("preview shows exactly what would be sent; send, switch off, recipients; the template when the AI fails", async ({ page, browser }) => {
  const ai = await startAnthropic();
  const be = await startBackend({ env: ai.env });
  try {
    const ids = [];
    for (const e of ["maya@clinic.example", "noor@clinic.example", "ines@clinic.example"]) ids.push((await appAccount(be, e)).id);
    for (const id of ["oura", "oura", "oura", "mira", "mira", "sleepio"]) await tap(be.url, id);
    await portalSignIn(page, be, OWNER, "Overview");
    await nav(page, "Weekly report");
    await expect(page.getByRole("heading", { level: 1, name: "Weekly report" })).toBeFocused();
    const sw = page.getByRole("switch", { name: "Send the weekly report" });
    await expect(sw).toHaveAttribute("aria-checked", "true");
    await expect(page.locator("[data-next]")).toContainText("Next: ");
    expect(new Date(await page.locator("[data-next]").getAttribute("data-next")).getUTCDay(), "a Monday").toBe(1);
    expect(new Date(await page.locator("[data-next]").getAttribute("data-next")).getUTCHours(), "14:00 UTC").toBe(14);
    await expect(page.locator("[data-last]")).toHaveText("Not sent yet.");
    await expect(page.getByLabel("Email addresses")).toHaveValue(OWNER);
    await expect(page.locator("main")).toContainText("Totals only; no personal or health data.");
    await expect(page.locator("main")).toContainText("Development server: reports are written to the server's console instead of being emailed.");

    // preview: Claude's summary above the numbers
    await page.getByRole("button", { name: "Preview", exact: true }).click();
    await expect(page.getByRole("heading", { level: 2, name: "Preview: exactly what would be sent" })).toBeFocused();
    const mail = page.getByRole("group", { name: "Preview: exactly what would be sent" });
    await expect(mail.locator(".mail-subject")).toContainText(/^Subject: Solia Health weekly report: \d{4}-\d{2}-\d{2} to \d{4}-\d{2}-\d{2}$/);
    const body = await mail.locator(".mail-body").innerText();
    expect(body).toContain(SUMMARY);
    for (const line of ["THE NUMBERS", "- Accounts: 3 in all;", "- By sign-in: Apple 0, Google 0, Facebook 0, email 3", "- Not connected (REVENUECAT_SECRET_KEY, REVENUECAT_PROJECT_ID not set on the server).", "- Impact: not connected (IMPACT_ACCOUNT_SID, IMPACT_AUTH_TOKEN not set on the server).", "- Amazon Associates: no report uploaded.", "The summary at the top was written by Claude (Anthropic) from the numbers below it; the numbers are the source.", "Totals only; no personal or health data."]) expect(body, line).toContain(line);
    for (const s of ["clinic.example", ...ids, "maya", "noor"]) expect(body).not.toContain(s);
    // what Anthropic was sent: the totals JSON, with effort low and no thinking parameter
    expect(ai.calls).toHaveLength(1);
    const sent = ai.calls[0];
    expect(sent.body.output_config).toEqual({ effort: "low" });
    expect("thinking" in sent.body).toBe(false);
    expect(sent.beta).toContain("server-side-fallback-2026-07-01");
    const given = JSON.stringify(sent.body.messages) + sent.body.system;
    for (const s of ["clinic.example", ...ids, "@"]) expect(given).not.toContain(s);

    // send exactly this: a development server writes it to its console (nothing is emailed from a test)
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Send this now" }).click();
    await expect(page.locator(".msgbox")).toContainText("Development server: the report was written to the server's console, not emailed.");
    await expect(page.locator("[data-last]")).toContainText(/Last one: .+ sent to 1 address; sent by hand; summary by Claude \(development server/);
    expect(ai.calls, "sending the previewed draft doesn't ask the AI again").toHaveLength(1);
    expect(be.log()).toContain('the weekly report "Solia Health weekly report:');
    expect(be.log()).not.toContain("Accounts: 3 in all");

    // off, and other recipients
    await sw.click();
    await expect(page.locator(".msgbox")).toContainText("The weekly report is off.");
    await expect(page.getByRole("switch", { name: "Send the weekly report" })).toHaveAttribute("aria-checked", "false");
    await expect(page.locator("[data-next]")).toHaveText("Off: nothing is sent on Mondays.");
    await page.getByLabel("Email addresses").fill("not an address");
    await page.getByRole("button", { name: "Save addresses" }).click();
    await expect(page.getByRole("alert")).toContainText("One of the addresses isn't a valid email address.");
    await page.getByLabel("Email addresses").fill(`${OWNER}\ncfo@solia.example`);
    await page.getByRole("button", { name: "Save addresses" }).click();
    await expect(page.locator(".msgbox")).toContainText("Saved.");
    await expect(page.getByLabel("Email addresses")).toHaveValue(`${OWNER}\ncfo@solia.example`);

    // the AI fails: the plain template, same numbers
    ai.state.mode = "fail";
    await page.getByRole("button", { name: "Preview", exact: true }).click();
    const mail2 = page.getByRole("group", { name: "Preview: exactly what would be sent" });
    await expect(mail2.locator(".mail-body")).toContainText("No AI summary this week: this is the plain template with the same numbers.");
    await expect(mail2.locator(".mail-body")).toContainText("- Accounts: 3 in all;");
    await expect(mail2.locator(".mail-body")).not.toContainText("written by Claude");
    await expect(page.locator("#wk-preview .note")).toContainText("The plain template (API 500). To: owner@solia.example, cfo@solia.example.");

    // a partner: no page, 403 from the API
    const token = await portalToken(page);
    expect((await fetch(`${be.url}/api/shop/invites`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify({ email: "pat@oura.example", brandIds: ["oura"] }) })).status).toBe(201);
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const pp = await ctx.newPage();
    await portalSignIn(pp, be, "pat@oura.example", "Products");
    await expect(pp.getByRole("navigation", { name: "Portal" }).getByRole("link", { name: "Weekly report" })).toHaveCount(0);
    const pt = await portalToken(pp);
    for (const [m, p] of [["GET", "/api/insights/weekly"], ["POST", "/api/insights/weekly/preview"], ["POST", "/api/insights/weekly/send"]]) expect((await fetch(`${be.url}${p}`, { method: m, headers: { authorization: `Bearer ${pt}`, "content-type": "application/json" }, body: m === "GET" ? undefined : "{}" })).status, `${m} ${p}`).toBe(403);
    await ctx.close();
  } finally { await be.stop(); await ai.stop(); }
});

test("no AI key: the page says so and the preview is the plain template", async ({ page }) => {
  const be = await startBackend();
  try {
    await portalSignIn(page, be, OWNER, "Overview");
    await nav(page, "Weekly report");
    await expect(page.locator("main")).toContainText("ANTHROPIC_API_KEY isn't set on the server, so the report is the plain template: the same numbers without a written summary.");
    await page.getByRole("button", { name: "Preview", exact: true }).click();
    await expect(page.locator(".mail-body")).toContainText("No AI summary this week: this is the plain template with the same numbers.");
    await expect(page.locator(".mail-body")).toContainText("Totals only; no personal or health data.");
    await expect(page.locator("#wk-preview .note")).toContainText("The plain template (ANTHROPIC_API_KEY isn't set on the server).");
  } finally { await be.stop(); }
});
