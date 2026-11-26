/* The website's pages for the e2e specs (docs/plans/website.md): one list, so a new page is audited everywhere by adding
   it here. `path` is asked of process.env.E2E_SITE_URL; the front page is opened with ?site=1 so it is shown even to a
   browser that already holds a record. */
import { expect } from "@playwright/test";

export const SITE_PAGES = [
  { id: "home", path: "/?site=1", h1: /tracking that lives on your device/ },
  { id: "support", path: "/support/", h1: "Support" },
  { id: "delete-account", path: "/delete-account/", h1: "Delete your Solia Health account and data" },
  { id: "not-found", path: "/no-such-page", h1: "This page doesn't exist", status: 404 },
];

export const WIDTHS = [390, 1280];
export const SCHEMES = ["light", "dark"];

/** Opens a site page and waits for its fonts and for every picture, lazy ones included. */
export async function openSitePage(page, p, { site = process.env.E2E_SITE_URL } = {}) {
  const res = await page.goto(`${site}${p.path}`);
  expect(res.status(), p.path).toBe(p.status || 200);
  await expect(page.locator("h1")).toHaveText(p.h1);
  await page.evaluate(async () => {
    for (const img of document.images) img.loading = "eager";
    await Promise.all([...document.images].map((i) => i.decode().catch(() => {})));
    await document.fonts.ready;
  });
}
