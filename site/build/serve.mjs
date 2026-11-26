/* A small static server that answers the way the Render static site is configured to (site/build/hosting.mjs, pinned
   against render.yaml): a file when there is one, a directory's index.html, the /app/* rewrite for the app's deep
   links, otherwise 404.html with status 404. It sets no cookie and no header beyond the type, length and the no-cache
   rule. Used by `npm run preview` and by the e2e harness (e2e/lib/serve.mjs); never deployed.
     node site/build/serve.mjs [dir] [--port 4173] [--host 127.0.0.1] */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fileFor, rewriteFor, NO_CACHE } from "./hosting.mjs";

const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".webmanifest": "application/manifest+json; charset=utf-8", ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
  ".ico": "image/x-icon", ".woff2": "font/woff2", ".woff": "font/woff", ".mp3": "audio/mpeg", ".pdf": "application/pdf", ".map": "application/json; charset=utf-8",
};
const isFile = (f) => { try { return fs.statSync(f).isFile(); } catch { return false; } };
const isDir = (f) => { try { return fs.statSync(f).isDirectory(); } catch { return false; } };

/** Serves `root`; resolves { url, port, stop, setRoot }. setRoot swaps the folder being served (the e2e move test). */
export function serveStatic({ root, port = 0, host = "127.0.0.1" } = {}) {
  let dir = path.resolve(root);
  const send = (req, res, status, file, pathname) => {
    const headers = { "Content-Type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream", "Content-Length": fs.statSync(file).size };
    if (NO_CACHE.includes(pathname)) headers["Cache-Control"] = "no-cache";
    res.writeHead(status, headers);
    if (req.method === "HEAD") { res.end(); return; }
    fs.createReadStream(file).pipe(res);
  };
  const server = http.createServer((req, res) => {
    if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405, { Allow: "GET, HEAD" }); res.end(); return; }
    const pathname = new URL(req.url, "http://x").pathname;
    const rel = fileFor(pathname);
    if (rel != null) {
      const file = path.join(dir, rel);
      if (file.startsWith(dir + path.sep) && isFile(file)) return send(req, res, 200, file, pathname);
      // a folder asked for without its slash: send her to the folder, as static hosts do
      if (!pathname.endsWith("/") && isDir(path.join(dir, rel)) && isFile(path.join(dir, rel, "index.html"))) { res.writeHead(301, { Location: pathname + "/" }); res.end(); return; }
      const to = rewriteFor(pathname);
      if (to && isFile(path.join(dir, to))) return send(req, res, 200, path.join(dir, to), to);
    }
    const missing = path.join(dir, "404.html");
    if (isFile(missing)) return send(req, res, 404, missing, "/404.html");
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }); res.end("Not found");
  });
  return new Promise((resolve, reject) => {
    server.on("error", reject);
    server.listen(port, host, () => {
      const at = server.address();
      const stop = () => new Promise((done) => { server.closeAllConnections?.(); server.close(() => done()); });
      resolve({ url: `http://${host === "0.0.0.0" ? "localhost" : host}:${at.port}`, port: at.port, stop, setRoot: (next) => { dir = path.resolve(next); } });
    });
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const flag = (name, fallback) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback; };
  const root = args.find((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--"))) || "dist";
  serveStatic({ root, port: Number(flag("--port", process.env.PORT || 4173)), host: flag("--host", "127.0.0.1") }).then((s) => console.log(`[solia] serving ${root} at ${s.url}`));
}
