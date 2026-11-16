/* Shop product illustrations (2026-11-16, docs/plans/shop-findable-visuals.md Task 2). Hand-built SVG drawings in a
   studio product-photo style (soft floor shadow, highlights, gradients, depth), one per product TYPE, shown on a card
   only until the owner uploads a real, licensed photo (a real image always wins). Generic shapes only: no brand logo,
   wordmark, trade dress or copied packaging; neutral colours plus the brand's shop hue as an accent (CSS classes below,
   so the drawing follows [data-hue] and the colour scheme); the only marks are generic ones (test lines, chart bars).
   Every card that shows one carries an "Illustration" tag (components/Shop.jsx), so nobody takes it for a photo.

   Pure data: no React, storage or network. An entry is the inner markup of an <svg viewBox="0 0 400 300">; ids are
   written as ID_… and made unique per instance by artSvg(id, uid). The partner portal shows the same drawings from a
   generated copy (backend/public/portal/shop-art.js, `npm run shop:seed`; shopSeed.test.mjs fails when it is stale).
   The portal's CSP allows no inline style, so colours that follow the hue are CSS classes, never style="":
     .ah fill hue · .ahl light hue · .ahd dark hue · .ahs stroke hue · stops .sl / .sh / .sd (light, hue, dark)
     .a-sh the floor shadow · .a-glow the studio light (both adapt to the dark scheme in CSS). */

const DEFS = `<defs>
<filter id="ID_b" x="-40%" y="-150%" width="180%" height="400%"><feGaussianBlur stdDeviation="8"/></filter>
<filter id="ID_s" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3"/></filter>
<filter id="ID_g" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="26"/></filter>
<linearGradient id="ID_w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#E2E7EE"/></linearGradient>
<linearGradient id="ID_wx" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#DDE3EA"/><stop offset=".28" stop-color="#FFFFFF"/><stop offset=".62" stop-color="#F1F4F8"/><stop offset="1" stop-color="#C6CED8"/></linearGradient>
<linearGradient id="ID_h" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="sl"/><stop offset=".45" class="sh"/><stop offset="1" class="sd"/></linearGradient>
<linearGradient id="ID_hx" x1="0" y1="0" x2="1" y2="0"><stop offset="0" class="sd"/><stop offset=".3" class="sl"/><stop offset=".6" class="sh"/><stop offset="1" class="sd"/></linearGradient>
<linearGradient id="ID_k" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3A4252"/><stop offset=".5" stop-color="#1B2130"/><stop offset="1" stop-color="#0D111B"/></linearGradient>
<linearGradient id="ID_m" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8E99A8"/><stop offset=".25" stop-color="#F4F6F9"/><stop offset=".5" stop-color="#B4BDC9"/><stop offset=".78" stop-color="#E9EDF2"/><stop offset="1" stop-color="#7C8797"/></linearGradient>
<linearGradient id="ID_my" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F7F9FB"/><stop offset=".45" stop-color="#B9C2CD"/><stop offset="1" stop-color="#8C97A6"/></linearGradient>
<linearGradient id="ID_gl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFFFFF" stop-opacity=".55"/><stop offset=".5" stop-color="#FFFFFF" stop-opacity="0"/></linearGradient>
EXTRA</defs><ellipse class="a-glow" cx="200" cy="140" rx="150" ry="95" fill="#FFFFFF" filter="url(#ID_g)"/>`;
const svg = (body, extra = "") => DEFS.replace("EXTRA", extra) + body;
/** The soft floor shadow under an object. */
const fl = (cx, cy, rx, ry, o = 0.3) => `<ellipse class="a-sh" cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#0B1220" opacity="${o}" filter="url(#ID_b)"/>`;
const g = (t, body) => `<g transform="${t}">${body}</g>`;

/* A urine test strip, 18 x 196, drawn from its top-left corner: a hue handle, a window with generic lines, the pad. */
const strip = (t, lines = 2) => g(t, `<rect x="3" y="4" width="18" height="196" rx="3" fill="#0B1220" opacity=".22" filter="url(#ID_s)"/>
<rect width="18" height="196" rx="3" fill="url(#ID_w)" stroke="#C5CDD8" stroke-width=".8"/>
<path d="M0 3a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v55H0z" fill="url(#ID_h)"/><rect y="50" width="18" height="8" class="ahd" opacity=".45"/>
<rect x="3" y="84" width="12" height="36" rx="2" fill="#F6F7FA" stroke="#CFD6DF" stroke-width=".7"/>
<rect x="3" y="94" width="12" height="2.8" fill="#C2255C"/>${lines > 1 ? `<rect x="3" y="105" width="12" height="2.8" fill="#C2255C" opacity=".6"/>` : ""}
<path d="M0 148h18v45a3 3 0 0 1-3 3H3a3 3 0 0 1-3-3z" fill="#EDF0F4"/><path d="M2 148h14" stroke="#9AA5B4" stroke-width="1.2"/>
<path d="M9 158v12m-3.5-4 3.5 4 3.5-4" stroke="#9AA5B4" stroke-width="1.3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<rect x="1.6" y="3" width="2.6" height="188" rx="1.3" fill="#FFFFFF" opacity=".55"/>`);

/* A foil pouch, w x h from its top-left corner: crimped seals, a hue label with grey lines, a diagonal sheen. */
const pouch = (t, w, h) => g(t, `<rect x="5" y="7" width="${w}" height="${h}" rx="4" fill="#0B1220" opacity=".24" filter="url(#ID_s)"/>
<rect width="${w}" height="${h}" rx="4" fill="url(#ID_m)"/><rect width="${w}" height="${h}" rx="4" fill="url(#ID_my)" opacity=".35"/>
<path d="M2 8h${w - 4}M2 ${h - 8}h${w - 4}" stroke="#6F7B8B" stroke-width="11" stroke-dasharray="1.4 2.6" opacity=".4"/>
<path d="M0 16h${w}M0 ${h - 16}h${w}" stroke="#FFFFFF" stroke-width="1" opacity=".7"/>
<rect x="${w * 0.14}" y="${h * 0.24}" width="${w * 0.72}" height="${h * 0.44}" rx="5" fill="url(#ID_h)"/>
<rect x="${w * 0.24}" y="${h * 0.33}" width="${w * 0.52}" height="5" rx="2.5" fill="#FFFFFF" opacity=".9"/><rect x="${w * 0.24}" y="${h * 0.33 + 13}" width="${w * 0.36}" height="4" rx="2" fill="#FFFFFF" opacity=".6"/>
<rect x="${w * 0.44}" y="${h * 0.5}" width="${w * 0.12}" height="${h * 0.13}" rx="2" fill="#FFFFFF" opacity=".85"/>
<path d="M${w * 0.1} 0L${w * 0.42} 0L${w * 0.16} ${h}L0 ${h}L0 ${h * 0.3}z" fill="#FFFFFF" opacity=".28"/><path d="M${w * 0.7} 0h${w * 0.1}L${w * 0.56} ${h}h-${w * 0.1}z" fill="#FFFFFF" opacity=".16"/>`);

/* A phone, 112 x 228 from its top-left corner; `screen` is drawn inside a 100 x 216 area at (6,6), clipped to round corners. */
const phone = (t, screen, clip) => g(t, `<rect x="8" y="10" width="112" height="228" rx="20" fill="#0B1220" opacity=".3" filter="url(#ID_s)"/>
<rect width="112" height="228" rx="20" fill="url(#ID_m)"/><rect x="1.5" y="1.5" width="109" height="225" rx="18.5" fill="#10141D"/>
<clipPath id="ID_${clip}"><rect x="6" y="6" width="100" height="216" rx="15"/></clipPath><g clip-path="url(#ID_${clip})">${screen}</g>
<rect x="42" y="11" width="28" height="8" rx="4" fill="#0B0E15"/>
<path d="M6 21a15 15 0 0 1 15-15h46L20 222h-14z" fill="url(#ID_gl)" opacity=".5"/>
<rect x="112" y="62" width="2.5" height="30" rx="1.2" fill="#8E99A8"/>`);

/* A test stick's result window with two generic lines. */
const win = (x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="#DCE2EA"/><rect x="${x + 2}" y="${y + 2.5}" width="${w - 4}" height="${h - 4}" rx="${(h - 4) / 2}" fill="#F8F9FB"/>
<rect x="${x + w * 0.36}" y="${y + 4}" width="3" height="${h - 7}" fill="#C2255C"/><rect x="${x + w * 0.58}" y="${y + 4}" width="3" height="${h - 7}" fill="#C2255C" opacity=".65"/>`;

/* A CGM sensor seen from above at an angle: the adhesive patch, the sensor disc with depth, a highlight. */
const sensor = (cx, cy, r) => `${fl(cx + 4, cy + r * 0.62, r * 1.25, r * 0.3, 0.3)}
<ellipse cx="${cx}" cy="${cy + r * 0.3}" rx="${r * 1.32}" ry="${r * 0.62}" fill="#F3F5F8" stroke="#D3DAE3" stroke-width="1"/>
<ellipse cx="${cx}" cy="${cy + r * 0.3}" rx="${r * 1.18}" ry="${r * 0.52}" fill="none" stroke="#E2E7EE" stroke-width="1" stroke-dasharray="2 3"/>
<path d="M${cx - r} ${cy + r * 0.12}v${r * 0.2}a${r} ${r * 0.44} 0 0 0 ${r * 2} 0v-${r * 0.2}z" fill="url(#ID_wx)"/>
<path d="M${cx - r} ${cy + r * 0.3}a${r} ${r * 0.44} 0 0 0 ${r * 2} 0" fill="none" stroke="#B5BECA" stroke-width=".8" opacity=".7"/>
<ellipse cx="${cx}" cy="${cy + r * 0.12}" rx="${r}" ry="${r * 0.44}" fill="url(#ID_w)" stroke="#CAD2DC" stroke-width=".8"/>
<ellipse cx="${cx}" cy="${cy + r * 0.12}" rx="${r * 0.2}" ry="${r * 0.09}" class="ah"/>
<ellipse cx="${cx - r * 0.38}" cy="${cy}" rx="${r * 0.36}" ry="${r * 0.1}" fill="#FFFFFF" opacity=".9" transform="rotate(-12 ${cx - r * 0.38} ${cy})"/>`;

const NIGHT = `<linearGradient id="ID_n" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1B1F3B"/><stop offset=".6" stop-color="#2B2F5E"/><stop offset="1" class="sd"/></linearGradient>`;
const FABRIC = `<pattern id="ID_f" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><path d="M0 3h6" stroke="#FFFFFF" stroke-width="1.1" opacity=".22"/><path d="M0 0h6" stroke="#0B1220" stroke-width="1" opacity=".14"/></pattern>`;

export const SHOP_ART = Object.freeze({
  /* LH test strips with their foil pouch */
  "lh-strips": svg(`${fl(200, 250, 150, 13)}
${pouch("translate(72 52) rotate(-9)", 112, 176)}
${strip("translate(214 44) rotate(4)")}${strip("translate(262 46) rotate(14)")}${strip("translate(312 56) rotate(25)", 1)}`),

  /* A digital ovulation test stick with a screen, its cap beside it */
  "ovulation-digital": svg(`${fl(196, 236, 160, 12)}
${g("translate(48 168) rotate(-17)", `<rect x="6" y="12" width="276" height="58" rx="29" fill="#0B1220" opacity=".28" filter="url(#ID_s)"/>
<rect width="276" height="58" rx="29" fill="url(#ID_w)" stroke="#C9D1DB" stroke-width=".9"/>
<path d="M29 0h96v58H29A29 29 0 0 1 29 0z" fill="url(#ID_h)"/><path d="M125 0v58" stroke="#0B1220" stroke-opacity=".18" stroke-width="2"/>
<path d="M40 16h60M40 29h60M40 42h60" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" opacity=".28"/>
<rect x="150" y="11" width="74" height="36" rx="8" fill="#B9C2CD"/><rect x="153" y="14" width="68" height="30" rx="6" fill="#DDE6E1"/>
<circle cx="187" cy="29" r="9.5" fill="none" stroke="#39424F" stroke-width="2.6"/><path d="M153 20a6 6 0 0 1 6-6h40l-18 30h-22a6 6 0 0 1-6-6z" fill="#FFFFFF" opacity=".35"/>
<rect x="236" y="22" width="26" height="14" rx="7" fill="#E4E9EF" stroke="#C5CDD8" stroke-width=".8"/>
<rect x="20" y="5" width="236" height="7" rx="3.5" fill="#FFFFFF" opacity=".7"/>`)}
${g("translate(238 196) rotate(12)", `<rect x="4" y="8" width="92" height="50" rx="12" fill="#0B1220" opacity=".26" filter="url(#ID_s)"/>
<rect width="92" height="50" rx="12" class="ah" opacity=".5"/><rect width="92" height="50" rx="12" fill="url(#ID_gl)"/><rect x="1" y="1" width="90" height="48" rx="11" fill="none" stroke="#FFFFFF" stroke-opacity=".6"/>
<rect x="10" y="6" width="60" height="5" rx="2.5" fill="#FFFFFF" opacity=".7"/><path d="M78 2v46" stroke="#0B1220" stroke-opacity=".15" stroke-width="1.5"/>`)}`),

  /* A handheld hormone analyzer with its test wand */
  "hormone-monitor": svg(`${fl(150, 250, 86, 13)}${fl(292, 250, 70, 9, 0.24)}
<path d="M92 86a44 44 0 0 1 44-44h36a44 44 0 0 1 44 44v118a40 40 0 0 1-40 40h-44a40 40 0 0 1-40-40z" fill="#C3CBD6"/>
<path d="M84 84a44 44 0 0 1 44-44h36a44 44 0 0 1 44 44v118a40 40 0 0 1-40 40h-44a40 40 0 0 1-40-40z" fill="url(#ID_w)" stroke="#CBD3DD"/>
<rect x="106" y="66" width="80" height="62" rx="12" fill="url(#ID_k)"/>
<path d="M116 112l12-14 11 8 13-22 12 14 12-10" fill="none" class="ahs" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>
<circle cx="152" cy="84" r="3.4" class="ahl"/><path d="M106 78a12 12 0 0 1 12-12h44l-30 62h-14a12 12 0 0 1-12-12z" fill="#FFFFFF" opacity=".1"/>
<circle cx="146" cy="162" r="15" fill="url(#ID_h)"/><circle cx="146" cy="162" r="15" fill="none" stroke="#FFFFFF" stroke-opacity=".5"/><path d="M140 162h12" stroke="#FFFFFF" stroke-width="2.4" stroke-linecap="round"/>
<rect x="118" y="206" width="56" height="12" rx="6" fill="#1B2130"/><rect x="122" y="209" width="48" height="3" rx="1.5" fill="#465062"/>
<path d="M92 84a36 36 0 0 1 36-36h14" fill="none" stroke="#FFFFFF" stroke-width="5" stroke-linecap="round" opacity=".9"/>
${g("translate(246 76) rotate(14)", `<rect x="5" y="8" width="30" height="170" rx="8" fill="#0B1220" opacity=".24" filter="url(#ID_s)"/>
<rect width="30" height="170" rx="8" fill="url(#ID_wx)" stroke="#C5CDD8" stroke-width=".8"/><path d="M0 8a8 8 0 0 1 8-8h14a8 8 0 0 1 8 8v62H0z" fill="url(#ID_hx)"/>
${win(8, 84, 14, 40).replace(/rx="[\d.]+"/g, 'rx="4"')}<path d="M6 136h18v26a8 8 0 0 1-8 8h-2a8 8 0 0 1-8-8z" fill="#E6EAF0"/><rect x="4" y="6" width="3.5" height="156" rx="1.7" fill="#FFFFFF" opacity=".6"/>`)}`),

  /* A phone with a clip-on fertility reader and a strip */
  "phone-reader": svg(`${fl(190, 262, 110, 11)}
${phone("translate(140 70) rotate(-4) scale(.84)", `<rect x="6" y="6" width="100" height="216" fill="#F5F7FA"/><rect x="6" y="6" width="100" height="62" fill="url(#ID_h)"/>
<rect x="18" y="34" width="46" height="6" rx="3" fill="#FFFFFF" opacity=".95"/><rect x="18" y="46" width="30" height="5" rx="2.5" fill="#FFFFFF" opacity=".6"/>
<rect x="16" y="82" width="80" height="78" rx="10" fill="#FFFFFF" stroke="#E1E6ED"/>
<path d="M26 148V128M40 148v-34M54 148v-48M68 148v-30M82 148v-16" class="ahs" stroke-width="8" stroke-linecap="round"/>
<rect x="16" y="170" width="80" height="12" rx="6" fill="#E6EAF0"/><rect x="16" y="190" width="54" height="12" rx="6" fill="#E6EAF0"/>`, "c1")}
${g("translate(131 46) rotate(-4) scale(.86)", `<rect x="5" y="8" width="124" height="62" rx="14" fill="#0B1220" opacity=".3" filter="url(#ID_s)"/>
<rect width="124" height="62" rx="14" fill="url(#ID_w)" stroke="#C5CDD8"/><rect x="0" y="44" width="124" height="18" rx="9" fill="#D5DBE4" opacity=".7"/>
<rect x="86" y="14" width="26" height="8" rx="4" fill="#1B2130"/><circle cx="26" cy="24" r="8" fill="url(#ID_h)"/><circle cx="24" cy="22" r="2.5" fill="#FFFFFF" opacity=".8"/>
<rect x="10" y="5" width="96" height="5" rx="2.5" fill="#FFFFFF"/>`)}
${g("translate(222 10) rotate(-4) scale(.62)", `<rect width="18" height="120" rx="3" fill="url(#ID_w)" stroke="#C5CDD8"/><rect width="18" height="46" rx="3" fill="url(#ID_h)"/><rect x="3" y="62" width="12" height="30" rx="2" fill="#F6F7FA" stroke="#CFD6DF"/><rect x="3" y="70" width="12" height="3" fill="#C2255C"/><rect x="3" y="80" width="12" height="3" fill="#C2255C" opacity=".6"/>`)}
${strip("translate(292 78) rotate(18) scale(.86)")}`),

  /* A box of PdG test strips with a pouch and a strip */
  "pdg-strips": svg(`${fl(190, 252, 150, 13)}
<path d="M196 66l52-16v168l-52 22z" fill="#C9D1DB"/><path d="M196 66l52-16v168l-52 22z" fill="url(#ID_h)" opacity=".5"/>
<path d="M82 66l52-16h114l-52 16z" fill="#F7F9FB" stroke="#D3DAE3" stroke-width=".8"/>
<rect x="82" y="66" width="114" height="174" fill="url(#ID_w)" stroke="#D3DAE3" stroke-width=".8"/>
<rect x="82" y="66" width="114" height="52" fill="url(#ID_h)"/><rect x="96" y="82" width="62" height="7" rx="3.5" fill="#FFFFFF" opacity=".95"/><rect x="96" y="96" width="40" height="5" rx="2.5" fill="#FFFFFF" opacity=".6"/>
${g("translate(120 136)", `<rect width="38" height="84" rx="6" fill="#F1F4F8" stroke="#D3DAE3"/><rect x="13" y="8" width="12" height="68" rx="2" fill="#FFFFFF" stroke="#C5CDD8" stroke-width=".8"/><rect x="13" y="8" width="12" height="20" rx="2" class="ah"/><rect x="15" y="40" width="8" height="2.4" fill="#C2255C"/><rect x="15" y="47" width="8" height="2.4" fill="#C2255C" opacity=".6"/>`)}
<path d="M82 66h8v174h-8z" fill="#FFFFFF" opacity=".6"/>
${pouch("translate(250 116) rotate(9)", 78, 122)}${strip("translate(340 66) rotate(20) scale(.9)")}`),

  /* A basal thermometer with its clear case */
  thermometer: svg(`${fl(196, 240, 160, 12)}
${g("translate(46 150) rotate(-20)", `<rect x="6" y="14" width="300" height="44" rx="20" fill="#0B1220" opacity=".28" filter="url(#ID_s)"/>
<path d="M236 12h46q24 6 30 10q-6 4-30 10h-46z" fill="url(#ID_my)"/><path d="M286 14q16 4 22 8" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" opacity=".9"/>
<path d="M24 0h178q40 4 44 22q-4 18-44 22H24A22 22 0 0 1 24 0z" fill="url(#ID_w)" stroke="#C9D1DB" stroke-width=".9"/>
<path d="M24 0h40v44H24A22 22 0 0 1 24 0z" fill="url(#ID_h)"/><circle cx="34" cy="22" r="9" fill="#FFFFFF" opacity=".92"/><circle cx="34" cy="22" r="5.5" class="ah"/>
<rect x="82" y="8" width="88" height="28" rx="7" fill="#AEB8C4"/><rect x="85" y="11" width="82" height="22" rx="5" fill="#DCE5DF"/>
<path d="M98 16h8v12h-8M99 22h7M122 16h-8v12h8v-6h-8M128.500 27.500v.5M135 16h8l-5 12M150 16h8v6h-8v6h8" fill="none" stroke="#2F3845" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" opacity=".85"/>
<path d="M85 17a6 6 0 0 1 6-6h46l-12 22H91a6 6 0 0 1-6-6z" fill="#FFFFFF" opacity=".3"/>
<rect x="20" y="4" width="200" height="5" rx="2.5" fill="#FFFFFF" opacity=".85"/>`)}
${g("translate(168 206) rotate(8)", `<rect x="4" y="8" width="190" height="34" rx="17" fill="#0B1220" opacity=".2" filter="url(#ID_s)"/>
<rect width="190" height="34" rx="17" class="ahl" opacity=".55"/><rect width="190" height="34" rx="17" fill="url(#ID_gl)"/><rect x=".8" y=".8" width="188.400" height="32.400" rx="16.200" fill="none" stroke="#FFFFFF" stroke-opacity=".75" stroke-width="1.4"/>
<rect x="16" y="5" width="140" height="4" rx="2" fill="#FFFFFF" opacity=".75"/><path d="M150 1v32" stroke="#0B1220" stroke-opacity=".12" stroke-width="1.5"/>`)}`),

  /* A vitamin bottle with softgels */
  vitamins: svg(`${fl(170, 252, 96, 13)}${fl(292, 252, 62, 8, 0.24)}
<linearGradient id="ID_a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFD98A"/><stop offset=".5" stop-color="#EFA536"/><stop offset="1" stop-color="#B8690F"/></linearGradient>
<path d="M112 104q0-14 16-18h84q16 4 16 18v124q0 14-14 14h-88q-14 0-14-14z" fill="url(#ID_wx)" stroke="#C5CDD8" stroke-width=".9"/>
<rect x="112" y="124" width="116" height="84" fill="url(#ID_hx)"/><rect x="112" y="124" width="116" height="84" fill="#FFFFFF" opacity=".08"/>
<rect x="128" y="140" width="66" height="8" rx="4" fill="#FFFFFF" opacity=".95"/><rect x="128" y="156" width="46" height="5" rx="2.5" fill="#FFFFFF" opacity=".65"/><rect x="128" y="168" width="56" height="5" rx="2.5" fill="#FFFFFF" opacity=".65"/>
<ellipse cx="204" cy="188" rx="11" ry="7" fill="url(#ID_a)" transform="rotate(-24 204 188)"/><ellipse cx="201" cy="185" rx="4" ry="1.6" fill="#FFFFFF" opacity=".8" transform="rotate(-24 201 185)"/>
<rect x="122" y="56" width="96" height="34" rx="6" fill="url(#ID_wx)" stroke="#C5CDD8" stroke-width=".9"/>
<path d="M130 58v30M138 58v30M146 58v30M154 58v30M162 58v30M170 58v30M178 58v30M186 58v30M194 58v30M202 58v30M210 58v30" stroke="#AEB8C4" stroke-width="1.2" opacity=".55"/>
<rect x="122" y="56" width="96" height="6" rx="3" fill="#FFFFFF"/><rect x="118" y="88" width="104" height="7" rx="3.5" fill="#D3DAE3"/>
<rect x="124" y="100" width="7" height="132" rx="3.5" fill="#FFFFFF" opacity=".7"/>
${[[262, 222, -28], [306, 232, 14], [286, 204, 62]].map(([x, y, r]) => `<g transform="rotate(${r} ${x} ${y})"><ellipse cx="${x + 2}" cy="${y + 7}" rx="24" ry="9" fill="#0B1220" opacity=".22" filter="url(#ID_s)"/><ellipse cx="${x}" cy="${y}" rx="25" ry="13.500" fill="url(#ID_a)"/><ellipse cx="${x}" cy="${y}" rx="25" ry="13.500" fill="none" stroke="#9A560B" stroke-opacity=".35"/><ellipse cx="${x - 7}" cy="${y - 5.500}" rx="11" ry="3" fill="#FFFFFF" opacity=".8"/><ellipse cx="${x + 9}" cy="${y + 6}" rx="8" ry="2.500" fill="#FFE3A6" opacity=".7"/></g>`).join("")}`),

  /* A pregnancy test stick with its cap */
  "pregnancy-test": svg(`${fl(204, 240, 158, 12)}
${g("translate(60 96) rotate(16)", `<path d="M10 16q0-8 14-10l150-2q16 0 30 10l72 4q14 2 14 16t-14 16l-72 4q-14 10-30 10l-150-2q-14-2-14-10z" transform="translate(6 12)" fill="#0B1220" opacity=".28" filter="url(#ID_s)"/>
<path d="M200 14l76 4q14 2 14 16t-14 16l-76 4z" fill="#F4F6F9" stroke="#C9D1DB" stroke-width=".9"/><path d="M246 17v34" stroke="#C5CDD8" stroke-width="1"/><path d="M252 22h28M252 30h32M252 38h32M252 46h28" stroke="#DCE2EA" stroke-width="2.4" stroke-linecap="round"/>
<path d="M0 16q0-12 14-14l158-2q20 0 34 12v44q-14 12-34 12L14 66Q0 64 0 52z" fill="url(#ID_w)" stroke="#C9D1DB" stroke-width=".9"/>
<path d="M0 16q0-12 14-14l66-1v66l-66-1Q0 64 0 52z" fill="url(#ID_h)"/><path d="M18 20h44M18 30h44M18 40h44M18 50h44" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" opacity=".3"/>
${win(102, 20, 62, 28)}<circle cx="184" cy="34" r="8" fill="#DCE2EA"/><circle cx="184" cy="34" r="5.5" fill="#F8F9FB"/><rect x="182.500" y="30" width="3" height="8" fill="#C2255C" opacity=".8"/>
<path d="M12 6l158-3q16 0 30 9" fill="none" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round" opacity=".85"/>`)}
${g("translate(52 204) rotate(-10)", `<rect x="4" y="8" width="104" height="52" rx="14" fill="#0B1220" opacity=".24" filter="url(#ID_s)"/>
<rect width="104" height="52" rx="14" fill="url(#ID_h)"/><rect width="104" height="52" rx="14" fill="url(#ID_gl)"/><rect x="12" y="6" width="70" height="5" rx="2.5" fill="#FFFFFF" opacity=".6"/><path d="M88 3v46" stroke="#0B1220" stroke-opacity=".2" stroke-width="1.5"/>`)}`),

  /* A CGM sensor (round patch) with a tall applicator */
  "cgm-a": svg(`${fl(140, 252, 78, 12)}
<path d="M84 96h112v120q0 22-56 22t-56-22z" fill="url(#ID_hx)"/><path d="M84 196q0 20 56 20t56-20v20q0 22-56 22t-56-22z" fill="url(#ID_wx)"/>
<path d="M84 196q0 20 56 20t56-20" fill="none" stroke="#0B1220" stroke-opacity=".18" stroke-width="1.5"/>
<path d="M78 70q0-22 62-22t62 22v26q0 20-62 20t-62-20z" fill="url(#ID_wx)" stroke="#C5CDD8" stroke-width=".9"/>
<ellipse cx="140" cy="70" rx="62" ry="22" fill="url(#ID_w)" stroke="#CAD2DC" stroke-width=".9"/><ellipse cx="140" cy="70" rx="40" ry="13" fill="#EDF0F5" stroke="#D3DAE3"/><ellipse cx="140" cy="70" rx="14" ry="4.6" class="ah"/>
<path d="M96 106v102" stroke="#FFFFFF" stroke-width="7" stroke-linecap="round" opacity=".45"/><path d="M112 126v76M176 122v84" stroke="#0B1220" stroke-opacity=".1" stroke-width="2"/>
<ellipse cx="118" cy="62" rx="22" ry="5" fill="#FFFFFF" opacity=".9" transform="rotate(-8 118 62)"/>
${sensor(292, 196, 44)}`),

  /* A CGM sensor (oval over-patch with a slim transmitter) with a squat one-button applicator */
  "cgm-b": svg(`${fl(276, 250, 80, 12)}
<path d="M204 128q0-20 72-20t72 20v84q0 26-72 26t-72-26z" fill="url(#ID_wx)" stroke="#C5CDD8" stroke-width=".9"/>
<path d="M204 176q0 22 72 22t72-22v36q0 26-72 26t-72-26z" fill="url(#ID_hx)"/><path d="M204 176q0 22 72 22t72-22" fill="none" stroke="#FFFFFF" stroke-opacity=".5" stroke-width="1.5"/>
<ellipse cx="276" cy="128" rx="72" ry="20" fill="url(#ID_w)" stroke="#CAD2DC" stroke-width=".9"/>
<path d="M246 122v-12q0-10 30-10t30 10v12q0 9-30 9t-30-9z" fill="url(#ID_hx)"/><ellipse cx="276" cy="110" rx="30" ry="9" fill="url(#ID_h)"/><ellipse cx="268" cy="107" rx="12" ry="3" fill="#FFFFFF" opacity=".55"/>
<path d="M216 142v76" stroke="#FFFFFF" stroke-width="7" stroke-linecap="round" opacity=".5"/>
${fl(112, 222, 74, 10, 0.28)}
<ellipse cx="110" cy="196" rx="76" ry="34" fill="#F3F5F8" stroke="#D3DAE3"/><ellipse cx="110" cy="196" rx="68" ry="28" fill="none" stroke="#E0E5EC" stroke-dasharray="2 3"/>
<path d="M66 184v8q0 16 44 16t44-16v-8z" fill="url(#ID_wx)"/><rect x="66" y="168" width="88" height="32" rx="16" fill="url(#ID_w)" stroke="#CAD2DC" stroke-width=".9"/>
<rect x="78" y="173" width="44" height="6" rx="3" fill="#FFFFFF"/><circle cx="136" cy="184" r="5" class="ah"/><circle cx="134.500" cy="182.500" r="1.6" fill="#FFFFFF" opacity=".8"/>`),

  /* A smart ring */
  "smart-ring": svg(`${fl(204, 246, 104, 13)}
<linearGradient id="ID_r" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F6F7F9"/><stop offset=".2" stop-color="#B9C0CB"/><stop offset=".42" stop-color="#F9FAFB"/><stop offset=".62" stop-color="#8D97A6"/><stop offset=".82" stop-color="#DDE2E9"/><stop offset="1" stop-color="#6E7989"/></linearGradient>
<linearGradient id="ID_ri" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#232A38"/><stop offset=".5" stop-color="#4A5466"/><stop offset="1" stop-color="#161B26"/></linearGradient>
<g transform="rotate(-10 200 148)">
<path fill-rule="evenodd" d="M206 70a58 78 0 1 0 0 156a58 78 0 1 0 0-156zm8 6a50 72 0 1 1 0 144a50 72 0 1 1 0-144z" fill="url(#ID_ri)"/>
<path fill-rule="evenodd" d="M200 52a80 96 0 1 0 0 192a80 96 0 1 0 0-192zm6 18a58 78 0 1 1 0 156a58 78 0 1 1 0-156z" fill="url(#ID_r)"/>
<path d="M206 70a58 78 0 0 0 0 156" fill="none" stroke="#FFFFFF" stroke-opacity=".7" stroke-width="1.600"/>
<path d="M264 148a58 78 0 0 0-58-78M206 226a58 78 0 0 0 58-78" fill="none" stroke="#5B6577" stroke-opacity=".5" stroke-width="1.200"/>
<path d="M133 110a74 90 0 0 1 41.700-46.600" fill="none" stroke="#FFFFFF" stroke-width="5" stroke-linecap="round" opacity=".9"/>
<path d="M269.500 178.800a74 90 0 0 1-32.500 47.200" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" opacity=".6"/>
<path d="M130.400 178.800a74 90 0 0 0 32.600 47.200" fill="none" class="ahs" stroke-width="4" stroke-linecap="round" opacity=".6"/>
<ellipse cx="155" cy="148" rx="3.600" ry="8" fill="#0E131C"/><ellipse cx="158" cy="120" rx="3.200" ry="7" fill="#0E131C"/><ellipse cx="158" cy="176" rx="3.200" ry="7" fill="#0E131C"/>
<ellipse cx="155" cy="148" rx="1.500" ry="3.400" fill="#52D68A"/><ellipse cx="158" cy="120" rx="1.300" ry="3" fill="#FF6B6B"/><ellipse cx="158" cy="176" rx="1.300" ry="3" fill="#FF6B6B"/>
</g>`),

  /* A square smartwatch */
  "watch-square": svg(`${fl(200, 268, 78, 8)}<g transform="translate(200 150) scale(.9) translate(-200 -150)">
<path d="M158 18h84l8 62h-100z" fill="url(#ID_hx)"/><path d="M150 220h100l-8 62h-84z" fill="url(#ID_hx)"/>
<path d="M166 22h8M166 34h8M166 46h8" stroke="#0B1220" stroke-opacity=".25" stroke-width="3" stroke-linecap="round"/><path d="M190 240h20M190 254h20M190 268h20" stroke="#0B1220" stroke-opacity=".22" stroke-width="5" stroke-linecap="round"/>
<rect x="260" y="118" width="12" height="30" rx="5" fill="url(#ID_my)" stroke="#7C8797" stroke-width=".8"/><rect x="258" y="164" width="8" height="24" rx="3" fill="url(#ID_my)"/>
<rect x="134" y="70" width="132" height="160" rx="38" fill="url(#ID_m)"/><rect x="134" y="70" width="132" height="160" rx="38" fill="url(#ID_my)" opacity=".4"/>
<rect x="141" y="77" width="118" height="146" rx="32" fill="#0C0F16"/><rect x="146" y="82" width="108" height="136" rx="28" fill="url(#ID_k)"/>
<circle cx="200" cy="140" r="34" fill="none" stroke="#2A3242" stroke-width="9"/><path d="M200 106a34 34 0 1 1-30 18" fill="none" class="ahs" stroke-width="9" stroke-linecap="round"/>
<circle cx="200" cy="140" r="20" fill="none" stroke="#2A3242" stroke-width="7"/><path d="M200 120a20 20 0 0 1 14 34" fill="none" stroke="#7CE0B0" stroke-width="7" stroke-linecap="round"/>
<rect x="168" y="190" width="30" height="7" rx="3.5" fill="#E8ECF2" opacity=".9"/><rect x="204" y="190" width="28" height="7" rx="3.5" fill="#E8ECF2" opacity=".35"/>
<path d="M146 110a28 28 0 0 1 28-28h56l-58 136h-12a14 14 0 0 1-14-14z" fill="#FFFFFF" opacity=".09"/>
<path d="M150 96a26 26 0 0 1 22-22" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" opacity=".9"/></g>`),

  /* A round sports watch */
  "watch-round": svg(`${fl(200, 270, 80, 8)}<g transform="translate(200 150) scale(.88) translate(-200 -150)">
<path d="M160 12h80l10 74h-100z" fill="#3B4352"/><path d="M150 214h100l-10 74h-80z" fill="#3B4352"/>
<path d="M160 12h18l-6 74h-22z" fill="#FFFFFF" opacity=".12"/><path d="M150 214h22l6 74h-18z" fill="#FFFFFF" opacity=".1"/>
<path d="M172 28h56M170 44h60M168 60h64M168 240h64M170 256h60M172 272h56" stroke="#0B1220" stroke-opacity=".35" stroke-width="3"/>
<circle cx="200" cy="242" r="3.500" fill="#12161F"/><circle cx="200" cy="258" r="3.500" fill="#12161F"/><circle cx="200" cy="274" r="3.500" fill="#12161F"/>
<g fill="url(#ID_my)" stroke="#6E7989" stroke-width=".8"><rect x="276" y="104" width="12" height="22" rx="4" transform="rotate(-24 282 115)"/><rect x="276" y="174" width="12" height="22" rx="4" transform="rotate(24 282 185)"/><rect x="112" y="104" width="12" height="22" rx="4" transform="rotate(24 118 115)"/><rect x="112" y="174" width="12" height="22" rx="4" transform="rotate(-24 118 185)"/></g>
<circle cx="200" cy="150" r="86" fill="url(#ID_m)"/><circle cx="200" cy="150" r="86" fill="url(#ID_my)" opacity=".45"/><circle cx="200" cy="150" r="76" fill="#232A36"/>
<circle cx="200" cy="150" r="72" fill="none" stroke="#8C97A6" stroke-width="5" stroke-dasharray="1.5 9.800" opacity=".8"/>
<circle cx="200" cy="150" r="64" fill="url(#ID_k)"/>
<path d="M200 98a52 52 0 1 1-45 26" fill="none" class="ahs" stroke-width="8" stroke-linecap="round"/><circle cx="200" cy="150" r="52" fill="none" stroke="#FFFFFF" stroke-opacity=".08" stroke-width="8"/>
<path d="M166 152h14l7-16 10 30 8-20 5 6h24" fill="none" stroke="#FF7A8A" stroke-width="3.400" stroke-linecap="round" stroke-linejoin="round"/>
<rect x="180" y="176" width="40" height="7" rx="3.5" fill="#E8ECF2" opacity=".85"/><rect x="186" y="118" width="28" height="6" rx="3" fill="#E8ECF2" opacity=".4"/>
<path d="M138 150a62 62 0 0 1 62-62q20 0 34 10l-80 96q-16-18-16-44z" fill="#FFFFFF" opacity=".07"/>
<path d="M128 112a82 82 0 0 1 50-44" fill="none" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round" opacity=".9"/></g>`),

  /* A slim fitness band */
  "fitness-band": svg(`${fl(200, 250, 130, 12)}
${g("translate(200 150) rotate(-30) scale(.8) translate(-200 -150)", `<path d="M178 -20h44l6 108h-56z" fill="url(#ID_hx)"/><path d="M172 212h56l-6 108h-44z" fill="url(#ID_hx)"/>
<path d="M188 -8h24M188 8h24M188 24h24" stroke="#0B1220" stroke-opacity=".22" stroke-width="3" stroke-linecap="round"/><circle cx="200" cy="246" r="4" fill="#0B1220" opacity=".3"/><circle cx="200" cy="264" r="4" fill="#0B1220" opacity=".3"/><circle cx="200" cy="282" r="4" fill="#0B1220" opacity=".3"/>
<rect x="168" y="72" width="64" height="156" rx="30" fill="#0B1220" opacity=".3" filter="url(#ID_s)" transform="translate(6 6)"/>
<rect x="166" y="70" width="68" height="160" rx="32" fill="url(#ID_m)"/><rect x="171" y="75" width="58" height="150" rx="27" fill="#0C0F16"/><rect x="175" y="79" width="50" height="142" rx="23" fill="url(#ID_k)"/>
<rect x="188" y="100" width="24" height="6" rx="3" fill="#E8ECF2" opacity=".85"/><path d="M188 134h7l4-10 6 20 4-10h4" fill="none" stroke="#FF7A8A" stroke-width="2.800" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M190 196v-14M200 196v-26M210 196v-18" class="ahs" stroke-width="6" stroke-linecap="round"/>
<path d="M175 104a23 23 0 0 1 23-23h14l-30 138a23 23 0 0 1-7-16z" fill="#FFFFFF" opacity=".1"/><path d="M172 104a28 28 0 0 1 18-28" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" opacity=".9"/>`)}`),

  /* A screenless fabric strap */
  "fabric-strap": svg(`${fl(200, 250, 132, 13)}
<path d="M70 132a130 62 0 0 1 260 0v34a130 62 0 0 0-260 0z" class="ahd"/><path d="M70 132a130 62 0 0 1 260 0v34a130 62 0 0 0-260 0z" fill="#0B1220" opacity=".35"/>
<path d="M70 132a130 62 0 0 0 260 0v58a130 62 0 0 1-260 0z" fill="url(#ID_hx)"/><path d="M70 132a130 62 0 0 0 260 0v58a130 62 0 0 1-260 0z" fill="url(#ID_f)"/>
<path d="M70 136a130 62 0 0 0 260 0" fill="none" stroke="#FFFFFF" stroke-opacity=".45" stroke-width="2"/><path d="M70 186a130 62 0 0 0 260 0" fill="none" stroke="#0B1220" stroke-opacity=".25" stroke-width="2"/>
<path d="M152 184q48 12 96 0v58q-48 12-96 0z" fill="#0B1220" opacity=".3" filter="url(#ID_s)" transform="translate(4 5)"/>
<path d="M150 180q50 13 100 0v62q-50 13-100 0z" fill="url(#ID_k)"/><path d="M150 180q50 13 100 0" fill="none" stroke="#5B6577" stroke-width="2"/>
<path d="M158 190q20 6 40 6l-14 54q-14-1-26-4z" fill="#FFFFFF" opacity=".1"/>
<path d="M286 166l26-10v58l-26 10z" fill="url(#ID_my)" stroke="#6E7989" stroke-width=".8"/><path d="M292 172l14-5v44l-14 5z" fill="#3B4352"/>
<path d="M84 150a130 62 0 0 0 44 36" fill="none" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round" opacity=".35"/>`, FABRIC),

  /* A menstrual heat wrap with its pouch */
  "heat-wrap": svg(`${fl(200, 250, 160, 12)}
${g("translate(216 36) rotate(14)", `<rect x="5" y="8" width="130" height="156" rx="6" fill="#0B1220" opacity=".22" filter="url(#ID_s)"/>
<rect width="130" height="156" rx="6" fill="url(#ID_h)"/><rect width="130" height="156" rx="6" fill="url(#ID_gl)"/>
<path d="M3 9h124M3 147h124" stroke="#0B1220" stroke-opacity=".2" stroke-width="10" stroke-dasharray="1.4 2.6"/>
<rect x="24" y="36" width="82" height="60" rx="8" fill="#FFFFFF" opacity=".92"/><rect x="36" y="50" width="48" height="6" rx="3" class="ah"/><rect x="36" y="64" width="34" height="5" rx="2.500" fill="#C5CDD8"/><rect x="36" y="76" width="42" height="5" rx="2.500" fill="#C5CDD8"/>`)}
<path d="M40 176q-6-46 46-50q40-2 66 10q28 12 56 0q26-12 66-10q52 4 46 50q-6 44-52 48q-34 2-60-14q-28-14-56 0q-26 16-60 14q-46-4-52-48z" fill="#0B1220" opacity=".26" filter="url(#ID_s)" transform="translate(4 8)"/>
<path d="M40 176q-6-46 46-50q40-2 66 10q28 12 56 0q26-12 66-10q52 4 46 50q-6 44-52 48q-34 2-60-14q-28-14-56 0q-26 16-60 14q-46-4-52-48z" fill="url(#ID_w)" stroke="#CDD4DE" stroke-width="1"/>
<path d="M48 176q-5-39 39-42q37-2 61 9q32 13 64 0q24-11 61-9q44 3 39 42q-5 37-44 40q-31 2-55-13q-33-15-66 0q-24 15-55 13q-39-3-44-40z" fill="none" stroke="#B9C2CD" stroke-width="1.200" stroke-dasharray="4 4"/>
<g fill="#E4E8EE" stroke="#D0D7E0" stroke-width=".8"><ellipse cx="84" cy="160" rx="20" ry="13"/><ellipse cx="128" cy="170" rx="18" ry="12"/><ellipse cx="84" cy="194" rx="20" ry="12"/><ellipse cx="276" cy="160" rx="20" ry="13"/><ellipse cx="232" cy="170" rx="18" ry="12"/><ellipse cx="276" cy="194" rx="20" ry="12"/><ellipse cx="180" cy="178" rx="20" ry="11"/></g>
<g fill="#FFFFFF" opacity=".8"><ellipse cx="78" cy="155" rx="9" ry="3.500"/><ellipse cx="122" cy="165" rx="8" ry="3"/><ellipse cx="270" cy="155" rx="9" ry="3.500"/><ellipse cx="226" cy="165" rx="8" ry="3"/><ellipse cx="174" cy="174" rx="9" ry="3"/></g>
<path d="M60 142q22-12 60-6" fill="none" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round"/>`),

  /* Period underwear, laid flat */
  "period-underwear": svg(`${fl(200, 250, 150, 12)}
<path d="M62 78q138 22 276 0l8 44q-74 22-104 108q-42 14-84 0q-30-86-104-108z" fill="#0B1220" opacity=".26" filter="url(#ID_s)" transform="translate(4 9)"/>
<path d="M62 78q138 22 276 0l8 44q-74 22-104 108q-42 14-84 0q-30-86-104-108z" fill="url(#ID_h)"/>
<path d="M62 78q138 22 276 0l8 44q-74 22-104 108q-42 14-84 0q-30-86-104-108z" fill="url(#ID_f)"/>
<path d="M62 78q138 22 276 0l3 18q-141 23-282 0z" class="ahd"/><path d="M61 86q139 22 278 0" fill="none" stroke="#FFFFFF" stroke-opacity=".45" stroke-width="1.200" stroke-dasharray="3 3"/>
<path d="M60 97q140 23 280 0" fill="none" stroke="#0B1220" stroke-opacity=".28" stroke-width="1.500"/>
<path d="M172 150q28 8 56 0l12 78q-40 12-80 0z" fill="#FFFFFF" opacity=".16"/><path d="M172 150q28 8 56 0" fill="none" stroke="#FFFFFF" stroke-opacity=".5" stroke-width="1.200" stroke-dasharray="3 3"/>
<path d="M58 126q72 22 102 104M342 126q-72 22-102 104" fill="none" stroke="#FFFFFF" stroke-opacity=".5" stroke-width="1.200" stroke-dasharray="3 3"/>
<path d="M54 122q74 22 104 108M346 122q-74 22-104 108" fill="none" stroke="#0B1220" stroke-opacity=".3" stroke-width="2"/>
<path d="M96 104q40 8 84 10l-30 60q-22-34-58-50z" fill="#FFFFFF" opacity=".14"/><rect x="194" y="100" width="12" height="16" rx="2" fill="#FFFFFF" opacity=".9"/>`, FABRIC),

  /* A video visit on a laptop: a clinician's silhouette */
  "video-visit": svg(`${fl(200, 256, 168, 12)}
<rect x="76" y="40" width="248" height="166" rx="12" fill="url(#ID_k)"/><rect x="76" y="40" width="248" height="166" rx="12" fill="none" stroke="#8C97A6" stroke-width="1.500"/>
<clipPath id="ID_c2"><rect x="86" y="50" width="228" height="146" rx="5"/></clipPath>
<g clip-path="url(#ID_c2)"><rect x="86" y="50" width="228" height="146" fill="#DDE6F0"/><rect x="86" y="50" width="228" height="146" class="ahl" opacity=".35"/><rect x="86" y="150" width="228" height="46" fill="#C3CEDB" opacity=".6"/>
<rect x="232" y="62" width="70" height="52" rx="6" fill="#FFFFFF" opacity=".75"/><path d="M244 72h46M244 84h46M244 96h30" class="ahs" stroke-width="4" stroke-linecap="round" opacity=".55"/>
<path d="M128 206q0-62 62-62t62 62z" fill="#FFFFFF"/><path d="M164 150l26 34 26-34q-12-6-26-6t-26 6z" class="ah"/><path d="M178 146l12 22 12-22z" fill="#F1D3C2"/>
<circle cx="190" cy="112" r="30" fill="#F1D3C2"/><path d="M158 112q-4-40 32-40t32 40q-8-22-32-22t-32 22z" fill="#4A3B36"/>
<path d="M170 156q-12 26 4 40M210 156q12 26-4 40" fill="none" stroke="#5B6577" stroke-width="3" stroke-linecap="round"/><circle cx="174" cy="198" r="6" fill="#8C97A6" stroke="#5B6577" stroke-width="2"/>
<rect x="96" y="150" width="46" height="36" rx="5" fill="#2A3242" stroke="#FFFFFF" stroke-width="2"/><circle cx="119" cy="164" r="7" fill="#C9A99A"/><path d="M106 186q0-14 13-14t13 14z" class="ahd"/>
<g transform="translate(176 172)"><rect x="-4" y="4" width="100" height="22" rx="11" fill="#10141D" opacity=".75"/><circle cx="12" cy="15" r="7" fill="#FFFFFF" opacity=".9"/><circle cx="34" cy="15" r="7" fill="#FFFFFF" opacity=".9"/><circle cx="56" cy="15" r="7" fill="#FFFFFF" opacity=".9"/><circle cx="80" cy="15" r="7" fill="#E5484D"/></g>
<path d="M86 50h120l-70 146h-50z" fill="#FFFFFF" opacity=".1"/></g>
<circle cx="200" cy="45" r="2" fill="#5B6577"/>
<path d="M40 214h320l-14 20q-4 6-12 6H66q-8 0-12-6z" fill="url(#ID_my)"/><path d="M40 214h320v6H40z" fill="#F4F6F9"/><path d="M168 214h64v3q0 4-5 4h-54q-5 0-5-4z" fill="#AEB8C4"/>
<rect x="76" y="206" width="248" height="8" fill="#6E7989"/>`),

  /* Folded cooling sheets and a pillow */
  "cooling-bedding": svg(`${fl(200, 254, 168, 13)}
<path d="M54 62q146-22 292 0q14 44 0 92q-146 22-292 0q-14-48 0-92z" fill="#0B1220" opacity=".24" filter="url(#ID_s)" transform="translate(4 8)"/>
<path d="M54 62q146-22 292 0q14 44 0 92q-146 22-292 0q-14-48 0-92z" fill="url(#ID_w)" stroke="#BFC8D3" stroke-width="1.200"/>
<path d="M60 150q140 18 280 0q8-22 6-40q-146 34-292 0q-2 18 6 40z" fill="#AEB8C4" opacity=".35"/>
<path d="M150 58q-10 40 6 94M250 58q10 40-6 94" fill="none" stroke="#B9C2CD" stroke-width="1.500" stroke-linecap="round" opacity=".6"/>
<path d="M54 62q20 6 22 22M346 62q-20 6-22 22M54 154q20-6 22-20M346 154q-20-6-22-20" fill="none" stroke="#B9C2CD" stroke-width="1.500" stroke-linecap="round"/>
<path d="M92 70q108-14 216 0" fill="none" stroke="#FFFFFF" stroke-width="6" stroke-linecap="round"/><path d="M120 132q80 12 160 0" fill="none" stroke="#C5CDD8" stroke-width="2" stroke-linecap="round" opacity=".7"/>
<path d="M62 84q138-16 276 0v52q-138 16-276 0z" class="ahl" opacity=".3"/>
${[[0, 0], [1, 30], [2, 60]].map(([i, y]) => `<g transform="translate(${i * 6 - 6} ${-y})"><path d="M70 226q-10 0-10-12v-8q0-12 10-12h260q10 0 10 12v8q0 12-10 12z" fill="${i === 1 ? "url(#ID_h)" : "url(#ID_w)"}" stroke="${i === 1 ? "none" : "#CFD6DF"}" stroke-width="1"/><path d="M70 226q-10 0-10-16q0-16 10-16" fill="none" stroke="#0B1220" stroke-opacity=".16" stroke-width="2"/><path d="M76 200h240" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" opacity="${i === 1 ? 0.45 : 0.95}"/><path d="M64 210h272" stroke="#0B1220" stroke-opacity=".1" stroke-width="1.500"/><path d="M70 226h260" stroke="#0B1220" stroke-opacity=".14" stroke-width="2"/></g>`).join("")}`),

  /* A phone with a sleep program: a night screen with steps */
  "sleep-app-a": svg(`${fl(206, 268, 86, 9)}
${phone("translate(140 38) rotate(5)", `<rect x="6" y="6" width="100" height="216" fill="url(#ID_n)"/>
<circle cx="56" cy="70" r="26" fill="#FFE9A8"/><circle cx="67" cy="62" r="23" fill="#232750"/>
<circle cx="24" cy="38" r="1.800" fill="#FFFFFF"/><circle cx="88" cy="46" r="1.400" fill="#FFFFFF"/><circle cx="82" cy="98" r="1.800" fill="#FFFFFF"/><circle cx="20" cy="94" r="1.300" fill="#FFFFFF" opacity=".7"/><circle cx="94" cy="26" r="1.200" fill="#FFFFFF" opacity=".7"/>
${[0, 1, 2].map((i) => `<rect x="14" y="${122 + i * 30}" width="84" height="24" rx="8" fill="#FFFFFF" opacity="${i ? 0.14 : 0.24}"/><circle cx="27" cy="${134 + i * 30}" r="6.500" ${i ? 'fill="none" stroke="#FFFFFF" stroke-opacity=".6" stroke-width="1.500"' : 'class="ahl"'}/>${i ? "" : `<path d="M24 ${134}l2.400 2.600 4.200-5" fill="none" stroke="#1B1F3B" stroke-width="1.800" stroke-linecap="round" stroke-linejoin="round"/>`}<rect x="40" y="${131 + i * 30}" width="${[44, 36, 40][i]}" height="5" rx="2.500" fill="#FFFFFF" opacity=".85"/>`).join("")}`, "c3")}`, NIGHT),

  /* A phone with a sleep diary: bars for the week's nights */
  "sleep-app-b": svg(`${fl(194, 268, 86, 9)}
${phone("translate(138 40) rotate(-6)", `<rect x="6" y="6" width="100" height="216" fill="#F5F7FA"/><rect x="6" y="6" width="100" height="72" fill="url(#ID_n)"/>
<circle cx="30" cy="46" r="11" fill="#FFE9A8"/><circle cx="35" cy="42" r="9.500" fill="#20244A"/><rect x="50" y="38" width="42" height="6" rx="3" fill="#FFFFFF" opacity=".95"/><rect x="50" y="50" width="28" height="5" rx="2.500" fill="#FFFFFF" opacity=".55"/>
<rect x="14" y="88" width="84" height="74" rx="9" fill="#FFFFFF" stroke="#E1E6ED"/><path d="M22 148h68" stroke="#E1E6ED" stroke-width="1.500"/>
<path d="M27 146v-26M38 146v-38M49 146v-18M60 146v-42M71 146v-30M82 146v-36" class="ahs" stroke-width="6.500" stroke-linecap="round"/>
<rect x="14" y="170" width="84" height="18" rx="9" fill="#E6EAF0"/><rect x="72" y="172" width="24" height="14" rx="7" class="ah"/><circle cx="89" cy="179" r="5" fill="#FFFFFF"/><rect x="22" y="176" width="36" height="5" rx="2.500" fill="#AEB8C4"/>
<rect x="14" y="194" width="84" height="18" rx="9" fill="#E6EAF0"/><rect x="22" y="200" width="44" height="5" rx="2.500" fill="#AEB8C4"/>`, "c4")}`, NIGHT),

  /* A home collection kit: the box, a collection card with a lancet */
  "lab-kit": svg(`${fl(200, 254, 166, 13)}
<path d="M70 96l40-34h180l40 34z" fill="#F7F9FB" stroke="#D3DAE3" stroke-width=".9"/><path d="M110 62h180l-8 8H118z" fill="#FFFFFF"/>
<rect x="70" y="96" width="260" height="110" rx="3" fill="url(#ID_w)" stroke="#D3DAE3" stroke-width=".9"/>
<rect x="70" y="96" width="260" height="34" fill="url(#ID_h)"/><rect x="92" y="109" width="84" height="8" rx="4" fill="#FFFFFF" opacity=".95"/>
<rect x="92" y="146" width="110" height="6" rx="3" fill="#C5CDD8"/><rect x="92" y="160" width="76" height="6" rx="3" fill="#D8DEE6"/>
<circle cx="288" cy="166" r="20" class="ahl" opacity=".5"/><path d="M288 154v24M276 166h24" class="ahs" stroke-width="6" stroke-linecap="round"/>
<path d="M70 96h8v110h-8z" fill="#FFFFFF" opacity=".6"/><path d="M70 206h260" stroke="#0B1220" stroke-opacity=".12" stroke-width="2"/>
${g("translate(60 178) rotate(-8)", `<rect x="4" y="7" width="150" height="74" rx="6" fill="#0B1220" opacity=".26" filter="url(#ID_s)"/>
<rect width="150" height="74" rx="6" fill="#FFFFFF" stroke="#D3DAE3"/><rect width="150" height="16" rx="6" class="ahl"/><rect x="10" y="5" width="50" height="5" rx="2.500" class="ahd" opacity=".7"/>
${[0, 1, 2, 3, 4].map((i) => `<circle cx="${22 + i * 27}" cy="46" r="10.500" fill="${i < 3 ? "#B4232A" : "#FFFFFF"}" stroke="#9AA5B4" stroke-width="1.200" stroke-dasharray="${i < 3 ? "none" : "2.500 2.500"}"/>${i < 3 ? `<ellipse cx="${19 + i * 27}" cy="42" rx="4" ry="2.200" fill="#FFFFFF" opacity=".35"/>` : ""}`).join("")}`)}
${g("translate(258 204) rotate(-18)", `<rect x="3" y="6" width="96" height="26" rx="13" fill="#0B1220" opacity=".26" filter="url(#ID_s)"/>
<rect width="96" height="26" rx="13" fill="url(#ID_w)" stroke="#C5CDD8" stroke-width=".9"/><path d="M13 0h26v26H13A13 13 0 0 1 13 0z" fill="url(#ID_h)"/><rect x="92" y="8" width="12" height="10" rx="3" fill="#D3DAE3" stroke="#AEB8C4" stroke-width=".8"/>
<rect x="12" y="4" width="70" height="4" rx="2" fill="#FFFFFF" opacity=".8"/><path d="M52 4v18M60 4v18M68 4v18" stroke="#C5CDD8" stroke-width="1.200"/>`)}`),

  /* A lab visit: the requisition form and a blood tube */
  "lab-visit": svg(`${fl(200, 256, 160, 12)}
${g("translate(92 30) rotate(-7)", `<rect x="6" y="9" width="178" height="226" rx="5" fill="#0B1220" opacity=".24" filter="url(#ID_s)"/>
<rect width="178" height="226" rx="5" fill="#FFFFFF" stroke="#D3DAE3"/><rect width="178" height="34" rx="5" fill="url(#ID_h)"/><rect x="14" y="13" width="70" height="8" rx="4" fill="#FFFFFF" opacity=".95"/>
<path d="M122 10v16M127 10v16M130 10v16M136 10v16M139 10v16M144 10v16M150 10v16M153 10v16M158 10v16M164 10v16" stroke="#FFFFFF" stroke-width="2" opacity=".9"/>
<rect x="14" y="48" width="96" height="6" rx="3" fill="#AEB8C4"/><rect x="14" y="62" width="66" height="5" rx="2.500" fill="#D3DAE3"/>
${[0, 1, 2, 3, 4].map((i) => `<rect x="14" y="${86 + i * 24}" width="13" height="13" rx="3" fill="${i === 1 || i === 3 ? "none" : "#FFFFFF"}" ${i === 1 || i === 3 ? 'class="ah"' : ""} stroke="#9AA5B4" stroke-width="1.200"/>${i === 1 || i === 3 ? `<path d="M17 ${92.500 + i * 24}l2.800 3 4.600-5.600" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>` : ""}<rect x="36" y="${90 + i * 24}" width="${[92, 110, 78, 100, 86][i]}" height="5" rx="2.500" fill="#C5CDD8"/>`).join("")}
<path d="M14 204h70" stroke="#5B6577" stroke-width="1.500"/><path d="M18 200q8-12 14-2t12-4t10 4" fill="none" stroke="#39424F" stroke-width="1.600" stroke-linecap="round"/>`)}
<linearGradient id="ID_bl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#C92A34"/><stop offset=".35" stop-color="#8E1118"/><stop offset="1" stop-color="#5E0A10"/></linearGradient>
${g("translate(150 214) rotate(-24)", `<rect x="5" y="9" width="206" height="38" rx="16" fill="#0B1220" opacity=".3" filter="url(#ID_s)"/>
<path d="M44 2h146q20 0 20 18t-20 18H44z" fill="#EEF2F6" stroke="#B9C2CD" stroke-width="1"/><path d="M92 4h98q18 0 18 16t-18 16H92z" fill="url(#ID_bl)"/>
<rect x="56" y="5" width="74" height="30" rx="2" fill="#FFFFFF" stroke="#D3DAE3" stroke-width=".8"/><path d="M64 14h50M64 21h36M64 28h44" stroke="#AEB8C4" stroke-width="2.400" stroke-linecap="round"/><path d="M118 10v20M121.500 10v20M124 10v20" stroke="#39424F" stroke-width="1.300"/>
<path d="M48 8h140q12 0 16 6" fill="none" stroke="#FFFFFF" stroke-width="3.500" stroke-linecap="round" opacity=".75"/>
<rect x="0" y="-3" width="50" height="46" rx="8" fill="url(#ID_h)"/><path d="M8 -3v46M16 -3v46M24 -3v46M32 -3v46M40 -3v46" stroke="#0B1220" stroke-opacity=".16" stroke-width="2"/><rect x="2" y="0" width="46" height="7" rx="3.500" fill="#FFFFFF" opacity=".45"/>`)}`),
});

export const ART_IDS = Object.freeze(Object.keys(SHOP_ART));
/* What each id draws, for the portal's picker (owner only). */
export const ART_LABEL = Object.freeze({
  "lh-strips": "Test strips with a pouch", "ovulation-digital": "Digital test stick with a screen", "hormone-monitor": "Handheld hormone monitor and wand",
  "phone-reader": "Phone with a clip-on reader", "pdg-strips": "Box of test strips", thermometer: "Basal thermometer", vitamins: "Vitamin bottle with softgels",
  "pregnancy-test": "Pregnancy test stick", "cgm-a": "Glucose sensor with a tall applicator", "cgm-b": "Glucose sensor with a short applicator",
  "smart-ring": "Smart ring", "watch-square": "Square smartwatch", "watch-round": "Round sports watch", "fitness-band": "Slim fitness band",
  "fabric-strap": "Screenless fabric strap", "heat-wrap": "Heat wrap", "period-underwear": "Period underwear", "video-visit": "Video visit with a clinician",
  "cooling-bedding": "Folded sheets and a pillow", "sleep-app-a": "Phone with a sleep program", "sleep-app-b": "Phone with a sleep diary",
  "lab-kit": "Home collection kit", "lab-visit": "Lab form and a blood tube",
});
/* The drawing for a need when a product names none (or an unknown one). */
export const ART_DEFAULT = Object.freeze({ fertility: "lh-strips", pregnancy: "pregnancy-test", labs: "lab-kit", glucose: "cgm-a", wearables: "watch-round", periods: "heat-wrap", meno: "cooling-bedding", sleep: "sleep-app-a" });
/** A known art id, else null. */
export const cleanArt = (v) => (typeof v === "string" && Object.prototype.hasOwnProperty.call(SHOP_ART, v) ? v : null);
/** The art id to draw for an item: its own when known, else its need's default. */
export const artFor = (item) => cleanArt(item && item.art) || ART_DEFAULT[item && item.category] || "lab-kit";
/** The inner SVG markup of an art id with its ids made unique (uid: letters and digits only). */
export const artSvg = (id, uid = "a") => (SHOP_ART[cleanArt(id) || "lab-kit"] || "").replace(/ID_/g, `${String(uid).replace(/[^A-Za-z0-9]/g, "")}_`);
