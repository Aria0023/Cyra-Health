/* Advice engine: every insight ends in an action + urgency. */
export default function Advice({ urgency, children }) {
  const map = { now: ["This week", "u-now"], visit: ["Next visit", "u-visit"], self: ["Self-care", "u-self"] };
  const [label, cls] = map[urgency];
  return (
    <div className="advice">
      <span className={`uchip ${cls}`}>{label}</span>
      <span className="atext">{children}</span>
    </div>
  );
}
