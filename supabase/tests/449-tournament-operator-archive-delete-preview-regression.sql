-- Preview-only regression for operator archive/delete management.
-- Run only in an isolated Supabase Preview branch. All fixtures roll back.

begin;

create temp table dc_tournament_delete_results (
  result jsonb not null
) on commit preserve rows;

create function pg_temp.dc_auth(p_user_id uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', p_user_id, 'role', 'authenticated')::text,
    true
  );
end;
$$;

do $validation$
declare
  v_owner uuid := gen_random_uuid();
  v_other uuid := gen_random_uuid();
  v_payload jsonb;
  v_tournament_id uuid;
  v_active_id uuid;
  v_draft_id uuid;
  v_event_id uuid;
  v_league_id uuid;
  v_revision bigint;
  v_event_revision bigint;
  v_wrong_owner_denied boolean := false;
  v_stale_denied boolean := false;
  v_active_denied boolean := false;
begin
  if not has_function_privilege(
       'authenticated', 'public.delete_tournament(uuid,bigint)', 'execute'
     )
     or not has_function_privilege(
       'service_role', 'public.delete_tournament(uuid,bigint)', 'execute'
     )
     or has_function_privilege(
       'anon', 'public.delete_tournament(uuid,bigint)', 'execute'
     )
     or position(
       'v_tournament.revision <> p_expected_revision' in
       pg_get_functiondef('public.delete_tournament(uuid,bigint)'::regprocedure)
     ) = 0
     or position(
       'v_tournament.status = ''active''' in
       pg_get_functiondef('public.delete_tournament(uuid,bigint)'::regprocedure)
     ) = 0
     or position(
       'league_organization_championships' in
       pg_get_functiondef('public.delete_tournament(uuid,bigint)'::regprocedure)
     ) = 0 then
    raise exception 'The operator delete function or its grants are incomplete.';
  end if;
  insert into dc_tournament_delete_results values
    (jsonb_build_object('check', 'function_and_grants', 'ok', true));

  insert into auth.users(id, aud, role)
  values
    (v_owner, 'authenticated', 'authenticated'),
    (v_other, 'authenticated', 'authenticated');
  insert into public.profiles(id, display_name)
  values
    (v_owner, 'Delete Preview Operator'),
    (v_other, 'Delete Preview Other')
  on conflict (id) do update set display_name = excluded.display_name;
  perform pg_temp.dc_auth(v_owner);

  v_payload := public.create_tournament(
    p_regulation_id => 'reg-mb',
    p_registration_closes_at => null,
    p_check_in_opens_at => null,
    p_starts_at => null,
    p_name => 'Operator Delete Standalone Preview',
    p_description => '',
    p_visibility => 'private',
    p_best_of => 3,
    p_entrant_limit => 8,
    p_rules => 'Preview-only deletion fixture',
    p_format => 'single-elimination'
  );
  v_tournament_id := (v_payload ->> 'tournament_id')::uuid;
  perform public.join_tournament(v_tournament_id, 'Delete Preview Operator', null, null);
  select revision into v_revision
  from public.tournaments where id = v_tournament_id;

  perform pg_temp.dc_auth(v_other);
  begin
    perform public.delete_tournament(v_tournament_id, v_revision);
  exception when others then
    v_wrong_owner_denied := sqlerrm = 'Only the tournament owner can delete it.';
  end;
  perform pg_temp.dc_auth(v_owner);
  begin
    perform public.delete_tournament(v_tournament_id, v_revision + 1);
  exception when others then
    v_stale_denied := sqlerrm = 'The tournament changed. Refresh before deleting it.';
  end;
  if not v_wrong_owner_denied or not v_stale_denied then
    raise exception 'Owner or revision authorization did not fail closed.';
  end if;

  perform public.delete_tournament(v_tournament_id, v_revision);
  if exists (select 1 from public.tournaments where id = v_tournament_id)
     or exists (select 1 from public.tournament_entrants where tournament_id = v_tournament_id)
     or exists (select 1 from public.tournament_audit_events where tournament_id = v_tournament_id) then
    raise exception 'Standalone tournament dependencies were not deleted.';
  end if;
  insert into dc_tournament_delete_results values
    (jsonb_build_object('check', 'standalone_cascade', 'ok', true));

  v_payload := public.create_tournament(
    p_regulation_id => 'reg-mb',
    p_registration_closes_at => null,
    p_check_in_opens_at => null,
    p_starts_at => null,
    p_name => 'Operator Delete Active Guard',
    p_description => '',
    p_visibility => 'private',
    p_best_of => 3,
    p_entrant_limit => 8,
    p_rules => 'Preview-only active guard',
    p_format => 'single-elimination'
  );
  v_active_id := (v_payload ->> 'tournament_id')::uuid;
  update public.tournaments set status = 'active' where id = v_active_id;
  select revision into v_revision from public.tournaments where id = v_active_id;
  begin
    perform public.delete_tournament(v_active_id, v_revision);
  exception when others then
    v_active_denied := sqlerrm = 'Live tournaments cannot be deleted. Finish the event first.';
  end;
  if not v_active_denied or not exists (
    select 1 from public.tournaments where id = v_active_id and status = 'active'
  ) then
    raise exception 'The live tournament delete guard failed.';
  end if;
  update public.tournaments set status = 'complete' where id = v_active_id;
  select revision into v_revision from public.tournaments where id = v_active_id;
  perform public.delete_tournament(v_active_id, v_revision);
  insert into dc_tournament_delete_results values
    (jsonb_build_object('check', 'live_guard', 'ok', true));

  v_payload := public.create_draft_first_tournament(
    p_regulation_id => 'reg-mb',
    p_registration_closes_at => null,
    p_check_in_opens_at => null,
    p_starts_at => null,
    p_name => 'Operator Delete Draft Room Preview',
    p_description => '',
    p_visibility => 'private',
    p_best_of => 3,
    p_entrant_limit => 4,
    p_rules => 'Preview-only draft-room cleanup',
    p_roster_size => 4,
    p_pick_time_limit_minutes => 0,
    p_snake_budget_enabled => false,
    p_draft_budget => null,
    p_publish_rosters => false,
    p_competition_format => 'swiss'
  );
  v_draft_id := (v_payload ->> 'tournament_id')::uuid;
  v_event_id := (v_payload ->> 'event_id')::uuid;
  perform public.join_tournament(v_draft_id, 'Delete Preview Operator', null, null);
  select revision into v_revision from public.tournaments where id = v_draft_id;
  perform public.add_tournament_practice_entrants(
    v_draft_id, v_revision, 3, 'Delete Practice Player'
  );
  select revision into v_event_revision
  from public.draft_tournament_events where id = v_event_id;
  perform public.open_draft_tournament_check_in(v_draft_id, v_event_revision);
  perform public.set_draft_tournament_check_in(v_draft_id, true);
  select revision into v_event_revision
  from public.draft_tournament_events where id = v_event_id;
  perform public.lock_draft_tournament_field(v_draft_id, v_event_revision);
  select draft_league_id into v_league_id
  from public.draft_tournament_events where id = v_event_id;
  if v_league_id is null then
    raise exception 'The Draft Tournament cleanup fixture has no private room.';
  end if;

  -- This fixture models the post-event archived state without playing a full
  -- draft. The product RPC still refuses deletion while status is active.
  update public.tournaments set status = 'archived' where id = v_draft_id;
  select revision into v_revision from public.tournaments where id = v_draft_id;
  perform public.delete_tournament(v_draft_id, v_revision);
  if exists (select 1 from public.tournaments where id = v_draft_id)
     or exists (select 1 from public.draft_tournament_events where id = v_event_id)
     or exists (select 1 from public.leagues where id = v_league_id) then
    raise exception 'Draft Tournament deletion left its event or private draft room behind.';
  end if;
  insert into dc_tournament_delete_results values
    (jsonb_build_object('check', 'draft_room_cleanup', 'ok', true));
end;
$validation$;

select result from dc_tournament_delete_results order by result ->> 'check';

rollback;
