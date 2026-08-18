-- 438: Persist only confirmed, bounded facts from official public Showdown
-- replays. Raw battle logs never enter league state or league audit history.
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
  v_showdown_replays jsonb;
  v_sanitized_replays jsonb := '[]'::jsonb;
  v_showdown_replay jsonb;
  v_replay_id text;
  v_seen_replay_ids text[] := '{}'::text[];
  v_confirmed_games_a integer := 0;
  v_confirmed_games_b integer := 0;
  v_confirmed_mons_a integer := 0;
  v_confirmed_mons_b integer := 0;
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
  if v_match is null
     or coalesce(jsonb_typeof(v_match), '') <> 'array'
     or jsonb_array_length(v_match) <> 2 then
    raise exception 'That scheduled matchup was not found.';
  end if;
  v_team_a := (v_match ->> 0)::integer;
  v_team_b := (v_match ->> 1)::integer;
  if not public.is_league_staff(p_league_id)
     and coalesce(v_state #>> array['teams', v_team_a::text, 'claimedByUserId'], '') <> auth.uid()::text
     and coalesce(v_state #>> array['teams', v_team_b::text, 'claimedByUserId'], '') <> auth.uid()::text
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

  v_showdown_replays := coalesce(p_result -> 'showdownReplays', '[]'::jsonb);
  if jsonb_typeof(v_showdown_replays) <> 'array'
     or jsonb_array_length(v_showdown_replays) > 5 then
    raise exception 'Attach no more than five confirmed Showdown replays.';
  end if;

  for v_showdown_replay in
    select replay.value from jsonb_array_elements(v_showdown_replays) replay(value)
  loop
    if jsonb_typeof(v_showdown_replay) <> 'object' then
      raise exception 'Confirmed Showdown replay facts are malformed.';
    end if;
    v_replay_id := coalesce(v_showdown_replay ->> 'id', '');
    if v_replay_id !~ '^[a-z0-9][a-z0-9-]{7,119}$'
       or coalesce(v_showdown_replay ->> 'url', '')
         !~ '^https://replay[.]pokemonshowdown[.]com/[a-z0-9][a-z0-9-]{7,119}$'
       or v_showdown_replay ->> 'url'
         <> 'https://replay.pokemonshowdown.com/' || v_replay_id
       or coalesce(v_showdown_replay ->> 'mappingConfirmed', '') <> 'true' then
      raise exception 'Use a public Showdown replay and confirm its participant mapping.';
    end if;
    if v_replay_id = any(v_seen_replay_ids) then
      raise exception 'The same Showdown replay cannot be attached twice.';
    end if;
    v_seen_replay_ids := array_append(v_seen_replay_ids, v_replay_id);

    if coalesce(v_showdown_replay ->> 'gameType', '') not in ('singles', 'doubles')
       or char_length(coalesce(v_showdown_replay ->> 'format', '')) > 120
       or nullif(btrim(v_showdown_replay ->> 'playerA'), '') is null
       or nullif(btrim(v_showdown_replay ->> 'playerB'), '') is null
       or char_length(v_showdown_replay ->> 'playerA') > 100
       or char_length(v_showdown_replay ->> 'playerB') > 100
       or coalesce(v_showdown_replay ->> 'winnerSide', '') not in ('A', 'B')
       or coalesce(v_showdown_replay ->> 'uploadedAt', '') !~ '^[0-9]{1,12}$'
       or coalesce(v_showdown_replay ->> 'remainingA', '') !~ '^[0-6]$'
       or coalesce(v_showdown_replay ->> 'remainingB', '') !~ '^[0-6]$'
       or coalesce(v_showdown_replay ->> 'faintedA', '') !~ '^[0-6]$'
       or coalesce(v_showdown_replay ->> 'faintedB', '') !~ '^[0-6]$' then
      raise exception 'Confirmed Showdown replay facts are malformed.';
    end if;
    if (v_showdown_replay ->> 'remainingA')::integer + (v_showdown_replay ->> 'faintedA')::integer not between 1 and 6
       or (v_showdown_replay ->> 'remainingB')::integer + (v_showdown_replay ->> 'faintedB')::integer not between 1 and 6 then
      raise exception 'Confirmed Showdown team counts are inconsistent.';
    end if;
    if coalesce(jsonb_typeof(v_showdown_replay -> 'revealedA'), '') <> 'array'
       or coalesce(jsonb_typeof(v_showdown_replay -> 'revealedB'), '') <> 'array' then
      raise exception 'Confirmed Showdown revealed-Pokemon facts are malformed.';
    end if;
    if jsonb_array_length(v_showdown_replay -> 'revealedA') > 6
       or jsonb_array_length(v_showdown_replay -> 'revealedB') > 6
       or exists (
         select 1
         from jsonb_array_elements(v_showdown_replay -> 'revealedA') item(value)
         where jsonb_typeof(item.value) <> 'string'
            or char_length(item.value #>> '{}') not between 1 and 120
       )
       or exists (
         select 1
         from jsonb_array_elements(v_showdown_replay -> 'revealedB') item(value)
         where jsonb_typeof(item.value) <> 'string'
            or char_length(item.value #>> '{}') not between 1 and 120
       ) then
      raise exception 'Confirmed Showdown revealed-Pokemon facts are malformed.';
    end if;

    if v_showdown_replay ->> 'winnerSide' = 'A' then
      v_confirmed_games_a := v_confirmed_games_a + 1;
      v_confirmed_mons_a := v_confirmed_mons_a + (v_showdown_replay ->> 'remainingA')::integer;
    else
      v_confirmed_games_b := v_confirmed_games_b + 1;
      v_confirmed_mons_b := v_confirmed_mons_b + (v_showdown_replay ->> 'remainingB')::integer;
    end if;
    v_sanitized_replays := v_sanitized_replays || jsonb_build_array(jsonb_build_object(
      'id', v_replay_id,
      'url', v_showdown_replay ->> 'url',
      'format', coalesce(v_showdown_replay ->> 'format', ''),
      'gameType', v_showdown_replay ->> 'gameType',
      'uploadedAt', (v_showdown_replay ->> 'uploadedAt')::bigint,
      'playerA', v_showdown_replay ->> 'playerA',
      'playerB', v_showdown_replay ->> 'playerB',
      'winnerSide', v_showdown_replay ->> 'winnerSide',
      'remainingA', (v_showdown_replay ->> 'remainingA')::integer,
      'remainingB', (v_showdown_replay ->> 'remainingB')::integer,
      'faintedA', (v_showdown_replay ->> 'faintedA')::integer,
      'faintedB', (v_showdown_replay ->> 'faintedB')::integer,
      'revealedA', v_showdown_replay -> 'revealedA',
      'revealedB', v_showdown_replay -> 'revealedB',
      'mappingConfirmed', true
    ));
  end loop;

  if jsonb_array_length(v_sanitized_replays) > 0 then
    if jsonb_array_length(v_sanitized_replays) <> v_games_a + v_games_b
       or v_confirmed_games_a <> v_games_a
       or v_confirmed_games_b <> v_games_b
       or v_confirmed_mons_a <> v_mons_alive_a
       or v_confirmed_mons_b <> v_mons_alive_b then
      raise exception 'The confirmed Showdown facts do not match the reported series.';
    end if;
    if exists (
      select 1
      from jsonb_each(coalesce(v_state -> 'matchResults', '{}'::jsonb)) result_entry
      cross join lateral jsonb_array_elements(
        case when jsonb_typeof(result_entry.value -> 'showdownReplays') = 'array'
          then result_entry.value -> 'showdownReplays' else '[]'::jsonb end
      ) prior_replay(value)
      where result_entry.key <> (p_week::text || '-' || p_match::text)
        and prior_replay.value ->> 'id' = any(v_seen_replay_ids)
    ) then
      raise exception 'A confirmed Showdown replay is already attached to another result.';
    end if;
  end if;

  v_saved_result := jsonb_build_object(
    'gamesA', v_games_a, 'gamesB', v_games_b, 'bestOf', v_best_of,
    'monsAliveA', v_mons_alive_a, 'monsAliveB', v_mons_alive_b,
    'reportedBy', v_identity, 'replayUrlA', v_replay_a,
    'replayUrlB', v_replay_b, 'mvp', v_mvp,
    'showdownReplays', v_sanitized_replays
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
  if jsonb_array_length(v_sanitized_replays) > 0 then
    insert into public.league_events(league_id, kind, actor_id, payload)
    values (
      p_league_id,
      'showdown_replay_result_saved',
      auth.uid(),
      jsonb_build_object(
        'week_number', p_week + 1,
        'match_number', p_match + 1,
        'replay_count', jsonb_array_length(v_sanitized_replays)
      )
    );
  end if;
  return v_state;
end;
$$;

comment on function public.save_regular_season_result(uuid, integer, integer, jsonb)
is 'Atomically saves a scheduled result and whitelisted facts from up to five commissioner- or participant-confirmed public Showdown replays; raw replay logs are never stored.';

revoke all on function public.save_regular_season_result(uuid, integer, integer, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.save_regular_season_result(uuid, integer, integer, jsonb)
  to authenticated, service_role;

commit;

notify pgrst, 'reload schema';
