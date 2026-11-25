/* Unit tests for lib/youMenu.js: the You menu's pages, their order, and where every card id lives. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { YOU_PAGES, YOU_VIEWS, isYouPage, youPageOf, youRowId, SECTION_PAGE, pageOfSection } from "./youMenu.js";
import { parseRoute, routeOf, tabOf, segmentOf, viewForTab, TABS } from "./routes.js";

test("the menu: seven rows, Privacy & your data second, Solia Health's AI its own row", () => {
  assert.deepEqual(YOU_PAGES.map((p) => p.title), ["Your profile", "Privacy & your data", "Solia Health's AI", "Plan & account", "Devices & reminders", "App settings", "Help & about"]);
  assert.equal(new Set(YOU_PAGES.map((p) => p.slug)).size, YOU_PAGES.length);
  assert.ok(YOU_PAGES.every((p) => p.line && p.icon && p.view.startsWith("you")));
  assert.ok(isYouPage("youprivacy") && !isYouPage("you") && !isYouPage("home"));
  assert.equal(youRowId("youplan"), "you-row-plan");
  assert.equal(youRowId("you"), null);
  assert.equal(youPageOf("youai").title, "Solia Health's AI");
});

test("the five tabs did not change", () => {
  assert.deepEqual(TABS.map((t) => t.label), ["Home", "Body", "Mind", "Patterns", "You"]);
});

test("every page is a sub-page of You with its own hash, in every experience", () => {
  for (const opts of [{}, { preg: true }, { meno: true }]) {
    for (const p of YOU_PAGES) {
      assert.equal(tabOf(p.view, opts), "you");
      assert.equal(segmentOf(p.view), "you");
      assert.equal(routeOf(p.view, opts), `#/you/${p.slug}`);
      assert.deepEqual(parseRoute(`#/you/${p.slug}`, opts), { tab: "you", view: p.view });
    }
    assert.deepEqual(parseRoute("#/you", opts), { tab: "you", view: "you" });
    assert.deepEqual(parseRoute("#/you/nothing", opts), { tab: "you", view: "you" });
    assert.deepEqual(parseRoute("#/settings", opts), { tab: "you", view: "you" }); // the old link still opens You
    assert.equal(viewForTab("you", { you: "youplan" }, opts), "you", "the You tab always opens on the menu");
  }
  assert.notEqual(parseRoute("#/home/privacy")?.view, "youprivacy"); // a You slug under another tab is not a You page
});

test("every card id on You has exactly one page, and every page has a card", () => {
  for (const [id, view] of Object.entries(SECTION_PAGE)) assert.ok(YOU_VIEWS.includes(view), `${id} → ${view}`);
  assert.deepEqual([...new Set(Object.values(SECTION_PAGE))].sort(), [...YOU_VIEWS].sort());
  assert.equal(pageOfSection("you-plan"), "youplan");
  assert.equal(pageOfSection("you-ai"), "youai");
  assert.equal(pageOfSection("you-about-legal"), "youhelp");
  assert.equal(pageOfSection("nope"), null);
  // every id="you-…" card in the app's source is mapped (ids built at run time or inside a card are listed here)
  const INNER = ["you-ai-disclosure", "you-store-line", "you-promo", "you-plans-lab", "you-getinapp", "you-row", "you-upgrade", "you-back", "you-voice-"];
  const files = ["screens/YouScreen.jsx", "components/AccountParts.jsx", "components/DataSourcesCard.jsx", "components/Feedback.jsx", "components/Learn.jsx", "components/PartnerShare.jsx", "components/Shop.jsx"];
  for (const f of files) {
    const src = readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
    for (const m of src.matchAll(/\bid="(you-[a-z-]+)"/g)) if (!INNER.some((x) => m[1].startsWith(x))) assert.ok(SECTION_PAGE[m[1]], `${f}: ${m[1]} has no page in SECTION_PAGE`);
  }
});

test("Upgrade to Pro (upgrade-enterprise Task 1): shown unless she owns Pro; the short Pro button reads See Pro", async () => {
  const { upgradeShown, YOU_COPY } = await import("./youMenu.js");
  assert.equal(upgradeShown({ owned: false }), true);
  assert.equal(upgradeShown(), true, "a guest or a new person sees it too");
  assert.equal(upgradeShown({ owned: true }), false);
  assert.equal(YOU_COPY.upgrade, "Upgrade to Pro");
  assert.equal(YOU_COPY.seePro, "See Pro");
  const you = readFileSync(new URL("../screens/YouScreen.jsx", import.meta.url), "utf8");
  // it sits above the rows and opens the same Pro sheet (onPro), never a checkout of its own
  assert.ok(you.indexOf('id="you-upgrade"') > 0 && you.indexOf('id="you-upgrade"') < you.indexOf('className="youmenu-nav"'));
  assert.match(you, /id="you-upgrade"[^>]*aria-haspopup="dialog" onClick=\{onPro\}/);
});
