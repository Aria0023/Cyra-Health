// Cyra Health — backend (reference implementation).
// Modular: features load from the config's "modules" list. With NODE_ENV=production
// that is config/app.json — only what the shipped app calls (oauth, integrations,
// pulse, push, ai) — and the server refuses to start without real ADMIN_KEY and
// AUTH_SECRET values. Otherwise config/app-dev.json loads every module, including the
// partner/referral demo (/r/:code) and the ops console at /.
// Plug-and-play: partners are JSON files in config/partners/.
// Customizable: fee models, attribution windows, storage driver — all config.
import path from "path";
import express from "express";
import { loadConfig, mountModules, ConfigError } from "./src/core/registry.js";
import { createStore } from "./src/core/store.js";

const root = new URL(".", import.meta.url).pathname;
let config;
try {
  config = loadConfig(root);
} catch (e) {
  if (e instanceof ConfigError) {
    console.error(e.message);
    process.exit(1);
  }
  throw e;
}
const store = createStore(config);
const ctx = { config, store, onShutdown: [] }; // modules push cleanup that must run before exit

const app = express();
app.set("trust proxy", 1); // Render / any reverse proxy: req.ip is the client, not the proxy

// CORS: the static app lives on another origin. CORS_ORIGIN = comma-separated allowlist; unset = any origin (no credentials are ever sent).
const origins = (process.env.CORS_ORIGIN || "*").split(",").map((s) => s.trim()).filter(Boolean);
app.use((req, res, next) => {
  const origin = req.get("origin");
  if (origin && (origins.includes("*") || origins.includes(origin))) {
    res.set("access-control-allow-origin", origins.includes("*") ? "*" : origin);
    res.set("vary", "origin");
    res.set("access-control-allow-methods", "GET,POST,PATCH,DELETE,OPTIONS");
    res.set("access-control-allow-headers", "content-type, authorization, x-admin-key, x-cyra-signature");
    res.set("access-control-max-age", "600");
  }
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});
const keepRaw = (req, res, buf) => {
  req.rawBody = buf; // keep raw body for webhook HMAC verification
};
// Terra's daily/sleep payloads can be larger than the 100 kB default; a refused delivery would
// lose those readings. The route only keeps four fields per day from them (integrations).
app.use("/api/integrations/terra/webhook", express.json({ limit: "5mb", verify: keepRaw }), (err, req, res, next) => {
  // A body that can't be parsed: answer without Express's default handler, which would log
  // part of the (health) payload. Only the error type is logged.
  if (!err) return next();
  console.warn(`[cyra] terra webhook: ${String(err.type || "bad body").slice(0, 40)}`);
  res.status(err.status === 413 ? 413 : 400).json({ error: "body could not be read" });
});
app.use(express.json({ verify: keepRaw }));
app.use(express.urlencoded({ extended: false })); // Apple Sign-In posts its callback as a form

if (config.opsConsole) app.use(express.static(path.join(root, "public"))); // development only
app.get("/health", (req, res) => res.json({ ok: true, service: "cyra-backend" }));
if (config.modules.includes("referrals")) {
  const { redirectHandler } = await import("./src/modules/referrals/index.js");
  app.get("/r/:code", (req, res) => redirectHandler(ctx, req, res));
}

await mountModules(app, ctx);

const port = Number(process.env.PORT) || config.port || 3000;
app.listen(port, () => console.log(`[cyra] backend listening on :${port} (${config.production ? "production" : "development"}: ${config.modules.join(", ")})`));
// Deploys and restarts send SIGTERM: run each module's cleanup first (integrations revokes
// Oura grants no device collected), at most 8 seconds, then exit.
let stopping = false;
for (const sig of ["SIGTERM", "SIGINT"]) process.on(sig, async () => {
  if (stopping) return; stopping = true;
  await Promise.race([Promise.allSettled(ctx.onShutdown.map((fn) => fn())), new Promise((r) => setTimeout(r, 8000).unref())]);
  process.exit(0);
});
