/* The web app moved from "/" to "/app/" (docs/plans/website.md Task 1): nobody loses her log.
   One origin, two deployments. The spec serves the app the way it was served before the move (plain `vite build`: the app at
   the root, its offline worker at /sw.js with scope "/"), registers and logs there, then switches THE SAME origin to today's
   web build (the website at "/", the app under /app/) and checks that
     - "/" sends her straight to /app/ without showing the website, and the app there opens her record (her name, no
       registration), because IndexedDB belongs to the origin, not to the path;
     - the old worker is retired: its registration is gone, the old shell cache is deleted, and the app's own worker is
       registered at /app/sw.js with scope /app/;
     - a first-time visitor still gets the website, ?site=1 always shows it, and an app link (#/…, ?org=) goes to the app. */
import { test, expect } from "@playwright/test";
import path from "node:path";
import { register } from "./lib/onboard.mjs";
import { gotoYou } from "./lib/nav.mjs";
import { ROOT, DIST, buildRootApp } from "./lib/serve.mjs";
import { serveStatic } from "../site/build/serve.mjs";

const registrations = (page) => page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).map((r) => ({ scope: new URL(r.scope).pathname, script: new URL((r.active || r.waiting || r.installing).scriptURL).pathname })));
const shellCaches = (page) => page.evaluate(async () => {
  const out = [];
  for (const name of await caches.keys()) { const c = await caches.open(name); out.push({ name, oldShell: !!(await c.match("/index.html")), newShell: !!(await c.match("/app/index.html")) }); }
  return out;
});
const hasRecord = (page) => page.evaluate(() => new Promise((resolve) => {
  const open = indexedDB.open("cyra");
  open.onerror = () => resolve(false);
  open.onsuccess = () => { const db = open.result; if (!db.objectStoreNames.contains("state")) { db.close(); resolve(false); return; } const g = db.transaction("state").objectStore("state").get("v1"); g.onsuccess = () => { db.close(); resolve(g.result != null); }; g.onerror = () => { db.close(); resolve(false); }; };
}));

test("a record written by the old root app is read by the app at /app/, and the old worker is retired", async ({ page }) => {
  test.setTimeout(240_000);
  const oldDist = await buildRootApp();
  const server = await serveStatic({ root: oldDist });
  try {
    // 1. Before the move: the app at "/", as every existing web user has it.
    await register(page, { url: server.url, stage: "My Cycle", pcos: "no", name: "Maya" });
    await expect(page.locator(".viewpanel main h1")).toContainText(/Good (morning|afternoon|evening), Maya/);
    await expect.poll(() => hasRecord(page)).toBe(true);
    // its offline worker is registered at the root and has cached the old shell
    await expect.poll(async () => (await registrations(page)).map((r) => `${r.script} ${r.scope}`), { timeout: 30_000 }).toEqual(["/sw.js /"]);
    await expect.poll(async () => (await shellCaches(page)).filter((c) => c.oldShell).length, { timeout: 30_000 }).toBe(1);
    await page.evaluate(() => navigator.serviceWorker.ready);

    // 2. The deploy: the same origin now serves the website at "/" and the app under /app/.
    server.setRoot(path.join(ROOT, DIST));

    // 3. She comes back to the address she knows.
    const seen = [];
    page.on("framenavigated", (f) => { if (f === page.mainFrame()) seen.push(new URL(f.url()).pathname); });
    await page.goto(`${server.url}/`);
    await expect(page).toHaveURL(`${server.url}/app/`);
    await expect(page.locator(".navpill")).toBeVisible();
    await expect(page.locator(".viewpanel main h1")).toContainText(/Good (morning|afternoon|evening), Maya/);
    await expect(page.getByRole("button", { name: "Get started" })).toHaveCount(0);
    // the old worker retires itself: one registration, the app's own, and no cache of the old shell
    await expect.poll(async () => (await registrations(page).catch(() => [])).map((r) => `${r.script} ${r.scope}`), { timeout: 30_000 }).toEqual(["/app/sw.js /app/"]);
    await expect.poll(async () => (await shellCaches(page).catch(() => [{ oldShell: true }])).filter((c) => c.oldShell).length, { timeout: 30_000 }).toBe(0);
    await expect.poll(async () => (await shellCaches(page).catch(() => [])).filter((c) => c.newShell).length, { timeout: 30_000 }).toBe(1);
    // and her record is still the one she made before the move
    await expect(page.locator(".navpill")).toBeVisible();
    await gotoYou(page, "Your profile");
    await expect(page.locator("#you-modules")).toBeVisible();
    await expect.poll(() => hasRecord(page)).toBe(true);

    // 4. An old deep link and an old bookmark both land in the app, with the route kept.
    await page.goto(`${server.url}/#/you/privacy`);
    await expect(page).toHaveURL(`${server.url}/app/#/you/privacy`);
    await expect(page.locator(".yousub h1")).toHaveText("Privacy & your data");
    // 5. ?site=1 shows the website even to her.
    await page.goto(`${server.url}/?site=1`);
    await expect(page).toHaveURL(`${server.url}/?site=1`);
    await expect(page.getByRole("link", { name: "Open the web app" }).first()).toBeVisible();
    expect(seen.filter((p) => p !== "/" && p !== "/app/"), "only the website and the app were ever shown").toEqual([]);
  } finally { await server.stop(); }
});

test("a first-time visitor gets the website; app links go to the app; nothing is stored or created by looking", async ({ page }) => {
  const site = process.env.E2E_SITE_URL;
  await page.goto(`${site}/`);
  await expect(page).toHaveURL(`${site}/`);
  await expect(page.locator("h1")).toContainText("tracking that lives on your device");
  await expect(page.locator("html")).not.toHaveAttribute("data-wait", /.*/);
  await expect(page.getByRole("link", { name: "Open the web app" }).first()).toBeVisible();
  // looking for a record never creates a database, and the website keeps nothing
  expect(await page.evaluate(async () => (await indexedDB.databases()).map((d) => d.name))).toEqual([]);
  expect(await page.evaluate(() => [localStorage.length, sessionStorage.length, document.cookie])).toEqual([0, 0, ""]);
  expect(await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length)).toBe(0);
  // an organization link and a hash route are the app's
  // (the app takes ?org= out of the address bar once it has read it, so the request is what shows where she was sent)
  const asked = page.waitForRequest(`${site}/app/?org=lakeside`);
  await page.goto(`${site}/?org=lakeside`);
  await asked;
  await expect(page).toHaveURL(`${site}/app/`);
  await page.goto(`${site}/#/shop`);
  await expect(page).toHaveURL(`${site}/app/#/shop`);
  await expect(page.getByRole("button", { name: "Get started" })).toBeVisible();
  // an installed app (its own window) opens the app
  const ctx = await page.context().browser().newContext();
  const p2 = await ctx.newPage();
  await p2.addInitScript(() => { const mm = window.matchMedia.bind(window); window.matchMedia = (q) => (/display-mode:\s*standalone/.test(q) ? { matches: true, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} } : mm(q)); });
  await p2.goto(`${site}/`);
  await expect(p2).toHaveURL(`${site}/app/`);
  await ctx.close();
});

test("the host rules: /app/* opens the app, an unknown address is a real 404, /legal/* stays where it was", async ({ page, request }) => {
  const site = process.env.E2E_SITE_URL;
  const deep = await request.get(`${site}/app/some/deep/link`);
  expect(deep.status()).toBe(200);
  expect(await deep.text()).toContain('<div id="root"></div>');
  const missing = await request.get(`${site}/no-such-page`);
  expect(missing.status()).toBe(404);
  expect(await missing.text()).toContain("This page doesn't exist");
  for (const p of ["index.html", "privacy.html", "terms.html", "health-data.html", "medical-disclaimer.html", "legal.css"]) expect((await request.get(`${site}/legal/${p}`)).status(), p).toBe(200);
  expect((await request.get(`${site}/app/legal/privacy.html`)).headers()["content-type"], "no second copy of the legal pages under /app/").toContain("text/html"); // the rewrite answers with the app shell
  expect(await (await request.get(`${site}/app/legal/privacy.html`)).text()).toContain('<div id="root"></div>');
  // the two workers and the manifest
  const retiring = await (await request.get(`${site}/sw.js`)).text();
  expect(retiring).toContain("registration.unregister()");
  expect(retiring).not.toContain("@cyra-build");
  const appWorker = await request.get(`${site}/app/sw.js`);
  expect(await appWorker.text()).toContain('"base":"/app/"');
  expect(appWorker.headers()["cache-control"]).toBe("no-cache");
  const manifest = await (await request.get(`${site}/app/manifest.webmanifest`)).json();
  expect([manifest.start_url, manifest.scope, manifest.id]).toEqual(["./", "./", "/"]);
  expect((await request.get(`${site}/manifest.webmanifest`)).status()).toBe(404);
  for (const r of [deep, missing, appWorker]) expect(r.headers()["set-cookie"]).toBeUndefined();
  await page.goto(`${site}/no-such-page`);
  await expect(page.locator("h1")).toHaveText("This page doesn't exist");
});
