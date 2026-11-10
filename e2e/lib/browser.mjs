/* Which Chromium runs the specs. Playwright's own download when it is there (CI runs `npx playwright install
   --with-deps chromium`); otherwise the first chromium-<build>/chrome-linux…/chrome under PLAYWRIGHT_BROWSERS_PATH
   (here /opt/pw-browsers holds build 1243 and PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 forbids a download), or E2E_CHROMIUM. */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

export function chromiumExecutable() {
  if (process.env.E2E_CHROMIUM) return process.env.E2E_CHROMIUM;
  try { const own = chromium.executablePath(); if (own && fs.existsSync(own)) return undefined; } catch { /* no bundled revision */ }
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!root || !fs.existsSync(root)) return undefined;
  const dirs = fs.readdirSync(root).filter((d) => /^chromium-\d+$/.test(d)).sort((a, b) => Number(b.slice(9)) - Number(a.slice(9)));
  for (const d of dirs) {
    for (const sub of fs.readdirSync(path.join(root, d))) {
      for (const bin of ["chrome", "chrome.exe", "Chromium.app/Contents/MacOS/Chromium"]) {
        const p = path.join(root, d, sub, bin);
        if (fs.existsSync(p)) return p;
      }
    }
  }
  return undefined;
}
