import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const ui = fs.readFileSync(new URL("../src/components/TournamentWorkspace.jsx", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");

test("sensitive tournament actions use the accessible in-page confirmation dialog", () => {
  assert.doesNotMatch(ui, /window\.confirm/);
  assert.match(ui, /<dialog/);
  assert.match(ui, /dialog\.showModal\(\)/);
  assert.match(ui, /aria-modal="true"/);
  assert.match(ui, /aria-labelledby=\{titleId\}/);
  assert.match(ui, /aria-describedby=\{descriptionId\}/);
  assert.match(ui, /onCancel=/);
  assert.match(ui, /cancelRef\.current\?\.focus\(\)/);
  for (const label of [
    "Lock registration and build the bracket?",
    "Archive this tournament?",
    "Permanently delete this tournament?",
    "Confirm and advance this result?",
    "Reject this reported result?",
    "Save this result correction?",
  ]) assert.ok(ui.includes(label));
  assert.match(ui, /Type <strong>\{request\.confirmText\}<\/strong> to confirm/);
  assert.match(ui, /disabled=\{working \|\| !confirmationMatches\}/);
  assert.match(ui, /role="tablist" aria-label="Tournament view"/);
  assert.match(ui, /role="tab" aria-selected=\{isOperatorMode\}/);
});

test("workspace controls and feedback expose names, landmarks, and live status", () => {
  assert.match(ui, /aria-label="Choose a bracket round"/);
  assert.match(ui, /aria-pressed=\{visibleRound === group\.key\}/);
  assert.match(ui, /scrollIntoView\(\{ behavior: "smooth", block: "nearest", inline: "start" \}\)/);
  assert.match(ui, /aria-label=\{`\$\{displayFormat\} bracket round`\}/);
  assert.match(ui, /className="is-selected"/);
  assert.match(ui, /aria-labelledby=\{headingId\}/);
  assert.match(ui, /role="status" aria-live="polite"/);
  assert.match(ui, /<label>Replay URL/);
  assert.match(ui, /<label>MVP/);
  assert.match(ui, /<legend>Series score<\/legend>/);
  assert.match(ui, /aria-labelledby="tournament-field-manager-heading"/);
  assert.match(ui, /aria-label="Current tournament field"/);
  assert.match(ui, /<label>Practice entry label/);
  assert.match(ui, /<label>How many/);
});

test("large fields mount one selected, paged round at a time", () => {
  assert.match(ui, /visibleGroup\.matches\.map/);
  assert.match(ui, /Page \{matchPage\.page\} of \{matchPage\.total_pages\}/);
  assert.match(ui, /MATCH_PAGE_SIZE = 64/);
  assert.match(css, /\.tournament-rounds>section\.is-selected\{[^}]*grid-template-columns:repeat\(auto-fill/);
  assert.match(css, /\.tournament-match-side strong\{min-width:0;overflow-wrap:anywhere\}/);
  assert.match(css, /\.tournament-round-picker\{display:flex;[^}]*overflow-x:auto/);
});
