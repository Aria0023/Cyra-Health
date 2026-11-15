import { useEffect, useState } from "react";
import Icon from "./Icon.jsx";
import { PLANS_COPY as C, planTiles } from "../lib/plans.js";
import { loadOffer } from "../lib/purchase.js";
import { APP_STORE_URL, PLAY_STORE_URL, openExternal } from "../lib/links.js";

/* The two Pro plans side by side (2026-11-15, Task 2; lib/plans.js decides the words and prices): Yearly first, marked
   "Best value", with its free-trial badge; Monthly beside it. Under 360px they stack (styles.js .plantiles). Static on
   You and on the web; on a phone's Pro sheet (onPick) each tile is a pressed/unpressed button that picks the plan for
   the store's own purchase flow. */
export function PlanTiles({ tiles, pick = null, onPick = null, labelledBy = null, className = "" }) {
  if (!tiles || !tiles.length) return null;
  const body = (x) => (
    <>
      <span className="plantile-top">
        <b className="plantile-title">{x.title}</b>
        {x.best && <span className="plantile-best">{C.best}</span>}
      </span>
      <span className="plantile-price">{x.price}</span>
      {x.note && <span className="plantile-note">{x.note}</span>}
      {x.trial && <span className="plantile-trial"><Icon name="sparkle" size={12} />{x.trial}</span>}
    </>
  );
  return onPick ? (
    <div className={`plantiles ${className}`} role="group" aria-labelledby={labelledBy || undefined} aria-label={labelledBy ? undefined : C.label}>
      {tiles.map((x) => (
        <button key={x.id} type="button" className={`plantile ${x.best ? "best" : ""} ${pick === x.id ? "on" : ""}`} data-plan={x.id} aria-pressed={pick === x.id} onClick={() => onPick(x.id)}>{body(x)}</button>
      ))}
    </div>
  ) : (
    <ul className={`plantiles ${className}`} aria-labelledby={labelledBy || undefined} aria-label={labelledBy ? undefined : C.label}>
      {tiles.map((x) => <li key={x.id} className={`plantile ${x.best ? "best" : ""}`} data-plan={x.id}>{body(x)}</li>)}
    </ul>
  );
}

/** The web's way to Pro: "Get Solia Health Pro in the app" and a button per store page the build has
    (VITE_APP_STORE_URL / VITE_PLAY_STORE_URL); an unset one is named in plain "Coming soon …" text, never a dead button. */
export function GetInApp({ id = "getinapp" }) {
  const soon = [!APP_STORE_URL && "the App Store", !PLAY_STORE_URL && "Google Play"].filter(Boolean);
  return (
    <div className="getinapp" role="group" aria-labelledby={`${id}-h`}>
      <p className="getinapp-h" id={`${id}-h`}><b>{C.getInApp}</b></p>
      {(APP_STORE_URL || PLAY_STORE_URL) && (
        <div className="getinapp-btns">
          {APP_STORE_URL && <button type="button" className="ghostbtn storebtn" aria-label={C.appStoreLabel} onClick={() => openExternal(APP_STORE_URL)}><Icon name="apple" size={18} />{C.appStore}</button>}
          {PLAY_STORE_URL && <button type="button" className="ghostbtn storebtn" aria-label={C.playStoreLabel} onClick={() => openExternal(PLAY_STORE_URL)}><Icon name="download" size={18} />{C.playStore}</button>}
        </div>
      )}
      {soon.length > 0 && <p className="getinapp-soon">{soon.length === 2 ? C.comingSoon : `Coming soon to ${soon[0]}`}</p>}
      <p className="rfoot">{C.webOnly}</p>
    </div>
  );
}

/** You → Plan's tiles: the web's reference tiles and "Get Solia Health Pro in the app"; on a phone the store's own tiles
    once its offer has answered (nothing while it hasn't, or with no store: no reference price on a phone). */
export function PlanCardTiles({ store = null, native = false }) {
  const [offer, setOffer] = useState(null);
  useEffect(() => {
    let live = true;
    if (native && store && store.available) loadOffer(store).then((o) => { if (live) setOffer(o); });
    return () => { live = false; };
  }, [native, store]);
  const tiles = native ? planTiles({ where: "store", offer }) : planTiles({ where: "web" });
  if (!tiles.length) return null;
  return (
    <div className="youplantiles">
      <p className="section-lab" id="you-plans-lab">{C.label}</p>
      <PlanTiles tiles={tiles} labelledBy="you-plans-lab" />
      {!native && <GetInApp id="you-getinapp" />}
    </div>
  );
}
