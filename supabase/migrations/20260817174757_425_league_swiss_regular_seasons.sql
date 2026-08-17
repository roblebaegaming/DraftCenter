-- Server-authoritative Swiss regular seasons for ordinary draft leagues.
-- Pairings stay in the existing JSON snapshot so every current schedule,
-- prediction, playoff, archive, and export path remains compatible.

begin;

create or replace function public.league_swiss_standings(p_state jsonb)
returns table (
  team_index integer,
  match_wins integer,
  match_losses integer,
  game_wins integer,
  game_losses integer,
  bye_count integer,
  opponent_match_win_percentage numeric,
  game_win_percentage numeric,
  opponent_game_win_percentage numeric,
  opponents integer[]
)
language sql
stable
security definer
set search_path = public
as $$
  with field as (
    select team_index
    from generate_series(
      0,
      greatest(0, jsonb_array_length(coalesce(p_state -> 'teams', '[]'::jsonb)) - 1)
    ) team_index
    where jsonb_array_length(coalesce(p_state -> 'teams', '[]'::jsonb)) > 0
  ), completed as (
    select
      (pairing.value ->> 0)::integer as team_a,
      (pairing.value ->> 1)::integer as team_b,
      case
        when (result.value ->> 'gamesA')::integer > (result.value ->> 'gamesB')::integer
          then (pairing.value ->> 0)::integer
        else (pairing.value ->> 1)::integer
      end as winner,
      case
        when (result.value ->> 'gamesA')::integer > (result.value ->> 'gamesB')::integer
          then (pairing.value ->> 1)::integer
        else (pairing.value ->> 0)::integer
      end as loser,
      (result.value ->> 'gamesA')::integer as games_a,
      (result.value ->> 'gamesB')::integer as games_b
    from jsonb_array_elements(coalesce(p_state -> 'schedule', '[]'::jsonb))
      with ordinality round_row(value, round_ordinality)
    cross join lateral jsonb_array_elements(round_row.value)
      with ordinality pairing(value, match_ordinality)
    cross join lateral (
      select coalesce(p_state -> 'matchResults', '{}'::jsonb)
        -> ((round_row.round_ordinality - 1)::text || '-' || (pairing.match_ordinality - 1)::text) as value
    ) result
    where jsonb_typeof(pairing.value) = 'array'
      and jsonb_array_length(pairing.value) = 2
      and jsonb_typeof(result.value) = 'object'
      and coalesce(result.value ->> 'gamesA', '') ~ '^[0-9]+$'
      and coalesce(result.value ->> 'gamesB', '') ~ '^[0-9]+$'
      and (result.value ->> 'gamesA')::integer <> (result.value ->> 'gamesB')::integer
  ), byes as (
    select value::integer as team_index, count(*)::integer as bye_count
    from jsonb_each_text(coalesce(p_state -> 'swissByes', '{}'::jsonb))
    where key ~ '^[0-9]+$' and value ~ '^[0-9]+$'
    group by value::integer
  ), base_stats as (
    select
      field.team_index,
      (
        count(completed.winner) filter (where completed.winner = field.team_index)
        + coalesce(byes.bye_count, 0)
      )::integer as match_wins,
      count(completed.loser) filter (where completed.loser = field.team_index)::integer as match_losses,
      coalesce(sum(case
        when completed.team_a = field.team_index then completed.games_a
        when completed.team_b = field.team_index then completed.games_b
        else 0
      end), 0)::integer as game_wins,
      coalesce(sum(case
        when completed.team_a = field.team_index then completed.games_b
        when completed.team_b = field.team_index then completed.games_a
        else 0
      end), 0)::integer as game_losses,
      coalesce(byes.bye_count, 0)::integer as bye_count,
      coalesce(array_remove(array_agg(case
        when completed.team_a = field.team_index then completed.team_b
        when completed.team_b = field.team_index then completed.team_a
        else null
      end), null), '{}'::integer[]) as opponents
    from field
    left join completed
      on field.team_index in (completed.team_a, completed.team_b)
    left join byes on byes.team_index = field.team_index
    group by field.team_index, byes.bye_count
  ), rates as (
    select base_stats.*,
      case when game_wins + game_losses > 0
        then game_wins::numeric / (game_wins + game_losses)
        else 0::numeric
      end as game_win_percentage
    from base_stats
  )
  select
    rates.team_index,
    rates.match_wins,
    rates.match_losses,
    rates.game_wins,
    rates.game_losses,
    rates.bye_count,
    coalesce((
      select avg(greatest(
        1::numeric / 3,
        case when opponent.match_wins + opponent.match_losses > 0
          then opponent.match_wins::numeric / (opponent.match_wins + opponent.match_losses)
          else 0::numeric
        end
      ))
      from unnest(rates.opponents) played_opponent(team_index)
      join rates opponent on opponent.team_index = played_opponent.team_index
    ), 0::numeric) as opponent_match_win_percentage,
    rates.game_win_percentage,
    coalesce((
      select avg(greatest(1::numeric / 3, opponent.game_win_percentage))
      from unnest(rates.opponents) played_opponent(team_index)
      join rates opponent on opponent.team_index = played_opponent.team_index
    ), 0::numeric) as opponent_game_win_percentage,
    rates.opponents
  from rates;
$$;

create or replace function public.league_swiss_find_pairs(
  p_remaining integer[],
  p_score_by_team jsonb,
  p_played_keys text[],
  p_rematches_left integer
)
returns integer[]
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_first integer;
  v_candidate integer;
  v_remaining integer[];
  v_tail integer[];
  v_key text;
  v_index integer;
  v_is_rematch boolean;
begin
  if coalesce(array_length(p_remaining, 1), 0) = 0 then return '{}'::integer[]; end if;
  if array_length(p_remaining, 1) % 2 = 1 then return null; end if;
  if coalesce(p_rematches_left, -1) < 0 then return null; end if;
  v_first := p_remaining[1];
  for v_index in
    select candidate_index
    from generate_series(2, array_length(p_remaining, 1)) candidate_index
    order by
      abs(
        coalesce((p_score_by_team ->> v_first::text)::integer, 0)
        - coalesce((p_score_by_team ->> p_remaining[candidate_index]::text)::integer, 0)
      ),
      candidate_index,
      p_remaining[candidate_index]
  loop
    v_candidate := p_remaining[v_index];
    v_key := least(v_first, v_candidate)::text || ':' || greatest(v_first, v_candidate)::text;
    v_is_rematch := v_key = any(coalesce(p_played_keys, '{}'::text[]));
    if v_is_rematch and p_rematches_left = 0 then continue; end if;
    v_remaining := array_remove(array_remove(p_remaining, v_first), v_candidate);
    v_tail := public.league_swiss_find_pairs(
      v_remaining,
      p_score_by_team,
      p_played_keys,
      p_rematches_left - case when v_is_rematch then 1 else 0 end
    );
    if v_tail is not null then return array[v_first, v_candidate] || v_tail; end if;
  end loop;
  return null;
end;
$$;

create or replace function public.start_next_league_swiss_round(
  p_league_id uuid,
  p_expected_rev bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_state jsonb;
  v_revision bigint;
  v_settings jsonb;
  v_schedule jsonb;
  v_byes jsonb;
  v_team_count integer;
  v_round_count integer;
  v_round_index integer;
  v_previous_match_count integer;
  v_previous_result_count integer;
  v_order integer[];
  v_score_by_team jsonb;
  v_played text[];
  v_pairs integer[];
  v_bye integer;
  v_round jsonb := '[]'::jsonb;
  v_index integer;
  v_a integer;
  v_b integer;
  v_rematch_budget integer;
  v_rematch_count integer := 0;
  v_roster_min integer;
begin
  if auth.uid() is null or not public.is_league_staff(p_league_id) then
    raise exception 'Only league commissioners can pair Swiss rounds.';
  end if;

  select state, revision into v_state, v_revision
  from public.league_state_snapshots
  where league_id = p_league_id
  for update;
  if v_state is null then raise exception 'League state was not found.'; end if;
  if coalesce(v_state ->> 'eventMode', '') = 'draft-tournament' then
    raise exception 'Draft Tournaments use their dedicated Swiss bracket controls.';
  end if;
  if coalesce((v_state ->> 'rev')::bigint, 0) <> coalesce(p_expected_rev, -1) then
    raise exception 'The league changed. Refresh before pairing the next round.';
  end if;

  v_settings := coalesce(v_state -> 'settings', '{}'::jsonb);
  if coalesce(v_settings ->> 'regularSeasonFormat', 'round-robin') <> 'swiss' then
    raise exception 'Choose Swiss as the regular-season format first.';
  end if;
  if jsonb_typeof(coalesce(v_settings -> 'divisions', '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(v_settings -> 'divisions', '[]'::jsonb)) > 0 then
    raise exception 'Swiss regular seasons require one shared league table without pods or divisions.';
  end if;
  if jsonb_typeof(v_state -> 'teams') <> 'array' then
    raise exception 'League teams are invalid. Restore a known-good backup before continuing.';
  end if;
  v_team_count := jsonb_array_length(v_state -> 'teams');
  if v_team_count not between 4 and 16 then
    raise exception 'Swiss regular seasons currently support 4-16 teams.';
  end if;
  v_round_count := case
    when jsonb_typeof(v_settings -> 'swissRoundCount') = 'number'
      then (v_settings ->> 'swissRoundCount')::integer
    when v_team_count <= 8 then 3
    else 4
  end;
  if v_round_count not between 2 and 10 then
    raise exception 'Swiss regular seasons must use 2-10 rounds.';
  end if;
  if not public.snapshot_draft_is_complete(v_state) then
    raise exception 'Finish the draft before pairing the Swiss regular season.';
  end if;
  if coalesce(v_settings ->> 'draftType', 'snake') = 'auction' then
    v_roster_min := greatest(1, coalesce(nullif(v_settings ->> 'rosterMin', '')::integer, 1));
    if jsonb_typeof(v_state -> 'rosters') <> 'array'
       or jsonb_array_length(v_state -> 'rosters') <> v_team_count
       or exists (
         select 1 from jsonb_array_elements(v_state -> 'rosters') roster(value)
         where jsonb_typeof(roster.value) <> 'array'
            or jsonb_array_length(roster.value) < v_roster_min
       ) then
      raise exception 'Every auction team must meet the roster minimum before Swiss begins.';
    end if;
  end if;
  if (v_state -> 'playoffs') is not null and (v_state -> 'playoffs') <> 'null'::jsonb then
    raise exception 'Reset the playoff bracket before pairing another Swiss round.';
  end if;

  v_schedule := coalesce(v_state -> 'schedule', '[]'::jsonb);
  v_byes := coalesce(v_state -> 'swissByes', '{}'::jsonb);
  if jsonb_typeof(v_schedule) <> 'array' or jsonb_typeof(v_byes) <> 'object' then
    raise exception 'The saved Swiss schedule is invalid. Restore a known-good backup before continuing.';
  end if;
  v_round_index := jsonb_array_length(v_schedule);
  if v_round_index >= v_round_count then
    raise exception 'Every configured Swiss round has already been paired.';
  end if;
  if v_round_index > 0 then
    v_previous_match_count := jsonb_array_length(v_schedule -> (v_round_index - 1));
    select count(*)::integer into v_previous_result_count
    from generate_series(0, greatest(0, v_previous_match_count - 1)) match_index
    where v_previous_match_count > 0
      and jsonb_typeof(coalesce(v_state -> 'matchResults', '{}'::jsonb)
        -> ((v_round_index - 1)::text || '-' || match_index::text)) = 'object'
      and coalesce(v_state #>> array['matchResults', (v_round_index - 1)::text || '-' || match_index::text, 'gamesA'], '') ~ '^[0-9]+$'
      and coalesce(v_state #>> array['matchResults', (v_round_index - 1)::text || '-' || match_index::text, 'gamesB'], '') ~ '^[0-9]+$'
      and (v_state #>> array['matchResults', (v_round_index - 1)::text || '-' || match_index::text, 'gamesA'])::integer
        <> (v_state #>> array['matchResults', (v_round_index - 1)::text || '-' || match_index::text, 'gamesB'])::integer;
    if v_previous_match_count = 0 or v_previous_result_count <> v_previous_match_count then
      raise exception 'Finish every current-round match before pairing the next round.';
    end if;
  end if;

  select
    array_agg(standing.team_index order by
      standing.match_wins desc,
      standing.opponent_match_win_percentage desc,
      standing.game_win_percentage desc,
      standing.opponent_game_win_percentage desc,
      standing.team_index
    ),
    coalesce(jsonb_object_agg(standing.team_index::text, standing.match_wins), '{}'::jsonb)
  into v_order, v_score_by_team
  from public.league_swiss_standings(v_state) standing;

  if array_length(v_order, 1) % 2 = 1 then
    select ordered.team_index into v_bye
    from unnest(v_order) with ordinality ordered(team_index, standing_order)
    where not exists (
      select 1 from jsonb_each_text(v_byes) prior
      where prior.value ~ '^[0-9]+$' and prior.value::integer = ordered.team_index
    )
    order by ordered.standing_order desc
    limit 1;
    if v_bye is null then v_bye := v_order[array_length(v_order, 1)]; end if;
    v_order := array_remove(v_order, v_bye);
  end if;

  select coalesce(array_agg(
    least((pairing.value ->> 0)::integer, (pairing.value ->> 1)::integer)::text
      || ':' || greatest((pairing.value ->> 0)::integer, (pairing.value ->> 1)::integer)::text
  ), '{}'::text[])
  into v_played
  from jsonb_array_elements(v_schedule) round_row(value)
  cross join lateral jsonb_array_elements(round_row.value) pairing(value)
  where jsonb_typeof(pairing.value) = 'array' and jsonb_array_length(pairing.value) = 2;

  for v_rematch_budget in 0..array_length(v_order, 1) / 2 loop
    v_pairs := public.league_swiss_find_pairs(v_order, v_score_by_team, v_played, v_rematch_budget);
    exit when v_pairs is not null;
  end loop;
  if v_pairs is null then raise exception 'The Swiss round could not be paired safely.'; end if;

  for v_index in 1..coalesce(array_length(v_pairs, 1), 0) by 2 loop
    v_a := v_pairs[v_index];
    v_b := v_pairs[v_index + 1];
    v_round := v_round || jsonb_build_array(jsonb_build_array(v_a, v_b));
    if least(v_a, v_b)::text || ':' || greatest(v_a, v_b)::text = any(v_played) then
      v_rematch_count := v_rematch_count + 1;
    end if;
  end loop;

  v_schedule := v_schedule || jsonb_build_array(v_round);
  if v_bye is not null then
    v_byes := jsonb_set(v_byes, array[v_round_index::text], to_jsonb(v_bye), true);
  end if;
  v_state := jsonb_set(v_state, '{schedule}', v_schedule, true);
  v_state := jsonb_set(v_state, '{swissByes}', v_byes, true);
  v_state := jsonb_set(v_state, '{week}', to_jsonb(v_round_index), true);
  v_state := jsonb_set(v_state, '{playoffs}', 'null'::jsonb, true);
  v_state := jsonb_set(v_state, '{rev}', to_jsonb(coalesce((v_state ->> 'rev')::bigint, 0) + 1), true);

  update public.league_state_snapshots
  set state = v_state, revision = coalesce(v_revision, 0) + 1, updated_at = now()
  where league_id = p_league_id;
  insert into public.league_events(league_id, kind, actor_id, payload)
  values (
    p_league_id,
    'league_swiss_round_paired',
    auth.uid(),
    jsonb_build_object(
      'round_number', v_round_index + 1,
      'match_count', jsonb_array_length(v_round),
      'has_bye', v_bye is not null,
      'unavoidable_rematch_count', v_rematch_count
    )
  );
  return v_state;
end;
$$;

-- Keep regular-season corrections atomic. A competitive correction to an
-- earlier Swiss round either rolls back empty future pairings or is refused
-- once a future result exists. Replay and MVP edits never disturb pairings.
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
  v_existing_result jsonb;
  v_competitive_change boolean := false;
  v_schedule_rounds integer;
  v_trimmed jsonb;
begin
  if auth.uid() is null or not public.is_league_member(p_league_id) then
    raise exception 'Only league members can report match results.';
  end if;
  if p_week is null or p_match is null or p_week < 0 or p_match < 0
     or p_result is null or jsonb_typeof(p_result) <> 'object' then
    raise exception 'Choose a valid scheduled matchup.';
  end if;

  select coalesce(nullif(display_name, ''), username)
  into v_identity from public.profiles where id = auth.uid();
  if nullif(v_identity, '') is null then
    raise exception 'Complete your DraftCenter profile before reporting a result.';
  end if;

  select state, revision into v_state, v_revision
  from public.league_state_snapshots
  where league_id = p_league_id
  for update;
  if v_state is null then raise exception 'League state was not found.'; end if;

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
     or not ((v_games_a = v_wins_needed and v_games_b < v_wins_needed)
       or (v_games_b = v_wins_needed and v_games_a < v_wins_needed)) then
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
    'gamesA', v_games_a, 'gamesB', v_games_b, 'bestOf', v_best_of,
    'monsAliveA', v_mons_alive_a, 'monsAliveB', v_mons_alive_b,
    'reportedBy', v_identity, 'replayUrlA', v_replay_a,
    'replayUrlB', v_replay_b, 'mvp', v_mvp
  );
  v_existing_result := coalesce(v_state -> 'matchResults', '{}'::jsonb)
    -> (p_week::text || '-' || p_match::text);
  if jsonb_typeof(v_existing_result) = 'object' then
    v_competitive_change :=
      coalesce((v_existing_result ->> 'gamesA')::integer, 0) <> v_games_a
      or coalesce((v_existing_result ->> 'gamesB')::integer, 0) <> v_games_b
      or coalesce((v_existing_result ->> 'bestOf')::integer, 3) <> v_best_of
      or coalesce((v_existing_result ->> 'monsAliveA')::integer, 0) <> v_mons_alive_a
      or coalesce((v_existing_result ->> 'monsAliveB')::integer, 0) <> v_mons_alive_b;
  end if;

  if coalesce(v_state #>> '{settings,regularSeasonFormat}', 'round-robin') = 'swiss' then
    v_schedule_rounds := jsonb_array_length(coalesce(v_state -> 'schedule', '[]'::jsonb));
    if v_competitive_change and p_week < v_schedule_rounds - 1 then
      if exists (
        select 1 from jsonb_object_keys(coalesce(v_state -> 'matchResults', '{}'::jsonb)) result_key
        where result_key ~ '^[0-9]+-[0-9]+$'
          and split_part(result_key, '-', 1)::integer > p_week
      ) then
        raise exception 'This result cannot change because a later Swiss round has started.';
      end if;

      select coalesce(jsonb_agg(round_row.value order by round_row.ordinality), '[]'::jsonb)
      into v_trimmed
      from jsonb_array_elements(v_state -> 'schedule') with ordinality round_row(value, ordinality)
      where round_row.ordinality <= p_week + 1;
      v_state := jsonb_set(v_state, '{schedule}', v_trimmed, true);
      select coalesce(jsonb_object_agg(entry.key, entry.value), '{}'::jsonb)
      into v_trimmed
      from jsonb_each(coalesce(v_state -> 'swissByes', '{}'::jsonb)) entry
      where entry.key ~ '^[0-9]+$' and entry.key::integer <= p_week;
      v_state := jsonb_set(v_state, '{swissByes}', v_trimmed, true);
      select coalesce(jsonb_object_agg(entry.key, entry.value), '{}'::jsonb)
      into v_trimmed
      from jsonb_each(coalesce(v_state -> 'predictions', '{}'::jsonb)) entry
      where entry.key !~ '^[0-9]+-[0-9]+$'
         or split_part(entry.key, '-', 1)::integer <= p_week;
      v_state := jsonb_set(v_state, '{predictions}', v_trimmed, true);
      v_state := jsonb_set(v_state, '{week}', to_jsonb(p_week), true);
      v_state := jsonb_set(v_state, '{playoffs}', 'null'::jsonb, true);
    end if;
  end if;

  if jsonb_typeof(v_state -> 'matchResults') <> 'object' then
    v_state := jsonb_set(v_state, '{matchResults}', '{}'::jsonb, true);
  end if;
  v_state := jsonb_set(
    v_state,
    array['matchResults', p_week::text || '-' || p_match::text],
    v_saved_result,
    true
  );
  v_state := jsonb_set(v_state, '{rev}', to_jsonb(coalesce((v_state ->> 'rev')::bigint, 0) + 1), true);
  update public.league_state_snapshots
  set state = v_state, revision = coalesce(v_revision, 0) + 1, updated_at = now()
  where league_id = p_league_id;
  return v_state;
end;
$$;

-- Whole-snapshot saves may still change ordinary league presentation and
-- playoff state, but Swiss pairings and results must use the atomic RPCs.
create or replace function public.save_league_snapshot(
  p_league_id uuid,
  p_state jsonb
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_revision bigint;
  v_existing jsonb;
  v_next jsonb := p_state;
  v_key text;
  v_incoming_rev bigint;
  v_existing_rev bigint;
  v_protected_keys text[] := array[
    'locked', 'rosters', 'budgets', 'pool', 'auctionNominationOrder',
    'auctionNominationIdx', 'nominationDeadline', 'nominee', 'paused',
    'pausedAt', 'pauseIsOvernight', 'auctionEnded'
  ];
begin
  if not public.is_league_staff(p_league_id) then
    raise exception 'Only league commissioners can save league state.';
  end if;
  if jsonb_typeof(p_state) <> 'object' then raise exception 'League state must be a JSON object.'; end if;
  select state into v_existing
  from public.league_state_snapshots where league_id = p_league_id for update;
  if v_existing is null then raise exception 'League state was not found.'; end if;

  v_incoming_rev := coalesce((p_state ->> 'rev')::bigint, 0);
  v_existing_rev := coalesce((v_existing ->> 'rev')::bigint, 0);
  if v_incoming_rev <= v_existing_rev then
    raise exception 'This league changed in another session. Refresh before saving again.';
  end if;
  if jsonb_array_length(coalesce(v_existing -> 'schedule', '[]'::jsonb)) > 0 then
    if coalesce(v_existing #>> '{settings,regularSeasonFormat}', 'round-robin')
       <> coalesce(p_state #>> '{settings,regularSeasonFormat}', 'round-robin') then
      raise exception 'The regular-season format cannot change after the schedule starts.';
    end if;
    if coalesce(v_existing #>> '{settings,regularSeasonFormat}', 'round-robin') = 'swiss' then
      if coalesce(v_existing #> '{settings,swissRoundCount}', 'null'::jsonb)
         <> coalesce(p_state #> '{settings,swissRoundCount}', 'null'::jsonb) then
        raise exception 'The Swiss round count cannot change after the schedule starts.';
      end if;
      if coalesce(v_existing -> 'schedule', '[]'::jsonb) <> coalesce(p_state -> 'schedule', '[]'::jsonb)
         or coalesce(v_existing -> 'swissByes', '{}'::jsonb) <> coalesce(p_state -> 'swissByes', '{}'::jsonb)
         or coalesce(v_existing -> 'matchResults', '{}'::jsonb) <> coalesce(p_state -> 'matchResults', '{}'::jsonb) then
        raise exception 'Swiss pairings and results must use their dedicated league actions.';
      end if;
    end if;
  end if;

  if v_existing ? 'messages' then v_next := jsonb_set(v_next, '{messages}', v_existing -> 'messages', true); end if;
  if v_existing ? 'readReceipts' then
    v_next := jsonb_set(v_next, '{readReceipts}', v_existing -> 'readReceipts', true);
  end if;
  if coalesce(v_existing #>> '{settings,draftType}', '') = 'auction'
     and coalesce((v_existing ->> 'locked')::boolean, false)
     and coalesce((p_state ->> 'locked')::boolean, false) then
    foreach v_key in array v_protected_keys loop
      if v_existing ? v_key then v_next := jsonb_set(v_next, array[v_key], v_existing -> v_key, true); end if;
    end loop;
  elsif coalesce(v_existing #>> '{settings,draftType}', '') = 'auction'
     and coalesce((v_existing ->> 'locked')::boolean, false)
     and not coalesce((p_state ->> 'locked')::boolean, false) then
    delete from public.auction_team_owners where league_id = p_league_id;
  end if;

  update public.league_state_snapshots
  set state = v_next, revision = revision + 1, updated_at = now()
  where league_id = p_league_id returning revision into v_revision;
  return v_revision;
end;
$$;

revoke all on function public.league_swiss_standings(jsonb)
  from public, anon, authenticated;
revoke all on function public.league_swiss_find_pairs(integer[], jsonb, text[], integer)
  from public, anon, authenticated;
revoke all on function public.start_next_league_swiss_round(uuid, bigint)
  from public, anon, authenticated;
revoke all on function public.save_regular_season_result(uuid, integer, integer, jsonb)
  from public, anon, authenticated;
revoke all on function public.save_league_snapshot(uuid, jsonb)
  from public, anon, authenticated;

grant execute on function public.league_swiss_standings(jsonb) to service_role;
grant execute on function public.league_swiss_find_pairs(integer[], jsonb, text[], integer) to service_role;
grant execute on function public.start_next_league_swiss_round(uuid, bigint) to authenticated, service_role;
grant execute on function public.save_regular_season_result(uuid, integer, integer, jsonb) to authenticated, service_role;
grant execute on function public.save_league_snapshot(uuid, jsonb) to authenticated, service_role;

commit;

notify pgrst, 'reload schema';
