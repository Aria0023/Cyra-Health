/* Builds the Solia Health website into the web build's out dir (docs/plans/website.md): plain HTML and one CSS file, the
   one script on "/" (site/static/go.js → /site/go.js) and the retiring worker (site/static/sw.js → /sw.js). Run by
   scripts/build-web.mjs after the app has been built into <out>/app/. Never part of the phone build (docs/NATIVE.md).

   Everything the pages say about the app is read from the app's own modules (app-data.mjs); the colours are the app's
   Soft tokens (tokens.mjs); the faces are the app's own font files (@fontsource-variable, the same packages src/main.jsx
   imports), copied so no page asks another origin for anything. */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { loadAppData } from "./app-data.mjs";
import { tokensCss, themeColors } from "./tokens.mjs";
import { makeCopy } from "../pages/copy.mjs";
import { homePage, notFoundPage } from "../pages/home.mjs";
import { supportPage } from "../pages/support.mjs";
import { deleteAccountPage } from "../pages/delete.mjs";
import { robotsTxt, sitemapXml } from "./seo.mjs";

export const SITE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ROOT = path.resolve(SITE_DIR, "..");
/** Where the site's own files live on the site (the app's are under /app/). */
export const ASSETS = "/site/";

/* The faces the app bundles: Fraunces with its optical-size axis and Karla, latin and latin-ext (the extra file is
   fetched only if a page ever shows such a letter). Their @font-face rules are the packages' own, with our addresses. */
const FONT_CSS = [["@fontsource-variable/fraunces", "opsz.css"], ["@fontsource-variable/karla", "index.css"]];
const FONT_KEEP = /^(fraunces|karla)-latin(-ext)?-/;

export function siteFonts() {
  const files = [];
  let css = "";
  for (const [pkg, file] of FONT_CSS) {
    const dir = path.join(ROOT, "node_modules", pkg);
    const src = fs.readFileSync(path.join(dir, file), "utf8");
    for (const m of src.matchAll(/\/\* ([a-z0-9-]+) \*\/\s*(@font-face\s*\{[^}]+\})/g)) {
      if (!FONT_KEEP.test(m[1])) continue;
      const name = `${m[1]}.woff2`;
      const from = path.join(dir, "files", name);
      if (!fs.existsSync(from)) throw new Error(`[solia] ${pkg} has no files/${name}`);
      files.push({ name, from });
      css += `${m[2].replace(/url\(\.\/files\/[^)]+\)/, `url(${ASSETS}fonts/${name})`).replace(/\s+/g, " ")}\n`;
    }
  }
  return { css, files };
}

const hashOf = (data) => createHash("sha256").update(data).digest("hex").slice(0, 10);
const read = (...p) => fs.readFileSync(path.join(SITE_DIR, ...p));

/** The stylesheet: the faces, the app's tokens, then the site's rules (site/css/site.css). */
export function siteCss(d) {
  return `${siteFonts().css}${tokensCss(d.tokens)}\n${read("css", "site.css").toString("utf8")}`;
}

/** What every page needs: the app's data, the addresses of the site's files, which pages exist. */
export function siteContext(d) {
  const css = siteCss(d);
  const shots = JSON.parse(read("img", "shots.json").toString("utf8"));
  return {
    d, shots, theme: themeColors(d.tokens),
    pages: PAGES.map((p) => p.id),
    assets: {
      css: `${ASSETS}site.css?v=${hashOf(css)}`,
      go: `${ASSETS}go.js?v=${hashOf(read("static", "go.js"))}`,
      img: `${ASSETS}img/`,
      preload: [`${ASSETS}fonts/fraunces-latin-opsz-normal.woff2`, `${ASSETS}fonts/karla-latin-wght-normal.woff2`],
    },
  };
}

/** The site's pages: id (its folder; "" for the front page), file in the out dir, and how it is written. */
export const PAGES = [
  { id: "", rel: "index.html", path: "/", render: homePage },
  { id: "support", rel: "support/index.html", path: "/support/", render: supportPage },
  { id: "delete-account", rel: "delete-account/index.html", path: "/delete-account/", render: deleteAccountPage },
  { id: "404", rel: "404.html", path: null, render: notFoundPage }, // never in the sitemap
];

/** Every page as { id, rel, html, claims }: claims is each sentence the page shows with the file that makes it true. */
export function renderPages(d) {
  const ctx = siteContext(d);
  return PAGES.map((p) => { const c = makeCopy(p.rel); const html = p.render(ctx, c); return { id: p.id, rel: p.rel, html, claims: c.claims }; });
}

/** Writes the site into outDir (which already holds app/). Returns the files written, relative to outDir. */
export async function buildSite({ outDir, data = null }) {
  const d = data || await loadAppData();
  const written = [];
  const put = (rel, bytes) => { const f = path.join(outDir, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, bytes); written.push(rel); };
  const site = (rel) => `${ASSETS.slice(1)}${rel}`;
  put("sw.js", read("static", "sw.js"));
  put(site("go.js"), read("static", "go.js"));
  put(site("site.css"), siteCss(d));
  for (const f of siteFonts().files) put(site(`fonts/${f.name}`), fs.readFileSync(f.from));
  for (const name of fs.readdirSync(path.join(SITE_DIR, "img")).filter((n) => /\.(webp|jpg)$/.test(n))) put(site(`img/${name}`), read("img", name));
  for (const p of renderPages(d)) put(p.rel, p.html);
  put("robots.txt", robotsTxt(d.site.url));
  const sitemap = sitemapXml(d.site.url, PAGES.filter((p) => p.path).map((p) => p.path));
  if (sitemap) put("sitemap.xml", sitemap);
  else console.warn("\n[solia] WARNING: the website doesn't know its own address (set VITE_SITE_URL; on Render it is read from RENDER_EXTERNAL_URL), so no canonical links and no sitemap.xml were written.\n");
  return written.sort();
}
