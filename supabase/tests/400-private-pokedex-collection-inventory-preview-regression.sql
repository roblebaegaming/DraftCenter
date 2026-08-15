-- Preview-only owner, privacy, validation, deletion, and export matrix for
-- migration 400. Run only in an isolated Supabase Preview project. All
-- fixtures roll back.

begin;

do $validation$
declare
  v_owner uuid := gen_random_uuid();
  v_other uuid := gen_random_uuid();
  v_tracker jsonb;
  v_tracker_id uuid;
  v_pokemon_id integer;
  v_location jsonb;
  v_location_id uuid;
  v_specimen jsonb;
  v_specimen_id uuid;
  v_inventory jsonb;
  v_export jsonb;
  v_cross_save_denied boolean := false;
  v_cross_location_denied boolean := false;
  v_invalid_species_denied boolean := false;
  v_invalid_ball_denied boolean := false;
  v_invalid_level_denied boolean := false;
  v_referenced_location_delete_denied boolean := false;
begin
  if not exists (
    select 1 from pg_class relation
    where relation.oid = 'public.pokedex_collection_locations'::regclass
      and relation.relrowsecurity
      and relation.relforcerowsecurity
  ) or not exists (
    select 1 from pg_class relation
    where relation.oid = 'public.pokedex_collection_specimens'::regclass
      and relation.relrowsecurity
      and relation.relforcerowsecurity
  ) then
    raise exception 'Collection inventory tables must keep forced RLS enabled.';
  end if;
  if has_table_privilege('anon', 'public.pokedex_collection_locations', 'select')
     or has_table_privilege('authenticated', 'public.pokedex_collection_locations', 'select')
     or has_table_privilege('authenticated', 'public.pokedex_collection_locations', 'insert')
     or has_table_privilege('anon', 'public.pokedex_collection_specimens', 'select')
     or has_table_privilege('authenticated', 'public.pokedex_collection_specimens', 'select')
     or has_table_privilege('authenticated', 'public.pokedex_collection_specimens', 'insert') then
    raise exception 'Collection inventory tables are directly available to a browser role.';
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

  select public.create_my_pokedex_tracker('home', 'Preview rescue inventory', true)
  into v_tracker;
  v_tracker_id := (v_tracker ->> 'id')::uuid;
  select catalog.pokemon_id
  into v_pokemon_id
  from public.pokedex_tracker_catalog('home') catalog
  order by catalog.sort_order
  limit 1;

  select public.save_my_pokedex_collection_location(
    v_tracker_id,
    null,
    jsonb_build_object(
      'kind', 'pokemon_bank',
      'name', 'Bank Box 1',
      'platform', 'Blue 3DS',
      'notes', 'Private hardware note.'
    )
  ) into v_location;
  v_location_id := (v_location ->> 'id')::uuid;

  select public.save_my_pokedex_collection_specimen(
    v_tracker_id,
    null,
    jsonb_build_object(
      'pokemon_id', v_pokemon_id,
      'form_label', 'Original form',
      'nickname', 'Partner',
      'is_shiny', true,
      'gender', 'female',
      'level', 73,
      'original_trainer', 'Preview OT',
      'origin_game', 'Pokemon Emerald',
      'origin_mark', 'Game Boy origin mark',
      'location_id', v_location_id,
      'box_label', 'Legacy favorites',
      'box_position', 7,
      'pokeball', 'luxury',
      'ribbons', jsonb_build_array('champion-g3', 'partner'),
      'is_event', false,
      'importance', 'irreplaceable',
      'intended_destination', 'Pokemon HOME',
      'transfer_state', 'planned',
      'notes', 'Private childhood-team memory.'
    )
  ) into v_specimen;
  v_specimen_id := (v_specimen ->> 'id')::uuid;

  select public.get_my_pokedex_collection_inventory(v_tracker_id) into v_inventory;
  select public.export_my_pokedex_trackers() into v_export;

  if v_location ->> 'name' <> 'Bank Box 1'
     or v_specimen ->> 'nickname' <> 'Partner'
     or v_specimen ->> 'location_name' <> 'Bank Box 1'
     or v_specimen ->> 'importance' <> 'irreplaceable'
     or jsonb_array_length(v_inventory -> 'locations') <> 1
     or jsonb_array_length(v_inventory -> 'specimens') <> 1
     or v_inventory -> 'specimens' -> 0 -> 'ribbons' ? 'champion-g3' is false
     or v_export -> 'trackers' -> 0 -> 'locations' -> 0 ->> 'name' <> 'Bank Box 1'
     or v_export -> 'trackers' -> 0 -> 'specimens' -> 0 ->> 'nickname' <> 'Partner' then
    raise exception 'The owner could not round-trip private collection inventory.';
  end if;

  begin
    perform public.save_my_pokedex_collection_specimen(
      v_tracker_id,
      null,
      jsonb_build_object('pokemon_id', 999999, 'gender', 'unknown')
    );
  exception when others then
    v_invalid_species_denied := sqlstate = '22023';
  end;
  begin
    perform public.save_my_pokedex_collection_specimen(
      v_tracker_id,
      null,
      jsonb_build_object('pokemon_id', v_pokemon_id, 'level', 101, 'gender', 'unknown')
    );
  exception when others then
    v_invalid_level_denied := sqlstate = '22023';
  end;
  begin
    perform public.save_my_pokedex_collection_specimen(
      v_tracker_id,
      null,
      jsonb_build_object('pokemon_id', v_pokemon_id, 'pokeball', 'not-a-ball', 'gender', 'unknown')
    );
  exception when others then
    v_invalid_ball_denied := sqlstate = '22023';
  end;
  begin
    perform public.delete_my_pokedex_collection_location(v_tracker_id, v_location_id);
  exception when others then
    v_referenced_location_delete_denied := sqlstate = '23503';
  end;

  perform set_config('request.jwt.claim.sub', v_other::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_other, 'role', 'authenticated')::text,
    true
  );

  if public.get_my_pokedex_collection_inventory(v_tracker_id) is not null
     or jsonb_array_length(public.export_my_pokedex_trackers() -> 'trackers') <> 0 then
    raise exception 'A second account can read another account collection inventory.';
  end if;
  begin
    perform public.save_my_pokedex_collection_location(
      v_tracker_id,
      null,
      jsonb_build_object('kind', 'other', 'name', 'Cross-account location')
    );
  exception when others then
    v_cross_location_denied := sqlstate = 'P0002';
  end;
  begin
    perform public.save_my_pokedex_collection_specimen(
      v_tracker_id,
      v_specimen_id,
      jsonb_build_object('pokemon_id', v_pokemon_id, 'gender', 'unknown')
    );
  exception when others then
    v_cross_save_denied := sqlstate = 'P0002';
  end;

  if not v_cross_save_denied
     or not v_cross_location_denied
     or not v_invalid_species_denied
     or not v_invalid_ball_denied
     or not v_invalid_level_denied
     or not v_referenced_location_delete_denied then
    raise exception 'Migration 400 privacy, validation, or deletion denial matrix failed.';
  end if;

  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_owner, 'role', 'authenticated')::text,
    true
  );
  if not public.delete_my_pokedex_collection_specimen(v_tracker_id, v_specimen_id)
     or not public.delete_my_pokedex_collection_location(v_tracker_id, v_location_id) then
    raise exception 'The owner could not delete inventory in dependency order.';
  end if;
end;
$validation$;

rollback;
