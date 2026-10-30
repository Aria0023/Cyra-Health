import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { addCatalogue, removeCatalogue, availableLocales, pickerShown, detectLocale, resolveLocale, cleanLocale, setLocale, getLocale, localeTag, dirOf, plural, interpolate, hasKey, t, fmtDate, fmtNumber, applyDocumentLocale, DEFAULT_LOCALE } from "./i18n.js";
import { EN } from "../locales/en.js";

const here = path.dirname(fileURLToPath(import.meta.url));
addCatalogue("en", EN, { name: "English", tag: "en-US" });

test("t: English text, a missing key falls back to the key itself", () => {
  setLocale("en");
  assert.equal(t("tab.home"), "Home");
  assert.equal(t("no.such.key"), "no.such.key");
  assert.equal(t("no.such.key", { a: 1 }), "no.such.key");
});

test("t: a key missing from another catalogue falls back to English", () => {
  addCatalogue("xx", { "tab.home": "Accueil", "x.hello": "Bonjour {name}" }, { name: "Test", tag: "fr-FR" });
  try {
    setLocale("xx");
    assert.equal(t("tab.home"), "Accueil");
    assert.equal(t("tab.body"), "Body");
    assert.equal(t("x.hello", { name: "Maya" }), "Bonjour Maya");
    assert.equal(localeTag(), "fr-FR");
  } finally { removeCatalogue("xx"); }
  assert.equal(getLocale(), "en");
});

test("interpolation fills named placeholders and leaves unknown ones", () => {
  assert.equal(interpolate("Day {n} · {phase} phase", { n: 24, phase: "luteal" }), "Day 24 · luteal phase");
  assert.equal(interpolate("Hi {name}", {}), "Hi {name}");
  assert.equal(interpolate("Hi {name}", { name: 0 }), "Hi 0");
  assert.equal(t("practiceSheet.stepOf", { n: 2, total: 6 }), "Step 2 of 6");
});

test("plural picks the form for the count (Intl.PluralRules)", () => {
  setLocale("en");
  assert.equal(t("unit.daysLogged", { count: 1 }), "1 day logged");
  assert.equal(t("unit.daysLogged", { count: 3 }), "3 days logged");
  assert.equal(t("unit.daysLogged", { count: 0 }), "0 days logged");
  assert.equal(plural(1, ["one day", "days"]), "one day");
  assert.equal(plural(2, { one: "a", other: "b" }), "b");
  assert.equal(plural(NaN, { one: "a", other: "b" }), "b");
  assert.equal(plural(1, { other: "only" }), "only");
});

test("locale detection: exact, then base language, then English", () => {
  addCatalogue("es", { "tab.home": "Inicio" }, { name: "Español", tag: "es-ES" });
  try {
    assert.equal(detectLocale(["es-MX", "en-US"]), "es");
    assert.equal(detectLocale(["de-DE"]), DEFAULT_LOCALE);
    assert.equal(detectLocale([]), "en");
    assert.equal(resolveLocale("es", ["en-US"]), "es");
    assert.equal(resolveLocale("zz", ["es-AR"]), "es");
    assert.equal(pickerShown(), true);
    assert.deepEqual(availableLocales().map((l) => l.code), ["en", "es"]);
  } finally { removeCatalogue("es"); }
  assert.equal(pickerShown(), false, "one catalogue: the Language picker stays hidden");
  assert.equal(cleanLocale("en"), "en"); assert.equal(cleanLocale("pt-BR"), "pt-BR"); assert.equal(cleanLocale("<b>"), null); assert.equal(cleanLocale(3), null);
});

test("dates and numbers go through Intl with the locale's tag (English formats as en-US)", () => {
  setLocale("en");
  assert.equal(fmtDate("2026-10-29"), "Oct 29");
  assert.equal(fmtDate("2026-10-29", { weekday: "long", month: "long", day: "numeric" }), "Thursday, October 29");
  assert.equal(fmtDate("not a date"), "");
  assert.equal(fmtNumber(12345), "12,345");
  assert.equal(fmtNumber(NaN), "");
});

test("document lang and dir follow the locale; right-to-left languages get dir=rtl", () => {
  const doc = { documentElement: { lang: "", dir: "" } };
  applyDocumentLocale(doc, "en");
  assert.deepEqual(doc.documentElement, { lang: "en", dir: "ltr" });
  assert.equal(dirOf("ar"), "rtl"); assert.equal(dirOf("he-IL"), "rtl"); assert.equal(dirOf("fr"), "ltr");
  applyDocumentLocale(null);
});

test("every literal t(\"…\") key used in src exists in the English catalogue", () => {
  const src = path.resolve(here, "..");
  const files = [];
  const walk = (d) => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) walk(p); else if (/\.(jsx|js)$/.test(f.name) && !/\.test\./.test(f.name)) files.push(p); } };
  walk(src);
  const missing = [];
  let n = 0;
  for (const f of files) {
    const s = fs.readFileSync(f, "utf8");
    if (!/from "[./]*\/?(lib\/)?i18n\.js"|from "\.\/i18n\.js"/.test(s) && !/locales\/index\.js/.test(s)) continue;
    for (const m of s.matchAll(/\bt\("([\w.]+)"/g)) { n++; if (!hasKey(m[1])) missing.push(`${path.relative(src, f)}: ${m[1]}`); }
  }
  assert.ok(n > 500, `expected the screens to use t() (found ${n})`);
  assert.deepEqual(missing, []);
});

test("the English catalogue keeps the calm tone rules (no streaks, scores out of 100 or points)", () => {
  const bad = Object.entries(EN).filter(([, v]) => typeof v === "string" && /\bstreaks?\b|out of 100|\bpoints?\b|\bgrade[sd]?\b/i.test(v));
  assert.deepEqual(bad, []);
});
