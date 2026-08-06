import fs from "node:fs/promises";

const args = new Map(
  process.argv
    .slice(2)
    .map((value, index, list) => (value.startsWith("--") ? [value, list[index + 1]] : null))
    .filter(Boolean),
);
const input = String(args.get("--input") || "");
const output = String(args.get("--output") || "");
const commit = String(args.get("--commit") || "");

if (!input || !output) throw new Error("--input and --output are required.");
if (!/^[0-9a-f]{40}$/.test(commit)) throw new Error("--commit must be an exact 40-character source commit.");

const payload = JSON.parse(await fs.readFile(input, "utf8"));
const game = String(payload.game?.game_key || "");
if (!["red", "blue", "yellow", "gold", "silver", "crystal", "ruby", "sapphire", "emerald", "firered", "leafgreen", "diamond", "pearl", "platinum", "heartgold", "soulsilver"].includes(game)) throw new Error("The reviewed migration builder accepts only supported Generation I–IV games.");
if (!String(payload.game.coverage_note || "").includes(commit)) throw new Error("The migration commit must match the pinned catalog source.");
if (payload.encounters.length !== new Set(payload.encounters.map((row) => row.source_encounter_id)).size) {
  throw new Error("Encounter source identifiers must be unique before a migration can be generated.");
}
if (!payload.encounters.every((row) => Number.isInteger(row.source_encounter_id) && row.source_encounter_id > 0)) {
  throw new Error("Every encounter needs a positive integer source identifier.");
}

const literal = (value) => JSON.stringify(value).replaceAll("$catalog$", "catalog");
const quoted = (value) => `'${String(value).replaceAll("'", "''")}'`;
const gameSql = quoted(game);
const displayNameSql = quoted(payload.game.display_name);
const familySql = quoted(payload.game.family);
const pretRepository = game === "yellow" ? "pokeyellow" : game === "crystal" ? "pokecrystal" : ["gold", "silver"].includes(game) ? "pokegold" : ["ruby", "sapphire"].includes(game) ? "pokeruby" : game === "emerald" ? "pokeemerald" : ["firered", "leafgreen"].includes(game) ? "pokefirered" : ["diamond", "pearl"].includes(game) ? "pokediamond" : game === "platinum" ? "pokeplatinum" : ["heartgold", "soulsilver"].includes(game) ? "pokeheartgold" : "pokered";
const coverageSql = quoted(`Pinned PokéAPI snapshot; independently compared with Veekun and pret/${pretRepository} for ${payload.game.display_name}.`);
const sql = `-- Generated from ${input}
-- Source commit: ${commit}
-- Imports reviewed data as pending. Verification is a separate migration.
begin;

insert into public.pokemon_games(game_key,display_name,generation,family,release_order,source_commit,coverage_note,encounter_status,starters,condition_groups) values (${gameSql},${displayNameSql},${Number(payload.game.generation)},${familySql},${Number(payload.game.release_order)},'${commit}',${coverageSql},'pending',$catalog$${literal(payload.game.starters || [])}$catalog$::jsonb,$catalog$${literal(payload.game.condition_groups || [])}$catalog$::jsonb) on conflict(game_key) do update set display_name=excluded.display_name,generation=excluded.generation,family=excluded.family,release_order=excluded.release_order,source_commit=excluded.source_commit,coverage_note=excluded.coverage_note,encounter_status='pending',starters=excluded.starters,condition_groups=excluded.condition_groups,updated_at=now();

insert into public.pokemon_game_pokedex_entries(game_key,pokedex_key,entry_number,pokemon_id,pokemon_name,form_name,species_family,source_commit) select ${gameSql},r.pokedex_key,r.entry_number,r.pokemon_id,r.pokemon_name,r.form_name,r.species_family,'${commit}' from jsonb_to_recordset($catalog$${literal(payload.pokedex_entries)}$catalog$::jsonb) as r(pokedex_key text,entry_number integer,pokemon_id integer,pokemon_name text,form_name text,species_family text) on conflict(game_key,pokedex_key,entry_number,pokemon_id,form_name) do update set pokemon_name=excluded.pokemon_name,species_family=excluded.species_family,source_commit=excluded.source_commit;

insert into public.pokemon_game_locations(game_key,location_key,area_key,sub_area,display_name,sort_order,source_commit) select ${gameSql},r.location_key,r.area_key,r.sub_area,r.display_name,r.sort_order,'${commit}' from jsonb_to_recordset($catalog$${literal(payload.locations)}$catalog$::jsonb) as r(location_key text,area_key text,sub_area text,display_name text,sort_order integer) on conflict(game_key,area_key) do update set location_key=excluded.location_key,sub_area=excluded.sub_area,display_name=excluded.display_name,sort_order=excluded.sort_order,source_commit=excluded.source_commit;

insert into public.pokemon_game_encounters(game_key,source_encounter_id,area_key,pokemon_id,pokemon_name,form_name,species_family,method,min_level,max_level,chance,conditions,is_legendary,artwork_url,source_commit) select ${gameSql},r.source_encounter_id,r.area_key,r.pokemon_id,r.pokemon_name,r.form_name,r.species_family,r.method,r.min_level,r.max_level,r.chance,r.conditions,r.is_legendary,r.artwork_url,'${commit}' from jsonb_to_recordset($catalog$${literal(payload.encounters)}$catalog$::jsonb) as r(source_encounter_id bigint,area_key text,pokemon_id integer,pokemon_name text,form_name text,species_family text,method text,min_level smallint,max_level smallint,chance numeric,conditions text[],is_legendary boolean,artwork_url text) on conflict(game_key,source_encounter_id) do update set area_key=excluded.area_key,pokemon_id=excluded.pokemon_id,pokemon_name=excluded.pokemon_name,form_name=excluded.form_name,species_family=excluded.species_family,method=excluded.method,min_level=excluded.min_level,max_level=excluded.max_level,chance=excluded.chance,conditions=excluded.conditions,is_legendary=excluded.is_legendary,artwork_url=excluded.artwork_url,source_commit=excluded.source_commit;

do $$ begin if (select count(*) from public.pokemon_game_pokedex_entries where game_key=${gameSql} and source_commit='${commit}')<>${payload.pokedex_entries.length} or (select count(*) from public.pokemon_game_locations where game_key=${gameSql} and source_commit='${commit}')<>${payload.locations.length} or (select count(*) from public.pokemon_game_encounters where game_key=${gameSql} and source_commit='${commit}')<>${payload.encounters.length} then raise exception '${String(payload.game.display_name).replaceAll("'", "''")} catalog import counts do not match the reviewed artifact'; end if; end $$;

commit;
`;

await fs.writeFile(output, sql);
console.log(`Wrote ${output} with ${payload.encounters.length} encounter rows.`);
