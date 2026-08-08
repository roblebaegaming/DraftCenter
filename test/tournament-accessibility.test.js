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
    "Shuffle every seed?",
    "Lock registration and build the bracket?",
    "Archive this tournament?",
    "Confirm and advance this result?",
    "Reject this reported result?",
    "Save this result correction?",
  ]) assert.ok(ui.includes(label));
});

test("workspace controls and feedback expose names, landmarks, and live status", () => {
  assert.match(ui, /aria-label="Choose a bracket round"/);
  assert.match(ui, /aria-pressed=\{visibleRound === round\}/);
  assert.match(ui, /aria-controls=\{`tournament-round-panel-\$\{round\}`\}/);
  assert.match(ui, /scrollIntoView\(\{ behavior: "smooth", block: "nearest", inline: "start" \}\)/);
  assert.match(ui, /aria-label="Single-elimination bracket rounds"/);
  assert.match(ui, /className=\{visibleRound === round \? "is-selected" : ""\}/);
  assert.match(ui, /aria-labelledby=\{headingId\}/);
  assert.match(ui, /role="status" aria-live="polite"/);
  assert.match(ui, /<label>Replay URL/);
  assert.match(ui, /<label>MVP/);
  assert.match(ui, /<legend>Series score<\/legend>/);
});

test("small screens show one selected round while preserving every round on desktop", () => {
  assert.match(css, /@media\(max-width:700px\)[\s\S]*?\.tournament-rounds>section\{display:none/);
  assert.match(css, /\.tournament-rounds>section\.is-selected\{display:grid\}/);
  assert.match(css, /\.tournament-match-side strong\{min-width:0;overflow-wrap:anywhere\}/);
  assert.match(css, /\.tournament-round-picker\{display:flex;[^}]*overflow-x:auto/);
});
