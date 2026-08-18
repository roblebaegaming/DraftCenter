-- Preview-only validation matrix for migration 435.
-- Run only in a disposable Supabase Preview project. Every fixture rolls back.

begin;

do $validation$
declare
  v_owner uuid := gen_random_uuid();
  v_other uuid := gen_random_uuid();
  v_home jsonb;
  v_firered jsonb;
  v_go jsonb;
  v_home_id uuid;
  v_export jsonb;
  v_index jsonb;
  v_loaded jsonb;
  v_specimen jsonb;
  v_restored jsonb;
begin
  if (select count(*) from public.pokedex_tracker_catalog('pokemon-go')) <> 954 then
    raise exception 'Pokémon GO does not contain the 954 reviewed species.';
  end if;
  if (select count(*) from public.pokedex_tracker_catalog('firered') where pokedex_key = 'kanto') <> 151
     or (select count(*) from public.pokedex_tracker_catalog('firered') where pokedex_key = 'obtainable') <> 36
     or (select count(distinct pokemon_id) from public.pokedex_tracker_catalog('firered')) <> 187 then
    raise exception 'FireRed did not preserve 151 numbered Kanto entries plus 36 direct postgame encounters.';
  end if;
  if (select count(*) from public.pokedex_tracker_catalog('leafgreen') where pokedex_key = 'kanto') <> 151
     or (select count(distinct pokemon_id) from public.pokedex_tracker_catalog('leafgreen')) <> 187
     or (select count(distinct pokemon_id) from public.pokedex_tracker_catalog('brilliant-diamond')) <> 340 then
    raise exception 'LeafGreen or Brilliant Diamond postgame coverage is incomplete.';
  end if;

  insert into auth.users(id, aud, role)
  values (v_owner, 'authenticated', 'authenticated'),
         (v_other, 'authenticated', 'authenticated');

  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object(
    'sub', v_owner, 'role', 'authenticated'
  )::text, true);

  select public.create_my_pokedex_tracker('home', 'Complete collection', true, false) into v_home;
  select public.create_my_pokedex_tracker('firered', 'FireRed postgame', false, false) into v_firered;
  select public.create_my_pokedex_tracker('pokemon-go', 'GO collection', false, false) into v_go;
  v_home_id := (v_home ->> 'id')::uuid;

  if (v_go ->> 'catalog_key') <> 'pokemon-go'
     or (select count(*) from public.pokedex_tracker_catalog(v_firered ->> 'catalog_key')) <> 187 then
    raise exception 'New Pokémon GO or postgame tracker creation failed.';
  end if;

  perform public.set_my_pokedex_tracker_entry_details_v2(
    v_home_id, 25, false,
    '{"pokeball":"poke","ribbons":["best-friends"],"marks":["rare"],"notes":"Partner Cap"}'::jsonb
  );
  perform public.set_my_pokedex_tracker_wanted_entry(
    v_home_id, 25, false, true,
    '{"form_label":"Partner Cap","marks":["rare"],"wants_alpha":true,"notes":"Find an Alpha"}'::jsonb
  );
  select public.save_my_pokedex_collection_specimen(
    v_home_id, null,
    '{"pokemon_id":25,"form_label":"Partner Cap","nickname":"Sparky","is_shiny":false,"is_alpha":true,"gender":"male","origin_game":"Legends: Arceus","origin_mark":"Hisui","pokeball":"poke","ribbons":["best-friends"],"marks":["alpha","rare"],"importance":"standard","transfer_state":"not_planned","notes":"Private Preview fixture"}'::jsonb
  ) into v_specimen;

  if coalesce((v_specimen ->> 'is_alpha')::boolean, false) is not true
     or not (v_specimen -> 'marks' ? 'alpha') then
    raise exception 'Alpha status or marks were not returned from specimen save.';
  end if;

  begin
    perform public.save_my_pokedex_collection_specimen(
      v_home_id, null,
      '{"pokemon_id":151,"is_alpha":true,"gender":"unknown","importance":"standard","transfer_state":"not_planned"}'::jsonb
    );
    raise exception 'A species that cannot be Alpha was accepted.';
  exception when sqlstate '22023' then null;
  end;

  begin
    perform public.set_my_pokedex_tracker_wanted_entry(
      v_home_id, 25, false, true, '{"marks":["not-a-real-mark"]}'::jsonb
    );
    raise exception 'An unknown mark was accepted.';
  exception when sqlstate '22023' then null;
  end;

  select public.get_my_pokedex_collection_index() into v_index;
  if jsonb_array_length(v_index -> 'specimens') <> 1
     or jsonb_array_length(v_index -> 'wanted') <> 1
     or not (v_index -> 'specimens' -> 0 -> 'marks' ? 'rare')
     or coalesce((v_index -> 'wanted' -> 0 ->> 'wants_alpha')::boolean, false) is not true then
    raise exception 'Cross-tracker collection search did not return owned and wanted records.';
  end if;

  select public.get_my_pokedex_tracker(v_home_id) into v_loaded;
  if not exists (
    select 1 from jsonb_array_elements(v_loaded -> 'pokemon') entry
    where (entry ->> 'pokemon_id')::integer = 25
      and entry -> 'marks' ? 'rare'
      and (entry ->> 'wanted')::boolean
      and (entry ->> 'wanted_alpha')::boolean
  ) then
    raise exception 'Tracker detail did not include marks and hunt-target state.';
  end if;

  select public.export_my_pokedex_trackers() into v_export;
  if (v_export ->> 'version')::integer <> 5
     or jsonb_array_length(v_export -> 'trackers' -> 0 -> 'wanted') = 0
     or not exists (
       select 1 from jsonb_array_elements(v_export -> 'trackers') tracker,
         jsonb_array_elements(tracker -> 'specimens') specimen
       where specimen -> 'marks' ? 'alpha' and (specimen ->> 'is_alpha')::boolean
     ) then
    raise exception 'Version-5 private export omitted marks, Alpha status, or hunt targets.';
  end if;

  select public.restore_my_pokedex_trackers(v_export -> 'trackers') into v_restored;
  if (v_restored ->> 'version')::integer <> 5
     or jsonb_array_length(v_restored -> 'tracker_ids') <> 3 then
    raise exception 'Version-5 restore did not create private tracker copies.';
  end if;

  perform set_config('request.jwt.claim.sub', v_other::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object(
    'sub', v_other, 'role', 'authenticated'
  )::text, true);
  select public.get_my_pokedex_collection_index() into v_index;
  if jsonb_array_length(v_index -> 'specimens') <> 0
     or jsonb_array_length(v_index -> 'wanted') <> 0
     or public.get_my_pokedex_tracker(v_home_id) is not null then
    raise exception 'A second account could read the owner collection or hunt targets.';
  end if;

  if has_table_privilege('authenticated', 'public.pokedex_tracker_wanted_entries', 'SELECT')
     or has_table_privilege('authenticated', 'public.pokedex_collection_specimens', 'SELECT')
     or has_function_privilege('anon', 'public.get_my_pokedex_collection_index()', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.get_my_pokedex_collection_index()', 'EXECUTE') then
    raise exception 'Private collection RLS or RPC grants regressed.';
  end if;
end;
$validation$;

rollback;
