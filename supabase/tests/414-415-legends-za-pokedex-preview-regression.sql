-- Run only after migrations 414 and 415 on an isolated Preview project.
-- This matrix is read-only: it verifies anonymous visibility, capability
-- separation, RLS predicates, and tracker-function grants without fixtures.

begin;
set local role anon;

select jsonb_build_object(
  'game_visible', (select count(*) = 1 from public.pokemon_games where game_key = 'legends-za'),
  'pokedex_visible', (select count(*) = 364 from public.pokemon_game_pokedex_entries where game_key = 'legends-za'),
  'lumiose_visible', (select count(*) = 232 from public.pokemon_game_pokedex_entries where game_key = 'legends-za' and pokedex_key = 'lumiose-city'),
  'hyperspace_visible', (select count(*) = 132 from public.pokemon_game_pokedex_entries where game_key = 'legends-za' and pokedex_key = 'hyperspace'),
  'locations_hidden', (select count(*) = 0 from public.pokemon_game_locations where game_key = 'legends-za'),
  'encounters_hidden', (select count(*) = 0 from public.pokemon_game_encounters where game_key = 'legends-za')
) as anonymous_boundary;

rollback;

select jsonb_build_object(
  'states_separated', exists (
    select 1 from public.pokemon_games
    where game_key = 'legends-za'
      and pokedex_status = 'verified'
      and encounter_status = 'pending'
  ),
  'pokedex_policy_uses_pokedex_status', exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'pokemon_game_pokedex_entries'
      and policyname = 'pokemon_game_pokedex_verified_read'
      and qual ilike '%pokedex_status%verified%'
  ),
  'location_policy_stays_encounter_only', exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'pokemon_game_locations'
      and qual ilike '%encounter_status%verified%'
      and qual not ilike '%pokedex_status%'
  ),
  'encounter_policy_stays_encounter_only', exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'pokemon_game_encounters'
      and qual ilike '%encounter_status%verified%'
      and qual not ilike '%pokedex_status%'
  ),
  'anon_tracker_summary_denied', not has_function_privilege('anon', 'public.get_my_pokedex_trackers()', 'EXECUTE'),
  'authenticated_tracker_summary_allowed', has_function_privilege('authenticated', 'public.get_my_pokedex_trackers()', 'EXECUTE'),
  'authenticated_tracker_create_allowed', has_function_privilege('authenticated', 'public.create_my_pokedex_tracker(text,text,boolean)', 'EXECUTE'),
  'service_catalog_allowed', has_function_privilege('service_role', 'public.pokedex_tracker_catalog(text)', 'EXECUTE'),
  'service_create_allowed', has_function_privilege('service_role', 'public.create_my_pokedex_tracker(text,text,boolean)', 'EXECUTE'),
  'no_za_locations', not exists (select 1 from public.pokemon_game_locations where game_key = 'legends-za'),
  'no_za_encounters', not exists (select 1 from public.pokemon_game_encounters where game_key = 'legends-za')
) as privileged_boundary;
