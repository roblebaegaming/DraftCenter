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
]
regexes = [
  '''^5064f1d72746b3a6a931616dae3fb6445c556d4f$''',
  '''^5841d46f1a0d2b8918a29a7376b1424878b86b59$''',
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
test("server route uses public RLS catalog access and privileged rate limiting", () => {
  assert.match(route, /createPublicServerClient/);
  assert.match(route, /list_verified_nuzlocke_games/);
  assert.match(route, /eq\("encounter_status", "verified"\)/);
  assert.match(route, /consumeUserRateLimit\(adminClient/);
  assert.match(route, /get_verified_nuzlocke_encounters/);
  assert.doesNotMatch(route, /adminClient\.from\("pokemon_games"/);
});
test("final evolution requests require source-matched pinned game catalogs", () => {
  for(const game of ["red","blue","yellow","gold","silver","crystal","ruby","sapphire","emerald","firered","leafgreen","diamond","pearl","platinum","heartgold","soulsilver"]) assert.match(route,new RegExp(`${game}: ${game}EvolutionCatalog`));
  assert.match(route, /body\.finalEvolutionOnly === true/);
  assert.match(
    route,
    /evolutionCatalog\.source_commit !== game\.source_commit/,
  );
  assert.match(route, /Final evolution data is not verified/);
  assert.match(route, /MAX_CATALOG_ENCOUNTERS = 7500/);
});
test("final evolution mode is shareable and the UI explains run codes and both random styles", () => {
  assert.match(lab, /params\.get\("evolutions"\) === "final"/);
  assert.match(lab, /url\.searchParams\.set\("evolutions", "final"\)/);
  assert.match(lab, /finalEvolutionOnly/);
  assert.match(lab, /Catch \$\{entry\.encounter_pokemon_name\}/);
  assert.match(lab, /Run code/);
  assert.match(lab, /Build a Nuzlocke Team/);
  assert.doesNotMatch(lab, /Build a seeded Run Card/);
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
});
