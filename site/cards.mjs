/* Draws pictures from HTML with the e2e harness's Chromium (docs/plans/website.md Tasks 3 and 4): the website's sharing
   card (site/img/og.jpg, 1200×630) and the ad kit (docs/marketing/ads/). Each card is a self-contained page: the app's
   Soft tokens (site/build/tokens.mjs), the app's own Fraunces and Karla files as data: URIs, the committed app
   screenshots from site/img/, and the rules in site/css/cards.css. Nothing is fetched from anywhere.
     npm run site:cards            draws everything
     npm run site:cards -- og      only the sharing card
   The words on every card are listed, with what makes each true, in docs/marketing/ADS.md and (for the sharing card)
   docs/plans/website-claims.md. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadAppData, ROOT } from "./build/app-data.mjs";
import { tokensCss } from "./build/tokens.mjs";
import { siteFonts } from "./build/site.mjs";
import { OG_IMAGE } from "./build/seo.mjs";
import { esc } from "./pages/copy.mjs";

const SITE = path.join(ROOT, "site");
const dataUri = (file, type) => `data:${type};base64,${fs.readFileSync(file).toString("base64")}`;
export const shotUri = (id, scheme = "light") => dataUri(path.join(SITE, "img", `${id}-${scheme}.webp`), "image/webp");

/** The <style> every card shares: faces (as data), tokens, card rules. Light only: ads and sharing cards have one look. */
export function cardCss(d) {
  let fonts = siteFonts().css;
  for (const f of siteFonts().files) fonts = fonts.replace(`url(/site/fonts/${f.name})`, `url(${dataUri(f.from, "font/woff2")})`);
  const tokens = tokensCss(d.tokens).split("\n").filter((line) => !line.startsWith("@media")).join("\n");
  return `${fonts}${tokens}\n${fs.readFileSync(path.join(SITE, "css", "cards.css"), "utf8")}`;
}

/** A complete page for one card. u is the card's unit (1/100 of its shorter side), so one layout scales to any size. */
export function cardDocument(d, { width, height, body, stage = null, vars = "" }) {
  const u = Math.min(width, height) / 100;
  return `<!doctype html><html lang="en"${stage ? ` data-stage="${stage}"` : ""}><head><meta charset="utf-8"><style>${cardCss(d)}\n:root{--w:${width}px;--h:${height}px;--u:${u}px;${vars}}</style></head><body>${body}</body></html>`;
}

export const brandLine = (d) => `<p class="brand">${d.brandMark}Solia <span>Health</span></p>`;
export const phoneFigure = (id) => `<figure class="phone"><img src="${shotUri(id)}" alt=""></figure>`;

/** The website's sharing card: the front page's headline beside the Home screenshot. */
export function ogCard(d, headline) {
  return {
    out: path.join(SITE, "img", OG_IMAGE.file), width: OG_IMAGE.width, height: OG_IMAGE.height, scale: 1, type: "jpeg", quality: 88,
    html: cardDocument(d, { width: OG_IMAGE.width, height: OG_IMAGE.height, vars: "--h1:7.4;--phone:44;", body: `<div class="card wide"><div class="text">${brandLine(d)}<h1>${esc(headline)}</h1></div><div class="art">${phoneFigure("home")}</div></div>` }),
  };
}

/** Draws cards: [{ html, width, height, out, scale, type, quality }]. */
export async function draw(cards) {
  const { chromium } = await import("@playwright/test");
  const { chromiumExecutable } = await import("../e2e/lib/browser.mjs");
  const executablePath = chromiumExecutable();
  const browser = await chromium.launch(executablePath ? { executablePath } : {});
  try {
    for (const card of cards) {
      const ctx = await browser.newContext({ viewport: { width: card.width, height: card.height }, deviceScaleFactor: card.scale || 2, colorScheme: "light", reducedMotion: "reduce", javaScriptEnabled: false, offline: true });
      const page = await ctx.newPage();
      await page.setContent(card.html, { waitUntil: "load" });
      await page.evaluate(() => document.fonts.ready).catch(() => {});
      fs.mkdirSync(path.dirname(card.out), { recursive: true });
      await page.screenshot({ path: card.out, type: card.type || "png", ...(card.type === "jpeg" ? { quality: card.quality || 90 } : {}) });
      console.log(`[solia] ${path.relative(ROOT, card.out)}  ${card.width}×${card.height}${(card.scale || 2) > 1 ? ` @${card.scale || 2}x` : ""}  ${(fs.statSync(card.out).size / 1024).toFixed(0)} kB`);
      await ctx.close();
    }
  } finally { await browser.close(); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const which = process.argv.slice(2);
  const d = await loadAppData();
  const { HOME_HEADLINE } = await import("./pages/home.mjs");
  const cards = [];
  if (!which.length || which.includes("og")) cards.push(ogCard(d, HOME_HEADLINE));
  if (!which.length || which.includes("ads")) { const { adCards } = await import("./ads.mjs").catch(() => ({ adCards: null })); if (adCards) cards.push(...adCards(d)); }
  await draw(cards);
}
