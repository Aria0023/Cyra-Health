import { famColor } from "../lib/constants.js";
import Details from "../components/Details.jsx";
import { t } from "../lib/i18n.js";

/* Cycle & Peri — Care: options for this stage, the ones that fit what she logged in
   the last 30 days first (matched on this device, App.jsx shelfItems), each with an
   honest evidence label. The "Partner" pill shows only for an item with a signed
   partner agreement (SHELF partner: true — none yet), and no partner link is live yet,
   so nothing is shared and no commission is claimed. The one live action, "Add to what
   I'm trying", feeds Home's trial engine (spec A3) with the brand and offer; nothing
   leaves the device. The match meter is the page's only FAMILIES-coloured mark: the
   matched symptom's family, --primary when the match has none (rough nights). */
const LEGEND = [["strong", "Strong evidence"], ["mixed", "Mixed evidence"], ["comfort", "Comfort"], ["clinical", "Clinical care"]];

/* Calm R2: the shelf is the "Support & care" section of the You page (embedded: a <section> with an h2 inside You's
   <main>); the standalone page (a <main> with the h1) stays for any caller that wants it. */
export default function CareScreen({ shelfItems: items, onTry, embedded = false }) {
  let shelfItems = items;
  const firstFit = shelfItems.find((s) => s.top && s.top.days > 0) || null;
  const Wrap = embedded ? "section" : "main";
  /* Calm R10: on the You page (embedded) the options sit behind one Details, the best-fitting one first. */
  const ordered = firstFit ? [firstFit, ...shelfItems.filter((x) => x !== firstFit)] : shelfItems;
  if (embedded) shelfItems = ordered;
  const item = (s) => {
    const top = s.top;
    const matched = top && top.days > 0;
    return (
      <div className="shelfc" key={s.id}>
        <div className="shead"><span className="sbrand">{s.brand}</span>{s.partner && <span className="ppill">{t("care.partner")}</span>}{firstFit && firstFit.id === s.id && <span className="ppill fit">{t("care.fitsYourLog")}</span>}</div>
        <div className="sname">{s.name}</div>
        {matched && (
          <div className="smatch">
            {t("care.matchedLoggedOfTheLast", { v0: top.label.toLowerCase(), days: top.days })}
            <span className="smeter" aria-hidden="true"><i style={{ width: `${Math.round(Math.min(30, top.days) / 30 * 100)}%`, background: famColor(top.id) || "var(--primary)" }} /></span>
          </div>
        )}
        <span className={`ev ev-${s.tone}`}>{s.ev}</span>
        <div className="sfoot">
          <b>{s.price}</b>
          <div className="acts">
            <button type="button" className="sbtn sadd" onClick={() => onTry(s)}>{t("care.addToWhatImTrying")}</button>
            <button className="sbtn" disabled aria-disabled="true">{t("care.partnerLinkComingSoon")}</button>
          </div>
        </div>
      </div>
    );
  };
  const H = embedded ? "h2" : "h1";
  return (
    <Wrap id={embedded ? "care" : undefined} className={embedded ? "carepart" : undefined} aria-labelledby={embedded ? "care-h" : undefined} tabIndex={embedded ? -1 : undefined}>
      <H className="disp" id={embedded ? "care-h" : undefined}>{t("care.careSupport")}</H>
      {embedded ? (
        <>
          {/* Calm R10 (You page): one summary line and one control; the evidence legend and every option sit behind it. */}
          <p className="hint">{t("care.summary")}</p>
          {shelfItems.length === 0 ? <p className="hint shelf-empty">{t("care.nothingToShowForYour")}</p> : (
            <Details label={t("care.seeOptions", { count: shelfItems.length })}>
              <p className="hint">{t("care.labels")}</p>
              <div className="evlegend" aria-hidden="true">{LEGEND.map(([tv, l]) => <span key={tv} className={`ev ev-${tv}`}>{l}</span>)}</div>
              {!firstFit && <p className="hint shelf-empty">{t("care.logAFewDaysAnd")}</p>}
              {shelfItems.map(item)}
            </Details>
          )}
        </>
      ) : (
        <>
          <p className="hint">{t("care.optionsForYourStageWith")}</p>
          <div className="evlegend" aria-hidden="true">{LEGEND.map(([tv, l]) => <span key={tv} className={`ev ev-${tv}`}>{l}</span>)}</div>
          {shelfItems.length === 0 && <p className="hint shelf-empty">{t("care.nothingToShowForYour")}</p>}
          {shelfItems.length > 0 && !firstFit && <p className="hint shelf-empty">{t("care.logAFewDaysAnd")}</p>}
          {shelfItems.map(item)}
        </>
      )}
    </Wrap>
  );
}
