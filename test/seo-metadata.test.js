import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function source(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("page titles rely on the root template for the DraftCenter brand suffix", () => {
  const layout = source("src/app/layout.js");
  assert.match(layout, /template: "%s \| DraftCenter"/);

  for (const path of [
    "src/app/leagues/page.js",
    "src/app/resources/page.js",
    "src/app/legal/page.js",
    "src/app/operations/league/[id]/page.js",
  ]) {
    assert.doesNotMatch(source(path), /title:\s*["'`][^"'`]*\|\s*DraftCent(?:er|ral)["'`]/);
  }
});

test("sitemap contains only indexable routes and truthful modification dates", () => {
  const sitemap = source("src/app/sitemap.js");
  assert.doesNotMatch(sitemap, /\["\/support"/);
  assert.match(sitemap, /AUTHORED_CONTENT_LAST_MODIFIED/);
  assert.doesNotMatch(sitemap, /lastModified:\s*new Date\(\)/);
  assert.match(sitemap, /league\.updated_at \? \{ lastModified: new Date\(league\.updated_at\) \} : \{\}/);
  assert.match(sitemap, /POKEMON_TYPES\.map/);
  assert.match(sitemap, /POKEMON_GENERATIONS\.map/);
});

test("Pokémon profiles have crawlable indexes and complete core facts", () => {
  const pokemonHome = source("src/app/pokemon/page.js");
  const profile = source("src/app/pokemon/[name]/page.js");
  const azIndex = source("src/app/pokemon/a-z/page.js");
  const typeIndex = source("src/app/pokemon/type/[type]/page.js");
  const generationIndex = source("src/app/pokemon/generation/[generation]/page.js");
  const pokemonIndexData = source("src/lib/publicPokemonIndex.js");
  const sitemap = source("src/app/sitemap.js");

  assert.match(pokemonHome, /href="\/pokemon\/a-z"/);
  assert.match(pokemonHome, /href="\/pokemon\/types"/);
  assert.match(pokemonHome, /href="\/pokemon\/generations"/);
  assert.match(azIndex, /href={`\/pokemon\/\$\{name\}`}/);
  assert.match(typeIndex, /href={`\/pokemon\/\$\{name\}`}/);
  assert.match(generationIndex, /href={`\/pokemon\/\$\{name\}`}/);
  assert.match(profile, /Base stat total/);
  assert.match(profile, /formatHeight\(pokemon\.height\)/);
  assert.match(profile, /formatWeight\(pokemon\.weight\)/);
  assert.match(profile, /Sources and methodology/);
  assert.match(profile, /https:\/\/pokeapi\.co\//);
  assert.match(profile, /pokemon\.species\?\.name/);
  assert.match(profile, /pokemon-form\/\$\{formName\}/);
  assert.match(profile, /forms and varieties/);
  assert.match(profile, /Cosmetic appearances/);
  assert.match(sitemap, /getAllPokemonProfiles/);
  assert.match(pokemonIndexData, /pokemonProfileSlugForSpecies/);
  assert.match(pokemonIndexData, /zygarde:\s*"zygarde-50"/);
});

test("the cornerstone draft guide covers the full season and links to next steps", () => {
  const content = source("src/lib/seoContent.js");
  const guidePage = source("src/app/guides/[slug]/page.js");

  assert.match(content, /Draft League Guide: Rules, Drafting, Weekly Matches, and Playoffs/);
  assert.match(content, /Prepare for a different matchup each week/);
  assert.match(content, /Use clear standings and tiebreakers/);
  assert.match(content, /\/guides\/snake-vs-auction-pokemon-draft/);
  assert.match(content, /\/manuals\/commissioner/);
  assert.match(guidePage, /Continue your draft-league research/);
  assert.match(guidePage, /guide\.links\.map/);
});
