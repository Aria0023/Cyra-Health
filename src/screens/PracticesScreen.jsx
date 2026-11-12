import { Card, IBadge } from "../components/ui/index.js";
import Icon from "../components/Icon.jsx";
import BreathOrb from "../components/mind/BreathOrb.jsx";
import { NEEDS, practicesFor, practiceOf } from "../lib/mind.js";
import { localPractice } from "../locales/index.js";
import { t } from "../lib/i18n.js";

/* Mind → Practices (calm R5, spec §3.5c): short guided practices grouped by need, each with its minutes and how strong
   its evidence is; favourites first. A practice opens its sheet (PracticeSheet: the run, the optional voice guide and the
   evidence). Task 3 (2026-11-12): every practice is free, with no Pro chip. Practices are wellbeing support, not treatment;
   the closing line says where to turn when it's more than a practice can hold.

   Props: favs [ids], onOpen(id, need), featured { practice, need }. */
export default function PracticesScreen({ favs = [], onOpen, featured = null }) {
  const row = (p, need) => {
    return (
      <li key={`${need}-${p.id}`}>
        <button type="button" className="prow-btn" data-practice={p.id} onClick={() => onOpen(p.id, need)}>
          <IBadge icon={p.icon} tint={NEEDS.find((n) => n.id === need)?.tint} size={38} />
          <span className="prow-txt">
            <b>{p.title}</b>
            <span className="prow-sub">{t("practices.min", { min: p.min, v0: t(`strength.${p.strength}`) })}</span>
          </span>
          <Icon name="arrow-right" size={16} className="prow-go" />
        </button>
      </li>
    );
  };
  const favList = favs.map(practiceOf).filter(Boolean).map(localPractice);
  const F = featured?.practice;
  return (
    <main className="practicespage">
      <div className="mindhead">
        <svg className="mindblob" viewBox="0 0 200 120" aria-hidden="true" focusable="false"><path d="M24 70c4-30 40-54 82-52s72 22 74 48-30 46-72 46-88-12-84-42z" /></svg>
        <p className="eyebrow">{t("practices.mind")}</p>
        <h1 className="disp">{t("practices.practices")}</h1>
        <p className="hint">{t("practices.twoToFiveMinutesEach")}</p>
      </div>
      {F && (
        <Card className="breathhero" hero tint="mind" eyebrow={t("practices.breatheWithCyra")} title={F.title} level={2} id="breath-hero">
          <div className="bhero">
            <BreathOrb phase="idle" size={128} />
            <div className="bhero-txt">
              <p>{F.short}</p>
              <button type="button" className="cta bhero-go" onClick={() => onOpen(F.id, featured.need)}><Icon name="play" size={15} />{t("practices.beginMin", { min: F.min })}</button>
            </div>
          </div>
        </Card>
      )}
      {favList.length > 0 && (
        <Card className="needcard" tint="you" icon="star" eyebrow={t("practices.yours")} title={t("practices.favourites")} level={2} id="need-favs">
          <ul className="prows">{favList.map((p) => row(p, p.needs[0]))}</ul>
        </Card>
      )}
      {NEEDS.map((n) => (
        <Card key={n.id} className="needcard" tint={n.tint} icon={n.icon} title={t(`need.${n.id}`)} level={2} id={`need-${n.id}`}>
          <ul className="prows">{practicesFor(n.id).map((p) => row(localPractice(p), n.id))}</ul>
        </Card>
      ))}
      <p className="rfoot practfoot">{t("practices.practicesAreWellbeingSupportNot")}</p>
    </main>
  );
}
