-- Atomic, participant-authorized regular-season result reporting.
-- Managers may report only matchups involving one of their teams; league
-- staff retain correction access. The server stamps the reporter identity.

begin;

create or replace function public.save_regular_season_result(
  p_league_id uuid,
  p_week integer,
  p_match integer,
  p_result jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_state jsonb;
  v_revision bigint;
  v_match jsonb;
  v_team_a integer;
  v_team_b integer;
  v_identity text;
  v_games_a integer;
  v_games_b integer;
  v_best_of integer;
  v_wins_needed integer;
  v_mons_alive_a integer;
  v_mons_alive_b integer;
  v_replay_a text;
  v_replay_b text;
  v_mvp jsonb;
  v_saved_result jsonb;
begin
  if auth.uid() is null or not public.is_league_member(p_league_id) then
    raise exception 'Only league members can report match results.';
  end if;
  if p_week is null or p_match is null or p_week < 0 or p_match < 0
     or p_result is null or jsonb_typeof(p_result) <> 'object' then
    raise exception 'Choose a valid scheduled matchup.';
  end if;

  select coalesce(nullif(display_name, ''), username)
  into v_identity
  from public.profiles
  where id = auth.uid();
  if nullif(v_identity, '') is null then
    raise exception 'Complete your DraftCenter profile before reporting a result.';
  end if;

  select state, revision
  into v_state, v_revision
  from public.league_state_snapshots
  where league_id = p_league_id
  for update;
  if v_state is null then
    raise exception 'League state was not found.';
  end if;

  v_match := v_state #> array['schedule', p_week::text, p_match::text];
  if jsonb_typeof(v_match) <> 'array' or jsonb_array_length(v_match) <> 2 then
    raise exception 'That scheduled matchup was not found.';
  end if;
  v_team_a := (v_match ->> 0)::integer;
  v_team_b := (v_match ->> 1)::integer;

  if not public.is_league_staff(p_league_id)
     and lower(coalesce(v_state #>> array['teams', v_team_a::text, 'claimedBy'], '')) <> lower(v_identity)
     and lower(coalesce(v_state #>> array['teams', v_team_b::text, 'claimedBy'], '')) <> lower(v_identity) then
    raise exception 'You can only report a matchup involving your own team.';
  end if;

  v_games_a := coalesce((p_result ->> 'gamesA')::integer, 0);
  v_games_b := coalesce((p_result ->> 'gamesB')::integer, 0);
  v_best_of := coalesce((p_result ->> 'bestOf')::integer, 3);
  if v_best_of not in (1, 3, 5) then
    raise exception 'Choose a best-of-1, best-of-3, or best-of-5 result.';
  end if;
  v_wins_needed := (v_best_of + 1) / 2;
  if v_games_a < 0 or v_games_b < 0
     or not (
       (v_games_a = v_wins_needed and v_games_b < v_wins_needed)
       or (v_games_b = v_wins_needed and v_games_a < v_wins_needed)
     ) then
    raise exception 'Enter a completed result for the selected series length.';
  end if;

  v_mons_alive_a := coalesce((p_result ->> 'monsAliveA')::integer, 0);
  v_mons_alive_b := coalesce((p_result ->> 'monsAliveB')::integer, 0);
  if v_mons_alive_a < 0 or v_mons_alive_b < 0
     or v_mons_alive_a > 6 * v_games_a or v_mons_alive_b > 6 * v_games_b then
    raise exception 'Enter valid remaining-Pokemon totals.';
  end if;

  v_replay_a := nullif(btrim(p_result ->> 'replayUrlA'), '');
  v_replay_b := nullif(btrim(p_result ->> 'replayUrlB'), '');
  if (v_replay_a is not null and (char_length(v_replay_a) > 2000 or v_replay_a !~* '^https://'))
     or (v_replay_b is not null and (char_length(v_replay_b) > 2000 or v_replay_b !~* '^https://')) then
    raise exception 'Replay links must be secure web addresses.';
  end if;

  v_mvp := p_result -> 'mvp';
  if v_mvp is not null and jsonb_typeof(v_mvp) <> 'null' then
    if jsonb_typeof(v_mvp) <> 'object'
       or coalesce(v_mvp ->> 'side', '') not in ('A', 'B')
       or nullif(btrim(v_mvp ->> 'name'), '') is null
       or char_length(v_mvp ->> 'name') > 120 then
      raise exception 'Choose a valid Match MVP.';
    end if;
  else
    v_mvp := 'null'::jsonb;
  end if;

  v_saved_result := jsonb_build_object(
    'gamesA', v_games_a,
    'gamesB', v_games_b,
    'bestOf', v_best_of,
    'monsAliveA', v_mons_alive_a,
    'monsAliveB', v_mons_alive_b,
    'reportedBy', v_identity,
    'replayUrlA', v_replay_a,
    'replayUrlB', v_replay_b,
    'mvp', v_mvp
  );

  if jsonb_typeof(v_state -> 'matchResults') <> 'object' then
    v_state := jsonb_set(v_state, '{matchResults}', '{}'::jsonb, true);
  end if;
  v_state := jsonb_set(
    v_state,
    array['matchResults', p_week::text || '-' || p_match::text],
    v_saved_result,
    true
  );
  v_state := jsonb_set(
    v_state,
    '{rev}',
    to_jsonb(coalesce((v_state ->> 'rev')::bigint, 0) + 1),
    true
  );

  update public.league_state_snapshots
  set state = v_state,
      revision = coalesce(v_revision, 0) + 1,
      updated_at = now()
  where league_id = p_league_id;

  return v_state;
end;
$$;

revoke all on function public.save_regular_season_result(uuid, integer, integer, jsonb)
  from public, anon, authenticated;
grant execute on function public.save_regular_season_result(uuid, integer, integer, jsonb)
  to authenticated;

commit;

notify pgrst, 'reload schema';
