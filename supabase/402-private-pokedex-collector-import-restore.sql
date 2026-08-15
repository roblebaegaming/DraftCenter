-- Migration 402: transactional Collector import/restore RPCs plus aggregate
-- inventory counts and portable, species-labeled exports. All writes remain
-- owner-scoped and browser roles still have no direct table access.

begin;

alter table public.pokedex_trackers force row level security;
alter table public.pokedex_tracker_entries force row level security;

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
      count(distinct entry.pokemon_id)::integer as total
    from public.pokemon_game_pokedex_entries entry
    join public.pokemon_games game on game.game_key = entry.game_key
    where game.encounter_status = 'verified' and entry.pokemon_id < 10000
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

create or replace function public.import_my_pokedex_collection(
  p_tracker_id uuid,
  p_progress jsonb default '[]'::jsonb,
  p_locations jsonb default '[]'::jsonb,
  p_specimens jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tracker public.pokedex_trackers%rowtype;
  v_item jsonb;
  v_location_result jsonb;
  v_location_map jsonb := '{}'::jsonb;
  v_source_location_key text;
  v_destination_location_id text;
  v_progress_count integer := 0;
  v_location_count integer := 0;
  v_specimen_count integer := 0;
  v_ordinality bigint;
begin
  if auth.uid() is null then
    raise exception 'Sign in to import a Pokédex collection.' using errcode = '42501';
  end if;
  if p_progress is null or jsonb_typeof(p_progress) <> 'array'
     or p_locations is null or jsonb_typeof(p_locations) <> 'array'
     or p_specimens is null or jsonb_typeof(p_specimens) <> 'array' then
    raise exception 'Collector import sections must be lists.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_progress) > 3000
     or jsonb_array_length(p_locations) > 500
     or jsonb_array_length(p_specimens) > 5000 then
    raise exception 'That Collector import exceeds the supported limits.' using errcode = '22023';
  end if;

  select * into v_tracker
  from public.pokedex_trackers
  where id = p_tracker_id and user_id = auth.uid()
  for update;
  if not found then
    raise exception 'That Pokédex tracker was not found.' using errcode = 'P0002';
  end if;

  for v_item, v_ordinality in
    select value, ordinality
    from jsonb_array_elements(p_locations) with ordinality
  loop
    if jsonb_typeof(v_item) <> 'object' then
      raise exception 'Every imported location must be an object.' using errcode = '22023';
    end if;
    v_source_location_key := coalesce(
      nullif(v_item ->> 'source_key', ''),
      nullif(v_item ->> 'id', ''),
      'location-' || v_ordinality::text
    );
    if v_location_map ? v_source_location_key then
      raise exception 'Imported location keys must be unique.' using errcode = '22023';
    end if;
    v_location_result := public.save_my_pokedex_collection_location(
      v_tracker.id,
      null,
      jsonb_build_object(
        'kind', coalesce(v_item ->> 'kind', v_item ->> 'location_kind'),
        'name', v_item ->> 'name',
        'platform', coalesce(v_item ->> 'platform', ''),
        'notes', coalesce(v_item ->> 'notes', '')
      )
    );
    v_location_map := v_location_map || jsonb_build_object(v_source_location_key, v_location_result ->> 'id');
    v_location_count := v_location_count + 1;
  end loop;

  for v_item in select value from jsonb_array_elements(p_progress)
  loop
    if jsonb_typeof(v_item) <> 'object' then
      raise exception 'Every imported checklist entry must be an object.' using errcode = '22023';
    end if;
    perform public.set_my_pokedex_tracker_entry(
      v_tracker.id,
      (v_item ->> 'pokemon_id')::integer,
      coalesce((v_item ->> 'is_shiny')::boolean, false),
      true
    );
    v_progress_count := v_progress_count + 1;
  end loop;

  for v_item in select value from jsonb_array_elements(p_specimens)
  loop
    if jsonb_typeof(v_item) <> 'object' then
      raise exception 'Every imported individual must be an object.' using errcode = '22023';
    end if;
    v_source_location_key := coalesce(
      nullif(v_item ->> 'location_ref', ''),
      nullif(v_item ->> 'location_id', '')
    );
    v_destination_location_id := case
      when v_source_location_key is null then null
      else v_location_map ->> v_source_location_key
    end;
    if v_source_location_key is not null and v_destination_location_id is null then
      raise exception 'An individual refers to an imported location that was not found.' using errcode = '22023';
    end if;
    perform public.save_my_pokedex_collection_specimen(
      v_tracker.id,
      null,
      (v_item - 'id' - 'location_id' - 'location_ref' - 'source_row')
        || jsonb_build_object('location_id', v_destination_location_id)
    );
    v_specimen_count := v_specimen_count + 1;
  end loop;

  return jsonb_build_object(
    'tracker_id', v_tracker.id,
    'progress_added', v_progress_count,
    'locations_added', v_location_count,
    'specimens_added', v_specimen_count
  );
exception
  when invalid_text_representation or numeric_value_out_of_range then
    raise exception 'The Collector import contains an invalid number, date, identifier, or yes/no value.' using errcode = '22023';
end;
$$;

create or replace function public.restore_my_pokedex_trackers(p_trackers jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tracker_payload jsonb;
  v_created jsonb;
  v_created_ids jsonb := '[]'::jsonb;
  v_entry jsonb;
  v_detail jsonb;
  v_tracker_id uuid;
  v_import_result jsonb;
  v_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Sign in to restore Pokédex trackers.' using errcode = '42501';
  end if;
  if p_trackers is null or jsonb_typeof(p_trackers) <> 'array' then
    raise exception 'Restore a list of Pokédex trackers.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_trackers) not between 1 and 50 then
    raise exception 'Restore between 1 and 50 Pokédex trackers at a time.' using errcode = '22023';
  end if;

  for v_tracker_payload in select value from jsonb_array_elements(p_trackers)
  loop
    if jsonb_typeof(v_tracker_payload) <> 'object' then
      raise exception 'Every restored tracker must be an object.' using errcode = '22023';
    end if;
    if jsonb_typeof(coalesce(v_tracker_payload -> 'include_shiny', 'false'::jsonb)) <> 'boolean'
       or jsonb_typeof(coalesce(v_tracker_payload -> 'entries', '[]'::jsonb)) <> 'array'
       or jsonb_typeof(coalesce(v_tracker_payload -> 'details', '[]'::jsonb)) <> 'array'
       or jsonb_typeof(coalesce(v_tracker_payload -> 'locations', '[]'::jsonb)) <> 'array'
       or jsonb_typeof(coalesce(v_tracker_payload -> 'specimens', '[]'::jsonb)) <> 'array' then
      raise exception 'Every restored tracker must use the supported field types.' using errcode = '22023';
    end if;
    if jsonb_array_length(coalesce(v_tracker_payload -> 'entries', '[]'::jsonb)) > 3000
       or jsonb_array_length(coalesce(v_tracker_payload -> 'details', '[]'::jsonb)) > 3000
       or jsonb_array_length(coalesce(v_tracker_payload -> 'locations', '[]'::jsonb)) > 500
       or jsonb_array_length(coalesce(v_tracker_payload -> 'specimens', '[]'::jsonb)) > 5000 then
      raise exception 'A restored tracker exceeds the supported limits.' using errcode = '22023';
    end if;

    v_created := public.create_my_pokedex_tracker(
      v_tracker_payload ->> 'catalog_key',
      v_tracker_payload ->> 'title',
      coalesce((v_tracker_payload ->> 'include_shiny')::boolean, false)
    );
    v_tracker_id := (v_created ->> 'id')::uuid;

    for v_entry in
      select value from jsonb_array_elements(coalesce(v_tracker_payload -> 'entries', '[]'::jsonb))
    loop
      perform public.set_my_pokedex_tracker_entry(
        v_tracker_id,
        (v_entry ->> 'pokemon_id')::integer,
        coalesce((v_entry ->> 'is_shiny')::boolean, false),
        true
      );
    end loop;

    for v_detail in
      select value from jsonb_array_elements(coalesce(v_tracker_payload -> 'details', '[]'::jsonb))
    loop
      if jsonb_typeof(v_detail) <> 'object'
         or (v_detail ? 'ribbons' and jsonb_typeof(v_detail -> 'ribbons') <> 'array') then
        raise exception 'Every restored detail must use the supported shape.' using errcode = '22023';
      end if;
      perform public.set_my_pokedex_tracker_entry_details(
        v_tracker_id,
        (v_detail ->> 'pokemon_id')::integer,
        coalesce((v_detail ->> 'is_shiny')::boolean, false),
        coalesce(v_detail ->> 'pokeball', ''),
        array(select jsonb_array_elements_text(coalesce(v_detail -> 'ribbons', '[]'::jsonb))),
        coalesce(v_detail ->> 'notes', '')
      );
    end loop;

    v_import_result := public.import_my_pokedex_collection(
      v_tracker_id,
      '[]'::jsonb,
      coalesce(v_tracker_payload -> 'locations', '[]'::jsonb),
      coalesce(v_tracker_payload -> 'specimens', '[]'::jsonb)
    );
    v_created_ids := v_created_ids || jsonb_build_array(v_tracker_id);
    v_count := v_count + 1;
  end loop;

  return jsonb_build_object(
    'restored', v_count,
    'tracker_ids', v_created_ids,
    'restore_behavior', 'created-new-private-copies'
  );
exception
  when invalid_text_representation or numeric_value_out_of_range then
    raise exception 'The restore file contains an invalid number, date, identifier, or yes/no value.' using errcode = '22023';
end;
$$;

create or replace function public.export_my_pokedex_trackers()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_trackers jsonb;
begin
  if auth.uid() is null then
    raise exception 'Sign in to export Pokédex trackers.' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', tracker.id,
    'catalog_key', tracker.catalog_key,
    'catalog_name', case when tracker.catalog_key = 'home' then 'Pokémon HOME National Dex' else game.display_name end,
    'title', tracker.title,
    'include_shiny', tracker.include_shiny,
    'total', (select count(*)::integer from public.pokedex_tracker_catalog(tracker.catalog_key)),
    'created_at', tracker.created_at,
    'updated_at', tracker.updated_at,
    'entries', coalesce((
      select jsonb_agg(jsonb_build_object(
        'pokemon_id', entry.pokemon_id,
        'pokemon', catalog.pokemon_name,
        'dex_number', catalog.dex_number,
        'is_shiny', entry.is_shiny,
        'caught_at', entry.caught_at
      ) order by catalog.sort_order, entry.is_shiny)
      from public.pokedex_tracker_entries entry
      join public.pokedex_tracker_catalog(tracker.catalog_key) catalog on catalog.pokemon_id = entry.pokemon_id
      where entry.tracker_id = tracker.id and entry.user_id = auth.uid()
    ), '[]'::jsonb),
    'details', coalesce((
      select jsonb_agg(jsonb_build_object(
        'pokemon_id', detail.pokemon_id,
        'pokemon', catalog.pokemon_name,
        'dex_number', catalog.dex_number,
        'is_shiny', detail.is_shiny,
        'pokeball', coalesce(detail.pokeball_key, ''),
        'ribbons', detail.ribbon_keys,
        'notes', detail.notes,
        'updated_at', detail.updated_at
      ) order by catalog.sort_order, detail.is_shiny)
      from public.pokedex_tracker_entry_details detail
      join public.pokedex_tracker_catalog(tracker.catalog_key) catalog on catalog.pokemon_id = detail.pokemon_id
      where detail.tracker_id = tracker.id and detail.user_id = auth.uid()
    ), '[]'::jsonb),
    'locations', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', location.id,
        'kind', location.location_kind,
        'name', location.name,
        'platform', location.platform,
        'notes', location.notes,
        'created_at', location.created_at,
        'updated_at', location.updated_at
      ) order by location.name, location.created_at)
      from public.pokedex_collection_locations location
      where location.tracker_id = tracker.id and location.user_id = auth.uid()
    ), '[]'::jsonb),
    'specimens', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', specimen.id,
        'pokemon_id', specimen.pokemon_id,
        'pokemon', catalog.pokemon_name,
        'dex_number', catalog.dex_number,
        'form_label', specimen.form_label,
        'nickname', specimen.nickname,
        'is_shiny', specimen.is_shiny,
        'gender', specimen.gender,
        'level', specimen.level,
        'original_trainer', specimen.original_trainer,
        'origin_game', specimen.origin_game,
        'origin_mark', specimen.origin_mark,
        'location_id', specimen.location_id,
        'location_name', coalesce(location.name, ''),
        'location_kind', coalesce(location.location_kind, ''),
        'location_platform', coalesce(location.platform, ''),
        'box_label', specimen.box_label,
        'box_position', specimen.box_position,
        'pokeball', coalesce(specimen.pokeball_key, ''),
        'ribbons', specimen.ribbon_keys,
        'is_event', specimen.is_event,
        'importance', specimen.importance,
        'intended_destination', specimen.intended_destination,
        'transfer_state', specimen.transfer_state,
        'transferred_on', specimen.transferred_on,
        'notes', specimen.notes,
        'created_at', specimen.created_at,
        'updated_at', specimen.updated_at
      ) order by specimen.updated_at desc, specimen.id)
      from public.pokedex_collection_specimens specimen
      join public.pokedex_tracker_catalog(tracker.catalog_key) catalog on catalog.pokemon_id = specimen.pokemon_id
      left join public.pokedex_collection_locations location
        on location.id = specimen.location_id
       and location.tracker_id = specimen.tracker_id
       and location.user_id = specimen.user_id
      where specimen.tracker_id = tracker.id and specimen.user_id = auth.uid()
    ), '[]'::jsonb)
  ) order by tracker.updated_at desc), '[]'::jsonb)
  into v_trackers
  from public.pokedex_trackers tracker
  left join public.pokemon_games game on game.game_key = tracker.catalog_key
  where tracker.user_id = auth.uid();

  return jsonb_build_object(
    'format', 'draftcenter-pokedex-trackers',
    'version', 3,
    'exported_at', now(),
    'restore_behavior', 'creates-new-private-copies',
    'trackers', v_trackers
  );
end;
$$;

revoke all on function public.import_my_pokedex_collection(uuid, jsonb, jsonb, jsonb)
  from public, anon, authenticated;
revoke all on function public.restore_my_pokedex_trackers(jsonb)
  from public, anon, authenticated;
revoke all on function public.get_my_pokedex_trackers()
  from public, anon, authenticated;
revoke all on function public.export_my_pokedex_trackers()
  from public, anon, authenticated;

grant execute on function public.import_my_pokedex_collection(uuid, jsonb, jsonb, jsonb)
  to authenticated, service_role;
grant execute on function public.restore_my_pokedex_trackers(jsonb)
  to authenticated, service_role;
grant execute on function public.get_my_pokedex_trackers()
  to authenticated, service_role;
grant execute on function public.export_my_pokedex_trackers()
  to authenticated, service_role;

do $$
begin
  if not (select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.pokedex_trackers'::regclass)
     or not (select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.pokedex_tracker_entries'::regclass)
     or not (select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.pokedex_tracker_entry_details'::regclass)
     or not (select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.pokedex_collection_locations'::regclass)
     or not (select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.pokedex_collection_specimens'::regclass) then
    raise exception 'Collector-owned tables must keep forced RLS';
  end if;
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename in (
        'pokedex_trackers', 'pokedex_tracker_entries', 'pokedex_tracker_entry_details',
        'pokedex_collection_locations', 'pokedex_collection_specimens'
      )
  ) then
    raise exception 'Collector tables must not expose direct client policies';
  end if;
  if has_table_privilege('authenticated', 'public.pokedex_trackers', 'SELECT')
     or has_table_privilege('authenticated', 'public.pokedex_tracker_entries', 'INSERT')
     or has_table_privilege('authenticated', 'public.pokedex_tracker_entry_details', 'SELECT')
     or has_table_privilege('authenticated', 'public.pokedex_collection_locations', 'INSERT')
     or has_table_privilege('authenticated', 'public.pokedex_collection_specimens', 'SELECT') then
    raise exception 'Collector tables must remain inaccessible to browser roles';
  end if;
  if has_function_privilege('anon', 'public.import_my_pokedex_collection(uuid,jsonb,jsonb,jsonb)', 'EXECUTE')
     or has_function_privilege('anon', 'public.restore_my_pokedex_trackers(jsonb)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.import_my_pokedex_collection(uuid,jsonb,jsonb,jsonb)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.restore_my_pokedex_trackers(jsonb)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.pokedex_tracker_catalog(text)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.pokedex_collection_location_kind_is_known(text)', 'EXECUTE') then
    raise exception 'Collector function grants are incorrect';
  end if;
end;
$$;

commit;
notify pgrst, 'reload schema';
