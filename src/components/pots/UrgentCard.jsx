import { SAFETY_COPY } from "../../lib/potsConstants.js";

/* Get-help-now card (design 4.11). It exists because Advice's "now" urgency renders the chip
   "This week", which is wrong for an emergency. Every variant names "your local emergency
   number (911 in the US)" (owner decision D11); in pregnancy each one adds the maternity-team
   line. The card itself has no live role: a card that appears because of an answer she just
   picked is announced once through the screen's own role="alert" node (ui.js useAnnounce),
   so it is never read twice. Copy: SAFETY_COPY (clinician sign-off required, Q1). */
const U = SAFETY_COPY.urgent;

function FaintText() {
  return U.faint.map((x) => <p className="plain" key={x.lead}><b>{x.lead}</b>{x.text}</p>);
}

/** Plain text of a variant, for the announcement (its first sentence is read). */
export const urgentText = (variant) => (variant === "faint" ? `${U.faint[0].lead}${U.faint[0].text}` : U[variant] || "");

export default function UrgentCard({ variant, preg = false }) {
  return (
    <div className="plaincard urgent" data-urgent={variant}>
      <span className="uchip u-now">Now</span>
      {variant === "faint" && <FaintText />}
      {variant === "faintInjury" && <><p className="plain">{U.faintInjury}</p><FaintText /></>}
      {variant !== "faint" && variant !== "faintInjury" && <p className="plain">{U[variant]}</p>}
      {preg && <p className="plain">{U.pregSuffix}</p>}
    </div>
  );
}
