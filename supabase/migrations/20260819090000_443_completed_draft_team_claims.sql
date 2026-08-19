-- Allow joined coaches to claim an unassigned team after a draft is fully
-- complete. Completed claims preserve every team index because schedules,
-- results, rosters, and draft history already refer to those indexes.
begin;

create or replace function public.claim_live_setup_team(
  p_league_id uuid,
  p_team_index integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_state jsonb;
  v_team jsonb;
  v_name text;
  v_username text;
  v_user_id text := auth.uid()::text;
  v_team_count integer;
  v_roster_min integer;
  v_draft_complete boolean := false;
  v_locked boolean := false;
  v_membership_id uuid;
  v_source_key text;
  v_now_ms bigint := floor(extract(epoch from clock_timestamp()) * 1000)::bigint;
begin
  if auth.uid() is null then raise exception 'You must be signed in.'; end if;
  if p_team_index < 0 then raise exception 'Choose a valid team.'; end if;

  select id into v_membership_id
  from public.league_memberships
  where league_id = p_league_id
    and user_id = auth.uid()
    and role in ('coach', 'commissioner', 'co_commissioner');
  if v_membership_id is null then
    raise exception 'Join this league before claiming a team.';
  end if;

  select state into v_state
  from public.league_state_snapshots
  where league_id = p_league_id
  for update;

  if v_state is null then raise exception 'League setup was not found.'; end if;
  if jsonb_typeof(v_state -> 'teams') <> 'array' then
    raise exception 'League teams have not been initialized yet.';
  end if;

  v_team_count := jsonb_array_length(v_state -> 'teams');
  v_locked := coalesce((v_state ->> 'locked')::boolean, false);
  v_roster_min := greatest(
    1,
    coalesce(
      nullif(v_state #>> '{settings,rosterMin}', '')::integer,
      nullif(v_state #>> '{settings,rosterSize}', '')::integer,
      1
    )
  );

  if v_locked
     and jsonb_typeof(v_state -> 'rosters') = 'array'
     and jsonb_array_length(v_state -> 'rosters') = v_team_count
     and not exists (
       select 1
       from jsonb_array_elements(v_state -> 'rosters') roster(value)
       where jsonb_typeof(roster.value) <> 'array'
          or jsonb_array_length(roster.value) < v_roster_min
     ) then
    if coalesce(v_state #>> '{settings,draftType}', 'snake') = 'auction' then
      v_draft_complete := coalesce((v_state ->> 'auctionEnded')::boolean, false)
        or (jsonb_typeof(v_state -> 'pool') = 'array' and jsonb_array_length(v_state -> 'pool') = 0);
    else
      v_draft_complete := jsonb_typeof(v_state -> 'snakeOrder') = 'array'
        and coalesce((v_state ->> 'pickIndex')::integer, 0) >= jsonb_array_length(v_state -> 'snakeOrder');
    end if;
  end if;

  if v_locked and not v_draft_complete then
    raise exception 'Teams cannot be claimed while the live draft is active.';
  end if;

  v_team := v_state #> array['teams', p_team_index::text];
  if v_team is null then raise exception 'Team not found.'; end if;
  if nullif(btrim(v_team ->> 'claimedBy'), '') is not null
     or nullif(btrim(v_team ->> 'claimedByUserId'), '') is not null then
    raise exception 'That team has already been claimed. Refresh to see the remaining teams.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_state -> 'teams') team(value)
    where team.value ->> 'claimedByUserId' = v_user_id
  ) then
    raise exception 'You already claimed a team in this league.';
  end if;

  select display_name, username into v_name, v_username
  from public.profiles where id = auth.uid();
  v_name := coalesce(nullif(btrim(v_name), ''), nullif(btrim(v_username), ''), 'Coach');
  v_source_key := coalesce(nullif(v_team ->> 'sourceKey', ''), nullif(v_team ->> 'id', ''), p_team_index::text);

  v_state := jsonb_set(
    v_state,
    array['teams', p_team_index::text],
    v_team || jsonb_build_object('claimedBy', v_name, 'claimedByUserId', v_user_id),
    false
  );

  if not v_locked then
    v_state := public.compact_pre_draft_teams_claimed_first(p_league_id, v_state, v_team_count);
  else
    v_state := jsonb_set(
      v_state,
      '{auditLog}',
      coalesce(case when jsonb_typeof(v_state -> 'auditLog') = 'array' then v_state -> 'auditLog' end, '[]'::jsonb)
        || jsonb_build_array(jsonb_build_object(
          'id', v_now_ms::text || '-team-claim',
          'ts', v_now_ms,
          'actor', v_name,
          'action', 'Claimed completed-draft team',
          'detail', coalesce(v_team ->> 'name', 'Team ' || (p_team_index + 1))
        )),
      true
    );
  end if;

  v_state := jsonb_set(
    v_state,
    '{rev}',
    to_jsonb(greatest(coalesce((v_state ->> 'rev')::bigint, 0) + 1, 1)),
    true
  );

  update public.league_state_snapshots
  set state = v_state,
      revision = revision + 1,
      updated_at = now()
  where league_id = p_league_id;

  update public.teams
  set owner_membership_id = v_membership_id
  where league_id = p_league_id
    and source_key = v_source_key
    and owner_membership_id is null;

  insert into public.league_events(league_id, kind, actor_id, payload)
  values (
    p_league_id,
    case when v_locked then 'completed_draft_team_claimed' else 'setup_team_claimed' end,
    auth.uid(),
    jsonb_build_object(
      'team_index', p_team_index,
      'team_source_key', v_source_key,
      'team_name', v_team ->> 'name',
      'draft_complete', v_draft_complete
    )
  );

  return v_state;
end;
$$;

revoke all on function public.claim_live_setup_team(uuid, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.claim_live_setup_team(uuid, integer)
  to authenticated, service_role;

commit;

notify pgrst, 'reload schema';
