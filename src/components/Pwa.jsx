import { useEffect, useRef } from "react";
import Icon from "./Icon.jsx";

/* The installable web app's three quiet pieces (spec A14.1, lib/pwa.js). Web only: App.jsx
   never passes them in the phone app, in standalone mode or when the record isn't in IndexedDB.
   - UpdateRow: the last child of header.mast while an updated worker waits ("A new version of
     Cyra is ready · Reload"). Not a toast and not a live region: it stays until she reloads.
   - InstallTip: Home's one dismissible tip, from 3 logged days, never again once hidden or
     installed. Prompt mode installs (Chromium's own dialog); iOS mode opens Settings → Install.
   - InstallSettings: Settings → Install, the same offer with the iOS steps and an honest note
     that a Home Screen copy keeps its own record. */
export const PWA_COPY = {
  updText: "A new version of Cyra is ready",
  updButton: "Reload",
  tipPrompt: "Install Cyra to open it like an app, even without a connection.",
  tipIos: "Add Cyra to your Home Screen to open it like an app.",
  tipInstall: "Install",
  tipShow: "Show me",
  tipClose: "Hide this tip",
  groupLabel: "Install",
  rowTitle: "Install Cyra on this device",
  rowPrompt: "Opens in its own window from your home screen or app list, even without a connection, with the same record you have here.",
  rowIos: "Tap Share, then Add to Home Screen.",
  rowIosNote: "Cyra on your Home Screen starts with its own record, separate from this one in your browser. To bring your check-ins along, make an encrypted backup below, then restore it there from Cyra's first screen.",
};

export function UpdateRow({ onReload }) {
  return (
    <p className="updrow">
      <span id="upd-text">{PWA_COPY.updText}</span>
      <span aria-hidden="true">·</span>
      <button type="button" className="linkbtn" aria-describedby="upd-text" onClick={onReload}>{PWA_COPY.updButton}</button>
    </p>
  );
}

/* An action, not a switch: no aria-pressed. Deliberately no button named "Not now" (a harness
   name elsewhere); closing is the icon button "Hide this tip". When the tip goes away, focus
   moves to the check-in button (returnFocusRef) so it never falls to the page. */
export function InstallTip({ tip, returnFocusRef }) {
  // Install awaits the browser's dialog; whatever she answers, the tip may then go away. If it
  // does while focus was on it (now on the page itself), focus moves to the check-in button.
  const focusBack = useRef(false);
  useEffect(() => () => {
    const a = typeof document !== "undefined" ? document.activeElement : null;
    if (focusBack.current && (!a || a === document.body)) returnFocusRef?.current?.focus();
  }, []); // runs on unmount only; returnFocusRef is a stable ref object
  const install = async () => { focusBack.current = true; await tip.onInstall(); };
  return (
    <div className="installtip" role="group" aria-labelledby="install-tip-text">
      <Icon name="download" size={18} className="tipico" />
      <p id="install-tip-text">{tip.mode === "prompt" ? PWA_COPY.tipPrompt : PWA_COPY.tipIos}</p>
      {tip.mode === "prompt"
        ? <button type="button" className="takebtn" onClick={install}>{PWA_COPY.tipInstall}</button>
        : <button type="button" className="takebtn" onClick={tip.onShow}>{PWA_COPY.tipShow}</button>}
      <button type="button" className="tipclose" aria-label={PWA_COPY.tipClose} onClick={() => { tip.onHide(); returnFocusRef?.current?.focus(); }}><Icon name="close" /></button>
    </div>
  );
}

export function InstallSettings({ install, labRef }) {
  return (
    <div className="setgroup">
      <p className="section-lab" id="set-install" tabIndex={-1} ref={labRef} style={{ margin: "0 0 6px" }}><Icon name="download" className="labico" />{PWA_COPY.groupLabel}</p>
      <div className="medrow" role="group" aria-labelledby="set-install" style={{ borderTop: "none", padding: "4px 0 8px" }}>
        <div className="medinfo"><b id="install-row-title">{PWA_COPY.rowTitle}</b><span>{install.mode === "prompt" ? PWA_COPY.rowPrompt : PWA_COPY.rowIos}</span></div>
        {install.mode === "prompt" && <button type="button" className="takebtn" aria-describedby="install-row-title" onClick={install.onInstall}>{PWA_COPY.tipInstall}</button>}
      </div>
      {install.mode === "ios" && <p className="rfoot" style={{ marginTop: 0 }}>{PWA_COPY.rowIosNote}</p>}
    </div>
  );
}
