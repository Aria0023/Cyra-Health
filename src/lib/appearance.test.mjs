/* Unit tests for lib/appearance.js and the L2 colour tables in lib/constants.js (light and dark mode,
   decision D9). Run with `npm run test:unit`. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  APPEARANCES, DEFAULT_APPEARANCE, cleanAppearance, resolveScheme, PALETTE_KEYS, paletteFor, paletteVars, tokenDecls, applyDocumentScheme, strongMeterWord,
} from "./appearance.js";
import { PALETTES, ORGS, SCHEME_TOKENS, FAMILIES, RAMPS, RAMPS_DARK, SOFT_RAMP, stagePalettes, MENO_NAME, famVar, famColor, rampOf, rampVar, vizVars } from "./constants.js";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");

/* ---------- WCAG contrast; color-mix(in srgb, a p%, b) as a straight sRGB mix ---------- */
const hex2rgb = (h) => { h = h.replace("#", ""); if (h.length === 3) h = h.split("").map((c) => c + c).join(""); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); };
const rgb2hex = (c) => "#" + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("").toUpperCase();
const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const lum = (h) => { const [r, g, b] = typeof h === "string" ? hex2rgb(h) : h; return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b); };
const cr = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const mix = (a, b, p) => { const A = hex2rgb(a), B = hex2rgb(b); return rgb2hex(A.map((v, i) => v * p + B[i] * (1 - p))); }; // p = share of a

/* ---------- OKLab / OKLCH and CVD simulation, copied from the dataviz skill's validator
   (scripts/validate_palette.js): Machado, Oliveira & Fernandes (2009) at severity 1.0 on linear RGB,
   Delta E as Euclidean OKLab distance ×100. ---------- */
const s2lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const linRgb = (h) => hex2rgb(h).map((v) => s2lin(v / 255));
const MACHADO = {
  protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
};
const oklabFromLin = ([r, g, b]) => {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s, 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s];
};
const simulate = (h, kind) => { const [r, g, b] = linRgb(h), M = MACHADO[kind], cl = (c) => Math.max(0, Math.min(1, c)); return M.map((row) => cl(row[0] * r + row[1] * g + row[2] * b)); };
const deltaE = (h1, h2, kind) => { const a = oklabFromLin(kind ? simulate(h1, kind) : linRgb(h1)), b = oklabFromLin(kind ? simulate(h2, kind) : linRgb(h2)); return 100 * Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); };
const oklch = (h) => { const [L, a, b] = oklabFromLin(linRgb(h)); return [L, Math.hypot(a, b)]; };
const pairs = (xs) => xs.flatMap((a, i) => xs.slice(i + 1).map((b) => [a, b]));
/* The validator's --mode dark --pairs all checks, over a set of hex colours and the surfaces they sit on. */
const darkVizChecks = (name, set, cards) => {
  for (const c of set) {
    const [L, C] = oklch(c);
    assert.ok(L >= 0.48 && L <= 0.67, `${name} ${c}: OKLCH L ${L.toFixed(3)} outside the dark band 0.48–0.67`);
    assert.ok(C >= 0.10, `${name} ${c}: OKLCH C ${C.toFixed(3)} under 0.10`);
    for (const card of cards) assert.ok(cr(c, card) >= 3, `${name} ${c} on ${card}: ${cr(c, card).toFixed(2)} < 3`);
  }
  for (const [a, b] of pairs(set)) {
    assert.ok(deltaE(a, b) >= 15, `${name} ${a}/${b}: normal-vision ΔE ${deltaE(a, b).toFixed(1)} < 15`);
    for (const kind of ["protan", "deutan"]) assert.ok(deltaE(a, b, kind) >= 8, `${name} ${a}/${b}: ${kind} ΔE ${deltaE(a, b, kind).toFixed(1)} < 8`);
  }
};

const THEMES = [...Object.entries(PALETTES).flatMap(([st, ps]) => ps.map((p) => [`${st}.${p.id}`, p])), ...Object.entries(ORGS).map(([k, o]) => [`ORGS.${k}`, o.theme])];
const DARK_CARDS = THEMES.map(([, p]) => p.dark.card);
const HEX = /^#[0-9A-F]{6}$/;

test("resolveScheme (L2): System follows the device, Light and Dark override it, printing is always light", () => {
  assert.equal(resolveScheme("system", false), "light");
  assert.equal(resolveScheme("system", true), "dark");
  assert.equal(resolveScheme("light", true), "light");
  assert.equal(resolveScheme("dark", false), "dark");
  for (const a of ["system", "light", "dark"]) for (const sd of [false, true]) assert.equal(resolveScheme(a, sd, true), "light", `${a}/${sd} printing`);
});

test("cleanAppearance (L2): the three keys pass through; anything else reads as System", () => {
  for (const v of ["system", "light", "dark"]) assert.equal(cleanAppearance(v), v);
  for (const v of [undefined, null, "", "Dark", "auto", 1, {}]) assert.equal(cleanAppearance(v), "system", JSON.stringify(v));
  assert.equal(DEFAULT_APPEARANCE, "system");
  assert.deepEqual(APPEARANCES.map(([, l]) => l), ["System", "Light", "Dark"]);
  assert.deepEqual(APPEARANCES.map(([k]) => k), ["system", "light", "dark"]);
});

test("paletteFor / paletteVars (L2): all 11 themes carry a dark set of the same seven hex tokens", () => {
  assert.equal(THEMES.length, 11);
  for (const [name, p] of THEMES) {
    assert.ok(p.dark, `${name} has no dark`);
    assert.deepEqual(Object.keys(p.dark).sort(), [...PALETTE_KEYS].sort(), name);
    for (const k of PALETTE_KEYS) assert.match(p.dark[k], HEX, `${name}.dark.${k}`);
    assert.deepEqual(paletteFor(p, "light"), Object.fromEntries(PALETTE_KEYS.map((k) => [k, p[k]])), name);
    assert.deepEqual(paletteFor(p, "dark"), Object.fromEntries(PALETTE_KEYS.map((k) => [k, p.dark[k]])), name);
  }
  const v = paletteVars(paletteFor(PALETTES.peri[0], "light"));
  assert.deepEqual(Object.keys(v), ["--primary", "--paper", "--card", "--accent", "--ink", "--soft", "--line"]);
  assert.equal(v["--primary"], "#6B52A8");
});

test("dark palettes (L2): WCAG AA for text and 3:1 for UI boundaries in every one of the 11", () => {
  for (const [name, p] of THEMES) {
    const d = p.dark;
    const tint = (c, pc, on = d.card) => mix(c, on, pc / 100);
    const pt = mix(d.primary, d.ink, 0.82), at = mix(d.accent, d.ink, 0.82); // --primary-text, --accent-text
    const checks = {
      "ink/paper": [cr(d.ink, d.paper), 7], "ink/card": [cr(d.ink, d.card), 7],
      "soft/paper": [cr(d.soft, d.paper), 4.5], "soft/card": [cr(d.soft, d.card), 4.5],
      "soft/primary 10% tint": [cr(d.soft, tint(d.primary, 10)), 4.5], "soft/accent 10% tint": [cr(d.soft, tint(d.accent, 10)), 4.5], "soft/ink 5% tint": [cr(d.soft, tint(d.ink, 5)), 4.5],
      "line/card": [cr(d.line, d.card), 3], "line/paper": [cr(d.line, d.paper), 3],
      "primary/card": [cr(d.primary, d.card), 4.5], "primary/paper": [cr(d.primary, d.paper), 4.5], "primary/its 16% tint": [cr(d.primary, tint(d.primary, 16)), 4.5],
      "primary-text/paper": [cr(pt, d.paper), 4.5], "primary-text/primary 16% tint": [cr(pt, tint(d.primary, 16)), 4.5],
      "accent/card": [cr(d.accent, d.card), 4.5], "accent/paper": [cr(d.accent, d.paper), 4.5],
      "accent-text/accent 10% tint": [cr(at, tint(d.accent, 10)), 4.5], "accent-text/accent 16% tint": [cr(at, tint(d.accent, 16)), 4.5],
      "on-primary (paper)/primary": [cr(d.paper, d.primary), 4.5],
    };
    for (const [k, [v, min]] of Object.entries(checks)) assert.ok(v >= min, `${name} ${k}: ${v.toFixed(2)} < ${min}`);
  }
  // The light palettes keep the UI S1 claim: --primary-text is AA on paper.
  for (const ps of Object.values(PALETTES)) for (const p of ps) assert.ok(cr(mix(p.primary, p.ink, 0.82), p.paper) >= 4.5, `${p.id} light primary-text`);
});

test("SCHEME_TOKENS (L2, v2 in calm R1): light is the v2 literals; dark has the same keys and passes against every dark palette", () => {
  assert.deepEqual(SCHEME_TOKENS.light, {
    "--good": "#43604F", "--bad": "#A04545", "--bad-bg": "#FBEEEA", "--bad-chip": "#F3DBDB", "--err-line": "#E0A99B", "--err-edge": "#E7C3B8",
    "--ev-mixed-bg": "#FBEEE2", "--ev-mixed-ink": "#8A4E18", "--ev-comfort-bg": "#EDE7EF", "--ev-comfort-ink": "#6E6076",
    "--on-primary": "#FFF", "--on-bad": "#FFF", "--on-ink": "#FFF", "--knob": "#FFF", "--knob-edge": "rgba(0,0,0,.12)",
    "--halo": "rgba(255,255,255,.7)", "--mark-edge": "rgba(0,0,0,.35)", "--cell-edge": "rgba(0,0,0,.14)", "--toast-dot": "var(--accent)",
    "--sh-card": "0 1px 2px rgba(30,33,50,.04), 0 10px 28px -12px rgba(30,33,50,.14)", "--sh-opt": "0 1px 2px rgba(30,33,50,.05)", "--sh-meter": "0 1px 3px rgba(30,33,50,.06)",
    "--sh-sheet": "0 -2px 6px rgba(30,33,50,.04), 0 18px 48px -12px rgba(30,33,50,.22)", "--sh-thumb": "0 1px 2px rgba(0,0,0,.2)", "--sh-toast": "0 4px 14px rgba(0,0,0,.18)",
    "--edge": "#ECE7E3", "--wash-a": "rgba(150,120,230,.06)", "--wash-b": "rgba(100,165,235,.06)", "--wash-c": "rgba(240,130,175,.06)",
    "--tint-mind": "#EAF1FB", "--tint-body": "#F5EDF8", "--tint-patterns": "#FDF0E6", "--tint-you": "#F2F0ED",
    "--sh-lift": "0 2px 6px rgba(30,33,50,.06), 0 14px 32px -10px rgba(30,33,50,.24)", "--scrim": "rgba(30,33,50,.34)",
    "--brand": "#4A5DB0",
  });
  assert.deepEqual(Object.keys(SCHEME_TOKENS.dark).sort(), Object.keys(SCHEME_TOKENS.light).sort());
  const T = SCHEME_TOKENS.dark;
  for (const [name, p] of THEMES) {
    const d = p.dark;
    const checks = {
      "good/card": [cr(T["--good"], d.card), 4.5], "good/paper": [cr(T["--good"], d.paper), 4.5], "good/its 13% tint": [cr(T["--good"], mix(T["--good"], d.card, 0.13)), 4.5],
      "bad/card": [cr(T["--bad"], d.card), 4.5], "bad/paper": [cr(T["--bad"], d.paper), 4.5], "bad/bad-bg": [cr(T["--bad"], T["--bad-bg"]), 4.5], "bad/bad-chip": [cr(T["--bad"], T["--bad-chip"]), 4.5],
      "on-bad (paper)/bad": [cr(d.paper, T["--bad"]), 4.5],
      "err-line/card": [cr(T["--err-line"], d.card), 3],
      "ev-mixed": [cr(T["--ev-mixed-ink"], T["--ev-mixed-bg"]), 4.5], "ev-comfort": [cr(T["--ev-comfort-ink"], T["--ev-comfort-bg"]), 4.5],
      "on-ink (paper)/ink": [cr(d.paper, d.ink), 4.5],
    };
    for (const [k, [v, min]] of Object.entries(checks)) assert.ok(v >= min, `${name} ${k}: ${v.toFixed(2)} < ${min}`);
  }
  assert.equal(tokenDecls({ "--a": "x", "--b": "y" }), "--a:x;--b:y");
  assert.equal(tokenDecls({ "--a": "x", "--b": "y" }, true), "--a:x !important;--b:y !important");
});

test("applyDocumentScheme (L2): color-scheme, --doc-bg and every theme-color meta follow the paper on screen", () => {
  const fake = () => {
    const props = {}, metas = [{ content: "", setAttribute(k, v) { this[k] = v; } }, { content: "", setAttribute(k, v) { this[k] = v; } }];
    return { props, metas, doc: { documentElement: { style: { colorScheme: "", setProperty: (k, v) => { props[k] = v; } } }, querySelectorAll: (q) => (q === 'meta[name="theme-color"]' ? metas : []) } };
  };
  const a = fake();
  applyDocumentScheme(a.doc, { scheme: "dark", paper: "#121815" });
  assert.equal(a.doc.documentElement.style.colorScheme, "dark");
  assert.equal(a.props["--doc-bg"], "#121815");
  assert.deepEqual(a.metas.map((m) => m.content), ["#121815", "#121815"]);
  const b = fake();
  applyDocumentScheme(b.doc, { scheme: "light", paper: "#E4EBE7" });
  assert.equal(b.doc.documentElement.style.colorScheme, "light");
  assert.equal(b.props["--doc-bg"], "#E4EBE7");
  assert.deepEqual(b.metas.map((m) => m.content), ["#E4EBE7", "#E4EBE7"]);
});

test("data viz (L2): FAMILIES dark and RAMPS_DARK pass the validator's dark checks on every dark card", () => {
  assert.deepEqual(FAMILIES.map((f) => f.color), ["#E34948", "#2A78D6", "#008300", "#EDA100", "#1BAF7A"]);
  for (const f of FAMILIES) assert.match(f.dark, HEX, f.id);
  darkVizChecks("FAMILIES", FAMILIES.map((f) => f.dark), DARK_CARDS);
  for (const st of ["peri", "preg", "periods"]) {
    const R = RAMPS_DARK[st], set = ["good", "mid", "rough"].map((k) => rgb2hex(R[k]));
    darkVizChecks(`RAMPS_DARK.${st}`, set, [...PALETTES[st].map((p) => p.dark.card), ORGS.cyra.theme.dark.card]);
    const Ls = Object.fromEntries(["good", "mid", "rough"].map((k) => [k, oklch(rgb2hex(R[k]))[0]]));
    assert.ok(Ls.mid > Ls.good && Ls.mid > Ls.rough, `${st}: mid is the lightest anchor`);
  }
  // Data-viz colours stay apart from the UI palettes.
  const ui = new Set(THEMES.flatMap(([, p]) => [...PALETTE_KEYS.map((k) => p[k]), ...PALETTE_KEYS.map((k) => p.dark[k])]));
  for (const f of FAMILIES) assert.ok(!ui.has(f.dark) && !ui.has(f.color), f.id);
});

test("vizVars / famVar / famColor / rampOf (L2): data colours arrive as --fam-* and --ramp-* for the scheme", () => {
  assert.equal(vizVars("light", "peri")["--fam-heat"], "#E34948");
  assert.equal(vizVars("light", "peri")["--ramp-mid"], "rgb(246,189,74)");
  assert.equal(vizVars("dark", "peri")["--fam-heat"], "#DF445B");
  assert.equal(vizVars("dark", "peri")["--ramp-mid"], "rgb(189,137,0)");
  assert.deepEqual(vizVars("dark", null), vizVars("dark", "peri"));
  assert.equal(famVar("heat"), "var(--fam-heat)");
  assert.equal(famVar(null), undefined);
  assert.equal(famColor("hf"), "var(--fam-heat)");
  assert.equal(famColor("crm"), "var(--fam-pain)");
  assert.equal(famColor("hb"), undefined);
  assert.equal(rampOf("preg", "dark"), RAMPS_DARK.preg);
  assert.equal(rampOf("x"), RAMPS.peri);
  assert.equal(rampOf("periods"), RAMPS.periods);
  assert.equal(rampVar("mid"), "var(--ramp-mid)");
});

/* ---------- source scans: tokens only, the PDF stays light, nothing in appearance.js reaches storage or the network ---------- */
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
const withoutPrint = (s) => {
  const i = s.indexOf("@media print {");
  if (i < 0) return s;
  let depth = 0, j = i;
  for (; j < s.length; j++) { if (s[j] === "{") depth++; else if (s[j] === "}" && --depth === 0) break; }
  return s.slice(0, i) + s.slice(j + 1);
};
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });

test("source scan (L2): no colour literal in styles.js outside the print block, none in screens or components", () => {
  const css = withoutPrint(readFileSync(join(SRC, "styles.js"), "utf8").replace(/\/\*[\s\S]*?\*\//g, ""));
  assert.equal(css.match(/#[0-9A-Fa-f]{3,8}\b/g), null, "hex in styles.js");
  assert.equal(css.match(/rgba?\(/g), null, "rgb()/rgba() in styles.js");
  assert.equal(css.match(/(?<![\w-])(white|black)(?![\w-])/g), null, "white/black keyword in styles.js");
  for (const f of [...walk(join(SRC, "screens")), ...walk(join(SRC, "components"))].filter((p) => /\.(jsx?|mjs)$/.test(p))) {
    const code = stripComments(readFileSync(f, "utf8"));
    assert.equal(code.match(/#[0-9A-Fa-f]{6}\b/g), null, `hex colour in ${f}`);
    assert.ok(!code.includes("rgb("), `rgb( in ${f}`);
  }
});

test("source scan (L2): the POTS PDF keeps the light ramp; appearance.js never touches storage or the network; backups drop appearance", () => {
  const pdf = readFileSync(join(SRC, "lib/potsReport.js"), "utf8");
  assert.match(pdf, /import \{ RAMPS \} from "\.\/constants\.js"/);
  const pdfCode = stripComments(pdf);
  for (const w of ["RAMPS_DARK", "scheme", "appearance"]) assert.ok(!pdfCode.includes(w), `potsReport.js mentions ${w}`);
  // L9: the appointment PDF (lib/visitReport.js) keeps the light ramp too.
  const visit = readFileSync(join(SRC, "lib/visitReport.js"), "utf8");
  assert.match(visit, /import \{ RAMPS \} from "\.\/constants\.js"/);
  const visitCode = stripComments(visit);
  for (const w of ["RAMPS_DARK", "scheme", "appearance"]) assert.ok(!visitCode.includes(w), `visitReport.js mentions ${w}`);
  const ap = readFileSync(join(SRC, "lib/appearance.js"), "utf8");
  for (const w of ["localStorage", "sessionStorage", "document.cookie", "fetch("]) assert.ok(!ap.includes(w), `appearance.js mentions ${w}`);
  const app = readFileSync(join(SRC, "App.jsx"), "utf8");
  // L3 moved the key lists to lib/record.js: DEVICE_PREFS holds appearance, and NOT_IN_BACKUP (which backupCopy deletes) holds DEVICE_PREFS.
  const rec = readFileSync(join(SRC, "lib/record.js"), "utf8");
  assert.match(rec, /export const DEVICE_PREFS = Object\.freeze\(\[[^\]]*"appearance"[^\]]*\]\)/);
  assert.match(rec, /export const NOT_IN_BACKUP = Object\.freeze\(\[[^\]]*\.\.\.DEVICE_PREFS[^\]]*\]\)/);
  const exp = app.slice(app.indexOf("const exportBackup = async"), app.indexOf("const importBackup = async"));
  assert.ok(exp.includes("backupCopy(snapshot())"), "exportBackup drops DEVICE_PREFS (through backupCopy)");
  const imp = app.slice(app.indexOf("const importBackup = async"), app.indexOf("const checkRestoredOura"));
  assert.match(imp, /skip: \[\.\.\.DEVICE_ONLY, \.\.\.DEVICE_PREFS, "reminders"\]/);
  assert.match(imp, /const keep = \{[^}]*\bappearance\b[^}]*\}/);
});

test("Report meter legend (L2): the word for the moderate-or-strong segment is true in light, in dark and in the print fallback", () => {
  // styles.js: the strong segment is the family colour itself; the other symptom days are a tint of it into the card (the later rule wins).
  const css = readFileSync(join(SRC, "styles.js"), "utf8");
  assert.match(css, /\.fm-strong \{ background:var\(--fc\);/);
  const anyPct = [...css.matchAll(/\.fm-any \{ background:color-mix\(in srgb, var\(--fc\) (\d+)%, var\(--card\)\); \}/g)].map((m) => +m[1] / 100);
  assert.ok(anyPct.length > 0, ".fm-any tint rule");
  const pct = anyPct.at(-1);
  // Light (and print, which resolves to light): on every light card the strong segment is darker than the tint.
  assert.equal(strongMeterWord("light"), "Darker");
  for (const [name, p] of THEMES) for (const f of FAMILIES) assert.ok(lum(f.color) < lum(mix(f.color, p.card, pct)), `light ${name} ${f.id}: strong not darker`);
  // Dark: on every dark card the strong segment is the lighter one, so "Darker" would be backwards. The dark word names the
  // full colour, which also holds in the monochrome print fallback (white card, dark family colours: the tint is paler there).
  assert.equal(strongMeterWord("dark"), "Full colour");
  for (const card of DARK_CARDS) for (const f of FAMILIES) assert.ok(lum(f.dark) > lum(mix(f.dark, card, pct)), `dark ${card} ${f.id}: strong not brighter`);
  for (const f of FAMILIES) assert.ok(lum(f.dark) < lum(mix(f.dark, "#FFFFFF", pct)), `print fallback ${f.id}`);
  // ReportScreen draws the legend from the scheme on screen, and App.jsx passes it.
  const rep = readFileSync(join(SRC, "screens/ReportScreen.jsx"), "utf8");
  assert.ok(rep.includes("<span>{strongMeterWord(scheme)} = moderate or strong</span>"), "ReportScreen legend uses strongMeterWord(scheme)");
  assert.ok(!stripComments(rep).includes("Darker = moderate"), "no fixed Darker legend");
  assert.match(readFileSync(join(SRC, "App.jsx"), "utf8"), /<ReportScreen [^>]*\bscheme=\{scheme\}/);
});

/* ---------- design system v2 (calm R1, plan §2/§6) ---------- */
test("v2 palettes (R1): every light set is AA for primary/accent text and 3:1 for lines on paper AND card; one paper per scheme", () => {
  for (const [name, p] of THEMES.filter(([n]) => n !== "ORGS.bloom")) {
    for (const [k, min] of [["primary", 4.5], ["accent", 4.5], ["soft", 4.5], ["line", 3]]) for (const s of ["paper", "card"]) assert.ok(cr(p[k], p[s]) >= min, `${name} light ${k}/${s}: ${cr(p[k], p[s]).toFixed(2)}`);
    assert.ok(cr("#FFFFFF", p.primary) >= 4.5, `${name} light on-primary`);
    assert.ok(cr(mix(p.accent, p.ink, 0.82), mix(p.accent, p.card, 0.16)) >= 4.5, `${name} light accent-text on its 16% tint`);
    assert.ok(cr(p.primary, mix(p.primary, p.card, 0.16)) >= 4.5, `${name} light primary on its 16% tint`);
  }
  const papers = new Set(Object.values(PALETTES).flat().map((p) => p.paper)), darkPapers = new Set(Object.values(PALETTES).flat().map((p) => p.dark.paper));
  assert.deepEqual([...papers], ["#FAF7F4"]); assert.deepEqual([...darkPapers], ["#131520"]);
  assert.equal(ORGS.cyra.theme.paper, "#FAF7F4"); assert.equal(ORGS.cyra.theme.dark.paper, "#131520");
});

test("v2 stage accents (R1): cycle periwinkle, perimenopause lavender, pregnancy rose, menopause soft teal first", () => {
  assert.equal(stagePalettes("periods", "My Cycle")[0].id, "periwinkle");
  assert.equal(stagePalettes("periods", "Trying to Conceive")[0].id, "periwinkle");
  assert.equal(stagePalettes("peri", "Perimenopause")[0].id, "lavender");
  assert.equal(stagePalettes("peri", MENO_NAME)[0].id, "seafoam");
  assert.equal(stagePalettes("preg", "Pregnancy")[0].id, "rose");
  assert.deepEqual(stagePalettes("peri", MENO_NAME).map((p) => p.id).sort(), PALETTES.peri.map((p) => p.id).sort(), "same set, different order");
  assert.equal(stagePalettes("peri", "Perimenopause"), PALETTES.peri);
  assert.equal(stagePalettes("nope", "x"), PALETTES.peri);
});

test("v2 tints and edge (R1): soft text and the stage primary read on every domain tint, light and dark", () => {
  for (const scheme of ["light", "dark"]) {
    const T = SCHEME_TOKENS[scheme];
    for (const k of ["--tint-mind", "--tint-body", "--tint-patterns", "--tint-you"]) {
      assert.match(T[k], HEX, `${scheme} ${k}`);
      for (const [name, p] of THEMES.filter(([n]) => n !== "ORGS.bloom")) {
        const d = scheme === "dark" ? p.dark : p;
        assert.ok(cr(d.ink, T[k]) >= 7, `${scheme} ink on ${k} ${name}`);
        assert.ok(cr(d.soft, T[k]) >= 4.5, `${scheme} soft on ${k} ${name}: ${cr(d.soft, T[k]).toFixed(2)}`);
        assert.ok(cr(mix(d.primary, d.ink, 0.82), T[k]) >= 4.5, `${scheme} primary-text on ${k} ${name}`);
        assert.ok(cr(d.primary, T[k]) >= 3, `${scheme} primary icon on ${k} ${name}`);
      }
    }
    assert.match(T["--edge"], HEX);
    for (const k of ["--wash-a", "--wash-b", "--wash-c"]) { const a = +/,\s*([\d.]+)\)$/.exec(T[k])[1]; assert.ok(a <= 0.07, `${scheme} ${k} alpha ${a}`); }
  }
});

test("v2 soft ramp (R1): ordinal, single hue, separate from UI palettes, arrives as --soft-1..4", () => {
  for (const scheme of ["light", "dark"]) {
    const r = SOFT_RAMP[scheme]; assert.equal(r.length, 4);
    const Ls = r.map((c) => oklch(c)[0]);
    for (let i = 1; i < 4; i++) assert.ok(Math.abs(Ls[i] - Ls[i - 1]) >= 0.06, `${scheme} step ${i}`);
    const surf = scheme === "dark" ? ["#1C1F2D"] : ["#FFFFFF", "#FAF7F4"];
    for (const s of surf) assert.ok(cr(r[0], s) >= 2, `${scheme} light end on ${s}`);
    for (let i = 0; i < 4; i++) assert.equal(vizVars(scheme, "peri")[`--soft-${i + 1}`], r[i]);
  }
  const ui = new Set(THEMES.flatMap(([, p]) => [...PALETTE_KEYS.map((k) => p[k]), ...PALETTE_KEYS.map((k) => p.dark[k])]));
  for (const c of [...SOFT_RAMP.light, ...SOFT_RAMP.dark]) assert.ok(!ui.has(c), c);
});
