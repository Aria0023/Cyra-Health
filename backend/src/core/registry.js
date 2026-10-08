// Module registry: every feature is a module exporting { name, mount(ctx) }.
// Modules are loaded from config/app.json "modules" list — remove a name
// there and the feature (and its routes) simply doesn't exist. Add your own
// module by dropping a folder in src/modules and listing it.
import fs from "fs";
import path from "path";
import express from "express";

export function loadConfig(root) {
  const app = JSON.parse(fs.readFileSync(path.join(root, "config/app.json"), "utf8"));
  const partnersDir = path.join(root, "config/partners");
  const partners = fs
    .readdirSync(partnersDir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(fs.readFileSync(path.join(partnersDir, f), "utf8")));
  const intDir = path.join(root, "config/integrations");
  const integrations = fs.existsSync(intDir) ? fs.readdirSync(intDir).filter(f=>f.endsWith(".json")).map(f=>JSON.parse(fs.readFileSync(path.join(intDir,f),"utf8"))) : [];
  const adminKey = process.env.ADMIN_KEY || app.adminKey;
  const authSecret = process.env.AUTH_SECRET || app.authSecret;
  if (!process.env.ADMIN_KEY || !process.env.AUTH_SECRET) console.warn("[cyra] WARNING: ADMIN_KEY / AUTH_SECRET not set — using the demo values from config/app.json. Set both in the environment before real traffic.");
  return { ...app, adminKey, authSecret, partners, integrations };
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
