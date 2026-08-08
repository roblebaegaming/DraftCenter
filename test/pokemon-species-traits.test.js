import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const SOURCE_COMMIT = "5064f1d72746b3a6a931616dae3fb6445c556d4f";
const catalog = JSON.parse(fs.readFileSync(new URL(`../data/pokemon/pokemon-species-traits.pokeapi-${SOURCE_COMMIT}.json`, import.meta.url), "utf8"));

test("the pinned species-trait catalog contains every PokeAPI profile and official category label", () => {
  assert.equal(catalog.source_commit, SOURCE_COMMIT);
  assert.equal(catalog.species_count, 1025);
  assert.equal(catalog.pokemon_count, 1351);
  assert.equal(Object.keys(catalog.pokemon).length, catalog.pokemon_count);
  assert.equal(catalog.shapes.length, 14);
  assert.equal(catalog.egg_groups.length, 15);
  assert.equal(new Set(catalog.shapes.map((item) => item.id)).size, 14);
  assert.equal(new Set(catalog.egg_groups.map((item) => item.id)).size, 15);
  assert.ok(catalog.shapes.every((item) => item.id && item.label && item.description));
  assert.ok(catalog.egg_groups.every((item) => item.id && item.label));
  assert.deepEqual(catalog.pokemon["1"], { shape: "quadruped", egg_groups: ["monster", "plant"] });
  assert.deepEqual(catalog.pokemon["12"], { shape: "bug-wings", egg_groups: ["bug"] });
  assert.deepEqual(catalog.pokemon["132"], { shape: "ball", egg_groups: ["ditto"] });
  assert.equal(catalog.egg_groups.find((item) => item.id === "ground").label, "Field");
  assert.equal(catalog.egg_groups.find((item) => item.id === "no-eggs").label, "Undiscovered");
});

test("every reviewed Nuzlocke encounter and final evolution has pinned species traits", () => {
  const directory = new URL("../data/nuzlocke/", import.meta.url);
  const files = fs.readdirSync(directory)
    .filter((file) => file.endsWith(`-evolutions.pokeapi-${SOURCE_COMMIT}.json`))
    .sort();
  assert.equal(files.length, 37);
  for (const file of files) {
    const evolutions = JSON.parse(fs.readFileSync(new URL(file, directory), "utf8"));
    assert.equal(evolutions.source_commit, SOURCE_COMMIT, file);
    for (const row of evolutions.evolutions) {
      assert.ok(catalog.pokemon[String(row.pokemon_id)], `${file} source profile ${row.pokemon_id}`);
      for (const final of row.final_evolutions) {
        assert.ok(catalog.pokemon[String(final.pokemon_id)], `${file} final profile ${final.pokemon_id}`);
      }
    }
  }
});
