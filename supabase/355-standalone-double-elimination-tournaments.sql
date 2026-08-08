-- Migration 355: standalone double-elimination tournaments. The bracket is a
-- stored graph so winners, losers, byes, forfeits, and the conditional reset
-- final advance atomically under the existing tournament security boundary.
begin;

alter table public.tournaments
  drop constraint if exists tournaments_format_check;
alter table public.tournaments
  add constraint tournaments_format_check
  check (format in ('single-elimination', 'double-elimination'));

alter table public.tournament_matches
  drop constraint if exists tournament_matches_round_number_check;
alter table public.tournament_matches
  add constraint tournament_matches_round_number_check
  check (round_number between 1 and 24);

alter table public.tournament_matches
  add column bracket_stage text not null default 'single',
  add column bracket_round smallint,
  add column loser_to_match_id uuid,
  add column loser_to_slot text,
  add column entrant_a_source_resolved boolean not null default false,
  add column entrant_b_source_resolved boolean not null default false;

update public.tournament_matches
set bracket_round = round_number;

alter table public.tournament_matches
  alter column bracket_round set not null,
  add constraint tournament_matches_bracket_stage_check
    check (bracket_stage in ('single', 'winners', 'losers', 'grand-final')),
  add constraint tournament_matches_bracket_round_check
    check (bracket_round between 1 and 12),
  add constraint tournament_matches_loser_to_slot_check
    check (loser_to_slot in ('a', 'b')),
  add constraint tournament_matches_loser_to_pair_check
    check ((loser_to_match_id is null) = (loser_to_slot is null)),
  add foreign key (loser_to_match_id, tournament_id)
    references public.tournament_matches(id, tournament_id) on delete restrict;

update public.tournament_matches target
set entrant_a_source_resolved = (
      target.round_number = 1
      or target.entrant_a_id is not null
      or exists (
        select 1 from public.tournament_matches source
        where source.winner_to_match_id = target.id
          and source.winner_to_slot = 'a'
          and source.status in ('complete', 'bye')
      )
    ),
    entrant_b_source_resolved = (
      target.round_number = 1
      or target.entrant_b_id is not null
      or exists (
        select 1 from public.tournament_matches source
        where source.winner_to_match_id = target.id
          and source.winner_to_slot = 'b'
          and source.status in ('complete', 'bye')
      )
    );

create index tournament_matches_stage_idx
  on public.tournament_matches(tournament_id, bracket_stage, bracket_round, match_number);

create or replace function public.advance_tournament_match_graph(
  p_match_id uuid,
  p_winner_id uuid,
  p_loser_id uuid,
  p_actor_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source public.tournament_matches%rowtype;
  v_target public.tournament_matches%rowtype;
  v_path record;
  v_participant uuid;
  v_bye_winner uuid;
begin
  select * into v_source
  from public.tournament_matches
  where id = p_match_id
  for update;
  if not found then raise exception 'Match not found.'; end if;
  if p_winner_id is not null
     and p_winner_id not in (v_source.entrant_a_id, v_source.entrant_b_id) then
    raise exception 'The winner does not belong to this match.';
  end if;
  if p_loser_id is not null
     and p_loser_id not in (v_source.entrant_a_id, v_source.entrant_b_id) then
    raise exception 'The loser does not belong to this match.';
  end if;

  -- The winners-bracket champion occupies slot A in Grand Final 1. If that
  -- entrant wins, there is no reset; the reserved reset match becomes a
  -- visible, immutable no-reset marker and the tournament is complete.
  if v_source.bracket_stage = 'grand-final'
     and v_source.bracket_round = 1
     and p_winner_id = v_source.entrant_a_id then
    if v_source.winner_to_match_id is not null then
      select * into v_target
      from public.tournament_matches
      where id = v_source.winner_to_match_id
      for update;
      if v_target.status not in ('pending', 'ready', 'bye')
         or v_target.winner_id is not null then
        raise exception 'The bracket-reset match has already started.';
      end if;
      update public.tournament_matches
      set entrant_a_id = p_winner_id,
          entrant_b_id = p_loser_id,
          entrant_a_source_resolved = true,
          entrant_b_source_resolved = true,
          status = 'bye',
          winner_id = p_winner_id,
          loser_id = p_loser_id,
          revision = revision + 1,
          completed_at = now()
      where id = v_target.id;
    end if;
    update public.tournaments
    set status = 'complete', revision = revision + 1, updated_at = now()
    where id = v_source.tournament_id;
    insert into public.tournament_audit_events(tournament_id, actor_id, kind, payload)
    values (
      v_source.tournament_id,
      p_actor_id,
      'bracket_reset_not_required',
      jsonb_build_object('grand_final_match_id', v_source.id, 'winner_id', p_winner_id)
    );
    return;
  end if;

  for v_path in
    select 'winner'::text as outcome, v_source.winner_to_match_id as target_id, v_source.winner_to_slot as target_slot
    union all
    select 'loser'::text, v_source.loser_to_match_id, v_source.loser_to_slot
  loop
    if v_path.target_id is null then continue; end if;
    v_participant := case when v_path.outcome = 'winner' then p_winner_id else p_loser_id end;

    select * into v_target
    from public.tournament_matches
    where id = v_path.target_id
    for update;
    if not found
       or v_target.status not in ('pending', 'ready')
       or v_target.winner_id is not null then
      raise exception 'A downstream bracket match has already started.';
    end if;

    if v_path.target_slot = 'a' then
      if v_target.entrant_a_source_resolved
         and v_target.entrant_a_id is distinct from v_participant then
        raise exception 'The downstream bracket slot is already occupied.';
      end if;
      update public.tournament_matches
      set entrant_a_id = v_participant,
          entrant_a_source_resolved = true,
          revision = revision + 1
      where id = v_target.id;
    else
      if v_target.entrant_b_source_resolved
         and v_target.entrant_b_id is distinct from v_participant then
        raise exception 'The downstream bracket slot is already occupied.';
      end if;
      update public.tournament_matches
      set entrant_b_id = v_participant,
          entrant_b_source_resolved = true,
          revision = revision + 1
      where id = v_target.id;
    end if;

    select * into v_target
    from public.tournament_matches
    where id = v_target.id
    for update;

    if v_target.entrant_a_source_resolved and v_target.entrant_b_source_resolved then
      if v_target.entrant_a_id is not null and v_target.entrant_b_id is not null then
        update public.tournament_matches
        set status = 'ready'
        where id = v_target.id and status = 'pending';
      elsif v_target.status = 'pending' then
        v_bye_winner := coalesce(v_target.entrant_a_id, v_target.entrant_b_id);
        update public.tournament_matches
        set status = 'bye',
            winner_id = v_bye_winner,
            loser_id = null,
            revision = revision + 1,
            completed_at = now()
        where id = v_target.id;
        insert into public.tournament_audit_events(tournament_id, actor_id, kind, payload)
        values (
          v_target.tournament_id,
          p_actor_id,
          'automatic_bye_advanced',
          jsonb_build_object('match_id', v_target.id, 'winner_id', v_bye_winner)
        );
        perform public.advance_tournament_match_graph(v_target.id, v_bye_winner, null, p_actor_id);
      end if;
    end if;
  end loop;

  if v_source.winner_to_match_id is null
     and v_source.loser_to_match_id is null
     and (
       v_source.bracket_stage = 'single'
       or (v_source.bracket_stage = 'grand-final' and v_source.bracket_round = 2)
     ) then
    update public.tournaments
    set status = 'complete', revision = revision + 1, updated_at = now()
    where id = v_source.tournament_id;
  end if;
end;
$$;

create or replace function public.create_tournament(
  p_name text,
  p_description text default '',
  p_visibility text default 'public',
  p_best_of integer default 3,
  p_entrant_limit integer default 16,
  p_rules text default '',
  p_format text default 'single-elimination'
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_id uuid := gen_random_uuid();
  v_slug text;
  v_name text := btrim(p_name);
  v_slug_base text;
  v_code text;
begin
  if auth.uid() is null then raise exception 'Sign in to create a tournament.'; end if;
  if nullif(v_name, '') is null
     or char_length(v_name) not between 2 and 120
     or p_visibility not in ('public', 'private')
     or p_format not in ('single-elimination', 'double-elimination')
     or p_best_of not in (1, 3)
     or p_entrant_limit not between 2 and 64
     or (p_format = 'double-elimination' and p_entrant_limit < 4)
     or char_length(coalesce(p_description, '')) > 2000
     or char_length(coalesce(p_rules, '')) > 10000 then
    raise exception 'Tournament settings are invalid.';
  end if;
  v_slug_base := left(trim(both '-' from regexp_replace(lower(v_name), '[^a-z0-9]+', '-', 'g')), 60);
  if v_slug_base = '' then v_slug_base := 'tournament'; end if;
  v_slug := v_slug_base || '-' || left(replace(v_id::text, '-', ''), 8);
  insert into public.tournaments(
    id, slug, owner_id, name, description, visibility, format, best_of, entrant_limit, rules
  ) values (
    v_id, v_slug, auth.uid(), v_name, coalesce(p_description, ''), p_visibility,
    p_format, p_best_of, p_entrant_limit, coalesce(p_rules, '')
  );
  if p_visibility = 'private' then
    v_code := encode(gen_random_bytes(16), 'hex');
    insert into public.tournament_registration_codes(tournament_id, code_hash)
    values (v_id, encode(digest(v_code, 'sha256'), 'hex'));
  end if;
  insert into public.tournament_audit_events(tournament_id, actor_id, kind, payload)
  values (v_id, auth.uid(), 'tournament_created', jsonb_build_object('format', p_format));
  return jsonb_build_object('slug', v_slug, 'registration_code', v_code);
end;
$$;

-- Migration 355 makes source resolution explicit for every bracket graph, so
-- the single-elimination lock must populate the new fields as well. Keeping
-- this replacement here also prevents a caller from locking a double event
-- through the older single-elimination RPC.
create or replace function public.lock_single_elimination_tournament(p_tournament_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tournament public.tournaments%rowtype;
  v_count integer;
  v_size integer := 2;
  v_rounds integer := 1;
  v_round integer;
  v_match integer;
  v_match_count integer;
  v_order integer[];
  v_entrant_order uuid[];
  v_index integer;
  v_a uuid;
  v_b uuid;
  v_current public.tournament_matches%rowtype;
begin
  if auth.uid() is null then raise exception 'Only the owner can lock open registration.'; end if;
  select * into v_tournament
  from public.tournaments
  where id = p_tournament_id
  for update;
  if not found
     or v_tournament.owner_id <> auth.uid()
     or v_tournament.status <> 'registration'
     or v_tournament.format <> 'single-elimination' then
    raise exception 'Only the owner can lock single-elimination registration.';
  end if;

  select count(*) into v_count
  from public.tournament_entrants
  where tournament_id = p_tournament_id and status = 'registered';
  if v_count < 2 then raise exception 'At least two entrants are required.'; end if;

  select array_agg(id order by seed nulls last, registered_at, id)
  into v_entrant_order
  from public.tournament_entrants
  where tournament_id = p_tournament_id and status = 'registered';
  update public.tournament_entrants set seed = null where tournament_id = p_tournament_id;
  for v_index in 1..array_length(v_entrant_order, 1) loop
    update public.tournament_entrants set seed = v_index where id = v_entrant_order[v_index];
  end loop;

  while v_size < v_count loop
    v_size := v_size * 2;
    v_rounds := v_rounds + 1;
  end loop;
  v_order := public.single_elimination_seed_order(v_size);

  for v_round in 1..v_rounds loop
    v_match_count := v_size / (power(2, v_round)::integer);
    for v_match in 1..v_match_count loop
      insert into public.tournament_matches(
        tournament_id, round_number, match_number, bracket_stage, bracket_round, best_of
      ) values (
        p_tournament_id, v_round, v_match, 'single', v_round, v_tournament.best_of
      );
    end loop;
  end loop;

  update public.tournament_matches source
  set winner_to_match_id = target.id,
      winner_to_slot = case when source.match_number % 2 = 1 then 'a' else 'b' end
  from public.tournament_matches target
  where source.tournament_id = p_tournament_id
    and source.bracket_stage = 'single'
    and source.bracket_round < v_rounds
    and target.tournament_id = source.tournament_id
    and target.bracket_stage = 'single'
    and target.bracket_round = source.bracket_round + 1
    and target.match_number = ceil(source.match_number / 2.0);

  update public.tournaments
  set status = 'active', revision = revision + 1, updated_at = now()
  where id = p_tournament_id;

  for v_match in 1..(v_size / 2) loop
    select id into v_a from public.tournament_entrants
    where tournament_id = p_tournament_id and seed = v_order[(v_match - 1) * 2 + 1];
    select id into v_b from public.tournament_entrants
    where tournament_id = p_tournament_id and seed = v_order[(v_match - 1) * 2 + 2];
    update public.tournament_matches
    set entrant_a_id = v_a,
        entrant_b_id = v_b,
        entrant_a_source_resolved = true,
        entrant_b_source_resolved = true,
        status = case
          when v_a is not null and v_b is not null then 'ready'
          else 'bye'
        end,
        winner_id = case when v_a is null or v_b is null then coalesce(v_a, v_b) else null end,
        completed_at = case when v_a is null or v_b is null then now() else null end
    where tournament_id = p_tournament_id
      and bracket_stage = 'single'
      and bracket_round = 1
      and match_number = v_match
    returning * into v_current;
    if v_current.status = 'bye' then
      perform public.advance_tournament_match_graph(v_current.id, v_current.winner_id, null, auth.uid());
    end if;
    v_a := null;
    v_b := null;
  end loop;

  insert into public.tournament_audit_events(tournament_id, actor_id, kind, payload)
  values (
    p_tournament_id,
    auth.uid(),
    'bracket_locked',
    jsonb_build_object(
      'format', 'single-elimination',
      'entrants', v_count,
      'bracket_size', v_size,
      'match_count', v_size - 1
    )
  );
end;
$$;

create or replace function public.lock_double_elimination_tournament(p_tournament_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tournament public.tournaments%rowtype;
  v_count integer;
  v_size integer := 2;
  v_winners_rounds integer := 1;
  v_losers_rounds integer;
  v_round integer;
  v_global_round integer;
  v_match integer;
  v_match_count integer;
  v_order integer[];
  v_entrant_order uuid[];
  v_index integer;
  v_a uuid;
  v_b uuid;
  v_current public.tournament_matches%rowtype;
begin
  if auth.uid() is null then raise exception 'Only the owner can lock open registration.'; end if;
  select * into v_tournament
  from public.tournaments
  where id = p_tournament_id
  for update;
  if not found
     or v_tournament.owner_id <> auth.uid()
     or v_tournament.status <> 'registration'
     or v_tournament.format <> 'double-elimination' then
    raise exception 'Only the owner can lock double-elimination registration.';
  end if;

  select count(*) into v_count
  from public.tournament_entrants
  where tournament_id = p_tournament_id and status = 'registered';
  if v_count < 4 then raise exception 'Double elimination requires at least four entrants.'; end if;

  select array_agg(id order by seed nulls last, registered_at, id)
  into v_entrant_order
  from public.tournament_entrants
  where tournament_id = p_tournament_id and status = 'registered';
  update public.tournament_entrants set seed = null where tournament_id = p_tournament_id;
  for v_index in 1..array_length(v_entrant_order, 1) loop
    update public.tournament_entrants set seed = v_index where id = v_entrant_order[v_index];
  end loop;

  while v_size < v_count loop
    v_size := v_size * 2;
    v_winners_rounds := v_winners_rounds + 1;
  end loop;
  v_losers_rounds := 2 * (v_winners_rounds - 1);
  v_order := public.single_elimination_seed_order(v_size);

  for v_round in 1..v_winners_rounds loop
    v_global_round := case when v_round = 1 then 1 else 3 * v_round - 3 end;
    v_match_count := v_size / (power(2, v_round)::integer);
    for v_match in 1..v_match_count loop
      insert into public.tournament_matches(
        tournament_id, round_number, match_number, bracket_stage, bracket_round, best_of
      ) values (
        p_tournament_id, v_global_round, v_match, 'winners', v_round, v_tournament.best_of
      );
    end loop;
  end loop;

  for v_round in 1..v_losers_rounds loop
    v_global_round := case
      when v_round = 1 then 2
      when v_round % 2 = 0 then 3 * (v_round / 2) + 1
      else 3 * ((v_round - 1) / 2) + 2
    end;
    v_match_count := v_size / (power(2, floor((v_round + 1) / 2.0)::integer + 1)::integer);
    for v_match in 1..v_match_count loop
      insert into public.tournament_matches(
        tournament_id, round_number, match_number, bracket_stage, bracket_round, best_of
      ) values (
        p_tournament_id, v_global_round, v_match, 'losers', v_round, v_tournament.best_of
      );
    end loop;
  end loop;

  insert into public.tournament_matches(
    tournament_id, round_number, match_number, bracket_stage, bracket_round, best_of
  ) values
    (p_tournament_id, 3 * v_winners_rounds - 1, 1, 'grand-final', 1, v_tournament.best_of),
    (p_tournament_id, 3 * v_winners_rounds, 1, 'grand-final', 2, v_tournament.best_of);

  update public.tournament_matches source
  set winner_to_match_id = target.id,
      winner_to_slot = case when source.match_number % 2 = 1 then 'a' else 'b' end
  from public.tournament_matches target
  where source.tournament_id = p_tournament_id
    and source.bracket_stage = 'winners'
    and source.bracket_round < v_winners_rounds
    and target.tournament_id = source.tournament_id
    and target.bracket_stage = 'winners'
    and target.bracket_round = source.bracket_round + 1
    and target.match_number = ceil(source.match_number / 2.0);

  update public.tournament_matches source
  set winner_to_match_id = target.id, winner_to_slot = 'a'
  from public.tournament_matches target
  where source.tournament_id = p_tournament_id
    and source.bracket_stage = 'winners'
    and source.bracket_round = v_winners_rounds
    and target.tournament_id = source.tournament_id
    and target.bracket_stage = 'grand-final'
    and target.bracket_round = 1;

  update public.tournament_matches source
  set loser_to_match_id = target.id,
      loser_to_slot = case when source.match_number % 2 = 1 then 'a' else 'b' end
  from public.tournament_matches target
  where source.tournament_id = p_tournament_id
    and source.bracket_stage = 'winners'
    and source.bracket_round = 1
    and target.tournament_id = source.tournament_id
    and target.bracket_stage = 'losers'
    and target.bracket_round = 1
    and target.match_number = ceil(source.match_number / 2.0);

  update public.tournament_matches source
  set loser_to_match_id = target.id, loser_to_slot = 'b'
  from public.tournament_matches target
  where source.tournament_id = p_tournament_id
    and source.bracket_stage = 'winners'
    and source.bracket_round > 1
    and target.tournament_id = source.tournament_id
    and target.bracket_stage = 'losers'
    and target.bracket_round = 2 * source.bracket_round - 2
    and target.match_number = source.match_number;

  update public.tournament_matches source
  set winner_to_match_id = target.id,
      winner_to_slot = case
        when source.bracket_round % 2 = 1 then 'a'
        when source.match_number % 2 = 1 then 'a'
        else 'b'
      end
  from public.tournament_matches target
  where source.tournament_id = p_tournament_id
    and source.bracket_stage = 'losers'
    and source.bracket_round < v_losers_rounds
    and target.tournament_id = source.tournament_id
    and target.bracket_stage = 'losers'
    and target.bracket_round = source.bracket_round + 1
    and target.match_number = case
      when source.bracket_round % 2 = 1 then source.match_number
      else ceil(source.match_number / 2.0)
    end;

  update public.tournament_matches source
  set winner_to_match_id = target.id, winner_to_slot = 'b'
  from public.tournament_matches target
  where source.tournament_id = p_tournament_id
    and source.bracket_stage = 'losers'
    and source.bracket_round = v_losers_rounds
    and target.tournament_id = source.tournament_id
    and target.bracket_stage = 'grand-final'
    and target.bracket_round = 1;

  update public.tournament_matches source
  set winner_to_match_id = target.id,
      winner_to_slot = 'a',
      loser_to_match_id = target.id,
      loser_to_slot = 'b'
  from public.tournament_matches target
  where source.tournament_id = p_tournament_id
    and source.bracket_stage = 'grand-final'
    and source.bracket_round = 1
    and target.tournament_id = source.tournament_id
    and target.bracket_stage = 'grand-final'
    and target.bracket_round = 2;

  update public.tournaments
  set status = 'active', revision = revision + 1, updated_at = now()
  where id = p_tournament_id;

  for v_match in 1..(v_size / 2) loop
    select id into v_a from public.tournament_entrants
    where tournament_id = p_tournament_id and seed = v_order[(v_match - 1) * 2 + 1];
    select id into v_b from public.tournament_entrants
    where tournament_id = p_tournament_id and seed = v_order[(v_match - 1) * 2 + 2];
    update public.tournament_matches
    set entrant_a_id = v_a,
        entrant_b_id = v_b,
        entrant_a_source_resolved = true,
        entrant_b_source_resolved = true,
        status = case
          when v_a is not null and v_b is not null then 'ready'
          else 'bye'
        end,
        winner_id = case when v_a is null or v_b is null then coalesce(v_a, v_b) else null end,
        completed_at = case when v_a is null or v_b is null then now() else null end
    where tournament_id = p_tournament_id
      and bracket_stage = 'winners'
      and bracket_round = 1
      and match_number = v_match
    returning * into v_current;
    if v_current.status = 'bye' then
      perform public.advance_tournament_match_graph(v_current.id, v_current.winner_id, null, auth.uid());
    end if;
    v_a := null;
    v_b := null;
  end loop;

  insert into public.tournament_audit_events(tournament_id, actor_id, kind, payload)
  values (
    p_tournament_id,
    auth.uid(),
    'bracket_locked',
    jsonb_build_object(
      'format', 'double-elimination',
      'entrants', v_count,
      'bracket_size', v_size,
      'match_count', 2 * v_size - 1
    )
  );
end;
$$;

-- Recovery now routes both the winner and loser. An inactive entrant that
-- drops into the losers bracket is automatically forfeited only when that
-- next match has exactly one inactive participant.
create or replace function public.resolve_tournament_forfeit_chain(
  p_match_id uuid,
  p_loser_id uuid,
  p_actor_id uuid,
  p_reason text,
  p_initial_kind text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match public.tournament_matches%rowtype;
  v_winner_id uuid;
  v_loser_id uuid := p_loser_id;
  v_wins integer;
  v_kind text := p_initial_kind;
  v_next_match_id uuid;
  v_next_loser_id uuid;
begin
  if p_actor_id is null
     or char_length(btrim(coalesce(p_reason, ''))) not between 2 and 500
     or p_initial_kind not in (
       'match_forfeited',
       'dropped_entrant_forfeited',
       'disqualified_entrant_forfeited',
       'inactive_entrant_forfeited'
     ) then
    raise exception 'Tournament recovery details are invalid.';
  end if;

  loop
    select * into v_match
    from public.tournament_matches
    where id = p_match_id
    for update;
    if not found
       or v_match.status not in ('ready', 'reported')
       or v_match.winner_id is not null
       or v_match.entrant_a_id is null
       or v_match.entrant_b_id is null
       or v_loser_id not in (v_match.entrant_a_id, v_match.entrant_b_id) then
      raise exception 'That match cannot be recovered safely. Refresh and review it.';
    end if;

    v_winner_id := case
      when v_loser_id = v_match.entrant_a_id then v_match.entrant_b_id
      else v_match.entrant_a_id
    end;
    v_wins := (v_match.best_of + 1) / 2;
    update public.tournament_result_submissions
    set status = 'rejected', confirmed_by = p_actor_id, resolved_at = now()
    where match_id = v_match.id and status = 'pending';
    update public.tournament_matches
    set status = 'complete',
        games_a = case when v_winner_id = entrant_a_id then v_wins else 0 end,
        games_b = case when v_winner_id = entrant_b_id then v_wins else 0 end,
        winner_id = v_winner_id,
        loser_id = v_loser_id,
        replay_urls = '{}',
        mvp = null,
        revision = revision + 1,
        completed_at = now()
    where id = v_match.id;
    insert into public.tournament_audit_events(tournament_id, actor_id, kind, payload)
    values (
      v_match.tournament_id,
      p_actor_id,
      v_kind,
      jsonb_build_object(
        'match_id', v_match.id,
        'winner_id', v_winner_id,
        'loser_id', v_loser_id,
        'reason', btrim(p_reason)
      )
    );
    perform public.advance_tournament_match_graph(v_match.id, v_winner_id, v_loser_id, p_actor_id);

    select candidate.id, candidate.inactive_id
    into v_next_match_id, v_next_loser_id
    from (
      select bracket_match.id,
        (array_agg(entrant.id order by entrant.id)
          filter (where entrant.status <> 'registered'))[1] as inactive_id,
        count(*) filter (where entrant.status <> 'registered') as inactive_count
      from public.tournament_matches bracket_match
      join public.tournament_entrants entrant
        on entrant.id in (bracket_match.entrant_a_id, bracket_match.entrant_b_id)
      where bracket_match.tournament_id = v_match.tournament_id
        and bracket_match.status = 'ready'
      group by bracket_match.id, bracket_match.round_number, bracket_match.match_number
      having count(*) filter (where entrant.status <> 'registered') = 1
      order by bracket_match.round_number, bracket_match.match_number
      limit 1
    ) candidate;
    if v_next_match_id is null then return v_winner_id; end if;
    p_match_id := v_next_match_id;
    v_loser_id := v_next_loser_id;
    v_kind := 'inactive_entrant_forfeited';
  end loop;
end;
$$;

create or replace function public.confirm_tournament_result(
  p_submission_id uuid,
  p_expected_match_revision bigint
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_submission public.tournament_result_submissions%rowtype;
  v_match public.tournament_matches%rowtype;
  v_tournament public.tournaments%rowtype;
  v_winner uuid;
  v_loser uuid;
  v_inactive_match uuid;
  v_inactive_entrant uuid;
begin
  if auth.uid() is null then raise exception 'Sign in to confirm a result.'; end if;
  select * into v_submission from public.tournament_result_submissions where id = p_submission_id for update;
  if not found then raise exception 'Result submission not found.'; end if;
  select * into v_match from public.tournament_matches where id = v_submission.match_id for update;
  select * into v_tournament from public.tournaments where id = v_match.tournament_id;
  if v_submission.status = 'confirmed' then
    if v_tournament.owner_id = auth.uid() or v_submission.confirmed_by = auth.uid() then
      return v_submission.match_id;
    end if;
    raise exception 'That result is no longer awaiting confirmation.';
  end if;
  if v_submission.status <> 'pending' then raise exception 'That result is no longer awaiting confirmation.'; end if;
  if v_match.status <> 'reported'
     or v_match.revision <> p_expected_match_revision
     or v_submission.expected_match_revision <> v_match.revision then
    raise exception 'That match changed. Refresh before confirming.';
  end if;
  if v_tournament.owner_id <> auth.uid()
     and not exists (
       select 1 from public.tournament_entrants
       where id in (v_match.entrant_a_id, v_match.entrant_b_id)
         and user_id = auth.uid()
         and user_id <> v_submission.submitted_by
     ) then
    raise exception 'The opponent or tournament owner must confirm this result.';
  end if;

  v_winner := case when v_submission.games_a > v_submission.games_b then v_match.entrant_a_id else v_match.entrant_b_id end;
  v_loser := case when v_winner = v_match.entrant_a_id then v_match.entrant_b_id else v_match.entrant_a_id end;
  update public.tournament_matches
  set status = 'complete',
      games_a = v_submission.games_a,
      games_b = v_submission.games_b,
      winner_id = v_winner,
      loser_id = v_loser,
      replay_urls = v_submission.replay_urls,
      mvp = v_submission.mvp,
      revision = revision + 1,
      completed_at = now()
  where id = v_match.id;
  update public.tournament_result_submissions
  set status = 'confirmed', confirmed_by = auth.uid(), resolved_at = now()
  where id = v_submission.id;
  perform public.advance_tournament_match_graph(v_match.id, v_winner, v_loser, auth.uid());

  select candidate.id, candidate.inactive_id
  into v_inactive_match, v_inactive_entrant
  from (
    select bracket_match.id,
      (array_agg(entrant.id order by entrant.id)
        filter (where entrant.status <> 'registered'))[1] as inactive_id
    from public.tournament_matches bracket_match
    join public.tournament_entrants entrant
      on entrant.id in (bracket_match.entrant_a_id, bracket_match.entrant_b_id)
    where bracket_match.tournament_id = v_match.tournament_id
      and bracket_match.status = 'ready'
    group by bracket_match.id, bracket_match.round_number, bracket_match.match_number
    having count(*) filter (where entrant.status <> 'registered') = 1
    order by bracket_match.round_number, bracket_match.match_number
    limit 1
  ) candidate;
  if v_inactive_match is not null then
    perform public.resolve_tournament_forfeit_chain(
      v_inactive_match,
      v_inactive_entrant,
      auth.uid(),
      'Entrant was no longer active when the bracket advanced.',
      'inactive_entrant_forfeited'
    );
  end if;

  insert into public.tournament_audit_events(tournament_id, actor_id, kind, payload)
  values (
    v_match.tournament_id,
    auth.uid(),
    'result_confirmed',
    jsonb_build_object('match_id', v_match.id, 'winner_id', v_winner, 'submission_id', v_submission.id)
  );
  return v_match.id;
end;
$$;

-- A correction may replace already-routed participants only while every
-- affected downstream match is still untouched. Grand Final 1 can switch
-- safely between "no reset" and "reset required" until reset play begins.
create or replace function public.correct_tournament_result(
  p_match_id uuid,
  p_expected_revision bigint,
  p_games_a integer,
  p_games_b integer,
  p_replay_urls text[] default '{}',
  p_mvp text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match public.tournament_matches%rowtype;
  v_tournament public.tournaments%rowtype;
  v_target public.tournament_matches%rowtype;
  v_path record;
  v_wins integer;
  v_winner uuid;
  v_loser uuid;
  v_old_participant uuid;
  v_new_participant uuid;
  v_submission uuid;
begin
  if auth.uid() is null then raise exception 'Sign in to correct a result.'; end if;
  select * into v_match from public.tournament_matches where id = p_match_id for update;
  if not found then raise exception 'Match not found.'; end if;
  select * into v_tournament from public.tournaments where id = v_match.tournament_id for update;
  if v_tournament.owner_id <> auth.uid() then raise exception 'Only the tournament owner can correct a result.'; end if;
  if v_tournament.status = 'archived' then raise exception 'Archived tournaments are read-only.'; end if;
  if v_match.status <> 'complete' or v_match.revision <> p_expected_revision then
    raise exception 'That result changed. Refresh before correcting it.';
  end if;
  v_wins := (v_match.best_of + 1) / 2;
  if not (
    (p_games_a = v_wins and p_games_b between 0 and v_wins - 1)
    or (p_games_b = v_wins and p_games_a between 0 and v_wins - 1)
  ) then raise exception 'Enter a completed series score.'; end if;
  if coalesce(array_length(p_replay_urls, 1), 0) > 3
     or exists (
       select 1 from unnest(coalesce(p_replay_urls, '{}')) url
       where url is null or char_length(url) > 2000 or url !~* '^https://'
     )
     or char_length(coalesce(p_mvp, '')) > 120 then
    raise exception 'Replay or MVP details are invalid.';
  end if;
  v_winner := case when p_games_a > p_games_b then v_match.entrant_a_id else v_match.entrant_b_id end;
  v_loser := case when v_winner = v_match.entrant_a_id then v_match.entrant_b_id else v_match.entrant_a_id end;

  if v_winner is distinct from v_match.winner_id then
    if v_match.bracket_stage = 'grand-final' and v_match.bracket_round = 1 then
      select * into v_target
      from public.tournament_matches
      where id = v_match.winner_to_match_id
      for update;
      if not found
         or v_target.status not in ('pending', 'ready', 'bye')
         or exists (
           select 1 from public.tournament_result_submissions submission
           where submission.match_id = v_target.id and submission.status <> 'rejected'
         ) then
        raise exception 'The bracket-reset match has already started. The Grand Final cannot be corrected safely.';
      end if;
      if v_winner = v_match.entrant_a_id then
        update public.tournament_matches
        set entrant_a_id = v_winner,
            entrant_b_id = v_loser,
            entrant_a_source_resolved = true,
            entrant_b_source_resolved = true,
            status = 'bye',
            games_a = null,
            games_b = null,
            winner_id = v_winner,
            loser_id = v_loser,
            replay_urls = '{}',
            mvp = null,
            revision = revision + 1,
            completed_at = now()
        where id = v_target.id;
        update public.tournaments set status = 'complete' where id = v_match.tournament_id;
      else
        update public.tournament_matches
        set entrant_a_id = v_winner,
            entrant_b_id = v_loser,
            entrant_a_source_resolved = true,
            entrant_b_source_resolved = true,
            status = 'ready',
            games_a = null,
            games_b = null,
            winner_id = null,
            loser_id = null,
            replay_urls = '{}',
            mvp = null,
            revision = revision + 1,
            completed_at = null
        where id = v_target.id;
        update public.tournaments set status = 'active' where id = v_match.tournament_id;
      end if;
    else
      for v_path in
        select 'winner'::text as outcome, v_match.winner_to_match_id as target_id, v_match.winner_to_slot as target_slot
        union all
        select 'loser'::text, v_match.loser_to_match_id, v_match.loser_to_slot
      loop
        if v_path.target_id is null then continue; end if;
        v_old_participant := case when v_path.outcome = 'winner' then v_match.winner_id else v_match.loser_id end;
        v_new_participant := case when v_path.outcome = 'winner' then v_winner else v_loser end;
        select * into v_target from public.tournament_matches where id = v_path.target_id for update;
        if not found
           or v_target.status not in ('pending', 'ready')
           or v_target.winner_id is not null
           or (v_path.target_slot = 'a' and v_target.entrant_a_id is distinct from v_old_participant)
           or (v_path.target_slot = 'b' and v_target.entrant_b_id is distinct from v_old_participant) then
          raise exception 'A downstream match has already started. The earlier result cannot be corrected safely.';
        end if;
        update public.tournament_matches
        set entrant_a_id = case when v_path.target_slot = 'a' then v_new_participant else entrant_a_id end,
            entrant_b_id = case when v_path.target_slot = 'b' then v_new_participant else entrant_b_id end,
            status = case
              when (case when v_path.target_slot = 'a' then v_new_participant else entrant_a_id end) is not null
               and (case when v_path.target_slot = 'b' then v_new_participant else entrant_b_id end) is not null
                then 'ready'
              else 'pending'
            end,
            revision = revision + 1
        where id = v_target.id;
      end loop;
    end if;
  end if;

  update public.tournament_matches
  set games_a = p_games_a,
      games_b = p_games_b,
      winner_id = v_winner,
      loser_id = v_loser,
      replay_urls = coalesce(p_replay_urls, '{}'),
      mvp = nullif(btrim(p_mvp), ''),
      revision = revision + 1,
      completed_at = now()
  where id = v_match.id;
  insert into public.tournament_result_submissions(
    tournament_id, match_id, submitted_by, expected_match_revision,
    games_a, games_b, replay_urls, mvp, status, confirmed_by, resolved_at
  ) values (
    v_match.tournament_id, v_match.id, auth.uid(), v_match.revision,
    p_games_a, p_games_b, coalesce(p_replay_urls, '{}'), nullif(btrim(p_mvp), ''),
    'confirmed', auth.uid(), now()
  ) returning id into v_submission;
  update public.tournaments
  set revision = revision + 1, updated_at = now()
  where id = v_match.tournament_id;
  insert into public.tournament_audit_events(tournament_id, actor_id, kind, payload)
  values (
    v_match.tournament_id,
    auth.uid(),
    'result_corrected',
    jsonb_build_object(
      'match_id', v_match.id,
      'previous_winner_id', v_match.winner_id,
      'winner_id', v_winner,
      'submission_id', v_submission
    )
  );
  return v_match.id;
end;
$$;

create or replace function public.list_tournaments()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
select coalesce(jsonb_agg(jsonb_build_object(
  'id', tournament.id,
  'slug', tournament.slug,
  'name', tournament.name,
  'description', tournament.description,
  'visibility', tournament.visibility,
  'format', tournament.format,
  'status', tournament.status,
  'best_of', tournament.best_of,
  'entrant_limit', tournament.entrant_limit,
  'entrant_count', (
    select count(*) from public.tournament_entrants entrant
    where entrant.tournament_id = tournament.id and entrant.status = 'registered'
  )
) order by tournament.updated_at desc), '[]'::jsonb)
from (
  select * from public.tournaments source
  where public.can_view_tournament(source.id)
  order by source.updated_at desc
  limit 100
) tournament;
$$;

create or replace function public.get_tournament_workspace(
  p_slug text,
  p_access_code text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_tournament public.tournaments%rowtype;
begin
  select * into v_tournament from public.tournaments where slug = p_slug;
  if not found or (
    not public.can_view_tournament(v_tournament.id)
    and not (
      v_tournament.status = 'registration'
      and coalesce(p_access_code, '') ~ '^[0-9a-f]{32}$'
      and exists (
        select 1 from public.tournament_registration_codes code
        where code.tournament_id = v_tournament.id
          and code.code_hash = encode(digest(p_access_code, 'sha256'), 'hex')
      )
    )
  ) then
    return null;
  end if;

  return jsonb_build_object(
    'tournament', jsonb_build_object(
      'id', v_tournament.id,
      'slug', v_tournament.slug,
      'name', v_tournament.name,
      'description', v_tournament.description,
      'visibility', v_tournament.visibility,
      'format', v_tournament.format,
      'status', v_tournament.status,
      'rules', v_tournament.rules,
      'best_of', v_tournament.best_of,
      'entrant_limit', v_tournament.entrant_limit,
      'revision', v_tournament.revision,
      'is_owner', v_tournament.owner_id = auth.uid()
    ),
    'entrants', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', entrant.id,
        'display_name', entrant.display_name,
        'seed', entrant.seed,
        'status', entrant.status,
        'is_me', entrant.user_id = auth.uid(),
        'replacement_pending', exists (
          select 1 from public.tournament_entrant_replacements replacement
          where replacement.replacement_entrant_id = entrant.id
            and replacement.claimed_at is null
            and replacement.expires_at > now()
        )
      ) order by entrant.seed nulls last, entrant.registered_at)
      from public.tournament_entrants entrant
      where entrant.tournament_id = v_tournament.id
    ), '[]'::jsonb),
    'matches', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', bracket_match.id,
        'round_number', bracket_match.round_number,
        'match_number', bracket_match.match_number,
        'bracket_stage', bracket_match.bracket_stage,
        'bracket_round', bracket_match.bracket_round,
        'entrant_a_id', bracket_match.entrant_a_id,
        'entrant_b_id', bracket_match.entrant_b_id,
        'winner_id', bracket_match.winner_id,
        'games_a', bracket_match.games_a,
        'games_b', bracket_match.games_b,
        'best_of', bracket_match.best_of,
        'status', bracket_match.status,
        'revision', bracket_match.revision,
        'replay_urls', bracket_match.replay_urls,
        'mvp', bracket_match.mvp
      ) order by bracket_match.round_number, bracket_match.match_number)
      from public.tournament_matches bracket_match
      where bracket_match.tournament_id = v_tournament.id
    ), '[]'::jsonb),
    'submissions', case when auth.uid() is null then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', submission.id,
        'match_id', submission.match_id,
        'submitted_by_me', submission.submitted_by = auth.uid(),
        'games_a', submission.games_a,
        'games_b', submission.games_b,
        'replay_urls', submission.replay_urls,
        'mvp', submission.mvp,
        'status', submission.status,
        'expected_match_revision', submission.expected_match_revision
      ))
      from public.tournament_result_submissions submission
      join public.tournament_matches bracket_match on bracket_match.id = submission.match_id
      where submission.tournament_id = v_tournament.id
        and submission.status = 'pending'
        and (
          v_tournament.owner_id = auth.uid()
          or exists (
            select 1 from public.tournament_entrants entrant
            where entrant.id in (bracket_match.entrant_a_id, bracket_match.entrant_b_id)
              and entrant.user_id = auth.uid()
          )
        )
    ), '[]'::jsonb) end
  );
end;
$$;

revoke all on function public.advance_tournament_match_graph(uuid, uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.advance_tournament_match_graph(uuid, uuid, uuid, uuid)
  to service_role;
revoke all on function public.create_tournament(text, text, text, integer, integer, text, text),
  public.lock_double_elimination_tournament(uuid)
  from public, anon, authenticated;
grant execute on function public.create_tournament(text, text, text, integer, integer, text, text),
  public.lock_double_elimination_tournament(uuid)
  to authenticated;
revoke all on function public.resolve_tournament_forfeit_chain(uuid, uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.resolve_tournament_forfeit_chain(uuid, uuid, uuid, text, text)
  to service_role;

notify pgrst, 'reload schema';
commit;
