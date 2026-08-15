-- Migration 399: expose aggregate organization signup and hosted-league start
-- activity to the allowlisted owner Operations server. The payload contains no
-- organization names, owner identities, league names, slugs, or private state.

begin;

create or replace function public.get_operations_organization_activity()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with parameters as (
    select
      now() as generated_at,
      (now() at time zone 'America/Los_Angeles')::date as today
  ),
  days as (
    select generate_series(
      (select today - 29 from parameters),
      (select today from parameters),
      interval '1 day'
    )::date as activity_date
  ),
  event_starts as (
    select event.league_id, min(event.created_at) as started_at
    from public.league_events event
    where event.kind in ('draft_started', 'scheduled_auction_started')
    group by event.league_id
  ),
  pod_leagues as (
    select distinct season.organization_id, pod.league_id
    from public.league_organization_seasons season
    join public.league_organization_pods pod on pod.season_id = season.id
  ),
  organization_leagues as (
    select
      linked.organization_id,
      linked.league_id,
      (
        select min(candidate.started_at)
        from (values
          (event_start.started_at),
          (
            case
              when coalesce(snapshot.state ->> 'draftStartedAt', '') ~ '^[0-9]+([.][0-9]+)?$'
              then to_timestamp((snapshot.state ->> 'draftStartedAt')::double precision / 1000.0)
              else null
            end
          )
        ) as candidate(started_at)
        where candidate.started_at is not null
      ) as started_at
    from pod_leagues linked
    left join event_starts event_start on event_start.league_id = linked.league_id
    left join public.league_state_snapshots snapshot on snapshot.league_id = linked.league_id
  ),
  organization_first_starts as (
    select linked.organization_id, min(linked.started_at) as started_at
    from organization_leagues linked
    where linked.started_at is not null
    group by linked.organization_id
  ),
  daily as (
    select
      days.activity_date,
      (
        select count(*)::integer
        from public.league_organizations organization
        where (organization.created_at at time zone 'America/Los_Angeles')::date = days.activity_date
      ) as signups,
      (
        select count(*)::integer
        from organization_first_starts first_start
        where (first_start.started_at at time zone 'America/Los_Angeles')::date = days.activity_date
      ) as first_league_starts,
      (
        select count(*)::integer
        from organization_leagues linked
        where (linked.started_at at time zone 'America/Los_Angeles')::date = days.activity_date
      ) as league_starts
    from days
    order by days.activity_date
  )
  select jsonb_build_object(
    'generated_at', parameters.generated_at,
    'time_zone', 'America/Los_Angeles',
    'latest_signup_at', (select max(created_at) from public.league_organizations),
    'latest_league_start_at', (select max(started_at) from organization_leagues),
    'totals', jsonb_build_object(
      'organizations', (select count(*)::integer from public.league_organizations),
      'organizations_with_leagues', (select count(distinct organization_id)::integer from organization_leagues),
      'organizations_started', (select count(*)::integer from organization_first_starts),
      'attached_leagues', (select count(*)::integer from organization_leagues),
      'started_leagues', (select count(*)::integer from organization_leagues where started_at is not null),
      'waiting_leagues', (select count(*)::integer from organization_leagues where started_at is null)
    ),
    'today', jsonb_build_object(
      'signups', (select signups from daily where activity_date = parameters.today),
      'first_league_starts', (select first_league_starts from daily where activity_date = parameters.today),
      'league_starts', (select league_starts from daily where activity_date = parameters.today)
    ),
    'last_7_days', jsonb_build_object(
      'signups', (
        select count(*)::integer from public.league_organizations
        where created_at >= parameters.generated_at - interval '7 days'
      ),
      'first_league_starts', (
        select count(*)::integer from organization_first_starts
        where started_at >= parameters.generated_at - interval '7 days'
      ),
      'league_starts', (
        select count(*)::integer from organization_leagues
        where started_at >= parameters.generated_at - interval '7 days'
      )
    ),
    'last_30_days', jsonb_build_object(
      'signups', (
        select count(*)::integer from public.league_organizations
        where created_at >= parameters.generated_at - interval '30 days'
      ),
      'first_league_starts', (
        select count(*)::integer from organization_first_starts
        where started_at >= parameters.generated_at - interval '30 days'
      ),
      'league_starts', (
        select count(*)::integer from organization_leagues
        where started_at >= parameters.generated_at - interval '30 days'
      )
    ),
    'daily', coalesce((
      select jsonb_agg(jsonb_build_object(
        'date', activity_date,
        'signups', signups,
        'first_league_starts', first_league_starts,
        'league_starts', league_starts
      ) order by activity_date)
      from daily
    ), '[]'::jsonb)
  )
  from parameters;
$$;

comment on function public.get_operations_organization_activity() is
  'Returns aggregate organization signup and linked-league draft-start activity for the allowlisted owner Operations server.';

revoke all on function public.get_operations_organization_activity() from public, anon, authenticated;
grant execute on function public.get_operations_organization_activity() to service_role;

do $$
begin
  if has_function_privilege('anon', 'public.get_operations_organization_activity()', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.get_operations_organization_activity()', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.get_operations_organization_activity()', 'EXECUTE') then
    raise exception 'Operations organization activity grants are incorrect';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.league_organizations'::regclass)
     or not (select relrowsecurity from pg_class where oid = 'public.league_organization_seasons'::regclass)
     or not (select relrowsecurity from pg_class where oid = 'public.league_organization_pods'::regclass) then
    raise exception 'Organization activity source tables must keep RLS enabled';
  end if;
end;
$$;

notify pgrst, 'reload schema';

commit;
