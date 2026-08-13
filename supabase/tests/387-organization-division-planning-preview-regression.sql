-- Preview-only transaction matrix for migration 387.
-- Run only in the retained isolated multi-pod Preview branch after migration
-- 387. Every synthetic account, organization, season, pod, and league is
-- removed by exact recorded identifier before commit.

begin;

create temp table dc_division_planning_preview_results (
  result jsonb not null
) on commit preserve rows;

do $validation$
declare
  v_owner uuid := gen_random_uuid();
  v_manager uuid := gen_random_uuid();
  v_administrator uuid := gen_random_uuid();
  v_organization_payload jsonb;
  v_organization_id uuid;
  v_season_payload jsonb;
  v_season_id uuid;
  v_pod_ids uuid[];
  v_league_ids uuid[];
  v_pod_a uuid;
  v_pod_b uuid;
  v_league_a uuid;
  v_league_b uuid;
  v_workspace jsonb;
  v_non_staff_plan_denied boolean := false;
  v_non_staff_assignment_denied boolean := false;
  v_rls_ok boolean;
  v_grants_ok boolean;
  v_provisioning_ok boolean;
  v_unassigned_ok boolean;
  v_assignment_ok boolean;
  v_move_ok boolean;
  v_plan_update_ok boolean;
  v_audit_ok boolean;
  v_cleanup_ok boolean;
begin
  select c.relrowsecurity
  into v_rls_ok
  from pg_class c
  where c.oid = 'public.league_organization_manager_assignments'::regclass;
  if v_rls_ok is distinct from true then
    raise exception 'Manager placement table must have RLS enabled.';
  end if;

  select
    not has_table_privilege('anon', 'public.league_organization_manager_assignments', 'select')
    and not has_table_privilege('authenticated', 'public.league_organization_manager_assignments', 'select')
    and not has_table_privilege('authenticated', 'public.league_organization_manager_assignments', 'insert')
    and has_function_privilege(
      'authenticated',
      'public.create_planned_league_organization_season(uuid,text,jsonb,integer,integer,text[],jsonb)',
      'execute'
    )
    and has_function_privilege(
      'authenticated',
      'public.update_league_organization_pod_plan(uuid,text,timestamptz)',
      'execute'
    )
    and has_function_privilege(
      'authenticated',
      'public.upsert_league_organization_manager_assignment(uuid,text,uuid,text)',
      'execute'
    )
    and has_function_privilege(
      'authenticated',
      'public.remove_league_organization_manager_assignment(uuid,uuid)',
      'execute'
    )
    and not has_function_privilege(
      'authenticated',
      'public.get_league_organization_pod_start_status(uuid)',
      'execute'
    )
  into v_grants_ok;
  if v_grants_ok is distinct from true then
    raise exception 'Migration 387 grants do not match the RPC-only browser boundary.';
  end if;

  insert into auth.users(id, aud, role)
  values
    (v_owner, 'authenticated', 'authenticated'),
    (v_manager, 'authenticated', 'authenticated'),
    (v_administrator, 'authenticated', 'authenticated');
  insert into public.profiles(id, display_name, username)
  values
    (v_manager, 'Preview Available Manager', 'dc_preview_available_manager'),
    (v_administrator, 'Preview Organization Admin', 'dc_preview_organization_admin')
  on conflict (id) do update
  set display_name = excluded.display_name,
      username = excluded.username;

  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_owner, 'role', 'authenticated')::text,
    true
  );
  select public.create_league_organization(
    'Division Planning Preview',
    'Synthetic migration 387 regression',
    'private'
  ) into v_organization_payload;
  v_organization_id := (v_organization_payload ->> 'id')::uuid;

  select public.create_planned_league_organization_season(
    v_organization_id,
    'Preview Concurrent Season',
    jsonb_build_object('format', 'National Dex', 'roster_size', 12, 'notes', 'Synthetic Preview only'),
    2,
    1,
    array['wins', 'differential', 'head-to-head', 'commissioner-draw'],
    jsonb_build_array(
      jsonb_build_object('label', 'Morning Pod', 'draft_starts_at', (now() + interval '14 days')::text),
      jsonb_build_object('label', 'Evening Pod', 'draft_starts_at', (now() + interval '15 days')::text),
      jsonb_build_object('label', 'Weekend Pod', 'draft_starts_at', null)
    )
  ) into v_season_payload;
  v_season_id := (v_season_payload ->> 'season_id')::uuid;

  select
    array_agg(pod.id order by pod.sort_order),
    array_agg(pod.league_id order by pod.sort_order)
  into v_pod_ids, v_league_ids
  from public.league_organization_pods pod
  where pod.season_id = v_season_id;
  v_pod_a := v_pod_ids[1];
  v_pod_b := v_pod_ids[2];
  v_league_a := v_league_ids[1];
  v_league_b := v_league_ids[2];

  update public.leagues
  set is_practice = true,
      practice_expires_at = now() + interval '1 day'
  where id = any(v_league_ids);

  select
    season.planned_pod_count = 3
    and (select count(*) from public.league_organization_pods pod where pod.season_id = season.id) = 3
    and (select count(*) from public.leagues league where league.id = any(v_league_ids) and league.league_visibility = 'private' and league.is_practice) = 3
    and (select count(*) from public.league_memberships membership where membership.league_id = any(v_league_ids) and membership.user_id = v_owner and membership.role = 'commissioner') = 3
    and (select count(*) from public.leagues league where league.id = any(v_league_ids) and league.draft_starts_at is not null) = 2
  into v_provisioning_ok
  from public.league_organization_seasons season
  where season.id = v_season_id;
  if v_provisioning_ok is distinct from true then
    raise exception 'Concurrent season provisioning did not preserve the planned pod contract.';
  end if;

  insert into public.league_organization_memberships(organization_id, user_id, role)
  values (v_organization_id, v_administrator, 'administrator');
  perform set_config('request.jwt.claim.sub', v_administrator::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_administrator, 'role', 'authenticated')::text,
    true
  );
  begin
    perform public.update_league_organization_pod_plan(
      v_pod_a,
      'Unauthorized Rename',
      now() + interval '16 days'
    );
  exception when others then
    if sqlerrm = 'Changing a pod plan requires organization and source-league authority.' then
      v_non_staff_plan_denied := true;
    else
      raise;
    end if;
  end;
  begin
    perform public.upsert_league_organization_manager_assignment(
      v_season_id,
      'dc_preview_available_manager',
      v_pod_a,
      'Weeknights after 7 PM Pacific'
    );
  exception when others then
    if sqlerrm = 'You must also be a commissioner of the destination pod.' then
      v_non_staff_assignment_denied := true;
    else
      raise;
    end if;
  end;

  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_owner, 'role', 'authenticated')::text,
    true
  );
  perform public.upsert_league_organization_manager_assignment(
    v_season_id,
    'dc_preview_available_manager',
    null,
    'Weeknights after 7 PM Pacific'
  );
  select assignment.pod_id is null
    and assignment.availability_note = 'Weeknights after 7 PM Pacific'
  into v_unassigned_ok
  from public.league_organization_manager_assignments assignment
  where assignment.season_id = v_season_id and assignment.user_id = v_manager;

  perform public.upsert_league_organization_manager_assignment(
    v_season_id,
    'dc_preview_available_manager',
    v_pod_a,
    'Weeknights after 7 PM Pacific'
  );
  select
    assignment.pod_id = v_pod_a
    and exists (
      select 1 from public.league_memberships membership
      where membership.league_id = v_league_a
        and membership.user_id = v_manager
        and membership.role = 'coach'
    )
  into v_assignment_ok
  from public.league_organization_manager_assignments assignment
  where assignment.season_id = v_season_id and assignment.user_id = v_manager;

  perform public.upsert_league_organization_manager_assignment(
    v_season_id,
    'dc_preview_available_manager',
    v_pod_b,
    'Saturday afternoon also works'
  );
  select
    assignment.pod_id = v_pod_b
    and not exists (
      select 1 from public.league_memberships membership
      where membership.league_id = v_league_a and membership.user_id = v_manager
    )
    and exists (
      select 1 from public.league_memberships membership
      where membership.league_id = v_league_b
        and membership.user_id = v_manager
        and membership.role = 'coach'
    )
  into v_move_ok
  from public.league_organization_manager_assignments assignment
  where assignment.season_id = v_season_id and assignment.user_id = v_manager;

  perform public.update_league_organization_pod_plan(
    v_pod_a,
    'Pacific Pod',
    now() + interval '20 days'
  );
  select
    pod.label = 'Pacific Pod'
    and league.name = 'Preview Concurrent Season - Pacific Pod'
    and league.draft_starts_at > now() + interval '19 days'
  into v_plan_update_ok
  from public.league_organization_pods pod
  join public.leagues league on league.id = pod.league_id
  where pod.id = v_pod_a;

  select public.get_league_organization_planning_workspace(v_organization_id)
  into v_workspace;
  if jsonb_array_length(v_workspace -> 'seasons') <> 1
     or jsonb_array_length(v_workspace #> '{seasons,0,pods}') <> 3
     or jsonb_array_length(v_workspace #> '{seasons,0,managers}') <> 1 then
    raise exception 'The private planning workspace is incomplete.';
  end if;
  perform public.remove_league_organization_manager_assignment(v_season_id, v_manager);
  if exists (
    select 1 from public.league_organization_manager_assignments
    where season_id = v_season_id and user_id = v_manager
  ) or exists (
    select 1 from public.league_memberships
    where league_id = v_league_b and user_id = v_manager and role = 'coach'
  ) then
    raise exception 'Manager placement cleanup left a source-pod coach membership.';
  end if;

  select count(*) >= 8
    and bool_and(kind = any(array[
      'season_created',
      'pod_attached',
      'season_divisions_provisioned',
      'manager_placement_updated',
      'manager_placement_removed',
      'pod_plan_updated'
    ]))
  into v_audit_ok
  from public.league_organization_audit_events
  where organization_id = v_organization_id
    and kind <> 'organization_created';

  if v_non_staff_plan_denied is distinct from true
     or v_non_staff_assignment_denied is distinct from true
     or v_unassigned_ok is distinct from true
     or v_assignment_ok is distinct from true
     or v_move_ok is distinct from true
     or v_plan_update_ok is distinct from true
     or v_audit_ok is distinct from true then
    raise exception 'One or more division-planning behavior assertions failed.';
  end if;

  delete from public.league_organizations where id = v_organization_id;
  delete from public.leagues where id = any(v_league_ids);
  delete from auth.users where id in (v_owner, v_manager, v_administrator);

  select
    not exists (select 1 from public.league_organizations where id = v_organization_id)
    and not exists (select 1 from public.leagues where id = any(v_league_ids))
    and not exists (select 1 from auth.users where id in (v_owner, v_manager, v_administrator))
  into v_cleanup_ok;
  if v_cleanup_ok is distinct from true then
    raise exception 'Preview division-planning fixtures were not completely removed.';
  end if;

  insert into dc_division_planning_preview_results(result)
  values (jsonb_build_object(
    'manager_table_rls', v_rls_ok,
    'rpc_only_grants', v_grants_ok,
    'three_independent_practice_pods', v_provisioning_ok,
    'non_staff_plan_change_denied', v_non_staff_plan_denied,
    'non_staff_manager_assignment_denied', v_non_staff_assignment_denied,
    'availability_saved_before_placement', v_unassigned_ok,
    'manager_membership_created', v_assignment_ok,
    'manager_move_is_atomic', v_move_ok,
    'pod_specific_draft_time_updated', v_plan_update_ok,
    'audit_history', v_audit_ok,
    'fixtures_removed', v_cleanup_ok
  ));
end;
$validation$;

commit;

select result
from dc_division_planning_preview_results;
