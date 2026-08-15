import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { GUIDES, relatedFormatsBySlug } from "../src/lib/seoContent.js";
import { pokemonDirectoryFragment, pokemonDirectoryHref } from "../src/lib/pokemonNavigation.js";
import { pokemonProfileCanonicalPath, pokemonProfileDisplayName, pokemonProfileSlugForName, pokemonRouteSlug } from "../src/lib/publicPokemonIndex.js";

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

test("tournament discovery reflects every released event format without indexing workspaces", () => {
  const page = source("src/app/tournaments/page.js");
  const directory = source("src/components/TournamentDirectory.jsx");
  const tournamentWorkspace = source("src/app/tournaments/[slug]/page.js");
  const organizations = source("src/app/organizations/page.js");
  const organizationDetail = source("src/app/organizations/[slug]/page.js");
  const policy = source("docs/public-indexing-policy.md");
  const sitemap = source("src/app/sitemap.js");

  assert.match(page, /title: "Pokémon Tournament Organizer & Draft Events"/);
  assert.match(page, /canonical: "\/tournaments"/);
  assert.match(page, /"@type": "WebPage"/);
  assert.match(page, /"@type": "BreadcrumbList"/);
  assert.match(page, /SINGLE_ELIMINATION_MAX_ENTRANTS/);
  assert.match(page, /DOUBLE_ELIMINATION_MAX_ENTRANTS/);
  for (const phrase of ["Single elimination", "Double elimination", "Draft Tournament", "Connected championship"]) {
    assert.match(directory, new RegExp(phrase));
  }
  assert.match(directory, /<h1>Pokémon tournament organizer<\/h1>/);
  assert.match(directory, /Public events appear in the directory for spectators/);
  assert.match(directory, /href="\/formats"/);
  assert.match(directory, /href="\/guides\/pokemon-draft-league-rules-template"/);
  for (const privatePage of [tournamentWorkspace, organizations, organizationDetail]) {
    assert.match(privatePage, /robots:\s*\{\s*index:\s*false,\s*follow:\s*false\s*\}/);
  }
  assert.doesNotMatch(sitemap, /\["\/organizations"/);
  assert.doesNotMatch(sitemap, /tournaments\/\$\{/);
  assert.match(policy, /public share link does not automatically make/);
  assert.match(policy, /authoritative visibility check/);
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
  assert.match(sitemap, /PRODUCT_DISCOVERY_LAST_MODIFIED/);
  assert.match(sitemap, /productRouteLastModified\.has\(path\)/);
  assert.match(sitemap, /\["\/pokedex-tracker", "weekly", 0\.9\]/);
  assert.match(sitemap, /ITALIAN_WORLDS_LAST_MODIFIED/);
  assert.match(sitemap, /localizedRouteAlternates\.has\(path\)/);
  assert.match(sitemap, /"x-default": "https:\/\/www\.draftcentral\.gg\/worlds\/2026\/vgc"/);
});

test("recent public products expose current social previews and discovery copy", () => {
  const mega = source("src/app/tools/mega-bracket/page.js");
  const lab = source("src/app/tools/team-builder/page.js");
  const nuzlocke = source("src/app/nuzlocke/page.js");
  const pokedexTracker = source("src/app/pokedex-tracker/page.js");
  const daily = source("src/app/resources/daily-games/page.js");
  const resources = source("src/components/ResourcesPage.jsx");
  const italian = source("src/app/it/worlds/2026/page.js");
  const englishWorlds = source("src/app/worlds/2026/vgc/page.js");
  const llms = source("src/app/llms.txt/route.js");
  const nextConfig = source("next.config.mjs");

  for (const page of [mega, lab, nuzlocke, pokedexTracker, daily, italian]) {
    assert.match(page, /openGraph:/);
    assert.match(page, /twitter:/);
  }
  for (const image of [
    "src/app/tools/mega-bracket/opengraph-image.js",
    "src/app/tools/team-builder/opengraph-image.js",
    "src/app/nuzlocke/opengraph-image.js",
    "src/app/pokedex-tracker/opengraph-image.js",
    "src/app/resources/daily-games/opengraph-image.js",
    "src/app/it/worlds/2026/opengraph-image.js",
  ]) {
    assert.match(source(image), /SocialPreviewImage|PokedexTrackerSocialPreview/);
    assert.match(source(image), /width: 1200, height: 630/);
  }
  assert.match(mega, /featureList:/);
  assert.match(lab, /featureList:/);
  assert.match(lab, /"@type": "FAQPage"/);
  assert.match(lab, /10-Pokémon draft rosters/);
  assert.match(lab, /Common meta archetype prompts/);
  assert.match(source("src/app/tools/team-builder/opengraph-image.js"), /Team Lab/);
  assert.match(source("src/app/tools/team-builder/opengraph-image.js"), /opponent matchup/);
  assert.match(pokedexTracker, /"@type": "WebApplication"/);
  assert.match(pokedexTracker, /"@type": "FAQPage"/);
  assert.match(pokedexTracker, /canonical: "\/pokedex-tracker"/);
  assert.match(daily, /"@type": "BreadcrumbList"/);
  assert.match(resources, /return Sunday for the weekly Super Bracket/);
  assert.match(resources, /cave floors and subareas sharing their parent location’s slot/);
  assert.match(englishWorlds, /workTranslation/);
  assert.match(nextConfig, /Content-Language", value: "it-IT"/);
  assert.match(llms, /Sunday's eight-entry Super Bracket/);
  assert.match(llms, /Exact Connections themes stay out of rotation for at least seven days/);
  assert.match(llms, /Floors and subareas share their reviewed parent location's encounter slot/);
  assert.match(llms, /Pronostici VGC dei Mondiali Pokémon 2026 in italiano/);
});

test("the Nuzlocke generator is crawlable, internally linked, and uses current product language", () => {
  const page = source("src/app/nuzlocke/page.js");
  const lab = source("src/components/NuzlockeLab.jsx");
  const tracker = source("src/components/NuzlockeRunTracker.jsx");
  const pokemonHome = source("src/app/pokemon/page.js");
  const resources = source("src/components/ResourcesPage.jsx");
  const sitemap = source("src/app/sitemap.js");

  assert.match(page, /Pokémon Nuzlocke Run Tracker and Team Generator/);
  assert.match(page, /"@type": "WebPage"/);
  assert.doesNotMatch(page, /"@type": "WebApplication"/);
  assert.match(page, /"@type": "BreadcrumbList"/);
  assert.match(page, /Track each named location as caught, active, boxed, missed, or deceased/);
  assert.match(page, /floors and subareas share one slot/);
  assert.match(page, /save the full tracker privately in My Teams/);
  assert.match(page, /Browser autosave keeps recent progress/);
  assert.match(page, /Recreation links repeat the generated location plan without exposing private tracker progress/);
  assert.doesNotMatch(page, /randomizer seed/);
  assert.match(tracker, /pokemonProfileSlugForName\(entry\.pokemon_name\)/);
  assert.match(tracker, /href={`\/pokemon\/\$\{profileSlug\}`}/);
  assert.match(pokemonHome, /href="\/nuzlocke">Track a Nuzlocke Run/);
  assert.match(resources, /href="\/nuzlocke"/);
  assert.match(sitemap, /\["\/nuzlocke", "weekly", 0\.9\]/);
  assert.doesNotMatch(page, /Build a seeded Run Card/);
});

test("the complete Nuzlocke game-guide library is indexable and internally connected", () => {
  const page = source("src/app/nuzlocke/[game]/page.js");
  const areaBrowser = source("src/components/NuzlockeGuideAreaBrowser.jsx");
  const areaRoute = source("src/app/api/nuzlocke/guide-area/route.js");
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
  assert.match(page, /summarizeNuzlockeGuideArea\(area\)/);
  assert.match(page, /NuzlockeGuideAreaBrowser/);
  assert.match(page, /<form className="nuzlocke-guide-launch-form" action="\/nuzlocke" method="get"/);
  assert.match(page, /<input type="hidden" name="game" value=\{guide\.gameKey\}/);
  assert.doesNotMatch(page, /rel="nofollow"/);
  assert.match(areaBrowser, /nuzlocke-guide-method-label/);
  assert.match(areaBrowser, /\/api\/nuzlocke\/guide-area\?game=/);
  assert.match(areaBrowser, /aria-expanded=\{isExpanded\}/);
  assert.match(areaRoute, /guidesBySlug\[game\]\?\.areas\.find/);
  assert.match(areaRoute, /s-maxage=86400/);
  assert.doesNotMatch(page, /"@type": "VideoGame"/);
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
  assert.match(pokemonHome, /href="\/pokemon\/colors"/);
  assert.match(pokemonHome, /href="\/pokemon\/egg-groups"/);
  assert.match(pokemonHome, /href="\/pokemon\/shapes"/);
  assert.match(azIndex, /href={`\/pokemon\/\$\{name\}`}/);
  assert.match(typeIndex, /href={`\/pokemon\/\$\{name\}`}/);
  assert.match(generationIndex, /href={`\/pokemon\/\$\{name\}`}/);
  assert.match(profile, /Base stat total/);
  assert.match(profile, /formatHeight\(pokemon\.height\)/);
  assert.match(profile, /formatWeight\(pokemon\.weight\)/);
  assert.match(profile, /pokemonShapeDetails\(species\.shape\?\.name\)/);
  assert.match(profile, /species\.egg_groups/);
  assert.match(profile, /species\.color/);
  assert.match(profile, /\/pokemon\/color\/\$\{color\.id\}/);
  assert.match(profile, /\/pokemon\/shape\/\$\{shape\.id\}/);
  assert.match(profile, /\/pokemon\/egg-group\/\$\{eggGroup\.id\}/);
  assert.match(profile, /color, shape, and Egg Groups/);
  assert.match(profile, /species-level Pokédex classifications/);
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
  assert.match(profile, /pokemonProfileDisplayName\(pokemon\.name, directoryName\)/);
  assert.match(profile, /Pokédex & Stats/);
});

test("Pokédex colors, Egg Groups, and shapes have indexable pages and interactive filters", () => {
  const directory = source("src/components/PokemonDirectory.jsx");
  const traitPages = source("src/components/PokemonTraitIndexPage.jsx");
  const colorsPage = source("src/app/pokemon/colors/page.js");
  const eggGroupsPage = source("src/app/pokemon/egg-groups/page.js");
  const shapesPage = source("src/app/pokemon/shapes/page.js");
  const colorPage = source("src/app/pokemon/color/[color]/page.js");
  const eggGroupPage = source("src/app/pokemon/egg-group/[eggGroup]/page.js");
  const shapePage = source("src/app/pokemon/shape/[shape]/page.js");
  const sitemap = source("src/app/sitemap.js");

  assert.match(directory, /Pokédex traits/);
  assert.match(directory, /POKEMON_COLOR_OPTIONS\.map/);
  assert.match(directory, /POKEMON_EGG_GROUP_OPTIONS\.map/);
  assert.match(directory, /POKEMON_SHAPE_OPTIONS\.map/);
  assert.match(directory, /traits\?\.color === color/);
  assert.match(directory, /traits\?\.egg_groups\?\.includes\(eggGroup\)/);
  assert.match(directory, /traits\?\.shape === shape/);
  assert.match(traitPages, /"@type": "CollectionPage"/);
  assert.match(traitPages, /"@type": "BreadcrumbList"/);
  assert.match(traitPages, /getPokemonProfilesForSpeciesTrait/);
  assert.match(traitPages, /Search \{label\} Pokémon in the Pokédex/);
  assert.match(colorsPage, /canonical: "\/pokemon\/colors"/);
  assert.match(eggGroupsPage, /canonical: "\/pokemon\/egg-groups"/);
  assert.match(shapesPage, /canonical: "\/pokemon\/shapes"/);
  assert.match(colorPage, /generateStaticParams/);
  assert.match(eggGroupPage, /generateStaticParams/);
  assert.match(shapePage, /generateStaticParams/);
  assert.match(sitemap, /POKEMON_COLOR_OPTIONS\.map/);
  assert.match(sitemap, /POKEMON_EGG_GROUP_OPTIONS\.map/);
  assert.match(sitemap, /POKEMON_SHAPE_OPTIONS\.map/);
  assert.match(sitemap, /POKEMON_TRAIT_CONTENT_LAST_MODIFIED/);
});

test("reader-friendly Pokémon names resolve to live canonical profiles", () => {
  const profiles = new Set(["urshifu-single-strike", "shaymin-land", "landorus-incarnate", "moltres-galar", "charizard-mega-x", "chandelure", "tauros-paldea-combat-breed"]);
  assert.equal(pokemonProfileSlugForName("Urshifu", profiles), "urshifu-single-strike");
  assert.equal(pokemonProfileSlugForName("Shaymin", profiles), "shaymin-land");
  assert.equal(pokemonProfileSlugForName("Landorus", profiles), "landorus-incarnate");
  assert.equal(pokemonProfileSlugForName("Galarian Moltres", profiles), "moltres-galar");
  assert.equal(pokemonProfileSlugForName("Mega Charizard X", profiles), "charizard-mega-x");
  assert.equal(pokemonProfileSlugForName("Mega Chandelure", profiles), "chandelure");
  assert.equal(pokemonProfileSlugForName("Paldean Tauros", profiles), "tauros-paldea-combat-breed");
  assert.equal(pokemonProfileSlugForName("tauros-paldea", profiles), "tauros-paldea-combat-breed");
  assert.equal(pokemonRouteSlug("Nidoran♀"), "nidoran-f");
  assert.equal(pokemonRouteSlug("Nidoran♂"), "nidoran-m");
  assert.equal(pokemonRouteSlug("Flabébé"), "flabebe");
});

test("public league pages server-render the public league payload", () => {
  const page = source("src/app/league/[slug]/page.js");
  const publicLeague = source("src/components/PublicLeaguePage.jsx");
  assert.match(page, /<PublicLeaguePage initialData=\{data\}/);
  assert.match(publicLeague, /function PublicLeaguePage\(\{ initialData = null \}\)/);
  assert.match(publicLeague, /useState\(initialData\)/);
  assert.match(publicLeague, /<h1>\{data\.league\.name\}<\/h1>/);
});

test("ambiguous PokéAPI form labels stay distinct in public profile metadata", () => {
  assert.equal(pokemonProfileDisplayName("meowstic-male-mega", "Mega Meowstic"), "Mega Meowstic (Male)");
  assert.equal(pokemonProfileDisplayName("meowstic-female-mega", "Mega Meowstic"), "Mega Meowstic (Female)");
  assert.equal(pokemonProfileDisplayName("zygarde-10", "10% Zygarde"), "10% Zygarde (Aura Break)");
  assert.equal(pokemonProfileDisplayName("zygarde-10-power-construct", "10% Zygarde"), "10% Zygarde (Power Construct)");
  assert.equal(pokemonProfileDisplayName("pikachu", "Pikachu"), "Pikachu");
});

test("public league discovery and tournament teammate links render canonical URLs", () => {
  const leaguesPage = source("src/app/leagues/page.js");
  const leagues = source("src/components/PublicLeagues.jsx");
  const tournamentProfile = source("src/components/TournamentPokemonProfile.jsx");
  assert.match(leaguesPage, /getPublicLeagueCards/);
  assert.match(leaguesPage, /<PublicLeagues initialLeagues=\{leagues\}/);
  assert.match(leagues, /useState\(initialLeagues\)/);
  assert.match(leagues, /aria-label="All current public leagues"/);
  assert.match(leagues, /href=\{`\/league\/\$\{league\.slug\}`\}/);
  assert.match(tournamentProfile, /pokemonProfileSlugForName\(teammate\.pokemon_key\)/);
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
  assert.match(profile, /pokemonDirectoryHref\(directoryName\)/);
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
  const guideIndex = source("src/app/guides/page.js");
  const sitemap = source("src/app/sitemap.js");
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
  for (const slug of [
    "how-to-use-pokemon-draft-adp",
    "pokemon-draft-league-transactions-free-agency",
    "pokemon-draft-standings-tiebreakers-playoffs",
    "compare-pokemon-forms-stats-draft-data",
    "pokemon-draft-manager-vs-spreadsheets",
  ]) assert.ok(GUIDES[slug], `${slug} should be a published guide`);
  assert.match(content, /one position after that draft's final pick/);
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
  assert.equal((content.match(/answer:\s*"/g) || []).length, 11);
  assert.equal(Object.keys(GUIDES).length, 11);
  assert.match(guidePage, /SHORT ANSWER/);
  assert.match(guidePage, /Written and reviewed by the/);
  assert.match(guidePage, /guide\.publishedDate \|\| GUIDE_PUBLISHED_DATE/);
  assert.match(guidePage, /guide\.updatedDate \|\| GUIDE_UPDATED_DATE/);
  assert.match(guidePage, /datePublished: publishedDate/);
  assert.match(guidePage, /dateModified: updatedDate/);
  assert.match(guidePage, /publishedTime:/);
  assert.match(guidePage, /modifiedTime:/);
  assert.match(guidePage, /about#data-methodology/);
  assert.match(guideIndex, /"@type": "CollectionPage"/);
  assert.match(guideIndex, /"@type": "ItemList"/);
  assert.match(guideIndex, /aria-label="Pokémon draft league guides"/);
  assert.match(sitemap, /guide\.updatedDate \|\| GUIDE_UPDATED_DATE/);
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
  const pokemonHome = source("src/app/pokemon/page.js");
  const typeHub = source("src/app/pokemon/types/page.js");
  const generationHub = source("src/app/pokemon/generations/page.js");
  const traitPages = source("src/components/PokemonTraitIndexPage.jsx");
  const explore = source("src/components/PublicExplore.jsx");
  const leagues = source("src/components/PublicLeagues.jsx");
  const manuals = source("src/app/manuals/page.js");
  const resources = source("src/components/ResourcesPage.jsx");
  const nuzlocke = source("src/app/nuzlocke/page.js");
  const profile = source("src/app/pokemon/[name]/page.js");
  const formatPage = source("src/app/formats/[slug]/page.js");

  assert.match(authGate, /function PublicLoadingShell/);
  assert.match(authGate, /function VisitorGuide/);
  assert.match(authGate, /<h1>Your Draft League Headquarters<\/h1>/);
  assert.match(directory, /fallback=.*<h1>Explore the Pokédex<\/h1>/);
  assert.match(pokemonHome, /urshifu-single-strike/);
  assert.doesNotMatch(pokemonHome, /"urshifu"/);
  assert.match(typeHub, /Use type indexes for draft research/);
  assert.match(generationHub, /Compare Pokémon by their debut generation/);
  assert.match(traitPages, /Category membership is a discovery aid/);
  assert.match(explore, /What the community pages show/);
  assert.match(leagues, /Join a roster or follow from the sideline/);
  assert.match(manuals, /Where to start/);
  assert.match(manuals, /\/guides\/how-to-join-first-pokemon-draft-league/);
  for (const path of ["/formats/national-dex", "/formats/vgc2020", "/formats/custom"]) assert.match(resources, new RegExp(path));
  assert.match(nuzlocke, /\/nuzlocke\/legends-arceus/);
  assert.match(profile, /Related \{displayName\} research/);
  assert.match(profile, /\/guides\/compare-pokemon-forms-stats-draft-data/);
  assert.match(profile, /\/guides\/how-to-use-pokemon-draft-adp/);
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
  assert.match(llms, /Pokémon tournament organizer/);
  assert.match(llms, /single elimination for up to 512 entrants/);
  assert.match(llms, /saved cards are not public pages/);
  assert.match(llms, /How to Use Pokémon Draft League ADP/);
  assert.match(llms, /Pokémon Draft League Manager vs\. Spreadsheets/);
  assert.match(llms, /Team Lab Pokémon team builder and matchup planner/);
  assert.match(llms, /Sunday's eight-entry Super Bracket/);
  assert.match(llms, /it\/worlds\/2026/);
  assert.match(llms, /Last reviewed: 2026-08-13/);
  assert.match(llms, /Private queues/);
  assert.match(content, /national-gen\$\{generation\}/);
});
