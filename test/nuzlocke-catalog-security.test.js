import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { publicSupabaseConfig } from "../src/lib/supabase/config.js";
const migration = fs.readFileSync(
  new URL(
    "../supabase/261-versioned-pokemon-encounter-catalog.sql",
    import.meta.url,
  ),
  "utf8",
);
const imported = fs.readFileSync(
  new URL(
    "../supabase/262-import-pokemon-red-encounter-catalog.sql",
    import.meta.url,
  ),
  "utf8",
);
const verified = fs.readFileSync(
  new URL(
    "../supabase/263-verify-pokemon-red-encounter-catalog.sql",
    import.meta.url,
  ),
  "utf8",
);
const blueImported = fs.readFileSync(
  new URL(
    "../supabase/265-import-pokemon-blue-encounter-catalog.sql",
    import.meta.url,
  ),
  "utf8",
);
const blueVerified = fs.readFileSync(
  new URL(
    "../supabase/266-verify-pokemon-blue-encounter-catalog.sql",
    import.meta.url,
  ),
  "utf8",
);
const yellowImported = fs.readFileSync(new URL("../supabase/267-import-pokemon-yellow-encounter-catalog.sql", import.meta.url), "utf8");
const yellowVerified = fs.readFileSync(new URL("../supabase/268-verify-pokemon-yellow-encounter-catalog.sql", import.meta.url), "utf8");
const artifactSource = fs.readFileSync(
  new URL(
    "../data/nuzlocke/pokemon-red.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json",
    import.meta.url,
  ),
  "utf8",
);
const artifact = JSON.parse(artifactSource);
const leakConfig = fs
  .readFileSync(new URL("../.gitleaks.toml", import.meta.url), "utf8")
  .replace(/\r\n/g, "\n");
const evolutionArtifact = JSON.parse(
  fs.readFileSync(
    new URL(
      "../data/nuzlocke/pokemon-red-evolutions.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const blueArtifact = JSON.parse(
  fs.readFileSync(
    new URL(
      "../data/nuzlocke/pokemon-blue.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const blueEvolutionArtifact = JSON.parse(
  fs.readFileSync(
    new URL(
      "../data/nuzlocke/pokemon-blue-evolutions.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const yellowArtifact = JSON.parse(fs.readFileSync(new URL("../data/nuzlocke/pokemon-yellow.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json", import.meta.url), "utf8"));
const yellowEvolutionArtifact = JSON.parse(fs.readFileSync(new URL("../data/nuzlocke/pokemon-yellow-evolutions.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json", import.meta.url), "utf8"));
const route = fs.readFileSync(
  new URL("../src/app/api/nuzlocke/route.js", import.meta.url),
  "utf8",
);
const lab = fs.readFileSync(
  new URL("../src/components/NuzlockeLab.jsx", import.meta.url),
  "utf8",
);
const summaryMigration = fs.readFileSync(
  new URL("../supabase/264-bounded-nuzlocke-game-summary.sql", import.meta.url),
  "utf8",
);
const capabilityMigration = fs.readFileSync(new URL("../supabase/269-nuzlocke-game-capabilities.sql", import.meta.url), "utf8");
const gen2Artifacts = Object.fromEntries(["gold", "silver", "crystal"].map((game) => [game, {
  catalog: JSON.parse(fs.readFileSync(new URL(`../data/nuzlocke/pokemon-${game}.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json`, import.meta.url), "utf8")),
  evolutions: JSON.parse(fs.readFileSync(new URL(`../data/nuzlocke/pokemon-${game}-evolutions.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json`, import.meta.url), "utf8")),
  imported: fs.readFileSync(new URL(`../supabase/${game === "gold" ? 270 : game === "silver" ? 272 : 274}-import-pokemon-${game}-encounter-catalog.sql`, import.meta.url), "utf8"),
  verified: fs.readFileSync(new URL(`../supabase/${game === "gold" ? 271 : game === "silver" ? 273 : 275}-verify-pokemon-${game}-encounter-catalog.sql`, import.meta.url), "utf8"),
}]));
const gen3MigrationNumbers={ruby:[276,277],sapphire:[278,279],emerald:[280,281],firered:[282,283],leafgreen:[284,285]};
const gen3Artifacts=Object.fromEntries(Object.entries(gen3MigrationNumbers).map(([game,[importNumber,verifyNumber]])=>[game,{
  catalog:JSON.parse(fs.readFileSync(new URL(`../data/nuzlocke/pokemon-${game}.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json`,import.meta.url),"utf8")),
  evolutions:JSON.parse(fs.readFileSync(new URL(`../data/nuzlocke/pokemon-${game}-evolutions.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json`,import.meta.url),"utf8")),
  imported:fs.readFileSync(new URL(`../supabase/${importNumber}-import-pokemon-${game}-encounter-catalog.sql`,import.meta.url),"utf8"),
  verified:fs.readFileSync(new URL(`../supabase/${verifyNumber}-verify-pokemon-${game}-encounter-catalog.sql`,import.meta.url),"utf8"),
}]));
const gen4MigrationNumbers={diamond:[286,287],pearl:[288,289],platinum:[290,291],heartgold:[292,293],soulsilver:[294,295]};
const gen4Artifacts=Object.fromEntries(Object.entries(gen4MigrationNumbers).map(([game,[importNumber,verifyNumber]])=>[game,{
  catalog:JSON.parse(fs.readFileSync(new URL(`../data/nuzlocke/pokemon-${game}.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json`,import.meta.url),"utf8")),
  evolutions:JSON.parse(fs.readFileSync(new URL(`../data/nuzlocke/pokemon-${game}-evolutions.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json`,import.meta.url),"utf8")),
  imported:fs.readFileSync(new URL(`../supabase/${importNumber}-import-pokemon-${game}-encounter-catalog.sql`,import.meta.url),"utf8"),
  verified:fs.readFileSync(new URL(`../supabase/${verifyNumber}-verify-pokemon-${game}-encounter-catalog.sql`,import.meta.url),"utf8"),
}]));
const gen5MigrationNumbers={black:[297,298],white:[299,300],"black-2":[301,302],"white-2":[303,304]};
const gen5Artifacts=Object.fromEntries(Object.entries(gen5MigrationNumbers).map(([game,[importNumber,verifyNumber]])=>[game,{
  catalog:JSON.parse(fs.readFileSync(new URL(`../data/nuzlocke/pokemon-${game}.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json`,import.meta.url),"utf8")),
  evolutions:JSON.parse(fs.readFileSync(new URL(`../data/nuzlocke/pokemon-${game}-evolutions.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json`,import.meta.url),"utf8")),
  imported:fs.readFileSync(new URL(`../supabase/${importNumber}-import-pokemon-${game}-encounter-catalog.sql`,import.meta.url),"utf8"),
  verified:fs.readFileSync(new URL(`../supabase/${verifyNumber}-verify-pokemon-${game}-encounter-catalog.sql`,import.meta.url),"utf8"),
}]));
const gen6MigrationNumbers={x:[305,306],y:[307,308],"omega-ruby":[309,310],"alpha-sapphire":[311,312]};
const gen6Artifacts=Object.fromEntries(Object.entries(gen6MigrationNumbers).map(([game,[importNumber,verifyNumber]])=>[game,{
  catalog:JSON.parse(fs.readFileSync(new URL(`../data/nuzlocke/pokemon-${game}.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json`,import.meta.url),"utf8")),
  evolutions:JSON.parse(fs.readFileSync(new URL(`../data/nuzlocke/pokemon-${game}-evolutions.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json`,import.meta.url),"utf8")),
  imported:fs.readFileSync(new URL(`../supabase/${importNumber}-import-pokemon-${game}-encounter-catalog.sql`,import.meta.url),"utf8"),
  verified:fs.readFileSync(new URL(`../supabase/${verifyNumber}-verify-pokemon-${game}-encounter-catalog.sql`,import.meta.url),"utf8"),
}]));
const gen7MigrationNumbers={sun:[313,314],moon:[315,316],"ultra-sun":[317,318],"ultra-moon":[319,320],"lets-go-pikachu":[321,322],"lets-go-eevee":[323,324]};
const gen7Artifacts=Object.fromEntries(Object.entries(gen7MigrationNumbers).map(([game,[importNumber,verifyNumber]])=>[game,{
  catalog:JSON.parse(fs.readFileSync(new URL(`../data/nuzlocke/pokemon-${game}.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json`,import.meta.url),"utf8")),
  evolutions:JSON.parse(fs.readFileSync(new URL(`../data/nuzlocke/pokemon-${game}-evolutions.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json`,import.meta.url),"utf8")),
  imported:fs.readFileSync(new URL(`../supabase/${importNumber}-import-pokemon-${game}-encounter-catalog.sql`,import.meta.url),"utf8"),
  verified:fs.readFileSync(new URL(`../supabase/${verifyNumber}-verify-pokemon-${game}-encounter-catalog.sql`,import.meta.url),"utf8"),
}]));
const gen8MigrationNumbers={sword:[325,326],shield:[327,328],"brilliant-diamond":[329,330],"shining-pearl":[331,332],"legends-arceus":[333,334]};
const gen8Artifacts=Object.fromEntries(Object.entries(gen8MigrationNumbers).map(([game,[importNumber,verifyNumber]])=>[game,{
  catalog:JSON.parse(fs.readFileSync(new URL(`../data/nuzlocke/pokemon-${game}.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json`,import.meta.url),"utf8")),
  evolutions:JSON.parse(fs.readFileSync(new URL(`../data/nuzlocke/pokemon-${game}-evolutions.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json`,import.meta.url),"utf8")),
  imported:fs.readFileSync(new URL(`../supabase/${importNumber}-import-pokemon-${game}-encounter-catalog.sql`,import.meta.url),"utf8"),
  verified:fs.readFileSync(new URL(`../supabase/${verifyNumber}-verify-pokemon-${game}-encounter-catalog.sql`,import.meta.url),"utf8"),
}]));
const gen9MigrationNumbers={scarlet:[335,336],violet:[337,338]};
const gen9Artifacts=Object.fromEntries(Object.entries(gen9MigrationNumbers).map(([game,[importNumber,verifyNumber]])=>[game,{
  catalog:JSON.parse(fs.readFileSync(new URL(`../data/nuzlocke/pokemon-${game}.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json`,import.meta.url),"utf8")),
  evolutions:JSON.parse(fs.readFileSync(new URL(`../data/nuzlocke/pokemon-${game}-evolutions.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json`,import.meta.url),"utf8")),
  imported:fs.readFileSync(new URL(`../supabase/${importNumber}-import-pokemon-${game}-encounter-catalog.sql`,import.meta.url),"utf8"),
  verified:fs.readFileSync(new URL(`../supabase/${verifyNumber}-verify-pokemon-${game}-encounter-catalog.sql`,import.meta.url),"utf8"),
}]));
test("catalog is verified-only and browser read-only", () => {
  for (const table of [
    "pokemon_games",
    "pokemon_game_pokedex_entries",
    "pokemon_game_locations",
    "pokemon_game_encounters",
  ])
    assert.match(
      migration,
      new RegExp(`alter table public\\.${table} enable row level security`),
    );
  assert.match(migration, /encounter_status = 'verified'/);
  assert.match(
    migration,
    /revoke all on public\.pokemon_games[\s\S]+from public, anon, authenticated/,
  );
  assert.doesNotMatch(
    migration,
    /grant (insert|update|delete|all)[^;]+to anon/i,
  );
});
test("source pins, fail-closed statuses, and lookup indexes are required", () => {
  assert.ok(
    (migration.match(/source_commit text not null check/g) || []).length >= 4,
  );
  assert.match(migration, /pending','partial','verified','unsupported/);
  assert.match(
    migration,
    /source_encounter_id bigint not null check \(source_encounter_id > 0\)/,
  );
  assert.match(migration, /unique \(game_key, source_encounter_id\)/);
  assert.match(migration, /game_area_idx/);
  assert.match(migration, /game_species_idx/);
});
test("Red imports pending and verifies only the exact reviewed snapshot", () => {
  assert.match(
    imported,
    /encounter_status\) values \('red'[\s\S]+,'pending'\)/,
  );
  assert.doesNotMatch(imported, /encounter_status='verified'/);
  assert.match(imported, /on conflict\(game_key,source_encounter_id\)/);
  assert.match(verified, /count\(\*\)[\s\S]+<> 151/);
  assert.match(verified, /count\(\*\)[\s\S]+<> 74/);
  assert.match(verified, /count\(\*\)[\s\S]+<> 891/);
  assert.match(
    verified,
    /where game_key='red'[\s\S]+encounter_status='pending'/,
  );
});
test("Blue imports pending and verifies only its exact version-specific snapshot", () => {
  assert.match(
    blueImported,
    /encounter_status\) values \('blue'[\s\S]+,'pending'\)/,
  );
  assert.doesNotMatch(blueImported, /encounter_status='verified'/);
  assert.match(blueImported, /on conflict\(game_key,source_encounter_id\)/);
  assert.match(blueVerified, /count\(\*\)[\s\S]+<> 151/);
  assert.match(blueVerified, /count\(\*\)[\s\S]+<> 74/);
  assert.match(blueVerified, /count\(\*\)[\s\S]+<> 891/);
  assert.match(
    blueVerified,
    /kanto-route-22-main-area'[\s\S]+pokemon_id=29[\s\S]+chance=20/,
  );
  assert.match(
    blueVerified,
    /pokemon-mansion-b1f'[\s\S]+pokemon_id=126[\s\S]+chance=4/,
  );
  assert.match(
    blueVerified,
    /where game_key='blue'[\s\S]+encounter_status='pending'/,
  );
});
test("Yellow imports pending and verifies only its exact independently reviewed snapshot", () => {
  assert.match(yellowImported, /encounter_status\) values \('yellow'[\s\S]+,'pending'\)/);
  assert.doesNotMatch(yellowImported, /encounter_status='verified'/);
  assert.match(yellowVerified, /count\(\*\)[\s\S]+<> 151/);
  assert.match(yellowVerified, /count\(\*\)[\s\S]+<> 74/);
  assert.match(yellowVerified, /count\(\*\)[\s\S]+<> 877/);
  assert.match(yellowVerified, /kanto-route-1-main-area'[\s\S]+pokemon_id=16[\s\S]+min_level=4[\s\S]+chance=20/);
  assert.match(yellowVerified, /pokemon-mansion-b1f'[\s\S]+pokemon_id=132[\s\S]+min_level=12[\s\S]+chance=1/);
  assert.match(yellowVerified, /where game_key='yellow'[\s\S]+encounter_status='pending'/);
});
test("reviewed Red artifact is pinned, complete, and collision free", () => {
  assert.equal(artifact.pokedex_entries.length, 151);
  assert.equal(artifact.locations.length, 74);
  assert.equal(artifact.encounters.length, 891);
  assert.equal(new Set(artifact.locations.map((row) => row.area_key)).size, 74);
  assert.equal(
    new Set(artifact.encounters.map((row) => row.source_encounter_id)).size,
    891,
  );
  assert.ok(
    artifact.encounters.every(
      (row) =>
        Number.isInteger(row.source_encounter_id) &&
        row.source_encounter_id > 0,
    ),
  );
  assert.ok(
    artifact.encounters.every((row) =>
      artifact.locations.some((area) => area.area_key === row.area_key),
    ),
  );
  assert.ok(
    artifact.encounters.every((row) =>
      row.artwork_url.includes("5841d46f1a0d2b8918a29a7376b1424878b86b59"),
    ),
  );
});
test("Red evolution mapping is pinned, complete for encounters, and game-specific", () => {
  assert.equal(evolutionArtifact.game_key, "red");
  assert.equal(
    evolutionArtifact.source_commit,
    "5064f1d72746b3a6a931616dae3fb6445c556d4f",
  );
  assert.equal(
    evolutionArtifact.sprites_commit,
    "5841d46f1a0d2b8918a29a7376b1424878b86b59",
  );
  const encounterIds = new Set(
    artifact.encounters.map((row) => row.pokemon_id),
  );
  const mappedIds = new Set(
    evolutionArtifact.evolutions.map((row) => row.pokemon_id),
  );
  assert.deepEqual(mappedIds, encounterIds);
  assert.ok(
    evolutionArtifact.evolutions.every(
      (row) =>
        row.final_evolutions.length &&
        row.final_evolutions.every((final) =>
          final.artwork_url.includes(evolutionArtifact.sprites_commit),
        ),
    ),
  );
  const finals = (id) =>
    evolutionArtifact.evolutions
      .find((row) => row.pokemon_id === id)
      .final_evolutions.map((row) => row.pokemon_name);
  assert.deepEqual(finals(16), ["Pidgeot"]);
  assert.deepEqual(finals(41), ["Golbat"]);
  assert.deepEqual(finals(95), ["Onix"]);
  assert.deepEqual(finals(133), ["Vaporeon", "Jolteon", "Flareon"]);
});
test("reviewed Blue artifacts are pinned, complete, version-specific, and evolution-safe", () => {
  assert.equal(blueArtifact.game.game_key, "blue");
  assert.equal(blueArtifact.pokedex_entries.length, 151);
  assert.equal(blueArtifact.locations.length, 74);
  assert.equal(blueArtifact.encounters.length, 891);
  assert.equal(
    new Set(blueArtifact.encounters.map((row) => row.source_encounter_id)).size,
    891,
  );
  const route22 = blueArtifact.encounters.filter(
    (row) =>
      row.area_key === "kanto-route-22-main-area" && row.method === "walk",
  );
  assert.ok(
    route22.some(
      (row) =>
        row.pokemon_id === 29 && row.min_level === 3 && row.chance === 20,
    ),
  );
  assert.ok(
    !route22.some(
      (row) =>
        row.pokemon_id === 32 && row.min_level === 3 && row.chance === 20,
    ),
  );
  const mansion = blueArtifact.encounters.filter(
    (row) => row.area_key === "pokemon-mansion-b1f" && row.method === "walk",
  );
  assert.ok(
    mansion.some(
      (row) =>
        row.pokemon_id === 126 && row.min_level === 38 && row.chance === 4,
    ),
  );
  assert.ok(!mansion.some((row) => row.pokemon_id === 58));
  assert.equal(blueEvolutionArtifact.game_key, "blue");
  assert.equal(
    blueEvolutionArtifact.source_commit,
    "5064f1d72746b3a6a931616dae3fb6445c556d4f",
  );
  assert.deepEqual(
    new Set(blueEvolutionArtifact.evolutions.map((row) => row.pokemon_id)),
    new Set(blueArtifact.encounters.map((row) => row.pokemon_id)),
  );
  assert.ok(
    blueEvolutionArtifact.evolutions.every(
      (row) => row.final_evolutions.length,
    ),
  );
});
test("reviewed Yellow artifacts are pinned, complete, and evolution-safe", () => {
  assert.equal(yellowArtifact.game.game_key, "yellow");
  assert.equal(yellowArtifact.pokedex_entries.length, 151);
  assert.equal(yellowArtifact.locations.length, 74);
  assert.equal(yellowArtifact.encounters.length, 877);
  assert.equal(new Set(yellowArtifact.encounters.map((row) => row.source_encounter_id)).size, 877);
  assert.equal(yellowEvolutionArtifact.game_key, "yellow");
  assert.equal(yellowEvolutionArtifact.source_commit, "5064f1d72746b3a6a931616dae3fb6445c556d4f");
  assert.deepEqual(new Set(yellowEvolutionArtifact.evolutions.map((row) => row.pokemon_id)), new Set(yellowArtifact.encounters.map((row) => row.pokemon_id)));
  assert.ok(yellowEvolutionArtifact.evolutions.every((row) => row.final_evolutions.length));
});
test("secret-scan allowlist covers only reviewed public area identifiers", () => {
  const expected = `title = "DraftCenter gitleaks configuration"

[extend]
useDefault = true

[[rules]]
id = "generic-api-key"

[[rules.allowlists]]
description = "Pinned Pokemon catalog artifact public location identifiers"
condition = "AND"
regexTarget = "match"
paths = [
  '''^data/nuzlocke/pokemon-red\\.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f\\.json$''',
  '''^data/nuzlocke/pokemon-gold\\.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f\\.json$''',
  '''^data/nuzlocke/pokemon-silver\\.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f\\.json$''',
  '''^data/nuzlocke/pokemon-crystal\\.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f\\.json$''',
  '''^data/nuzlocke/pokemon-ruby\\.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f\\.json$''',
  '''^data/nuzlocke/pokemon-sapphire\\.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f\\.json$''',
  '''^data/nuzlocke/pokemon-emerald\\.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f\\.json$''',
  '''^data/nuzlocke/pokemon-firered\\.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f\\.json$''',
  '''^data/nuzlocke/pokemon-leafgreen\\.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f\\.json$''',
  '''^data/nuzlocke/pokemon-diamond\\.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f\\.json$''',
  '''^data/nuzlocke/pokemon-pearl\\.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f\\.json$''',
  '''^data/nuzlocke/pokemon-platinum\\.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f\\.json$''',
  '''^data/nuzlocke/pokemon-heartgold\\.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f\\.json$''',
  '''^data/nuzlocke/pokemon-soulsilver\\.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f\\.json$''',
  '''^data/nuzlocke/pokemon-black\\.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f\\.json$''',
  '''^data/nuzlocke/pokemon-white\\.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f\\.json$''',
  '''^data/nuzlocke/pokemon-black-2\\.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f\\.json$''',
  '''^data/nuzlocke/pokemon-white-2\\.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f\\.json$''',
  '''^data/nuzlocke/pokemon-x\\.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f\\.json$''',
  '''^data/nuzlocke/pokemon-y\\.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f\\.json$''',
  '''^data/nuzlocke/pokemon-omega-ruby\\.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f\\.json$''',
  '''^data/nuzlocke/pokemon-alpha-sapphire\\.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f\\.json$''',
  '''^data/nuzlocke/pokemon-sun\\.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f\\.json$''',
  '''^data/nuzlocke/pokemon-moon\\.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f\\.json$''',
  '''^data/nuzlocke/pokemon-ultra-sun\\.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f\\.json$''',
  '''^data/nuzlocke/pokemon-ultra-moon\\.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f\\.json$''',
  '''^data/nuzlocke/pokemon-lets-go-pikachu\\.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f\\.json$''',
  '''^data/nuzlocke/pokemon-lets-go-eevee\\.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f\\.json$''',
  '''^data/nuzlocke/pokemon-sword\\.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f\\.json$''',
  '''^data/nuzlocke/pokemon-shield\\.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f\\.json$''',
  '''^data/nuzlocke/pokemon-brilliant-diamond\\.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f\\.json$''',
  '''^data/nuzlocke/pokemon-shining-pearl\\.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f\\.json$''',
  '''^data/nuzlocke/pokemon-legends-arceus\\.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f\\.json$''',
  '''^data/nuzlocke/pokemon-scarlet\\.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f\\.json$''',
  '''^data/nuzlocke/pokemon-violet\\.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f\\.json$''',
]
regexes = [
  '''^(?:area_key|location_key)"\\s*:\\s*"[a-z0-9-]+"$''',
]

[[rules.allowlists]]
description = "Pinned Pokemon audit documentation public PokeAPI and sprite snapshots"
condition = "AND"
regexTarget = "secret"
paths = [
  '''^docs/pokemon-catalog/pokemon-yellow-encounter-audit-2026-08-05\\.md$''',
  '''^docs/pokemon-catalog/generation-2-schema-investigation-2026-08-05\\.md$''',
  '''^docs/pokemon-catalog/pokemon-gold-encounter-audit-2026-08-05\\.md$''',
  '''^docs/pokemon-catalog/pokemon-silver-encounter-audit-2026-08-05\\.md$''',
  '''^docs/pokemon-catalog/pokemon-crystal-encounter-audit-2026-08-05\\.md$''',
  '''^docs/pokemon-catalog/pokemon-ruby-encounter-audit-2026-08-05\\.md$''',
  '''^docs/pokemon-catalog/pokemon-sapphire-encounter-audit-2026-08-05\\.md$''',
  '''^docs/pokemon-catalog/pokemon-emerald-encounter-audit-2026-08-05\\.md$''',
  '''^docs/pokemon-catalog/pokemon-firered-encounter-audit-2026-08-05\\.md$''',
  '''^docs/pokemon-catalog/pokemon-leafgreen-encounter-audit-2026-08-05\\.md$''',
  '''^docs/pokemon-catalog/pokemon-diamond-encounter-audit-2026-08-05\\.md$''',
  '''^docs/pokemon-catalog/pokemon-pearl-encounter-audit-2026-08-05\\.md$''',
  '''^docs/pokemon-catalog/pokemon-platinum-encounter-audit-2026-08-05\\.md$''',
  '''^docs/pokemon-catalog/pokemon-heartgold-encounter-audit-2026-08-05\\.md$''',
  '''^docs/pokemon-catalog/pokemon-soulsilver-encounter-audit-2026-08-05\\.md$''',
  '''^docs/pokemon-catalog/pokemon-black-encounter-audit-2026-08-05\\.md$''',
  '''^docs/pokemon-catalog/pokemon-white-encounter-audit-2026-08-05\\.md$''',
  '''^docs/pokemon-catalog/pokemon-black-2-encounter-audit-2026-08-05\\.md$''',
  '''^docs/pokemon-catalog/pokemon-white-2-encounter-audit-2026-08-05\\.md$''',
  '''^docs/pokemon-catalog/pokemon-x-encounter-audit-2026-08-05\\.md$''',
  '''^docs/pokemon-catalog/pokemon-y-encounter-audit-2026-08-05\\.md$''',
  '''^docs/pokemon-catalog/pokemon-omega-ruby-encounter-audit-2026-08-05\\.md$''',
  '''^docs/pokemon-catalog/pokemon-alpha-sapphire-encounter-audit-2026-08-05\\.md$''',
  '''^docs/pokemon-catalog/generation-6-schema-investigation-2026-08-05\\.md$''',
  '''^docs/pokemon-catalog/pokemon-sun-encounter-audit-2026-08-05\\.md$''',
  '''^docs/pokemon-catalog/pokemon-moon-encounter-audit-2026-08-05\\.md$''',
  '''^docs/pokemon-catalog/pokemon-ultra-sun-encounter-audit-2026-08-05\\.md$''',
  '''^docs/pokemon-catalog/pokemon-ultra-moon-encounter-audit-2026-08-05\\.md$''',
  '''^docs/pokemon-catalog/pokemon-lets-go-pikachu-encounter-audit-2026-08-05\\.md$''',
  '''^docs/pokemon-catalog/pokemon-lets-go-eevee-encounter-audit-2026-08-05\\.md$''',
  '''^docs/pokemon-catalog/generation-7-schema-investigation-2026-08-05\\.md$''',
  '''^docs/pokemon-catalog/generation-8-schema-investigation-2026-08-05\\.md$''',
  '''^docs/pokemon-catalog/pokemon-sword-encounter-audit-2026-08-05\\.md$''',
  '''^docs/pokemon-catalog/pokemon-shield-encounter-audit-2026-08-05\\.md$''',
  '''^docs/pokemon-catalog/pokemon-brilliant-diamond-encounter-audit-2026-08-05\\.md$''',
  '''^docs/pokemon-catalog/pokemon-shining-pearl-encounter-audit-2026-08-05\\.md$''',
  '''^docs/pokemon-catalog/pokemon-legends-arceus-encounter-audit-2026-08-05\\.md$''',
  '''^docs/pokemon-catalog/generation-9-schema-investigation-2026-08-06\\.md$''',
  '''^docs/pokemon-catalog/pokemon-scarlet-encounter-audit-2026-08-06\\.md$''',
  '''^docs/pokemon-catalog/pokemon-violet-encounter-audit-2026-08-06\\.md$''',
]
regexes = [
  '''^5064f1d72746b3a6a931616dae3fb6445c556d4f$''',
  '''^5841d46f1a0d2b8918a29a7376b1424878b86b59$''',
  '''^18cc30d6416b8fc58320af0f9b9d1b62bee405e1$''',
  '''^6daaca934ca2284a73ab743bf89c848c57cd9de1$''',
  '''^d191cd0e5c05f2af81d9a41c1f1d82e6621b351a$''',
  '''^1be7f719a44586321eadb9a54ac8f0351fbc8073$''',
]

[[rules.allowlists]]
description = "Pinned Pokemon catalog import public location identifiers, current and historical paths"
condition = "AND"
regexTarget = "match"
paths = [
  '''^supabase/257-import-pokemon-red-encounter-catalog\\.sql$''',
  '''^supabase/262-import-pokemon-red-encounter-catalog\\.sql$''',
  '''^supabase/270-import-pokemon-gold-encounter-catalog\\.sql$''',
  '''^supabase/272-import-pokemon-silver-encounter-catalog\\.sql$''',
  '''^supabase/274-import-pokemon-crystal-encounter-catalog\\.sql$''',
  '''^supabase/276-import-pokemon-ruby-encounter-catalog\\.sql$''',
  '''^supabase/278-import-pokemon-sapphire-encounter-catalog\\.sql$''',
  '''^supabase/280-import-pokemon-emerald-encounter-catalog\\.sql$''',
  '''^supabase/282-import-pokemon-firered-encounter-catalog\\.sql$''',
  '''^supabase/284-import-pokemon-leafgreen-encounter-catalog\\.sql$''',
  '''^supabase/286-import-pokemon-diamond-encounter-catalog\\.sql$''',
  '''^supabase/288-import-pokemon-pearl-encounter-catalog\\.sql$''',
  '''^supabase/290-import-pokemon-platinum-encounter-catalog\\.sql$''',
  '''^supabase/292-import-pokemon-heartgold-encounter-catalog\\.sql$''',
  '''^supabase/294-import-pokemon-soulsilver-encounter-catalog\\.sql$''',
  '''^supabase/297-import-pokemon-black-encounter-catalog\\.sql$''',
  '''^supabase/299-import-pokemon-white-encounter-catalog\\.sql$''',
  '''^supabase/301-import-pokemon-black-2-encounter-catalog\\.sql$''',
  '''^supabase/303-import-pokemon-white-2-encounter-catalog\\.sql$''',
  '''^supabase/305-import-pokemon-x-encounter-catalog\\.sql$''',
  '''^supabase/307-import-pokemon-y-encounter-catalog\\.sql$''',
  '''^supabase/309-import-pokemon-omega-ruby-encounter-catalog\\.sql$''',
  '''^supabase/311-import-pokemon-alpha-sapphire-encounter-catalog\\.sql$''',
  '''^supabase/313-import-pokemon-sun-encounter-catalog\\.sql$''',
  '''^supabase/315-import-pokemon-moon-encounter-catalog\\.sql$''',
  '''^supabase/317-import-pokemon-ultra-sun-encounter-catalog\\.sql$''',
  '''^supabase/319-import-pokemon-ultra-moon-encounter-catalog\\.sql$''',
  '''^supabase/321-import-pokemon-lets-go-pikachu-encounter-catalog\\.sql$''',
  '''^supabase/323-import-pokemon-lets-go-eevee-encounter-catalog\\.sql$''',
  '''^supabase/325-import-pokemon-sword-encounter-catalog\\.sql$''',
  '''^supabase/327-import-pokemon-shield-encounter-catalog\\.sql$''',
  '''^supabase/329-import-pokemon-brilliant-diamond-encounter-catalog\\.sql$''',
  '''^supabase/331-import-pokemon-shining-pearl-encounter-catalog\\.sql$''',
  '''^supabase/333-import-pokemon-legends-arceus-encounter-catalog\\.sql$''',
  '''^supabase/335-import-pokemon-scarlet-encounter-catalog\\.sql$''',
  '''^supabase/337-import-pokemon-violet-encounter-catalog\\.sql$''',
]
regexes = [
  '''^(?:area_key|location_key)"\\s*:\\s*"[a-z0-9-]+"$''',
]

[[rules.allowlists]]
description = "Pinned Pokemon Blue artifact public location identifiers"
condition = "AND"
regexTarget = "match"
paths = [
  '''^data/nuzlocke/pokemon-blue\\.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f\\.json$''',
]
regexes = [
  '''^(?:area_key|location_key)"\\s*:\\s*"[a-z0-9-]+"$''',
]

[[rules.allowlists]]
description = "Pinned Pokemon Blue import public location identifiers"
condition = "AND"
regexTarget = "match"
paths = [
  '''^supabase/265-import-pokemon-blue-encounter-catalog\\.sql$''',
]
regexes = [
  '''^(?:area_key|location_key)"\\s*:\\s*"[a-z0-9-]+"$''',
]

[[rules.allowlists]]
description = "Pokemon catalog verification public area identifiers"
condition = "AND"
regexTarget = "match"
paths = [
  '''^supabase/266-verify-pokemon-blue-encounter-catalog\\.sql$''',
  '''^supabase/271-verify-pokemon-gold-encounter-catalog\\.sql$''',
  '''^supabase/273-verify-pokemon-silver-encounter-catalog\\.sql$''',
  '''^supabase/275-verify-pokemon-crystal-encounter-catalog\\.sql$''',
  '''^supabase/277-verify-pokemon-ruby-encounter-catalog\\.sql$''',
  '''^supabase/279-verify-pokemon-sapphire-encounter-catalog\\.sql$''',
  '''^supabase/281-verify-pokemon-emerald-encounter-catalog\\.sql$''',
  '''^supabase/283-verify-pokemon-firered-encounter-catalog\\.sql$''',
  '''^supabase/285-verify-pokemon-leafgreen-encounter-catalog\\.sql$''',
  '''^supabase/287-verify-pokemon-diamond-encounter-catalog\\.sql$''',
  '''^supabase/289-verify-pokemon-pearl-encounter-catalog\\.sql$''',
  '''^supabase/291-verify-pokemon-platinum-encounter-catalog\\.sql$''',
  '''^supabase/293-verify-pokemon-heartgold-encounter-catalog\\.sql$''',
  '''^supabase/295-verify-pokemon-soulsilver-encounter-catalog\\.sql$''',
  '''^supabase/298-verify-pokemon-black-encounter-catalog\\.sql$''',
  '''^supabase/300-verify-pokemon-white-encounter-catalog\\.sql$''',
  '''^supabase/302-verify-pokemon-black-2-encounter-catalog\\.sql$''',
  '''^supabase/304-verify-pokemon-white-2-encounter-catalog\\.sql$''',
  '''^supabase/306-verify-pokemon-x-encounter-catalog\\.sql$''',
  '''^supabase/308-verify-pokemon-y-encounter-catalog\\.sql$''',
  '''^supabase/310-verify-pokemon-omega-ruby-encounter-catalog\\.sql$''',
  '''^supabase/312-verify-pokemon-alpha-sapphire-encounter-catalog\\.sql$''',
  '''^supabase/314-verify-pokemon-sun-encounter-catalog\\.sql$''',
  '''^supabase/316-verify-pokemon-moon-encounter-catalog\\.sql$''',
  '''^supabase/318-verify-pokemon-ultra-sun-encounter-catalog\\.sql$''',
  '''^supabase/320-verify-pokemon-ultra-moon-encounter-catalog\\.sql$''',
  '''^supabase/322-verify-pokemon-lets-go-pikachu-encounter-catalog\\.sql$''',
  '''^supabase/324-verify-pokemon-lets-go-eevee-encounter-catalog\\.sql$''',
  '''^supabase/326-verify-pokemon-sword-encounter-catalog\\.sql$''',
  '''^supabase/328-verify-pokemon-shield-encounter-catalog\\.sql$''',
  '''^supabase/330-verify-pokemon-brilliant-diamond-encounter-catalog\\.sql$''',
  '''^supabase/332-verify-pokemon-shining-pearl-encounter-catalog\\.sql$''',
  '''^supabase/334-verify-pokemon-legends-arceus-encounter-catalog\\.sql$''',
  '''^supabase/336-verify-pokemon-scarlet-encounter-catalog\\.sql$''',
  '''^supabase/338-verify-pokemon-violet-encounter-catalog\\.sql$''',
]
regexes = [
  '''^area_key='[a-z0-9-]+'$''',
]

[[rules.allowlists]]
description = "Nuzlocke catalog regression public area identifier"
condition = "AND"
regexTarget = "match"
paths = [
  '''^test/nuzlocke-catalog-security\\.test\\.js$''',
]
regexes = [
  '''^row\\.area_key==="[a-z0-9-]+"$''',
]
`;
  assert.equal(leakConfig, expected);
  const migrationPayloads = [
    ...imported.matchAll(/\$catalog\$(.+?)\$catalog\$/g),
  ].map((match) => JSON.parse(match[1]));
  const blueMigrationPayloads = [
    ...blueImported.matchAll(/\$catalog\$(.+?)\$catalog\$/g),
  ].map((match) => JSON.parse(match[1]));
  assert.deepEqual(migrationPayloads[0], artifact.pokedex_entries);
  assert.deepEqual(migrationPayloads[1], artifact.locations);
  assert.deepEqual(migrationPayloads[2], artifact.encounters);
  assert.deepEqual(blueMigrationPayloads[0], blueArtifact.pokedex_entries);
  assert.deepEqual(blueMigrationPayloads[1], blueArtifact.locations);
  assert.deepEqual(blueMigrationPayloads[2], blueArtifact.encounters);
  assert.ok(
    artifact.locations.every(
      (row) =>
        /^[a-z0-9-]+$/.test(row.location_key) &&
        /^[a-z0-9-]+$/.test(row.area_key),
    ),
  );
  assert.ok(
    artifact.encounters.every((row) => /^[a-z0-9-]+$/.test(row.area_key)),
  );
  assert.ok(
    blueArtifact.locations.every(
      (row) =>
        /^[a-z0-9-]+$/.test(row.location_key) &&
        /^[a-z0-9-]+$/.test(row.area_key),
    ),
  );
  assert.ok(
    blueArtifact.encounters.every((row) => /^[a-z0-9-]+$/.test(row.area_key)),
  );
});
test("Vercel Preview uses its isolated Supabase integration while production keeps DraftCenter credentials", () => {
  const names = [
    "VERCEL_ENV",
    "VERCEL_TARGET_ENV",
    "NEXT_PUBLIC_DRAFTCENTER_SUPABASE_URL",
    "NEXT_PUBLIC_DRAFTCENTER_SUPABASE_PUBLISHABLE_KEY",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  ];
  const previous = Object.fromEntries(
    names.map((name) => [name, process.env[name]]),
  );
  try {
    process.env.NEXT_PUBLIC_DRAFTCENTER_SUPABASE_URL =
      "https://draftcenter.example.test";
    process.env.NEXT_PUBLIC_DRAFTCENTER_SUPABASE_PUBLISHABLE_KEY = "d".repeat(
      40,
    );
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://preview.example.test";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "p".repeat(40);
    process.env.VERCEL_ENV = "preview";
    delete process.env.VERCEL_TARGET_ENV;
    assert.deepEqual(publicSupabaseConfig(), {
      url: "https://preview.example.test",
      key: "p".repeat(40),
      source: "preview",
    });
    process.env.VERCEL_ENV = "production";
    assert.deepEqual(publicSupabaseConfig(), {
      url: "https://draftcenter.example.test",
      key: "d".repeat(40),
      source: "draftcenter",
    });
  } finally {
    for (const name of names)
      previous[name] === undefined
        ? delete process.env[name]
        : (process.env[name] = previous[name]);
  }
});
test("verified game summaries are bounded, RLS-backed, and browser read-only", () => {
  assert.match(summaryMigration, /list_verified_nuzlocke_games/);
  assert.match(summaryMigration, /security invoker/);
  assert.match(summaryMigration, /encounter_status='verified'/);
  assert.match(summaryMigration, /limit 100/);
  assert.match(summaryMigration, /grant execute[^;]+to anon, authenticated/);
});
test("game capabilities remain bounded, RLS-backed metadata", () => {
  assert.match(capabilityMigration, /add column starters jsonb not null/);
  assert.match(capabilityMigration, /add column condition_groups jsonb not null/);
  assert.match(capabilityMigration, /jsonb_typeof\(starters\)='array'/);
  assert.match(capabilityMigration, /security invoker/);
  assert.match(capabilityMigration, /limit 100/);
  assert.match(capabilityMigration, /grant execute[^;]+to anon, authenticated/);
});
test("Generation II artifacts and migrations stay exact, pending-first, and version-specific", () => {
  const expected={gold:{locations:125,encounters:2830},silver:{locations:125,encounters:2830},crystal:{locations:127,encounters:3193}};
  for(const [game,records] of Object.entries(gen2Artifacts)){
    assert.equal(records.catalog.pokedex_entries.length,251); assert.equal(records.catalog.locations.length,expected[game].locations); assert.equal(records.catalog.encounters.length,expected[game].encounters);
    assert.deepEqual(records.catalog.game.starters.map((row)=>row.pokemon_id),[152,155,158]); assert.equal(records.catalog.game.condition_groups.length,3);
    assert.equal(records.catalog.encounters.filter((row)=>row.method==="bug-catching-contest").length,10);
    assert.deepEqual(new Set(records.evolutions.evolutions.map((row)=>row.pokemon_id)),new Set(records.catalog.encounters.map((row)=>row.pokemon_id)));
    const payloads=[...records.imported.matchAll(/\$catalog\$(.+?)\$catalog\$/g)].map((match)=>JSON.parse(match[1]));
    assert.deepEqual(payloads,[records.catalog.game.starters,records.catalog.game.condition_groups,records.catalog.pokedex_entries,records.catalog.locations,records.catalog.encounters]);
    assert.match(records.imported,new RegExp(`encounter_status[^)]*\\) values \\('${game}'[\\s\\S]+,'pending'`)); assert.doesNotMatch(records.imported,/encounter_status='verified'/);
    assert.match(records.verified,new RegExp(`where game_key='${game}'[\\s\\S]+encounter_status='pending'`)); assert.match(records.verified,/bug-catching-contest/); assert.match(records.verified,/count\(distinct method\)/); assert.match(records.verified,/count\(distinct pokemon_id\)/);
  }
});
test("Generation III artifacts and migrations stay exact, pending-first, and version-specific",()=>{
  const expected={ruby:{dex:202,locations:103,encounters:1530,profiles:129,methods:18,groups:2},sapphire:{dex:202,locations:104,encounters:1527,profiles:129,methods:18,groups:2},emerald:{dex:202,locations:117,encounters:1743,profiles:158,methods:17,groups:4},firered:{dex:151,locations:129,encounters:2108,profiles:136,methods:12,groups:3},leafgreen:{dex:151,locations:129,encounters:2108,profiles:136,methods:12,groups:3}};
  for(const [game,records] of Object.entries(gen3Artifacts)){
    const counts=expected[game];
    assert.equal(records.catalog.pokedex_entries.length,counts.dex);assert.equal(records.catalog.locations.length,counts.locations);assert.equal(records.catalog.encounters.length,counts.encounters);assert.equal(new Set(records.catalog.encounters.map((row)=>row.pokemon_id)).size,counts.profiles);assert.equal(new Set(records.catalog.encounters.map((row)=>row.method)).size,counts.methods);
    assert.deepEqual(records.catalog.game.starters.map((row)=>row.pokemon_id),["firered","leafgreen"].includes(game)?[1,4,7]:[252,255,258]);assert.equal(records.catalog.game.condition_groups.length,counts.groups);
    assert.deepEqual(new Set(records.evolutions.evolutions.map((row)=>row.pokemon_id)),new Set(records.catalog.encounters.map((row)=>row.pokemon_id)));assert.ok(records.evolutions.evolutions.flatMap((row)=>row.final_evolutions).every((row)=>row.pokemon_id<=386));
    const payloads=[...records.imported.matchAll(/\$catalog\$(.+?)\$catalog\$/g)].map((match)=>JSON.parse(match[1]));assert.deepEqual(payloads,[records.catalog.game.starters,records.catalog.game.condition_groups,records.catalog.pokedex_entries,records.catalog.locations,records.catalog.encounters]);
    assert.match(records.imported,new RegExp(`encounter_status[^)]*\\) values \\('${game}'[\\s\\S]+,'pending'`));assert.doesNotMatch(records.imported,/encounter_status='verified'/);assert.match(records.verified,new RegExp(`where game_key='${game}'[\\s\\S]+encounter_status='pending'`));assert.match(records.verified,/count\(distinct method\)/);assert.match(records.verified,/count\(distinct pokemon_id\)/);
  }
  assert.equal(gen3Artifacts.emerald.catalog.encounters.filter((row)=>(row.conditions||[]).includes("altering-cave-smeargle")).length,12);
  assert.ok(gen3Artifacts.firered.catalog.encounters.some((row)=>row.area_key==="sevault-canyon-main-area"&&row.pokemon_id===227));
  assert.ok(gen3Artifacts.leafgreen.catalog.encounters.some((row)=>row.area_key==="icefall-cave-1f"&&row.pokemon_id===215));
});
test("Generation IV artifacts and migrations stay exact, pending-first, and version-specific",()=>{
  const expected={diamond:{dex:151,locations:157,encounters:4388,profiles:277,methods:13},pearl:{dex:151,locations:157,encounters:4388,profiles:278,methods:13},platinum:{dex:210,locations:159,encounters:4227,profiles:290,methods:13},heartgold:{dex:256,locations:168,encounters:6205,profiles:283,methods:14},soulsilver:{dex:256,locations:168,encounters:6205,profiles:283,methods:14}};
  for(const [game,records] of Object.entries(gen4Artifacts)){
    const counts=expected[game];
    assert.equal(records.catalog.pokedex_entries.length,counts.dex);assert.equal(records.catalog.locations.length,counts.locations);assert.equal(records.catalog.encounters.length,counts.encounters);assert.equal(new Set(records.catalog.encounters.map((row)=>row.pokemon_id)).size,counts.profiles);assert.equal(new Set(records.catalog.encounters.map((row)=>row.method)).size,counts.methods);
    assert.deepEqual(records.catalog.game.starters.map((row)=>row.pokemon_id),["diamond","pearl","platinum"].includes(game)?[387,390,393]:[152,155,158]);assert.equal(records.catalog.game.condition_groups.length,7);
    assert.deepEqual(new Set(records.evolutions.evolutions.map((row)=>row.pokemon_id)),new Set(records.catalog.encounters.map((row)=>row.pokemon_id)));assert.ok(records.evolutions.evolutions.flatMap((row)=>row.final_evolutions).every((row)=>row.pokemon_id<=493));
    const payloads=[...records.imported.matchAll(/\$catalog\$(.+?)\$catalog\$/g)].map((match)=>JSON.parse(match[1]));assert.deepEqual(payloads,[records.catalog.game.starters,records.catalog.game.condition_groups,records.catalog.pokedex_entries,records.catalog.locations,records.catalog.encounters]);
    assert.match(records.imported,new RegExp(`encounter_status[^)]*\\) values \\('${game}'[\\s\\S]+,'pending'`));assert.doesNotMatch(records.imported,/encounter_status='verified'/);assert.match(records.verified,new RegExp(`where game_key='${game}'[\\s\\S]+encounter_status='pending'`));assert.match(records.verified,/count\(distinct method\)/);assert.match(records.verified,/count\(distinct pokemon_id\)/);
  }
  const exactTuple=(row)=>[row.area_key,row.pokemon_id,row.method,row.min_level,row.max_level,row.chance,(row.conditions||[]).join(",")].join("|");
  const differences=(left,right)=>{const leftRows=new Set(left.map(exactTuple));const rightRows=new Set(right.map(exactTuple));return [...leftRows].filter((row)=>!rightRows.has(row)).length;};
  assert.equal(differences(gen4Artifacts.diamond.catalog.encounters,gen4Artifacts.pearl.catalog.encounters),105);assert.equal(differences(gen4Artifacts.pearl.catalog.encounters,gen4Artifacts.diamond.catalog.encounters),105);
  assert.equal(differences(gen4Artifacts.heartgold.catalog.encounters,gen4Artifacts.soulsilver.catalog.encounters),320);assert.equal(differences(gen4Artifacts.soulsilver.catalog.encounters,gen4Artifacts.heartgold.catalog.encounters),323);
  assert.ok(gen4Artifacts.platinum.catalog.encounters.some((row)=>row.area_key==="distortion-world-main-area"&&row.pokemon_id===487));
  assert.ok(gen4Artifacts.heartgold.catalog.encounters.some((row)=>row.method==="headbutt"&&(row.conditions||[]).includes("headbutt-tree-secret")));
  assert.ok(gen4Artifacts.soulsilver.catalog.encounters.some((row)=>(row.conditions||[]).some((condition)=>condition.startsWith("johto-safari-blocks-water-min-"))));
});
test("Generation V artifacts and migrations stay exact, pending-first, and version-specific",()=>{
  const expected={black:{dex:156,locations:87,encounters:2708,profiles:257,methods:14,groups:3,swarms:17,grottoes:0},white:{dex:156,locations:87,encounters:2708,profiles:257,methods:14,groups:3,swarms:17,grottoes:0},"black-2":{dex:301,locations:137,encounters:3869,profiles:313,methods:15,groups:4,swarms:19,grottoes:70},"white-2":{dex:301,locations:137,encounters:3869,profiles:312,methods:15,groups:4,swarms:19,grottoes:70}};
  for(const [game,records] of Object.entries(gen5Artifacts)){
    const counts=expected[game];
    assert.equal(records.catalog.pokedex_entries.length,counts.dex);assert.equal(records.catalog.locations.length,counts.locations);assert.equal(records.catalog.encounters.length,counts.encounters);assert.equal(new Set(records.catalog.encounters.map((row)=>row.pokemon_id)).size,counts.profiles);assert.equal(new Set(records.catalog.encounters.map((row)=>row.method)).size,counts.methods);
    assert.deepEqual(records.catalog.game.starters.map((row)=>row.pokemon_id),[495,498,501]);assert.equal(records.catalog.game.condition_groups.length,counts.groups);
    assert.equal(records.catalog.encounters.filter((row)=>row.method==="swarm").length,counts.swarms);assert.equal(records.catalog.encounters.filter((row)=>row.method==="hidden-grotto").length,counts.grottoes);
    assert.deepEqual(new Set(records.evolutions.evolutions.map((row)=>row.pokemon_id)),new Set(records.catalog.encounters.map((row)=>row.pokemon_id)));assert.ok(records.evolutions.evolutions.flatMap((row)=>row.final_evolutions).every((row)=>row.pokemon_id<=649));
    const payloads=[...records.imported.matchAll(/\$catalog\$(.+?)\$catalog\$/g)].map((match)=>JSON.parse(match[1]));assert.deepEqual(payloads,[records.catalog.game.starters,records.catalog.game.condition_groups,records.catalog.pokedex_entries,records.catalog.locations,records.catalog.encounters]);
    assert.match(records.imported,new RegExp(`encounter_status[^)]*\\) values \\('${game}'[\\s\\S]+,'pending'`));assert.doesNotMatch(records.imported,/encounter_status='verified'/);assert.match(records.verified,new RegExp(`where game_key='${game}'[\\s\\S]+encounter_status='pending'`));assert.match(records.verified,/count\(distinct method\)/);assert.match(records.verified,/count\(distinct pokemon_id\)/);
    assert.ok(!records.catalog.locations.some((row)=>row.location_key==="team-flare-secret-hq"));
  }
  const exactTuple=(row)=>[row.area_key,row.pokemon_id,row.method,row.min_level,row.max_level,row.chance,(row.conditions||[]).join(",")].join("|");
  const differences=(left,right)=>{const leftRows=new Set(left.map(exactTuple));const rightRows=new Set(right.map(exactTuple));return [...leftRows].filter((row)=>!rightRows.has(row)).length;};
  assert.equal(differences(gen5Artifacts.black.catalog.encounters,gen5Artifacts.white.catalog.encounters),304);assert.equal(differences(gen5Artifacts.white.catalog.encounters,gen5Artifacts.black.catalog.encounters),304);
  assert.equal(differences(gen5Artifacts["black-2"].catalog.encounters,gen5Artifacts["white-2"].catalog.encounters),513);assert.equal(differences(gen5Artifacts["white-2"].catalog.encounters,gen5Artifacts["black-2"].catalog.encounters),513);
  assert.ok(gen5Artifacts.black.catalog.encounters.some((row)=>row.area_key==="unova-route-12-main-area"&&row.pokemon_id===641&&row.method==="roaming-grass"));
  assert.ok(gen5Artifacts["black-2"].catalog.encounters.some((row)=>row.pokemon_id===630&&(row.conditions||[]).includes("weekday-thursday")));
  assert.ok(gen5Artifacts["white-2"].catalog.encounters.some((row)=>row.pokemon_id===628&&(row.conditions||[]).includes("weekday-monday")));
  assert.equal(gen5Artifacts["black-2"].catalog.game.condition_groups.find((group)=>group.id==="regi-key")?.default_value,"iron");
  assert.equal(gen5Artifacts["white-2"].catalog.game.condition_groups.find((group)=>group.id==="regi-key")?.default_value,"ice");
});
test("Generation VI artifacts and migrations stay exact, pending-first, and version-specific",()=>{
  const expected={x:{dex:454,locations:61,encounters:1469,profiles:358,methods:20,groups:4},y:{dex:454,locations:61,encounters:1469,profiles:357,methods:20,groups:4},"omega-ruby":{dex:211,locations:89,encounters:2822,profiles:251,methods:14,groups:7},"alpha-sapphire":{dex:211,locations:89,encounters:2822,profiles:251,methods:14,groups:7}};
  for(const [game,records] of Object.entries(gen6Artifacts)){
    const counts=expected[game],kalos=["x","y"].includes(game);
    assert.equal(records.catalog.pokedex_entries.length,counts.dex);assert.equal(records.catalog.locations.length,counts.locations);assert.equal(records.catalog.encounters.length,counts.encounters);assert.equal(new Set(records.catalog.encounters.map((row)=>row.pokemon_id)).size,counts.profiles);assert.equal(new Set(records.catalog.encounters.map((row)=>row.method)).size,counts.methods);
    assert.deepEqual(records.catalog.game.starters.map((row)=>row.pokemon_id),kalos?[650,653,656]:[252,255,258]);assert.equal(records.catalog.game.condition_groups.length,counts.groups);
    assert.deepEqual(new Set(records.evolutions.evolutions.map((row)=>row.pokemon_id)),new Set(records.catalog.encounters.map((row)=>row.pokemon_id)));assert.ok(records.evolutions.evolutions.flatMap((row)=>row.final_evolutions).every((row)=>row.pokemon_id<=721));
    const payloads=[...records.imported.matchAll(/\$catalog\$(.+?)\$catalog\$/g)].map((match)=>JSON.parse(match[1]));assert.deepEqual(payloads,[records.catalog.game.starters,records.catalog.game.condition_groups,records.catalog.pokedex_entries,records.catalog.locations,records.catalog.encounters]);
    assert.match(records.imported,new RegExp(`encounter_status[^)]*\\) values \\('${game}'[\\s\\S]+,'pending'`));assert.doesNotMatch(records.imported,/encounter_status='verified'/);assert.match(records.verified,new RegExp(`where game_key='${game}'[\\s\\S]+encounter_status='pending'`));assert.match(records.verified,/count\(distinct method\)/);assert.match(records.verified,/count\(distinct pokemon_id\)/);
  }
  for(const game of ["x","y"]){const records=gen6Artifacts[game];assert.equal(records.catalog.encounters.filter((row)=>row.method==="friend-safari").length,196);assert.equal(new Set(records.catalog.encounters.filter((row)=>row.method==="friend-safari").map((row)=>row.area_key)).size,1);assert.ok(!records.catalog.locations.some((row)=>row.area_key==="roaming-kalos-main-area"));assert.deepEqual(records.evolutions.evolutions.find((row)=>row.pokemon_id===670).final_evolutions.map((row)=>row.form_name),["Red Flower","Yellow Flower","Blue Flower"]);}
  for(const game of ["omega-ruby","alpha-sapphire"]){const records=gen6Artifacts[game];assert.equal(records.catalog.encounters.filter((row)=>row.source_encounter_id>=6000000&&row.source_encounter_id<6002747).length,2747);assert.equal(records.catalog.encounters.filter((row)=>row.method==="dexnav").length,150);assert.equal(records.catalog.encounters.filter((row)=>row.method==="soaring").length,7);assert.equal(records.catalog.encounters.filter((row)=>(row.conditions||[]).includes("mirage-spot-active")).length,420);}
  assert.ok(gen6Artifacts.x.catalog.encounters.some((row)=>row.pokemon_id===716)&&!gen6Artifacts.x.catalog.encounters.some((row)=>row.pokemon_id===717));
  assert.ok(gen6Artifacts.y.catalog.encounters.some((row)=>row.pokemon_id===717)&&!gen6Artifacts.y.catalog.encounters.some((row)=>row.pokemon_id===716));
  assert.equal(gen6Artifacts["omega-ruby"].catalog.encounters.filter((row)=>row.pokemon_id===422&&row.form_name==="West Sea").length,2);assert.equal(gen6Artifacts["alpha-sapphire"].catalog.encounters.filter((row)=>row.pokemon_id===422&&row.form_name==="East Sea").length,2);
});
test("Generation VII artifacts and migrations stay exact, pending-first, location-scoped, and version-specific",()=>{
  const expected={sun:{dex:782,locations:67,encounters:886,profiles:251,methods:11,groups:5,sos:181,pelago:64},moon:{dex:782,locations:68,encounters:890,profiles:251,methods:11,groups:5,sos:181,pelago:64},"ultra-sun":{dex:1003,locations:74,encounters:1216,profiles:378,methods:11,groups:8,sos:270,pelago:63},"ultra-moon":{dex:1003,locations:74,encounters:1216,profiles:377,methods:11,groups:8,sos:268,pelago:63},"lets-go-pikachu":{dex:153,locations:44,encounters:693,profiles:125,methods:10,groups:3},"lets-go-eevee":{dex:153,locations:44,encounters:693,profiles:125,methods:10,groups:3}};
  for(const [game,records] of Object.entries(gen7Artifacts)){
    const counts=expected[game],letsGo=game.startsWith("lets-go-");
    assert.equal(records.catalog.pokedex_entries.length,counts.dex);assert.equal(records.catalog.locations.length,counts.locations);assert.equal(records.catalog.encounters.length,counts.encounters);assert.equal(new Set(records.catalog.encounters.map((row)=>row.pokemon_id)).size,counts.profiles);assert.equal(new Set(records.catalog.encounters.map((row)=>row.method)).size,counts.methods);
    assert.deepEqual(records.catalog.game.starters.map((row)=>row.pokemon_id),letsGo?[game.endsWith("pikachu")?25:133]:[722,725,728]);assert.equal(records.catalog.game.condition_groups.length,counts.groups);
    assert.ok(records.catalog.locations.every((row)=>row.area_key===`${row.location_key}-main-area`));assert.deepEqual(new Set(records.evolutions.evolutions.map((row)=>row.pokemon_id)),new Set(records.catalog.encounters.map((row)=>row.pokemon_id)));
    const payloads=[...records.imported.matchAll(/\$catalog\$(.+?)\$catalog\$/g)].map((match)=>JSON.parse(match[1]));assert.deepEqual(payloads,[records.catalog.game.starters,records.catalog.game.condition_groups,records.catalog.pokedex_entries,records.catalog.locations,records.catalog.encounters]);
    assert.match(records.imported,new RegExp(`encounter_status[^)]*\\) values \\('${game}'[\\s\\S]+,'pending'`));assert.doesNotMatch(records.imported,/encounter_status='verified'/);assert.match(records.verified,new RegExp(`where game_key='${game}'[\\s\\S]+encounter_status='pending'`));assert.match(records.verified,/count\(distinct method\)/);assert.match(records.verified,/count\(distinct pokemon_id\)/);
    if(letsGo){assert.equal(records.catalog.encounters.filter((row)=>(row.conditions||[]).includes("rare-overworld-spawn")).length,174);assert.equal(records.catalog.encounters.filter((row)=>(row.conditions||[]).includes("roaming-legendary-bird")).length,75);assert.equal(records.catalog.encounters.filter((row)=>(row.conditions||[]).includes("story-progress-hall-of-fame")).length,238);}
    else{assert.equal(records.catalog.encounters.filter((row)=>(row.conditions||[]).includes("sos-chain-active")).length,counts.sos);assert.equal(records.catalog.encounters.filter((row)=>row.method==="island-scan").length,28);assert.equal(records.catalog.encounters.filter((row)=>(row.conditions||[]).includes("poke-pelago-visitor")).length,counts.pelago);}
  }
  for(const game of ["ultra-sun","ultra-moon"]){assert.equal(gen7Artifacts[game].catalog.locations.filter((row)=>row.location_key==="ultra-space-wilds").length,1);assert.equal(gen7Artifacts[game].catalog.encounters.filter((row)=>row.area_key==="ultra-space-wilds-main-area").length,86);}
  assert.ok(gen7Artifacts.sun.catalog.encounters.some((row)=>row.pokemon_id===791)&&!gen7Artifacts.sun.catalog.encounters.some((row)=>row.pokemon_id===792));assert.ok(gen7Artifacts.moon.catalog.encounters.some((row)=>row.pokemon_id===792)&&!gen7Artifacts.moon.catalog.encounters.some((row)=>row.pokemon_id===791));
  assert.ok(gen7Artifacts["lets-go-pikachu"].catalog.encounters.some((row)=>row.pokemon_id===53&&row.method==="gift")&&!gen7Artifacts["lets-go-pikachu"].catalog.encounters.some((row)=>row.pokemon_id===59&&row.method==="gift"));assert.ok(gen7Artifacts["lets-go-eevee"].catalog.encounters.some((row)=>row.pokemon_id===59&&row.method==="gift")&&!gen7Artifacts["lets-go-eevee"].catalog.encounters.some((row)=>row.pokemon_id===53&&row.method==="gift"));
});
test("Generation VIII artifacts and migrations stay exact, pending-first, form-aware, and mechanic-specific",()=>{
  const expected={sword:{dex:821,locations:87,encounters:9114,profiles:613,methods:19,groups:5},shield:{dex:821,locations:87,encounters:9109,profiles:614,methods:19,groups:5},"brilliant-diamond":{dex:151,locations:96,encounters:7976,profiles:296,methods:13,groups:4},"shining-pearl":{dex:151,locations:96,encounters:8014,profiles:300,methods:13,groups:4},"legends-arceus":{dex:242,locations:112,encounters:7523,profiles:245,methods:8,groups:5}};
  for(const [game,records] of Object.entries(gen8Artifacts)){
    const counts=expected[game];assert.equal(records.catalog.pokedex_entries.length,counts.dex);assert.equal(records.catalog.locations.length,counts.locations);assert.equal(records.catalog.encounters.length,counts.encounters);assert.equal(new Set(records.catalog.encounters.map((row)=>row.pokemon_id)).size,counts.profiles);assert.equal(new Set(records.catalog.encounters.map((row)=>row.method)).size,counts.methods);assert.equal(records.catalog.game.condition_groups.length,counts.groups);
    assert.ok(records.catalog.locations.every((row)=>row.area_key===`${row.location_key}-main-area`));assert.deepEqual(new Set(records.evolutions.evolutions.map((row)=>`${row.pokemon_id}|${row.form_name||""}`)),new Set(records.catalog.encounters.map((row)=>`${row.pokemon_id}|${row.form_name||""}`)));
    const payloads=[...records.imported.matchAll(/\$catalog\$(.+?)\$catalog\$/g)].map((match)=>JSON.parse(match[1]));assert.deepEqual(payloads,[records.catalog.game.starters,records.catalog.game.condition_groups,records.catalog.pokedex_entries,records.catalog.locations,records.catalog.encounters]);
    assert.match(records.imported,new RegExp(`encounter_status[^)]*\\) values \\('${game}'[\\s\\S]+,'pending'`));assert.doesNotMatch(records.imported,/encounter_status='verified'/);assert.match(records.verified,new RegExp(`where game_key='${game}'[\\s\\S]+encounter_status='pending'`));assert.match(records.verified,/count\(distinct method\)/);assert.match(records.verified,/count\(distinct pokemon_id\)/);
  }
  for(const game of ["sword","shield"]){const catalog=gen8Artifacts[game].catalog;assert.equal(catalog.game.starters.length,3);assert.ok(catalog.encounters.some((row)=>row.method==="max-raid"&&(row.conditions||[]).includes("content-isle-of-armor")));assert.ok(catalog.encounters.some((row)=>row.method==="dynamax-adventure"));}
  assert.ok(gen8Artifacts.sword.catalog.encounters.some((row)=>row.pokemon_id===888)&&!gen8Artifacts.sword.catalog.encounters.some((row)=>row.pokemon_id===889));assert.ok(gen8Artifacts.shield.catalog.encounters.some((row)=>row.pokemon_id===889)&&!gen8Artifacts.shield.catalog.encounters.some((row)=>row.pokemon_id===888));
  for(const game of ["brilliant-diamond","shining-pearl"]){const catalog=gen8Artifacts[game].catalog;assert.ok(catalog.encounters.some((row)=>row.method==="grand-underground"));assert.ok(catalog.locations.some((row)=>row.display_name.includes("Grand Underground (")));const east=gen8Artifacts[game].evolutions.evolutions.find((row)=>row.pokemon_id===422&&row.form_name==="East Sea");assert.deepEqual(east.final_evolutions.map((row)=>row.form_name),["East Sea"]);}
  const pla=gen8Artifacts["legends-arceus"];for(const method of ["space-time-distortion","mass-outbreak","massive-mass-outbreak","fixed-unown"])assert.ok(pla.catalog.encounters.some((row)=>row.method===method));assert.equal(pla.evolutions.evolutions.find((row)=>row.pokemon_id===155&&row.form_name==="").final_evolutions[0].pokemon_id,10233);
});
test("Generation IX artifacts and migrations stay exact, pending-first, DLC-aware, and version-specific",()=>{
  const expected={scarlet:{dex:843,locations:80,encounters:13005,profiles:638,teal:3699,indigo:1239},violet:{dex:843,locations:80,encounters:13075,profiles:637,teal:3713,indigo:1239}};
  for(const [game,records] of Object.entries(gen9Artifacts)){
    const counts=expected[game],catalog=records.catalog;
    assert.equal(catalog.pokedex_entries.length,counts.dex);assert.equal(catalog.locations.length,counts.locations);assert.equal(catalog.encounters.length,counts.encounters);assert.equal(new Set(catalog.encounters.map((row)=>row.pokemon_id)).size,counts.profiles);assert.equal(new Set(catalog.encounters.map((row)=>row.method)).size,13);assert.equal(catalog.game.condition_groups.length,7);
    assert.deepEqual(catalog.game.starters.map((row)=>row.pokemon_id),[906,909,912]);assert.ok(catalog.locations.every((row)=>row.area_key===`${row.location_key}-main-area`));assert.deepEqual(new Set(records.evolutions.evolutions.map((row)=>`${row.pokemon_id}|${row.form_name||""}`)),new Set(catalog.encounters.map((row)=>`${row.pokemon_id}|${row.form_name||""}`)));
    assert.equal(catalog.encounters.filter((row)=>(row.conditions||[]).includes("content-teal-mask")).length,counts.teal);assert.equal(catalog.encounters.filter((row)=>(row.conditions||[]).includes("content-indigo-disk")).length,counts.indigo);assert.equal(catalog.encounters.filter((row)=>(row.conditions||[]).includes("tera-raid-encounter")).length,584);assert.equal(catalog.encounters.filter((row)=>(row.conditions||[]).includes("union-circle-required")).length,16);assert.equal(catalog.encounters.filter((row)=>(row.conditions||[]).includes("limited-time-event")).length,2);assert.equal(catalog.encounters.filter((row)=>(row.conditions||[]).includes("league-club-trade")).length,30);
    const payloads=[...records.imported.matchAll(/\$catalog\$(.+?)\$catalog\$/g)].map((match)=>JSON.parse(match[1]));assert.deepEqual(payloads,[catalog.game.starters,catalog.game.condition_groups,catalog.pokedex_entries,catalog.locations,catalog.encounters]);assert.match(records.imported,new RegExp(`encounter_status[^)]*\\) values \\('${game}'[\\s\\S]+,'pending'`));assert.doesNotMatch(records.imported,/encounter_status='verified'/);assert.match(records.verified,new RegExp(`where game_key='${game}'[\\s\\S]+encounter_status='pending'`));assert.match(records.verified,/count\(distinct method\)/);assert.match(records.verified,/count\(distinct pokemon_id\)/);
    assert.ok(!catalog.encounters.some((row)=>row.method==="mightiest-mark-raid"||row.method==="mass-outbreak"));
  }
  const scarlet=gen9Artifacts.scarlet.catalog.encounters,violet=gen9Artifacts.violet.catalog.encounters;
  assert.ok(scarlet.some((row)=>row.pokemon_id===1007)&&!scarlet.some((row)=>row.pokemon_id===1008));assert.ok(scarlet.some((row)=>row.pokemon_id===1020)&&scarlet.some((row)=>row.pokemon_id===1021)&&!scarlet.some((row)=>[1022,1023].includes(row.pokemon_id)));
  assert.ok(violet.some((row)=>row.pokemon_id===1008)&&!violet.some((row)=>row.pokemon_id===1007));assert.ok(violet.some((row)=>row.pokemon_id===1022)&&violet.some((row)=>row.pokemon_id===1023)&&!violet.some((row)=>[1020,1021].includes(row.pokemon_id)));
  const artisan=gen9Artifacts.scarlet.evolutions.evolutions.find((row)=>row.pokemon_id===1012&&row.form_name==="Artisan Form");assert.deepEqual(artisan.final_evolutions.map((row)=>[row.pokemon_id,row.form_name]),[[1013,"Masterpiece Form"]]);
});
test("server route uses public RLS catalog access and privileged rate limiting", () => {
  assert.match(route, /createPublicServerClient/);
  assert.match(route, /list_verified_nuzlocke_games/);
  assert.match(route, /eq\("encounter_status", "verified"\)/);
  assert.match(route, /consumeUserRateLimit\(adminClient/);
  assert.match(route, /get_verified_nuzlocke_encounters/);
  assert.doesNotMatch(route, /adminClient\.from\("pokemon_games"/);
});
test("final evolution requests require source-matched pinned game catalogs", () => {
  for(const game of ["red","blue","yellow","gold","silver","crystal","ruby","sapphire","emerald","firered","leafgreen","diamond","pearl","platinum","heartgold","soulsilver","black","white"]) assert.match(route,new RegExp(`${game}: ${game}EvolutionCatalog`));
  assert.match(route,/"black-2": black2EvolutionCatalog/);assert.match(route,/"white-2": white2EvolutionCatalog/);
  assert.match(route,/x: xEvolutionCatalog/);assert.match(route,/y: yEvolutionCatalog/);assert.match(route,/"omega-ruby": omegaRubyEvolutionCatalog/);assert.match(route,/"alpha-sapphire": alphaSapphireEvolutionCatalog/);
  assert.match(route,/sun: sunEvolutionCatalog/);assert.match(route,/moon: moonEvolutionCatalog/);assert.match(route,/"ultra-sun": ultraSunEvolutionCatalog/);assert.match(route,/"ultra-moon": ultraMoonEvolutionCatalog/);assert.match(route,/"lets-go-pikachu": letsGoPikachuEvolutionCatalog/);assert.match(route,/"lets-go-eevee": letsGoEeveeEvolutionCatalog/);
  assert.match(route,/sword: swordEvolutionCatalog/);assert.match(route,/shield: shieldEvolutionCatalog/);assert.match(route,/"brilliant-diamond": brilliantDiamondEvolutionCatalog/);assert.match(route,/"shining-pearl": shiningPearlEvolutionCatalog/);assert.match(route,/"legends-arceus": legendsArceusEvolutionCatalog/);
  assert.match(route,/scarlet: scarletEvolutionCatalog/);assert.match(route,/violet: violetEvolutionCatalog/);
  assert.match(route, /body\.finalEvolutionOnly === true/);
  assert.match(
    route,
    /evolutionCatalog\.source_commit !== game\.source_commit/,
  );
  assert.match(route, /Final evolution data is not verified/);
  assert.match(route, /MAX_CATALOG_ENCOUNTERS = 16000/);
});
test("final evolution mode is shareable and the UI explains team codes and both random styles", () => {
  assert.match(lab, /params\.get\("evolutions"\) === "final"/);
  assert.match(lab, /url\.searchParams\.set\("evolutions", "final"\)/);
  assert.match(lab, /finalEvolutionOnly/);
  assert.match(lab, /Catch \$\{entry\.encounter_pokemon_name\}/);
  assert.match(lab, /Team code/);
  assert.doesNotMatch(lab, /Room code/);
  assert.match(lab, /Build a Nuzlocke Team/);
  assert.doesNotMatch(lab, /Build a seeded Run Card/);
  assert.doesNotMatch(lab, /Generate Run Card/);
  assert.match(lab, /Route-first random/);
  assert.match(lab, /Encounter-pool random/);
  assert.match(
    lab,
    /locations with more eligible entries can appear more often/,
  );
});
test("game-specific condition filters are restored and shared without leaking between games", () => {
  assert.match(lab, /params\.get\(`condition_\$\{group\.id\}`\)/);
  assert.match(lab, /url\.searchParams\.set\(`condition_\$\{group\.id\}`, value\)/);
  assert.match(lab, /conditionSelections/);
  assert.match(lab, /Encounter conditions/);
  assert.match(lab, /setMethods\(\[\]\)/);
  assert.match(lab, /includeStarter && group\.match_included_starter/);
  assert.match(lab, /disabled=\{includeStarter && group\.match_included_starter\}/);
});
test("starter inclusion is explicit in shared links and old seeded links retain their original output", () => {
  assert.match(
    lab,
    /!params\.has\("seed"\) \|\| params\.get\("starter"\) === "include"/,
  );
  assert.match(lab, /url\.searchParams\.set\("starter", "include"\)/);
  assert.match(lab, /Include a starter Pokémon/);
  assert.match(lab, /entry\.method === "starter" \? "Starter Pokémon"/);
  assert.match(route, /ruby: HOENN_STARTERS, sapphire: HOENN_STARTERS, emerald: HOENN_STARTERS/);
  assert.match(route, /firered: KANTO_STARTERS, leafgreen: KANTO_STARTERS/);
  assert.match(route, /diamond: SINNOH_STARTERS, pearl: SINNOH_STARTERS, platinum: SINNOH_STARTERS/);
  assert.match(route, /heartgold: JOHTO_STARTERS, soulsilver: JOHTO_STARTERS/);
  assert.match(route, /black: UNOVA_STARTERS, white: UNOVA_STARTERS, "black-2": UNOVA_STARTERS, "white-2": UNOVA_STARTERS/);
  assert.match(route, /x: KALOS_STARTERS, y: KALOS_STARTERS, "omega-ruby": HOENN_STARTERS, "alpha-sapphire": HOENN_STARTERS/);
  assert.match(route, /sun: ALOLA_STARTERS, moon: ALOLA_STARTERS, "ultra-sun": ALOLA_STARTERS, "ultra-moon": ALOLA_STARTERS/);
  assert.match(route, /"lets-go-pikachu": YELLOW_STARTER, "lets-go-eevee": LETS_GO_EEVEE_STARTER/);
  assert.match(route, /sword: GALAR_STARTERS, shield: GALAR_STARTERS/);
  assert.match(route, /"brilliant-diamond": SINNOH_STARTERS, "shining-pearl": SINNOH_STARTERS, "legends-arceus": HISUI_STARTERS/);
  assert.match(route, /scarlet: PALDEA_STARTERS, violet: PALDEA_STARTERS/);
});
