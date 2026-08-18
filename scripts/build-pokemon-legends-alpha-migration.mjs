import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const INPUT = path.join(ROOT, "data/pokemon/pokemon-legends-alpha-availability.json");
const OUTPUT = path.join(ROOT, "supabase/migrations/20260818010002_433_legends_alpha_dex.sql");
const artifact = JSON.parse(fs.readFileSync(INPUT, "utf8"));
const sourceCommit = Object.fromEntries(artifact.games.map((game) => [game.game_key, game.source.encounter_commit]));
const rows = artifact.games.flatMap((game) => game.eligible.map((entry) => ({
  game_key: game.game_key,
  pokemon_id: entry.pokemon_id,
  eligibility_basis: entry.basis,
  source_commit: sourceCommit[game.game_key],
})));
const json = JSON.stringify(rows).replaceAll("$alpha$", "alpha");

const sql = `-- Migration 433: private Alpha Pokédex progress for Legends: Arceus and Legends: Z-A.
-- Eligibility is species-only and intentionally omits encounter locations,
-- levels, probabilities, progression requirements, and source rows.

begin;

alter table public.pokedex_trackers
  add column include_alpha boolean not null default false;

create table public.pokemon_game_alpha_species (
  game_key text not null references public.pokemon_games(game_key) on delete cascade,
  pokemon_id integer not null check (pokemon_id > 0),
  eligibility_basis text not null check (eligibility_basis in ('direct','evolution')),
  source_commit text not null check (source_commit ~ '^[0-9a-f]{40}$'),
  created_at timestamptz not null default now(),
  primary key (game_key, pokemon_id)
);

create table public.pokedex_tracker_alpha_entries (
  tracker_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  pokemon_id integer not null check (pokemon_id > 0),
  caught_at timestamptz not null default now(),
  primary key (tracker_id, pokemon_id),
  foreign key (tracker_id, user_id)
    references public.pokedex_trackers(id, user_id) on delete cascade
);

create index pokedex_tracker_alpha_entries_user_tracker_idx
  on public.pokedex_tracker_alpha_entries(user_id, tracker_id);

alter table public.pokemon_game_alpha_species enable row level security;
alter table public.pokemon_game_alpha_species force row level security;
alter table public.pokedex_tracker_alpha_entries enable row level security;
alter table public.pokedex_tracker_alpha_entries force row level security;

comment on table public.pokemon_game_alpha_species is
  'Reviewed species-level Alpha availability. Encounter detail is intentionally excluded.';
comment on table public.pokedex_tracker_alpha_entries is
  'Private account-owned Alpha Pokédex checklist progress.';

revoke all on table public.pokemon_game_alpha_species from public, anon, authenticated;
revoke all on table public.pokedex_tracker_alpha_entries from public, anon, authenticated;
grant all on table public.pokemon_game_alpha_species to service_role;
grant all on table public.pokedex_tracker_alpha_entries to service_role;

insert into public.pokemon_game_alpha_species(game_key, pokemon_id, eligibility_basis, source_commit)
select row.game_key, row.pokemon_id, row.eligibility_basis, row.source_commit
from jsonb_to_recordset($alpha$${json}$alpha$::jsonb) as row(
  game_key text,
  pokemon_id integer,
  eligibility_basis text,
  source_commit text
)
on conflict(game_key, pokemon_id) do update set
  eligibility_basis = excluded.eligibility_basis,
  source_commit = excluded.source_commit;

create or replace function public.pokedex_catalog_supports_alpha(p_catalog_key text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.pokemon_game_alpha_species alpha
    where alpha.game_key = p_catalog_key
  );
$$;

create or replace function public.get_my_pokedex_trackers()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with game_catalogs as (
    select game.game_key as catalog_key, game.display_name, game.generation,
      game.family, game.release_order, count(distinct entry.pokemon_id)::integer as total
    from public.pokemon_games game
    join public.pokemon_game_pokedex_entries entry on entry.game_key = game.game_key
    where game.pokedex_status = 'verified'
    group by game.game_key, game.display_name, game.generation, game.family, game.release_order
  ),
  alpha_catalogs as (
    select alpha.game_key as catalog_key, count(*)::integer as alpha_total
    from public.pokemon_game_alpha_species alpha
    group by alpha.game_key
  ),
  catalogs as (
    select 'home'::text as catalog_key, 'Pokémon HOME National Dex'::text as display_name,
      10::smallint as generation, 'Pokémon HOME'::text as family, 0 as release_order,
      (select count(*)::integer from public.pokedex_tracker_catalog('home')) as total
    union all
    select catalog_key, display_name, generation, family, release_order, total from game_catalogs
  ),
  direct_progress as (
    select entry.tracker_id,
      count(*) filter (where not entry.is_shiny)::integer as caught,
      count(*) filter (where entry.is_shiny)::integer as shiny_caught
    from public.pokedex_tracker_entries entry
    where entry.user_id = auth.uid()
    group by entry.tracker_id
  ),
  alpha_progress as (
    select entry.tracker_id, count(*)::integer as alpha_caught
    from public.pokedex_tracker_alpha_entries entry
    where entry.user_id = auth.uid()
    group by entry.tracker_id
  ),
  locations as (
    select location.tracker_id, count(*)::integer as location_count
    from public.pokedex_collection_locations location
    where location.user_id = auth.uid()
    group by location.tracker_id
  ),
  specimens as (
    select specimen.tracker_id, count(*)::integer as specimen_count
    from public.pokedex_collection_specimens specimen
    where specimen.user_id = auth.uid()
    group by specimen.tracker_id
  )
  select jsonb_build_object(
    'catalogs', coalesce((
      select jsonb_agg(jsonb_build_object(
        'key', catalog.catalog_key, 'name', catalog.display_name,
        'generation', catalog.generation, 'family', catalog.family, 'total', catalog.total,
        'supports_alpha', alpha_catalogs.catalog_key is not null,
        'alpha_total', coalesce(alpha_catalogs.alpha_total, 0)
      ) order by catalog.release_order, catalog.display_name)
      from catalogs catalog
      left join alpha_catalogs on alpha_catalogs.catalog_key = catalog.catalog_key
    ), '[]'::jsonb),
    'trackers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', tracker.id, 'title', tracker.title, 'catalog_key', tracker.catalog_key,
        'catalog_name', catalog.display_name, 'include_shiny', tracker.include_shiny,
        'include_alpha', tracker.include_alpha,
        'supports_alpha', alpha_catalogs.catalog_key is not null,
        'total', catalog.total, 'alpha_total', coalesce(alpha_catalogs.alpha_total, 0),
        'caught', case when tracker.catalog_key = 'home' then (
          select count(distinct progress.pokemon_id)::integer
          from public.pokedex_tracker_entries progress
          join public.pokedex_trackers source_tracker on source_tracker.id = progress.tracker_id
          where progress.user_id = auth.uid() and source_tracker.user_id = auth.uid()
            and not progress.is_shiny
            and (progress.tracker_id = tracker.id or source_tracker.catalog_key <> 'home')
            and exists (select 1 from public.pokedex_tracker_catalog('home') home_catalog
                        where home_catalog.pokemon_id = progress.pokemon_id)
        ) else coalesce(direct_progress.caught, 0) end,
        'shiny_caught', case when tracker.catalog_key = 'home' then (
          select count(distinct progress.pokemon_id)::integer
          from public.pokedex_tracker_entries progress
          join public.pokedex_trackers source_tracker on source_tracker.id = progress.tracker_id
          where progress.user_id = auth.uid() and source_tracker.user_id = auth.uid()
            and progress.is_shiny
            and (progress.tracker_id = tracker.id or source_tracker.catalog_key <> 'home')
            and exists (select 1 from public.pokedex_tracker_catalog('home') home_catalog
                        where home_catalog.pokemon_id = progress.pokemon_id)
        ) else coalesce(direct_progress.shiny_caught, 0) end,
        'alpha_caught', coalesce(alpha_progress.alpha_caught, 0),
        'location_count', coalesce(locations.location_count, 0),
        'specimen_count', coalesce(specimens.specimen_count, 0),
        'created_at', tracker.created_at, 'updated_at', tracker.updated_at
      ) order by tracker.updated_at desc)
      from public.pokedex_trackers tracker
      join catalogs catalog on catalog.catalog_key = tracker.catalog_key
      left join alpha_catalogs on alpha_catalogs.catalog_key = tracker.catalog_key
      left join direct_progress on direct_progress.tracker_id = tracker.id
      left join alpha_progress on alpha_progress.tracker_id = tracker.id
      left join locations on locations.tracker_id = tracker.id
      left join specimens on specimens.tracker_id = tracker.id
      where tracker.user_id = auth.uid()
    ), '[]'::jsonb)
  );
$$;

create or replace function public.get_my_pokedex_tracker(p_tracker_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_tracker public.pokedex_trackers%rowtype;
  v_catalog_name text;
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception 'Sign in to open a Pokédex tracker.' using errcode = '42501';
  end if;
  select * into v_tracker from public.pokedex_trackers
  where id = p_tracker_id and user_id = auth.uid();
  if not found then return null; end if;
  select case when v_tracker.catalog_key = 'home' then 'Pokémon HOME National Dex' else game.display_name end
  into v_catalog_name from (select 1) seed
  left join public.pokemon_games game on game.game_key = v_tracker.catalog_key;

  select jsonb_build_object(
    'tracker', jsonb_build_object(
      'id', v_tracker.id, 'title', v_tracker.title, 'catalog_key', v_tracker.catalog_key,
      'catalog_name', v_catalog_name, 'include_shiny', v_tracker.include_shiny,
      'include_alpha', v_tracker.include_alpha,
      'supports_alpha', public.pokedex_catalog_supports_alpha(v_tracker.catalog_key),
      'created_at', v_tracker.created_at, 'updated_at', v_tracker.updated_at
    ),
    'pokemon', coalesce(jsonb_agg(jsonb_build_object(
      'pokemon_id', catalog.pokemon_id, 'pokemon', catalog.pokemon_name,
      'dex_number', catalog.dex_number, 'pokedex_key', catalog.pokedex_key,
      'caught', exists(
        select 1 from public.pokedex_tracker_entries progress
        join public.pokedex_trackers source_tracker on source_tracker.id = progress.tracker_id
        where progress.user_id = auth.uid() and source_tracker.user_id = auth.uid()
          and progress.pokemon_id = catalog.pokemon_id and not progress.is_shiny
          and (progress.tracker_id = v_tracker.id
               or (v_tracker.catalog_key = 'home' and source_tracker.catalog_key <> 'home'))
      ),
      'shiny_caught', exists(
        select 1 from public.pokedex_tracker_entries progress
        join public.pokedex_trackers source_tracker on source_tracker.id = progress.tracker_id
        where progress.user_id = auth.uid() and source_tracker.user_id = auth.uid()
          and progress.pokemon_id = catalog.pokemon_id and progress.is_shiny
          and (progress.tracker_id = v_tracker.id
               or (v_tracker.catalog_key = 'home' and source_tracker.catalog_key <> 'home'))
      ),
      'alpha_eligible', exists(
        select 1 from public.pokemon_game_alpha_species alpha
        where alpha.game_key = v_tracker.catalog_key and alpha.pokemon_id = catalog.pokemon_id
      ),
      'alpha_caught', exists(
        select 1 from public.pokedex_tracker_alpha_entries alpha_progress
        where alpha_progress.tracker_id = v_tracker.id
          and alpha_progress.user_id = auth.uid()
          and alpha_progress.pokemon_id = catalog.pokemon_id
      ),
      'pokeball', coalesce(standard_detail.pokeball_key, ''),
      'ribbons', coalesce(standard_detail.ribbon_keys, '{}'::text[]),
      'notes', coalesce(standard_detail.notes, ''),
      'shiny_pokeball', coalesce(shiny_detail.pokeball_key, ''),
      'shiny_ribbons', coalesce(shiny_detail.ribbon_keys, '{}'::text[]),
      'shiny_notes', coalesce(shiny_detail.notes, '')
    ) order by catalog.sort_order, catalog.pokemon_name), '[]'::jsonb)
  ) into v_result
  from public.pokedex_tracker_catalog(v_tracker.catalog_key) catalog
  left join public.pokedex_tracker_entry_details standard_detail
    on standard_detail.tracker_id = v_tracker.id and standard_detail.user_id = auth.uid()
   and standard_detail.pokemon_id = catalog.pokemon_id and not standard_detail.is_shiny
  left join public.pokedex_tracker_entry_details shiny_detail
    on shiny_detail.tracker_id = v_tracker.id and shiny_detail.user_id = auth.uid()
   and shiny_detail.pokemon_id = catalog.pokemon_id and shiny_detail.is_shiny;
  return v_result;
end;
$$;

create function public.create_my_pokedex_tracker(
  p_catalog_key text,
  p_title text,
  p_include_shiny boolean,
  p_include_alpha boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_created jsonb;
begin
  if coalesce(p_include_alpha, false) and not public.pokedex_catalog_supports_alpha(p_catalog_key) then
    raise exception 'Alpha Dex is available only for supported Pokémon Legends games.' using errcode = '22023';
  end if;
  v_created := public.create_my_pokedex_tracker(p_catalog_key, p_title, p_include_shiny);
  if coalesce(p_include_alpha, false) then
    update public.pokedex_trackers set include_alpha = true
    where id = (v_created ->> 'id')::uuid and user_id = auth.uid();
  end if;
  return v_created || jsonb_build_object('include_alpha', coalesce(p_include_alpha, false));
end;
$$;

create function public.update_my_pokedex_tracker(
  p_tracker_id uuid,
  p_title text,
  p_include_shiny boolean,
  p_include_alpha boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_updated jsonb;
  v_tracker public.pokedex_trackers%rowtype;
begin
  select * into v_tracker from public.pokedex_trackers
  where id = p_tracker_id and user_id = auth.uid();
  if not found then raise exception 'That Pokédex tracker was not found.' using errcode = 'P0002'; end if;
  if coalesce(p_include_alpha, false) and not public.pokedex_catalog_supports_alpha(v_tracker.catalog_key) then
    raise exception 'Alpha Dex is available only for supported Pokémon Legends games.' using errcode = '22023';
  end if;
  v_updated := public.update_my_pokedex_tracker(p_tracker_id, p_title, p_include_shiny);
  if coalesce(p_include_alpha, false) then
    update public.pokedex_trackers set include_alpha = true, updated_at = now()
    where id = p_tracker_id and user_id = auth.uid();
  end if;
  return v_updated || jsonb_build_object('include_alpha', v_tracker.include_alpha or coalesce(p_include_alpha, false));
end;
$$;

create or replace function public.set_my_pokedex_tracker_alpha_entry(
  p_tracker_id uuid,
  p_pokemon_id integer,
  p_caught boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tracker public.pokedex_trackers%rowtype;
  v_alpha_caught integer;
begin
  if auth.uid() is null then
    raise exception 'Sign in to save Alpha Pokédex progress.' using errcode = '42501';
  end if;
  select * into v_tracker from public.pokedex_trackers
  where id = p_tracker_id and user_id = auth.uid() for update;
  if not found then raise exception 'That Pokédex tracker was not found.' using errcode = 'P0002'; end if;
  if not v_tracker.include_alpha then
    raise exception 'Enable the Alpha Dex before saving Alpha progress.' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.pokemon_game_alpha_species alpha
    where alpha.game_key = v_tracker.catalog_key and alpha.pokemon_id = p_pokemon_id
  ) then
    raise exception 'That species cannot be obtained as an Alpha in this game.' using errcode = '22023';
  end if;
  if coalesce(p_caught, false) then
    insert into public.pokedex_tracker_alpha_entries(tracker_id, user_id, pokemon_id)
    values(v_tracker.id, auth.uid(), p_pokemon_id)
    on conflict(tracker_id, pokemon_id) do nothing;
  else
    delete from public.pokedex_tracker_alpha_entries
    where tracker_id = v_tracker.id and user_id = auth.uid() and pokemon_id = p_pokemon_id;
  end if;
  update public.pokedex_trackers set updated_at = now()
  where id = v_tracker.id and user_id = auth.uid();
  select count(*)::integer into v_alpha_caught
  from public.pokedex_tracker_alpha_entries
  where tracker_id = v_tracker.id and user_id = auth.uid();
  return jsonb_build_object('alpha_caught', v_alpha_caught);
end;
$$;

-- Wrap the established v3 backup functions so old files remain compatible
-- while new backups preserve Alpha progress.
alter function public.export_my_pokedex_trackers() rename to export_my_pokedex_trackers_v3;
revoke all on function public.export_my_pokedex_trackers_v3() from public, anon, authenticated;

create function public.export_my_pokedex_trackers()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_export jsonb;
  v_trackers jsonb := '[]'::jsonb;
  v_tracker jsonb;
  v_tracker_id uuid;
  v_include_alpha boolean;
  v_alpha_entries jsonb;
begin
  v_export := public.export_my_pokedex_trackers_v3();
  for v_tracker in select value from jsonb_array_elements(v_export -> 'trackers') loop
    v_tracker_id := (v_tracker ->> 'id')::uuid;
    select tracker.include_alpha into v_include_alpha from public.pokedex_trackers tracker
    where tracker.id = v_tracker_id and tracker.user_id = auth.uid();
    select coalesce(jsonb_agg(jsonb_build_object(
      'pokemon_id', alpha.pokemon_id,
      'pokemon', catalog.pokemon_name,
      'dex_number', catalog.dex_number,
      'is_shiny', false,
      'is_alpha', true,
      'caught_at', alpha.caught_at
    ) order by catalog.sort_order), '[]'::jsonb)
    into v_alpha_entries
    from public.pokedex_tracker_alpha_entries alpha
    join public.pokedex_trackers tracker on tracker.id = alpha.tracker_id
    join public.pokedex_tracker_catalog(tracker.catalog_key) catalog on catalog.pokemon_id = alpha.pokemon_id
    where alpha.tracker_id = v_tracker_id and alpha.user_id = auth.uid();
    v_trackers := v_trackers || jsonb_build_array(
      v_tracker || jsonb_build_object(
        'include_alpha', coalesce(v_include_alpha, false),
        'entries', coalesce(v_tracker -> 'entries', '[]'::jsonb) || v_alpha_entries
      )
    );
  end loop;
  return v_export || jsonb_build_object('version', 4, 'trackers', v_trackers);
end;
$$;

alter function public.restore_my_pokedex_trackers(jsonb) rename to restore_my_pokedex_trackers_v3;
revoke all on function public.restore_my_pokedex_trackers_v3(jsonb) from public, anon, authenticated;

create function public.restore_my_pokedex_trackers(p_trackers jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sanitized jsonb := '[]'::jsonb;
  v_tracker jsonb;
  v_entries jsonb;
  v_result jsonb;
  v_index integer := 0;
  v_destination uuid;
  v_entry jsonb;
begin
  if p_trackers is null or jsonb_typeof(p_trackers) <> 'array' then
    raise exception 'Restore a list of Pokédex trackers.' using errcode = '22023';
  end if;
  for v_tracker in select value from jsonb_array_elements(p_trackers) loop
    select coalesce(jsonb_agg(value), '[]'::jsonb) into v_entries
    from jsonb_array_elements(coalesce(v_tracker -> 'entries', '[]'::jsonb))
    where coalesce((value ->> 'is_alpha')::boolean, false) = false;
    v_sanitized := v_sanitized || jsonb_build_array(
      (v_tracker - 'entries' - 'include_alpha') || jsonb_build_object('entries', v_entries)
    );
  end loop;
  v_result := public.restore_my_pokedex_trackers_v3(v_sanitized);
  for v_tracker in select value from jsonb_array_elements(p_trackers) loop
    v_destination := (v_result -> 'tracker_ids' ->> v_index)::uuid;
    if coalesce((v_tracker ->> 'include_alpha')::boolean, false) then
      if not exists (
        select 1 from public.pokedex_trackers tracker
        where tracker.id = v_destination and tracker.user_id = auth.uid()
          and public.pokedex_catalog_supports_alpha(tracker.catalog_key)
      ) then
        raise exception 'An Alpha Dex backup targets a game without Alpha support.' using errcode = '22023';
      end if;
      update public.pokedex_trackers set include_alpha = true
      where id = v_destination and user_id = auth.uid();
      for v_entry in
        select value from jsonb_array_elements(coalesce(v_tracker -> 'entries', '[]'::jsonb))
        where coalesce((value ->> 'is_alpha')::boolean, false) = true
      loop
        perform public.set_my_pokedex_tracker_alpha_entry(
          v_destination, (v_entry ->> 'pokemon_id')::integer, true
        );
      end loop;
    end if;
    v_index := v_index + 1;
  end loop;
  return v_result || jsonb_build_object('version', 4);
end;
$$;

revoke all on function public.pokedex_catalog_supports_alpha(text) from public, anon, authenticated;
revoke all on function public.get_my_pokedex_trackers() from public, anon, authenticated;
revoke all on function public.get_my_pokedex_tracker(uuid) from public, anon, authenticated;
revoke all on function public.create_my_pokedex_tracker(text,text,boolean,boolean) from public, anon, authenticated;
revoke all on function public.update_my_pokedex_tracker(uuid,text,boolean,boolean) from public, anon, authenticated;
revoke all on function public.set_my_pokedex_tracker_alpha_entry(uuid,integer,boolean) from public, anon, authenticated;
revoke all on function public.export_my_pokedex_trackers() from public, anon, authenticated;
revoke all on function public.restore_my_pokedex_trackers(jsonb) from public, anon, authenticated;

grant execute on function public.pokedex_catalog_supports_alpha(text) to service_role;
grant execute on function public.get_my_pokedex_trackers() to authenticated, service_role;
grant execute on function public.get_my_pokedex_tracker(uuid) to authenticated, service_role;
grant execute on function public.create_my_pokedex_tracker(text,text,boolean,boolean) to authenticated, service_role;
grant execute on function public.update_my_pokedex_tracker(uuid,text,boolean,boolean) to authenticated, service_role;
grant execute on function public.set_my_pokedex_tracker_alpha_entry(uuid,integer,boolean) to authenticated, service_role;
grant execute on function public.export_my_pokedex_trackers() to authenticated, service_role;
grant execute on function public.restore_my_pokedex_trackers(jsonb) to authenticated, service_role;

do $$
begin
  if (select count(*) from public.pokemon_game_alpha_species where game_key = 'legends-arceus') <> 224
     or (select count(*) from public.pokemon_game_alpha_species where game_key = 'legends-za') <> 339 then
    raise exception 'Legends Alpha eligibility counts do not match the reviewed artifact';
  end if;
  if exists (
    select 1 from public.pokemon_game_alpha_species alpha
    where not exists (
      select 1 from public.pokemon_game_pokedex_entries entry
      where entry.game_key = alpha.game_key and entry.pokemon_id = alpha.pokemon_id
    )
  ) then
    raise exception 'Alpha eligibility must remain inside each verified game Pokédex';
  end if;
  if not (select relrowsecurity and relforcerowsecurity from pg_class
          where oid = 'public.pokemon_game_alpha_species'::regclass)
     or not (select relrowsecurity and relforcerowsecurity from pg_class
             where oid = 'public.pokedex_tracker_alpha_entries'::regclass)
     or exists (
       select 1 from pg_policies where schemaname = 'public'
         and tablename in ('pokemon_game_alpha_species','pokedex_tracker_alpha_entries')
     ) then
    raise exception 'Alpha tables must retain forced RLS without direct browser policies';
  end if;
  if has_table_privilege('anon', 'public.pokemon_game_alpha_species', 'SELECT')
     or has_table_privilege('authenticated', 'public.pokemon_game_alpha_species', 'SELECT')
     or has_table_privilege('authenticated', 'public.pokedex_tracker_alpha_entries', 'SELECT')
     or has_function_privilege('anon', 'public.set_my_pokedex_tracker_alpha_entry(uuid,integer,boolean)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.set_my_pokedex_tracker_alpha_entry(uuid,integer,boolean)', 'EXECUTE') then
    raise exception 'Alpha table or function grants are incorrect';
  end if;
end;
$$;

commit;
notify pgrst, 'reload schema';
`;

const output = `${sql.trim()}\n`;
if (process.argv.includes("--check")) {
  if (!fs.existsSync(OUTPUT) || fs.readFileSync(OUTPUT, "utf8") !== output) {
    throw new Error("The checked-in Legends Alpha migration is stale.");
  }
  console.log("Legends Alpha migration verified: 563 species rows.");
} else {
  fs.writeFileSync(OUTPUT, output);
  console.log(`Wrote ${path.relative(ROOT, OUTPUT)} with ${rows.length} eligibility rows.`);
}
