-- Keep minute-level automatic claim timing while avoiding full due-context
-- evaluation for every configured weekly league on every cron invocation.

begin;

create index if not exists league_state_snapshots_auto_claim_candidates_idx
  on public.league_state_snapshots (league_id)
  where coalesce(state #>> '{settings,calendarMode}', '') = 'weekly'
    and coalesce(state #>> '{settings,autoProcessClaims}', 'false') = 'true'
    and coalesce(state #>> '{settings,faClaimMode}', 'instant') <> 'instant';

create or replace function public.reconcile_autonomous_league_claims()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_snapshot record;
  v_context jsonb;
  v_now timestamptz := clock_timestamp();
  v_checked integer := 0;
  v_processed integer := 0;
  v_failed integer := 0;
begin
  for v_snapshot in
    select snapshot.league_id, snapshot.state
    from public.league_state_snapshots snapshot
    join pg_catalog.pg_timezone_names zone
      on zone.name = coalesce(
        nullif(btrim(snapshot.state #>> '{settings,leagueTimeZone}'), ''),
        'UTC'
      )
    cross join lateral (
      select timezone(zone.name, v_now) as local_now
    ) local_clock
    where coalesce(snapshot.state #>> '{settings,calendarMode}', '') = 'weekly'
      and coalesce(snapshot.state #>> '{settings,autoProcessClaims}', 'false') = 'true'
      and coalesce(snapshot.state #>> '{settings,faClaimMode}', 'instant') <> 'instant'
      and extract(dow from local_clock.local_now)::integer = case
        when coalesce(snapshot.state #>> '{settings,claimDayOfWeek}', '') ~ '^[0-6]$'
          then (snapshot.state #>> '{settings,claimDayOfWeek}')::integer
        else 3
      end
      and local_clock.local_now::time >= case
        when coalesce(snapshot.state #>> '{settings,claimTime}', '')
          ~ '^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9](\.[0-9]+)?)?$'
          then (snapshot.state #>> '{settings,claimTime}')::time
        else time '20:00'
      end
      and coalesce(snapshot.state ->> 'lastAutoClaimCycle', '')
        <> to_char(local_clock.local_now::date, 'YYYY-MM-DD')
  loop
    v_checked := v_checked + 1;
    begin
      -- This remains the authority for season start, draft completion, time
      -- zone validation, and the exact cycle/due timestamp.
      v_context := public.league_claim_due_context(v_snapshot.state, v_now);
      if v_context is not null then
        perform public.process_private_free_agent_claims_internal(
          v_snapshot.league_id,
          v_context ->> 'cycle',
          (v_context ->> 'due_at')::timestamptz,
          null
        );
        v_processed := v_processed + 1;
      end if;
    exception when others then
      v_failed := v_failed + 1;
    end;
  end loop;

  return jsonb_build_object(
    'checked', v_checked,
    'processed', v_processed,
    'failed', v_failed
  );
end;
$$;

revoke all on function public.reconcile_autonomous_league_claims()
  from public, anon, authenticated;
grant execute on function public.reconcile_autonomous_league_claims()
  to service_role;

commit;

notify pgrst, 'reload schema';
