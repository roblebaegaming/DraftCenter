-- Preview-only validation matrix for migration 436.
-- Run only in a disposable Supabase Preview project. Every fixture rolls back.

begin;

do $validation$
declare
  v_owner uuid := gen_random_uuid();
  v_other uuid := gen_random_uuid();
  v_loaded jsonb;
  v_tracker jsonb;
  v_export jsonb;
  v_restore jsonb;
begin
  insert into auth.users(id, aud, role)
  values (v_owner, 'authenticated', 'authenticated'),
         (v_other, 'authenticated', 'authenticated');

  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub',v_owner,'role','authenticated')::text, true);

  select public.create_my_pokedex_tracker('home','Champions backup fixture',false,false) into v_tracker;
  select public.set_my_pokedex_champions_achievement_progress('battlewise', 120) into v_loaded;
  select public.set_my_pokedex_champions_pokemon_wins(445, 55) into v_loaded;
  if (v_loaded -> 'achievement_progress' ->> 'battlewise')::integer <> 120
     or (v_loaded -> 'pokemon_wins' ->> '445')::integer <> 55 then
    raise exception 'Owner Champions progress did not round-trip.';
  end if;

  begin
    perform public.set_my_pokedex_champions_achievement_progress('not-real', 1);
    raise exception 'An unknown Champions achievement was accepted.';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.set_my_pokedex_champions_pokemon_wins(1, 10);
    raise exception 'A Pokémon outside the reviewed Champions roster was accepted.';
  exception when sqlstate '22023' then null;
  end;

  select public.export_my_pokedex_trackers() into v_export;
  if (v_export ->> 'version')::integer <> 6
     or (v_export -> 'champions' -> 'achievement_progress' ->> 'battlewise')::integer <> 120
     or (v_export -> 'champions' -> 'pokemon_wins' ->> '445')::integer <> 55 then
    raise exception 'Version-6 export omitted Champions progress.';
  end if;

  perform set_config('request.jwt.claim.sub', v_other::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub',v_other,'role','authenticated')::text, true);
  select public.get_my_pokedex_champions_progress() into v_loaded;
  if v_loaded -> 'achievement_progress' ? 'battlewise' or v_loaded -> 'pokemon_wins' ? '445' then
    raise exception 'The second account read the owner Champions progress.';
  end if;
  perform public.set_my_pokedex_champions_achievement_progress('battlewise', 10);

  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub',v_owner,'role','authenticated')::text, true);
  select public.restore_my_pokedex_collector(jsonb_build_object(
    'trackers',v_export -> 'trackers',
    'champions',jsonb_build_object(
      'achievement_progress',jsonb_build_object('battlewise',50),
      'pokemon_wins',jsonb_build_object('445',25,'1019',100)
    )
  )) into v_restore;
  if (v_restore ->> 'version')::integer <> 6
     or (v_restore -> 'champions' -> 'achievement_progress' ->> 'battlewise')::integer <> 120
     or (v_restore -> 'champions' -> 'pokemon_wins' ->> '445')::integer <> 55
     or (v_restore -> 'champions' -> 'pokemon_wins' ->> '1019')::integer <> 100 then
    raise exception 'A lower backup value replaced higher Champions progress or failed to merge a new value.';
  end if;

  if exists (select 1 from pg_policies where schemaname='public' and tablename='pokedex_champions_progress')
     or has_table_privilege('authenticated','public.pokedex_champions_progress','SELECT')
     or has_function_privilege('anon','public.get_my_pokedex_champions_progress()','EXECUTE') then
    raise exception 'Champions privacy grants are incorrect.';
  end if;
end;
$validation$;

rollback;
