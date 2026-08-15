-- Preview-only regression for migration 403. Run after migration 402 in the
-- retained isolated Supabase Preview project. All fixtures roll back.

begin;

do $validation$
declare
  v_owner uuid := gen_random_uuid();
  v_tracker jsonb;
  v_hub jsonb;
  v_catalog_total integer;
  v_reported_catalog_total integer;
  v_reported_tracker_total integer;
begin
  insert into auth.users(id, aud, role)
  values (v_owner, 'authenticated', 'authenticated');

  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_owner, 'role', 'authenticated')::text,
    true
  );

  select public.create_my_pokedex_tracker('home', 'Complete HOME summary', false)
  into v_tracker;
  select public.get_my_pokedex_trackers() into v_hub;
  select count(*)::integer into v_catalog_total
  from public.pokedex_tracker_catalog('home');

  select (catalog ->> 'total')::integer into v_reported_catalog_total
  from jsonb_array_elements(v_hub -> 'catalogs') catalog
  where catalog ->> 'key' = 'home';
  select (tracker ->> 'total')::integer into v_reported_tracker_total
  from jsonb_array_elements(v_hub -> 'trackers') tracker
  where (tracker ->> 'id')::uuid = (v_tracker ->> 'id')::uuid;

  if v_catalog_total <> 1025
     or v_reported_catalog_total <> v_catalog_total
     or v_reported_tracker_total <> v_catalog_total
     or jsonb_array_length(v_hub -> 'trackers') <> 1 then
    raise exception 'Collector hub did not preserve the complete HOME total';
  end if;
  if has_function_privilege('anon', 'public.get_my_pokedex_trackers()', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.get_my_pokedex_trackers()', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.pokedex_tracker_catalog(text)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.import_my_pokedex_collection(uuid,jsonb,jsonb,jsonb)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.restore_my_pokedex_trackers(jsonb)', 'EXECUTE') then
    raise exception 'Collector hub or portability grants drifted';
  end if;
end;
$validation$;

rollback;
