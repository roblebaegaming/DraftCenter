-- Keep claimed teams ahead of open bot slots during setup, and let
-- commissioners shrink a league without deleting a human-controlled team or
-- attaching a manager's private queue to the wrong team index.

begin;

create or replace function public.compact_pre_draft_teams_claimed_first(
  p_league_id uuid,
  p_state jsonb,
  p_size integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_state jsonb := p_state;
  v_team_count integer;
  v_claimed_count integer;
  v_mapping jsonb := '{}'::jsonb;
  v_teams jsonb := '[]'::jsonb;
  v_divisions jsonb;
  v_division_count integer := 0;
  v_redistributed_divisions jsonb := '[]'::jsonb;
begin
  if jsonb_typeof(v_state -> 'teams') <> 'array' then
    raise exception 'League teams have not been initialized yet.';
  end if;

  v_team_count := jsonb_array_length(v_state -> 'teams');
  select count(*)
  into v_claimed_count
  from jsonb_array_elements(v_state -> 'teams') team
  where nullif(btrim(team ->> 'claimedBy'), '') is not null
     or nullif(btrim(team ->> 'claimedByUserId'), '') is not null;

  if p_size < 2 or p_size > v_team_count then
    raise exception 'Choose a team count from 2 through %.', v_team_count;
  end if;
  if p_size < v_claimed_count then
    raise exception 'This league already has % human-controlled teams. Remove a manager before lowering the league below % teams.', v_claimed_count, v_claimed_count;
  end if;

  with ranked as (
    select
      entry.value as team,
      entry.ordinality::integer - 1 as old_index,
      row_number() over (
        order by
          case
            when nullif(btrim(entry.value ->> 'claimedBy'), '') is not null
              or nullif(btrim(entry.value ->> 'claimedByUserId'), '') is not null
              then 0
            else 1
          end,
          entry.ordinality
      )::integer - 1 as new_index
    from jsonb_array_elements(v_state -> 'teams') with ordinality entry(value, ordinality)
  )
  select
    coalesce(jsonb_object_agg(old_index::text, new_index) filter (where new_index < p_size), '{}'::jsonb),
    coalesce(
      jsonb_agg(
        jsonb_set(team, '{id}', to_jsonb(new_index), true)
        order by new_index
      ) filter (where new_index < p_size),
      '[]'::jsonb
    )
  into v_mapping, v_teams
  from ranked;

  -- Queue ownership is private and keyed by the setup-team index. Move every
  -- kept queue through an unused offset before applying its new index so the
  -- primary and position uniqueness constraints cannot collide mid-update.
  delete from public.private_draft_queue_items item
  where item.league_id = p_league_id
    and not (v_mapping ? item.team_index::text);

  update public.private_draft_queue_items item
  set team_index = item.team_index + 1000
  where item.league_id = p_league_id
    and (v_mapping ? item.team_index::text);

  update public.private_draft_queue_items item
  set team_index = (v_mapping ->> ((item.team_index - 1000)::text))::integer
  where item.league_id = p_league_id
    and item.team_index >= 1000
    and (v_mapping ? ((item.team_index - 1000)::text));

  v_divisions := coalesce(v_state #> '{settings,divisions}', '[]'::jsonb);
  if jsonb_typeof(v_divisions) = 'array' then
    v_division_count := jsonb_array_length(v_divisions);
  end if;
  if v_division_count > 0 then
    select coalesce(
      jsonb_agg(
        jsonb_set(
          division.value,
          '{teamIds}',
          coalesce((
            select jsonb_agg(generated.team_index order by generated.team_index)
            from generate_series(0, p_size - 1) generated(team_index)
            where mod(generated.team_index, v_division_count) = division.ordinality::integer - 1
          ), '[]'::jsonb),
          true
        )
        order by division.ordinality
      ),
      '[]'::jsonb
    )
    into v_redistributed_divisions
    from jsonb_array_elements(v_divisions) with ordinality division(value, ordinality);
  end if;

  v_state := jsonb_set(v_state, '{teams}', v_teams, true);
  v_state := jsonb_set(v_state, '{queues}', '{}'::jsonb, true);
  v_state := jsonb_set(v_state, '{settings,leagueSize}', to_jsonb(p_size), true);
  v_state := jsonb_set(v_state, '{settings,manualDraftOrder}', 'null'::jsonb, true);
  if v_division_count > 0 then
    v_state := jsonb_set(v_state, '{settings,divisions}', v_redistributed_divisions, true);
  end if;
  return v_state;
end;
$$;

revoke all on function public.compact_pre_draft_teams_claimed_first(uuid, jsonb, integer)
  from public, anon, authenticated;

create or replace function public.resize_pre_draft_league_bot_first(
  p_league_id uuid,
  p_size integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_state jsonb;
  v_team_count integer;
begin
  if auth.uid() is null then raise exception 'You must be signed in.'; end if;
  if not public.is_league_staff(p_league_id) then
    raise exception 'Only league commissioners can change the team count.';
  end if;

  select state into v_state
  from public.league_state_snapshots
  where league_id = p_league_id
  for update;

  if v_state is null then raise exception 'League setup was not found.'; end if;
  if coalesce((v_state ->> 'locked')::boolean, false) then
    raise exception 'The team count cannot change after the draft starts.';
  end if;
  v_team_count := jsonb_array_length(coalesce(v_state -> 'teams', '[]'::jsonb));
  if p_size >= v_team_count then
    raise exception 'This action is only for removing open setup teams.';
  end if;

  v_state := public.compact_pre_draft_teams_claimed_first(p_league_id, v_state, p_size);
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

  return v_state;
end;
$$;

revoke all on function public.resize_pre_draft_league_bot_first(uuid, integer)
  from public, anon, authenticated;
grant execute on function public.resize_pre_draft_league_bot_first(uuid, integer)
  to authenticated;

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
begin
  if auth.uid() is null then raise exception 'You must be signed in.'; end if;
  if p_team_index < 0 then raise exception 'Choose a valid team.'; end if;
  if not exists (
    select 1 from public.league_memberships
    where league_id = p_league_id and user_id = auth.uid()
      and role in ('coach', 'commissioner', 'co_commissioner')
  ) then
    raise exception 'Join this league before claiming a team.';
  end if;

  select state into v_state
  from public.league_state_snapshots
  where league_id = p_league_id
  for update;

  if v_state is null then raise exception 'League setup was not found.'; end if;
  if coalesce((v_state ->> 'locked')::boolean, false) then
    raise exception 'Teams cannot be claimed after the live draft starts.';
  end if;
  if jsonb_typeof(v_state -> 'teams') <> 'array' then
    raise exception 'League teams have not been initialized yet.';
  end if;

  v_team := v_state #> array['teams', p_team_index::text];
  if v_team is null then raise exception 'Team not found.'; end if;
  if nullif(btrim(v_team ->> 'claimedBy'), '') is not null
     or nullif(btrim(v_team ->> 'claimedByUserId'), '') is not null then
    raise exception 'That team has already been claimed. Refresh to see the remaining teams.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_state -> 'teams') team
    where team ->> 'claimedByUserId' = v_user_id
  ) then
    raise exception 'You already claimed a team in this league.';
  end if;

  select display_name, username into v_name, v_username
  from public.profiles where id = auth.uid();
  v_name := coalesce(nullif(btrim(v_name), ''), nullif(btrim(v_username), ''), 'Coach');

  v_state := jsonb_set(
    v_state,
    array['teams', p_team_index::text],
    v_team || jsonb_build_object('claimedBy', v_name, 'claimedByUserId', v_user_id),
    false
  );
  v_team_count := jsonb_array_length(v_state -> 'teams');
  v_state := public.compact_pre_draft_teams_claimed_first(
    p_league_id,
    v_state,
    v_team_count
  );
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

  return v_state;
end;
$$;

revoke all on function public.claim_live_setup_team(uuid, integer)
  from public, anon, authenticated;
grant execute on function public.claim_live_setup_team(uuid, integer)
  to authenticated;

commit;

notify pgrst, 'reload schema';
