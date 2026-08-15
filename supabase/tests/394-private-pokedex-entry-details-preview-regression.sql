-- Preview-only owner, privacy, validation, and export matrix for migration 394.
-- Run only in an isolated Supabase Preview project. All fixtures roll back.

begin;

do $validation$
declare
  v_owner uuid := gen_random_uuid();
  v_other uuid := gen_random_uuid();
  v_tracker jsonb;
  v_tracker_id uuid;
  v_pokemon_id integer;
  v_saved jsonb;
  v_loaded jsonb;
  v_export jsonb;
  v_cross_save_denied boolean := false;
  v_invalid_ball_denied boolean := false;
  v_invalid_ribbon_denied boolean := false;
  v_oversized_note_denied boolean := false;
begin
  if not exists (
    select 1
    from pg_class relation
    where relation.oid = 'public.pokedex_tracker_entry_details'::regclass
      and relation.relrowsecurity
      and relation.relforcerowsecurity
  ) then
    raise exception 'Pokédex entry details must keep forced RLS enabled.';
  end if;
  if has_table_privilege('anon', 'public.pokedex_tracker_entry_details', 'select')
     or has_table_privilege('authenticated', 'public.pokedex_tracker_entry_details', 'select')
     or has_table_privilege('authenticated', 'public.pokedex_tracker_entry_details', 'insert')
     or has_table_privilege('authenticated', 'public.pokedex_tracker_entry_details', 'update')
     or has_table_privilege('authenticated', 'public.pokedex_tracker_entry_details', 'delete') then
    raise exception 'Pokédex entry details are directly available to a browser role.';
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

  select public.create_my_pokedex_tracker('home', 'Preview collection', true)
  into v_tracker;
  v_tracker_id := (v_tracker ->> 'id')::uuid;
  select catalog.pokemon_id
  into v_pokemon_id
  from public.pokedex_tracker_catalog('home') catalog
  order by catalog.sort_order
  limit 1;

  select public.set_my_pokedex_tracker_entry_details(
    v_tracker_id,
    v_pokemon_id,
    false,
    'luxury',
    array['champion-paldea', 'partner'],
    'Private collection note.'
  ) into v_saved;
  select public.get_my_pokedex_tracker(v_tracker_id) into v_loaded;
  select public.export_my_pokedex_trackers() into v_export;

  if v_saved ->> 'pokeball' <> 'luxury'
     or v_saved ->> 'notes' <> 'Private collection note.'
     or not exists (
       select 1
       from jsonb_array_elements(v_loaded -> 'pokemon') entry
       where (entry ->> 'pokemon_id')::integer = v_pokemon_id
         and entry ->> 'pokeball' = 'luxury'
         and entry ->> 'notes' = 'Private collection note.'
         and entry -> 'ribbons' ? 'champion-paldea'
         and entry -> 'ribbons' ? 'partner'
     )
     or v_export -> 'trackers' -> 0 -> 'details' -> 0 ->> 'pokeball' <> 'luxury' then
    raise exception 'The owner could not round-trip private Pokédex details.';
  end if;

  begin
    perform public.set_my_pokedex_tracker_entry_details(
      v_tracker_id, v_pokemon_id, false, 'not-a-ball', '{}'::text[], ''
    );
  exception when others then
    v_invalid_ball_denied := sqlstate = '22023';
  end;
  begin
    perform public.set_my_pokedex_tracker_entry_details(
      v_tracker_id, v_pokemon_id, false, '', array['not-a-ribbon'], ''
    );
  exception when others then
    v_invalid_ribbon_denied := sqlstate = '22023';
  end;
  begin
    perform public.set_my_pokedex_tracker_entry_details(
      v_tracker_id, v_pokemon_id, false, '', '{}'::text[], repeat('x', 1001)
    );
  exception when others then
    v_oversized_note_denied := sqlstate = '22023';
  end;

  perform set_config('request.jwt.claim.sub', v_other::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_other, 'role', 'authenticated')::text,
    true
  );

  if public.get_my_pokedex_tracker(v_tracker_id) is not null
     or jsonb_array_length(public.export_my_pokedex_trackers() -> 'trackers') <> 0 then
    raise exception 'A second account can read another account Pokédex details.';
  end if;
  begin
    perform public.set_my_pokedex_tracker_entry_details(
      v_tracker_id, v_pokemon_id, false, 'poke', '{}'::text[], 'cross-account'
    );
  exception when others then
    v_cross_save_denied := sqlstate = 'P0002';
  end;

  if not v_cross_save_denied
     or not v_invalid_ball_denied
     or not v_invalid_ribbon_denied
     or not v_oversized_note_denied then
    raise exception 'Migration 394 privacy or validation denial matrix failed.';
  end if;
end;
$validation$;

rollback;
