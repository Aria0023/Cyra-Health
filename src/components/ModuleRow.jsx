import { IBadge, Switch } from "./ui/index.js";

/* One condition module on the You page (calm R7): an icon badge, its name and what it is, a real switch, and one
   line "What it adds" so she knows what turning it on does before she does it. `children` (POTS's turn-off card and
   its "Exactly what's kept") sit under the row. `locked` replaces the switch with a plain sentence (POTS while a
   pregnancy clearance is pending). The name is the switch's accessible name; the "what it adds" line describes it. */
export default function ModuleRow({ id, icon, tint = "body", name, short, adds, on, onToggle, controls, locked = null, switchRef, children }) {
  return (
    <li className="modrow" data-module={id}>
      <div className="modrow-main">
        <IBadge icon={icon} tint={tint} size={40} />
        <div className="modinfo"><b id={`mod-${id}`}>{name}</b><span>{short}</span></div>
        {!locked && <Switch checked={!!on} onChange={onToggle} labelledBy={`mod-${id}`} describedBy={`mod-${id}-adds`} controls={controls} btnRef={switchRef} />}
      </div>
      <p className="modadds" id={`mod-${id}-adds`}><span className="modadds-lab">{locked ? "Right now" : "What it adds"}</span>{locked || adds}</p>
      {children}
    </li>
  );
}
