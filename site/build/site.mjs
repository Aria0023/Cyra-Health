/* Builds the Solia Health website into the web build's out dir (docs/plans/website.md): plain HTML and CSS, the one
   script on "/" (site/static/go.js) and the retiring worker (site/static/sw.js → /sw.js). Run by scripts/build-web.mjs
   after the app has been built into <out>/app/. Never part of the phone build (docs/NATIVE.md). */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { homePage, notFoundPage } from "../pages/index.mjs";

export const SITE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Every page of the site: [path in the out dir, html]. */
export function sitePages(ctx = {}) {
  return [
    ["index.html", homePage(ctx)],
    ["404.html", notFoundPage(ctx)],
  ];
}

/** Writes the site into outDir (which already holds app/). Returns the files written, relative to outDir. */
export function buildSite({ outDir, ctx = {} }) {
  const written = [];
  const put = (rel, data) => { const f = path.join(outDir, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, data); written.push(rel); };
  for (const name of fs.readdirSync(path.join(SITE_DIR, "static"))) put(name, fs.readFileSync(path.join(SITE_DIR, "static", name)));
  for (const [rel, html] of sitePages(ctx)) put(rel, html);
  return written.sort();
}
