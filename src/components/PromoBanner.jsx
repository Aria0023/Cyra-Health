import { PROMO_COPY } from "../lib/promos.js";

/* One promotion's banner (2026-11-15, docs/plans/portal-subscriptions.md Task 3; lib/promos.js decides whether there is
   one and what it says). Only on You → Plan and the Pro sheet, one at a time, and she can hide it ("Not now", remembered
   on this device only). On a phone it lists ONLY the store's own price strings for the promotion's offering; the web
   says the offer is in the iPhone and Android apps, with no price. banner: { id, title, body, prices[], foot } */
export default function PromoBanner({ banner, onHide = null, idPrefix = "promo" }) {
  if (!banner) return null;
  const hid = `${idPrefix}-${banner.id}-t`;
  return (
    <div className="promobanner" role="group" aria-labelledby={hid} data-promo={banner.id}>
      <p className="promobanner-lab">{PROMO_COPY.label}</p>
      <p className="promobanner-title" id={hid}>{banner.title}</p>
      <p className="promobanner-body">{banner.body}</p>
      {banner.prices.length > 0 && <ul className="promobanner-prices">{banner.prices.map((p) => <li key={p}>{p}</li>)}</ul>}
      <p className="rfoot">{banner.foot}</p>
      {onHide && <button type="button" className="linkbtn promobanner-x" aria-label={PROMO_COPY.dismissLabel(banner.title)} onClick={() => onHide(banner.id)}>{PROMO_COPY.dismiss}</button>}
    </div>
  );
}
