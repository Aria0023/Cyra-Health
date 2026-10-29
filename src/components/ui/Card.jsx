import { useId } from "react";
import Icon from "../Icon.jsx";

/* Design system v2 (calm R1, spec §8.5). A white (light) / raised navy (dark) card with a 20px radius, a soft
   shadow in light and a 1px line in dark. Optional title row: an `ibadge` (pastel circle, accent icon), an eyebrow
   in small caps (with an optional `badge`, e.g. a Chip, at the end of the eyebrow row), the serif title and one action
   on the right. `tint` ("mind" | "body" | "patterns" | "you") washes
   the header with that domain's pastel; `hero` makes it the one big card of a screen. The section is named by its
   title (aria-labelledby) when it has one. Colours come from tokens only. */
export function IBadge({ icon, tint, size = 36, className = "" }) {
  return (
    <span className={`ibadge${className ? " " + className : ""}`} data-tint={tint || undefined} style={size !== 36 ? { "--ib": `${size}px` } : undefined} aria-hidden="true">
      <Icon name={icon} size={Math.round(size * 0.5)} />
    </span>
  );
}

export default function Card({ title, eyebrow, badge, icon, tint, action, hero = false, level = 3, as: Tag = "section", id, className = "", children, ...rest }) {
  const auto = useId();
  const hid = title ? `${id || auto.replace(/:/g, "")}-t` : undefined;
  const H = `h${level}`;
  return (
    <Tag id={id} className={`v2card${hero ? " hero" : ""}${className ? " " + className : ""}`} data-tint={tint || undefined} aria-labelledby={Tag === "section" && hid ? hid : undefined} {...rest}>
      {(title || eyebrow || badge || action) && (
        <div className="v2card-head">
          {icon && <IBadge icon={icon} tint={tint} />}
          <div className="v2card-titles">
            {badge ? <div className="v2card-eyerow">{eyebrow ? <p className="eyebrow">{eyebrow}</p> : <span />}{badge}</div> : eyebrow && <p className="eyebrow">{eyebrow}</p>}
            {title && <H id={hid} className="v2card-title">{title}</H>}
          </div>
          {action && <div className="v2card-action">{action}</div>}
        </div>
      )}
      {children}
    </Tag>
  );
}
