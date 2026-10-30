import { useEffect, useLayoutEffect, useState } from "react";
import Shell from "../components/Shell.jsx";
import Icon from "../components/Icon.jsx";
import { Card, IBadge, QuickTile, StepRail, Ring, TwoBar, Chip, NavPill, Sheet, EmptyNote } from "../components/ui/index.js";
import { stagePalettes, vizVars } from "../lib/constants.js";
import { paletteFor, paletteVars, applyDocumentScheme, SYSTEM_DARK_QUERY } from "../lib/appearance.js";

/* The design-system gallery (calm R1): every v2 component in the stage accent picked here, light or dark. Present
   only in a build whose VITE_FEATURES names devGallery (or "all"): main.jsx imports this file behind the build-time
   __CYRA_DEV_GALLERY__ constant. It reads nothing from storage, writes nothing and sends nothing; all figures are
   illustrative. Deep links for the axe and screenshot passes: #/dev/ui?stage=cycle|ttc|peri|preg|meno&scheme=light|dark. */
export const GALLERY_STAGES = [
  ["cycle", "My Cycle", "periods", "My Cycle"],
  ["ttc", "Trying to conceive", "periods", "Trying to Conceive"],
  ["peri", "Perimenopause", "peri", "Perimenopause"],
  ["preg", "Pregnancy", "preg", "Pregnancy"],
  ["meno", "Menopause & beyond", "peri", "Menopause"],
];
const TABS = [{ id: "home", label: "Home", icon: "home" }, { id: "body", label: "Body", icon: "body" }, { id: "mind", label: "Mind", icon: "mind" }, { id: "patterns", label: "Patterns", icon: "patterns" }, { id: "you", label: "You", icon: "user" }];
const LOG_ITEMS = [["pulse", "Symptoms"], ["drop", "Period"], ["moon", "Sleep"], ["smile", "Mood"], ["move", "Move"], ["pill", "Meds"], ["note", "Note"]];
const BARS = [2, 3, 2, 4, 3, 1, 2, 3, 4, 4, 2, 3, 1, 2];

const readHash = () => {
  const q = new URLSearchParams((window.location.hash.split("?")[1]) || "");
  const stage = GALLERY_STAGES.some(([k]) => k === q.get("stage")) ? q.get("stage") : "cycle";
  const scheme = q.get("scheme") === "dark" || q.get("scheme") === "light" ? q.get("scheme") : (typeof matchMedia === "function" && matchMedia(SYSTEM_DARK_QUERY).matches ? "dark" : "light");
  return { stage, scheme };
};

export default function DevGallery() {
  const [{ stage, scheme }, setView] = useState(readHash);
  const [tab, setTab] = useState("home");
  const [sheet, setSheet] = useState(false);
  const [tiles, setTiles] = useState({ Sleep: true });
  useEffect(() => { const on = () => setView(readHash()); window.addEventListener("hashchange", on); return () => window.removeEventListener("hashchange", on); }, []);
  const set = (next) => { const v = { stage, scheme, ...next }; window.location.hash = `#/dev/ui?stage=${v.stage}&scheme=${v.scheme}`; };
  const [, stageLabel, stageId, stageName] = GALLERY_STAGES.find(([k]) => k === stage);
  const pal = stagePalettes(stageId, stageName)[0];
  const t = paletteFor(pal, scheme);
  useLayoutEffect(() => { applyDocumentScheme(document, { scheme, paper: t.paper }); }, [scheme, t.paper]);
  const style = { ...paletteVars(t), ...vizVars(scheme, stageId) };
  return (
    <Shell style={style} scheme={scheme}>
      <main className="devgallery" aria-labelledby="dg-title">
        <p className="mark" style={{ margin: "4px 0 2px" }}>Heard<span className="sub">Design system v2</span></p>
        <p className="eyebrow" style={{ marginTop: 14 }}>Thursday, October 29</p>
        <h1 id="dg-title" className="disp">Good afternoon, Maya.</h1>
        <p className="hint">Every v2 component in the {stageLabel} accent ({pal.name}). Illustrative data only.</p>

        <div className="dgcontrols">
          <p className="lab" id="dg-stage">Stage accent</p>
          <div className="seg scroll" role="group" aria-labelledby="dg-stage">
            {GALLERY_STAGES.map(([k, l]) => <button key={k} type="button" className={`mc${k === stage ? " on" : ""}`} aria-pressed={k === stage} onClick={() => set({ stage: k })}>{l}</button>)}
          </div>
          <p className="lab" id="dg-scheme">Scheme</p>
          <div className="seg" role="group" aria-labelledby="dg-scheme">
            {["light", "dark"].map((k) => <button key={k} type="button" className={`mc${k === scheme ? " on" : ""}`} aria-pressed={k === scheme} onClick={() => set({ scheme: k })}>{k === "light" ? "Light" : "Dark"}</button>)}
          </div>
        </div>

        <Card level={2} hero eyebrow="Today's small step" title="A two-minute breathing practice" icon="breath" tint="mind" badge={<Chip variant="pro" />}>
          <p style={{ margin: "0 0 12px", color: "var(--soft)" }}>You logged a rough night. Slow breathing can make the afternoon feel steadier.</p>
          <button type="button" className="cta">Start breathing</button>
        </Card>

        <h2 className="section-lab">Quick log</h2>
        <div className="qtiles">
          {[["pulse", "Symptoms"], ["moon", "Sleep"], ["smile", "Mood"], ["move", "Move"]].map(([i, l]) => (
            <QuickTile key={l} icon={i} label={l} note={tiles[l] ? "Logged" : undefined} pressed={!!tiles[l]} onClick={() => setTiles((x) => ({ ...x, [l]: !x[l] }))} />
          ))}
        </div>

        <section className="v2card dgrings" aria-labelledby="dg-rings">
          <h2 id="dg-rings" className="sr-only">Rings</h2>
          <div className="ringrow">
            <Ring title="Body" word="At your usual" size={92} stroke={8} value={0.62} tone="accent" />
            <Ring center="Day 12" sub="Follicular" title="Cycle" value={12 / 29} size={128} blob />
            <Ring title="Mind" word="A little lower" size={92} stroke={8} value={0.44} tone="soft" />
          </div>
        </section>

        <Card level={2} title="Mind" icon="mind" tint="mind" action={<span className="dgcount">0 of 2</span>}>
          <StepRail label="Mind steps today" steps={[{ label: "Check-in", sub: "Continue", state: "current" }, { label: "Today's read", sub: "After check-in", state: "todo" }]} />
        </Card>
        <Card level={2} title="Body" icon="body" tint="body" action={<span className="dgcount">2 of 3</span>}>
          <StepRail label="Body steps today" steps={[{ label: "Sleep", sub: "7 h", state: "done" }, { label: "Movement", sub: "30 min", state: "done" }, { label: "Symptoms", sub: "Not yet", state: "todo" }]} />
        </Card>

        <h2 className="section-lab">What you're learning</h2>
        <Card level={2} eyebrow="Sleep duration" title="Breathing practice days lined up with longer sleep." tint="patterns" badge={<Chip variant="supported" />}>
          <TwoBar family="sleep" diff="+54 min" a={{ label: "Breathing practice", days: 24, value: 8, shown: "8h" }} b={{ label: "No practice", days: 18, value: 7.1, shown: "7.1h" }} />
          <div className="dgfoot"><span>In your recent data</span><button type="button" className="linkbtn">View pattern <Icon name="arrow-right" size={14} /></button></div>
        </Card>
        <Card level={2} eyebrow="Energy" title="High-sugar days and next-day energy" badge={<Chip variant="notenough" />}>
          <EmptyNote />
        </Card>

        <Card level={2} title="Chips" icon="sparkle">
          <div className="dgchips">
            <Chip variant="logged" /><Chip variant="logged">Logged · 7h</Chip><Chip variant="supported" /><Chip variant="still" /><Chip variant="notenough" /><Chip variant="pro" />
          </div>
        </Card>

        <Card level={2} title="Domain tints" icon="palette" tint="you">
          <div className="dgbadges">
            {[["mind", "mind", "Mind"], ["body", "body", "Body"], ["patterns", "patterns", "Patterns"], ["you", "user", "You"], [null, "heart", "Accent"]].map(([tn, ic, l]) => (
              <span key={l} className="dgbadge"><IBadge icon={ic} tint={tn} size={44} /><span>{l}</span></span>
            ))}
          </div>
        </Card>

        <Card level={2} title="Soft ramp" eyebrow="Sparklines and bars" icon="chart">
          <div className="softbars" aria-hidden="true">{BARS.map((b, i) => <i key={i} className={`s${b}`} style={{ height: `${20 + b * 20}%` }} />)}</div>
          <p className="rfoot">Four steps of one hue, separate from the UI palette (data-viz rule).</p>
        </Card>

        <Card level={2} title="Type" icon="book">
          <p className="dgserif">Fraunces for titles and big figures: 28 days</p>
          <p style={{ margin: 0 }}>Karla for everything you read and tap. Calm, clear, and easy at small sizes.</p>
        </Card>

        <button type="button" className="cta" aria-haspopup="dialog" onClick={() => setSheet(true)}>Open the log sheet</button>
        <p className="rfoot" style={{ textAlign: "center" }}>Illustrative data. Nothing on this page is saved or sent.</p>
      </main>
      <NavPill tabs={TABS} current={tab} onSelect={setTab} onPlus={() => setSheet(true)} plusExpanded={sheet} label="Gallery sections" />
      {sheet && (
        <Sheet title="Log something" onClose={() => setSheet(false)}>
          <div className="qtiles dglog">
            {LOG_ITEMS.map(([i, l]) => <QuickTile key={l} icon={i} label={l} onClick={() => setSheet(false)} />)}
          </div>
          <p className="rfoot" style={{ marginTop: 4 }}>One tap opens the right logger.</p>
        </Sheet>
      )}
    </Shell>
  );
}
