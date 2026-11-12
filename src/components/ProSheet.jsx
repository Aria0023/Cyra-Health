import { useEffect, useRef, useState } from "react";
import { Sheet } from "./ui/index.js";
import Icon from "./Icon.jsx";
import { t } from "../lib/i18n.js";
import { loadOffer, buyPro, sendTip, STORE_LINES } from "../lib/purchase.js";
import { PRO_PLAN_IDS, PRO_PRODUCTS, TIP_PRODUCTS, WEB_PRICE_LINE, planLines, CANCEL_LINES, KEEP_LINE } from "../lib/pricing.js";
import { TERMS_URL, PRIVACY_URL, POLICY_LINKS_READY, TIP_URL, openExternal } from "../lib/links.js";

/* "What Pro adds" (calm R5, plan §7 "Premium (Pro)"; owner decision D4: $4.99 a month or $29.99 a year, 7-day free
   trial on the yearly plan, optional tips). One calm sheet, opened only when she taps "See what Pro adds" or a Pro
   chip: never on its own, never blocking anything free, no countdown and no pressure words.

   What it shows depends on where she is:
   - a phone whose store answered: the two plans with the STORE's own prices (never a price from this file), the
     auto-renewal terms, how to cancel, Restore, the Terms and Privacy links (App Store Guideline 3.1.2), and tips;
   - a phone without a connected store: the store's honest line, no price at all;
   - the web: what Pro costs in the apps (WEB_PRICE_LINE), and a tip link only when VITE_TIP_URL is set;
   - Pro already on: what it includes and how to manage it. A dev build (proDev) says it is a test build.
   Every line under "What Pro adds" is something this build really opens for Pro (lib/plan.js). Task 3: Ask with evidence
   leads, then the weekly write-up and chat, then the encrypted backup where the build has it. */
/* Task 3 (owner request 2026-11-12): Pro is AI with evidence. Every practice is free (with an optional voice guide), so
   "The full practices library" is gone. Each line shows only where this build really opens it: the AI lines need the
   ai flag and a server (`ai`), the backup line the optional account (`cloud`). */
export const PRO_EVIDENCE = Object.freeze(["book", "Ask with evidence", "Answers that cite their sources, with links: PubMed, MedlinePlus, CDC, NIH, ACOG, WHO, NICE and others. You see exactly what is sent first, and only your question goes, plus a summary of your log if you tick it."]);
export const PRO_AI = Object.freeze(["note", "A weekly write-up and chat about your log, only if you turn them on", "Written by Solia Health's AI from a summary of your log with no dates, notes or anything that names you. Each shows exactly what it would send before anything is sent."]);
export const PRO_PLANNED = Object.freeze(["Your own experiments, beyond the starter ones", "Medicine and supplement reminders", "A richer PDF with trends and the write-up"]);
export const FREE_KEEPS = "Free stays free: logging, the calendar, cycles, every pattern Solia Health finds, your weekly review, every guided practice with its voice guide, safety guidance and the basic doctor-ready PDF.";
/** Calm R9: only in a build that offers the optional account (lib/cloudBackup.js ACCOUNTS_HERE). */
export const PRO_CLOUD = Object.freeze(["shield", "An encrypted backup to Solia Health's server, if you make an account", "Bring your log back on a new phone or browser with your email and passphrase. It's encrypted on your device first; Solia Health can't read it."]);
/** Said when this build has none of Pro's parts (no AI server and no account backup): nothing is claimed that isn't here. */
export const PRO_NONE = "In this version Pro adds nothing yet: its features need Solia Health's server.";
export const proAddsFor = (ai, cloud = false) => [...(ai ? [PRO_EVIDENCE, PRO_AI] : []), ...(cloud ? [PRO_CLOUD] : [])];

export default function ProSheet({ onClose, unlocked = false, owned = false, ai = false, cloud = false, store = null, native = false, onOwned, onRestore, ping }) {
  const selling = !!(store && store.available) && !owned;
  const [offer, setOffer] = useState(null); // null while the store hasn't answered
  const [pick, setPick] = useState("annual");
  const [busy, setBusy] = useState(false);
  const live = useRef(true);
  useEffect(() => {
    live.current = true;
    if (store && store.available) loadOffer(store, { tipIds: TIP_PRODUCTS.map((x) => x.id) }).then((o) => { if (live.current) setOffer(o); });
    return () => { live.current = false; };
  }, [store]);

  const lines = offer && offer.plans && offer.plans[pick] ? planLines(pick, offer.plans[pick]) : null;
  const buy = async () => {
    if (busy || !lines) return;
    setBusy(true);
    const r = await buyPro(store, pick, offer);
    if (!live.current) return;
    setBusy(false);
    if (r.owned) onOwned?.(true);
    ping?.(r.line);
  };
  const tip = async (id) => {
    if (busy) return;
    setBusy(true);
    const r = await sendTip(store, id, offer);
    if (!live.current) return;
    setBusy(false);
    ping?.(r.line);
  };
  const tips = offer && Array.isArray(offer.tips) ? offer.tips : [];
  const cancelLine = store && CANCEL_LINES[store.kind];

  return (
    <Sheet id="pro-sheet" title={owned ? t("pro.proIsOn") : t("pro.whatProAdds")} onClose={onClose} closeLabel={t("pro.closeWhatProAdds")} className="prosheet">
      {!proAddsFor(ai, cloud).length && <p className="hint pronone">{PRO_NONE}</p>}
      <ul className="prolist" aria-label={t("pro.whatProAddsInThis")}>
        {proAddsFor(ai, cloud).map(([icon, tv, d]) => (
          <li key={tv}><span className="prolist-ico" aria-hidden="true"><Icon name={icon} size={16} /></span><span><b>{tv}</b><span className="prolist-d">{d}</span></span></li>
        ))}
      </ul>
      <p className="section-lab proplanned-lab" id="pro-planned">{t("pro.plannedForProNotIn")}</p>
      <ul className="proplanned" aria-labelledby="pro-planned">{PRO_PLANNED.map((tv) => <li key={tv}>{tv}</li>)}</ul>
      <p className="profree">{FREE_KEEPS}</p>

      {owned && <p className="hint pronote">{t("pro.ownedNote")} {cancelLine}</p>}

      {selling && (
        <div className="proplans" role="group" aria-labelledby="pro-plans-lab">
          <p className="section-lab" id="pro-plans-lab">{t("pro.choosePlan")}</p>
          {offer === null && <p className="hint" aria-live="polite">{t("pro.askingTheStore")}</p>}
          {offer !== null && !Object.keys(offer.plans || {}).length && <p className="hint">{STORE_LINES.noPrice}</p>}
          <div className="proplanopts">
            {PRO_PLAN_IDS.filter((id) => offer && offer.plans && offer.plans[id]).map((id) => {
              const l = planLines(id, offer.plans[id]);
              const on = pick === id;
              return (
                <button key={id} type="button" className={`proplanopt ${on ? "on" : ""}`} aria-pressed={on} onClick={() => setPick(id)}>
                  <b>{l.title}</b><span className="proplanprice">{l.price}</span>
                  {l.note && <span className="proplannote">{l.note}</span>}
                  {PRO_PRODUCTS[id].trialDays > 0 && <span className="proplannote">{t("pro.freeTrialDays", { n: PRO_PRODUCTS[id].trialDays })}</span>}
                </button>
              );
            })}
          </div>
          {lines && (
            <>
              <button type="button" className="cta probuy" disabled={busy} aria-describedby="pro-terms" onClick={buy}>{busy ? t("pro.waitingForStore") : lines.button}</button>
              <p className="rfoot proterms" id="pro-terms">{lines.terms} {cancelLine}</p>
            </>
          )}
          <p className="rfoot">{KEEP_LINE}</p>
          <div className="prolinks">
            {onRestore && <button type="button" className="linkbtn" onClick={onRestore}>{t("pro.restorePurchases")}</button>}
            {POLICY_LINKS_READY && <button type="button" className="linkbtn" onClick={() => openExternal(TERMS_URL)}>{t("pro.termsOfUse")}</button>}
            {POLICY_LINKS_READY && <button type="button" className="linkbtn" onClick={() => openExternal(PRIVACY_URL)}>{t("pro.privacyPolicy")}</button>}
          </div>
        </div>
      )}

      {!owned && !selling && <p className="hint pronote">{native ? (store && store.line ? store.line : STORE_LINES.native) : WEB_PRICE_LINE}</p>}
      {!owned && unlocked && <p className="hint pronote">{t("pro.thisIsATestBuild")}</p>}

      {store && store.available && tips.length > 0 && (
        <div className="protips" role="group" aria-labelledby="pro-tips-lab">
          <p className="section-lab" id="pro-tips-lab">{t("pro.supportSolia")}</p>
          <p className="hint">{t("pro.tipsHelp")}</p>
          <div className="protipopts">
            {tips.map((x) => {
              const label = (TIP_PRODUCTS.find((p) => p.id === x.id) || {}).label || "";
              return <button key={x.id} type="button" className="ghostbtn protip" disabled={busy} onClick={() => tip(x.id)}><b>{x.priceString}</b> <span>{label}</span></button>;
            })}
          </div>
        </div>
      )}
      {!native && TIP_URL && (
        <div className="protips">
          <p className="section-lab">{t("pro.supportSolia")}</p>
          <p className="hint">{t("pro.tipsHelp")}</p>
          <button type="button" className="ghostbtn protip" onClick={() => openExternal(TIP_URL)}>{t("pro.leaveATip")}</button>
        </div>
      )}

      <button type="button" className="cta" onClick={onClose}>{t("pro.done")}</button>
    </Sheet>
  );
}
