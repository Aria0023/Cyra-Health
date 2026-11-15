// Writes backend/config/shop-seed.json from the bundled Shop catalog (src/lib/shopSeed.js). Run after editing
// src/lib/shop.js or src/config/affiliates.json / shop-reviewed.json: npm run shop:seed
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildSeed } from "../src/lib/shopSeed.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"));
const seed = buildSeed({ affiliates: read("src/config/affiliates.json"), signed: read("src/config/shop-reviewed.json").signed });
const out = path.join(root, "backend/config/shop-seed.json");
fs.writeFileSync(out, JSON.stringify(seed, null, 2) + "\n");
console.log(`wrote ${path.relative(root, out)}: ${seed.brands.length} brands, ${seed.products.length} products`);
