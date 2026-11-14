import { createContext, useContext, useState } from "react";
import { Card, Sheet } from "./ui/index.js";
import Details from "./Details.jsx";
import Icon from "./Icon.jsx";
import { SHOP_COPY as C, AFFILIATE_LINE, TONE_LABEL, linkFor, relFor, shopItems, itemSources } from "../lib/shop.js";
import { isNative } from "../lib/native.js";
import { openExternal } from "../lib/links.js";

/* Shop by need (Task C). One place on You (the card keeps the old care section's id "care", so #/care and #/shelf still
   land on it), a sheet opened by the quiet contextual links (ShopLink, through ShopContext, as Learn does), and the same
   body in both: category buttons (hers first, lib/shop.js shopCategories) and the items of the one picked. Every item
   says why in one line with its evidence label and named sources; a link opens in the system browser (phone: Capacitor
   Browser; web: a new tab with rel noopener noreferrer, plus sponsored on an affiliate link). Nothing here sends anything
   or adds anything about her to a link. App.jsx provides the context only while FEATURES.shop is on. */
export const ShopContext = createContext(null);

/** A quiet link to one category ("Don't have a device? See options"); renders nothing when the shop is off. */
export function ShopLink({ category, label }) {
  const open = useContext(ShopContext);
  if (!open) return null;
  return <button type="button" className="linkbtn shoplink" aria-haspopup="dialog" data-shop={category} onClick={() => open.openCategory(category)}><Icon name="bag" size={14} />{label}</button>;
}

function ItemRow({ item, affiliates, onTry }) {
  const link = linkFor(item, affiliates);
  const nameId = `shop-${item.id}`;
  const go = (e) => { if (isNative()) { e.preventDefault(); openExternal(link.href); } };
  return (
    <li className="shopitem" data-item={item.id}>
      <div className="shophead"><span className="sbrand">{item.brand}</span>{link.affiliate && <span className="ppill affpill">{C.affiliate}</span>}</div>
      <b className="sname" id={nameId}>{item.name}</b>
      <p className="shopwhy">{item.why}</p>
      <span className={`ev ev-${item.tone}`}><span className="sr-only">{TONE_LABEL[item.tone]}: </span>{item.ev}</span>
      <Details label="Sources" describedBy={nameId}><ul className="learnsrc">{itemSources(item).map((s) => <li key={s}>{s}</li>)}</ul></Details>
      <div className="shopacts">
        <a className="ghostbtn shopgo" href={link.href} target="_blank" rel={relFor(link)} aria-describedby={link.affiliate ? `${nameId}-aff` : undefined} onClick={go}>{C.open(item.brand)}<Icon name="arrow-right" size={14} /><span className="sr-only"> (opens in your browser)</span></a>
        {onTry && item.kind && <button type="button" className="linkbtn shoptry" aria-describedby={nameId} onClick={() => onTry(item)}>{C.tryIt}</button>}
      </div>
      {link.affiliate && <p className="rfoot" id={`${nameId}-aff`}>{AFFILIATE_LINE}</p>}
    </li>
  );
}

export function ShopBody({ categories, initial = null, affiliates, allow = null, onTry = null, idBase = "shop" }) {
  const [cat, setCat] = useState(initial || categories[0]?.id);
  const items = shopItems(cat, { allow });
  return (
    <>
      <p className="section-lab" id={`${idBase}-cats`}>{C.forYou}</p>
      <div className="mcrow shopcats" role="group" aria-labelledby={`${idBase}-cats`}>
        {categories.map((c) => <button key={c.id} type="button" className={`mc ${cat === c.id ? "on" : ""}`} aria-pressed={cat === c.id} data-cat={c.id} onClick={() => setCat(c.id)}>{c.label}</button>)}
      </div>
      {items.length ? <ul className="shoplist" aria-label={categories.find((c) => c.id === cat)?.label}>{items.map((i) => <ItemRow key={i.id} item={i} affiliates={affiliates} onTry={onTry} />)}</ul>
        : <p className="hint">Nothing in this category for this plan.</p>}
      <p className="rfoot">{C.privacy}</p>
      <p className="rfoot">{C.notAdvice}</p>
    </>
  );
}

/** You → Shop by need: one summary line and the categories behind one disclosure (calm R10 style). */
export function ShopCard(props) {
  return (
    <Card id="care" tint="you" icon="bag" eyebrow={C.eyebrow} title={C.title} level={2} className="youshop" tabIndex={-1}>
      <p className="hint">{C.lead}</p>
      <Details label="See products by need"><ShopBody {...props} idBase="shop-you" /></Details>
    </Card>
  );
}

export function ShopSheet({ onClose, ...props }) {
  return (
    <Sheet id="shop-sheet" title={C.sheetTitle} closeLabel={`Close ${C.sheetTitle}`} onClose={onClose} className="shopsheet">
      <p className="hint">{C.lead}</p>
      <ShopBody {...props} idBase="shop-sheet" />
    </Sheet>
  );
}
