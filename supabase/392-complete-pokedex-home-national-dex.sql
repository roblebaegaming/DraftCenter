-- Migration 392: complete the Pokémon HOME National Dex with the three
-- Kalos mythical species that are absent from every regional game catalogue.

begin;

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
        partition by entry.pokemon_id
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
      case when p_catalog_key = 'home' then available.pokemon_id::bigint else available.id end as sort_order
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
  progress as (
    select
      entry.tracker_id,
      count(*) filter (where not entry.is_shiny)::integer as caught,
      count(*) filter (where entry.is_shiny)::integer as shiny_caught
    from public.pokedex_tracker_entries entry
    where entry.user_id = auth.uid()
    group by entry.tracker_id
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
        'created_at', tracker.created_at,
        'updated_at', tracker.updated_at
      ) order by tracker.updated_at desc)
      from public.pokedex_trackers tracker
      join catalogs catalog on catalog.catalog_key = tracker.catalog_key
      left join progress on progress.tracker_id = tracker.id
      where tracker.user_id = auth.uid()
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.pokedex_tracker_catalog(text) from public, anon, authenticated;
revoke all on function public.get_my_pokedex_trackers() from public, anon, authenticated;
grant execute on function public.pokedex_tracker_catalog(text) to service_role;
grant execute on function public.get_my_pokedex_trackers() to authenticated, service_role;

do $$
declare
  v_home_count integer;
  v_home_distinct integer;
  v_reported_total integer;
begin
  select count(*), count(distinct pokemon_id)
  into v_home_count, v_home_distinct
  from public.pokedex_tracker_catalog('home');

  if v_home_count <> 1025 or v_home_distinct <> 1025 then
    raise exception 'Pokémon HOME must expose exactly 1,025 distinct National Dex species';
  end if;

  if exists (
    select 1
    from (values
      (719, 'Diancie'::text),
      (720, 'Hoopa'::text),
      (721, 'Volcanion'::text)
    ) expected(pokemon_id, pokemon_name)
    left join public.pokedex_tracker_catalog('home') catalog
      on catalog.pokemon_id = expected.pokemon_id
     and catalog.pokemon_name = expected.pokemon_name
    where catalog.pokemon_id is null
  ) then
    raise exception 'Pokémon HOME is missing a reviewed Kalos mythical species';
  end if;

  select (catalog ->> 'total')::integer
  into v_reported_total
  from jsonb_array_elements(public.get_my_pokedex_trackers() -> 'catalogs') catalog
  where catalog ->> 'key' = 'home';

  if v_reported_total <> 1025 then
    raise exception 'Pokémon HOME tracker summaries must report 1,025 species';
  end if;

  if has_function_privilege('authenticated', 'public.pokedex_tracker_catalog(text)', 'EXECUTE')
     or has_function_privilege('anon', 'public.pokedex_tracker_catalog(text)', 'EXECUTE')
     or has_function_privilege('anon', 'public.get_my_pokedex_trackers()', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.get_my_pokedex_trackers()', 'EXECUTE') then
    raise exception 'Pokédex tracker function grants are incorrect';
  end if;
end;
$$;

commit;
notify pgrst, 'reload schema';
