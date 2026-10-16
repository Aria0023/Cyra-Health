/* Advice engine: every insight ends in an action + urgency. It is drawn as the bottom half of
   an insight card; `alone` gives it its own full border and rounded corners when no card sits
   above it; `mid` squares its bottom corners when an action row (.aline) follows it. */
export default function Advice({ urgency, alone = false, mid = false, children }) {
  const map = { now: ["This week", "u-now"], today: ["Today", "u-now"], visit: ["Next visit", "u-visit"], self: ["Self-care", "u-self"] };
  const [label, cls] = map[urgency];
  return (
    <div className={alone ? "advice advice-alone" : mid ? "advice advice-mid" : "advice"}>
      <span className={`uchip ${cls}`}>{label}</span>
      <span className="atext">{children}</span>
    </div>
  );
}
