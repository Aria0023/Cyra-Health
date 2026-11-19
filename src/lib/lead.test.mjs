import test from "node:test";
import assert from "node:assert/strict";
import { splitLead, LEAD_MAX } from "./lead.js";

test("the first of several sentences is the lead, and nothing is lost", () => {
  const s = "One tap is enough. It doesn't need to be a full check-in.";
  const [lead, rest] = splitLead(s);
  assert.equal(lead, "One tap is enough.");
  assert.equal(lead + rest, s);
});
test("decimals and abbreviations don't end a sentence", () => {
  assert.equal(splitLead("Your temperature rose 0.3 degrees this week. Worth a note.")[0], "Your temperature rose 0.3 degrees this week.");
  assert.equal(splitLead("Try something small, e.g. A short walk. Then rest.")[0], "");
});
test("a long first sentence is not made bold", () => {
  const long = `${"word ".repeat(30).trim()}. Then more.`;
  assert.ok(long.indexOf(".") > LEAD_MAX);
  assert.deepEqual(splitLead(long), ["", long]);
});
test("one sentence: a label before a colon, else a short opening clause, else nothing", () => {
  assert.equal(splitLead("Worth asking: could this be linked to sleep?")[0], "Worth asking:");
  assert.equal(splitLead("After a rough night, slow breathing is linked with feeling calmer in small studies")[0], "After a rough night,");
  assert.deepEqual(splitLead("See what has been showing up lately."), ["", "See what has been showing up lately."]);
});
test("anything that isn't text is passed through", () => {
  const node = { a: 1 };
  assert.deepEqual(splitLead(node), ["", node]);
  assert.deepEqual(splitLead(""), ["", ""]);
});
