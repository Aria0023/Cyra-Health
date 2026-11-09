import { useState } from "react";
import { Card, Switch } from "./ui/index.js";
import Details from "./Details.jsx";
import Icon from "./Icon.jsx";
import { fmt } from "../lib/engine.js";
import { t } from "../lib/i18n.js";
import { METRIC_WORDS } from "../lib/autoTracked.js";

/* You → Data sources (passive tracking S3, plan §2.4): the manage surface for every source this build offers. One row per
   source: status (Connected · Paused · Waiting to finish · Not connected), what it reads, "Where it goes" (this phone only /
   through Solia Health's server), last sync, how many nights it read, and Connect / Sync, Pause / Resume and Disconnect
   (with "Delete its readings from this device too", on by default). A preferred-source picker per metric once two sources
   cover the same nights; a "Demo readings" switch in demo builds only; and "How this is going": the spike's numbers from
   trackStats with "Kept on this device, never sent." Nothing on this card sends anything; Connect / Sync / Disconnect for
   Oura and Fitbit/Garmin/Whoop run the same server flows the Home door runs (App.jsx), and the on-phone source never
   touches a server. m: { rows: sourceRows(), prefer: preferRows(), going: howGoing(), demo: { on } | null, web }. */
export default function DataSourcesCard({ m, onConnect, onPause, onDisconnect, onPrefer, onDemo, busy = null }) {
  const [closing, setClosing] = useState(null); // { id, deleteToo }
  const when = (ms) => (ms ? (new Date(ms).toDateString() === new Date().toDateString() ? new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : fmt(new Date(ms))) : null);
  const rows = m.rows;
  const anyRow = rows.length > 0;
  return (
    <Card id="you-sources" tint="body" icon="pulse" eyebrow={t("sources.eyebrow")} title={t("sources.title")} level={2} className="youset yousources">
      <p className="hint yousum">{anyRow ? t("sources.lead") : m.web ? t("sources.noneWeb") : t("sources.none")}</p>
      {anyRow && (
        <ul className="modlist srclist">
          {rows.map((r) => {
            const close = closing && closing.id === r.id ? closing : null;
            return (
              <li key={r.id} className={`modrow srcrow st-${r.status}`} data-source={r.id}>
                <div className="modrow-main">
                  <div className="modinfo">
                    <b id={`src-${r.id}`}>{r.name}</b>
                    <span className="srcstatus">{t(`sources.status.${r.status}`)}{r.status !== "off" ? ` · ${r.lastSync ? t("sources.lastSync", { when: when(r.lastSync) }) : t("sources.neverSynced")}` : ""}{r.nights ? ` · ${t("sources.nights", { n: r.nights })}` : ""}</span>
                  </div>
                  {r.status === "off" && r.offered && <button type="button" className="takebtn" disabled={!!busy} aria-busy={busy === r.id} onClick={() => onConnect(r.id, r.name)}>{t("sources.connect")}</button>}
                  {(r.status === "connected" || r.status === "pending") && !r.demo && <button type="button" className="takebtn on" disabled={!!busy} aria-busy={busy === r.id} onClick={() => onConnect(r.id, r.name)}>{t("sources.sync")}</button>}
                </div>
                <p className="modadds srcwhat"><b>{t("sources.reads")}:</b> {r.what}</p>
                <p className="modadds srcwhere"><b>{t("sources.where")}:</b> {r.where}</p>
                {r.paused && <p className="modadds srcpaused">{t("sources.pausedNote")}</p>}
                {r.status !== "off" && (
                  <div className="srcacts">
                    <button type="button" className="takebtn" aria-pressed={r.paused} onClick={() => onPause(r.id, !r.paused)}>{r.paused ? t("sources.resume") : t("sources.pause")}</button>
                    <button type="button" className="takebtn" aria-expanded={!!close} aria-controls={close ? `src-close-${r.id}` : undefined} disabled={!!busy} onClick={() => setClosing(close ? null : { id: r.id, deleteToo: true })}>{t("sources.disconnect")}</button>
                  </div>
                )}
                {close && (
                  <div className="plaincard srcclose" id={`src-close-${r.id}`} role="group" aria-labelledby={`src-close-${r.id}-t`}>
                    <p className="plain" id={`src-close-${r.id}-t`}><b>{t("sources.disconnectTitle", { name: r.name })}</b></p>
                    <button type="button" role="checkbox" aria-checked={close.deleteToo} className={`consentopt ${close.deleteToo ? "on" : ""}`} onClick={() => setClosing({ ...close, deleteToo: !close.deleteToo })}>
                      <span className="ckbox" aria-hidden="true">{close.deleteToo ? "✓" : ""}</span>
                      <span><b>{t("sources.deleteToo")}</b><br />{t("sources.deleteNote", { n: r.nights })}</span>
                    </button>
                    <div className="srcacts">
                      <button type="button" className="cta srcgo" disabled={!!busy} onClick={() => { const d = close.deleteToo; setClosing(null); onDisconnect(r.id, r.name, { deleteRows: d }); }}>{t("sources.confirmDisconnect")}</button>
                      <button type="button" className="ghostbtn srcno" onClick={() => setClosing(null)}>{t("sources.cancel")}</button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {m.prefer.length > 0 && (
        <div className="srcprefer">
          <p className="lab" id="src-prefer">{t("sources.preferLab")}</p>
          <p className="hint">{t("sources.preferLead")}</p>
          {m.prefer.map((p) => (
            <div key={p.metric} className="srcpick" role="group" aria-label={`${t("sources.preferLab")}: ${METRIC_WORDS[p.metric]}`}>
              <span className="srcpick-lab">{p.label}</span>
              <div className="mcrow seg">
                {p.options.map((id) => <button key={id} type="button" className={`mc ${p.chosen === id ? "on" : ""}`} aria-pressed={p.chosen === id} onClick={() => onPrefer(p.metric, id)}>{rows.find((r) => r.id === id)?.name || id}</button>)}
              </div>
            </div>
          ))}
        </div>
      )}
      {m.demo && (
        <ul className="modlist srcdemo">
          <li className="modrow">
            <div className="modrow-main">
              <div className="modinfo"><b id="src-demo-n">{t("sources.demo")}</b><span>{t("sources.demoShort")}</span></div>
              <Switch checked={!!m.demo.on} onChange={(v) => onDemo(v)} labelledBy="src-demo-n" describedBy="src-demo-d" disabled={!!busy} />
            </div>
            <p className="modadds" id="src-demo-d">{t("sources.demoAdds")}</p>
          </li>
        </ul>
      )}
      <Details label={t("sources.howGoing")}>
        <p className="hint">{t("sources.howGoingLead")}</p>
        <ul className="srcgoing">{m.going.lines.map((l) => <li key={l}>{l}</li>)}</ul>
        <p className="rfoot srckept"><Icon name="lock" size={12} /> {m.going.kept}</p>
      </Details>
    </Card>
  );
}
