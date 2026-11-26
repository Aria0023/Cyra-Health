/* Search and sharing, all first-party (docs/plans/website.md Task 3): the canonical address, the Open Graph and Twitter
   card with the site's own 1200×630 image, the SoftwareApplication data (NO rating or review field, ever), robots.txt
   and sitemap.xml. Absolute addresses are written only when the site knows its own address (app-data.mjs siteUrl:
   VITE_SITE_URL, else Render's own address for the static site); without one, no canonical link and no sitemap are
   written, because a guessed address would be a false one. Pure: no imports beyond the page helpers. */
import { escAttr } from "../pages/copy.mjs";

export const OG_IMAGE = { file: "og.jpg", width: 1200, height: 630 };
export const OG_ALT = "Solia Health: cycle, fertility, pregnancy, perimenopause and menopause tracking that lives on your device. A phone shows the app's Home screen with example data.";
const OG_ALT_SOURCE = "site/img/og.jpg (drawn by site/cards.mjs from the front page's headline and the Home screenshot); src/lib/onboarding.js STAGE_CARDS; src/lib/storage.js";

/** The <head> lines for one page. path: "/" or "/support/". c registers the words (title and description are already there). */
export function headSeo(ctx, c, { path, title, description, jsonLd = null }) {
  const base = ctx.d.site.url;
  const img = `${base}${ctx.assets.img}${OG_IMAGE.file}`;
  const lines = [];
  if (base) lines.push(`<link rel="canonical" href="${base}${path}">`);
  lines.push(
    '<meta property="og:type" content="website">',
    '<meta property="og:site_name" content="Solia Health">',
    `<meta property="og:title" content="${escAttr(title)}">`,
    `<meta property="og:description" content="${escAttr(description)}">`,
  );
  if (base) lines.push(`<meta property="og:url" content="${base}${path}">`);
  lines.push(
    `<meta property="og:image" content="${img}">`,
    `<meta property="og:image:width" content="${OG_IMAGE.width}">`,
    `<meta property="og:image:height" content="${OG_IMAGE.height}">`,
    `<meta property="og:image:alt" content="${c.attr(OG_ALT, OG_ALT_SOURCE)}">`,
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:title" content="${escAttr(title)}">`,
    `<meta name="twitter:description" content="${escAttr(description)}">`,
    `<meta name="twitter:image" content="${img}">`,
  );
  if (jsonLd) lines.push(`<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, "\\u003c")}</script>`);
  return `${lines.join("\n")}\n`;
}

/** schema.org SoftwareApplication for the front page. Only what the build makes true: the name, what it is, where it
    runs (the web always; iOS and Android once their store pages are set), that the web app is free to use, and the
    store links when set. No aggregateRating, no review, no award, no download count. */
export function softwareApplication(ctx, { description }) {
  const { links, site } = ctx.d;
  const os = ["Web", links.appStore && "iOS", links.playStore && "Android"].filter(Boolean).join(", ");
  const data = {
    "@context": "https://schema.org", "@type": "SoftwareApplication",
    name: "Solia Health", applicationCategory: "HealthApplication", operatingSystem: os, description,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD", description: "The web app is free to use." },
  };
  if (site.url) { data.url = `${site.url}/`; data.image = `${site.url}${ctx.assets.img}${OG_IMAGE.file}`; }
  const stores = [links.appStore, links.playStore].filter(Boolean);
  if (stores.length) data.installUrl = stores.length === 1 ? stores[0] : stores;
  return data;
}

/** robots.txt: everything may be read (the app at /app/ and the draft legal pages carry their own noindex). */
export const robotsTxt = (siteUrl) => `# Solia Health\nUser-agent: *\nAllow: /\n${siteUrl ? `\nSitemap: ${siteUrl}/sitemap.xml\n` : ""}`;

/** sitemap.xml for the pages that may be indexed, or null when the site doesn't know its own address. */
export function sitemapXml(siteUrl, paths) {
  if (!siteUrl) return null;
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${paths.map((p) => `  <url><loc>${siteUrl}${p}</loc></url>`).join("\n")}\n</urlset>\n`;
}
