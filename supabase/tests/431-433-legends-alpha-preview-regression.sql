-- Run only after migrations 431-433 on an isolated Preview project.
-- Read-only matrix: public Pokédex visibility, encounter isolation, Alpha
-- eligibility totals, private-table grants, and RPC grants.

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
    select 1 from public.pokemon_games where game_key = 'legends-za'
      and pokedex_status = 'verified' and encounter_status = 'pending'
  ),
  'pokedex_policy_uses_pokedex_status', exists (
    select 1 from pg_policies where schemaname = 'public'
      and tablename = 'pokemon_game_pokedex_entries'
      and policyname = 'pokemon_game_pokedex_verified_read'
      and qual ilike '%pokedex_status%verified%'
  ),
  'location_policy_stays_encounter_only', exists (
    select 1 from pg_policies where schemaname = 'public'
      and tablename = 'pokemon_game_locations'
      and qual ilike '%encounter_status%verified%' and qual not ilike '%pokedex_status%'
  ),
  'encounter_policy_stays_encounter_only', exists (
    select 1 from pg_policies where schemaname = 'public'
      and tablename = 'pokemon_game_encounters'
      and qual ilike '%encounter_status%verified%' and qual not ilike '%pokedex_status%'
  ),
  'arceus_alpha_total', (select count(*) = 224 from public.pokemon_game_alpha_species where game_key = 'legends-arceus'),
  'za_alpha_total', (select count(*) = 339 from public.pokemon_game_alpha_species where game_key = 'legends-za'),
  'anon_alpha_table_denied', not has_table_privilege('anon', 'public.pokemon_game_alpha_species', 'SELECT'),
  'authenticated_alpha_progress_denied', not has_table_privilege('authenticated', 'public.pokedex_tracker_alpha_entries', 'SELECT'),
  'anon_alpha_rpc_denied', not has_function_privilege('anon', 'public.set_my_pokedex_tracker_alpha_entry(uuid,integer,boolean)', 'EXECUTE'),
  'authenticated_alpha_rpc_allowed', has_function_privilege('authenticated', 'public.set_my_pokedex_tracker_alpha_entry(uuid,integer,boolean)', 'EXECUTE'),
  'no_za_locations', not exists (select 1 from public.pokemon_game_locations where game_key = 'legends-za'),
  'no_za_encounters', not exists (select 1 from public.pokemon_game_encounters where game_key = 'legends-za')
) as privileged_boundary;
