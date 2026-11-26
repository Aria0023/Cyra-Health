/* Every word the website shows goes through this register (docs/plans/website.md: "every sentence on the site is a public
   claim … record the app or backend file that makes it true"). A page asks for its text with t() / h() / attr(), naming
   the source; the register keeps { page, text, source } and site/build/claims.mjs prints them as
   docs/plans/website-claims.md. src/lib/site.test.mjs fails if a page shows text that is not in the register, or if a
   source names a file that does not exist.
   Source format: one or more "path note" entries joined by "; ". LABEL marks a name or heading that claims nothing. */

export const LABEL = "label";

export const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
export const escAttr = (s) => esc(s).replace(/"/g, "&quot;");
/** Visible text of an HTML fragment: tags out, entities back, spaces folded. */
export const plain = (html) => String(html).replace(/<[^>]+>/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

export function makeCopy(page) {
  const claims = [];
  const add = (text, source) => { if (!source) throw new Error(`[solia] no source for "${text}" on ${page}`); claims.push({ page, text: plain(text), source }); };
  return {
    page, claims,
    /** Plain text (often the app's own string) → escaped HTML. */
    t(text, source) { add(esc(text), source); return esc(text); },
    /** Authored HTML (inline tags allowed) → itself. */
    h(html, source) { add(html, source); return html; },
    /** Text for an attribute (alt, content, aria-label, title). */
    attr(text, source) { add(esc(text), source); return escAttr(text); },
  };
}
