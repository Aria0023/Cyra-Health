/* Text contrast measured from the pixels a visitor sees (docs/plans/website.md eval). The website's backgrounds are soft
   gradients, and axe-core marks text over a gradient "needs review" instead of pass or fail, so most of the site's text
   would go unchecked by axe alone. This measures it: every element that holds text is found with its computed colour and
   size; the page is photographed once with all text made transparent (so only what is BEHIND the text remains); the box
   of each line of words is sampled on a grid and the WORST pixel is compared with the text colour by the WCAG 2 formula.
   Needs: 4.5:1, or 3:1 for large text (24px and up, or 18.66px and up in bold). Same-origin, nothing is loaded. */

const COLLECT = () => {
  const probe = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  const rgba = (css) => { probe.clearRect(0, 0, 1, 1); probe.fillStyle = "#000"; probe.fillStyle = css; probe.fillRect(0, 0, 1, 1); return [...probe.getImageData(0, 0, 1, 1).data]; };
  const out = [];
  for (const el of document.body.querySelectorAll("*")) {
    if (["SCRIPT", "STYLE", "SVG", "PATH", "CIRCLE", "ELLIPSE"].includes(el.tagName.toUpperCase()) || el.closest("svg")) continue;
    const text = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join("").replace(/\s+/g, " ").trim();
    if (!text) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none" || Number(cs.opacity) === 0) continue;
    // the boxes of the words themselves (not the element's box, whose border and rounded corners are not behind any letter)
    const range = document.createRange();
    const rects = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim()).flatMap((n) => { range.selectNodeContents(n); return [...range.getClientRects()]; });
    for (const r of rects) {
      if (r.width < 4 || r.height < 4) continue;
      const x = r.left + window.scrollX, y = r.top + window.scrollY;
      if (x + r.width <= 0 || y + r.height <= 0 || x >= document.documentElement.scrollWidth) continue; // parked off the page (the skip link)
      const size = parseFloat(cs.fontSize), bold = Number(cs.fontWeight) >= 700;
      out.push({ text: text.slice(0, 48), tag: el.tagName.toLowerCase() + (el.className && typeof el.className === "string" ? `.${el.className.split(" ")[0]}` : ""), x, y, w: r.width, h: r.height, color: rgba(cs.color), need: size >= 24 || (size >= 18.66 && bold) ? 3 : 4.5 });
    }
  }
  return out;
};

const MEASURE = async ({ png, items }) => {
  const img = new Image();
  img.src = `data:image/png;base64,${png}`;
  await img.decode();
  const c = document.createElement("canvas");
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  const lin = (v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const res = [];
  for (const it of items) {
    const x0 = Math.max(0, Math.floor(it.x)), y0 = Math.max(0, Math.floor(it.y));
    const w = Math.min(c.width - x0, Math.ceil(it.w)), h = Math.min(c.height - y0, Math.ceil(it.h));
    if (w < 2 || h < 2) continue;
    const data = ctx.getImageData(x0, y0, w, h).data;
    let worst = Infinity, at = null;
    const stepX = Math.max(1, Math.floor(w / 24)), stepY = Math.max(1, Math.floor(h / 6));
    for (let py = 0; py < h; py += stepY) for (let px = 0; px < w; px += stepX) {
      const i = (py * w + px) * 4, bg = [data[i], data[i + 1], data[i + 2]];
      const a = it.color[3] / 255, fg = it.color.slice(0, 3).map((v, k) => v * a + bg[k] * (1 - a)); // translucent text is seen over its background
      const r = ratio(fg, bg);
      if (r < worst) { worst = r; at = bg; }
    }
    res.push({ text: it.text, tag: it.tag, need: it.need, ratio: Math.round(worst * 100) / 100, color: it.color.slice(0, 3), behind: at });
  }
  return res;
};

/** → { checked, min, failures: [{ text, tag, need, ratio, color, behind }] } for the page as it is now (any open details included). */
export async function measuredContrast(page) {
  const items = await page.evaluate(COLLECT);
  const style = await page.addStyleTag({ content: "*, *::before, *::after { color: transparent !important; text-shadow: none !important; -webkit-text-fill-color: transparent !important; caret-color: transparent !important; } svg, img { visibility: hidden !important; } ::marker { color: transparent !important; }" }).catch(() => null);
  let png;
  if (style) { png = await page.screenshot({ fullPage: true, type: "png", scale: "css" }); await style.evaluate((n) => n.remove()); }
  else {
    // a page whose own policy refuses an added <style> (the website's does): switch the text off through the CSSOM of its own sheet
    await page.evaluate(() => { const sheet = document.styleSheets[0]; window.__c = [sheet.insertRule("*, *::before, *::after { color: transparent !important; -webkit-text-fill-color: transparent !important; }", sheet.cssRules.length), sheet.insertRule("svg, img { visibility: hidden !important; }", sheet.cssRules.length), sheet.insertRule("::marker { color: transparent !important; }", sheet.cssRules.length)]; });
    png = await page.screenshot({ fullPage: true, type: "png", scale: "css" });
    await page.evaluate(() => { const sheet = document.styleSheets[0]; for (const i of [...window.__c].sort((a, b) => b - a)) sheet.deleteRule(i); delete window.__c; });
  }
  const helper = await page.context().newPage();
  let res;
  try { res = await helper.evaluate(MEASURE, { png: png.toString("base64"), items }); } finally { await helper.close(); }
  const failures = res.filter((r) => r.ratio < r.need);
  return { checked: res.length, min: res.reduce((m, r) => Math.min(m, r.ratio), Infinity), failures };
}
