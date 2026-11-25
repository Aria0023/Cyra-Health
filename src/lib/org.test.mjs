/* Unit tests for organizations in the app (docs/plans/upgrade-enterprise.md Task 3, lib/org.js): the cleaner re-checks
   every colour (AA on Solia's page and card), stages and the lineup; the theme touches only the UI primary and accent;
   the stage cards an organization offers; links and codes; and the app and the backend agree. */
import test from "node:test";
import assert from "node:assert/strict";
import { cleanOrgConfig, orgTheme, orgView, stageCardsFor, orgFromSearch, cleanCode, themeOk, contrastOf, ORG_COPY, ORG_STAGE_IDS } from "./org.js";
import { ORGS, PALETTES } from "./constants.js";
import { STAGE_CARDS } from "./onboarding.js";
import * as server from "../../backend/src/modules/orgs/index.js";

const CFG = { version: 1, slug: "lakeside", name: "Lakeside Clinic", logo: "data:image/png;base64,iVBORw0KGgo=", theme: { primary: "#2f5d50", accent: "#8A4E18", dark: { primary: "#8AC2B0", accent: "#D8A96A" } }, stages: ["meno", "peri"], partnerIds: ["oura-ring"], poweredBy: "Solia Health" };

test("cleanOrgConfig keeps a good config and refuses anything that fails a check", () => {
  const c = cleanOrgConfig(CFG);
  assert.deepEqual(c, { slug: "lakeside", name: "Lakeside Clinic", logo: CFG.logo, theme: { primary: "#2F5D50", accent: "#8A4E18", dark: { primary: "#8AC2B0", accent: "#D8A96A" } }, stages: ["peri", "meno"], partnerIds: ["oura-ring"] });
  assert.deepEqual(cleanOrgConfig(c), c, "a stored copy cleans to itself (the record validator)");
  for (const bad of [null, [], { ...CFG, slug: "cyra" }, { ...CFG, slug: "A b" }, { ...CFG, name: "" }, { ...CFG, name: "<b>x</b>" }, { ...CFG, stages: [] }, { ...CFG, stages: ["menu"] },
    { ...CFG, theme: { ...CFG.theme, primary: "#FFD6E0" } }, { ...CFG, theme: { ...CFG.theme, dark: { primary: "#2F5D50", accent: "#D8A96A" } } }, { ...CFG, partnerIds: "all" }]) assert.equal(cleanOrgConfig(bad), null, JSON.stringify(bad).slice(0, 80));
  assert.equal(cleanOrgConfig({ ...CFG, logo: "https://evil.example/x.png" }).logo, null, "only an inline image, never a link");
  assert.equal(cleanOrgConfig({ ...CFG, partnerIds: null }).partnerIds, null, "null = the whole Shop");
});

test("the theme changes only the UI primary and accent; page, card, ink and the data-viz ramps stay Solia's", () => {
  const t = orgTheme(cleanOrgConfig(CFG));
  const base = ORGS.cyra.theme;
  for (const k of ["paper", "card", "ink", "soft", "line"]) { assert.equal(t[k], base[k]); assert.equal(t.dark[k], base.dark[k]); }
  assert.equal(t.primary, "#2F5D50"); assert.equal(t.dark.accent, "#D8A96A");
  assert.ok(themeOk(ORGS.cyra.theme), "Solia's own palette passes the same check");
  assert.ok(contrastOf(t.primary, t.paper) >= 4.5 && contrastOf(t.dark.primary, t.dark.card) >= 4.5);
  const v = orgView(cleanOrgConfig(CFG));
  assert.equal(v.tag, "Powered by Solia Health");
  assert.equal(orgView(null), ORGS.cyra);
  assert.ok(Object.keys(PALETTES).length, "stage palettes unchanged");
});

test("stage cards: only the organization's, in the usual order; never empty", () => {
  assert.deepEqual(stageCardsFor(null), STAGE_CARDS);
  assert.deepEqual(stageCardsFor(cleanOrgConfig(CFG)).map(([l]) => l), ["Perimenopause", "Menopause & beyond"]);
  assert.deepEqual(stageCardsFor({ stages: [] }), STAGE_CARDS);
});

test("links and codes", () => {
  assert.equal(orgFromSearch("?org=Lakeside"), "lakeside");
  assert.equal(orgFromSearch("?org=cyra"), null);
  assert.equal(orgFromSearch("?org=../x"), null);
  assert.equal(orgFromSearch(""), null);
  assert.equal(cleanCode(" lake-2026 "), "LAKE2026");
  assert.equal(cleanCode("ab"), null);
  assert.equal(ORG_COPY.privacy, "Your organization sees how many people joined, never what you log.");
});

test("the app and the backend agree on stages and the colour check", () => {
  assert.deepEqual([...server.STAGE_IDS], [...ORG_STAGE_IDS]);
  assert.deepEqual(server.SOLIA_THEME, { primary: ORGS.cyra.theme.primary, accent: ORGS.cyra.theme.accent, dark: { primary: ORGS.cyra.theme.dark.primary, accent: ORGS.cyra.theme.dark.accent } });
  assert.deepEqual(server.PAPER, { light: { paper: ORGS.cyra.theme.paper, card: ORGS.cyra.theme.card }, dark: { paper: ORGS.cyra.theme.dark.paper, card: ORGS.cyra.theme.dark.card } });
  for (const hex of ["#2F5D50", "#FFD6E0", "#8AC2B0", "#5B54A6"]) for (const bg of ["#FAF7F4", "#131520"]) assert.equal(server.contrast(hex, bg).toFixed(6), contrastOf(hex, bg).toFixed(6));
  // whatever the server sends, the app keeps
  const row = { slug: "lakeside", name: "Lakeside Clinic", theme: server.cleanOrg({ theme: CFG.theme }).patch.theme, stages: ["peri"], partnerIds: null };
  assert.ok(cleanOrgConfig(server.publicOrg(row, null)));
});
