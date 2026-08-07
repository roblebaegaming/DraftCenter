import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function source(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const contract = JSON.parse(source("src/lib/nuzlockeGameGuides.json"));
const expectedSlugs = ["fire-red", "emerald", "platinum", "scarlet"];

test("the first Nuzlocke game-guide cohort is bounded and catalog-derived", () => {
  assert.deepEqual(contract.games.map(({ slug }) => slug), expectedSlugs);
  assert.equal(contract.sourceCommit, "5064f1d72746b3a6a931616dae3fb6445c556d4f");
  for (const guide of contract.games) {
    const catalog = JSON.parse(source(`data/nuzlocke/pokemon-${guide.gameKey}.pokeapi-${contract.sourceCommit}.json`));
    const methods = [...new Set(catalog.encounters.map(({ method }) => method))].sort();
    assert.equal(guide.displayName, catalog.game.display_name);
    assert.equal(guide.generation, catalog.game.generation);
    assert.equal(guide.family, catalog.game.family);
    assert.equal(guide.counts.encounters, catalog.encounters.length);
    assert.equal(guide.counts.locations, catalog.locations.length);
    assert.equal(guide.counts.methods, methods.length);
    assert.deepEqual([...guide.methods].sort(), methods);
    assert.deepEqual(guide.starters.map(({ pokemonId, name }) => [pokemonId, name]), catalog.game.starters.map(({ pokemon_id, pokemon_name }) => [pokemon_id, pokemon_name]));
    for (const condition of guide.conditions) {
      const catalogCondition = catalog.game.condition_groups.find(({ id }) => id === condition.id);
      assert.ok(catalogCondition, `${guide.gameKey} should contain ${condition.id}`);
      assert.equal(condition.label, catalogCondition.label);
      const optionLabels = new Set(catalogCondition.options.map(({ label }) => label));
      assert.ok(condition.options.every((label) => optionLabels.has(label)), `${guide.gameKey} ${condition.id} options must come from the catalog`);
    }
    for (const area of guide.areas) {
      const catalogArea = catalog.locations.find(({ area_key }) => area_key === area.areaKey);
      assert.ok(catalogArea, `${guide.gameKey} should contain ${area.areaKey}`);
      assert.equal(area.label, catalogArea.display_name);
      assert.ok(catalog.encounters.some(({ area_key }) => area_key === area.areaKey), `${area.areaKey} should have encounter rows`);
    }
    const generatorUrl = new URL(guide.generatorHref, "https://www.draftcentral.gg");
    assert.equal(generatorUrl.pathname, "/nuzlocke");
    assert.equal(generatorUrl.searchParams.get("game"), guide.gameKey);
    assert.equal(generatorUrl.searchParams.get("size"), "6");
    assert.equal(generatorUrl.searchParams.get("mode"), "route-random");
    assert.equal(generatorUrl.searchParams.get("weighting"), "equal");
    assert.equal(generatorUrl.searchParams.get("starter"), "include");
    assert.ok(generatorUrl.searchParams.get("seed"));
  }
});

test("game guides are static, canonical, structured, and internally linked", () => {
  const page = source("src/app/nuzlocke/[game]/page.js");
  const landing = source("src/app/nuzlocke/page.js");
  const sitemap = source("src/app/sitemap.js");
  assert.match(page, /generateStaticParams/);
  assert.match(page, /alternates: \{ canonical: `\/nuzlocke\/\$\{guide\.slug\}` \}/);
  assert.match(page, /"@type": "Article"/);
  assert.match(page, /"@type": "BreadcrumbList"/);
  assert.match(page, /guide\.generatorHref/);
  assert.match(page, /href={`\/pokemon\/\$\{starter\.profileSlug\}`}/);
  assert.match(landing, /nuzlockeGameGuides\.games\.map/);
  assert.match(sitemap, /nuzlockeGameGuides\.games\.map/);
});
