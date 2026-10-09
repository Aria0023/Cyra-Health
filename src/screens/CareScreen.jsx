/* Cycle & Peri — Care: options for this stage, the ones that fit what she logged in
   the last 30 days first (matched on this device, App.jsx shelfItems), each with an
   honest evidence label. The "Partner" pill shows only for an item with a signed
   partner agreement (SHELF partner: true — none yet), and no partner link is live yet,
   so nothing is shared and no commission is claimed. */
export default function CareScreen({ shelfItems }) {
  return (
    <main>
      <h1 className="disp">Care & support</h1>
      <p className="hint">Options for your stage, with the ones that fit what you've logged first. That matching runs on your device, and partners never see your data. Every label below is the honest state of the evidence, including when something is comfort rather than treatment.</p>
      {shelfItems.map((s) => {
        const top = s.top;
        return (
          <div className="shelfc" key={s.id}>
            <div className="shead"><span className="sbrand">{s.brand}</span>{s.partner && <span className="ppill">Partner</span>}</div>
            <div className="sname">{s.name}</div>
            {top && top.days > 0 && <div className="smatch">Matched: {top.label.toLowerCase()} (logged {top.days} of the last 30 days)</div>}
            <span className={`ev ev-${s.tone}`}>{s.ev}</span>
            <div className="sfoot"><b>{s.price}</b><button className="sbtn" disabled aria-disabled="true">Partner link coming soon</button></div>
          </div>
        );
      })}
    </main>
  );
}
