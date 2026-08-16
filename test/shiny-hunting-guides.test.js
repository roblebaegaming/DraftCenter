const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.join(__dirname, "..");
const source = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), "utf8");
const shinyDataSource = source("src/lib/shinyHuntingGuides.js");
const shinyDataModule = import("data:text/javascript;base64," + Buffer.from(shinyDataSource).toString("base64"));
const encounterCatalog = JSON.parse(source("src/lib/nuzlockeGameGuides.json"));
const pokemonCatalog = JSON.parse(source("data/pokemon/pokemon-species-traits.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json"));

test("shiny guides cover the exact verified game catalog", async () => {
  const { SHINY_HUNTING_GUIDES, SHINY_HUNTING_GUIDES_BY_SLUG } = await shinyDataModule;
  assert.equal(SHINY_HUNTING_GUIDES.length, 37);
  assert.equal(Object.keys(SHINY_HUNTING_GUIDES_BY_SLUG).length, 37);
  assert.deepEqual(
    SHINY_HUNTING_GUIDES.map(({ slug, gameKey, displayName, generation }) => ({ slug, gameKey, displayName, generation })),
    encounterCatalog.games.map(({ slug, gameKey, displayName, generation }) => ({ slug, gameKey, displayName, generation })),
  );
  assert.equal(new Set(SHINY_HUNTING_GUIDES.map(({ slug }) => slug)).size, 37);
  assert.equal(SHINY_HUNTING_GUIDES.some(({ slug }) => slug.includes("za")), false);
});

test("every game guide has publishable method, location, warning, target, and source content", async () => {
  const { SHINY_HUNTING_GUIDES } = await shinyDataModule;
  for (const guide of SHINY_HUNTING_GUIDES) {
    assert.ok(guide.title.includes(guide.displayName), guide.slug + " should have a game-specific title");
    assert.ok(guide.description.length >= 80, guide.slug + " should have a useful search description");
    assert.ok(guide.shortAnswer.length >= 150, guide.slug + " should directly answer the hunting question");
    assert.ok(guide.setup.length >= 3, guide.slug + " should include setup");
    assert.ok(guide.steps.length >= 3, guide.slug + " should include a repeatable loop");
    assert.ok(guide.locations.length >= 2, guide.slug + " should include places to hunt");
    assert.ok(guide.alternatives.length >= 2, guide.slug + " should include alternatives");
    assert.ok(guide.cautions.length >= 2, guide.slug + " should include failure points");
    assert.ok(guide.targets.length >= 2, guide.slug + " should include researched targets");
    assert.ok(guide.targets.every(({ profileSlug }) => pokemonCatalog.profile_species[profileSlug]), guide.slug + " targets should link to canonical Pokémon profiles");
    assert.ok(guide.sources.length >= 1, guide.slug + " should cite mechanics sources");
    assert.ok(guide.sources.every(([, href]) => href.startsWith("https://")), guide.slug + " sources should be public HTTPS references");
  }
});

test("legacy and modern edge cases are stated explicitly", async () => {
  const { SHINY_HUNTING_GUIDES_BY_SLUG: guides } = await shinyDataModule;
  for (const slug of ["red", "blue", "yellow"]) assert.equal(guides[slug].nativeShinies, false);
  for (const guide of Object.values(guides).filter(({ generation }) => generation > 1)) assert.equal(guide.nativeShinies, true);

  assert.match(guides.emerald.shortAnswer, /repeatable reset RNG/);
  assert.match(guides["lets-go-pikachu"].shortAnswer, /next spawn/);
  assert.match(guides["brilliant-diamond"].shortAnswer, /affects eggs here, not wild encounters/);
  assert.match(guides.sword.cautions.join(" "), /only the small Brilliant Aura subset/);
  assert.match(guides["ultra-sun"].steps.join(" "), /resetting the same arrival does not reroll/);
  assert.match(guides.scarlet.cautions.join(" "), /no overworld shiny sound/);
  assert.match(guides.scarlet.versionFocus, /Koraidon is shiny locked/);
  assert.match(guides.violet.versionFocus, /Miraidon is shiny locked/);
});

test("the collection and game templates expose discovery, tracking, and structured data", () => {
  const index = source("src/app/guides/shiny-hunting/page.js");
  const gamePage = source("src/app/guides/shiny-hunting/[game]/page.js");
  const guidesIndex = source("src/app/guides/page.js");
  const resources = source("src/components/ResourcesPage.jsx");
  const sitemap = source("src/app/sitemap.js");
  const llms = source("src/app/llms.txt/route.js");
  const select = source("src/components/ShinyGuideGameSelect.jsx");

  assert.match(index, /"@type": "CollectionPage"/);
  assert.match(index, /"@type": "ItemList"/);
  assert.match(index, /SHINY_HUNTING_GUIDES\.length/);
  assert.match(gamePage, /generateStaticParams/);
  assert.match(gamePage, /"@type": "Article"/);
  assert.match(gamePage, /"@type": "HowTo"/);
  assert.match(gamePage, /datePublished: SHINY_GUIDE_PUBLISHED_DATE/);
  assert.match(gamePage, /\/pokedex-tracker/);
  assert.match(gamePage, /\/nuzlocke\//);
  assert.match(select, /\/guides\/shiny-hunting\//);
  assert.match(guidesIndex, /Pokémon Shiny Hunting Guides by Game/);
  assert.match(resources, /Shiny hunting guides by game/);
  assert.match(sitemap, /SHINY_HUNTING_GUIDES\.map/);
  assert.match(llms, /All Pokémon shiny hunting guides by game/);
});
