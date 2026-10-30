/* Heard Health app icons, drawn from the master mark (docs/brand/heard-mark.svg) by headless Chromium.

   Run by hand from the repo root; never run by the build, and Playwright is not an npm dependency of this
   repo. Point PLAYWRIGHT at any installed copy (default: /opt/node-tools/node_modules/playwright/index.mjs)
   and, if needed, CHROMIUM at its browser binary:
       node scripts/make-icons.mjs
   Then flatten the opaque ones to RGB (Pillow): python3 scripts/flatten-icons.py

   What it draws: the mark (ring with a gap and a speech tail, one dot) in periwinkle #4A5DB0 on paper #FAF7F4.
   The mark's bounding box in its 64x64 viewBox (stroke included) is x 10–54, y 8–58.5; `frac` is the share of the
   canvas that box's height takes, centred on the canvas.

   Files written (every size is one the folder already held):
     public/icons/icon-192.png, icon-512.png                    "any", frac 0.66
     public/icons/icon-maskable-192.png, icon-maskable-512.png  "maskable", frac 0.50 (inside the 80% safe circle)
     public/icons/apple-touch-icon.png                          180, frac 0.62
     ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png   1024, frac 0.60, opaque
     ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732*.png   mark 0.16 of the side
     android/app/src/main/res/mipmap-<dpi>/ic_launcher.png        legacy square, frac 0.62
     android/app/src/main/res/mipmap-<dpi>/ic_launcher_round.png  circle on transparent, frac 0.56
     android/app/src/main/res/mipmap-<dpi>/ic_launcher_foreground.png  adaptive foreground on transparent,
                                                                  frac 0.40 (inside the 66/108 safe zone);
                                                                  the background is @color/ic_launcher_background
     android/app/src/main/res/drawable-<variant>/splash.png               mark 0.22 of the short side */
import fs from "fs";
import path from "path";

const PW = process.env.PLAYWRIGHT || "/opt/node-tools/node_modules/playwright/index.mjs";
const { chromium } = await import(PW);

const INK = "#4A5DB0", PAPER = "#FAF7F4";
const RING = "M15.22 38.92 A19 19 0 1 1 26.13 48.07", TAIL = "M26.13 48.07 Q22.93 53.47 16.53 55.47";
const BOX = { x0: 10, y0: 8, x1: 54, y1: 58.5 };

/** One icon as an SVG document: w x h pixels, mark box height = frac of the short side, centred. */
export function iconSvg({ w, h, frac, bg = "square", fg = INK, paper = PAPER }) {
  const side = Math.min(w, h);
  const unit = (BOX.y1 - BOX.y0) / (frac * side); // viewBox units per pixel
  const vw = w * unit, vh = h * unit;
  const cx = (BOX.x0 + BOX.x1) / 2, cy = (BOX.y0 + BOX.y1) / 2;
  const x = cx - vw / 2, y = cy - vh / 2;
  const back = bg === "square" ? `<rect x="${x}" y="${y}" width="${vw}" height="${vh}" fill="${paper}"/>`
    : bg === "circle" ? `<circle cx="${cx}" cy="${cy}" r="${Math.min(vw, vh) / 2}" fill="${paper}"/>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${x} ${y} ${vw} ${vh}">${back}`
    + `<g fill="none" stroke="${fg}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"><path d="${RING}"/><path d="${TAIL}"/></g>`
    + `<circle cx="32" cy="30" r="5.5" fill="${fg}"/></svg>`;
}

const pngSize = (f) => { const b = fs.readFileSync(f); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
const jobs = [
  ["public/icons/icon-192.png", 192, 192, 0.66, "square"],
  ["public/icons/icon-512.png", 512, 512, 0.66, "square"],
  ["public/icons/icon-maskable-192.png", 192, 192, 0.50, "square"],
  ["public/icons/icon-maskable-512.png", 512, 512, 0.50, "square"],
  ["public/icons/apple-touch-icon.png", 180, 180, 0.62, "square"],
  ["ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png", 1024, 1024, 0.60, "square"],
];
for (const f of ["splash-2732x2732.png", "splash-2732x2732-1.png", "splash-2732x2732-2.png"]) jobs.push([`ios/App/App/Assets.xcassets/Splash.imageset/${f}`, 2732, 2732, 0.16, "square"]);
const RES = "android/app/src/main/res";
if (fs.existsSync(RES)) for (const d of fs.readdirSync(RES).sort()) {
  const dir = path.join(RES, d);
  if (d.startsWith("mipmap-") && d !== "mipmap-anydpi-v26") {
    for (const [n, frac, bg] of [["ic_launcher.png", 0.62, "square"], ["ic_launcher_round.png", 0.56, "circle"], ["ic_launcher_foreground.png", 0.40, "none"]]) {
      const f = path.join(dir, n); if (fs.existsSync(f)) { const [w, h] = pngSize(f); jobs.push([f, w, h, frac, bg]); }
    }
  }
  if (d.startsWith("drawable")) { const f = path.join(dir, "splash.png"); if (fs.existsSync(f)) { const [w, h] = pngSize(f); jobs.push([f, w, h, 0.22, "square"]); } }
}

const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
for (const [out, w, h, frac, bg] of jobs) {
  if (!fs.existsSync(path.dirname(out))) continue;
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await page.setContent(`<!doctype html><html><body style="margin:0;background:transparent">${iconSvg({ w, h, frac, bg })}</body></html>`);
  await page.screenshot({ path: out, omitBackground: true, clip: { x: 0, y: 0, width: w, height: h } });
  await page.close();
  console.log(`wrote ${out} (${w}x${h}, ${bg}, mark ${frac})`);
}
await browser.close();
