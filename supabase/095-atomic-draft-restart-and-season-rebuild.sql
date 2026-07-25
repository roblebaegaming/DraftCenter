-- Atomically reset official draft rows and the matching league snapshot.
-- This closes the failure window where relational draft data could be cleared
-- before a replacement snapshot was safely stored.

begin;

create or replace function public.reset_current_league_cycle(
  p_league_id uuid,
  p_state jsonb,
  p_mode text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing jsonb;
  v_existing_revision bigint;
  v_mode text := lower(btrim(coalesce(p_mode, '')));
  v_index integer;
  v_existing_team jsonb;
  v_incoming_team jsonb;
  v_existing_history jsonb;
  v_incoming_history jsonb;
  v_existing_last jsonb;
  v_incoming_last jsonb;
  v_existing_log jsonb;
  v_incoming_log jsonb;
  v_scheduled_at timestamptz;
begin
  if auth.uid() is null or not public.is_league_staff(p_league_id) then
    raise exception 'Only a commissioner can reset the current league cycle.';
  end if;
  if v_mode not in ('restart_draft', 'rebuild_season') then
    raise exception 'Choose a valid reset mode.';
  end if;
  if jsonb_typeof(coalesce(p_state, 'null'::jsonb)) <> 'object'
     or jsonb_typeof(p_state -> 'teams') <> 'array'
     or jsonb_typeof(p_state -> 'seasonHistory') <> 'array' then
    raise exception 'The replacement league state is incomplete.';
  end if;

  select state, revision
  into v_existing, v_existing_revision
  from public.league_state_snapshots
  where league_id = p_league_id
  for update;
  if v_existing is null then
    raise exception 'League state was not found.';
  end if;
  if coalesce((p_state ->> 'rev')::bigint, -1)
     <> coalesce((v_existing ->> 'rev')::bigint, 0) + 1 then
    raise exception 'This league changed in another session. Reload before resetting it.';
  end if;
  if greatest(1, coalesce((p_state ->> 'seasonNumber')::integer, 1))
     <> greatest(1, coalesce((v_existing ->> 'seasonNumber')::integer, 1)) then
    raise exception 'A reset cannot change the current season number.';
  end if;

  if jsonb_typeof(v_existing -> 'teams') <> 'array'
     or jsonb_array_length(p_state -> 'teams')
       <> jsonb_array_length(v_existing -> 'teams') then
    raise exception 'A reset cannot add or remove teams.';
  end if;
  if jsonb_array_length(v_existing -> 'teams') > 0 then
    for v_index in 0..jsonb_array_length(v_existing -> 'teams') - 1 loop
      v_existing_team := v_existing #> array['teams', v_index::text];
      v_incoming_team := p_state #> array['teams', v_index::text];
      if coalesce(v_incoming_team ->> 'id', '')
           <> coalesce(v_existing_team ->> 'id', '')
         or coalesce(v_incoming_team ->> 'claimedBy', '')
           <> coalesce(v_existing_team ->> 'claimedBy', '') then
        raise exception 'Team identity and ownership must survive a reset.';
      end if;
    end loop;
  end if;

  v_existing_history := case
    when jsonb_typeof(v_existing -> 'seasonHistory') = 'array'
    then v_existing -> 'seasonHistory'
    else '[]'::jsonb
  end;
  v_incoming_history := p_state -> 'seasonHistory';
  if jsonb_array_length(v_incoming_history)
     <> jsonb_array_length(v_existing_history) then
    raise exception 'A reset cannot add or remove archived seasons.';
  end if;

  if v_mode = 'restart_draft' then
    if v_incoming_history is distinct from v_existing_history then
      raise exception 'Restarting a draft cannot rewrite league history.';
    end if;
    if jsonb_array_length(coalesce(v_existing -> 'schedule', '[]'::jsonb)) > 0
       or coalesce(v_existing -> 'matchResults', '{}'::jsonb) <> '{}'::jsonb
       or jsonb_array_length(coalesce(v_existing -> 'trades', '[]'::jsonb)) > 0
       or jsonb_array_length(coalesce(v_existing -> 'transactionLog', '[]'::jsonb)) > 0
       or coalesce(v_existing -> 'playoffs', 'null'::jsonb) <> 'null'::jsonb then
      raise exception 'Competition activity exists. Rebuild the season instead of restarting only the draft.';
    end if;
  elsif jsonb_array_length(v_existing_history) > 0 then
    -- Rebuild may recover missing pick rows into only the newest archive's
    -- draftLog. Every older archive and every other newest-archive field is
    -- immutable.
    if jsonb_array_length(v_existing_history) > 1 and exists (
      select 1
      from generate_series(
        0,
        jsonb_array_length(v_existing_history) - 2
      ) as series(history_index)
      where v_incoming_history -> history_index
        is distinct from v_existing_history -> history_index
    ) then
      raise exception 'Older archived seasons cannot be rewritten.';
    end if;
    v_existing_last := v_existing_history -> (jsonb_array_length(v_existing_history) - 1);
    v_incoming_last := v_incoming_history -> (jsonb_array_length(v_incoming_history) - 1);
    v_existing_log := case
      when jsonb_typeof(v_existing_last -> 'draftLog') = 'array'
      then v_existing_last -> 'draftLog'
      else '[]'::jsonb
    end;
    v_incoming_log := case
      when jsonb_typeof(v_incoming_last -> 'draftLog') = 'array'
      then v_incoming_last -> 'draftLog'
      else '[]'::jsonb
    end;
    if (v_incoming_last - 'draftLog') is distinct from (v_existing_last - 'draftLog')
       or jsonb_array_length(v_incoming_log) < jsonb_array_length(v_existing_log)
       or exists (
         select 1
         from generate_series(
           0,
           jsonb_array_length(v_existing_log) - 1
         ) as series(log_index)
         where v_incoming_log -> log_index is distinct from v_existing_log -> log_index
       ) then
      raise exception 'Rebuild can only append recovered picks to the newest archived draft log.';
    end if;
  end if;

  if coalesce((p_state ->> 'locked')::boolean, true)
     or coalesce(p_state -> 'liveDraft', 'null'::jsonb) <> 'null'::jsonb
     or jsonb_array_length(coalesce(p_state -> 'rosters', '[]'::jsonb)) <> 0
     or jsonb_array_length(coalesce(p_state -> 'budgets', '[]'::jsonb)) <> 0
     or jsonb_array_length(coalesce(p_state -> 'pool', '[]'::jsonb)) <> 0
     or coalesce((p_state ->> 'pickIndex')::integer, -1) <> 0 then
    raise exception 'The replacement state still contains active draft data.';
  end if;
  if v_mode = 'rebuild_season'
     and (
       jsonb_array_length(coalesce(p_state -> 'schedule', '[]'::jsonb)) <> 0
       or coalesce(p_state -> 'matchResults', '{}'::jsonb) <> '{}'::jsonb
       or jsonb_array_length(coalesce(p_state -> 'trades', '[]'::jsonb)) <> 0
       or jsonb_array_length(coalesce(p_state -> 'transactionLog', '[]'::jsonb)) <> 0
       or coalesce(p_state -> 'playoffs', 'null'::jsonb) <> 'null'::jsonb
     ) then
    raise exception 'The rebuilt season still contains competition activity.';
  end if;

  delete from public.roster_entries entry
  using public.teams team
  where entry.team_id = team.id
    and team.league_id = p_league_id;
  delete from public.draft_picks pick
  using public.draft_sessions session
  where pick.draft_session_id = session.id
    and session.league_id = p_league_id;
  delete from public.draft_sessions
  where league_id = p_league_id;
  update public.league_pokemon
  set is_drafted = false
  where league_id = p_league_id;
  delete from public.auction_team_owners
  where league_id = p_league_id;
  delete from public.league_free_agent_claims
  where league_id = p_league_id;

  update public.league_state_snapshots
  set state = p_state,
      revision = coalesce(v_existing_revision, 0) + 1,
      updated_at = now()
  where league_id = p_league_id;

  begin
    v_scheduled_at := nullif(p_state #>> '{settings,draftScheduledAt}', '')::timestamptz;
  exception when others then
    raise exception 'The preserved draft time is invalid.';
  end;
  update public.leagues
  set settings = coalesce(p_state -> 'settings', '{}'::jsonb),
      status = 'preseason',
      draft_starts_at = v_scheduled_at,
      updated_at = now()
  where id = p_league_id;

  insert into public.league_events(league_id, kind, actor_id, payload)
  values (
    p_league_id,
    case when v_mode = 'restart_draft'
      then 'draft_restarted'
      else 'current_season_rebuilt'
    end,
    auth.uid(),
    jsonb_build_object(
      'season_number',
      greatest(1, coalesce((p_state ->> 'seasonNumber')::integer, 1))
    )
  );
  return p_state;
end;
$$;

revoke all on function public.reset_current_league_cycle(uuid, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.reset_current_league_cycle(uuid, jsonb, text)
  to authenticated;

commit;

notify pgrst, 'reload schema';
