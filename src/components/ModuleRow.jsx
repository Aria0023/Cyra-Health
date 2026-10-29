import { IBadge, Switch } from "./ui/index.js";
import { t } from "../lib/i18n.js";

/* One condition module on the You page (calm R7): an icon badge, its name and what it is, a real switch, and one
   line "What it adds" (calm R10: the You page lists every module's line in one "What each one adds" Details under the rows, p#mod-<id>-adds, so the card reads as a list of switches; the switch is still described by it) so she knows what turning it on does before she does it. `children` (POTS's turn-off card and
   its "Exactly what's kept") sit under the row. `locked` replaces the switch with a plain sentence (POTS while a
   pregnancy clearance is pending). The name is the switch's accessible name; the "what it adds" line describes it. */
export default function ModuleRow({ id, icon, tint = "body", name, short, adds, on, onToggle, controls, locked = null, switchRef, children }) {
  return (
    <li className="modrow" data-module={id}>
      <div className="modrow-main">
        <IBadge icon={icon} tint={tint} size={40} />
        <div className="modinfo"><b id={`mod-${id}`}>{name}</b><span>{short}</span></div>
        {!locked && <Switch checked={!!on} onChange={onToggle} labelledBy={`mod-${id}`} describedBy={adds ? `mod-${id}-adds` : undefined} controls={controls} btnRef={switchRef} />}
      </div>
      {locked && <p className="modadds" id={`mod-${id}-now`}><span className="modadds-lab">{t("moduleRow.rightNow")}</span>{locked}</p>}
      {children}
    </li>
  );
}
