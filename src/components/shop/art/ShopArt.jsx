import { useId } from "react";
import { artSvg, cleanArt } from "../../../lib/shopArt.js";

/* A product illustration (2026-11-16, lib/shopArt.js): a studio-style drawing of the product TYPE, shown only until the
   owner places a real, licensed photo. Decorative (aria-hidden: the card's text names the product), not focusable, and
   it never moves. The markup is our own static drawing (never text from the catalog: an unknown id falls back in
   artSvg), with its gradient and filter ids made unique per instance. Colours follow the nearest [data-hue] and the
   colour scheme through the .shopart classes in styles.js. */
export default function ShopArt({ art, className = "" }) {
  const uid = useId();
  return <svg className={`shopart ${className}`.trim()} data-art={cleanArt(art) || "lab-kit"} viewBox="0 0 400 300" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false" dangerouslySetInnerHTML={{ __html: artSvg(art, `a${uid}`) }} />;
}
