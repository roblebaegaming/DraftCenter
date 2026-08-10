import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { profileSlugForEncounter, summarizeNuzlockeGuideArea } from "../src/lib/nuzlockeGuidePresentation.js";

function source(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const contract = JSON.parse(source("src/lib/nuzlockeGameGuides.json"));
test("all reviewed Nuzlocke games have complete catalog-derived guides", () => {
  assert.equal(contract.games.length, 37);
  assert.deepEqual(contract.games.map(({ gameKey }) => gameKey), [...contract.games.map(({ gameKey }) => gameKey)].sort((a, b) => contract.games.find((game) => game.gameKey === a).releaseOrder - contract.games.find((game) => game.gameKey === b).releaseOrder));
  assert.equal(contract.sourceCommit, "5064f1d72746b3a6a931616dae3fb6445c556d4f");
  for (const guide of contract.games) {
    const catalog = JSON.parse(source(`data/nuzlocke/pokemon-${guide.gameKey}.pokeapi-${contract.sourceCommit}.json`));
    const methods = [...new Set(catalog.encounters.map(({ method }) => method))].sort();
    assert.equal(guide.displayName, catalog.game.display_name);
    assert.equal(guide.generation, catalog.game.generation);
    assert.equal(guide.family, catalog.game.family);
    assert.equal(guide.counts.locations, catalog.locations.length);
    assert.equal(guide.counts.methods, methods.length);
    assert.equal(guide.counts.pokemon, new Set(catalog.encounters.map(({ pokemon_id, form_name }) => `${pokemon_id}:${form_name || ""}`)).size);
    assert.deepEqual([...guide.methods].sort(), methods);
    if (catalog.game.starters) assert.deepEqual(guide.starters.map(({ pokemonId, name }) => [pokemonId, name]), catalog.game.starters.map(({ pokemon_id, pokemon_name }) => [pokemon_id, pokemon_name]));
    for (const condition of guide.conditions) {
      const catalogCondition = catalog.game.condition_groups.find(({ id }) => id === condition.id);
      assert.ok(catalogCondition, `${guide.gameKey} should contain ${condition.id}`);
      assert.equal(condition.label, catalogCondition.label);
      const optionLabels = new Set(catalogCondition.options.map(({ label }) => label));
      assert.ok(condition.options.every((label) => optionLabels.has(label)), `${guide.gameKey} ${condition.id} options must come from the catalog`);
    }
    for (const area of guide.areas) {
      assert.match(area.areaKey, /^[a-z0-9_-]{1,128}$/, `${guide.gameKey} area keys must remain safe API identifiers`);
      const catalogArea = catalog.locations.find(({ area_key }) => area_key === area.areaKey);
      assert.ok(catalogArea, `${guide.gameKey} should contain ${area.areaKey}`);
      assert.equal(area.label, catalogArea.display_name);
      assert.ok(catalog.encounters.some(({ area_key }) => area_key === area.areaKey), `${area.areaKey} should have encounter rows`);
      for (const method of area.methods) for (const pokemon of method.pokemon) {
        assert.ok(catalog.encounters.some((row) => row.area_key === area.areaKey && row.method === method.method && row.pokemon_id === pokemon.pokemonId), `${area.areaKey} ${method.method} should include ${pokemon.name}`);
      }
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
  const areaBrowser = source("src/components/NuzlockeGuideAreaBrowser.jsx");
  const areaRoute = source("src/app/api/nuzlocke/guide-area/route.js");
  const landing = source("src/app/nuzlocke/page.js");
  const directory = source("src/app/nuzlocke/guides/page.js");
  const sitemap = source("src/app/sitemap.js");
  assert.match(page, /generateStaticParams/);
  assert.match(page, /alternates: \{ canonical: `\/nuzlocke\/\$\{guide\.slug\}` \}/);
  assert.match(page, /"@type": "Article"/);
  assert.match(page, /"@type": "BreadcrumbList"/);
  assert.match(page, /action="\/nuzlocke" method="get"/);
  assert.match(page, /name="game" value=\{guide\.gameKey\}/);
  assert.doesNotMatch(page, /rel="nofollow"/);
  assert.doesNotMatch(page, /"@type": "VideoGame"/);
  assert.doesNotMatch(page, /encounter rows/i);
  assert.match(page, /summarizeNuzlockeGuideArea/);
  assert.match(page, /NuzlockeGuideAreaBrowser/);
  assert.match(page, /href={`\/pokemon\/\$\{starter\.profileSlug\}`}/);
  assert.match(areaBrowser, /\/api\/nuzlocke\/guide-area\?game=/);
  assert.match(areaBrowser, /aria-expanded=\{isExpanded\}/);
  assert.match(areaBrowser, /profileSlugForEncounter\(pokemon\)/);
  assert.match(areaRoute, /AREA_KEY/);
  assert.match(areaRoute, /Cache-Control/);
  assert.match(landing, /href="\/nuzlocke\/guides"/);
  assert.match(directory, /guideCatalog\.games\.map/);
  assert.match(directory, /"@type": "CollectionPage"/);
  assert.match(sitemap, /nuzlockeGameGuides\.games\.map/);
});

test("Nuzlocke guide summaries stay compact and use live profile slugs", () => {
  assert.equal(profileSlugForEncounter({ name: "Nidoran♀", pokemonId: 29 }), "nidoran-f");
  assert.equal(profileSlugForEncounter({ name: "Nidoran♂", pokemonId: 32 }), "nidoran-m");
  assert.equal(profileSlugForEncounter({ name: "Flabébé", pokemonId: 669 }), "flabebe");
  const area = contract.games.find(({ slug }) => slug === "scarlet").areas[0];
  const summary = summarizeNuzlockeGuideArea(area);
  assert.equal(summary.areaKey, area.areaKey);
  assert.ok(summary.encounterCount > 0);
  assert.ok(summary.methodLabels.length > 0);
  assert.ok(summary.previewPokemon.length > 0 && summary.previewPokemon.length <= 4);
  assert.ok(summary.previewPokemon.every(({ profileSlug }) => profileSlug));
});
