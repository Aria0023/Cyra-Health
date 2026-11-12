/* The legal pages in public/legal/ (docs/legal/README.md): drafts stay unpublishable until filled in, every link
   between them works, the clauses the stores and California require are present, and no page makes a promise the
   build can't keep. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "public");
const DIR = join(ROOT, "legal");
const PAGES = readdirSync(DIR).filter((f) => f.endsWith(".html"));
const read = (f) => readFileSync(join(DIR, f), "utf8");
const text = (html) => html.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ");

test("the five legal pages exist", () => {
  assert.deepEqual([...PAGES].sort(), ["health-data.html", "index.html", "medical-disclaimer.html", "privacy.html", "terms.html"]);
});

test("a page with an unfilled placeholder or a draft notice is marked draft and kept out of search engines", () => {
  for (const f of PAGES) {
    const h = read(f);
    const unfilled = h.includes('class="ph"');
    const draft = /class="draft"/.test(h);
    if (unfilled) assert.ok(draft, `${f}: placeholders without the draft notice`);
    if (unfilled || draft) assert.match(h, /<meta name="robots" content="noindex, nofollow">/, `${f}: a draft must be noindex`);
  }
});

test("every page is a complete, accessible document", () => {
  for (const f of PAGES) {
    const h = read(f);
    assert.match(h, /^<!doctype html>/i, f);
    assert.match(h, /<html lang="en">/, f);
    assert.match(h, /<meta name="viewport"/, f);
    assert.match(h, /<title>[^<]+· Solia Health<\/title>/, f);
    assert.match(h, /<main id="content">/, f);
    assert.equal((h.match(/<h1>/g) || []).length, 1, `${f}: one h1`);
    assert.match(h, /class="skip" href="#content"/, f);
  }
});

test("every internal link and anchor resolves", () => {
  for (const f of PAGES) {
    const h = read(f);
    for (const [, href] of h.matchAll(/href="([^"]+)"/g)) {
      if (/^https?:|^mailto:/.test(href)) continue;
      if (href.startsWith("#")) { assert.ok(h.includes(`id="${href.slice(1)}"`), `${f}: missing anchor ${href}`); continue; }
      const p = href.split("#")[0];
      if (p === "/") continue; // the app itself
      assert.ok(existsSync(join(ROOT, p)), `${f}: broken link ${href}`);
    }
  }
});

test("the Terms carry the protections and the disclosures the stores and California require", () => {
  const t = text(read("terms.html"));
  for (const must of [
    /not a medical device/i, /Do not rely on the Service to prevent pregnancy/, /call 911/, /988/,
    /AI output can be inaccurate/, /cannot see, recover or restore your log/,
    /Pro subscriptions renew automatically/, /until you cancel/, /Settings → your name → Subscriptions/, /Payments & subscriptions/,
    /free trial/i, /Tips are voluntary/,
    /"AS IS"/, /FIFTY U\.S\. DOLLARS/, /indemnify/, /Civil Code section 1542/,
    /individual arbitration/, /CLASS-ACTION AND JURY WAIVER|Class-action and jury waiver/i, /opt out of this agreement to arbitrate/, /within 30 days/, /Mass filings/, /public injunctive relief/,
    /Federal Arbitration Act/, /State of California/, /1789\.3/, /\(800\) 952-5210/,
    /Apple and Apple's subsidiaries are third-party beneficiaries/, /maintenance and support/, /terrorist supporting/,
    /Digital Millennium Copyright Act/,
  ]) assert.match(t, must, String(must));
});

test("the privacy pages say what the build does and promise nothing it can't keep", () => {
  const p = text(read("privacy.html")), h = text(read("health-data.html"));
  for (const must of [/never sell/i, /Global Privacy Control/, /Health Breach Notification Rule/, /Confidentiality of Medical Information Act/, /RevenueCat/, /Anthropic/, /Render/, /50 contributions/, /365 days/]) assert.match(p, must, String(must));
  for (const must of [/RCW 19\.373/, /withdraw your consent/i, /appeal/i, /do not sell consumer health data/i, /geofences/]) assert.match(h, must, String(must));
  for (const f of PAGES) {
    const s = text(read(f));
    for (const bad of [/HIPAA[- ]compliant/i, /100% (secure|safe|private)/i, /can(not|'t) be hacked/i, /guarantee(s|d)? (the )?(security|privacy)/i, /FDA[- ](approved|cleared)/i, /SOC ?2/i])
      assert.ok(!bad.test(s.replace(/cannot guarantee the security/gi, "")), `${f}: ${bad}`);
  }
});
