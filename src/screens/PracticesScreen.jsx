import { Card, Chip, IBadge } from "../components/ui/index.js";
import Icon from "../components/Icon.jsx";
import BreathOrb from "../components/mind/BreathOrb.jsx";
import { NEEDS, practicesFor, practiceOf, unlocked, STRENGTH } from "../lib/mind.js";

/* Mind → Practices (calm R5, spec §3.5c): short guided practices grouped by need, each with its minutes and how strong
   its evidence is; favourites first. A practice opens its sheet (PracticeSheet: the run and the evidence). On the free
   plan the core set opens; the others show a "Pro" chip and their row opens "See what Pro adds" (plan §7: never
   blocking, never nagging). Practices are wellbeing support, not treatment; the closing line says where to turn
   when it's more than a practice can hold.

   Props: canFull (plan.js can("fullPractices")), favs [ids], onOpen(id, need), onPro(), featured { practice, need }. */
export default function PracticesScreen({ canFull = false, favs = [], onOpen, onPro, featured = null }) {
  const row = (p, need) => {
    const open = unlocked(p, canFull);
    return (
      <li key={`${need}-${p.id}`}>
        <button type="button" className={`prow-btn${open ? "" : " locked"}`} data-practice={p.id} onClick={() => (open ? onOpen(p.id, need) : onPro())} aria-describedby={open ? undefined : "pro-why"}>
          <IBadge icon={p.icon} tint={NEEDS.find((n) => n.id === need)?.tint} size={38} />
          <span className="prow-txt">
            <b>{p.title}</b>
            <span className="prow-sub">{p.min} min · {STRENGTH[p.strength]}</span>
          </span>
          {open ? <Icon name="arrow-right" size={16} className="prow-go" /> : <Chip variant="pro" />}
        </button>
      </li>
    );
  };
  const favList = favs.map(practiceOf).filter(Boolean);
  const F = featured?.practice;
  return (
    <main className="practicespage">
      <div className="mindhead">
        <svg className="mindblob" viewBox="0 0 200 120" aria-hidden="true" focusable="false"><path d="M24 70c4-30 40-54 82-52s72 22 74 48-30 46-72 46-88-12-84-42z" /></svg>
        <p className="eyebrow">Mind</p>
        <h1 className="disp">Practices</h1>
        <p className="hint">Two to five minutes each. Every practice says what the evidence shows, and how strongly.</p>
      </div>
      {F && (
        <Card className="breathhero" hero tint="mind" eyebrow="Breathe with Cyra" title={F.title} level={2} id="breath-hero">
          <div className="bhero">
            <BreathOrb phase="idle" size={128} />
            <div className="bhero-txt">
              <p>{F.short}</p>
              <button type="button" className="cta bhero-go" onClick={() => onOpen(F.id, featured.need)}><Icon name="play" size={15} />Begin · {F.min} min</button>
            </div>
          </div>
        </Card>
      )}
      {favList.length > 0 && (
        <Card className="needcard" tint="you" icon="star" eyebrow="Yours" title="Favourites" level={2} id="need-favs">
          <ul className="prows">{favList.map((p) => row(p, p.needs[0]))}</ul>
        </Card>
      )}
      {NEEDS.map((n) => (
        <Card key={n.id} className="needcard" tint={n.tint} icon={n.icon} title={n.label} level={2} id={`need-${n.id}`}>
          <ul className="prows">{practicesFor(n.id).map((p) => row(p, n.id))}</ul>
        </Card>
      ))}
      {!canFull && <p className="hint prowhy" id="pro-why">Practices marked Pro are part of Pro. Tap one to see what Pro adds.</p>}
      <p className="rfoot practfoot">Practices are wellbeing support, not treatment. If low mood or worry is staying with you, or you feel unsafe, talk to your doctor, or call your local emergency number.</p>
    </main>
  );
}
