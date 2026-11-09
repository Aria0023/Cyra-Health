/* The in-repo end-to-end harness (docs/plans/auto-tracked-spike.md "E2E"). Two projects on one build:
     app  (npm run e2e)      smoke, privacy and the auto-tracked acceptance specs
     axe  (npm run e2e:axe)  axe-core on the main screens in light + dark, Soft + Clear
   lib/serve.mjs builds dist-e2e/ and serves it on a free port; lib/browser.mjs picks the Chromium. */
import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromiumExecutable } from "./lib/browser.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const executablePath = chromiumExecutable();

export default defineConfig({
  testDir: here,
  testMatch: /.*\.spec\.mjs$/,
  globalSetup: path.join(here, "lib", "serve.mjs"),
  outputDir: path.join(here, "test-results"),
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [["list"], ["html", { open: "never", outputFolder: path.join(here, "report") }]] : [["list"]],
  use: {
    ...devices["Pixel 7"],
    isMobile: false, // a plain viewport: no touch emulation, so clicks are ordinary clicks
    hasTouch: false,
    viewport: { width: 390, height: 844 },
    contextOptions: { reducedMotion: "reduce" },
    acceptDownloads: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    launchOptions: executablePath ? { executablePath } : {},
  },
  projects: [
    { name: "app", testIgnore: /axe\.spec\.mjs$/ },
    { name: "axe", testMatch: /axe\.spec\.mjs$/ },
  ],
});
