import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  normalizePredictionBracketShareData,
  predictionBracketShareDimensions,
  predictionBracketShareFileName,
} from "../src/lib/predictionBracketShare.js";

const source = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const competitors = Array.from({ length: 8 }, (_, index) => ({
  id: `slot-${index + 1}`,
  displayName: `Trainer ${index + 1}`,
  countryCode: index % 2 ? "JP" : "US",
  sourceSeed: index + 1,
}));
const round = (number, names) => names.map(([a, b], index) => ({
  key: `r${number}-m${index + 1}`,
  match: index + 1,
  a: competitors[a],
  b: competitors[b],
  pickedId: competitors[a].id,
  result: { winner_id: competitors[b].id },
}));
const rounds = [
  round(1, [[0, 1], [2, 3], [4, 5], [6, 7]]),
  round(2, [[0, 2], [4, 6]]),
  round(3, [[0, 4]]),
];

test("prediction bracket exports use a readable social image and safe filename", () => {
  assert.deepEqual(predictionBracketShareDimensions(rounds), { width: 1920, height: 1350 });
  assert.equal(predictionBracketShareFileName("victory-road-san-francisco-2026", "Rob Lebae"), "draftcenter-victory-road-san-francisco-2026-rob-lebae.png");
});

test("prediction bracket export data requires a complete saved path", () => {
  const normalized = normalizePredictionBracketShareData({
    title: "Victory Road to San Francisco",
    bracketLabel: "Leaderboard #1",
    displayName: "Rob Lebae",
    rounds,
    roundPoints: { 1: 1, 2: 2, 3: 4 },
    choices: {},
    resultNames: Object.fromEntries(competitors.map(({ id, displayName }) => [id, displayName])),
    score: 0,
    maximumScore: 12,
    status: "final",
    publicUrl: "https://www.draftcentral.gg/worlds/2026/vgc/victory-road-to-san-francisco",
  });
  assert.equal(normalized.rounds.length, 3);
  assert.equal(normalized.rounds[0][0].resultWinnerName, "Trainer 2");
  assert.equal(normalized.publicUrl, "www.draftcentral.gg/worlds/2026/vgc/victory-road-to-san-francisco");
  const incomplete = rounds.map((currentRound) => currentRound.map((match) => ({ ...match })));
  incomplete[2][0].pickedId = null;
  assert.throws(() => normalizePredictionBracketShareData({ rounds: incomplete }), /Finish the bracket/);
});

test("the bracket challenge exposes private-safe PNG downloads", () => {
  const component = source("src/components/BracketChallenge.jsx");
  const download = source("src/components/PredictionBracketDownload.jsx");
  const image = source("src/lib/predictionBracketShare.js");
  const css = source("src/app/globals.css");
  assert.match(component, /Download my bracket/);
  assert.match(component, /Original Top 16 bracket/);
  assert.match(component, /Leaderboard #\$\{viewedEntry\.rank\}/);
  assert.match(download, /Download bracket PNG/);
  assert.match(download, /window\.location\.href/);
  assert.doesNotMatch(download, /fetch\(|supabase|account|user_id/);
  assert.match(image, /canvas\.toBlob/);
  assert.match(image, /SAVED PICK/);
  assert.match(image, /OFFICIAL WINNER/);
  assert.match(css, /\.worlds-bracket-download/);
});
