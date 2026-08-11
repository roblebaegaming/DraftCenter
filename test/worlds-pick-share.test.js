import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  normalizeWorldsSharePicks,
  WORLDS_SHARE_CARD_HEIGHT,
  WORLDS_SHARE_CARD_WIDTH,
  worldsShareFileName,
  worldsSharePath,
} from "../src/lib/worldsPickShare.js";

const source = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const picks = Array.from({ length: 10 }, (_, index) => ({
  slug: `trainer-${index + 1}`,
  displayName: `Trainer ${index + 1}`,
  countryCode: index % 2 ? "JP" : "US",
  qualificationRegion: index % 2 ? "Japan" : "North America",
}));

test("Worlds share cards require a complete unique Pick 10 and included champion", () => {
  const normalized = normalizeWorldsSharePicks(picks, "trainer-4");
  assert.equal(normalized.length, 10);
  assert.equal(normalized[3].displayName, "Trainer 4");
  assert.throws(() => normalizeWorldsSharePicks(picks.slice(0, 9), "trainer-4"), /Choose all 10 picks/);
  assert.throws(() => normalizeWorldsSharePicks([...picks.slice(0, 9), picks[0]], "trainer-4"), /duplicate picks/);
  assert.throws(() => normalizeWorldsSharePicks(picks, "trainer-11"), /Choose Your Champion/);
});

test("Worlds share filenames stay on reviewed individual disciplines", () => {
  assert.equal(WORLDS_SHARE_CARD_WIDTH, 1080);
  assert.equal(WORLDS_SHARE_CARD_HEIGHT, 1350);
  assert.equal(worldsSharePath("vgc"), "/worlds/2026/vgc");
  assert.equal(worldsShareFileName("tcg"), "draftcenter-2026-worlds-tcg-pick-10.png");
  assert.throws(() => worldsSharePath("unite"), /cannot create an individual Pick 10 card/);
});

test("the reusable Pick 10 UI offers one honest download action", () => {
  const picker = source("src/components/WorldsPickSixteen.jsx");
  const share = source("src/components/WorldsPickShare.jsx");
  const card = source("src/lib/worldsPickShare.js");
  const css = source("src/app/globals.css");
  assert.match(picker, /<WorldsPickShare/);
  assert.match(picker, /picks=\{selected\.map\(\(slug\) => competitorBySlug\.get\(slug\)\)\.filter\(Boolean\)\}/);
  assert.match(share, /Share your picks/);
  assert.match(share, /Choose your top \{pickCount\}, then choose your champion\./);
  assert.doesNotMatch(share, /Finish all \{pickCount\} spots|choose Your Champion first/);
  assert.equal((share.match(/<button/g) || []).length, 1);
  assert.match(share, /busy === "download" \? "Downloading\\u2026" : "Download"/);
  assert.doesNotMatch(share, /Instagram|Twitter|navigator\.share|navigator\.canShare|window\.open/);
  assert.match(share, /Sharing is public and does not save your entry/);
  assert.doesNotMatch(share, /Share to Instagram or apps|Download \+ share on X \/ Twitter|social card|social image/);
  assert.match(card, /canvas\.width = WORLDS_SHARE_CARD_WIDTH/);
  assert.match(card, /canvas\.height = WORLDS_SHARE_CARD_HEIGHT/);
  assert.match(card, /YOUR CHAMPION \\u00d72/);
  assert.match(card, /Unofficial fan prediction/);
  assert.match(css, /\.worlds-pick-share-actions \{ display: flex; min-width: 160px/);
  assert.doesNotMatch(css, /\.worlds-pick-share-actions \{[^}]*repeat\(3/);
});
