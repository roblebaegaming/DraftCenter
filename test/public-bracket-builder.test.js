import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  PUBLIC_BRACKET_CARD_STYLES,
  PUBLIC_BRACKET_FONTS,
  PUBLIC_BRACKET_SIZES,
  PUBLIC_BRACKET_THEMES,
  buildPublicBracketRounds,
  choosePublicBracketWinner,
  createPublicBracketEntrants,
  parsePublicBracketNames,
  publicBracketRoundLabel,
} from "../src/lib/publicBracketBuilder.js";

const source = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

function namedEntrants(size) {
  return createPublicBracketEntrants(size).map((entrant, index) => ({ ...entrant, name: `Competitor ${index + 1}` }));
}

function completeBracket(size, entrants) {
  let picks = {};
  for (let round = 1; round <= Math.log2(size); round += 1) {
    const matches = buildPublicBracketRounds({ size, entrants, picks }).rounds[round - 1];
    for (const match of matches) {
      picks = choosePublicBracketWinner({ size, entrants, picks, round, match: match.match, winnerId: match.a.id });
    }
  }
  return buildPublicBracketRounds({ size, entrants, picks });
}

test("the free studio supports four practical bracket sizes and curated design choices", () => {
  assert.deepEqual(PUBLIC_BRACKET_SIZES, [4, 8, 16, 32]);
  assert.equal(PUBLIC_BRACKET_THEMES.length, 3);
  assert.equal(PUBLIC_BRACKET_FONTS.length, 3);
  assert.equal(PUBLIC_BRACKET_CARD_STYLES.length, 3);
  assert.equal(publicBracketRoundLabel(32, 1), "Round of 32");
  assert.equal(publicBracketRoundLabel(8, 1), "Quarterfinals");
  assert.equal(publicBracketRoundLabel(4, 2), "Final");
});

test("winner choices flow through every round to one champion", () => {
  const entrants = namedEntrants(8);
  const bracket = completeBracket(8, entrants);
  assert.equal(bracket.rounds.length, 3);
  assert.equal(Object.keys(bracket.picks).length, 7);
  assert.equal(bracket.champion.id, "entrant-1");
  assert.equal(bracket.champion.name, "Competitor 1");
});

test("changing an early result removes downstream picks that no longer fit", () => {
  const entrants = namedEntrants(8);
  const completed = completeBracket(8, entrants);
  const picks = choosePublicBracketWinner({ size: 8, entrants, picks: completed.picks, round: 1, match: 1, winnerId: "entrant-2" });
  assert.equal(picks["r1-m1"], "entrant-2");
  assert.equal(picks["r2-m1"], undefined);
  assert.equal(picks["r3-m1"], undefined);
  assert.equal(Object.keys(picks).length, 5);
});

test("bulk entry accepts numbered lists, trims blanks, and respects bracket capacity", () => {
  const entrants = parsePublicBracketNames("1. Alpha\n\n2) Beta\n3 - Gamma\n4. Delta\n5. Extra", 4);
  assert.deepEqual(entrants.map((entrant) => entrant.name), ["Alpha", "Beta", "Gamma", "Delta"]);
  assert.deepEqual(entrants.map((entrant) => entrant.id), ["entrant-1", "entrant-2", "entrant-3", "entrant-4"]);
});

test("the public builder remains a local download tool without an account or server save", () => {
  const component = source("src/components/PublicBracketBuilder.jsx");
  const image = source("src/lib/publicBracketImage.js");
  const page = source("src/app/tools/bracket-builder/page.js");
  const predictions = source("src/app/tournaments/predictions/page.js");
  const navigation = source("src/components/SiteQuickLinks.jsx");
  assert.match(component, /window\.localStorage/);
  assert.match(component, /downloadPublicBracketPng/);
  assert.match(component, /does not upload your names or create a public URL/i);
  assert.doesNotMatch(component, /createClient|supabase|fetch\(/i);
  assert.doesNotMatch(component, /stripe|checkoutSession|priceId|subscribe\(/i);
  assert.match(image, /canvas\.toBlob/);
  assert.match(image, /image\/png/);
  assert.match(page, /no account required/i);
  assert.match(page, /isAccessibleForFree: true/);
  assert.match(predictions, /href="\/tools\/bracket-builder"/);
  assert.match(navigation, /href="\/tools\/bracket-builder"[^>]*aria-label="Bracket Studio"/);
  assert.match(navigation, /site-nav-label-wide">Bracket Studio<\/span>/);
});
