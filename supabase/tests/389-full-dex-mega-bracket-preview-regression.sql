-- Preview-only transaction matrix for migration 389.
-- Run after migration 389 in an isolated Preview branch. It uses synthetic
-- entrants and accounts, verifies the RPC boundary and bracket state machine,
-- then removes every fixture by exact identifier before commit.

begin;

create temp table dc_mega_bracket_preview_results (
  result jsonb not null
) on commit preserve rows;

do $validation$
declare
  v_owner uuid := gen_random_uuid();
  v_other uuid := gen_random_uuid();
  v_attempt_id uuid := gen_random_uuid();
  v_entrants jsonb;
  v_seeded_entrants jsonb;
  v_all_winners jsonb := '[]'::jsonb;
  v_first_ten jsonb;
  v_top_64_winners jsonb;
  v_progress jsonb;
  v_payload jsonb;
  v_hub jsonb;
  v_rls_ok boolean;
  v_grants_ok boolean;
  v_bad_catalog_denied boolean := false;
  v_stale_revision_denied boolean := false;
  v_cross_user_denied boolean := false;
  v_cleanup_ok boolean;
begin
  select c.relrowsecurity
  into v_rls_ok
  from pg_class c
  where c.oid = 'public.mega_bracket_attempts'::regclass;
  if v_rls_ok is distinct from true then
    raise exception 'Mega Bracket attempts must have RLS enabled.';
  end if;

  select
    not has_table_privilege('anon', 'public.mega_bracket_attempts', 'select')
    and not has_table_privilege('authenticated', 'public.mega_bracket_attempts', 'select')
    and not has_table_privilege('authenticated', 'public.mega_bracket_attempts', 'insert')
    and not has_table_privilege('authenticated', 'public.mega_bracket_attempts', 'update')
    and not has_function_privilege('authenticated', 'public.mega_bracket_progress(jsonb,jsonb)', 'execute')
    and has_function_privilege('authenticated', 'public.create_mega_bracket_attempt(jsonb,text)', 'execute')
    and has_function_privilege('authenticated', 'public.get_my_mega_brackets()', 'execute')
    and has_function_privilege('authenticated', 'public.get_my_mega_bracket_attempt(uuid)', 'execute')
    and has_function_privilege('authenticated', 'public.save_mega_bracket_progress(uuid,integer,jsonb)', 'execute')
    and has_function_privilege('authenticated', 'public.abandon_mega_bracket_attempt(uuid,integer)', 'execute')
  into v_grants_ok;
  if v_grants_ok is distinct from true then
    raise exception 'Migration 389 grants do not match the owner-scoped RPC boundary.';
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

  begin
    perform public.create_mega_bracket_attempt(
      jsonb_build_array('Missing catalogue'),
      'draft-lab-catalog-v1'
    );
  exception when sqlstate '22023' then
    v_bad_catalog_denied := true;
  end;
  if v_bad_catalog_denied is distinct from true then
    raise exception 'The creation RPC accepted an incomplete catalogue.';
  end if;

  select jsonb_agg(format('Preview Pokemon %s', lpad(number::text, 4, '0')) order by number)
  into v_entrants
  from generate_series(1, 1162) number;

  -- The production creation RPC accepts only the exact repository catalogue.
  -- This synthetic row isolates progression/revision behavior without copying
  -- the full copyrighted catalogue fixture into a database test.
  insert into public.mega_bracket_attempts(
    id, user_id, catalog_version, catalog_hash, catalog_snapshot, seed
  ) values (
    v_attempt_id,
    v_owner,
    'preview-synthetic-v1',
    repeat('a', 64),
    v_entrants,
    repeat('b', 32)
  );

  v_seeded_entrants := public.mega_bracket_seeded_entrants(v_entrants, repeat('b', 32));
  v_progress := public.mega_bracket_progress(v_seeded_entrants, v_all_winners);
  while (v_progress ->> 'complete')::boolean is distinct from true loop
    v_all_winners := v_all_winners || jsonb_build_array(v_progress #>> '{next_match,left}');
    if jsonb_array_length(v_all_winners) = 1098 then
      v_top_64_winners := v_all_winners;
    end if;
    v_progress := public.mega_bracket_progress(v_seeded_entrants, v_all_winners);
  end loop;

  select jsonb_agg(choice.value order by choice.ordinality)
  into v_first_ten
  from jsonb_array_elements(v_all_winners) with ordinality choice(value, ordinality)
  where choice.ordinality <= 10;

  v_payload := public.save_mega_bracket_progress(v_attempt_id, 0, v_first_ten);
  if (v_payload ->> 'revision')::integer <> 1
     or jsonb_array_length(v_payload -> 'winners') <> 10
     or v_payload ->> 'status' <> 'active' then
    raise exception 'The initial resumable save did not persist correctly.';
  end if;

  begin
    perform public.save_mega_bracket_progress(v_attempt_id, 0, v_first_ten);
  exception when sqlstate '40001' then
    v_stale_revision_denied := true;
  end;
  if v_stale_revision_denied is distinct from true then
    raise exception 'A stale Mega Bracket revision was not rejected.';
  end if;

  v_payload := public.save_mega_bracket_progress(v_attempt_id, 1, v_top_64_winners);
  if (v_payload ->> 'revision')::integer <> 2
     or jsonb_array_length(v_payload -> 'top_64') <> 64
     or v_payload ->> 'status' <> 'active' then
    raise exception 'The Top 64 reveal was not stored at choice 1,098.';
  end if;

  v_payload := public.save_mega_bracket_progress(v_attempt_id, 2, v_all_winners);
  if (v_payload ->> 'revision')::integer <> 3
     or jsonb_array_length(v_payload -> 'winners') <> 1161
     or jsonb_array_length(v_payload -> 'top_64') <> 64
     or nullif(v_payload ->> 'champion', '') is null
     or v_payload ->> 'status' <> 'completed' then
    raise exception 'The full Mega Bracket did not complete with one champion.';
  end if;

  v_hub := public.get_my_mega_brackets();
  if v_hub -> 'active' <> 'null'::jsonb
     or jsonb_array_length(v_hub -> 'completed') <> 1
     or v_hub #>> '{completed,0,id}' <> v_attempt_id::text then
    raise exception 'The private history RPC did not return the completed attempt.';
  end if;

  perform set_config('request.jwt.claim.sub', v_other::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_other, 'role', 'authenticated')::text,
    true
  );
  begin
    perform public.get_my_mega_bracket_attempt(v_attempt_id);
  exception when sqlstate 'P0002' then
    v_cross_user_denied := true;
  end;
  if v_cross_user_denied is distinct from true then
    raise exception 'A different user could read the completed Mega Bracket.';
  end if;

  delete from auth.users where id in (v_owner, v_other);
  select
    not exists (select 1 from public.mega_bracket_attempts where id = v_attempt_id)
    and not exists (select 1 from auth.users where id in (v_owner, v_other))
  into v_cleanup_ok;
  if v_cleanup_ok is distinct from true then
    raise exception 'Preview Mega Bracket fixtures were not completely removed.';
  end if;

  insert into dc_mega_bracket_preview_results(result)
  values (jsonb_build_object(
    'attempt_table_rls', v_rls_ok,
    'rpc_only_grants', v_grants_ok,
    'bad_catalog_denied', v_bad_catalog_denied,
    'stale_revision_denied', v_stale_revision_denied,
    'top_64_saved', true,
    'champion_saved', true,
    'cross_user_read_denied', v_cross_user_denied,
    'fixtures_removed', v_cleanup_ok
  ));
end;
$validation$;

commit;

select result
from dc_mega_bracket_preview_results;
