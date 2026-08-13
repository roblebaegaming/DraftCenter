-- Migration 386: expose aggregate-only Pokemon Connections completion usage to
-- the owner Operations server. No player identities, puzzle answers, attempts,
-- failed boards, or signed-out activity are returned.

create or replace function public.get_operations_connections_usage()
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
  daily as (
    select
      days.activity_date,
      count(completion.user_id)::integer as completions,
      count(distinct completion.user_id)::integer as players
    from days
    left join public.daily_connections_completions completion
      on (completion.completed_at at time zone 'America/Los_Angeles')::date = days.activity_date
    group by days.activity_date
    order by days.activity_date
  )
  select jsonb_build_object(
    'generated_at', parameters.generated_at,
    'time_zone', 'America/Los_Angeles',
    'all_time', jsonb_build_object(
      'completions', (select count(*)::integer from public.daily_connections_completions),
      'players', (select count(distinct user_id)::integer from public.daily_connections_completions)
    ),
    'today', jsonb_build_object(
      'completions', (select completions from daily where activity_date = parameters.today),
      'players', (select players from daily where activity_date = parameters.today)
    ),
    'last_7_days', jsonb_build_object(
      'completions', (
        select count(*)::integer
        from public.daily_connections_completions
        where completed_at >= parameters.generated_at - interval '7 days'
      ),
      'players', (
        select count(distinct user_id)::integer
        from public.daily_connections_completions
        where completed_at >= parameters.generated_at - interval '7 days'
      )
    ),
    'last_30_days', jsonb_build_object(
      'completions', (
        select count(*)::integer
        from public.daily_connections_completions
        where completed_at >= parameters.generated_at - interval '30 days'
      ),
      'players', (
        select count(distinct user_id)::integer
        from public.daily_connections_completions
        where completed_at >= parameters.generated_at - interval '30 days'
      )
    ),
    'daily', coalesce((
      select jsonb_agg(jsonb_build_object(
        'date', activity_date,
        'completions', completions,
        'players', players
      ) order by activity_date)
      from daily
    ), '[]'::jsonb)
  )
  from parameters;
$$;

comment on function public.get_operations_connections_usage() is
  'Returns aggregate Pokemon Connections completion counts for the allowlisted owner Operations server.';

revoke all on function public.get_operations_connections_usage() from public, anon, authenticated;
grant execute on function public.get_operations_connections_usage() to service_role;

do $$
begin
  if has_function_privilege('anon', 'public.get_operations_connections_usage()', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.get_operations_connections_usage()', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.get_operations_connections_usage()', 'EXECUTE') then
    raise exception 'Operations Connections usage grants are incorrect';
  end if;
  if has_table_privilege('anon', 'public.daily_connections_completions', 'SELECT')
     or has_table_privilege('authenticated', 'public.daily_connections_completions', 'SELECT') then
    raise exception 'Pokemon Connections completion rows must remain private';
  end if;
end;
$$;
