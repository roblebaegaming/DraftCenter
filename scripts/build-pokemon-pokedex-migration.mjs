import fs from "node:fs/promises";
import path from "node:path";

const args = new Map(
  process.argv
    .slice(2)
    .map((value, index, values) => value.startsWith("--") ? [value, values[index + 1]] : null)
    .filter(Boolean),
);
const input = String(args.get("--input") || "");
const output = String(args.get("--output") || "");
if (!input || !output) throw new Error("--input and --output are required.");

const catalog = JSON.parse(await fs.readFile(input, "utf8"));
const game = catalog.game || {};
const sourceCommit = String(catalog.source_commit || "");
const independentCommit = String(catalog.independent_source_commit || "");
if (!/^[0-9a-f]{40}$/.test(sourceCommit) || !/^[0-9a-f]{40}$/.test(independentCommit)) {
  throw new Error("The catalog must pin exact PokéAPI and independent-source commits.");
}
if (game.pokedex_status !== "verified" || game.encounter_status !== "pending") {
  throw new Error("A Pokédex-only migration must be verified for Pokédex data and pending for encounters.");
}
if (!Array.isArray(catalog.entries) || !catalog.entries.length) throw new Error("The catalog has no Pokédex entries.");

const expectedCounts = Object.fromEntries(catalog.pokedexes.map((pokedex) => [pokedex.key, pokedex.entry_count]));
for (const [key, count] of Object.entries(expectedCounts)) {
  if (catalog.entries.filter((entry) => entry.pokedex_key === key).length !== count) {
    throw new Error(`${key} does not match its reviewed entry count.`);
  }
}
if (new Set(catalog.entries.map((entry) => entry.pokemon_id)).size !== catalog.entries.length) {
  throw new Error("Pokédex-only imports currently require non-overlapping species scopes.");
}

const quoted = (value) => `'${String(value).replaceAll("'", "''")}'`;
const literal = (value) => JSON.stringify(value).replaceAll("$catalog$", "catalog");
const gameKey = quoted(game.game_key);
const displayName = quoted(game.display_name);
const coverageNote = quoted(game.coverage_note);
const family = quoted(game.family);
const entries = catalog.entries.map(({ pokedex_key, entry_number, pokemon_id, pokemon_name, form_name, species_family }) => ({
  pokedex_key,
  entry_number,
  pokemon_id,
  pokemon_name,
  form_name,
  species_family,
}));
const countAssertions = Object.entries(expectedCounts)
  .map(([key, count]) => `(select count(*) from public.pokemon_game_pokedex_entries where game_key=${gameKey} and pokedex_key=${quoted(key)})<>${count}`)
  .join(" or ");

const migrationLabel = path.basename(output).match(/_(\d+)_/)?.[1] || "unreleased";
const sql = `-- Migration ${migrationLabel} generated from ${input}
-- PokéAPI source commit: ${sourceCommit} -- gitleaks:allow -- public upstream revision pin
-- Independent Pokémon Showdown check: ${independentCommit}
-- Pokédex-only import: encounter data intentionally remains unavailable.

begin;

insert into public.pokemon_games(
  game_key, display_name, generation, family, release_order,
  source_commit, pokedex_source_commit, coverage_note,
  encounter_status, pokedex_status, starters, condition_groups
) values (
  ${gameKey}, ${displayName}, ${Number(game.generation)}, ${family}, ${Number(game.release_order)},
  '${sourceCommit}', '${sourceCommit}', ${coverageNote},
  'pending', 'verified', $catalog$${literal(game.starters || [])}$catalog$::jsonb, '[]'::jsonb
)
on conflict(game_key) do update set
  display_name = excluded.display_name,
  generation = excluded.generation,
  family = excluded.family,
  release_order = excluded.release_order,
  pokedex_source_commit = excluded.pokedex_source_commit,
  coverage_note = excluded.coverage_note,
  pokedex_status = 'verified',
  starters = excluded.starters,
  updated_at = now();

insert into public.pokemon_game_pokedex_entries(
  game_key, pokedex_key, entry_number, pokemon_id, pokemon_name,
  form_name, species_family, source_commit
)
select
  ${gameKey}, row.pokedex_key, row.entry_number, row.pokemon_id,
  row.pokemon_name, row.form_name, row.species_family, '${sourceCommit}'
from jsonb_to_recordset($catalog$${literal(entries)}$catalog$::jsonb) as row(
  pokedex_key text,
  entry_number integer,
  pokemon_id integer,
  pokemon_name text,
  form_name text,
  species_family text
)
on conflict(game_key, pokedex_key, entry_number, pokemon_id, form_name) do update set
  pokemon_name = excluded.pokemon_name,
  species_family = excluded.species_family,
  source_commit = excluded.source_commit;

do $$
begin
  if not exists (
    select 1 from public.pokemon_games
    where game_key=${gameKey}
      and pokedex_status='verified'
      and encounter_status='pending'
      and pokedex_source_commit='${sourceCommit}'
      and jsonb_array_length(starters)=${(game.starters || []).length}
  ) then
    raise exception '${String(game.display_name).replaceAll("'", "''")} capability states do not match the reviewed artifact';
  end if;
  if (select count(*) from public.pokemon_game_pokedex_entries where game_key=${gameKey})<>${entries.length}
    or ${countAssertions}
    or (select count(distinct pokemon_id) from public.pokemon_game_pokedex_entries where game_key=${gameKey})<>${entries.length}
  then
    raise exception '${String(game.display_name).replaceAll("'", "''")} Pokédex counts do not match the reviewed artifact';
  end if;
  if exists(select 1 from public.pokemon_game_locations where game_key=${gameKey})
    or exists(select 1 from public.pokemon_game_encounters where game_key=${gameKey})
  then
    raise exception '${String(game.display_name).replaceAll("'", "''")} encounter data must remain absent until separately reviewed';
  end if;
end $$;

commit;
`;

await fs.writeFile(output, sql);
console.log(`Wrote ${output} with ${entries.length} Pokédex rows and no encounters.`);
