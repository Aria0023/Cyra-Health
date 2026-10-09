// Module registry: every feature is a module exporting { mount(router, ctx) } and,
// optionally, basePath. Which modules load is configuration:
//   NODE_ENV=production → config/app.json: only what the shipped app calls
//                         (oauth, integrations, pulse, push, ai). ADMIN_KEY and
//                         AUTH_SECRET come from the environment only, and the server
//                         refuses to start when either is unset or a demo value.
//   any other NODE_ENV  → config/app-dev.json: every module, the ops console and
//                         demo secrets, for local work and demos.
//   CYRA_CONFIG=<file>  → that file instead (tests), in either mode.
// Add your own module by dropping a folder in src/modules and listing it.
// Secret values are never logged — only the names of the variables at fault.
import fs from "fs";
import path from "path";
import crypto from "crypto";
import express from "express";

export const PRODUCTION_MODULES = ["oauth", "integrations", "pulse", "push", "ai"];
const DEMO_VALUES = ["demo-admin-key-change-me", "demo-auth-secret-change-me"];
const env = (k) => (process.env[k] || "").trim();
const isProduction = () => env("NODE_ENV") === "production";
/** The environment variable that holds a partner's webhook secret, e.g. PARTNER_MIDI_WEBHOOK_SECRET. */
export const partnerSecretVar = (id) => `PARTNER_${String(id).toUpperCase().replace(/[^A-Z0-9]/g, "_")}_WEBHOOK_SECRET`;

/** Why `value` can't be a production secret, or null when it can. Never includes the value. */
function secretProblem(name, value, demoValues) {
  if (!value) return `${name} is not set`;
  if (demoValues.includes(value) || /change-?me|^demo[-_]|^test[-_]|^example/i.test(value)) return `${name} is still a demo/placeholder value`;
  if (value.length < 16) return `${name} is shorter than 16 characters`;
  return null;
}

export class ConfigError extends Error {}

export function loadConfig(root) {
  const prod = isProduction();
  const devFile = path.join(root, "config/app-dev.json");
  const file = path.resolve(root, env("CYRA_CONFIG") || (prod || !fs.existsSync(devFile) ? "config/app.json" : "config/app-dev.json"));
  const app = JSON.parse(fs.readFileSync(file, "utf8"));
  const partnersDir = path.join(root, "config/partners");
  const partners = fs
    .readdirSync(partnersDir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(fs.readFileSync(path.join(partnersDir, f), "utf8")))
    .map((p) => (env(partnerSecretVar(p.id)) ? { ...p, webhookSecret: env(partnerSecretVar(p.id)) } : p));
  const intDir = path.join(root, "config/integrations");
  const integrations = fs.existsSync(intDir) ? fs.readdirSync(intDir).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(fs.readFileSync(path.join(intDir, f), "utf8"))) : [];
  const modules = Array.isArray(app.modules) ? app.modules : [];

  let adminKey = env("ADMIN_KEY"), authSecret = env("AUTH_SECRET");
  if (prod) {
    let demoValues = [...DEMO_VALUES];
    try { const dev = JSON.parse(fs.readFileSync(devFile, "utf8")); demoValues = demoValues.concat([dev.adminKey, dev.authSecret].filter(Boolean)); } catch { /* no dev config */ }
    const problems = [secretProblem("ADMIN_KEY", adminKey, demoValues), secretProblem("AUTH_SECRET", authSecret, demoValues)];
    if (adminKey && adminKey === authSecret) problems.push("ADMIN_KEY and AUTH_SECRET must be different values");
    if (modules.includes("webhooks")) for (const p of partners) problems.push(secretProblem(partnerSecretVar(p.id), env(partnerSecretVar(p.id)), demoValues));
    const bad = problems.filter(Boolean);
    if (bad.length) {
      throw new ConfigError(
        `[cyra] FATAL: refusing to start with NODE_ENV=production:\n${bad.map((b) => `  - ${b}`).join("\n")}\n` +
          `Set real values in Render → cyra-backend → Environment (generate each with: openssl rand -hex 32). Values are never printed.`
      );
    }
  } else {
    if (!adminKey || !authSecret) console.warn(`[cyra] development mode: ${[!adminKey && "ADMIN_KEY", !authSecret && "AUTH_SECRET"].filter(Boolean).join(" / ")} not set — using ${app.adminKey || app.authSecret ? `the demo values from ${path.relative(root, file)}` : "a random value for this run"}. NODE_ENV=production refuses to start without real ones.`);
    adminKey ||= app.adminKey || crypto.randomBytes(24).toString("hex");
    authSecret ||= app.authSecret || crypto.randomBytes(24).toString("hex");
  }
  const { adminKey: _a, authSecret: _s, ...rest } = app; // the file's demo values never travel past here in production
  return { ...rest, modules, production: prod, adminKey, authSecret, partners, integrations };
}

export async function mountModules(appServer, ctx) {
  for (const name of ctx.config.modules) {
    const mod = await import(`../modules/${name}/index.js`);
    const router = express.Router();
    mod.mount(router, ctx);
    appServer.use(mod.basePath || `/api/${name}`, router);
    console.log(`[cyra] module mounted: ${name}`);
  }
}
