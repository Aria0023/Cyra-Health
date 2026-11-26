/* Keeps the website out of the phone apps (docs/plans/website.md Task 1, docs/NATIVE.md §2). Capacitor copies whatever
   is in dist/ into the iOS and Android projects. The phone build is `npm run build:native` (the app at the root of
   dist/); `npm run build` is the WEB build (the website at the root, the app under app/). Capacitor runs this check
   before every copy (package.json "capacitor:copy:before", so `cap copy` and `cap sync` both run it) and stops when
   dist/ holds the web build.
     node site/build/native-check.mjs [dir]     (dir defaults to Capacitor's web dir, else dist) */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** What is wrong with `dir` as the phone app's web folder: [] when it is the app at the root and nothing of the website. */
export function nativeDistProblems(dir) {
  const has = (rel) => fs.existsSync(path.join(dir, rel));
  if (!has("index.html")) return [`${dir} has no index.html: run "npm run build:native" first`];
  const problems = [];
  const index = fs.readFileSync(path.join(dir, "index.html"), "utf8");
  if (!index.includes('<div id="root"></div>')) problems.push("index.html is not the app's page");
  for (const rel of ["app/index.html", "go.js", "404.html", "site.css", "robots.txt", "sitemap.xml", "support", "delete-account"]) if (has(rel)) problems.push(`${rel} belongs to the website`);
  return problems;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dir = path.resolve(process.argv[2] || process.env.CAPACITOR_WEB_DIR || "dist");
  const problems = nativeDistProblems(dir);
  if (problems.length) {
    console.error(`\n[solia] STOP: ${dir} is not the phone build, so nothing was copied into the phone projects.\n  - ${problems.join("\n  - ")}\n  Run "npm run cap:sync" (it builds the phone app with "npm run build:native" first). "npm run build" is the website build.\n`);
    process.exit(1);
  }
  console.log(`[solia] ${path.basename(dir)}/ is the phone build (the app at its root, no website pages).`);
}
