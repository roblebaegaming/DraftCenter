-- Preview-only transactional import, new-copy restore, privacy, and export
-- matrix for migration 402. Run only in an isolated Supabase Preview project.
-- All fixtures roll back.

begin;

do $validation$
declare
  v_owner uuid := gen_random_uuid();
  v_other uuid := gen_random_uuid();
  v_tracker jsonb;
  v_tracker_id uuid;
  v_pokemon_id integer;
  v_second_pokemon_id integer;
  v_import jsonb;
  v_restore jsonb;
  v_restored_id uuid;
  v_inventory jsonb;
  v_hub jsonb;
  v_export jsonb;
  v_before_location_count integer;
  v_after_location_count integer;
  v_cross_import_denied boolean := false;
  v_invalid_import_denied boolean := false;
  v_invalid_restore_denied boolean := false;
begin
  if has_table_privilege('authenticated', 'public.pokedex_collection_locations', 'insert')
     or has_table_privilege('authenticated', 'public.pokedex_collection_specimens', 'select')
     or has_function_privilege('anon', 'public.import_my_pokedex_collection(uuid,jsonb,jsonb,jsonb)', 'execute')
     or has_function_privilege('anon', 'public.restore_my_pokedex_trackers(jsonb)', 'execute')
     or not has_function_privilege('authenticated', 'public.import_my_pokedex_collection(uuid,jsonb,jsonb,jsonb)', 'execute')
     or not has_function_privilege('authenticated', 'public.restore_my_pokedex_trackers(jsonb)', 'execute') then
    raise exception 'Migration 402 table or function grants are incorrect.';
  end if;

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

  select public.create_my_pokedex_tracker('home', 'Collector source', true) into v_tracker;
  v_tracker_id := (v_tracker ->> 'id')::uuid;
  select min(catalog.pokemon_id), max(catalog.pokemon_id)
  into v_pokemon_id, v_second_pokemon_id
  from (select * from public.pokedex_tracker_catalog('home') order by sort_order limit 2) catalog;

  select public.import_my_pokedex_collection(
    v_tracker_id,
    jsonb_build_array(
      jsonb_build_object('pokemon_id', v_pokemon_id, 'is_shiny', false),
      jsonb_build_object('pokemon_id', v_pokemon_id, 'is_shiny', true)
    ),
    jsonb_build_array(jsonb_build_object(
      'source_key', 'bank-one',
      'kind', 'pokemon_bank',
      'name', 'Bank one',
      'platform', 'Nintendo 3DS',
      'notes', 'Owner-only test note'
    )),
    jsonb_build_array(jsonb_build_object(
      'pokemon_id', v_pokemon_id,
      'nickname', 'Preview partner',
      'is_shiny', true,
      'gender', 'unknown',
      'location_ref', 'bank-one',
      'importance', 'irreplaceable',
      'transfer_state', 'planned',
      'ribbons', jsonb_build_array('partner')
    ))
  ) into v_import;

  select public.get_my_pokedex_collection_inventory(v_tracker_id) into v_inventory;
  select public.get_my_pokedex_trackers() into v_hub;
  select public.export_my_pokedex_trackers() into v_export;
  if v_import ->> 'progress_added' <> '2'
     or v_import ->> 'locations_added' <> '1'
     or v_import ->> 'specimens_added' <> '1'
     or jsonb_array_length(v_inventory -> 'locations') <> 1
     or v_inventory -> 'specimens' -> 0 ->> 'location_name' <> 'Bank one'
     or v_hub -> 'trackers' -> 0 ->> 'location_count' <> '1'
     or v_hub -> 'trackers' -> 0 ->> 'specimen_count' <> '1'
     or v_export ->> 'format' <> 'draftcenter-pokedex-trackers'
     or nullif(v_export -> 'trackers' -> 0 -> 'entries' -> 0 ->> 'pokemon', '') is null
     or nullif(v_export -> 'trackers' -> 0 -> 'specimens' -> 0 ->> 'pokemon', '') is null then
    raise exception 'Collector import, dashboard counts, or portable export did not round-trip.';
  end if;

  v_before_location_count := jsonb_array_length(v_inventory -> 'locations');
  begin
    perform public.import_my_pokedex_collection(
      v_tracker_id,
      '[]'::jsonb,
      jsonb_build_array(jsonb_build_object(
        'source_key', 'must-roll-back', 'kind', 'other', 'name', 'Must roll back'
      )),
      jsonb_build_array(jsonb_build_object(
        'pokemon_id', 999999, 'gender', 'unknown', 'location_ref', 'must-roll-back'
      ))
    );
  exception when others then
    v_invalid_import_denied := sqlstate = '22023';
  end;
  select jsonb_array_length(public.get_my_pokedex_collection_inventory(v_tracker_id) -> 'locations')
  into v_after_location_count;
  if not v_invalid_import_denied or v_after_location_count <> v_before_location_count then
    raise exception 'An invalid Collector import was not rejected atomically.';
  end if;

  select public.restore_my_pokedex_trackers(jsonb_build_array(
    v_export -> 'trackers' -> 0
  )) into v_restore;
  v_restored_id := (v_restore -> 'tracker_ids' ->> 0)::uuid;
  if v_restored_id = v_tracker_id
     or v_restore ->> 'restore_behavior' <> 'created-new-private-copies'
     or jsonb_array_length(public.get_my_pokedex_trackers() -> 'trackers') <> 2
     or jsonb_array_length(public.get_my_pokedex_collection_inventory(v_restored_id) -> 'specimens') <> 1
     or jsonb_array_length(public.get_my_pokedex_collection_inventory(v_tracker_id) -> 'specimens') <> 1 then
    raise exception 'Restore did not create an independent private copy.';
  end if;

  begin
    perform public.restore_my_pokedex_trackers(jsonb_build_array(jsonb_build_object(
      'catalog_key', 'not-a-catalog',
      'title', 'Invalid restore',
      'include_shiny', false,
      'entries', '[]'::jsonb,
      'details', '[]'::jsonb,
      'locations', '[]'::jsonb,
      'specimens', '[]'::jsonb
    )));
  exception when others then
    v_invalid_restore_denied := sqlstate = '22023';
  end;
  if not v_invalid_restore_denied
     or jsonb_array_length(public.get_my_pokedex_trackers() -> 'trackers') <> 2 then
    raise exception 'Invalid restore validation or rollback failed.';
  end if;

  perform set_config('request.jwt.claim.sub', v_other::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_other, 'role', 'authenticated')::text,
    true
  );
  begin
    perform public.import_my_pokedex_collection(
      v_tracker_id, '[]'::jsonb, '[]'::jsonb,
      jsonb_build_array(jsonb_build_object('pokemon_id', v_second_pokemon_id, 'gender', 'unknown'))
    );
  exception when others then
    v_cross_import_denied := sqlstate = 'P0002';
  end;
  if not v_cross_import_denied
     or jsonb_array_length(public.get_my_pokedex_trackers() -> 'trackers') <> 0
     or jsonb_array_length(public.export_my_pokedex_trackers() -> 'trackers') <> 0 then
    raise exception 'A second account could inspect or mutate another owner’s Collector data.';
  end if;
end;
$validation$;

rollback;
