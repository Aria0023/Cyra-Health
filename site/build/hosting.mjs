/* How the web build is hosted (docs/plans/website.md Task 1): the website owns "/", the app lives under /app/.
   One list of rules, used by the local server (site/build/serve.mjs: `npm run preview` and the e2e harness) and pinned
   against render.yaml by src/lib/site.test.mjs, so what the tests serve is what Render is told to serve.
   Pure: no node: imports. */

/** Where the web app lives on the site. The phone apps keep it at the root of their own web view (docs/NATIVE.md). */
export const APP_BASE = "/app/";

/** Rewrites, tried only when no file answers the path (Render's rule): a deep link under /app/ opens the app. */
export const REWRITES = Object.freeze([Object.freeze({ source: "/app/*", destination: "/app/index.html" })]);

/** Paths the browser must revalidate: the site's and the app's shells, both workers and the manifest. */
export const NO_CACHE = Object.freeze(["/", "/index.html", "/sw.js", "/app/", "/app/index.html", "/app/sw.js", "/app/manifest.webmanifest"]);

/** The file a request path names before any rewrite: "/x/" → "x/index.html"; null for a path that climbs out. */
export function fileFor(pathname) {
  let p;
  try { p = decodeURIComponent(String(pathname || "/")); } catch { return null; }
  if (!p.startsWith("/") || p.includes("\0") || p.split("/").includes("..")) return null;
  if (p.endsWith("/")) p += "index.html";
  return p.slice(1);
}

/** The rewrite destination for a path no file answered, or null (then the host serves 404.html with status 404). */
export function rewriteFor(pathname) {
  for (const r of REWRITES) {
    const prefix = r.source.replace(/\*$/, "");
    if (String(pathname || "").startsWith(prefix)) return r.destination;
  }
  return null;
}
