/* The partner portal's e2e backend (docs/plans/partner-portal.md Task 2): a real development server (backend/server.js)
   on a free port of 127.0.0.1, with its own temporary DATA_DIR (the bundled catalog is seeded into it) and
   ADMIN_EMAILS=owner@solia.example. Without RESEND_API_KEY a development server writes each sign-in code to its console,
   which codeFor() reads, so nothing is emailed and nothing leaves the machine. */
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect } from "@playwright/test";
import { ROOT } from "./serve.mjs";

export const OWNER = "owner@solia.example";
const freePort = () => new Promise((resolve, reject) => { const s = createServer(); s.on("error", reject); s.listen(0, "127.0.0.1", () => { const { port } = s.address(); s.close(() => resolve(port)); }); });

export async function startBackend() {
  const port = await freePort();
  const data = fs.mkdtempSync(path.join(os.tmpdir(), "portal-e2e-"));
  const env = { ...process.env, NODE_ENV: "", PORT: String(port), DATA_DIR: data, CYRA_CONFIG: "", ADMIN_EMAILS: OWNER, RESEND_API_KEY: "", EMAIL_FROM: "", PUBLIC_BASE_URL: `http://127.0.0.1:${port}`, AUTH_SECRET: "portal-e2e-secret-0123456789abcdef", ADMIN_KEY: "portal-e2e-admin-0123456789abcdef" };
  const proc = spawn(process.execPath, ["server.js"], { cwd: path.join(ROOT, "backend"), env, stdio: ["ignore", "pipe", "pipe"] });
  let log = "";
  proc.stdout.on("data", (d) => { log += d; });
  proc.stderr.on("data", (d) => { log += d; });
  const url = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(`${url}/health`)).ok) break; } catch { /* not yet */ }
    await new Promise((r) => setTimeout(r, 100));
    if (i === 99) { proc.kill(); throw new Error(`backend never answered\n${log}`); }
  }
  const stop = () => new Promise((resolve) => { proc.once("exit", resolve); proc.kill(); setTimeout(resolve, 2000); }).then(() => fs.rmSync(data, { recursive: true, force: true }));
  /** The last sign-in code the server logged for `email`. */
  const codeFor = (email) => { const all = [...log.matchAll(new RegExp(`sign-in code for ${email.replace(/[.@]/g, "\\$&")} is (\\d{6})`, "g"))]; return all.at(-1)?.[1] || null; };
  return { url, stop, codeFor, log: () => log };
}

/** Signs in on the portal page with the code from the server's console; resolves on the first signed-in view. */
export async function portalSignIn(page, be, email, heading) {
  await page.goto(`${be.url}/portal/`);
  await expect(page.getByRole("heading", { level: 1, name: "Sign in to the partner portal" })).toBeVisible();
  await page.getByLabel("Work email").fill(email);
  const before = be.codeFor(email);
  await page.getByRole("button", { name: "Email me a code" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Enter your code" })).toBeVisible();
  await expect.poll(() => be.codeFor(email)).not.toBe(before);
  await page.getByLabel("6-digit code").fill(be.codeFor(email));
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
}

/** A tiny valid PNG (1x1), for uploads. */
export const PNG_1PX = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
