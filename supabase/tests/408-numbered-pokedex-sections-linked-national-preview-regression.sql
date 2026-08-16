-- Preview-only numbered-section, linked National progress, and privacy matrix
-- for migration 408. Run in the retained isolated Preview project. All fixtures roll back.

begin;

do $validation$
declare
  v_owner uuid := gen_random_uuid();
  v_other uuid := gen_random_uuid();
  v_game jsonb;
  v_home jsonb;
  v_other_home jsonb;
  v_game_id uuid;
  v_home_id uuid;
  v_other_home_id uuid;
  v_pokemon_id integer;
  v_loaded jsonb;
  v_hub jsonb;
begin
  insert into auth.users(id, aud, role)
  values
    (v_owner, 'authenticated', 'authenticated'),
    (v_other, 'authenticated', 'authenticated');

  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_owner, 'role', 'authenticated')::text,
    true
  );

  select public.create_my_pokedex_tracker('scarlet', 'Scarlet Preview', false) into v_game;
  select public.create_my_pokedex_tracker('home', 'HOME Preview', false) into v_home;
  v_game_id := (v_game ->> 'id')::uuid;
  v_home_id := (v_home ->> 'id')::uuid;

  select catalog.pokemon_id into v_pokemon_id
  from public.pokedex_tracker_catalog('scarlet') catalog
  where catalog.pokedex_key = 'paldea'
  order by catalog.dex_number
  limit 1;

  perform public.set_my_pokedex_tracker_entry(v_game_id, v_pokemon_id, false, true);
  select public.get_my_pokedex_tracker(v_home_id) into v_loaded;
  select public.get_my_pokedex_trackers() into v_hub;

  if not exists (
    select 1 from jsonb_array_elements(v_loaded -> 'pokemon') entry
    where (entry ->> 'pokemon_id')::integer = v_pokemon_id
      and (entry ->> 'caught')::boolean
  ) or not exists (
    select 1 from jsonb_array_elements(v_hub -> 'trackers') tracker
    where (tracker ->> 'id')::uuid = v_home_id
      and (tracker ->> 'caught')::integer = 1
  ) then
    raise exception 'Game progress did not contribute to the owner National Dex';
  end if;

  perform set_config('request.jwt.claim.sub', v_other::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_other, 'role', 'authenticated')::text,
    true
  );
  select public.create_my_pokedex_tracker('home', 'Other HOME Preview', false) into v_other_home;
  v_other_home_id := (v_other_home ->> 'id')::uuid;
  select public.get_my_pokedex_tracker(v_other_home_id) into v_loaded;

  if exists (
    select 1 from jsonb_array_elements(v_loaded -> 'pokemon') entry
    where (entry ->> 'pokemon_id')::integer = v_pokemon_id
      and (entry ->> 'caught')::boolean
  ) or public.get_my_pokedex_tracker(v_home_id) is not null then
    raise exception 'A second account inherited or read another account National progress';
  end if;

  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_owner, 'role', 'authenticated')::text,
    true
  );

  perform public.set_my_pokedex_tracker_entry(v_game_id, v_pokemon_id, false, false);
  select public.get_my_pokedex_tracker(v_home_id) into v_loaded;
  if exists (
    select 1 from jsonb_array_elements(v_loaded -> 'pokemon') entry
    where (entry ->> 'pokemon_id')::integer = v_pokemon_id
      and (entry ->> 'caught')::boolean
  ) then
    raise exception 'Removing game progress left an unowned linked National entry';
  end if;

  perform public.set_my_pokedex_tracker_entry(v_home_id, v_pokemon_id, false, true);
  perform public.set_my_pokedex_tracker_entry(v_game_id, v_pokemon_id, false, true);
  perform public.set_my_pokedex_tracker_entry(v_game_id, v_pokemon_id, false, false);
  select public.get_my_pokedex_tracker(v_home_id) into v_loaded;
  if not exists (
    select 1 from jsonb_array_elements(v_loaded -> 'pokemon') entry
    where (entry ->> 'pokemon_id')::integer = v_pokemon_id
      and (entry ->> 'caught')::boolean
  ) then
    raise exception 'Direct National progress was removed with its game link';
  end if;

  if (select count(*) from public.pokedex_tracker_catalog('scarlet') where pokedex_key = 'paldea') <> 400
     or (select count(*) from public.pokedex_tracker_catalog('scarlet') where pokedex_key = 'kitakami') <> 200
     or (select count(*) from public.pokedex_tracker_catalog('scarlet') where pokedex_key = 'blueberry') <> 243 then
    raise exception 'Scarlet regional and DLC sections are incomplete';
  end if;

  if has_table_privilege('authenticated', 'public.pokedex_trackers', 'select')
     or has_table_privilege('authenticated', 'public.pokedex_tracker_entries', 'select')
     or has_function_privilege('anon', 'public.get_my_pokedex_tracker(uuid)', 'execute')
     or not has_function_privilege('authenticated', 'public.get_my_pokedex_tracker(uuid)', 'execute') then
    raise exception 'Linked progress changed Pokédex privacy grants';
  end if;
end;
$validation$;

rollback;
