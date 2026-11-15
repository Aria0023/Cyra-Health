import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Card } from "./ui/index.js";
import Details from "./Details.jsx";
import Icon from "./Icon.jsx";
import {
  SHOP_COPY as C, SHOP_PAGE_COPY as P, AFFILIATE_LINE, TONE_LABEL, AVAIL_LABEL, CATEGORY_ICON, BRANDS,
  linkFor, relFor, shopItems, allItems, itemSources, groupByBrand, brandsOf, monogram, brandHue, priceFor, imageFor, isReviewed,
} from "../lib/shop.js";
import { isNative } from "../lib/native.js";
import { openExternal } from "../lib/links.js";

/* Shop by need (Task C, 2026-11-14; its own page since 2026-11-15, docs/plans/plans-shop-page.md Task 3 and the owner's
   design update). A full-screen page under the current tab (#/shop, and the old #/care and #/shelf), opened from the
   header's bag button on the five main tabs, a single entry card on You, and the quiet contextual links (ShopLink, through
   ShopContext, with the right category preselected). Back returns to where she came from.
   The page: a hero band (a soft wash of the stage primary) with the h1 (focused on open), one line and a "By need / By
   brand" switch, then one horizontal chip
   scroller (needs, hers first, lib/shop.js shopCategories; or "All brands" and each brand with its monogram), then the
   products grouped by brand: a band in the brand's own hue (lib/constants.js SHOP_HUES, apart from the stage palettes
   and the data-viz ramps: monogram tile, the brand, its type, one line about it) over its cards: on phones a horizontal
   snap list when a brand has 2+ products (the next card peeks), on wide screens a 2–4 column grid. Each card: an image
   only where the owner placed a licensed one (src/config/shop-images.json), otherwise a calm placeholder; where it comes
   from and the owner's price when there is one; the name, what it covers, why, "Sold by", the evidence pill; "Visit
   <brand>" and "Learn more" (evidence, price note, sources). "Affiliate link" and the commission line only where
   src/config/affiliates.json has a link. Nothing here sends anything or adds anything about her to a link. */
export const ShopContext = createContext(null);

/** A quiet link to one category ("Don't have a device? See options"); renders nothing when the shop is off. */
export function ShopLink({ category, label }) {
  const open = useContext(ShopContext);
  if (!open) return null;
  return <button type="button" className="linkbtn shoplink" data-shop={category} onClick={() => open.openCategory(category)}><Icon name="bag" size={14} />{label}</button>;
}

/** The brand's monogram tile (decorative: the brand's name is always written beside it). */
export const Monogram = ({ brand, size = "sm" }) => (
  <span className={`shopmono ${size}`} data-hue={brandHue(brand)} aria-hidden="true">{monogram(brand)}</span>
);

function ProductCard({ item, affiliates, images, signed, onTry }) {
  const link = linkFor(item, affiliates);
  const price = priceFor(item, affiliates);
  const img = imageFor(item, images);
  const nameId = `shop-${item.id}`;
  const go = (e) => { if (isNative()) { e.preventDefault(); openExternal(link.href); } };
  return (
    <li className="shopcard" data-item={item.id}>
      <div className="shopimg" data-hue={brandHue(item.brand)}>
        {img ? <img src={`${import.meta.env.BASE_URL || "/"}${img}`} alt="" loading="lazy" /> : (
          <>
            <svg className="shopimg-blobs" viewBox="0 0 200 125" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
              <path className="b1" d="M150 -10c34 6 58 34 52 62s-40 40-70 30-44-40-34-64 22-34 52-28z" />
              <path className="b2" d="M20 90c22-10 52-2 60 18s-8 40-34 42-48-10-50-30 2-22 24-30z" />
              <circle className="b3" cx="40" cy="22" r="6" /><circle className="b3" cx="176" cy="104" r="4" />
            </svg>
            <span className="shopimg-ph" aria-hidden="true"><Icon name={CATEGORY_ICON[item.category] || "bag"} size={36} /></span>
          </>
        )}
        <span className="shopimg-brand" aria-hidden="true"><Monogram brand={item.brand} size="xs" />{item.brand}</span>
      </div>
      <div className="shopcard-body">
        <p className="shopmeta" data-hue={brandHue(item.brand)}><span className="shopavail"><span className="shopdot" aria-hidden="true" />{AVAIL_LABEL[item.avail] || ""}</span>{price && <span className="shopprice">{price}</span>}</p>
        <h3 className="sname" id={nameId}>{item.name}</h3>
        {item.covers && <p className="shopcovers">{item.covers}</p>}
        <p className="shopwhy">{item.why}</p>
        <p className="shopsold">{P.soldBy(item.brand)}</p>
        <p className="shoppills">
          <span className={`ev ev-${item.tone}`}><span className="sr-only">{TONE_LABEL[item.tone]}: </span>{item.ev}</span>
          {isReviewed(item, signed) && <span className="ppill fit shopreviewed">{P.reviewed}</span>}
          {link.affiliate && <span className="ppill affpill">{C.affiliate}</span>}
        </p>
        <div className="shopacts">
          <a className="cta shopgo" href={link.href} target="_blank" rel={relFor(link)} aria-describedby={link.affiliate ? `${nameId}-aff` : undefined} onClick={go}>{C.open(item.brand)}<Icon name="arrow-right" size={14} /><span className="sr-only"> (opens in your browser)</span></a>
          {onTry && item.kind && <button type="button" className="linkbtn shoptry" aria-describedby={nameId} onClick={() => onTry(item)}>{C.tryIt}</button>}
        </div>
        <Details label={P.learnMore} describedBy={nameId}>
          <p className="shoplm-ev"><b>{TONE_LABEL[item.tone]}</b> · {item.ev}</p>
          <p className="hint">{price ? P.priceNote(item.brand) : P.noPrice}</p>
          <p className="section-lab">Sources</p>
          <ul className="learnsrc">{itemSources(item).map((s) => <li key={s}>{s}</li>)}</ul>
        </Details>
        {link.affiliate && <p className="rfoot" id={`${nameId}-aff`}>{AFFILIATE_LINE}</p>}
      </div>
    </li>
  );
}

function BrandSection({ brand, items, ...card }) {
  const b = BRANDS[brand] || {};
  const hid = `shopb-${monogram(brand).toLowerCase()}-${items[0].id}`;
  return (
    <section className="shopbrand" aria-labelledby={hid}>
      <div className="shopband" data-hue={brandHue(brand)}>
        <Monogram brand={brand} size="lg" />
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

/** The Shop page. initial: a category id to preselect (a contextual link or #/shop/<category>). */
export function ShopPage({ categories, initial = null, affiliates = {}, images = {}, signed = [], allow = null, onTry = null, onBack }) {
  const firstCat = categories.some((c) => c.id === initial) ? initial : categories[0]?.id;
  const [mode, setMode] = useState("need");
  const [cat, setCat] = useState(firstCat);
  const [brand, setBrand] = useState(null);
  const headRef = useRef(null);
  useEffect(() => { window.scrollTo({ top: 0, behavior: "auto" }); headRef.current?.focus({ preventScroll: true }); }, []);
  useEffect(() => { if (initial && categories.some((c) => c.id === initial)) { setMode("need"); setCat(initial); } }, [initial]); // eslint-disable-line react-hooks/exhaustive-deps
  const items = mode === "need" ? shopItems(cat, { allow }) : allItems({ brand, allow });
  const brands = brandsOf(allItems({ allow }));
  const card = { affiliates, images, signed, onTry };
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
          {brands.map((b) => <button key={b} type="button" className={`mc shopchip brandchip ${brand === b ? "on" : ""}`} aria-pressed={brand === b} data-brand={b} onClick={() => setBrand(b)}><Monogram brand={b} />{b}</button>)}
        </div>
      )}
      {items.length ? groupByBrand(items).map((g) => <BrandSection key={g.brand} brand={g.brand} items={g.items} {...card} />) : <p className="hint">{P.noneHere}</p>}
      <footer className="shopfoot">
        <h2 className="shopfoot-h">{P.footHead}</h2>
        <p className="rfoot">{P.footMatched}</p>
        <p className="rfoot">{C.privacy}</p>
        <p className="rfoot">{C.notAdvice}</p>
      </footer>
    </main>
  );
}

/** You → one distinct entry card that opens the page. */
export function ShopEntryCard({ onOpen }) {
  return (
    <Card id="you-shop" tint="patterns" icon="bag" eyebrow={C.eyebrow} title={P.entryLine} level={2} className="youshop" tabIndex={-1}>
      <p className="hint">{C.lead}</p>
      <button type="button" className="ghostbtn youshopgo" onClick={onOpen}>{P.entryTitle}<Icon name="arrow-right" size={16} /></button>
    </Card>
  );
}
