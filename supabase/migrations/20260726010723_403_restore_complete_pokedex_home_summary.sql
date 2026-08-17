-- Migration 403: keep Collector hub totals aligned with the complete HOME
-- catalog from migration 392, including Diancie, Hoopa, and Volcanion.

begin;

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
  progress as (
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
        'caught', coalesce(progress.caught, 0),
        'shiny_caught', coalesce(progress.shiny_caught, 0),
        'location_count', coalesce(locations.location_count, 0),
        'specimen_count', coalesce(specimens.specimen_count, 0),
        'created_at', tracker.created_at,
        'updated_at', tracker.updated_at
      ) order by tracker.updated_at desc)
      from public.pokedex_trackers tracker
      join catalogs catalog on catalog.catalog_key = tracker.catalog_key
      left join progress on progress.tracker_id = tracker.id
      left join locations on locations.tracker_id = tracker.id
      left join specimens on specimens.tracker_id = tracker.id
      where tracker.user_id = auth.uid()
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.get_my_pokedex_trackers()
  from public, anon, authenticated;
grant execute on function public.get_my_pokedex_trackers()
  to authenticated, service_role;

do $$
declare
  v_catalog_total integer;
  v_reported_total integer;
begin
  select count(*)::integer into v_catalog_total
  from public.pokedex_tracker_catalog('home');

  select (catalog ->> 'total')::integer into v_reported_total
  from jsonb_array_elements(public.get_my_pokedex_trackers() -> 'catalogs') catalog
  where catalog ->> 'key' = 'home';

  if v_catalog_total <> 1025 or v_reported_total <> v_catalog_total then
    raise exception 'Collector HOME summaries must match all 1,025 catalog species';
  end if;
  if has_function_privilege('anon', 'public.get_my_pokedex_trackers()', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.get_my_pokedex_trackers()', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.pokedex_tracker_catalog(text)', 'EXECUTE') then
    raise exception 'Collector hub function grants are incorrect';
  end if;
end;
$$;

commit;
notify pgrst, 'reload schema';
