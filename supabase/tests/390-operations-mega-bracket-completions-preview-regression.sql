-- Preview-only transaction matrix for migration 390. Run after migration 390
-- in an isolated Preview branch. It verifies aggregate accuracy and the
-- service-only privacy boundary, then removes every fixture by exact ID.

begin;

do $validation$
declare
  v_first_user uuid := gen_random_uuid();
  v_second_user uuid := gen_random_uuid();
  v_catalog jsonb;
  v_winners jsonb;
  v_top_64 jsonb;
  v_before jsonb;
  v_during jsonb;
  v_after jsonb;
begin
  if not (select relrowsecurity from pg_class where oid = 'public.mega_bracket_attempts'::regclass) then
    raise exception 'Mega Bracket attempts must retain RLS.';
  end if;
  if has_function_privilege('anon', 'public.get_operations_mega_bracket_completions()', 'execute')
     or has_function_privilege('authenticated', 'public.get_operations_mega_bracket_completions()', 'execute')
     or not has_function_privilege('service_role', 'public.get_operations_mega_bracket_completions()', 'execute') then
    raise exception 'The completion summary is not service-role only.';
  end if;
  if has_table_privilege('anon', 'public.mega_bracket_attempts', 'select')
     or has_table_privilege('authenticated', 'public.mega_bracket_attempts', 'select') then
    raise exception 'Client roles can read private Mega Bracket attempts.';
  end if;

  v_before := public.get_operations_mega_bracket_completions();

  insert into auth.users(id, aud, role)
  values
    (v_first_user, 'authenticated', 'authenticated'),
    (v_second_user, 'authenticated', 'authenticated');

  select jsonb_agg(format('Operations Preview Pokemon %s', number) order by number)
  into v_catalog
  from generate_series(1, 1162) number;
  select jsonb_agg('Operations Preview Champion'::text order by number)
  into v_winners
  from generate_series(1, 1161) number;
  select jsonb_agg(format('Operations Preview Finalist %s', number) order by number)
  into v_top_64
  from generate_series(1, 64) number;

  insert into public.mega_bracket_attempts(
    user_id, status, catalog_version, catalog_hash, catalog_snapshot, seed,
    winners, top_64, champion, completed_at
  ) values
    (v_first_user, 'completed', 'operations-preview-v1', repeat('a', 64), v_catalog, repeat('1', 32), v_winners, v_top_64, 'Operations Preview Champion', now()),
    (v_first_user, 'completed', 'operations-preview-v1', repeat('a', 64), v_catalog, repeat('2', 32), v_winners, v_top_64, 'Operations Preview Champion', now()),
    (v_second_user, 'completed', 'operations-preview-v1', repeat('a', 64), v_catalog, repeat('3', 32), v_winners, v_top_64, 'Operations Preview Champion', now());

  v_during := public.get_operations_mega_bracket_completions();
  if (v_during ->> 'completed_members')::integer <> (v_before ->> 'completed_members')::integer + 2
     or (v_during ->> 'completed_brackets')::integer <> (v_before ->> 'completed_brackets')::integer + 3 then
    raise exception 'The Mega Bracket completion aggregate is inaccurate.';
  end if;
  if (v_during - array['generated_at', 'completed_members', 'completed_brackets']) <> '{}'::jsonb
     or v_during::text like '%Operations Preview Champion%'
     or v_during::text like '%' || v_first_user::text || '%' then
    raise exception 'The Mega Bracket completion aggregate exposed private attempt data.';
  end if;

  delete from auth.users where id in (v_first_user, v_second_user);
  v_after := public.get_operations_mega_bracket_completions();
  if (v_after ->> 'completed_members')::integer <> (v_before ->> 'completed_members')::integer
     or (v_after ->> 'completed_brackets')::integer <> (v_before ->> 'completed_brackets')::integer then
    raise exception 'The Mega Bracket Preview fixtures were not removed.';
  end if;
end;
$validation$;

commit;
