-- Commissioners may re-arm the current scheduled claim cycle for testing or
-- recovery without changing the season clock, rosters, claims, or results.

begin;

create or replace function public.reset_current_weekly_claim_cycle(
  p_league_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_state jsonb;
  v_previous_cycle text;
begin
  if auth.uid() is null or not public.is_league_staff(p_league_id) then
    raise exception 'Only a commissioner can reset claim processing.';
  end if;

  select state into v_state
  from public.league_state_snapshots
  where league_id = p_league_id
  for update;
  if v_state is null then
    raise exception 'League state was not found.';
  end if;
  if coalesce(v_state #>> '{settings,calendarMode}', '') <> 'weekly' then
    raise exception 'This league is not using the weekly calendar.';
  end if;

  v_previous_cycle := nullif(v_state ->> 'lastAutoClaimCycle', '');
  v_state := jsonb_set(v_state, '{lastAutoClaimCycle}', 'null'::jsonb, true);
  v_state := jsonb_set(
    v_state,
    '{rev}',
    to_jsonb(coalesce((v_state ->> 'rev')::bigint, 0) + 1),
    true
  );
  update public.league_state_snapshots
  set state = v_state,
      revision = revision + 1,
      updated_at = now()
  where league_id = p_league_id;

  insert into public.league_events(league_id, kind, actor_id, payload)
  values (
    p_league_id,
    'weekly_claim_cycle_reset',
    auth.uid(),
    jsonb_build_object(
      'previous_cycle', v_previous_cycle,
      'reset_at', clock_timestamp()
    )
  );
  return true;
end;
$$;

revoke all on function public.reset_current_weekly_claim_cycle(uuid)
  from public, anon, authenticated;
grant execute on function public.reset_current_weekly_claim_cycle(uuid)
  to authenticated;

commit;

notify pgrst, 'reload schema';
