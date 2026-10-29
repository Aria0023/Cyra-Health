import CycleList from "../components/CycleList.jsx";
import { Card, EmptyNote } from "../components/ui/index.js";

/* Body → Cycles (calm R2): the cycles list from L5 (components/CycleList.jsx: the running cycle and up to 12 earlier ones,
   newest first, with the Unusual suggestion and her "Don't use" switch) as a page of its own. The Calendar keeps its
   "Your cycles" disclosure too until R4 rebuilds Body. Not shown in menopause (lib/routes.js). Her switch changes
   predictions only (D5); every cycle stays in the Report. */
export default function CyclesScreen({ cyc, stage, onUse }) {
  const rows = cyc?.rows || [];
  // The cycle card: a v2 card around the list, so the page reads as one calm surface.
  return (
    <main>
      <h1 className="disp">Your cycles</h1>
      {rows.length > 0 || cyc?.current
        ? <Card className="cyclespage" tint="body" icon="calendar" eyebrow={cyc.pending ? `${cyc.pending} ${cyc.pending === 1 ? "looks" : "look"} unusual` : "Newest first"} title="Cycle lengths" level={2}><CycleList cyc={cyc} peri={stage === "peri"} onUse={onUse} /></Card>
        : <EmptyNote>A few more logs will show clearer associations. Your cycles appear here once a period is logged.</EmptyNote>}
    </main>
  );
}
