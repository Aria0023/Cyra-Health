import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Card } from "./ui/index.js";
import Details from "./Details.jsx";
import Icon from "./Icon.jsx";
import { SHOP_COPY as C, SHOP_PAGE_COPY as P, AFFILIATE_LINE, TONE_LABEL, AVAIL_LABEL, CATEGORY_ICON, relFor, groupByBrand, brandsOf, monogram, brandHue } from "../lib/shop.js";
import { itemsIn, itemsOf } from "../lib/shopCatalog.js";
import { isNative } from "../lib/native.js";
import { openExternal } from "../lib/links.js";

/* Shop by need (Task C, 2026-11-14; its own page since 2026-11-15, docs/plans/plans-shop-page.md Task 3 and the owner's
   design update). A full-screen page under the current tab (#/shop, and the old #/care and #/shelf), opened from the
   header's labelled "Shop" pill on the five main tabs, a card on Home she can hide, a row at the bottom of the "+" sheet,
   the entry card at the top of You (all since 2026-11-16, docs/plans/shop-findable-visuals.md), and the quiet contextual
   links (ShopLink, through ShopContext, with the right category preselected). Back returns to where she came from.
   The page: a hero band (a soft wash of the stage primary) with the h1 (focused on open), one line and a "By need / By
   brand" switch, then one horizontal chip
   scroller (needs, hers first, lib/shop.js shopCategories; or "All brands" and each brand with its monogram), then the
   products grouped by brand: a band in the brand's own hue (lib/constants.js SHOP_HUES, apart from the stage palettes
   and the data-viz ramps: monogram tile, the brand, its type, one line about it) over its cards: on phones a horizontal
   snap list when a brand has 2+ products (the next card peeks), on wide screens a 2–4 column grid. Each card: an image
   only where the owner placed a licensed one (src/config/shop-images.json), otherwise a calm placeholder; where it comes
   from and the owner's price when there is one; the name, what it covers, why, "Sold by", the evidence pill; "Visit
   <brand>" and "Learn more" (evidence, price note, sources). "Affiliate link" and the commission line only where
   src/config/affiliates.json has a link. Nothing here sends anything or adds anything about her to a link.
   2026-11-15 (partner portal, Task 3): the page draws `shop` (lib/shopCatalog.js), the published catalog downloaded from
   the server when the build has one, else the bundled catalog; both have the same shape, so the page is the same. */
export const ShopContext = createContext(null);

/** A quiet link to one category ("Don't have a device? See options"); renders nothing when the shop is off. */
export function ShopLink({ category, label }) {
  const open = useContext(ShopContext);
  if (!open) return null;
  return <button type="button" className="linkbtn shoplink" data-shop={category} onClick={() => open.openCategory(category)}><Icon name="bag" size={14} />{label}</button>;
}

/** The brand's monogram tile (decorative: the brand's name is always written beside it). info: the catalog's brand entry. */
export const Monogram = ({ brand, info = null, size = "sm" }) => (
  <span className={`shopmono ${size}`} data-hue={info?.hue || brandHue(brand)} aria-hidden="true">{info?.mono || monogram(brand)}</span>
);

function ProductCard({ item, brands, onTry }) {
  const link = { href: item.href, affiliate: item.affiliate };
  const price = item.price;
  const img = item.image ? (item.image.url || `${import.meta.env.BASE_URL || "/"}${item.image.bundled}`) : null;
  const info = brands[item.brand] || null;
  const hue = info?.hue || brandHue(item.brand);
  const nameId = `shop-${item.id}`;
  const go = (e) => { if (isNative()) { e.preventDefault(); openExternal(link.href); } };
  return (
    <li className="shopcard" data-item={item.id}>
      <div className="shopimg" data-hue={hue}>
        {img ? <img src={img} alt="" loading="lazy" referrerPolicy="no-referrer" /> : (
          <>
            <svg className="shopimg-blobs" viewBox="0 0 200 125" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
              <path className="b1" d="M150 -10c34 6 58 34 52 62s-40 40-70 30-44-40-34-64 22-34 52-28z" />
              <path className="b2" d="M20 90c22-10 52-2 60 18s-8 40-34 42-48-10-50-30 2-22 24-30z" />
              <circle className="b3" cx="40" cy="22" r="6" /><circle className="b3" cx="176" cy="104" r="4" />
            </svg>
            <span className="shopimg-ph" aria-hidden="true"><Icon name={CATEGORY_ICON[item.category] || "bag"} size={36} /></span>
          </>
        )}
        <span className="shopimg-brand" aria-hidden="true"><Monogram brand={item.brand} info={info} size="xs" />{item.brand}</span>
      </div>
      <div className="shopcard-body">
        <p className="shopmeta" data-hue={hue}><span className="shopavail"><span className="shopdot" aria-hidden="true" />{AVAIL_LABEL[item.avail] || ""}</span>{price && <span className="shopprice">{price}</span>}</p>
        <h3 className="sname" id={nameId}>{item.name}</h3>
        {item.covers && <p className="shopcovers">{item.covers}</p>}
        <p className="shopwhy">{item.why}</p>
        <p className="shopsold">{P.soldBy(item.brand)}</p>
        <p className="shoppills">
          {item.tone && <span className={`ev ev-${item.tone}`}><span className="sr-only">{TONE_LABEL[item.tone]}: </span>{item.ev}</span>}
          {item.reviewed && <span className="ppill fit shopreviewed">{P.reviewed}</span>}
          {link.affiliate && <span className="ppill affpill">{C.affiliate}</span>}
        </p>
        <div className="shopacts">
          <a className="cta shopgo" href={link.href} target="_blank" rel={relFor(link)} aria-describedby={link.affiliate ? `${nameId}-aff` : undefined} onClick={go}>{C.open(item.brand)}<Icon name="arrow-right" size={14} /><span className="sr-only"> (opens in your browser)</span></a>
          {onTry && item.kind && <button type="button" className="linkbtn shoptry" aria-describedby={nameId} onClick={() => onTry(item)}>{C.tryIt}</button>}
        </div>
        <Details label={P.learnMore} describedBy={nameId}>
          {item.tone && <p className="shoplm-ev"><b>{TONE_LABEL[item.tone]}</b> · {item.ev}</p>}
          {item.description && <p className="shopdesc">{P.fromBrand(item.brand)} {item.description}</p>}
          <p className="hint">{price ? P.priceNote(item.brand) : P.noPrice}</p>
          {item.sources.length > 0 && <><p className="section-lab">Sources</p>
          <ul className="learnsrc">{item.sources.map((s) => <li key={s}>{s}</li>)}</ul></>}
        </Details>
        {link.affiliate && <p className="rfoot" id={`${nameId}-aff`}>{AFFILIATE_LINE}</p>}
      </div>
    </li>
  );
}

function BrandSection({ brand, items, ...card }) {
  const b = card.brands[brand] || {};
  const hid = `shopb-${monogram(brand).toLowerCase()}-${items[0].id}`;
  return (
    <section className="shopbrand" aria-labelledby={hid}>
      <div className="shopband" data-hue={b.hue || brandHue(brand)}>
        <Monogram brand={brand} info={card.brands[brand]} size="lg" />
        <div className="shopband-text">
          <h2 className="shopband-name" id={hid}>{brand}</h2>
          {b.tag && <p className="shopband-tag">{b.tag}</p>}
          {b.about && <p className="shopband-about">{b.about}</p>}
        </div>
      </div>
      <ul className={`shopgrid ${items.length > 1 ? "multi" : ""}`} aria-labelledby={hid}>{items.map((i) => <ProductCard key={i.id} item={i} {...card} />)}</ul>
    </section>
  );
}

/** The Shop page. shop: lib/shopCatalog.js (live or bundled); initial: a category id to preselect (a contextual link or
    #/shop/<category>); live: this build downloads the catalog from its server (the footer says what that request carries). */
export function ShopPage({ shop, categories, initial = null, allow = null, live = false, onTry = null, onBack }) {
  const firstCat = categories.some((c) => c.id === initial) ? initial : categories[0]?.id;
  const [mode, setMode] = useState("need");
  const [cat, setCat] = useState(firstCat);
  const [brand, setBrand] = useState(null);
  const headRef = useRef(null);
  useEffect(() => { window.scrollTo({ top: 0, behavior: "auto" }); headRef.current?.focus({ preventScroll: true }); }, []);
  useEffect(() => { if (initial && categories.some((c) => c.id === initial)) { setMode("need"); setCat(initial); } }, [initial]); // eslint-disable-line react-hooks/exhaustive-deps
  const items = mode === "need" ? itemsIn(shop, cat, { allow }) : itemsOf(shop, { brand, allow });
  const brands = brandsOf(itemsOf(shop, { allow }));
  const card = { brands: shop.brands, onTry };
  return (
    <main className="shoppage" aria-labelledby="shop-h">
      <div className="shophero">
        <button type="button" className="linkbtn shopback" onClick={onBack}><Icon name="chevron" className="shopback-ico" size={16} />{P.back}</button>
        <h1 className="disp" id="shop-h" tabIndex={-1} ref={headRef}><span className="shophero-ico" aria-hidden="true"><Icon name="bag" size={20} /></span>{P.title}</h1>
        <p className="shoplead">{P.lead}</p>
        <div className="seg shopmode" role="group" aria-label={P.viewLab}>
          <button type="button" className={`mc ${mode === "need" ? "on" : ""}`} aria-pressed={mode === "need"} onClick={() => setMode("need")}>{P.byNeed}</button>
          <button type="button" className={`mc ${mode === "brand" ? "on" : ""}`} aria-pressed={mode === "brand"} onClick={() => setMode("brand")}>{P.byBrand}</button>
        </div>
      </div>
      {mode === "need" ? (
        <div className="shopchips" role="group" aria-label={P.needLab}>
          {categories.map((c) => <button key={c.id} type="button" className={`mc shopchip ${cat === c.id ? "on" : ""}`} aria-pressed={cat === c.id} data-cat={c.id} onClick={() => setCat(c.id)}>{c.label}</button>)}
        </div>
      ) : (
        <div className="shopchips" role="group" aria-label={P.brandLab}>
          <button type="button" className={`mc shopchip ${brand == null ? "on" : ""}`} aria-pressed={brand == null} onClick={() => setBrand(null)}>{P.allBrands}</button>
          {brands.map((b) => <button key={b} type="button" className={`mc shopchip brandchip ${brand === b ? "on" : ""}`} aria-pressed={brand === b} data-brand={b} onClick={() => setBrand(b)}><Monogram brand={b} info={shop.brands[b]} />{b}</button>)}
        </div>
      )}
      {items.length ? groupByBrand(items).map((g) => <BrandSection key={g.brand} brand={g.brand} items={g.items} {...card} />) : <p className="hint">{P.noneHere}</p>}
      <footer className="shopfoot">
        <h2 className="shopfoot-h">{P.footHead}</h2>
        <p className="rfoot">{P.footMatched}</p>
        {live && <p className="rfoot">{P.footList}</p>}
        <p className="rfoot">{C.privacy}</p>
        <p className="rfoot">{C.notAdvice}</p>
      </footer>
    </main>
  );
}

/** A small product thumbnail (decorative: Home's card names the shop in words). */
export function ShopThumb({ item, brands }) {
  const hue = brands[item.brand]?.hue || brandHue(item.brand);
  return <span className="shopthumb" data-hue={hue} data-item={item.id} aria-hidden="true"><Icon name={CATEGORY_ICON[item.category] || "bag"} size={26} /></span>;
}

/** You → one distinct entry card that opens the page (the top group of You, right under her stage, since 2026-11-16).
    onShowHome: only while she has hidden Home's shop card on this device; brings it back. */
export function ShopEntryCard({ onOpen, onShowHome = null }) {
  return (
    <Card id="you-shop" tint="patterns" icon="bag" eyebrow={C.eyebrow} title={P.entryLine} level={2} className="youshop" tabIndex={-1}>
      <p className="hint">{C.lead}</p>
      <button type="button" className="ghostbtn youshopgo" onClick={onOpen}>{P.entryTitle}<Icon name="arrow-right" size={16} /></button>
      {onShowHome && <p className="youshop-home"><button type="button" className="linkbtn" onClick={onShowHome}>{P.homeShow}</button></p>}
    </Card>
  );
}

/** Home → the "Shop by need" card under Quick log (2026-11-16, owner decision: the shop may appear on Home): the title,
    one line with her stage in words, three thumbnails from her first category, "Browse the shop", and Hide (remembered
    on this device; You brings the card back). It sends nothing and says nothing about her log. */
export function ShopHomeCard({ shop, category, allow = null, words, onOpen, onHide }) {
  const thumbs = (category ? itemsIn(shop, category.id, { allow }) : []).slice(0, 3);
  return (
    <Card id="home-shop" tint="patterns" icon="bag" title={P.title} level={2} className="shophome">
      <p className="shophome-line">{P.homeLine(words)}</p>
      {thumbs.length > 0 && <div className="shophome-thumbs" aria-hidden="true">{thumbs.map((i) => <ShopThumb key={i.id} item={i} brands={shop.brands} />)}</div>}
      <div className="shophome-acts">
        <button type="button" className="cta shophome-go" onClick={onOpen}>{P.homeBrowse}<Icon name="arrow-right" size={16} /></button>
        <button type="button" className="linkbtn shophome-hide" onClick={onHide}>{P.homeHide}<span className="sr-only"> the shop card</span></button>
      </div>
    </Card>
  );
}

/** The one-time hint under the header's Shop pill: a small note with an arrow, in the page flow (it covers nothing and
    never traps focus); "Got it" closes it and hands focus to the pill. No animation, so reduced motion needs nothing. */
export function ShopCoach({ onClose }) {
  return (
    <aside className="shopcoach" aria-label={P.coachLab}>
      <p id="shop-coach-t"><Icon name="bag" size={14} />{P.coach}</p>
      <button type="button" className="linkbtn" onClick={onClose}>{P.coachOk}</button>
    </aside>
  );
}
