/* Captures the website's app screenshots (docs/plans/website.md Task 2): real screens of the web app, from the demo seed
   (VITE_DEMO_SEED=true: illustrative check-ins, no real person), in the default Soft style, light and dark, saved as
   optimised WebP in site/img/ with their sizes in site/img/shots.json. Run by hand when the app's look changes:
     npm run site:shots            (builds dist-shots/, gitignored, then captures)
     SHOTS_SKIP_BUILD=1 npm run site:shots
   Chromium is the one the e2e harness uses (e2e/lib/browser.mjs); nothing is installed or downloaded. The build has the
   shipping default features and no server, so every screen is one the public web app can show. */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, expect } from "@playwright/test";
import { chromiumExecutable } from "../e2e/lib/browser.mjs";
import { register } from "../e2e/lib/onboard.mjs";
import { gotoTab, gotoSegment, openLog } from "../e2e/lib/nav.mjs";
import { serveStatic } from "./build/serve.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = "dist-shots";
const OUT = path.join(ROOT, "site", "img");
const VIEW = { width: 390, height: 844 };
const QUALITY = 0.82;

/* Each shot: the file name, what the alt text says (every one names the example data), and how to get there. */
export const SHOTS = [
  { id: "home", alt: "Solia Health's Home screen with example data: a ring showing the cycle day and phase, a card with the range of days the next period is likely to start, and Quick log buttons for symptoms, sleep, mood and movement.", go: async () => {} },
  { id: "log", alt: "Solia Health's Log something sheet with example data: a list of what can be logged today, opened from the plus button.", go: async (page) => { await openLog(page); } },
  { id: "patterns", alt: "Solia Health's Patterns screen with example data: a timeline of the last cycles with their lengths, and this week's body and mind rings.", go: async (page) => { await gotoTab(page, "Patterns"); } },
  { id: "calendar", alt: "Solia Health's Calendar with example data: a month with logged period days, the predicted next period and the estimated fertile window.", go: async (page) => { await gotoTab(page, "Body"); await gotoSegment(page, "Calendar"); } },
  { id: "report", alt: "Solia Health's Report screen with example data: the summary for an appointment and the Download PDF button.", go: async (page) => { await gotoTab(page, "Patterns"); await gotoSegment(page, "Report"); } },
];

/* Tips and the getting-started card are first-week helpers; a visitor should see the screen itself. */
async function tidy(page) {
  for (let i = 0; i < 4; i++) {
    const got = page.getByRole("button", { name: "Got it" }).first();
    if (!(await got.isVisible().catch(() => false))) break;
    await got.click();
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(350);
}

async function toWebp(page, png) {
  const b64 = await page.evaluate(async ({ data, q }) => {
    const img = new Image();
    img.src = `data:image/png;base64,${data}`;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    c.getContext("2d").drawImage(img, 0, 0);
    const blob = await new Promise((r) => c.toBlob(r, "image/webp", q));
    const buf = new Uint8Array(await blob.arrayBuffer());
    let s = ""; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return btoa(s);
  }, { data: png.toString("base64"), q: QUALITY });
  return Buffer.from(b64, "base64");
}

async function main() {
  if (process.env.SHOTS_SKIP_BUILD !== "1" || !fs.existsSync(path.join(ROOT, DIST, "app", "index.html"))) {
    const r = spawnSync(process.execPath, ["scripts/build-web.mjs", "--outDir", DIST], { cwd: ROOT, stdio: "inherit", env: { ...process.env, VITE_DEMO_SEED: "true", VITE_FEATURES: "", VITE_API_BASE: "", VITE_SUPPORT_EMAIL: "", CYRA_SKIP_POLICY_FETCH: "1" } });
    if (r.status !== 0) throw new Error("the screenshot build failed");
  }
  fs.mkdirSync(OUT, { recursive: true });
  const server = await serveStatic({ root: path.join(ROOT, DIST) });
  const executablePath = chromiumExecutable();
  const browser = await chromium.launch(executablePath ? { executablePath } : {});
  const meta = {};
  try {
    for (const scheme of ["light", "dark"]) {
      const ctx = await browser.newContext({ viewport: VIEW, deviceScaleFactor: 2, colorScheme: scheme, reducedMotion: "reduce" });
      const page = await ctx.newPage();
      await register(page, { url: `${server.url}/app`, stage: "My Cycle", pcos: "no" });
      await expect(page.locator(".cy")).toHaveAttribute("data-scheme", scheme);
      for (const shot of SHOTS) {
        const sheet = page.locator(".v2sheet .v2sheet-close");
        if (await sheet.isVisible().catch(() => false)) await sheet.click();
        await gotoTab(page, "Home");
        await tidy(page);
        await shot.go(page);
        await tidy(page);
        const png = await page.screenshot({ type: "png" });
        const webp = await toWebp(page, png);
        const file = `${shot.id}-${scheme}.webp`;
        fs.writeFileSync(path.join(OUT, file), webp);
        meta[shot.id] = { ...(meta[shot.id] || {}), [scheme]: file, width: VIEW.width * 2, height: VIEW.height * 2, alt: shot.alt };
        console.log(`[solia] ${file}  ${(webp.length / 1024).toFixed(0)} kB`);
      }
      await ctx.close();
    }
  } finally { await browser.close(); await server.stop(); }
  fs.writeFileSync(path.join(OUT, "shots.json"), JSON.stringify(meta, null, 2) + "\n");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
