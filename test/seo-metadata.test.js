import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { GUIDES, relatedFormatsBySlug } from "../src/lib/seoContent.js";
import { pokemonDirectoryFragment, pokemonDirectoryHref } from "../src/lib/pokemonNavigation.js";
import { pokemonProfileCanonicalPath, pokemonProfileSlugForName } from "../src/lib/publicPokemonIndex.js";

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

test("resources targets competitive Pokémon resource searches", () => {
  const page = source("src/app/resources/page.js");
  const resources = source("src/components/ResourcesPage.jsx");

  assert.match(page, /title: "Competitive Pokémon Resources"/);
  assert.match(page, /competitive Pokémon resources/);
  assert.match(page, /canonical: "\/resources"/);
  assert.match(resources, /<h1>Competitive Pokémon Resources<\/h1>/);
});

test("sitemap contains only indexable routes and truthful modification dates", () => {
  const sitemap = source("src/app/sitemap.js");
  assert.doesNotMatch(sitemap, /\["\/support"/);
  assert.match(sitemap, /AUTHORED_CONTENT_LAST_MODIFIED/);
  assert.doesNotMatch(sitemap, /lastModified:\s*new Date\(\)/);
  assert.match(sitemap, /league\.updated_at \? \{ lastModified: new Date\(league\.updated_at\) \} : \{\}/);
  assert.match(sitemap, /POKEMON_TYPES\.map/);
  assert.match(sitemap, /POKEMON_GENERATIONS\.map/);
  assert.match(sitemap, /\["\/about", "monthly", 0\.7\]/);
});

test("the Nuzlocke generator is crawlable, internally linked, and uses current product language", () => {
  const page = source("src/app/nuzlocke/page.js");
  const lab = source("src/components/NuzlockeLab.jsx");
  const pokemonHome = source("src/app/pokemon/page.js");
  const resources = source("src/components/ResourcesPage.jsx");
  const sitemap = source("src/app/sitemap.js");

  assert.match(page, /Pokémon Nuzlocke Team Generator by Game/);
  assert.match(page, /"@type": "WebApplication"/);
  assert.match(page, /"@type": "BreadcrumbList"/);
  assert.match(page, /draft one Pokémon from every eligible route or area/);
  assert.match(page, /team size of up to 20/);
  assert.match(page, /download a readable Run Card/);
  assert.match(page, /randomizer seed/);
  assert.match(page, /type, official Pokédex color, or evolution stage/);
  assert.match(page, /Equal weighting gives every eligible encounter the same chance/);
  assert.match(lab, /pokemonProfileSlugForName\(entry\.pokemon_name\)/);
  assert.match(lab, /href={`\/pokemon\/\$\{profileSlug\}`}/);
  assert.match(pokemonHome, /href="\/nuzlocke">Build a Nuzlocke Draft/);
  assert.match(resources, /href="\/nuzlocke"/);
  assert.match(sitemap, /\["\/nuzlocke", "weekly", 0\.9\]/);
  assert.doesNotMatch(page, /Build a seeded Run Card/);
});

test("the complete Nuzlocke game-guide library is indexable and internally connected", () => {
  const page = source("src/app/nuzlocke/[game]/page.js");
  const landing = source("src/app/nuzlocke/page.js");
  const directory = source("src/app/nuzlocke/guides/page.js");
  const sitemap = source("src/app/sitemap.js");
  const llms = source("src/app/llms.txt/route.js");
  assert.match(page, /generateStaticParams/);
  assert.match(page, /"@type": "Article"/);
  assert.match(page, /"@type": "BreadcrumbList"/);
  assert.match(page, /alternates: \{ canonical: `\/nuzlocke\/\$\{guide\.slug\}` \}/);
  assert.match(page, /What you can plan with this guide/);
  assert.match(page, /All \{guide\.displayName\} encounter areas/);
  assert.match(page, /encountersForArea\(area\)/);
  assert.match(page, /nuzlocke-guide-method-label/);
  assert.doesNotMatch(page, /nuzlocke-guide-method-list/);
  assert.match(page, /guide\.generatorHref/);
  assert.match(landing, /href="\/nuzlocke\/guides"/);
  assert.match(directory, /title: "Pokémon Nuzlocke Guides by Game"/);
  assert.match(directory, /canonical: "\/nuzlocke\/guides"/);
  assert.match(directory, /<h1>Pokémon Nuzlocke Guides<\/h1>/);
  assert.match(directory, /"@type": "CollectionPage"/);
  assert.match(directory, /"@type": "ItemList"/);
  assert.match(directory, /guideCatalog\.games\.map/);
  assert.match(sitemap, /\["\/nuzlocke\/guides", "monthly", 0\.9\]/);
  assert.match(sitemap, /nuzlockeGameGuides\.games\.map/);
  assert.match(llms, /\/nuzlocke\/guides/);
  for (const slug of ["fire-red", "emerald", "platinum", "scarlet"]) assert.match(llms, new RegExp(`/nuzlocke/${slug}`));
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
  assert.match(pokemonIndexData, /pokemonProfileSlugCandidates/);
  assert.match(pokemonIndexData, /galarian:\s*"galar"/);
  assert.match(pokemonIndexData, /pokemonProfileSlugForName/);
  assert.match(profile, /permanentRedirect\(pokemonProfileCanonicalPath\(data\.pokemon\.name\)\)/);
  assert.match(profile, /pokemonProfileSlugForName\(teammate\.pokemon, availableProfiles\)/);
});

test("reader-friendly Pokémon names resolve to live canonical profiles", () => {
  const profiles = new Set(["urshifu-single-strike", "shaymin-land", "landorus-incarnate", "moltres-galar", "charizard-mega-x", "chandelure"]);
  assert.equal(pokemonProfileSlugForName("Urshifu", profiles), "urshifu-single-strike");
  assert.equal(pokemonProfileSlugForName("Shaymin", profiles), "shaymin-land");
  assert.equal(pokemonProfileSlugForName("Landorus", profiles), "landorus-incarnate");
  assert.equal(pokemonProfileSlugForName("Galarian Moltres", profiles), "moltres-galar");
  assert.equal(pokemonProfileSlugForName("Mega Charizard X", profiles), "charizard-mega-x");
  assert.equal(pokemonProfileSlugForName("Mega Chandelure", profiles), "chandelure");
});

test("interactive Pokédex selection uses fragments and preserves legacy entry points", () => {
  const directory = source("src/components/PokemonDirectory.jsx");
  const profile = source("src/app/pokemon/[name]/page.js");
  const trainerDex = source("src/components/TrainerDexPage.jsx");

  assert.equal(pokemonDirectoryFragment("Mega Charizard X"), "mega-charizard-x");
  assert.equal(pokemonDirectoryHref("Farfetch’d"), "/pokemon#farfetch-d");
  assert.match(directory, /window\.location\.hash/);
  assert.match(directory, /url\.searchParams\.delete\("pokemon"\)/);
  assert.match(directory, /window\.history\.replaceState/);
  assert.match(profile, /pokemonDirectoryHref\(displayName\)/);
  assert.match(trainerDex, /pokemonDirectoryHref\(entry\.pokemon\)/);
  assert.doesNotMatch(`${directory}\n${profile}\n${trainerDex}`, /\/pokemon\?pokemon=/);
});

test("Pokémon form canonical policy stays conservative and documented", () => {
  const policy = source("docs/pokemon-profile-canonical-policy.md");
  const profile = source("src/app/pokemon/[name]/page.js");

  for (const name of ["pikachu", "moltres-galar", "charizard-mega-x", "rotom-wash", "miraidon-low-power-mode"]) {
    assert.equal(pokemonProfileCanonicalPath(name), `/pokemon/${name}`);
  }
  assert.equal(pokemonProfileCanonicalPath("farfetchd"), "/pokemon/farfetchd");
  assert.equal(pokemonProfileSlugForName("Farfetch’d", new Set(["farfetchd"])), "farfetchd");
  assert.match(profile, /pokemonProfileCanonicalPath\(data\.pokemon\.name\)/);
  assert.match(profile, /permanentRedirect\(pokemonProfileCanonicalPath\(data\.pokemon\.name\)\)/);
  assert.match(policy, /is_default: false.*not enough evidence/);
  assert.match(policy, /Cosmetic appearances/);
  assert.match(policy, /materially distinct battle identity/);
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
  assert.match(content, /GUIDE_PUBLISHED_DATE/);
  assert.match(content, /GUIDE_UPDATED_DATE/);
  assert.equal((content.match(/answer:\s*"/g) || []).length, 6);
  assert.match(guidePage, /SHORT ANSWER/);
  assert.match(guidePage, /Written and reviewed by the/);
  assert.match(guidePage, /datePublished: GUIDE_PUBLISHED_DATE/);
  assert.match(guidePage, /dateModified: GUIDE_UPDATED_DATE/);
  assert.match(guidePage, /about#data-methodology/);
  assert.equal(GUIDES["how-to-run-pokemon-draft-league"].seoTitle, "How to Run a Pokémon Draft League");
  assert.equal(GUIDES["pokemon-draft-league-rules-template"].seoTitle, "Pokémon Draft League Rules Template");
  assert.match(guidePage, /guide\.seoTitle \|\| guide\.title/);
  for (const guide of Object.values(GUIDES)) {
    assert.ok(guide.links.length >= 3, `${guide.title} should expose at least three related links`);
    assert.ok(guide.links.every(([, href]) => href.startsWith("/")), `${guide.title} related links should remain internal`);
  }
});

test("public templates expose useful server-rendered headings and related links", () => {
  const authGate = source("src/components/AuthGate.jsx");
  const directory = source("src/components/PokemonDirectory.jsx");
  const profile = source("src/app/pokemon/[name]/page.js");
  const formatPage = source("src/app/formats/[slug]/page.js");

  assert.match(authGate, /function PublicLoadingShell/);
  assert.match(authGate, /<h1>Your Draft League Headquarters<\/h1>/);
  assert.match(directory, /fallback=.*<h1>Explore the Pokédex<\/h1>/);
  assert.match(profile, /Related \{displayName\} research/);
  assert.match(formatPage, /Related Pokémon draft formats/);
  for (const slug of ["national-dex", "reg-mb", "swsh-series9", "custom"]) {
    const related = relatedFormatsBySlug(slug);
    assert.equal(related.length, 3);
    assert.ok(related.every((format) => format.slug !== slug));
  }
});

test("AI discovery foundation exposes a trustworthy entity and reference index", () => {
  const layout = source("src/app/layout.js");
  const about = source("src/app/about/page.js");
  const llms = source("src/app/llms.txt/route.js");
  const footer = source("src/components/SiteLegalFooter.jsx");
  const content = source("src/lib/seoContent.js");

  assert.match(layout, /"@type": "Organization"/);
  assert.match(layout, /publishingPrinciples/);
  assert.doesNotMatch(layout, /"@type": "WebApplication"/);
  assert.match(about, /What is DraftCenter\?/);
  assert.match(about, /id="data-methodology"/);
  assert.match(about, /id="editorial-standards"/);
  assert.match(about, /confirmed match results/);
  assert.match(footer, /href="\/about"/);
  assert.match(llms, /Content-Type": "text\/plain; charset=utf-8"/);
  assert.match(llms, /Pokémon Draft League Rules Template/);
  assert.match(llms, /Private queues/);
  assert.match(content, /national-gen\$\{generation\}/);
});
