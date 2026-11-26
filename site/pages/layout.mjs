/* The frame every website page shares: <head>, the header, the footer, a phone with a real app screenshot.
   Plain strings, no inline style and no inline script (the pages carry a strict Content-Security-Policy). */
import { LABEL, escAttr } from "./copy.mjs";

/* Nothing but this site's own files may load, and no form can post anywhere: the browser enforces "requests nothing from
   another origin" even if a later edit slips a link in. */
export const CSP = "default-src 'none'; img-src 'self'; style-src 'self'; font-src 'self'; script-src 'self'; manifest-src 'self'; base-uri 'none'; form-action 'none'";

const SRC_BRAND = "docs/brand/README.md the product's name";

/** Where a link goes: a page when the site has it, else the fallback (an anchor on the front page). */
export const hrefFor = (ctx, page, fallback) => (ctx.pages.includes(page) ? `/${page}/` : fallback);

export function head(ctx, c, { title, titleSource = LABEL, description, redirect = false, noindex = false, extra = "" }) {
  const { theme, assets } = ctx;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${CSP}">
<meta name="referrer" content="no-referrer">
<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="${theme.light}" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="${theme.dark}" media="(prefers-color-scheme: dark)">
<title>${c.t(title, titleSource)}</title>
<meta name="description" content="${c.attr(description.text, description.source)}">
${noindex ? '<meta name="robots" content="noindex">\n' : ""}${extra}<link rel="icon" type="image/svg+xml" href="/app/icons/favicon.svg">
<link rel="icon" type="image/png" sizes="192x192" href="/app/icons/icon-192.png">
<link rel="apple-touch-icon" href="/app/icons/apple-touch-icon.png">
${assets.preload.map((f) => `<link rel="preload" href="${f}" as="font" type="font/woff2" crossorigin>`).join("\n")}
<link rel="stylesheet" href="${assets.css}">
${redirect ? `<script src="${assets.go}"></script>\n` : ""}</head>`;
}

export function header(ctx, c, { home = false } = {}) {
  const at = (id) => (home ? `#${id}` : `/?site=1#${id}`);
  const nav = [["privacy", "Privacy"], ["stages", "Life stages"], ["features", "What it does"], ["pricing", "Pricing"], ["questions", "Questions"]];
  return `<a class="skip" href="#content">${c.t("Skip to the content", LABEL)}</a>
<header class="top">
<div class="wrap top-in">
<a class="brand" href="/?site=1">${ctx.d.brandMark}<span class="brand-name">${c.t("Solia", SRC_BRAND)}</span> <span class="brand-sub">${c.t("Health", SRC_BRAND)}</span></a>
<nav class="top-nav" aria-label="${c.attr("Sections", LABEL)}">
${nav.map(([id, label]) => `<a href="${at(id)}">${c.t(label, LABEL)}</a>`).join("\n")}
</nav>
<a class="btn btn-quiet top-cta" href="/app/">${c.t("Open the web app", "site/build/hosting.mjs APP_BASE: the web app is served at /app/")}</a>
</div>
</header>`;
}

export function footer(ctx, c) {
  const { d } = ctx;
  const support = hrefFor(ctx, "support", "/?site=1#q-cancel");
  const del = hrefFor(ctx, "delete-account", "/?site=1#q-delete");
  const L = "public/legal/";
  return `<footer class="foot">
<div class="wrap foot-in">
<div class="foot-brand">
<a class="brand" href="/?site=1">${d.brandMark}<span class="brand-name">${c.t("Solia", SRC_BRAND)}</span> <span class="brand-sub">${c.t("Health", SRC_BRAND)}</span></a>
<p>${c.t(d.splash.guidance, "src/locales/en-ui.js splash.guidanceNeverADiagnosisFor (the app's first screen)")}</p>
</div>
<nav class="foot-nav" aria-label="${c.attr("Policies and help", LABEL)}">
<ul>
<li><a href="/legal/privacy.html">${c.t("Privacy Policy", `${L}privacy.html`)}</a></li>
<li><a href="/legal/health-data.html">${c.t("Consumer Health Data Privacy Policy", `${L}health-data.html`)}</a> <span class="foot-note">${c.t("(Washington My Health My Data Act)", `${L}health-data.html: "required by Washington's My Health My Data Act (RCW 19.373)"`)}</span></li>
<li><a href="/legal/terms.html">${c.t("Terms of Use", `${L}terms.html`)}</a></li>
<li><a href="/legal/medical-disclaimer.html">${c.t("Medical disclaimer", `${L}medical-disclaimer.html`)}</a></li>
</ul>
<ul>
<li><a href="${support}">${c.t("Support", LABEL)}</a></li>
<li><a href="${del}">${c.t("Delete your account", LABEL)}</a></li>
<li><a href="/app/">${c.t("Open the web app", "site/build/hosting.mjs APP_BASE: the web app is served at /app/")}</a></li>
</ul>
</nav>
${d.legalDraft ? `<p class="foot-draft">${c.h("<strong>Drafts.</strong> The policies and terms linked here are drafts waiting for attorney review; each one says so at its top.", `${L}*.html: every page carries the "Draft, not in effect" notice (checked at build time, site/build/app-data.mjs legalDraft)`)}</p>\n` : ""}<p class="foot-copy">${c.t("© Solia Health", LABEL)}</p>
</div>
</footer>`;
}

/** A phone showing one committed screenshot (site/img/shots.json), light or dark with the visitor's scheme. */
export function phone(ctx, c, id, { eager = false, cls = "" } = {}) {
  const s = ctx.shots[id];
  if (!s) throw new Error(`[solia] no screenshot "${id}" in site/img/shots.json: run npm run site:shots`);
  const load = eager ? 'fetchpriority="high"' : 'loading="lazy" decoding="async"';
  return `<figure class="phone${cls ? ` ${cls}` : ""}">
<picture>
<source media="(prefers-color-scheme: dark)" srcset="${ctx.assets.img}${s.dark}">
<img src="${ctx.assets.img}${s.light}" width="${s.width}" height="${s.height}" alt="${c.attr(s.alt, "site/img/shots.json: a screenshot of the web app captured by site/shots.mjs from the demo seed (VITE_DEMO_SEED)")}" ${load}>
</picture>
</figure>`;
}

export const iconChip = (ctx, name) => `<span class="chip-ico" aria-hidden="true">${ctx.d.icons[name]}</span>`;
export const mailto = (email) => `mailto:${escAttr(email)}`;
