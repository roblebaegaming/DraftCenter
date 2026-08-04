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

test("the guide collection explains real DraftCenter workflows in a human voice", () => {
  const content = source("src/lib/seoContent.js");
  const guidePage = source("src/app/guides/[slug]/page.js");
  const copyBlock = source("src/components/GuideCopyBlock.jsx");
  const templates = source("src/lib/guideTemplates.js");

  assert.match(content, /If you are new to draft leagues/);
  assert.match(content, /How to Run a .* Draft League: A Commissioner/);
  assert.match(content, /Snake or Auction\? Choosing Your .* Draft Style/);
  assert.match(content, /Tier List That Fits Your League/);
  assert.match(content, /DraftCenter's live draft room/);
  assert.match(content, /Commissioner Launch Checklist/);
  assert.match(content, /Pricing Template/);
  assert.match(content, /Practice league/);
  assert.match(content, /\/guides\/snake-vs-auction-pokemon-draft/);
  assert.match(content, /\/manuals\/commissioner/);
  assert.match(guidePage, /How this works in DraftCenter/);
  assert.match(guidePage, /Where to go next/);
  assert.match(guidePage, /guide-feature-callout/);
  assert.match(guidePage, /guide\.links\.map/);
  assert.match(content, /how-to-join-first-pokemon-draft-league/);
  assert.match(content, /pokemon-draft-league-rules-template/);
  assert.match(content, /Before you commit to your first team/);
  assert.match(content, /POKEMON_DRAFT_LEAGUE_RULES_TEMPLATE/);
  assert.match(guidePage, /GuideCopyBlock/);
  assert.match(guidePage, /guide\.checklist\.map/);
  assert.match(copyBlock, /navigator\.clipboard\.writeText/);
  assert.match(copyBlock, /Copy the rules template/);
  assert.match(templates, /MISSED PICK PROCEDURE/i);
  assert.match(templates, /ACTIVITY AND REPLACEMENTS/);
  assert.match(templates, /CONDUCT, RULINGS, AND APPEALS/);
});
