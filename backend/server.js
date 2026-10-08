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
app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf; // keep raw body for webhook HMAC verification
    },
  })
);

app.use(express.static("public"));
app.get("/health", (req, res) => res.json({ ok: true, service: "cyra-backend" }));
app.get("/r/:code", (req, res) => redirectHandler(ctx, req, res));

await mountModules(app, ctx);

const port = config.port || 3000;
app.listen(port, () => console.log(`[cyra] backend listening on :${port}`));
