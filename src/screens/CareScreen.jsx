import { famColor } from "../lib/constants.js";

/* Cycle & Peri — Care: options for this stage, the ones that fit what she logged in
   the last 30 days first (matched on this device, App.jsx shelfItems), each with an
   honest evidence label. The "Partner" pill shows only for an item with a signed
   partner agreement (SHELF partner: true — none yet), and no partner link is live yet,
   so nothing is shared and no commission is claimed. The one live action, "Add to what
   I'm trying", feeds Home's trial engine (spec A3) with the brand and offer; nothing
   leaves the device. The match meter is the page's only FAMILIES-coloured mark: the
   matched symptom's family, --primary when the match has none (rough nights). */
const LEGEND = [["strong", "Strong evidence"], ["mixed", "Mixed evidence"], ["comfort", "Comfort"], ["clinical", "Clinical care"]];

export default function CareScreen({ shelfItems, onTry }) {
  const firstFit = shelfItems.find((s) => s.top && s.top.days > 0) || null;
  return (
    <main>
      <h1 className="disp">Care & support</h1>
      <p className="hint">Options for your stage, with the ones that fit what you've logged first. That matching runs on your device, and partners never see your data. Every label below is the honest state of the evidence, including when something is comfort rather than treatment.</p>
      <div className="evlegend" aria-hidden="true">{LEGEND.map(([t, l]) => <span key={t} className={`ev ev-${t}`}>{l}</span>)}</div>
      {shelfItems.length === 0 && <p className="hint shelf-empty">Nothing to show for your stage yet. Check back after the next update.</p>}
      {shelfItems.length > 0 && !firstFit && <p className="hint shelf-empty">Log a few days and the options that fit your symptoms move to the top.</p>}
      {shelfItems.map((s) => {
        const top = s.top;
        const matched = top && top.days > 0;
        return (
          <div className="shelfc" key={s.id}>
            <div className="shead"><span className="sbrand">{s.brand}</span>{s.partner && <span className="ppill">Partner</span>}{firstFit && firstFit.id === s.id && <span className="ppill fit">Fits your log</span>}</div>
            <div className="sname">{s.name}</div>
            {matched && (
              <div className="smatch">
                Matched: {top.label.toLowerCase()} (logged {top.days} of the last 30 days)
                <span className="smeter" aria-hidden="true"><i style={{ width: `${Math.round(Math.min(30, top.days) / 30 * 100)}%`, background: famColor(top.id) || "var(--primary)" }} /></span>
              </div>
            )}
            <span className={`ev ev-${s.tone}`}>{s.ev}</span>
            <div className="sfoot">
              <b>{s.price}</b>
              <div className="acts">
                <button type="button" className="sbtn sadd" onClick={() => onTry(s)}>Add to what I'm trying</button>
                <button className="sbtn" disabled aria-disabled="true">Partner link coming soon</button>
              </div>
            </div>
          </div>
        );
      })}
    </main>
  );
}
