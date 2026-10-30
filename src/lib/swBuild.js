/* Build-time helpers for the offline shell (spec A14.1). Pure: no node: imports, no browser
   globals. Imported only by vite.config.js (the cyraServiceWorker plugin) and the unit tests;
   the app must never import this file.

   precacheList: which of the build's files public/sw.js keeps — Cyra's own app files and
   nothing else (no source maps, no sw.js itself, no font licence texts).
   injectBuild: writes the BUILD object into the one marked line of public/sw.js. */

const PUBLIC_KEEP = (f) => f === "manifest.webmanifest" || /^icons\/[^/]+\.(png|svg)$/.test(f);

/** Every bundle file except *.map and sw.js, plus manifest.webmanifest and icons/*.png and icons/*.svg (the favicon) from
    public/, de-duplicated, sorted and prefixed with base. */
export function precacheList({ bundleFiles, publicFiles = [], base = "/" }) {
  const norm = (f) => String(f).replace(/\\/g, "/").replace(/^\/+/, "");
  const fromBundle = (bundleFiles || []).map(norm).filter((f) => f && !f.endsWith(".map") && f !== "sw.js");
  const fromPublic = (publicFiles || []).map(norm).filter(PUBLIC_KEEP);
  const prefix = base.endsWith("/") ? base : `${base}/`;
  return [...new Set([...fromBundle, ...fromPublic])].sort().map((f) => prefix + f);
}

const MARKER = /^const BUILD = .*; \/\/ @cyra-build$/m;

/** Replace public/sw.js's `const BUILD = …; // @cyra-build` line with this build's values. */
export function injectBuild(source, build) {
  if (!MARKER.test(source)) throw new Error("[cyra] public/sw.js has no BUILD line to fill (const BUILD = …; // @cyra-build)");
  // A replacer function, so a `$` in a file name is written as it is.
  return source.replace(MARKER, () => `const BUILD = ${JSON.stringify(build)}; // @cyra-build`);
}
