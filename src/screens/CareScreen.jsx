/* Cycle & Peri — Care: stage-filtered partner list ordered by symptom match,
   honest evidence labels, commission disclosure above the list. */
export default function CareScreen({ shelfItems, ins, ping }) {
  return (
    <main>
      <h1 className="disp">Care & support</h1>
      <p className="hint">Clinicians and products matched to what you’ve actually logged — matching runs on your device, so partners never see your data. Cyra earns a commission when you use these, and every label below is the honest state of the evidence, including when something is comfort rather than treatment.</p>
      {shelfItems.map((s) => {
        const top = ins.counts.find((c) => s.m.includes(c.id));
        return (
          <div className="shelfc" key={s.id}>
            <div className="shead"><span className="sbrand">{s.brand}</span><span className="ppill">Partner</span></div>
            <div className="sname">{s.name}</div>
            {top && top.days > 0 && <div className="smatch">Matched: {top.label.toLowerCase()} ({top.days}/30)</div>}
            <span className={`ev ev-${s.tone}`}>{s.ev}</span>
            <div className="sfoot"><b>{s.price}</b><button className="sbtn" onClick={() => ping("Opens partner site in shipped app")}>View with partner</button></div>
          </div>
        );
      })}
    </main>
  );
}
