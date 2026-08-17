-- Repair the member-triggered expired-turn reconciler introduced in migration
-- 208. Selecting the table alias as one composite value assigned the serialized
-- record to the first field of v_session, which PostgreSQL then tried to parse
-- as a UUID. Expand the row so every draft_sessions field is assigned normally.

begin;

create or replace function public.request_due_snake_turn_resolution(
  p_league_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.draft_sessions;
  v_settings jsonb;
  v_state jsonb;
  v_owner_membership uuid;
  v_auto_draft boolean;
  v_limit_minutes integer;
  v_due_at timestamptz;
  v_result jsonb;
begin
  if not public.is_league_member(p_league_id) then
    raise exception 'You do not have access to that league.';
  end if;

  select session.*
  into v_session
  from public.draft_sessions session
  where session.league_id = p_league_id
    and session.mode = 'snake'
    and session.status = 'active';

  if v_session.id is null then
    return jsonb_build_object('status', 'no_active_draft');
  end if;

  select
    league.settings,
    snapshot.state,
    active_team.owner_membership_id
  into
    v_settings,
    v_state,
    v_owner_membership
  from public.leagues league
  join public.league_state_snapshots snapshot
    on snapshot.league_id = league.id
  join public.teams active_team on active_team.id = v_session.current_team_id
  where league.id = v_session.league_id;

  if lower(coalesce(v_state ->> 'paused', 'false'))
    in ('true', 't', '1', 'yes', 'on') then
    return jsonb_build_object('status', 'paused');
  end if;

  v_limit_minutes := public.draft_setting_nonnegative_integer(
    v_settings,
    'pickTimeLimitMinutes',
    0
  );
  v_due_at := case
    when v_limit_minutes > 0
      then v_session.updated_at + make_interval(mins => v_limit_minutes)
    else null
  end;
  v_auto_draft := lower(coalesce(
    v_state #>> array[
      'teams',
      (
        select team.source_key
        from public.teams team
        where team.id = v_session.current_team_id
      ),
      'autoDraft'
    ],
    'false'
  )) in ('true', 't', '1', 'yes', 'on');

  if v_owner_membership is not null
     and not v_auto_draft
     and (v_due_at is null or v_due_at > clock_timestamp()) then
    return jsonb_build_object(
      'status', 'waiting',
      'due_at', v_due_at,
      'pick_number', v_session.current_pick_number
    );
  end if;

  if exists (
    select 1
    from public.league_events event
    where event.league_id = p_league_id
      and event.kind = 'draft_clock_resolution_requested'
      and event.created_at >= clock_timestamp() - interval '5 seconds'
  ) then
    return jsonb_build_object(
      'status', 'processing',
      'pick_number', v_session.current_pick_number
    );
  end if;

  insert into public.league_events (league_id, kind, actor_id, payload)
  values (
    p_league_id,
    'draft_clock_resolution_requested',
    auth.uid(),
    jsonb_build_object(
      'pick_number', v_session.current_pick_number,
      'due_at', v_due_at
    )
  );

  v_result := public.reconcile_autonomous_snake_drafts();
  return coalesce(v_result, '{}'::jsonb) || jsonb_build_object(
    'status', 'processed',
    'requested_league_id', p_league_id
  );
end;
$$;

revoke all on function public.request_due_snake_turn_resolution(uuid)
  from public, anon, authenticated;
grant execute on function public.request_due_snake_turn_resolution(uuid)
  to authenticated;

commit;

notify pgrst, 'reload schema';
