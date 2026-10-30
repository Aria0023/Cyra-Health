import Blob from "./Blob.jsx";

/* Design system v2 (calm R1): the calm empty state. A small pastel blob and one line; the default line is the tone
   rule's own: "A few more logs will show clearer associations." Never "you missed", never a completeness bar. */
export const EMPTY_LINE = "A few more logs will show clearer associations.";
export default function EmptyNote({ children = EMPTY_LINE, variant = 1 }) {
  return (
    <div className="emptynote">
      <Blob variant={variant} className="emptyblob" />
      <p>{children}</p>
    </div>
  );
}
