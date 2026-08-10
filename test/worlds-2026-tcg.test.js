import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const source = (file) => fs.readFileSync(path.join(root, file), "utf8");
const registry = JSON.parse(source("src/data/worlds-2026-tcg-masters-sources.json"));

test("the TCG source registry is Masters-only and remains fail-closed", () => {
  assert.equal(registry.eventId, "2026-tcg-masters");
  assert.equal(registry.division, "Masters");
  assert.equal(registry.ageScope, "official-masters-division-not-age-verified");
  assert.equal(registry.rosterReady, false);
  assert.equal(registry.rosterStatus, "source-reconciliation");
});

test("the official 2026 TCG Championship Point cutoffs total 425 Masters slots", () => {
  const slots = registry.qualificationRules.championshipPointSlots;
  assert.equal(slots.length, 5);
  assert.equal(slots.reduce((total, zone) => total + zone.slots, 0), 425);
  assert.equal(registry.qualificationRules.championshipPointSlotTotal, 425);
  assert.deepEqual(slots.map((zone) => zone.slots), [135, 135, 125, 20, 10]);
  assert.equal(new Set(slots.map((zone) => zone.ratingZone)).size, slots.length);
});

test("the TCG audit includes direct invites and every separately managed program", () => {
  assert.deepEqual(registry.qualificationRules.directInvitePaths, [
    "Special Championships winners",
    "Regional Championships winners",
    "International Championships Top 4",
    "2025 World Championships Top 4",
  ]);
  assert.equal(registry.qualificationRules.directInvitesPassDown, false);
  assert.deepEqual(registry.separatePrograms.map((item) => item.program), [
    "Japan",
    "South Korea",
    "Mainland China",
    "Asia-Pacific",
  ]);
});

test("the TCG setup page keeps picks closed and explains the agreed scoring", () => {
  const component = source("src/components/WorldsTcgPickSixteenSetup.jsx");
  const page = source("src/app/worlds/2026/tcg/page.js");
  assert.match(component, /Champion: 30 points\. Ace Pick: ×2\./);
  assert.match(component, /choose 16 TCG Masters competitors/);
  assert.match(component, /Junior and Senior competitors stay out of this pool/);
  assert.match(component, /Masters is not an adult-only guarantee/);
  assert.match(component, /no competitor cards, picks, or saved entries will appear/);
  assert.match(component, /WORLDS_2026_SCORING/);
  assert.match(page, /robots: \{ index: false, follow: true \}/);
  assert.doesNotMatch(page, /WorldsPickSixteen/);
  assert.doesNotMatch(component, /save_worlds_pick_entry/);
});
