import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function importSource(relativePath) {
  const source = fs.readFileSync(path.join(ROOT, relativePath), "utf8");
  return import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
}

async function evaluateLeagueData() {
  const showdown = await importSource("src/lib/showdown-regional-pokedexes.js");
  const catalog = await importSource("src/lib/regulation-catalog.js");
  const source = fs.readFileSync(path.join(ROOT, "src/components/PokemonDraftLeague.jsx"), "utf8");
  const start = source.indexOf("const TYPE_COLORS");
  const end = source.indexOf("function regulationFor");
  assert.ok(start >= 0 && end > start, "league data block remains discoverable");
  const dataSource = source
    .slice(start, end)
    .replaceAll("export const ", "const ")
    .replaceAll("export function ", "function ");
  const evaluate = new Function(
    "SHOWDOWN_REGIONAL_POKEDEXES",
    "SHOWDOWN_GAME_AVAILABILITY",
    "withRegulationMetadata",
    `${dataSource}
return { MASTER_POKEDEX, POLL_POKEMON_NAMES, REGULATION_SETS };`,
  );
  return {
    catalog,
    ...evaluate(
      showdown.SHOWDOWN_REGIONAL_POKEDEXES,
      showdown.SHOWDOWN_GAME_AVAILABILITY,
      catalog.withRegulationMetadata,
    ),
  };
}

test("regulation catalog metadata and legal pools stay complete and internally valid", async () => {
  const { catalog, MASTER_POKEDEX, REGULATION_SETS } = await evaluateLeagueData();
  const pokemonNames = new Set(MASTER_POKEDEX.map((pokemon) => pokemon.name));
  const regulationIds = Object.keys(REGULATION_SETS);

  assert.equal(regulationIds.length, 54);
  assert.deepEqual(
    new Set(regulationIds),
    new Set(Object.keys(catalog.REGULATION_METADATA)),
  );

  for (const [id, regulation] of Object.entries(REGULATION_SETS)) {
    assert.equal(regulation.id, id);
    assert.ok(regulation.gameId, `${id} has a game group`);
    assert.ok(regulation.category, `${id} has a category`);
    if (!regulation.legalNames) continue;
    assert.ok(regulation.legalNames.length > 0, `${id} has a nonempty legal pool`);
    assert.equal(
      new Set(regulation.legalNames).size,
      regulation.legalNames.length,
      `${id} has no duplicate entries`,
    );
    assert.deepEqual(
      regulation.legalNames.filter((name) => !pokemonNames.has(name)),
      [],
      `${id} only references shared Pokédex entries`,
    );
  }
});

test("game Pokédex options retain their pinned regional coverage", async () => {
  const { REGULATION_SETS } = await evaluateLeagueData();
  const expectedCounts = {
    "rby-kanto-dex": 151,
    "oras-hoenn-dex": 206,
    "platinum-sinnoh-dex": 210,
    "bw-unova-dex": 156,
    "b2w2-unova-dex": 301,
    "xy-kalos-dex": 457,
    "sm-alola-dex": 302,
    "usum-alola-dex": 403,
    "swsh-galar-dex": 398,
    "swsh-isle-dex": 209,
    "swsh-crown-dex": 208,
    "sv-paldea-dex": 400,
    "sv-kitakami-dex": 200,
    "sv-blueberry-dex": 242,
  };
  for (const [id, count] of Object.entries(expectedCounts)) {
    assert.equal(REGULATION_SETS[id].legalNames.length, count, id);
  }
});

