-- Preview-only transactional matrix for the configurable VGC Masters Top Cut.
-- Run only after migrations 369-372 on an isolated Supabase branch. This uses
-- synthetic users and the first four seeded roster rows, then removes every
-- fixture and restores the fail-closed waiting state.

begin;

create temp table dc_worlds_bracket_preview_results (result jsonb not null)
on commit preserve rows;

do $validation$
declare
  v_owner uuid := gen_random_uuid();
  v_user_one uuid := gen_random_uuid();
  v_user_two uuid := gen_random_uuid();
  v_players text[];
  v_participants jsonb;
  v_picks jsonb;
  v_hub jsonb;
  v_revision integer;
  v_rls_ok boolean;
  v_direct_access_denied boolean;
  v_rpc_grants_ok boolean;
  v_waiting_seed boolean;
  v_invalid_entry_denied boolean := false;
  v_other_entry_private boolean;
  v_republication_denied boolean := false;
  v_result_before_lock_denied boolean := false;
  v_provisional_auto_sync_denied boolean := false;
  v_downstream_correction_denied boolean := false;
  v_score_ok boolean;
  v_public_after_lock boolean;
  v_final_ok boolean;
  v_post_final_write_denied boolean := false;
  v_cleanup_ok boolean;
begin
  select count(*) = 5 and bool_and(c.relrowsecurity)
  into v_rls_ok
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = any(array[
      'worlds_bracket_events', 'worlds_bracket_slots', 'worlds_bracket_entries',
      'worlds_bracket_results', 'worlds_bracket_audit_log'
    ]);
  if v_rls_ok is distinct from true then raise exception 'All five bracket tables must have RLS enabled.'; end if;

  select not exists (
    select 1
    from unnest(array['anon', 'authenticated']) roles(role_name)
    cross join unnest(array[
      'worlds_bracket_events', 'worlds_bracket_slots', 'worlds_bracket_entries',
      'worlds_bracket_results', 'worlds_bracket_audit_log'
    ]) tables(table_name)
    where has_table_privilege(role_name, 'public.' || table_name, 'select')
       or has_table_privilege(role_name, 'public.' || table_name, 'insert')
       or has_table_privilege(role_name, 'public.' || table_name, 'update')
       or has_table_privilege(role_name, 'public.' || table_name, 'delete')
  ) into v_direct_access_denied;
  if v_direct_access_denied is distinct from true then raise exception 'Browser roles have direct bracket table access.'; end if;

  select
    has_function_privilege('anon', 'public.get_worlds_bracket_hub(text)', 'execute')
    and has_function_privilege('authenticated', 'public.get_worlds_bracket_hub(text)', 'execute')
    and not has_function_privilege('anon', 'public.save_worlds_bracket_entry(text,jsonb)', 'execute')
    and has_function_privilege('authenticated', 'public.save_worlds_bracket_entry(text,jsonb)', 'execute')
    and not has_function_privilege('authenticated', 'public.publish_worlds_bracket(text,integer,timestamptz,timestamptz,text,timestamptz,jsonb,jsonb,uuid,text)', 'execute')
    and has_function_privilege('service_role', 'public.publish_worlds_bracket(text,integer,timestamptz,timestamptz,text,timestamptz,jsonb,jsonb,uuid,text)', 'execute')
  into v_rpc_grants_ok;
  if v_rpc_grants_ok is distinct from true then raise exception 'Bracket RPC grants do not match the intended boundary.'; end if;

  select status = 'waiting_for_official_bracket' and revision = 0 and bracket_size is null
  into v_waiting_seed from public.worlds_bracket_events where event_id = '2026-vgc-masters';
  if v_waiting_seed is distinct from true then raise exception 'The Top Cut must seed without a fictional field.'; end if;

  select array_agg(slug order by source_order) into v_players
  from (select slug, source_order from public.worlds_pick_competitors where event_id = '2026-vgc-masters' order by source_order limit 4) players;
  v_participants := jsonb_build_array(
    jsonb_build_object('slot', 1, 'competitor_slug', v_players[1], 'source_seed', 1),
    jsonb_build_object('slot', 2, 'competitor_slug', v_players[2], 'source_seed', 4),
    jsonb_build_object('slot', 3, 'competitor_slug', v_players[3], 'source_seed', 2),
    jsonb_build_object('slot', 4, 'competitor_slug', v_players[4], 'source_seed', 3)
  );
  v_picks := jsonb_build_object('r1-m1', v_players[1], 'r1-m2', v_players[3], 'r2-m1', v_players[1]);

  insert into auth.users(id, aud, role) values
    (v_owner, 'authenticated', 'authenticated'),
    (v_user_one, 'authenticated', 'authenticated'),
    (v_user_two, 'authenticated', 'authenticated');
  insert into public.profiles(id, display_name) values
    (v_owner, 'Preview Bracket Owner'),
    (v_user_one, 'Preview Bracket One'),
    (v_user_two, 'Preview Bracket Two');

  perform public.publish_worlds_bracket(
    '2026-vgc-masters', 4, now() - interval '1 hour', now() + interval '1 hour',
    'https://worlds.pokemon.com/en-us/competitors/', now(), '{"1":1,"2":2}'::jsonb,
    v_participants, v_owner, 'PUBLISH OFFICIAL TOP CUT'
  );
  select revision into v_revision from public.worlds_bracket_events where event_id = '2026-vgc-masters';

  perform set_config('request.jwt.claim.sub', v_user_one::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_user_one, 'role', 'authenticated')::text, true);
  begin
    perform public.save_worlds_bracket_entry('2026-vgc-masters', jsonb_build_object('r1-m1', v_players[1]));
  exception when others then
    if sqlerrm = 'Complete every Top Cut matchup before saving.' then v_invalid_entry_denied := true; else raise; end if;
  end;
  perform public.save_worlds_bracket_entry('2026-vgc-masters', v_picks);

  perform set_config('request.jwt.claim.sub', v_user_two::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_user_two, 'role', 'authenticated')::text, true);
  select public.get_worlds_bracket_hub('2026-vgc-masters') into v_hub;
  v_other_entry_private :=
    (v_hub ->> 'entry_count')::integer = 1
    and v_hub #> '{standings,0,picks}' = 'null'::jsonb
    and v_hub -> 'my_entry' = 'null'::jsonb;

  begin
    perform public.publish_worlds_bracket(
      '2026-vgc-masters', 4, now(), now() + interval '2 hours',
      'https://worlds.pokemon.com/en-us/competitors/', now(), '{"1":1,"2":2}'::jsonb,
      v_participants, v_owner, 'PUBLISH OFFICIAL TOP CUT'
    );
  exception when others then
    if sqlerrm = 'The published bracket cannot be replaced after an entry is saved.' then v_republication_denied := true; else raise; end if;
  end;

  begin
    perform public.record_worlds_bracket_result('2026-vgc-masters', 1, 1, v_players[1], 'https://worlds.pokemon.com/en-us/competitors/', v_owner);
  exception when others then
    if sqlerrm = 'Results cannot publish before bracket entries lock.' then v_result_before_lock_denied := true; else raise; end if;
  end;

  update public.worlds_bracket_events set opens_at = now() - interval '2 hours', locks_at = now() - interval '1 hour' where event_id = '2026-vgc-masters';
  begin
    perform public.sync_worlds_bracket_from_final_results('2026-vgc-masters');
  exception when others then
    if sqlerrm = 'Only owner-finalized Worlds placements may backfill the bracket.' then v_provisional_auto_sync_denied := true; else raise; end if;
  end;

  perform public.record_worlds_bracket_result('2026-vgc-masters', 1, 1, v_players[1], 'https://worlds.pokemon.com/en-us/competitors/', v_owner);
  perform public.record_worlds_bracket_result('2026-vgc-masters', 1, 2, v_players[4], 'https://worlds.pokemon.com/en-us/competitors/', v_owner);
  perform public.record_worlds_bracket_result('2026-vgc-masters', 2, 1, v_players[1], 'https://worlds.pokemon.com/en-us/competitors/', v_owner);
  begin
    perform public.record_worlds_bracket_result('2026-vgc-masters', 1, 1, v_players[2], 'https://worlds.pokemon.com/en-us/competitors/', v_owner);
  exception when others then
    if sqlerrm = 'Remove or correct the downstream result before changing this winner.' then v_downstream_correction_denied := true; else raise; end if;
  end;

  select public.get_worlds_bracket_hub('2026-vgc-masters') into v_hub;
  v_score_ok := (v_hub #>> '{standings,0,score}')::integer = 3;
  v_public_after_lock := (
    select count(*) from jsonb_object_keys(v_hub #> '{standings,0,picks}')
  ) = 3;
  perform public.finalize_worlds_bracket('2026-vgc-masters', 'https://worlds.pokemon.com/en-us/competitors/', 'FINALIZE 2026 VGC TOP CUT', v_owner);
  select status = 'final' and finalized_at is not null into v_final_ok from public.worlds_bracket_events where event_id = '2026-vgc-masters';
  begin
    perform public.record_worlds_bracket_result('2026-vgc-masters', 2, 1, v_players[4], 'https://worlds.pokemon.com/en-us/competitors/', v_owner);
  exception when others then
    if sqlerrm = 'Final bracket results cannot be changed.' then v_post_final_write_denied := true; else raise; end if;
  end;

  if v_invalid_entry_denied is distinct from true
     or v_other_entry_private is distinct from true
     or v_republication_denied is distinct from true
     or v_result_before_lock_denied is distinct from true
     or v_provisional_auto_sync_denied is distinct from true
     or v_downstream_correction_denied is distinct from true
     or v_score_ok is distinct from true
     or v_public_after_lock is distinct from true
     or v_final_ok is distinct from true
     or v_post_final_write_denied is distinct from true then
    raise exception 'One or more Worlds Top Cut lifecycle assertions failed.';
  end if;

  delete from public.worlds_bracket_audit_log where event_id = '2026-vgc-masters';
  delete from public.worlds_bracket_results where event_id = '2026-vgc-masters';
  delete from public.worlds_bracket_entries where event_id = '2026-vgc-masters';
  delete from public.worlds_bracket_slots where event_id = '2026-vgc-masters';
  update public.worlds_bracket_events set
    status = 'waiting_for_official_bracket', bracket_size = null, revision = 0,
    opens_at = null, locks_at = null, official_bracket_url = null,
    source_checked_at = null, round_points = '{}'::jsonb, published_at = null,
    finalized_at = null, updated_at = now()
  where event_id = '2026-vgc-masters';
  update public.worlds_pick_events set bracket_status = 'waiting_for_official_bracket', updated_at = now() where id = '2026-vgc-masters';
  delete from public.profiles where id in (v_owner, v_user_one, v_user_two);
  delete from auth.users where id in (v_owner, v_user_one, v_user_two);

  select
    not exists (select 1 from public.worlds_bracket_slots where event_id = '2026-vgc-masters')
    and not exists (select 1 from public.worlds_bracket_entries where event_id = '2026-vgc-masters')
    and not exists (select 1 from public.worlds_bracket_results where event_id = '2026-vgc-masters')
    and not exists (select 1 from public.worlds_bracket_audit_log where event_id = '2026-vgc-masters')
    and exists (select 1 from public.worlds_bracket_events where event_id = '2026-vgc-masters' and status = 'waiting_for_official_bracket' and revision = 0)
    and not exists (select 1 from auth.users where id in (v_owner, v_user_one, v_user_two))
  into v_cleanup_ok;
  if v_cleanup_ok is distinct from true then raise exception 'Worlds Top Cut Preview fixtures were not completely removed.'; end if;

  insert into dc_worlds_bracket_preview_results(result) values (jsonb_build_object(
    'tables_with_rls', 5,
    'browser_direct_table_access_denied', v_direct_access_denied,
    'rpc_grants', v_rpc_grants_ok,
    'source_disabled_without_official_field', v_waiting_seed,
    'invalid_entry_denied', v_invalid_entry_denied,
    'other_entry_private_before_lock', v_other_entry_private,
    'published_field_immutable_after_entry', v_republication_denied,
    'result_before_lock_denied', v_result_before_lock_denied,
    'provisional_standings_auto_sync_denied', v_provisional_auto_sync_denied,
    'downstream_correction_denied', v_downstream_correction_denied,
    'scoring_automatic', v_score_ok,
    'entries_public_after_lock', v_public_after_lock,
    'owner_finalization', v_final_ok,
    'post_final_write_denied', v_post_final_write_denied,
    'fixtures_removed', v_cleanup_ok
  ));
end;
$validation$;

commit;

select result from dc_worlds_bracket_preview_results;
