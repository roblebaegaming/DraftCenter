-- Participant-authorized, atomic result saves for every playoff format.

begin;

create or replace function public.save_playoff_result_v2(
  p_league_id uuid,
  p_path text[],
  p_team_a integer,
  p_team_b integer,
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
  v_identity text;
  v_playoffs jsonb;
  v_mode text;
  v_parent jsonb;
  v_existing jsonb;
  v_team_count integer;
  v_games_a integer;
  v_games_b integer;
  v_best_of integer;
  v_wins_needed integer;
  v_mons_alive_a integer;
  v_mons_alive_b integer;
  v_replay_a text;
  v_replay_b text;
  v_mvp jsonb;
  v_mvp_team integer;
  v_saved_result jsonb;
  v_result_key text;
  v_division_index integer;
  v_allowed_path boolean := false;
  v_seeded_a boolean := false;
  v_seeded_b boolean := false;
begin
  if auth.uid() is null or not public.is_league_member(p_league_id) then
    raise exception 'Only league members can report playoff results.';
  end if;
  if p_result is null or jsonb_typeof(p_result) <> 'object' then
    raise exception 'A playoff result object is required.';
  end if;
  if p_team_a is null or p_team_b is null
     or p_team_a < 0 or p_team_b < 0 or p_team_a = p_team_b then
    raise exception 'Choose a valid playoff matchup.';
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

  v_playoffs := v_state -> 'playoffs';
  if jsonb_typeof(v_playoffs) <> 'object' then
    raise exception 'The playoff bracket was not found.';
  end if;
  v_mode := coalesce(v_playoffs ->> 'mode', 'single');
  v_team_count := jsonb_array_length(
    coalesce(v_state -> 'teams', '[]'::jsonb)
  );
  if p_team_a >= v_team_count or p_team_b >= v_team_count then
    raise exception 'That playoff team was not found.';
  end if;

  if not public.is_league_staff(p_league_id)
     and lower(coalesce(
       v_state #>> array['teams', p_team_a::text, 'claimedBy'],
       ''
     )) <> lower(v_identity)
     and lower(coalesce(
       v_state #>> array['teams', p_team_b::text, 'claimedBy'],
       ''
     )) <> lower(v_identity) then
    raise exception 'You can only report a playoff matchup involving your own team.';
  end if;

  if coalesce(array_length(p_path, 1), 0) = 2
     and p_path[1] = 'results'
     and p_path[2] ~ '^[0-9]+-[0-9]+$'
     and v_mode <> 'divisions' then
    v_allowed_path := true;
    v_result_key := p_path[2];
    v_parent := v_playoffs -> 'results';

  elsif coalesce(array_length(p_path, 1), 0) = 2
     and p_path[1] = 'losersResults'
     and p_path[2] ~ '^[0-9]+-[0-9]+$'
     and v_mode = 'double-elim' then
    v_allowed_path := true;
    v_result_key := p_path[2];
    v_parent := v_playoffs -> 'losersResults';

  elsif coalesce(array_length(p_path, 1), 0) = 2
     and p_path[1] = 'grandFinal'
     and p_path[2] in ('game1', 'game2')
     and v_mode = 'double-elim' then
    v_allowed_path := true;
    v_result_key := p_path[2];
    v_parent := v_playoffs -> 'grandFinal';

  elsif coalesce(array_length(p_path, 1), 0) = 4
     and p_path[1] = 'divisionBrackets'
     and p_path[2] ~ '^[0-9]+$'
     and p_path[3] = 'results'
     and p_path[4] ~ '^[0-9]+-[0-9]+$'
     and v_mode = 'divisions' then
    v_division_index := p_path[2]::integer;
    if v_division_index < jsonb_array_length(
      coalesce(v_playoffs -> 'divisionBrackets', '[]'::jsonb)
    ) then
      v_allowed_path := true;
      v_result_key := p_path[4];
      v_parent := v_playoffs
        #> array['divisionBrackets', p_path[2], 'results'];
    end if;

  elsif coalesce(array_length(p_path, 1), 0) = 3
     and p_path[1] = 'championBracket'
     and p_path[2] = 'results'
     and p_path[3] ~ '^[0-9]+-[0-9]+$'
     and v_mode = 'divisions' then
    v_allowed_path := true;
    v_result_key := p_path[3];
    v_parent := v_playoffs #> '{championBracket,results}';
  end if;

  if not v_allowed_path or jsonb_typeof(v_parent) <> 'object' then
    raise exception 'That playoff result path is not valid for this bracket.';
  end if;

  if v_mode = 'divisions' then
    select
      exists (
        select 1
        from jsonb_array_elements(
          coalesce(v_playoffs -> 'divisionBrackets', '[]'::jsonb)
        ) as bracket(value)
        cross join lateral jsonb_array_elements_text(
          coalesce(bracket.value -> 'seeds', '[]'::jsonb)
        ) as seed(value)
        where seed.value::integer = p_team_a
      ),
      exists (
        select 1
        from jsonb_array_elements(
          coalesce(v_playoffs -> 'divisionBrackets', '[]'::jsonb)
        ) as bracket(value)
        cross join lateral jsonb_array_elements_text(
          coalesce(bracket.value -> 'seeds', '[]'::jsonb)
        ) as seed(value)
        where seed.value::integer = p_team_b
      )
    into v_seeded_a, v_seeded_b;
  else
    select
      exists (
        select 1
        from jsonb_array_elements_text(
          coalesce(v_playoffs -> 'seeds', '[]'::jsonb)
        ) as seed(value)
        where seed.value::integer = p_team_a
      ),
      exists (
        select 1
        from jsonb_array_elements_text(
          coalesce(v_playoffs -> 'seeds', '[]'::jsonb)
        ) as seed(value)
        where seed.value::integer = p_team_b
      )
    into v_seeded_a, v_seeded_b;
  end if;
  if not v_seeded_a or not v_seeded_b then
    raise exception 'That team is not part of this playoff bracket.';
  end if;

  v_existing := v_state #> (array['playoffs']::text[] || p_path);
  if jsonb_typeof(v_existing) = 'object'
     and (
       (v_existing ->> 'teamA') is not null
       or (v_existing ->> 'teamB') is not null
     )
     and (
       (v_existing ->> 'teamA')::integer <> p_team_a
       or (v_existing ->> 'teamB')::integer <> p_team_b
     ) then
    raise exception 'That bracket slot has changed. Refresh before reporting it.';
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
     or v_mons_alive_a > 6 * v_games_a
     or v_mons_alive_b > 6 * v_games_b then
    raise exception 'Enter valid remaining-Pokemon totals.';
  end if;

  v_replay_a := nullif(btrim(p_result ->> 'replayUrlA'), '');
  v_replay_b := nullif(btrim(p_result ->> 'replayUrlB'), '');
  if (
    v_replay_a is not null
    and (char_length(v_replay_a) > 2000 or v_replay_a !~* '^https://')
  ) or (
    v_replay_b is not null
    and (char_length(v_replay_b) > 2000 or v_replay_b !~* '^https://')
  ) then
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
    v_mvp_team := case
      when v_mvp ->> 'side' = 'A' then p_team_a
      else p_team_b
    end;
    if (
      (v_mvp ->> 'side' = 'A' and v_games_a < v_games_b)
      or (v_mvp ->> 'side' = 'B' and v_games_b < v_games_a)
      or not exists (
        select 1
        from jsonb_array_elements(
          coalesce(
            v_state #> array['rosters', v_mvp_team::text],
            '[]'::jsonb
          )
        ) pokemon
        where pokemon ->> 'name' = v_mvp ->> 'name'
      )
    ) then
      raise exception 'The Match MVP must come from the winning roster.';
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
    'mvp', v_mvp,
    'teamA', p_team_a,
    'teamB', p_team_b
  );

  v_state := jsonb_set(
    v_state,
    array['playoffs']::text[] || p_path,
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

  insert into public.league_events (league_id, kind, actor_id, payload)
  values (
    p_league_id,
    'playoff_result',
    auth.uid(),
    jsonb_build_object(
      'path',
      to_jsonb(p_path),
      'team_a',
      p_team_a,
      'team_b',
      p_team_b
    )
  );

  return v_state;
end;
$$;

revoke all on function public.save_playoff_result(
  uuid, text, jsonb
) from public, anon, authenticated;

revoke all on function public.save_playoff_result_v2(
  uuid, text[], integer, integer, jsonb
) from public, anon, authenticated;
grant execute on function public.save_playoff_result_v2(
  uuid, text[], integer, integer, jsonb
) to authenticated;

commit;

notify pgrst, 'reload schema';
