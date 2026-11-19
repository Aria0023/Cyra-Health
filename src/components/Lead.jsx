/* A suggestion's text with its lead in bold (lib/lead.js): the same words, with the point easier to spot. Plain
   <strong>, so the colour and contrast are the surrounding text's. Anything that isn't a string is shown unchanged. */
import { splitLead } from "../lib/lead.js";

export default function Lead({ children }) {
  const [lead, rest] = splitLead(children);
  if (!lead) return <>{children}</>;
  return <><strong className="lead">{lead}</strong>{rest}</>;
}
