-- Preview-only transaction matrix for migration 407.
-- Run only after migration 407 in an isolated Preview branch. Synthetic users
-- and brackets are removed by exact identifiers before commit.

begin;

create temp table dc_mega_bracket_variety_results (
  result jsonb not null
) on commit preserve rows;

do $validation$
declare
  v_owner uuid := gen_random_uuid();
  v_other uuid := gen_random_uuid();
  v_quick_id uuid := gen_random_uuid();
  v_compact_id uuid := gen_random_uuid();
  v_quick jsonb;
  v_compact jsonb;
  v_seeded jsonb;
  v_winners jsonb;
  v_progress jsonb;
  v_payload jsonb;
  v_cross_user_denied boolean := false;
  v_cleanup_ok boolean;
begin
  if not (
    (select relrowsecurity from pg_class where oid = 'public.mega_bracket_attempts'::regclass)
    and not has_table_privilege('anon', 'public.mega_bracket_attempts', 'select')
    and not has_table_privilege('authenticated', 'public.mega_bracket_attempts', 'select')
    and not has_table_privilege('authenticated', 'public.mega_bracket_attempts', 'insert')
    and not has_table_privilege('authenticated', 'public.mega_bracket_attempts', 'update')
    and not has_function_privilege('authenticated', 'public.mega_bracket_progress(jsonb,jsonb)', 'execute')
    and has_function_privilege('authenticated', 'public.create_mega_bracket_attempt(jsonb,text,jsonb,text,text,text,integer)', 'execute')
  ) then
    raise exception 'Migration 407 does not preserve the private RPC-only boundary.';
  end if;

  insert into auth.users(id, aud, role)
  values
    (v_owner, 'authenticated', 'authenticated'),
    (v_other, 'authenticated', 'authenticated');

  select jsonb_agg(format('Quick Fire %s', lpad(number::text, 2, '0')) order by number)
    into v_quick
  from generate_series(1, 64) number;
  insert into public.mega_bracket_attempts(
    id, user_id, catalog_version, catalog_hash, catalog_snapshot, seed,
    bracket_scope, bracket_filter, selection_mode, source_pool_size, entry_limit
  ) values (
    v_quick_id, v_owner, 'preview-variety-v1', repeat('a', 64), v_quick, repeat('b', 32),
    'type', 'fire', 'worst', 98, 64
  );

  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
  v_seeded := public.mega_bracket_seeded_entrants(v_quick, repeat('b', 32));
  v_winners := '[]'::jsonb;
  v_progress := public.mega_bracket_progress(v_seeded, v_winners);
  if v_progress ->> 'phase' <> 'top_64'
     or (v_progress ->> 'total_choices')::integer <> 63
     or jsonb_array_length(v_progress -> 'top_64') <> 64 then
    raise exception 'The Quick 64 bracket did not begin in the visual Top 64.';
  end if;
  while (v_progress ->> 'complete')::boolean is distinct from true loop
    v_winners := v_winners || jsonb_build_array(v_progress #>> '{next_match,left}');
    v_progress := public.mega_bracket_progress(v_seeded, v_winners);
  end loop;
  v_payload := public.save_mega_bracket_progress(v_quick_id, 0, v_winners);
  if v_payload ->> 'status' <> 'completed'
     or v_payload ->> 'selection_mode' <> 'worst'
     or v_payload ->> 'bracket_scope' <> 'type'
     or (v_payload ->> 'entrant_count')::integer <> 64
     or jsonb_array_length(v_payload -> 'winners') <> 63 then
    raise exception 'The Quick 64 worst-of bracket did not complete with its frozen options.';
  end if;

  select jsonb_agg(format('Ice Pokemon %s', lpad(number::text, 2, '0')) order by number)
    into v_compact
  from generate_series(1, 59) number;
  insert into public.mega_bracket_attempts(
    id, user_id, catalog_version, catalog_hash, catalog_snapshot, seed,
    bracket_scope, bracket_filter, selection_mode, source_pool_size, entry_limit
  ) values (
    v_compact_id, v_other, 'preview-variety-v1', repeat('c', 64), v_compact, repeat('d', 32),
    'type', 'ice', 'favorite', 59, null
  );
  perform set_config('request.jwt.claim.sub', v_other::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_other, 'role', 'authenticated')::text, true);
  v_seeded := public.mega_bracket_seeded_entrants(v_compact, repeat('d', 32));
  v_winners := '[]'::jsonb;
  v_progress := public.mega_bracket_progress(v_seeded, v_winners);
  if v_progress ->> 'phase' <> 'compact'
     or (v_progress ->> 'total_choices')::integer <> 58
     or jsonb_array_length(v_progress -> 'top_64') <> 59 then
    raise exception 'The 59-entry Ice bracket did not keep its complete compact field.';
  end if;
  while (v_progress ->> 'complete')::boolean is distinct from true loop
    v_winners := v_winners || jsonb_build_array(v_progress #>> '{next_match,left}');
    v_progress := public.mega_bracket_progress(v_seeded, v_winners);
  end loop;
  v_payload := public.save_mega_bracket_progress(v_compact_id, 0, v_winners);
  if v_payload ->> 'status' <> 'completed'
     or jsonb_array_length(v_payload -> 'top_64') <> 59
     or jsonb_array_length(v_payload -> 'winners') <> 58 then
    raise exception 'The compact Ice bracket did not complete correctly.';
  end if;

  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
  begin
    perform public.get_my_mega_bracket_attempt(v_compact_id);
  exception when sqlstate 'P0002' then
    v_cross_user_denied := true;
  end;
  if v_cross_user_denied is distinct from true then
    raise exception 'A different user could read a private themed Mega Bracket.';
  end if;

  delete from auth.users where id in (v_owner, v_other);
  select
    not exists (select 1 from public.mega_bracket_attempts where id in (v_quick_id, v_compact_id))
    and not exists (select 1 from auth.users where id in (v_owner, v_other))
  into v_cleanup_ok;
  if v_cleanup_ok is distinct from true then
    raise exception 'Preview Mega Bracket variety fixtures were not completely removed.';
  end if;

  insert into dc_mega_bracket_variety_results(result)
  values (jsonb_build_object(
    'rpc_only_grants', true,
    'quick_64_worst_completed', true,
    'compact_ice_completed', true,
    'cross_user_read_denied', v_cross_user_denied,
    'fixtures_removed', v_cleanup_ok
  ));
end;
$validation$;

commit;

select result from dc_mega_bracket_variety_results;
