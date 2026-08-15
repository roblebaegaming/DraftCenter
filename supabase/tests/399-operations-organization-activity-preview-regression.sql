-- Preview-only rollback matrix for migration 399. Run only in an isolated
-- Supabase Preview branch after migration 399. No synthetic account,
-- organization, season, pod, league, event, or snapshot survives the rollback.

begin;

create temp table dc_organization_activity_preview_results (
  result jsonb not null
) on commit drop;

do $validation$
declare
  v_owner uuid := gen_random_uuid();
  v_organization_a uuid;
  v_organization_b uuid;
  v_season uuid;
  v_leagues uuid[];
  v_before jsonb;
  v_after jsonb;
  v_grants_ok boolean;
  v_rls_ok boolean;
  v_no_identity_leak boolean;
begin
  select
    not has_function_privilege('anon', 'public.get_operations_organization_activity()', 'execute')
    and not has_function_privilege('authenticated', 'public.get_operations_organization_activity()', 'execute')
    and has_function_privilege('service_role', 'public.get_operations_organization_activity()', 'execute')
  into v_grants_ok;

  select bool_and(source.relrowsecurity)
  into v_rls_ok
  from pg_class source
  where source.oid in (
    'public.league_organizations'::regclass,
    'public.league_organization_seasons'::regclass,
    'public.league_organization_pods'::regclass
  );

  if v_grants_ok is distinct from true or v_rls_ok is distinct from true then
    raise exception 'Migration 399 service-only grant or RLS boundary is incorrect.';
  end if;

  select public.get_operations_organization_activity() into v_before;

  insert into auth.users(id, aud, role)
  values (v_owner, 'authenticated', 'authenticated');
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_owner, 'role', 'authenticated')::text,
    true
  );

  select (public.create_league_organization(
    'Organization Activity Preview A',
    'Synthetic migration 399 regression',
    'private'
  ) ->> 'id')::uuid into v_organization_a;
  select (public.create_league_organization(
    'Organization Activity Preview B',
    'Synthetic migration 399 regression',
    'private'
  ) ->> 'id')::uuid into v_organization_b;

  select (public.create_planned_league_organization_season(
    v_organization_a,
    'Organization Activity Preview Season',
    jsonb_build_object('notes', 'Synthetic migration 399 regression'),
    1,
    0,
    array['wins', 'differential', 'head-to-head', 'commissioner-draw'],
    jsonb_build_array(
      jsonb_build_object('label', 'Event start', 'draft_starts_at', null),
      jsonb_build_object('label', 'Snapshot start', 'draft_starts_at', null)
    )
  ) ->> 'season_id')::uuid into v_season;

  select array_agg(pod.league_id order by pod.sort_order)
  into v_leagues
  from public.league_organization_pods pod
  where pod.season_id = v_season;

  insert into public.league_events(league_id, kind, payload, created_at)
  values (v_leagues[1], 'draft_started', '{}'::jsonb, now() - interval '1 hour');
  update public.league_state_snapshots
  set state = jsonb_set(
    state,
    '{draftStartedAt}',
    to_jsonb(extract(epoch from now() - interval '2 hours') * 1000),
    true
  )
  where league_id = v_leagues[2];

  select public.get_operations_organization_activity() into v_after;

  if (v_after #>> '{totals,organizations}')::integer
       <> (v_before #>> '{totals,organizations}')::integer + 2
     or (v_after #>> '{totals,organizations_with_leagues}')::integer
       <> (v_before #>> '{totals,organizations_with_leagues}')::integer + 1
     or (v_after #>> '{totals,organizations_started}')::integer
       <> (v_before #>> '{totals,organizations_started}')::integer + 1
     or (v_after #>> '{totals,attached_leagues}')::integer
       <> (v_before #>> '{totals,attached_leagues}')::integer + 2
     or (v_after #>> '{totals,started_leagues}')::integer
       <> (v_before #>> '{totals,started_leagues}')::integer + 2
     or (v_after #>> '{today,signups}')::integer
       <> (v_before #>> '{today,signups}')::integer + 2
     or (v_after #>> '{today,first_league_starts}')::integer
       <> (v_before #>> '{today,first_league_starts}')::integer + 1
     or (v_after #>> '{today,league_starts}')::integer
       <> (v_before #>> '{today,league_starts}')::integer + 2 then
    raise exception 'Migration 399 aggregate deltas do not match the synthetic organization lifecycle.';
  end if;

  v_no_identity_leak := v_after::text not like '%Organization Activity Preview%'
    and v_after::text not like '%' || v_owner::text || '%'
    and v_after::text not like '%' || v_organization_a::text || '%'
    and v_after::text not like '%' || v_organization_b::text || '%'
    and v_after::text not like '%' || v_leagues[1]::text || '%'
    and v_after::text not like '%' || v_leagues[2]::text || '%';
  if v_no_identity_leak is distinct from true then
    raise exception 'Migration 399 returned an organization, account, or league identity.';
  end if;

  insert into dc_organization_activity_preview_results(result)
  values (jsonb_build_object(
    'grants_ok', v_grants_ok,
    'rls_ok', v_rls_ok,
    'event_start_counted', true,
    'snapshot_start_counted', true,
    'identity_free', v_no_identity_leak,
    'rollback_only', true
  ));
end;
$validation$;

select result from dc_organization_activity_preview_results;

rollback;
