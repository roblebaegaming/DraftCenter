-- Migration 408: present every reviewed regional/DLC Pokédex in its own
-- in-game number order and let game progress contribute to the account's
-- Pokémon HOME National Dex without copying or moving private records.

begin;

create index if not exists pokemon_game_pokedex_species_game_idx
  on public.pokemon_game_pokedex_entries(pokemon_id, game_key, pokedex_key, entry_number);
create index if not exists pokemon_game_encounters_game_pokemon_idx
  on public.pokemon_game_encounters(game_key, pokemon_id, id);

create or replace function public.pokedex_tracker_catalog(p_catalog_key text)
returns table(
  pokemon_id integer,
  pokemon_name text,
  dex_number integer,
  pokedex_key text,
  sort_order bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with available as (
    select
      entry.pokemon_id,
      entry.pokemon_name,
      entry.entry_number,
      entry.pokedex_key,
      entry.id,
      row_number() over (
        partition by entry.pokemon_id,
          case when p_catalog_key = 'home' then 'national' else entry.pokedex_key end
        order by
          case when nullif(entry.form_name, '') is null then 0 else 1 end,
          entry.id
      ) as species_row
    from public.pokemon_game_pokedex_entries entry
    join public.pokemon_games game on game.game_key = entry.game_key
    where game.encounter_status = 'verified'
      and (
        (p_catalog_key = 'home' and entry.pokemon_id < 10000)
        or entry.game_key = p_catalog_key
      )
  ),
  canonical as (
    select
      available.pokemon_id,
      available.pokemon_name,
      case when p_catalog_key = 'home' then available.pokemon_id else available.entry_number end as dex_number,
      case when p_catalog_key = 'home' then 'national' else available.pokedex_key end as pokedex_key,
      case when p_catalog_key = 'home' then available.pokemon_id::bigint else
        (
          case available.pokedex_key
            when 'kalos-coastal' then 1
            when 'kalos-mountain' then 2
            when 'original-melemele' then 1
            when 'updated-melemele' then 1
            when 'original-akala' then 2
            when 'updated-akala' then 2
            when 'original-ulaula' then 3
            when 'updated-ulaula' then 3
            when 'original-poni' then 4
            when 'updated-poni' then 4
            when 'isle-of-armor' then 1
            when 'crown-tundra' then 2
            when 'kitakami' then 1
            when 'blueberry' then 2
            else 0
          end::bigint * 1000000
        ) + available.entry_number::bigint
      end as sort_order
    from available
    where available.species_row = 1
  ),
  home_supplement as (
    select
      supplement.pokemon_id,
      supplement.pokemon_name,
      supplement.pokemon_id as dex_number,
      'national'::text as pokedex_key,
      supplement.pokemon_id::bigint as sort_order
    from (values
      (719, 'Diancie'::text),
      (720, 'Hoopa'::text),
      (721, 'Volcanion'::text)
    ) supplement(pokemon_id, pokemon_name)
    where p_catalog_key = 'home'
      and not exists (
        select 1 from canonical
        where canonical.pokemon_id = supplement.pokemon_id
      )
  )
  select * from canonical
  union all
  select * from home_supplement
  order by sort_order, pokemon_name;
$$;

create or replace function public.get_my_pokedex_trackers()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with game_catalogs as (
    select
      game.game_key as catalog_key,
      game.display_name,
      game.generation,
      game.family,
      game.release_order,
      count(distinct entry.pokemon_id)::integer as total
    from public.pokemon_games game
    join public.pokemon_game_pokedex_entries entry on entry.game_key = game.game_key
    where game.encounter_status = 'verified'
    group by game.game_key, game.display_name, game.generation, game.family, game.release_order
  ),
  catalogs as (
    select
      'home'::text as catalog_key,
      'Pokémon HOME National Dex'::text as display_name,
      10::smallint as generation,
      'Pokémon HOME'::text as family,
      0 as release_order,
      (select count(*)::integer from public.pokedex_tracker_catalog('home')) as total
    union all
    select catalog_key, display_name, generation, family, release_order, total from game_catalogs
  ),
  direct_progress as (
    select
      entry.tracker_id,
      count(*) filter (where not entry.is_shiny)::integer as caught,
      count(*) filter (where entry.is_shiny)::integer as shiny_caught
    from public.pokedex_tracker_entries entry
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
        'key', catalog.catalog_key,
        'name', catalog.display_name,
        'generation', catalog.generation,
        'family', catalog.family,
        'total', catalog.total
      ) order by catalog.release_order, catalog.display_name)
      from catalogs catalog
    ), '[]'::jsonb),
    'trackers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', tracker.id,
        'title', tracker.title,
        'catalog_key', tracker.catalog_key,
        'catalog_name', catalog.display_name,
        'include_shiny', tracker.include_shiny,
        'total', catalog.total,
        'caught', case when tracker.catalog_key = 'home' then (
          select count(distinct progress.pokemon_id)::integer
          from public.pokedex_tracker_entries progress
          join public.pokedex_trackers source_tracker on source_tracker.id = progress.tracker_id
          where progress.user_id = auth.uid()
            and source_tracker.user_id = auth.uid()
            and not progress.is_shiny
            and (progress.tracker_id = tracker.id or source_tracker.catalog_key <> 'home')
            and exists (
              select 1 from public.pokedex_tracker_catalog('home') home_catalog
              where home_catalog.pokemon_id = progress.pokemon_id
            )
        ) else coalesce(direct_progress.caught, 0) end,
        'shiny_caught', case when tracker.catalog_key = 'home' then (
          select count(distinct progress.pokemon_id)::integer
          from public.pokedex_tracker_entries progress
          join public.pokedex_trackers source_tracker on source_tracker.id = progress.tracker_id
          where progress.user_id = auth.uid()
            and source_tracker.user_id = auth.uid()
            and progress.is_shiny
            and (progress.tracker_id = tracker.id or source_tracker.catalog_key <> 'home')
            and exists (
              select 1 from public.pokedex_tracker_catalog('home') home_catalog
              where home_catalog.pokemon_id = progress.pokemon_id
            )
        ) else coalesce(direct_progress.shiny_caught, 0) end,
        'location_count', coalesce(locations.location_count, 0),
        'specimen_count', coalesce(specimens.specimen_count, 0),
        'created_at', tracker.created_at,
        'updated_at', tracker.updated_at
      ) order by tracker.updated_at desc)
      from public.pokedex_trackers tracker
      join catalogs catalog on catalog.catalog_key = tracker.catalog_key
      left join direct_progress on direct_progress.tracker_id = tracker.id
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

  select * into v_tracker
  from public.pokedex_trackers
  where id = p_tracker_id and user_id = auth.uid();

  if not found then
    return null;
  end if;

  select case
    when v_tracker.catalog_key = 'home' then 'Pokémon HOME National Dex'
    else game.display_name
  end into v_catalog_name
  from (select 1) seed
  left join public.pokemon_games game on game.game_key = v_tracker.catalog_key;

  select jsonb_build_object(
    'tracker', jsonb_build_object(
      'id', v_tracker.id,
      'title', v_tracker.title,
      'catalog_key', v_tracker.catalog_key,
      'catalog_name', v_catalog_name,
      'include_shiny', v_tracker.include_shiny,
      'created_at', v_tracker.created_at,
      'updated_at', v_tracker.updated_at
    ),
    'pokemon', coalesce(jsonb_agg(jsonb_build_object(
      'pokemon_id', catalog.pokemon_id,
      'pokemon', catalog.pokemon_name,
      'dex_number', catalog.dex_number,
      'pokedex_key', catalog.pokedex_key,
      'caught', exists(
        select 1
        from public.pokedex_tracker_entries progress
        join public.pokedex_trackers source_tracker on source_tracker.id = progress.tracker_id
        where progress.user_id = auth.uid()
          and source_tracker.user_id = auth.uid()
          and progress.pokemon_id = catalog.pokemon_id
          and not progress.is_shiny
          and (
            progress.tracker_id = v_tracker.id
            or (v_tracker.catalog_key = 'home' and source_tracker.catalog_key <> 'home')
          )
      ),
      'shiny_caught', exists(
        select 1
        from public.pokedex_tracker_entries progress
        join public.pokedex_trackers source_tracker on source_tracker.id = progress.tracker_id
        where progress.user_id = auth.uid()
          and source_tracker.user_id = auth.uid()
          and progress.pokemon_id = catalog.pokemon_id
          and progress.is_shiny
          and (
            progress.tracker_id = v_tracker.id
            or (v_tracker.catalog_key = 'home' and source_tracker.catalog_key <> 'home')
          )
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
    on standard_detail.tracker_id = v_tracker.id
   and standard_detail.user_id = auth.uid()
   and standard_detail.pokemon_id = catalog.pokemon_id
   and not standard_detail.is_shiny
  left join public.pokedex_tracker_entry_details shiny_detail
    on shiny_detail.tracker_id = v_tracker.id
   and shiny_detail.user_id = auth.uid()
   and shiny_detail.pokemon_id = catalog.pokemon_id
   and shiny_detail.is_shiny;

  return v_result;
end;
$$;

create or replace function public.set_my_pokedex_tracker_entry(
  p_tracker_id uuid,
  p_pokemon_id integer,
  p_is_shiny boolean,
  p_caught boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tracker public.pokedex_trackers%rowtype;
  v_caught integer;
  v_shiny_caught integer;
begin
  if auth.uid() is null then
    raise exception 'Sign in to save Pokédex progress.' using errcode = '42501';
  end if;

  select * into v_tracker
  from public.pokedex_trackers
  where id = p_tracker_id and user_id = auth.uid()
  for update;

  if not found then
    raise exception 'That Pokédex tracker was not found.' using errcode = 'P0002';
  end if;
  if coalesce(p_is_shiny, false) and not v_tracker.include_shiny then
    raise exception 'Enable the shiny dex before saving shiny progress.' using errcode = '22023';
  end if;
  if not exists(
    select 1 from public.pokedex_tracker_catalog(v_tracker.catalog_key) catalog
    where catalog.pokemon_id = p_pokemon_id
  ) then
    raise exception 'That Pokémon is not part of this Pokédex.' using errcode = '22023';
  end if;

  if coalesce(p_caught, false) then
    insert into public.pokedex_tracker_entries(tracker_id, user_id, pokemon_id, is_shiny)
    values(v_tracker.id, auth.uid(), p_pokemon_id, coalesce(p_is_shiny, false))
    on conflict(tracker_id, pokemon_id, is_shiny) do nothing;
  else
    delete from public.pokedex_tracker_entries
    where tracker_id = v_tracker.id
      and user_id = auth.uid()
      and pokemon_id = p_pokemon_id
      and is_shiny = coalesce(p_is_shiny, false);
  end if;

  update public.pokedex_trackers
  set updated_at = now()
  where id = v_tracker.id and user_id = auth.uid();

  if v_tracker.catalog_key = 'home' then
    select
      count(distinct progress.pokemon_id) filter (where not progress.is_shiny)::integer,
      count(distinct progress.pokemon_id) filter (where progress.is_shiny)::integer
    into v_caught, v_shiny_caught
    from public.pokedex_tracker_entries progress
    join public.pokedex_trackers source_tracker on source_tracker.id = progress.tracker_id
    where progress.user_id = auth.uid()
      and source_tracker.user_id = auth.uid()
      and (progress.tracker_id = v_tracker.id or source_tracker.catalog_key <> 'home')
      and exists (
        select 1 from public.pokedex_tracker_catalog('home') home_catalog
        where home_catalog.pokemon_id = progress.pokemon_id
      );
  else
    select
      count(*) filter (where not is_shiny)::integer,
      count(*) filter (where is_shiny)::integer
    into v_caught, v_shiny_caught
    from public.pokedex_tracker_entries
    where tracker_id = v_tracker.id and user_id = auth.uid();
  end if;

  return jsonb_build_object('caught', v_caught, 'shiny_caught', v_shiny_caught);
end;
$$;

revoke all on function public.pokedex_tracker_catalog(text) from public, anon, authenticated;
revoke all on function public.get_my_pokedex_trackers() from public, anon, authenticated;
revoke all on function public.get_my_pokedex_tracker(uuid) from public, anon, authenticated;
revoke all on function public.set_my_pokedex_tracker_entry(uuid, integer, boolean, boolean)
  from public, anon, authenticated;

grant execute on function public.pokedex_tracker_catalog(text) to service_role;
grant execute on function public.get_my_pokedex_trackers() to authenticated, service_role;
grant execute on function public.get_my_pokedex_tracker(uuid) to authenticated, service_role;
grant execute on function public.set_my_pokedex_tracker_entry(uuid, integer, boolean, boolean)
  to authenticated, service_role;

do $$
declare
  v_home_count integer;
  v_paldea_count integer;
  v_kitakami_count integer;
  v_blueberry_count integer;
  v_galar_count integer;
  v_armor_count integer;
  v_tundra_count integer;
begin
  select count(*)::integer into v_home_count
  from public.pokedex_tracker_catalog('home');
  if v_home_count <> 1025 then
    raise exception 'Pokémon HOME must expose all 1,025 National Dex species';
  end if;

  select
    count(*) filter (where pokedex_key = 'paldea')::integer,
    count(*) filter (where pokedex_key = 'kitakami')::integer,
    count(*) filter (where pokedex_key = 'blueberry')::integer
  into v_paldea_count, v_kitakami_count, v_blueberry_count
  from public.pokedex_tracker_catalog('scarlet');
  if v_paldea_count <> 400 or v_kitakami_count <> 200 or v_blueberry_count <> 243 then
    raise exception 'Scarlet must expose separate complete Paldea, Kitakami, and Blueberry dexes';
  end if;

  select
    count(*) filter (where pokedex_key = 'galar')::integer,
    count(*) filter (where pokedex_key = 'isle-of-armor')::integer,
    count(*) filter (where pokedex_key = 'crown-tundra')::integer
  into v_galar_count, v_armor_count, v_tundra_count
  from public.pokedex_tracker_catalog('sword');
  if v_galar_count <> 400 or v_armor_count <> 211 or v_tundra_count <> 210 then
    raise exception 'Sword must expose separate complete Galar, Isle of Armor, and Crown Tundra dexes';
  end if;

  if exists (
    select 1
    from (
      select pokedex_key, dex_number,
        lag(dex_number) over (partition by pokedex_key order by sort_order, pokemon_name) as prior_number
      from public.pokedex_tracker_catalog('legends-arceus')
    ) ordered
    where prior_number > dex_number
  ) then
    raise exception 'Game Pokédex entries must stay in in-game number order';
  end if;

  if not (select relrowsecurity from pg_class where oid = 'public.pokedex_trackers'::regclass)
     or not (select relforcerowsecurity from pg_class where oid = 'public.pokedex_trackers'::regclass)
     or not (select relrowsecurity from pg_class where oid = 'public.pokedex_tracker_entries'::regclass)
     or not (select relforcerowsecurity from pg_class where oid = 'public.pokedex_tracker_entries'::regclass) then
    raise exception 'Private Pokédex tables must retain forced RLS';
  end if;

  if has_table_privilege('anon', 'public.pokedex_trackers', 'SELECT')
     or has_table_privilege('authenticated', 'public.pokedex_trackers', 'SELECT')
     or has_table_privilege('authenticated', 'public.pokedex_tracker_entries', 'SELECT')
     or has_function_privilege('anon', 'public.get_my_pokedex_trackers()', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.pokedex_tracker_catalog(text)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.get_my_pokedex_tracker(uuid)', 'EXECUTE') then
    raise exception 'Pokédex privacy or function grants changed unexpectedly';
  end if;
end;
$$;

commit;
notify pgrst, 'reload schema';
