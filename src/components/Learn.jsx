import { createContext, useContext } from "react";
import { Card, Sheet } from "./ui/index.js";
import Details from "./Details.jsx";
import Icon from "./Icon.jsx";
import { LEARN_COPY as C, learnOf, learnSources } from "../lib/learn.js";

/* Learn (Task A3): the explainer sheet, the quiet "What does this mean?" link that opens it and You → Learn. App.jsx
   provides open(id) through LearnContext, so a link can sit beside any screen element without threading a prop; with
   no provider (a screen rendered on its own, the dev gallery) the link renders nothing. Opening an explainer sends
   nothing: the text lives in lib/learn.js. */
export const LearnContext = createContext(null);

/** "What does this mean?" beside a screen element; the hidden suffix tells a screen reader which topic it opens. */
export function LearnLink({ id, label = C.link, className = "" }) {
  const open = useContext(LearnContext);
  const e = learnOf(id);
  if (!open || !e) return null;
  return (
    <button type="button" className={`linkbtn learnlink${className ? " " + className : ""}`} aria-haspopup="dialog" data-learn={id} onClick={() => open(id)}>
      <Icon name="book" size={14} />{label}<span className="sr-only">: {e.title}</span>
    </button>
  );
}

export function LearnSheet({ id, onClose }) {
  const e = learnOf(id);
  if (!e) return null;
  return (
    <Sheet id="learn-sheet" title={e.title} closeLabel={`Close ${e.title}`} onClose={onClose} className="learnsheet">
      <div className="learnbody" data-learn={e.id}>{e.body.map((s, i) => <p key={i}>{s}</p>)}</div>
      <Details label={C.sources}>
        <ul className="learnsrc">{learnSources(e).map((s) => <li key={s}>{s}</li>)}</ul>
      </Details>
      <p className="rfoot">{C.foot}</p>
    </Sheet>
  );
}

/** You → Learn: every explainer, the ones for her stage first (lib/learn.js learnFor). */
export function LearnCard({ items, onOpen }) {
  return (
    <Card id="you-learn" tint="patterns" icon="book" eyebrow={C.eyebrow} title={C.title} level={2} className="youlearn">
      <p className="hint">{C.lead}</p>
      <ul className="learnlist">
        {items.map((e) => (
          <li key={e.id}><button type="button" className="learnrow" aria-haspopup="dialog" data-learn={e.id} onClick={() => onOpen(e.id)}><span>{e.title}</span><Icon name="arrow-right" size={14} /></button></li>
        ))}
      </ul>
    </Card>
  );
}
