// Cyra Health — enterprise backend (reference implementation).
// Modular: features load from config/app.json "modules".
// Plug-and-play: partners are JSON files in config/partners/.
// Customizable: fee models, attribution windows, storage driver — all config.
import express from "express";
import { loadConfig, mountModules } from "./src/core/registry.js";
import { createStore } from "./src/core/store.js";
import { redirectHandler } from "./src/modules/referrals/index.js";

const root = new URL(".", import.meta.url).pathname;
const config = loadConfig(root);
const store = createStore(config);
const ctx = { config, store };

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
app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf; // keep raw body for webhook HMAC verification
    },
  })
);
app.use(express.urlencoded({ extended: false })); // Apple Sign-In posts its callback as a form

app.use(express.static("public"));
app.get("/health", (req, res) => res.json({ ok: true, service: "cyra-backend" }));
app.get("/r/:code", (req, res) => redirectHandler(ctx, req, res));

await mountModules(app, ctx);

const port = Number(process.env.PORT) || config.port || 3000;
app.listen(port, () => console.log(`[cyra] backend listening on :${port}`));
