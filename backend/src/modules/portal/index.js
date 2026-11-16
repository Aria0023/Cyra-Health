// The partner portal's web page (docs/plans/partner-portal.md Task 2): a static page served by the backend at /portal/
// (backend/public/portal: index.html + portal.js + portal.css + two font files; no framework, no build step, nothing from
// another server). /portal/apply is the public "Apply to partner" form; everything else needs a portal sign-in and talks
// to the shop module's API (/api/shop) on this same origin. Listed in config/app.json beside shop.
// Headers: a strict Content-Security-Policy (only this origin; no inline script or style; no framing), no referrer,
// nosniff, and no-cache on the page so a deploy is picked up at once.
import path from "path";
import express from "express";
import { fileURLToPath } from "url";

export const basePath = "/portal";
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../../public/portal");
export const CSP = "default-src 'self'; img-src 'self' blob:; style-src 'self'; script-src 'self'; font-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; object-src 'none'";

export function mount(router) {
  router.use((req, res, next) => {
    res.set({ "content-security-policy": CSP, "x-frame-options": "DENY", "referrer-policy": "no-referrer", "x-content-type-options": "nosniff", "cross-origin-opener-policy": "same-origin" });
    if (req.method !== "GET" && req.method !== "HEAD") return res.status(405).end();
    next();
  });
  const page = (req, res) => {
    if (req.originalUrl === "/portal") return res.redirect(301, "/portal/"); // relative asset paths need the slash
    res.set("cache-control", "no-cache");
    res.sendFile(path.join(dir, "index.html"));
  };
  router.get(["/", "/apply", "/apply/"], page);
  router.use(express.static(dir, { index: false, maxAge: "1h", fallthrough: true }));
  router.use((req, res) => res.status(404).type("text/plain").send("Not found"));
}
