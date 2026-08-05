import test from "node:test"; import assert from "node:assert/strict"; import fs from "node:fs";
const migration=fs.readFileSync(new URL("../supabase/256-versioned-pokemon-encounter-catalog.sql",import.meta.url),"utf8");
const imported=fs.readFileSync(new URL("../supabase/257-import-pokemon-red-encounter-catalog.sql",import.meta.url),"utf8");
const verified=fs.readFileSync(new URL("../supabase/258-verify-pokemon-red-encounter-catalog.sql",import.meta.url),"utf8");
const artifactSource=fs.readFileSync(new URL("../data/nuzlocke/pokemon-red.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json",import.meta.url),"utf8");
const artifact=JSON.parse(artifactSource);const leakConfig=fs.readFileSync(new URL("../.gitleaks.toml",import.meta.url),"utf8").replace(/\r\n/g,"\n");
const route=fs.readFileSync(new URL("../src/app/api/nuzlocke/route.js",import.meta.url),"utf8");
test("catalog is verified-only and browser read-only",()=>{ for(const table of ["pokemon_games","pokemon_game_pokedex_entries","pokemon_game_locations","pokemon_game_encounters"]) assert.match(migration,new RegExp(`alter table public\\.${table} enable row level security`)); assert.match(migration,/encounter_status = 'verified'/); assert.match(migration,/revoke all on public\.pokemon_games[\s\S]+from public, anon, authenticated/); assert.doesNotMatch(migration,/grant (insert|update|delete|all)[^;]+to anon/i); });
test("source pins, fail-closed statuses, and lookup indexes are required",()=>{ assert.ok((migration.match(/source_commit text not null check/g)||[]).length>=4); assert.match(migration,/pending','partial','verified','unsupported/); assert.match(migration,/game_area_idx/); assert.match(migration,/game_species_idx/); });
test("Red imports pending and verifies only the exact reviewed snapshot",()=>{ assert.match(imported,/encounter_status\) values \('red'[\s\S]+,'pending'\)/); assert.doesNotMatch(imported,/encounter_status='verified'/); assert.match(verified,/count\(\*\)[\s\S]+<> 151/); assert.match(verified,/count\(\*\)[\s\S]+<> 74/); assert.match(verified,/count\(\*\)[\s\S]+<> 891/); assert.match(verified,/where game_key='red'[\s\S]+encounter_status='pending'/); });
test("reviewed Red artifact is pinned, complete, and collision free",()=>{ assert.equal(artifact.pokedex_entries.length,151); assert.equal(artifact.locations.length,74); assert.equal(artifact.encounters.length,891); assert.equal(new Set(artifact.locations.map((row)=>row.area_key)).size,74); assert.ok(artifact.encounters.every((row)=>artifact.locations.some((area)=>area.area_key===row.area_key))); assert.ok(artifact.encounters.every((row)=>row.artwork_url.includes("5841d46f1a0d2b8918a29a7376b1424878b86b59"))); });
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
description = "Pinned Pokemon Red import public location identifiers"
condition = "AND"
regexTarget = "match"
paths = [
  '''^supabase/257-import-pokemon-red-encounter-catalog\\.sql$''',
]
regexes = [
  '''^(?:area_key|location_key)"\\s*:\\s*"[a-z0-9-]+"$''',
]
`;assert.equal(leakConfig,expected);const migrationPayloads=[...imported.matchAll(/\$catalog\$(.+?)\$catalog\$/g)].map((match)=>JSON.parse(match[1]));assert.deepEqual(migrationPayloads[0],artifact.pokedex_entries);assert.deepEqual(migrationPayloads[1],artifact.locations);assert.deepEqual(migrationPayloads[2],artifact.encounters);assert.ok(artifact.locations.every((row)=>/^[a-z0-9-]+$/.test(row.location_key)&&/^[a-z0-9-]+$/.test(row.area_key)));assert.ok(artifact.encounters.every((row)=>/^[a-z0-9-]+$/.test(row.area_key))); });
test("server route hides unverified metadata and rate limits generation",()=>{ assert.match(route,/eq\("encounter_status", "verified"\)/); assert.match(route,/verifiedKeys\.has\(row\.game_key\)/); assert.match(route,/consumeUserRateLimit/); assert.match(route,/get_verified_nuzlocke_encounters/); });
