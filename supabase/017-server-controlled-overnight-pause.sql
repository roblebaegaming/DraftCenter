-- DraftCenter milestone 14: overnight pauses continue without an open browser.
-- Run once AFTER migrations 001-016. Then enable Supabase Cron (pg_cron).

create or replace function public.reconcile_overnight_draft_pauses()
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  r record; v_state jsonb; v_settings jsonb; v_start integer; v_end integer;
  v_hour integer; v_in_window boolean; v_now_ms bigint; v_paused_ms bigint; v_changed integer := 0;
begin
  v_now_ms := floor(extract(epoch from clock_timestamp()) * 1000)::bigint;
  v_hour := extract(hour from (clock_timestamp() at time zone 'UTC'))::integer;
  for r in select league_id, state from public.league_state_snapshots for update loop
    v_state := r.state;
    v_settings := coalesce(v_state -> 'settings', '{}'::jsonb);
    if coalesce((v_state ->> 'locked')::boolean, false) is not true
      or coalesce((v_settings ->> 'overnightPauseEnabled')::boolean, false) is not true then
      continue;
    end if;
    v_start := coalesce((v_settings ->> 'overnightPauseStartUTCHour')::integer, 3);
    v_end := coalesce((v_settings ->> 'overnightPauseEndUTCHour')::integer, 13);
    v_in_window := case when v_start = v_end then false when v_start < v_end then v_hour >= v_start and v_hour < v_end else v_hour >= v_start or v_hour < v_end end;

    if v_in_window and coalesce((v_state ->> 'paused')::boolean, false) is not true then
      v_state := jsonb_set(v_state, '{paused}', 'true'::jsonb, true);
      v_state := jsonb_set(v_state, '{pausedAt}', to_jsonb(v_now_ms), true);
      v_state := jsonb_set(v_state, '{pauseIsOvernight}', 'true'::jsonb, true);
      update public.league_state_snapshots set state = v_state, revision = revision + 1, updated_at = now() where league_id = r.league_id;
      v_changed := v_changed + 1;
    elsif not v_in_window and coalesce((v_state ->> 'paused')::boolean, false) is true and coalesce((v_state ->> 'pauseIsOvernight')::boolean, false) is true then
      v_paused_ms := greatest(0, v_now_ms - coalesce((v_state ->> 'pausedAt')::bigint, v_now_ms));
      if v_state ->> 'pickDeadline' is not null then v_state := jsonb_set(v_state, '{pickDeadline}', to_jsonb((v_state ->> 'pickDeadline')::bigint + v_paused_ms), true); end if;
      if v_state ->> 'nominationDeadline' is not null then v_state := jsonb_set(v_state, '{nominationDeadline}', to_jsonb((v_state ->> 'nominationDeadline')::bigint + v_paused_ms), true); end if;
      if v_state #>> '{nominee,deadline}' is not null then v_state := jsonb_set(v_state, '{nominee,deadline}', to_jsonb((v_state #>> '{nominee,deadline}')::bigint + v_paused_ms), true); end if;
      v_state := jsonb_set(v_state, '{paused}', 'false'::jsonb, true);
      v_state := jsonb_set(v_state, '{pausedAt}', 'null'::jsonb, true);
      v_state := jsonb_set(v_state, '{pauseIsOvernight}', 'false'::jsonb, true);
      update public.league_state_snapshots set state = v_state, revision = revision + 1, updated_at = now() where league_id = r.league_id;
      v_changed := v_changed + 1;
    end if;
  end loop;
  return v_changed;
end;
$$;

-- If pg_cron is enabled, schedule the reconciliation every minute. If it is
-- not enabled yet, the function is still created and can be scheduled from
-- Supabase Dashboard → Integrations → Cron after enabling pg_cron.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    execute 'select cron.schedule(''draftcenter-overnight-pause-reconciler'', ''* * * * *'', ''select public.reconcile_overnight_draft_pauses()'')';
  else
    raise notice 'Enable pg_cron, then schedule: select public.reconcile_overnight_draft_pauses() every minute.';
  end if;
end;
$$;

grant execute on function public.reconcile_overnight_draft_pauses() to service_role;
