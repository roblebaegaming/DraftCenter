import test from "node:test"; import assert from "node:assert/strict"; import fs from "node:fs";
const migration=fs.readFileSync(new URL("../supabase/261-versioned-pokemon-encounter-catalog.sql",import.meta.url),"utf8");
const imported=fs.readFileSync(new URL("../supabase/262-import-pokemon-red-encounter-catalog.sql",import.meta.url),"utf8");
const verified=fs.readFileSync(new URL("../supabase/263-verify-pokemon-red-encounter-catalog.sql",import.meta.url),"utf8");
const artifactSource=fs.readFileSync(new URL("../data/nuzlocke/pokemon-red.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json",import.meta.url),"utf8");
const artifact=JSON.parse(artifactSource);const leakConfig=fs.readFileSync(new URL("../.gitleaks.toml",import.meta.url),"utf8").replace(/\r\n/g,"\n");
const evolutionArtifact=JSON.parse(fs.readFileSync(new URL("../data/nuzlocke/pokemon-red-evolutions.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json",import.meta.url),"utf8"));
const route=fs.readFileSync(new URL("../src/app/api/nuzlocke/route.js",import.meta.url),"utf8");
const lab=fs.readFileSync(new URL("../src/components/NuzlockeLab.jsx",import.meta.url),"utf8");
const summaryMigration=fs.readFileSync(new URL("../supabase/264-bounded-nuzlocke-game-summary.sql",import.meta.url),"utf8");
test("catalog is verified-only and browser read-only",()=>{ for(const table of ["pokemon_games","pokemon_game_pokedex_entries","pokemon_game_locations","pokemon_game_encounters"]) assert.match(migration,new RegExp(`alter table public\\.${table} enable row level security`)); assert.match(migration,/encounter_status = 'verified'/); assert.match(migration,/revoke all on public\.pokemon_games[\s\S]+from public, anon, authenticated/); assert.doesNotMatch(migration,/grant (insert|update|delete|all)[^;]+to anon/i); });
test("source pins, fail-closed statuses, and lookup indexes are required",()=>{ assert.ok((migration.match(/source_commit text not null check/g)||[]).length>=4); assert.match(migration,/pending','partial','verified','unsupported/); assert.match(migration,/source_encounter_id bigint not null check \(source_encounter_id > 0\)/); assert.match(migration,/unique \(game_key, source_encounter_id\)/); assert.match(migration,/game_area_idx/); assert.match(migration,/game_species_idx/); });
test("Red imports pending and verifies only the exact reviewed snapshot",()=>{ assert.match(imported,/encounter_status\) values \('red'[\s\S]+,'pending'\)/); assert.doesNotMatch(imported,/encounter_status='verified'/); assert.match(imported,/on conflict\(game_key,source_encounter_id\)/); assert.match(verified,/count\(\*\)[\s\S]+<> 151/); assert.match(verified,/count\(\*\)[\s\S]+<> 74/); assert.match(verified,/count\(\*\)[\s\S]+<> 891/); assert.match(verified,/where game_key='red'[\s\S]+encounter_status='pending'/); });
test("reviewed Red artifact is pinned, complete, and collision free",()=>{ assert.equal(artifact.pokedex_entries.length,151); assert.equal(artifact.locations.length,74); assert.equal(artifact.encounters.length,891); assert.equal(new Set(artifact.locations.map((row)=>row.area_key)).size,74); assert.equal(new Set(artifact.encounters.map((row)=>row.source_encounter_id)).size,891); assert.ok(artifact.encounters.every((row)=>Number.isInteger(row.source_encounter_id)&&row.source_encounter_id>0)); assert.ok(artifact.encounters.every((row)=>artifact.locations.some((area)=>area.area_key===row.area_key))); assert.ok(artifact.encounters.every((row)=>row.artwork_url.includes("5841d46f1a0d2b8918a29a7376b1424878b86b59"))); });
test("Red evolution mapping is pinned, complete for encounters, and game-specific",()=>{
  assert.equal(evolutionArtifact.game_key,"red");
  assert.equal(evolutionArtifact.source_commit,"5064f1d72746b3a6a931616dae3fb6445c556d4f");
  assert.equal(evolutionArtifact.sprites_commit,"5841d46f1a0d2b8918a29a7376b1424878b86b59");
  const encounterIds=new Set(artifact.encounters.map((row)=>row.pokemon_id));
  const mappedIds=new Set(evolutionArtifact.evolutions.map((row)=>row.pokemon_id));
  assert.deepEqual(mappedIds,encounterIds);
  assert.ok(evolutionArtifact.evolutions.every((row)=>row.final_evolutions.length&&row.final_evolutions.every((final)=>final.artwork_url.includes(evolutionArtifact.sprites_commit))));
  const finals=(id)=>evolutionArtifact.evolutions.find((row)=>row.pokemon_id===id).final_evolutions.map((row)=>row.pokemon_name);
  assert.deepEqual(finals(16),["Pidgeot"]);
  assert.deepEqual(finals(41),["Golbat"]);
  assert.deepEqual(finals(95),["Onix"]);
  assert.deepEqual(finals(133),["Vaporeon","Jolteon","Flareon"]);
});
test("secret-scan allowlist covers only reviewed public area identifiers",()=>{ const expected=`title = "DraftCenter gitleaks configuration"

[extend]
useDefault = true

[[rules]]
id = "generic-api-key"

[[rules.allowlists]]
description = "Pinned Pokemon Red artifact public location identifiers"
condition = "AND"
regexTarget = "match"
paths = [
  '''^data/nuzlocke/pokemon-red\\.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f\\.json$''',
]
regexes = [
  '''^(?:area_key|location_key)"\\s*:\\s*"[a-z0-9-]+"$''',
]

[[rules.allowlists]]
description = "Pinned Pokemon Red import public location identifiers, current and historical paths"
condition = "AND"
regexTarget = "match"
paths = [
  '''^supabase/257-import-pokemon-red-encounter-catalog\\.sql$''',
  '''^supabase/262-import-pokemon-red-encounter-catalog\\.sql$''',
]
regexes = [
  '''^(?:area_key|location_key)"\\s*:\\s*"[a-z0-9-]+"$''',
]
`;assert.equal(leakConfig,expected);const migrationPayloads=[...imported.matchAll(/\$catalog\$(.+?)\$catalog\$/g)].map((match)=>JSON.parse(match[1]));assert.deepEqual(migrationPayloads[0],artifact.pokedex_entries);assert.deepEqual(migrationPayloads[1],artifact.locations);assert.deepEqual(migrationPayloads[2],artifact.encounters);assert.ok(artifact.locations.every((row)=>/^[a-z0-9-]+$/.test(row.location_key)&&/^[a-z0-9-]+$/.test(row.area_key)));assert.ok(artifact.encounters.every((row)=>/^[a-z0-9-]+$/.test(row.area_key))); });
test("verified game summaries are bounded, RLS-backed, and browser read-only",()=>{ assert.match(summaryMigration,/list_verified_nuzlocke_games/); assert.match(summaryMigration,/security invoker/); assert.match(summaryMigration,/encounter_status='verified'/); assert.match(summaryMigration,/limit 100/); assert.match(summaryMigration,/grant execute[^;]+to anon, authenticated/); });
test("server route uses public RLS catalog access and privileged rate limiting",()=>{ assert.match(route,/createPublicServerClient/); assert.match(route,/list_verified_nuzlocke_games/); assert.match(route,/eq\("encounter_status", "verified"\)/); assert.match(route,/consumeUserRateLimit\(adminClient/); assert.match(route,/get_verified_nuzlocke_encounters/); assert.doesNotMatch(route,/adminClient\.from\("pokemon_games"/); });
test("final evolution requests require a source-matched pinned catalog",()=>{ assert.match(route,/body\.finalEvolutionOnly === true/); assert.match(route,/evolutionCatalog\.source_commit !== game\.source_commit/); assert.match(route,/Final evolution data is not verified/); });
test("final evolution mode is shareable and preserves catch context in the UI",()=>{ assert.match(lab,/params\.get\("evolutions"\) === "final"/); assert.match(lab,/url\.searchParams\.set\("evolutions", "final"\)/); assert.match(lab,/finalEvolutionOnly/); assert.match(lab,/Catch \$\{entry\.encounter_pokemon_name\}/); });
