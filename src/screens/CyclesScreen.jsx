import CycleList from "../components/CycleList.jsx";
import Details from "../components/Details.jsx";
import { Card, EmptyNote } from "../components/ui/index.js";
import { MODULES, MODULE_FRAMING, longCycleCount, sourcesOf } from "../lib/modules.js";
import { t } from "../lib/i18n.js";
import { SIGNAL_COPY, RISE } from "../lib/signals.js";

/* Body → Cycles (calm R2, R4): the cycles list from L5 (components/CycleList.jsx: the running cycle and up to 12 earlier
   ones, newest first, with the Unusual suggestion and her "Don't use" switch) as a page of its own; since R4 the only
   home of the list (the Calendar links here). Not shown in menopause (lib/routes.js). Her switch changes predictions
   only (D5); every cycle stays in the Report.
   PCOS module on (calm R4, plan §7): a card above the list counts cycles longer than 35 days among her finished ones.
   Solia C (readability): a big number + label, one calm line (long cycles are part of the pattern, not mistakes), and
   the guideline's definition and its source behind "What counts as long" and "Source". Counts only; never a verdict. */
export default function CyclesScreen({ cyc, stage, onUse, pcosOn = false, lens = [], marks = null, ttc = false }) {
  const rows = cyc?.rows || [];
  const P = MODULES.pcos;
  const m = (lens || []).filter((x) => Number.isFinite(x)).length;
  const long = longCycleCount(lens);
  const src = sourcesOf(P, P.cycle.definition.src)[0];
  return (
    <main>
      <p className="eyebrow">{t("cycles.body")}</p>
      <h1 className="disp">{t("cycles.yourCycles")}</h1>
      {pcosOn && (
        <Card className="pcoslong" tint="patterns" icon="sparkle" eyebrow={t("cycles.pcos")} title={t("cycles.longCycles")} level={2}>
          {m > 0
            ? <p className="ministat"><span className="bigcount">{long}</span><span className="ministat-lab">{t("cycles.nCyclesLonger", { v1: long === 1 ? "cycle" : "cycles" })}</span></p>
            : <p>{t("cycles.countedOnceACycleEnds")}</p>}
          {m > 0 && <p className="srcline">{t("cycles.outOfFinished", { m, v1: m === 1 ? "" : "s" })}</p>}
          <p>{P.cycle.expected.text}</p>
          <Details label={t("cycles.whatCountsAsLong")}>
            <p>{P.cycle.definition.text}</p>
          </Details>
          <Details label={t("cycles.sourceLab")}>
            {src && <p className="srcline">{t("cycles.source", { title: src.title, year: src.year })}</p>}
            <p className="srcline">{MODULE_FRAMING}</p>
          </Details>
        </Card>
      )}
      {rows.length > 0 || cyc?.current
        ? <Card className="cyclespage" tint="body" icon="calendar" eyebrow={cyc.pending ? t("cycles.unusual", { pending: cyc.pending, v1: cyc.pending === 1 ? "looks" : "look" }) : t("cycles.newestFirst")} title={t("cycles.cycleLengths")} level={2}>
            <CycleList cyc={cyc} peri={stage === "peri"} onUse={onUse} marks={marks} />
            {/* Passive tracking S2 (plan §2.2): how the marker is read, once under the list; Trying to conceive adds the contraception line once. */}
            {marks && (
              <Details label={t("cycles.howRise")}>
                <p>{t("cycles.riseFrom")} {SIGNAL_COPY.riseDetail}</p>
                <p>{SIGNAL_COPY.notEnoughDetail.replace(/^Nights read: \d+\. /, "")} {SIGNAL_COPY.noRise} means {RISE.nights} nights in a row never held {RISE.delta} °C above the {RISE.before} before.</p>
                <p className="rfoot">{SIGNAL_COPY.guidance}</p>
              </Details>
            )}
            {marks && ttc && <p className="rfoot cycttc">{SIGNAL_COPY.ttc}</p>}
          </Card>
        : <EmptyNote>{t("cycles.aFewMoreLogsWill")}</EmptyNote>}
    </main>
  );
}
