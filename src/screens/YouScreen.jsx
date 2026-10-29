import { Card, IBadge } from "../components/ui/index.js";
import Icon from "../components/Icon.jsx";
import { MODULE_FRAMING } from "../lib/modules.js";

/* You (calm R2, spec §3): one scrolling page for her, her stage, her settings and data, her modules and the care
   shelf. R7 rebuilds it (Plan, the privacy dashboard inline); in R2 it gathers what used to be scattered:
   - who and which stage: the "<stage> · change" button moved here from the header (same class and words);
   - Settings and your data: the same Settings sheet as the header's sliders button (reminders, check-in style,
     add-ons, appearance, About you, Privacy & your data — what leaves the device, backup, lock, delete);
   - Modules: the condition modules this stage offers (lib/modules.js). PCOS has its switch here (registration's
     "Living with PCOS?" turns it on; record key `modules`, on this device and in backups, never sent). POTS keeps
     its switch in Settings → Add-ons (one switch, one place), so this row says its state and opens Settings;
   - Support & care: the care shelf (CareScreen, embedded).
   Nothing on this page sends anything anywhere. */
export default function YouScreen({ acct, stageName, onChangeStage, onOpenSettings, modules = [], care = null }) {
  const who = acct?.anon ? "Anonymous" : acct?.name || "You";
  return (
    <main className="youpage">
      <p className="eyebrow">You</p>
      <h1 className="disp youname">{who}</h1>
      <Card hero tint="you" icon="user" eyebrow="Your stage" title={stageName} level={2} className="youstage">
        <p className="hint">Cyra is shaped around one stage at a time. Changing it keeps everything you've logged.</p>
        <button type="button" className="stagechip quiet" onClick={onChangeStage}>{stageName} · change</button>
      </Card>
      <Card tint="mind" icon="sliders" eyebrow="Settings and your data" title="Make Cyra yours" level={2}>
        <ul className="youlist">
          <li><Icon name="bell" size={16} />Check-in rhythm, reminders and check-in style</li>
          <li><Icon name="moon" size={16} />Appearance: system, light or dark</li>
          <li><Icon name="user" size={16} />About you: optional answers that sharpen your insights</li>
          <li><Icon name="shield" size={16} />Privacy & your data: what leaves this device, encrypted backup, app lock, delete everything</li>
        </ul>
        <button type="button" className="ghostbtn youopen" onClick={onOpenSettings}>Open settings</button>
      </Card>
      {modules.length > 0 && (
        <Card tint="body" icon="plus-circle" eyebrow="Modules" title="Extra tracking for a condition" level={2}>
          <ul className="modlist">
            {modules.map((m) => (
              <li key={m.id} className="modrow">
                <IBadge icon={m.id === "pots" ? "pulse" : "sparkle"} tint="body" size={34} />
                <div className="modinfo"><b id={`mod-${m.id}`}>{m.name}</b><span>{m.short}{m.note ? ` · ${m.note}` : ""}</span></div>
                {m.onToggle
                  ? <button type="button" className={`takebtn ${m.on ? "on" : ""}`} aria-pressed={m.on} aria-describedby={`mod-${m.id}`} onClick={m.onToggle}>{m.on ? "✓ On" : "Turn on"}</button>
                  : <button type="button" className="takebtn" aria-describedby={`mod-${m.id}`} onClick={onOpenSettings}>{m.on ? "On · Settings" : "Off · Settings"}</button>}
              </li>
            ))}
          </ul>
          <p className="rfoot">{MODULE_FRAMING} Your module switches stay on this device, and go into an encrypted backup only if you save one.</p>
        </Card>
      )}
      {care}
    </main>
  );
}
