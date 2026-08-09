-- Migration 363: atomic Draft Tournament roster lock, deterministic Swiss
-- pairing, standings, correction rollback, and optional top cut.
begin;

create or replace function public.rebuild_draft_tournament_standings(
  p_event_id uuid,
  p_round_number integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.draft_tournament_events%rowtype;
  v_round public.draft_tournament_rounds%rowtype;
begin
  select * into v_event
  from public.draft_tournament_events
  where id = p_event_id;
  select * into v_round
  from public.draft_tournament_rounds
  where event_id = p_event_id and round_number = p_round_number
  for update;
  if not found then raise exception 'Draft Tournament round not found.'; end if;

  delete from public.draft_tournament_standing_snapshots
  where round_id = v_round.id;

  with active_field as (
    select seat.entrant_id, seat.initial_seed, seat.status
    from public.draft_tournament_seats seat
    where seat.event_id = p_event_id and seat.status <> 'no-show'
  ), decisions as (
    select pairing.entrant_a_id,
      pairing.entrant_b_id,
      pairing.is_bye,
      bracket_match.winner_id,
      bracket_match.loser_id,
      coalesce(bracket_match.games_a, 0)::integer as games_a,
      coalesce(bracket_match.games_b, 0)::integer as games_b
    from public.draft_tournament_pairings pairing
    join public.draft_tournament_rounds round_row on round_row.id = pairing.round_id
    join public.tournament_matches bracket_match on bracket_match.id = pairing.tournament_match_id
    where pairing.event_id = p_event_id
      and round_row.round_number <= p_round_number
      and bracket_match.status in ('complete', 'bye')
      and bracket_match.winner_id is not null
  ), base_stats as (
    select field.entrant_id,
      field.initial_seed,
      field.status,
      count(decision.*) filter (where decision.winner_id = field.entrant_id)::smallint as match_wins,
      count(decision.*) filter (where decision.loser_id = field.entrant_id)::smallint as match_losses,
      coalesce(sum(case
        when decision.entrant_a_id = field.entrant_id and not decision.is_bye then decision.games_a
        when decision.entrant_b_id = field.entrant_id then decision.games_b
        else 0
      end), 0)::smallint as game_wins,
      coalesce(sum(case
        when decision.entrant_a_id = field.entrant_id and not decision.is_bye then decision.games_b
        when decision.entrant_b_id = field.entrant_id then decision.games_a
        else 0
      end), 0)::smallint as game_losses,
      count(decision.*) filter (where decision.is_bye and decision.winner_id = field.entrant_id)::smallint as bye_count,
      coalesce(array_remove(array_agg(case
        when decision.entrant_a_id = field.entrant_id then decision.entrant_b_id
        when decision.entrant_b_id = field.entrant_id then decision.entrant_a_id
        else null
      end), null), '{}'::uuid[]) as opponents
    from active_field field
    left join decisions decision
      on field.entrant_id in (decision.entrant_a_id, decision.entrant_b_id)
    group by field.entrant_id, field.initial_seed, field.status
  ), rates as (
    select stats.*,
      case when stats.game_wins + stats.game_losses > 0
        then stats.game_wins::numeric / (stats.game_wins + stats.game_losses)
        else 0::numeric
      end as game_win_percentage
    from base_stats stats
  ), opponent_rates as (
    select rates.*,
      coalesce((
        select avg(greatest(
          1::numeric / 3,
          case when opponent.match_wins + opponent.match_losses > 0
            then opponent.match_wins::numeric / (opponent.match_wins + opponent.match_losses)
            else 0::numeric
          end
        ))
        from unnest(rates.opponents) played_opponent(entrant_id)
        join rates opponent on opponent.entrant_id = played_opponent.entrant_id
      ), 0::numeric) as opponent_match_win_percentage,
      coalesce((
        select avg(greatest(1::numeric / 3, opponent.game_win_percentage))
        from unnest(rates.opponents) played_opponent(entrant_id)
        join rates opponent on opponent.entrant_id = played_opponent.entrant_id
      ), 0::numeric) as opponent_game_win_percentage
    from rates
  ), win_groups as (
    select match_wins, count(*)::integer as group_size
    from opponent_rates
    group by match_wins
  ), tiebreakers as (
    select rate.*,
      case when win_group.group_size = 2 then coalesce((
        select case
          when count(*) filter (where decision.winner_id = rate.entrant_id)
             > count(*) filter (where decision.loser_id = rate.entrant_id) then 1::numeric
          when count(*) filter (where decision.winner_id = rate.entrant_id)
             < count(*) filter (where decision.loser_id = rate.entrant_id) then 0::numeric
          else 0.5::numeric
        end
        from decisions decision
        join opponent_rates tied_opponent
          on tied_opponent.match_wins = rate.match_wins
         and tied_opponent.entrant_id <> rate.entrant_id
        where rate.entrant_id in (decision.entrant_a_id, decision.entrant_b_id)
          and tied_opponent.entrant_id in (decision.entrant_a_id, decision.entrant_b_id)
          and not decision.is_bye
      ), 0.5::numeric) else 0.5::numeric end as head_to_head
    from opponent_rates rate
    join win_groups win_group using (match_wins)
  ), ranked as (
    select tiebreakers.*,
      row_number() over (
        order by match_wins desc,
          head_to_head desc,
          opponent_match_win_percentage desc,
          game_win_percentage desc,
          opponent_game_win_percentage desc,
          initial_seed,
          entrant_id
      )::smallint as standing_rank
    from tiebreakers
  )
  insert into public.draft_tournament_standing_snapshots(
    round_id, event_id, tournament_id, entrant_id, rank,
    match_wins, match_losses, game_wins, game_losses, bye_count,
    head_to_head, opponent_match_win_percentage, game_win_percentage,
    opponent_game_win_percentage, opponents
  )
  select v_round.id, v_event.id, v_event.tournament_id, entrant_id, standing_rank,
    match_wins, match_losses, game_wins, game_losses, bye_count,
    round(head_to_head, 6), round(opponent_match_win_percentage, 6),
    round(game_win_percentage, 6), round(opponent_game_win_percentage, 6), opponents
  from ranked;
end;
$$;

-- Recursive backtracking is bounded to sixteen entrants. The caller raises a
-- rematch budget from zero until a complete solution exists, which proves the
-- selected round uses the minimum possible number of rematches. Within that
-- budget, candidates stay in the closest match-win group and use standing
-- order (which already ends in initial seed) as the stable fallback.
create or replace function public.draft_tournament_find_swiss_pairs(
  p_remaining uuid[],
  p_score_by_entrant jsonb,
  p_played_keys text[],
  p_rematches_left integer
)
returns uuid[]
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_first uuid;
  v_candidate uuid;
  v_remaining uuid[];
  v_tail uuid[];
  v_key text;
  v_index integer;
  v_is_rematch boolean;
begin
  if coalesce(array_length(p_remaining, 1), 0) = 0 then return '{}'::uuid[]; end if;
  if array_length(p_remaining, 1) % 2 = 1 then return null; end if;
  if coalesce(p_rematches_left, -1) < 0 then return null; end if;
  v_first := p_remaining[1];
  for v_index in
    select candidate_index
    from generate_series(2, array_length(p_remaining, 1)) candidate_index
    order by
      abs(
        coalesce((p_score_by_entrant ->> v_first::text)::integer, 0)
        - coalesce((p_score_by_entrant ->> p_remaining[candidate_index]::text)::integer, 0)
      ),
      candidate_index,
      p_remaining[candidate_index]
  loop
    v_candidate := p_remaining[v_index];
    v_key := least(v_first::text, v_candidate::text) || ':' || greatest(v_first::text, v_candidate::text);
    v_is_rematch := v_key = any(coalesce(p_played_keys, '{}'::text[]));
    if v_is_rematch and p_rematches_left = 0 then
      continue;
    end if;
    v_remaining := array_remove(array_remove(p_remaining, v_first), v_candidate);
    v_tail := public.draft_tournament_find_swiss_pairs(
      v_remaining,
      p_score_by_entrant,
      p_played_keys,
      p_rematches_left - case when v_is_rematch then 1 else 0 end
    );
    if v_tail is not null then return array[v_first, v_candidate] || v_tail; end if;
  end loop;
  return null;
end;
$$;

create or replace function public.create_draft_tournament_swiss_round(
  p_event_id uuid,
  p_round_number integer,
  p_actor_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.draft_tournament_events%rowtype;
  v_round_id uuid;
  v_order uuid[];
  v_score_by_entrant jsonb;
  v_played text[];
  v_pairs uuid[];
  v_bye uuid;
  v_match_id uuid;
  v_board integer := 0;
  v_index integer;
  v_a uuid;
  v_b uuid;
  v_rematch_count integer := 0;
  v_rematch_budget integer;
begin
  select * into v_event
  from public.draft_tournament_events
  where id = p_event_id
  for update;
  if not found or v_event.phase <> 'swiss'
     or p_round_number not between 1 and coalesce(v_event.swiss_round_count, 0)
     or p_round_number <> v_event.current_swiss_round + 1 then
    raise exception 'That Swiss round cannot be created from the current event phase.';
  end if;
  if p_round_number > 1 and not exists (
    select 1 from public.draft_tournament_rounds previous
    where previous.event_id = p_event_id
      and previous.round_number = p_round_number - 1
      and previous.status = 'complete'
  ) then
    raise exception 'The previous Swiss round is not complete.';
  end if;

  if p_round_number = 1 then
    select
      array_agg(seat.entrant_id order by seat.initial_seed, seat.entrant_id),
      coalesce(jsonb_object_agg(seat.entrant_id::text, 0), '{}'::jsonb)
    into v_order, v_score_by_entrant
    from public.draft_tournament_seats seat
    where seat.event_id = p_event_id and seat.status = 'active';
  else
    select
      array_agg(seat.entrant_id order by standing.rank, seat.initial_seed, seat.entrant_id),
      coalesce(jsonb_object_agg(seat.entrant_id::text, standing.match_wins), '{}'::jsonb)
    into v_order, v_score_by_entrant
    from public.draft_tournament_seats seat
    join public.draft_tournament_rounds previous
      on previous.event_id = seat.event_id and previous.round_number = p_round_number - 1
    join public.draft_tournament_standing_snapshots standing
      on standing.round_id = previous.id and standing.entrant_id = seat.entrant_id
    where seat.event_id = p_event_id and seat.status = 'active';
  end if;
  if coalesce(array_length(v_order, 1), 0) < 2 then
    raise exception 'At least two active entrants are required for a Swiss round.';
  end if;

  if array_length(v_order, 1) % 2 = 1 then
    select ordered.entrant_id into v_bye
    from unnest(v_order) with ordinality ordered(entrant_id, standing_order)
    where not exists (
      select 1 from public.draft_tournament_pairings prior
      where prior.event_id = p_event_id and prior.is_bye and prior.entrant_a_id = ordered.entrant_id
    )
    order by ordered.standing_order desc
    limit 1;
    if v_bye is null then v_bye := v_order[array_length(v_order, 1)]; end if;
    v_order := array_remove(v_order, v_bye);
  end if;

  select coalesce(array_agg(
    least(pairing.entrant_a_id::text, pairing.entrant_b_id::text)
      || ':' || greatest(pairing.entrant_a_id::text, pairing.entrant_b_id::text)
  ), '{}'::text[])
  into v_played
  from public.draft_tournament_pairings pairing
  where pairing.event_id = p_event_id and pairing.entrant_b_id is not null;

  for v_rematch_budget in 0..array_length(v_order, 1) / 2 loop
    v_pairs := public.draft_tournament_find_swiss_pairs(
      v_order,
      v_score_by_entrant,
      v_played,
      v_rematch_budget
    );
    exit when v_pairs is not null;
  end loop;
  if v_pairs is null then raise exception 'The Swiss round could not be paired safely.'; end if;

  insert into public.draft_tournament_rounds(event_id, tournament_id, round_number)
  values (p_event_id, v_event.tournament_id, p_round_number)
  returning id into v_round_id;

  for v_index in 1..coalesce(array_length(v_pairs, 1), 0) by 2 loop
    v_a := v_pairs[v_index];
    v_b := v_pairs[v_index + 1];
    v_board := v_board + 1;
    insert into public.tournament_matches(
      tournament_id, round_number, match_number, bracket_stage, bracket_round,
      entrant_a_id, entrant_b_id, entrant_a_source_resolved, entrant_b_source_resolved,
      best_of, status
    ) values (
      v_event.tournament_id, p_round_number, v_board, 'swiss', p_round_number,
      v_a, v_b, true, true, (select best_of from public.tournaments where id = v_event.tournament_id), 'ready'
    ) returning id into v_match_id;
    insert into public.draft_tournament_pairings(
      round_id, event_id, tournament_id, tournament_match_id,
      board_number, entrant_a_id, entrant_b_id, is_bye
    ) values (
      v_round_id, p_event_id, v_event.tournament_id, v_match_id,
      v_board, v_a, v_b, false
    );
    if least(v_a::text, v_b::text) || ':' || greatest(v_a::text, v_b::text)
       = any(v_played) then
      v_rematch_count := v_rematch_count + 1;
    end if;
  end loop;

  if v_bye is not null then
    v_board := v_board + 1;
    insert into public.tournament_matches(
      tournament_id, round_number, match_number, bracket_stage, bracket_round,
      entrant_a_id, entrant_b_id, entrant_a_source_resolved, entrant_b_source_resolved,
      best_of, status, winner_id, completed_at
    ) values (
      v_event.tournament_id, p_round_number, v_board, 'swiss', p_round_number,
      v_bye, null, true, true, (select best_of from public.tournaments where id = v_event.tournament_id),
      'bye', v_bye, now()
    ) returning id into v_match_id;
    insert into public.draft_tournament_pairings(
      round_id, event_id, tournament_id, tournament_match_id,
      board_number, entrant_a_id, entrant_b_id, is_bye
    ) values (
      v_round_id, p_event_id, v_event.tournament_id, v_match_id,
      v_board, v_bye, null, true
    );
  end if;

  update public.draft_tournament_events
  set current_swiss_round = p_round_number,
      revision = revision + 1,
      updated_at = now()
  where id = p_event_id;
  perform public.rebuild_draft_tournament_standings(p_event_id, p_round_number);
  insert into public.tournament_audit_events(tournament_id, actor_id, kind, payload)
  values (
    v_event.tournament_id,
    p_actor_id,
    'draft_tournament_swiss_round_paired',
    jsonb_build_object(
      'round_number', p_round_number,
      'pairing_count', v_board,
      'bye_entrant_id', v_bye,
      'unavoidable_rematch_count', v_rematch_count
    )
  );
  return v_round_id;
end;
$$;

create or replace function public.lock_draft_tournament_rosters(
  p_tournament_id uuid,
  p_expected_revision bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_tournament public.tournaments%rowtype;
  v_event public.draft_tournament_events%rowtype;
  v_seat public.draft_tournament_seats%rowtype;
  v_team_id uuid;
  v_roster jsonb;
  v_roster_count integer;
begin
  if auth.uid() is null then raise exception 'Sign in to lock Draft Tournament rosters.'; end if;
  select * into v_tournament from public.tournaments where id = p_tournament_id for update;
  select * into v_event from public.draft_tournament_events where tournament_id = p_tournament_id for update;
  if not found or v_tournament.owner_id <> auth.uid()
     or v_event.phase <> 'roster-review'
     or v_event.roster_locked_at is not null
     or v_event.draft_league_id is null
     or v_event.draft_session_id is null then
    raise exception 'Only the owner can lock completed Draft Tournament rosters.';
  end if;
  if v_event.revision <> p_expected_revision then
    raise exception 'The event changed. Refresh before locking rosters.';
  end if;
  if not exists (
    select 1 from public.draft_sessions session
    where session.id = v_event.draft_session_id
      and session.league_id = v_event.draft_league_id
      and session.mode = 'snake'
      and session.status = 'complete'
  ) then
    raise exception 'The hosted snake draft is not complete.';
  end if;

  for v_seat in
    select * from public.draft_tournament_seats
    where event_id = v_event.id and status = 'active'
    order by initial_seed
    for update
  loop
    select team.id into v_team_id
    from public.teams team
    join public.league_memberships membership on membership.id = team.owner_membership_id
    where team.league_id = v_event.draft_league_id
      and team.source_key = v_seat.team_key::text
      and membership.user_id = v_seat.user_id;
    if v_team_id is null then
      raise exception 'A checked-in entrant is not attached to the expected draft team.';
    end if;

    select count(*), coalesce(jsonb_agg(jsonb_build_object(
      'id', league_pokemon.source_key,
      'name', pokemon.display_name,
      'cost', league_pokemon.cost,
      'acquiredVia', entry.acquisition_type
    ) order by league_pokemon.source_key), '[]'::jsonb)
    into v_roster_count, v_roster
    from public.roster_entries entry
    join public.league_pokemon league_pokemon on league_pokemon.id = entry.league_pokemon_id
    join public.pokemon_catalogue pokemon on pokemon.id = league_pokemon.pokemon_id
    where entry.team_id = v_team_id and entry.released_at is null;
    if v_roster_count <> v_event.roster_size then
      raise exception 'Every checked-in entrant must have exactly % drafted Pokemon before roster lock.', v_event.roster_size;
    end if;

    update public.draft_tournament_seats
    set team_id = v_team_id,
        roster_snapshot = v_roster,
        roster_hash = encode(digest(v_roster::text, 'sha256'), 'hex'),
        updated_at = now()
    where id = v_seat.id;
  end loop;

  update public.draft_tournament_events
  set phase = 'swiss',
      roster_locked_at = now(),
      revision = revision + 1,
      updated_at = now()
  where id = v_event.id;
  update public.tournaments
  set revision = revision + 1, updated_at = now()
  where id = p_tournament_id;
  insert into public.tournament_audit_events(tournament_id, actor_id, kind, payload)
  values (
    p_tournament_id,
    auth.uid(),
    'draft_tournament_rosters_locked',
    jsonb_build_object('roster_size', v_event.roster_size)
  );
  perform public.create_draft_tournament_swiss_round(v_event.id, 1, auth.uid());
  return jsonb_build_object('phase', 'swiss', 'round_number', 1);
end;
$$;

create or replace function public.start_next_draft_tournament_swiss_round(
  p_tournament_id uuid,
  p_expected_revision bigint
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tournament public.tournaments%rowtype;
  v_event public.draft_tournament_events%rowtype;
  v_round_id uuid;
begin
  if auth.uid() is null then raise exception 'Sign in to pair the next round.'; end if;
  select * into v_tournament from public.tournaments where id = p_tournament_id for update;
  select * into v_event from public.draft_tournament_events where tournament_id = p_tournament_id for update;
  if not found or v_tournament.owner_id <> auth.uid()
     or v_event.phase <> 'swiss'
     or v_event.current_swiss_round < 1
     or v_event.current_swiss_round >= v_event.swiss_round_count then
    raise exception 'The next Swiss round is not available.';
  end if;
  if v_event.revision <> p_expected_revision then
    raise exception 'The event changed. Refresh before pairing the next round.';
  end if;
  if not exists (
    select 1 from public.draft_tournament_rounds round_row
    where round_row.event_id = v_event.id
      and round_row.round_number = v_event.current_swiss_round
      and round_row.status = 'complete'
  ) then
    raise exception 'Finish every current-round match before pairing the next round.';
  end if;
  v_round_id := public.create_draft_tournament_swiss_round(
    v_event.id,
    v_event.current_swiss_round + 1,
    auth.uid()
  );
  update public.tournaments
  set revision = revision + 1, updated_at = now()
  where id = p_tournament_id;
  return v_round_id;
end;
$$;

create or replace function public.cancel_draft_tournament(
  p_tournament_id uuid,
  p_expected_revision bigint
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tournament public.tournaments%rowtype;
  v_event public.draft_tournament_events%rowtype;
  v_draft_league_id uuid;
begin
  if auth.uid() is null then raise exception 'Sign in to cancel the Draft Tournament.'; end if;
  select * into v_tournament from public.tournaments where id = p_tournament_id for update;
  select * into v_event from public.draft_tournament_events where tournament_id = p_tournament_id for update;
  if not found
     or v_tournament.owner_id <> auth.uid()
     or v_event.phase not in ('draft-setup', 'drafting', 'roster-review')
     or v_event.roster_locked_at is not null then
    raise exception 'Only the owner can cancel a Draft Tournament before rosters lock.';
  end if;
  if v_event.revision <> p_expected_revision then
    raise exception 'The event changed. Refresh before cancelling it.';
  end if;

  v_draft_league_id := v_event.draft_league_id;
  update public.draft_tournament_events
  set draft_session_id = null,
      draft_league_id = null,
      phase = 'cancelled',
      revision = revision + 1,
      updated_at = now()
  where id = v_event.id;

  if v_draft_league_id is not null then
    delete from public.leagues
    where id = v_draft_league_id
      and workspace_kind = 'draft-tournament';
  end if;

  update public.tournaments
  set status = 'archived', revision = revision + 1, updated_at = now()
  where id = p_tournament_id;
  insert into public.tournament_audit_events(tournament_id, actor_id, kind, payload)
  values (
    p_tournament_id,
    auth.uid(),
    'draft_tournament_cancelled',
    jsonb_build_object('draft_league_removed', v_draft_league_id is not null)
  );
end;
$$;

create or replace function public.guard_draft_tournament_swiss_correction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pairing public.draft_tournament_pairings%rowtype;
  v_round public.draft_tournament_rounds%rowtype;
  v_event public.draft_tournament_events%rowtype;
begin
  if old.bracket_stage <> 'swiss'
     or old.status <> 'complete'
     or row(new.games_a, new.games_b, new.winner_id, new.loser_id)
        is not distinct from row(old.games_a, old.games_b, old.winner_id, old.loser_id) then
    return new;
  end if;
  select * into v_pairing
  from public.draft_tournament_pairings
  where tournament_match_id = old.id;
  if not found then return new; end if;
  select * into v_round from public.draft_tournament_rounds where id = v_pairing.round_id;
  select * into v_event from public.draft_tournament_events where id = v_pairing.event_id for update;
  if v_event.phase in ('top-cut', 'complete', 'archived') then
    raise exception 'Swiss results cannot be corrected after top-cut play begins.';
  end if;
  if exists (
    select 1
    from public.draft_tournament_rounds later_round
    join public.draft_tournament_pairings later_pairing on later_pairing.round_id = later_round.id
    join public.tournament_matches later_match on later_match.id = later_pairing.tournament_match_id
    where later_round.event_id = v_event.id
      and later_round.round_number > v_round.round_number
      and (
        later_match.status in ('reported', 'complete')
        or exists (
          select 1 from public.tournament_result_submissions submission
          where submission.match_id = later_match.id and submission.status <> 'rejected'
        )
      )
  ) then
    raise exception 'A later Swiss round has started. The earlier result cannot be corrected safely.';
  end if;

  delete from public.tournament_matches bracket_match
  using public.draft_tournament_pairings pairing,
    public.draft_tournament_rounds later_round
  where pairing.tournament_match_id = bracket_match.id
    and later_round.id = pairing.round_id
    and later_round.event_id = v_event.id
    and later_round.round_number > v_round.round_number;
  delete from public.draft_tournament_rounds
  where event_id = v_event.id and round_number > v_round.round_number;
  update public.draft_tournament_events
  set phase = 'swiss',
      current_swiss_round = v_round.round_number,
      swiss_completed_at = null,
      revision = revision + 1,
      updated_at = now()
  where id = v_event.id;
  insert into public.tournament_audit_events(tournament_id, actor_id, kind, payload)
  values (
    v_event.tournament_id,
    auth.uid(),
    'draft_tournament_later_rounds_rolled_back',
    jsonb_build_object('corrected_round_number', v_round.round_number)
  );
  return new;
end;
$$;

drop trigger if exists guard_draft_tournament_swiss_correction_trigger on public.tournament_matches;
create trigger guard_draft_tournament_swiss_correction_trigger
before update of games_a, games_b, winner_id, loser_id on public.tournament_matches
for each row execute function public.guard_draft_tournament_swiss_correction();

create or replace function public.refresh_draft_tournament_after_match()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pairing public.draft_tournament_pairings%rowtype;
  v_round public.draft_tournament_rounds%rowtype;
  v_event public.draft_tournament_events%rowtype;
begin
  if new.bracket_stage = 'top-cut'
     and new.status = 'complete'
     and new.winner_to_match_id is null then
    select * into v_event
    from public.draft_tournament_events
    where tournament_id = new.tournament_id
    for update;
    if found and v_event.phase = 'top-cut' then
      update public.draft_tournament_events
      set phase = 'complete', completed_at = now(), revision = revision + 1, updated_at = now()
      where id = v_event.id;
      update public.tournaments
      set status = 'complete', revision = revision + 1, updated_at = now()
      where id = new.tournament_id;
      insert into public.tournament_audit_events(tournament_id, actor_id, kind, payload)
      values (
        new.tournament_id,
        auth.uid(),
        'draft_tournament_completed',
        jsonb_build_object('winner_id', new.winner_id, 'top_cut', true)
      );
    end if;
    return new;
  end if;
  if new.bracket_stage <> 'swiss' then return new; end if;

  select * into v_pairing
  from public.draft_tournament_pairings
  where tournament_match_id = new.id;
  if not found then return new; end if;
  select * into v_round from public.draft_tournament_rounds where id = v_pairing.round_id for update;
  select * into v_event from public.draft_tournament_events where id = v_pairing.event_id for update;
  perform public.rebuild_draft_tournament_standings(v_event.id, v_round.round_number);

  if not exists (
    select 1
    from public.draft_tournament_pairings pairing
    join public.tournament_matches bracket_match on bracket_match.id = pairing.tournament_match_id
    where pairing.round_id = v_round.id
      and bracket_match.status not in ('complete', 'bye')
  ) then
    update public.draft_tournament_rounds
    set status = 'complete', completed_at = coalesce(completed_at, now()), revision = revision + 1
    where id = v_round.id;
    if v_round.round_number = v_event.swiss_round_count then
      update public.draft_tournament_events
      set phase = 'swiss-complete',
          swiss_completed_at = coalesce(swiss_completed_at, now()),
          revision = revision + 1,
          updated_at = now()
      where id = v_event.id;
      insert into public.tournament_audit_events(tournament_id, actor_id, kind, payload)
      values (
        v_event.tournament_id,
        auth.uid(),
        'draft_tournament_swiss_completed',
        jsonb_build_object('round_count', v_event.swiss_round_count)
      );
    end if;
  else
    update public.draft_tournament_rounds
    set status = 'active', completed_at = null, revision = revision + 1
    where id = v_round.id;
  end if;
  update public.draft_tournament_events
  set revision = revision + 1, updated_at = now()
  where id = v_event.id;
  return new;
end;
$$;

drop trigger if exists refresh_draft_tournament_after_match_trigger on public.tournament_matches;
create trigger refresh_draft_tournament_after_match_trigger
after update of status, games_a, games_b, winner_id, loser_id on public.tournament_matches
for each row execute function public.refresh_draft_tournament_after_match();

create or replace function public.start_draft_tournament_top_cut(
  p_tournament_id uuid,
  p_expected_revision bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tournament public.tournaments%rowtype;
  v_event public.draft_tournament_events%rowtype;
  v_final_round uuid;
  v_seed_order integer[];
  v_size integer;
  v_round_count integer := 0;
  v_round integer;
  v_match integer;
  v_match_count integer;
  v_a uuid;
  v_b uuid;
begin
  if auth.uid() is null then raise exception 'Sign in to finish Swiss play.'; end if;
  select * into v_tournament from public.tournaments where id = p_tournament_id for update;
  select * into v_event from public.draft_tournament_events where tournament_id = p_tournament_id for update;
  if not found or v_tournament.owner_id <> auth.uid() or v_event.phase <> 'swiss-complete' then
    raise exception 'Only the owner can start the configured top cut.';
  end if;
  if v_event.revision <> p_expected_revision then
    raise exception 'The event changed. Refresh before finishing Swiss play.';
  end if;
  select id into v_final_round
  from public.draft_tournament_rounds
  where event_id = v_event.id and round_number = v_event.swiss_round_count and status = 'complete';
  if v_final_round is null then raise exception 'Final Swiss standings are not ready.'; end if;

  if v_event.top_cut_size = 0 then
    update public.draft_tournament_events
    set phase = 'complete', completed_at = now(), revision = revision + 1, updated_at = now()
    where id = v_event.id;
    update public.tournaments
    set status = 'complete', revision = revision + 1, updated_at = now()
    where id = p_tournament_id;
    insert into public.tournament_audit_events(tournament_id, actor_id, kind, payload)
    values (
      p_tournament_id,
      auth.uid(),
      'draft_tournament_completed',
      jsonb_build_object(
        'top_cut', false,
        'winner_id', (
          select standing.entrant_id
          from public.draft_tournament_standing_snapshots standing
          join public.draft_tournament_seats seat
            on seat.event_id = standing.event_id
           and seat.entrant_id = standing.entrant_id
          where standing.round_id = v_final_round
            and seat.status = 'active'
          order by standing.rank
          limit 1
        )
      )
    );
    return jsonb_build_object('phase', 'complete', 'top_cut_size', 0);
  end if;

  insert into public.draft_tournament_top_cut_entries(event_id, tournament_id, entrant_id, seed)
  select v_event.id, p_tournament_id, standing.entrant_id,
    row_number() over (order by standing.rank)::smallint
  from public.draft_tournament_standing_snapshots standing
  join public.draft_tournament_seats seat
    on seat.event_id = standing.event_id and seat.entrant_id = standing.entrant_id
  where standing.round_id = v_final_round and seat.status = 'active'
  order by standing.rank
  limit v_event.top_cut_size;
  if (select count(*) from public.draft_tournament_top_cut_entries where event_id = v_event.id)
     <> v_event.top_cut_size then
    raise exception 'Not enough active entrants remain for the configured top cut.';
  end if;

  v_size := v_event.top_cut_size;
  while v_size > 1 loop
    v_round_count := v_round_count + 1;
    v_size := v_size / 2;
  end loop;
  v_seed_order := public.single_elimination_seed_order(v_event.top_cut_size);

  for v_round in 1..v_round_count loop
    v_match_count := v_event.top_cut_size / power(2, v_round)::integer;
    for v_match in 1..v_match_count loop
      insert into public.tournament_matches(
        tournament_id, round_number, match_number, bracket_stage, bracket_round,
        best_of, status, entrant_a_source_resolved, entrant_b_source_resolved
      ) values (
        p_tournament_id, v_event.swiss_round_count + v_round, v_match,
        'top-cut', v_round, v_tournament.best_of, 'pending',
        v_round = 1, v_round = 1
      );
    end loop;
  end loop;
  update public.tournament_matches source
  set winner_to_match_id = target.id,
      winner_to_slot = case when source.match_number % 2 = 1 then 'a' else 'b' end
  from public.tournament_matches target
  where source.tournament_id = p_tournament_id
    and source.bracket_stage = 'top-cut'
    and target.tournament_id = source.tournament_id
    and target.bracket_stage = 'top-cut'
    and target.bracket_round = source.bracket_round + 1
    and target.match_number = ceil(source.match_number / 2.0);

  for v_match in 1..(v_event.top_cut_size / 2) loop
    select entrant_id into v_a from public.draft_tournament_top_cut_entries
    where event_id = v_event.id and seed = v_seed_order[(v_match - 1) * 2 + 1];
    select entrant_id into v_b from public.draft_tournament_top_cut_entries
    where event_id = v_event.id and seed = v_seed_order[(v_match - 1) * 2 + 2];
    update public.tournament_matches
    set entrant_a_id = v_a,
        entrant_b_id = v_b,
        entrant_a_source_resolved = true,
        entrant_b_source_resolved = true,
        status = 'ready'
    where tournament_id = p_tournament_id
      and bracket_stage = 'top-cut'
      and bracket_round = 1
      and match_number = v_match;
  end loop;

  update public.draft_tournament_events
  set phase = 'top-cut', revision = revision + 1, updated_at = now()
  where id = v_event.id;
  update public.tournaments
  set revision = revision + 1, updated_at = now()
  where id = p_tournament_id;
  insert into public.tournament_audit_events(tournament_id, actor_id, kind, payload)
  values (
    p_tournament_id,
    auth.uid(),
    'draft_tournament_top_cut_started',
    jsonb_build_object('top_cut_size', v_event.top_cut_size)
  );
  return jsonb_build_object('phase', 'top-cut', 'top_cut_size', v_event.top_cut_size);
end;
$$;

create or replace function public.sync_draft_tournament_archive_phase()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'archived' and old.status is distinct from new.status then
    update public.draft_tournament_events
    set phase = 'archived', revision = revision + 1, updated_at = now()
    where tournament_id = new.id
      and phase <> 'cancelled';
  end if;
  return new;
end;
$$;

drop trigger if exists sync_draft_tournament_archive_phase_trigger on public.tournaments;
create trigger sync_draft_tournament_archive_phase_trigger
after update of status on public.tournaments
for each row when (new.format = 'draft-tournament')
execute function public.sync_draft_tournament_archive_phase();

revoke all on function public.lock_draft_tournament_rosters(uuid, bigint),
  public.start_next_draft_tournament_swiss_round(uuid, bigint),
  public.cancel_draft_tournament(uuid, bigint),
  public.start_draft_tournament_top_cut(uuid, bigint)
from public, anon, authenticated;
grant execute on function public.lock_draft_tournament_rosters(uuid, bigint),
  public.start_next_draft_tournament_swiss_round(uuid, bigint),
  public.cancel_draft_tournament(uuid, bigint),
  public.start_draft_tournament_top_cut(uuid, bigint)
to authenticated;

revoke all on function public.rebuild_draft_tournament_standings(uuid, integer),
  public.draft_tournament_find_swiss_pairs(uuid[], jsonb, text[], integer),
  public.create_draft_tournament_swiss_round(uuid, integer, uuid),
  public.guard_draft_tournament_swiss_correction(),
  public.refresh_draft_tournament_after_match(),
  public.sync_draft_tournament_archive_phase()
from public, anon, authenticated;
grant execute on function public.rebuild_draft_tournament_standings(uuid, integer),
  public.draft_tournament_find_swiss_pairs(uuid[], jsonb, text[], integer),
  public.create_draft_tournament_swiss_round(uuid, integer, uuid),
  public.guard_draft_tournament_swiss_correction(),
  public.refresh_draft_tournament_after_match(),
  public.sync_draft_tournament_archive_phase()
to service_role;

notify pgrst, 'reload schema';
commit;
