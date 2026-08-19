begin;

alter table public.tournaments
  add column regulation_id text not null default 'custom',
  add column registration_closes_at timestamptz,
  add column check_in_opens_at timestamptz,
  add column starts_at timestamptz;

alter table public.tournaments
  add constraint tournaments_regulation_id_valid check (
    char_length(regulation_id) between 2 and 64
    and regulation_id ~ '^[a-z0-9][a-z0-9-]*$'
  ),
  add constraint tournaments_registration_before_start check (
    registration_closes_at is null or starts_at is null or registration_closes_at <= starts_at
  ),
  add constraint tournaments_check_in_before_start check (
    check_in_opens_at is null or starts_at is null or check_in_opens_at <= starts_at
  );

comment on column public.tournaments.regulation_id is
  'Published event regulation. Draft-first events copy this into the private draft-room settings when the checked-in field locks.';
comment on column public.tournaments.registration_closes_at is
  'Published registration deadline. Phase changes remain an explicit operator action.';
comment on column public.tournaments.check_in_opens_at is
  'Published check-in opening time. Draft-first check-in remains an explicit operator action.';
comment on column public.tournaments.starts_at is
  'Published event start time.';

create or replace function public.enforce_tournament_demo_regulation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_demo then new.regulation_id := 'reg-mb'; end if;
  return new;
end;
$$;

drop trigger if exists enforce_tournament_demo_regulation_trigger on public.tournaments;
create trigger enforce_tournament_demo_regulation_trigger
before insert or update of is_demo, regulation_id on public.tournaments
for each row execute function public.enforce_tournament_demo_regulation();

update public.tournaments set regulation_id = 'reg-mb' where is_demo;

create or replace function public.validate_tournament_operation_details(
  p_regulation_id text,
  p_registration_closes_at timestamptz,
  p_check_in_opens_at timestamptz,
  p_starts_at timestamptz
)
returns void
language plpgsql
immutable
security definer
set search_path = public
as $$
begin
  if coalesce(p_regulation_id, '') !~ '^[a-z0-9][a-z0-9-]{1,63}$' then
    raise exception 'Choose a valid tournament regulation.';
  end if;
  if p_registration_closes_at is not null
     and p_starts_at is not null
     and p_registration_closes_at > p_starts_at then
    raise exception 'Registration must close before the tournament starts.';
  end if;
  if p_check_in_opens_at is not null
     and p_starts_at is not null
     and p_check_in_opens_at > p_starts_at then
    raise exception 'Check-in must open before the tournament starts.';
  end if;
end;
$$;

create or replace function public.configure_new_tournament_operation(
  p_tournament_id uuid,
  p_regulation_id text,
  p_registration_closes_at timestamptz,
  p_check_in_opens_at timestamptz,
  p_starts_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.validate_tournament_operation_details(
    p_regulation_id,
    p_registration_closes_at,
    p_check_in_opens_at,
    p_starts_at
  );
  update public.tournaments
  set regulation_id = p_regulation_id,
      registration_closes_at = p_registration_closes_at,
      check_in_opens_at = p_check_in_opens_at,
      starts_at = p_starts_at,
      updated_at = now()
  where id = p_tournament_id
    and owner_id = auth.uid()
    and status = 'registration';
  if not found then
    raise exception 'The new tournament could not be configured.';
  end if;
end;
$$;

-- Opening draft positions are a neutral random draw, not tournament seeds.
-- Swiss standings and earned Top Cut seeds therefore end with a stable entrant
-- identifier only after every result-based tiebreaker has been exhausted.
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
    select seat.entrant_id
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
    group by field.entrant_id
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

create or replace function public.create_tournament(
  p_regulation_id text,
  p_registration_closes_at timestamptz,
  p_check_in_opens_at timestamptz,
  p_starts_at timestamptz,
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
set search_path = public
as $$
declare
  v_result jsonb;
  v_tournament_id uuid;
begin
  v_result := public.create_tournament(
    p_name, p_description, p_visibility, p_best_of,
    p_entrant_limit, p_rules, p_format
  );
  select tournament.id into v_tournament_id
  from public.tournaments tournament
  where tournament.slug = v_result ->> 'slug'
    and tournament.owner_id = auth.uid();
  perform public.configure_new_tournament_operation(
    v_tournament_id, p_regulation_id, p_registration_closes_at,
    p_check_in_opens_at, p_starts_at
  );
  return v_result || jsonb_build_object('tournament_id', v_tournament_id, 'regulation_id', p_regulation_id);
end;
$$;

create or replace function public.create_draft_first_tournament(
  p_regulation_id text,
  p_registration_closes_at timestamptz,
  p_check_in_opens_at timestamptz,
  p_starts_at timestamptz,
  p_name text,
  p_description text default '',
  p_visibility text default 'public',
  p_best_of integer default 3,
  p_entrant_limit integer default 16,
  p_rules text default '',
  p_roster_size integer default 6,
  p_pick_time_limit_minutes integer default 5,
  p_snake_budget_enabled boolean default false,
  p_draft_budget integer default null,
  p_publish_rosters boolean default false,
  p_competition_format text default 'single-elimination'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  v_result := public.create_draft_first_tournament(
    p_name, p_description, p_visibility, p_best_of, p_entrant_limit,
    p_rules, p_roster_size, p_pick_time_limit_minutes,
    p_snake_budget_enabled, p_draft_budget, p_publish_rosters,
    p_competition_format
  );
  perform public.configure_new_tournament_operation(
    (v_result ->> 'tournament_id')::uuid, p_regulation_id,
    p_registration_closes_at, p_check_in_opens_at, p_starts_at
  );
  return v_result || jsonb_build_object('regulation_id', p_regulation_id);
end;
$$;

create or replace function public.create_auction_draft_first_tournament(
  p_regulation_id text,
  p_registration_closes_at timestamptz,
  p_check_in_opens_at timestamptz,
  p_starts_at timestamptz,
  p_name text,
  p_description text default '',
  p_visibility text default 'public',
  p_best_of integer default 3,
  p_entrant_limit integer default 16,
  p_rules text default '',
  p_roster_size integer default 6,
  p_draft_budget integer default 120,
  p_auction_nomination_seconds integer default 30,
  p_auction_timer_seconds integer default 30,
  p_auction_bid_reset_seconds integer default 10,
  p_publish_rosters boolean default false,
  p_competition_format text default 'single-elimination'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  v_result := public.create_auction_draft_first_tournament(
    p_name, p_description, p_visibility, p_best_of, p_entrant_limit,
    p_rules, p_roster_size, p_draft_budget,
    p_auction_nomination_seconds, p_auction_timer_seconds,
    p_auction_bid_reset_seconds, p_publish_rosters, p_competition_format
  );
  perform public.configure_new_tournament_operation(
    (v_result ->> 'tournament_id')::uuid, p_regulation_id,
    p_registration_closes_at, p_check_in_opens_at, p_starts_at
  );
  return v_result || jsonb_build_object('regulation_id', p_regulation_id);
end;
$$;

create or replace function public.get_tournament_operation_details(
  p_tournament_id uuid,
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
  select * into v_tournament
  from public.tournaments
  where id = p_tournament_id;
  if not found or (
    not public.can_view_tournament(p_tournament_id)
    and not (
      v_tournament.status = 'registration'
      and coalesce(p_access_code, '') ~ '^[0-9a-f]{32}$'
      and exists (
        select 1 from public.tournament_registration_codes code
        where code.tournament_id = p_tournament_id
          and code.code_hash = encode(digest(p_access_code, 'sha256'), 'hex')
      )
    )
  ) then
    return null;
  end if;
  return jsonb_build_object(
    'regulation_id', v_tournament.regulation_id,
    'registration_closes_at', v_tournament.registration_closes_at,
    'check_in_opens_at', v_tournament.check_in_opens_at,
    'starts_at', v_tournament.starts_at
  );
end;
$$;

create or replace function public.update_tournament_operation_details(
  p_tournament_id uuid,
  p_expected_revision bigint,
  p_regulation_id text,
  p_registration_closes_at timestamptz,
  p_check_in_opens_at timestamptz,
  p_starts_at timestamptz
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tournament public.tournaments%rowtype;
  v_revision bigint;
begin
  if auth.uid() is null then raise exception 'Sign in to update tournament details.'; end if;
  select * into v_tournament
  from public.tournaments
  where id = p_tournament_id
  for update;
  if not found or v_tournament.owner_id <> auth.uid() or v_tournament.status <> 'registration' then
    raise exception 'Only the tournament operator can update details before play begins.';
  end if;
  if v_tournament.revision <> p_expected_revision then
    raise exception 'The tournament changed. Refresh before saving event details.';
  end if;
  perform public.validate_tournament_operation_details(
    p_regulation_id, p_registration_closes_at, p_check_in_opens_at, p_starts_at
  );
  update public.tournaments
  set regulation_id = p_regulation_id,
      registration_closes_at = p_registration_closes_at,
      check_in_opens_at = p_check_in_opens_at,
      starts_at = p_starts_at,
      revision = revision + 1,
      updated_at = now()
  where id = p_tournament_id
  returning revision into v_revision;
  insert into public.tournament_audit_events(tournament_id, actor_id, kind, payload)
  values (
    p_tournament_id,
    auth.uid(),
    'tournament_operation_details_updated',
    jsonb_build_object(
      'regulation_id', p_regulation_id,
      'registration_scheduled', p_registration_closes_at is not null,
      'check_in_scheduled', p_check_in_opens_at is not null,
      'start_scheduled', p_starts_at is not null
    )
  );
  return v_revision;
end;
$$;

create or replace function public.start_tournament_with_random_draw(p_tournament_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_tournament public.tournaments%rowtype;
  v_count integer;
begin
  if auth.uid() is null then raise exception 'Sign in to start the tournament.'; end if;
  select * into v_tournament
  from public.tournaments
  where id = p_tournament_id
  for update;
  if not found or v_tournament.owner_id <> auth.uid()
     or v_tournament.status <> 'registration'
     or v_tournament.format not in ('single-elimination', 'double-elimination') then
    raise exception 'Only the tournament operator can start this bracket.';
  end if;
  select count(*) into v_count
  from public.tournament_entrants
  where tournament_id = p_tournament_id and status = 'registered';
  if (v_tournament.format = 'single-elimination' and v_count < 2)
     or (v_tournament.format = 'double-elimination' and v_count < 4) then
    raise exception 'The tournament does not have enough registered entrants.';
  end if;
  with drawn as (
    select entrant.id,
      row_number() over (order by gen_random_uuid())::integer as bracket_position
    from public.tournament_entrants entrant
    where entrant.tournament_id = p_tournament_id and entrant.status = 'registered'
  )
  update public.tournament_entrants entrant
  set seed = drawn.bracket_position
  from drawn
  where entrant.id = drawn.id;
  insert into public.tournament_audit_events(tournament_id, actor_id, kind, payload)
  values (p_tournament_id, auth.uid(), 'tournament_random_draw_created', jsonb_build_object('entrants', v_count));
  if v_tournament.format = 'double-elimination' then
    perform public.lock_double_elimination_tournament(p_tournament_id);
  else
    perform public.lock_single_elimination_tournament(p_tournament_id);
  end if;
end;
$$;

create or replace function public.lock_draft_tournament_field_with_draw(
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
  v_result jsonb;
begin
  if auth.uid() is null then raise exception 'Sign in to lock the event field.'; end if;
  select * into v_tournament from public.tournaments where id = p_tournament_id for update;
  select * into v_event from public.draft_tournament_events where tournament_id = p_tournament_id for update;
  if not found or v_tournament.owner_id <> auth.uid()
     or v_tournament.status <> 'registration'
     or v_event.phase <> 'check-in'
     or v_event.revision <> p_expected_revision then
    raise exception 'The Draft Tournament changed. Refresh before locking the field.';
  end if;
  with drawn as (
    select entrant.id,
      row_number() over (order by gen_random_uuid())::integer as draft_position
    from public.tournament_entrants entrant
    where entrant.tournament_id = p_tournament_id
      and entrant.status = 'registered'
      and entrant.checked_in_at is not null
  )
  update public.tournament_entrants entrant
  set seed = drawn.draft_position
  from drawn
  where entrant.id = drawn.id;
  if v_event.draft_type = 'auction' then
    v_result := public.lock_auction_draft_tournament_field(p_tournament_id, p_expected_revision);
  else
    v_result := public.lock_draft_tournament_field(p_tournament_id, p_expected_revision);
  end if;
  return v_result;
end;
$$;

create or replace function public.sync_draft_tournament_regulation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_regulation_id text;
begin
  if new.draft_league_id is null
     or new.draft_league_id is not distinct from old.draft_league_id then
    return new;
  end if;
  select tournament.regulation_id into v_regulation_id
  from public.tournaments tournament
  where tournament.id = new.tournament_id;
  update public.league_state_snapshots
  set state = jsonb_set(state, '{settings,regulationId}', to_jsonb(v_regulation_id), true),
      revision = revision + 1,
      updated_at = now()
  where league_id = new.draft_league_id;
  update public.leagues
  set settings = jsonb_set(coalesce(settings, '{}'::jsonb), '{regulationId}', to_jsonb(v_regulation_id), true),
      updated_at = now()
  where id = new.draft_league_id;
  return new;
end;
$$;

drop trigger if exists sync_draft_tournament_regulation_trigger on public.draft_tournament_events;
create trigger sync_draft_tournament_regulation_trigger
after update of draft_league_id on public.draft_tournament_events
for each row execute function public.sync_draft_tournament_regulation();

revoke all on function public.validate_tournament_operation_details(text, timestamptz, timestamptz, timestamptz),
  public.configure_new_tournament_operation(uuid, text, timestamptz, timestamptz, timestamptz),
  public.enforce_tournament_demo_regulation(),
  public.sync_draft_tournament_regulation()
from public, anon, authenticated, service_role;
grant execute on function public.validate_tournament_operation_details(text, timestamptz, timestamptz, timestamptz),
  public.configure_new_tournament_operation(uuid, text, timestamptz, timestamptz, timestamptz),
  public.enforce_tournament_demo_regulation(),
  public.sync_draft_tournament_regulation()
to service_role;

revoke all on function public.create_tournament(
  text, timestamptz, timestamptz, timestamptz,
  text, text, text, integer, integer, text, text
), public.create_draft_first_tournament(
  text, timestamptz, timestamptz, timestamptz,
  text, text, text, integer, integer, text, integer, integer,
  boolean, integer, boolean, text
), public.create_auction_draft_first_tournament(
  text, timestamptz, timestamptz, timestamptz,
  text, text, text, integer, integer, text, integer, integer,
  integer, integer, integer, boolean, text
), public.update_tournament_operation_details(
  uuid, bigint, text, timestamptz, timestamptz, timestamptz
), public.start_tournament_with_random_draw(uuid),
  public.lock_draft_tournament_field_with_draw(uuid, bigint)
from public, anon, authenticated, service_role;
grant execute on function public.create_tournament(
  text, timestamptz, timestamptz, timestamptz,
  text, text, text, integer, integer, text, text
), public.create_draft_first_tournament(
  text, timestamptz, timestamptz, timestamptz,
  text, text, text, integer, integer, text, integer, integer,
  boolean, integer, boolean, text
), public.create_auction_draft_first_tournament(
  text, timestamptz, timestamptz, timestamptz,
  text, text, text, integer, integer, text, integer, integer,
  integer, integer, integer, boolean, text
), public.update_tournament_operation_details(
  uuid, bigint, text, timestamptz, timestamptz, timestamptz
), public.start_tournament_with_random_draw(uuid),
  public.lock_draft_tournament_field_with_draw(uuid, bigint)
to authenticated;

revoke all on function public.get_tournament_operation_details(uuid, text)
from public, anon, authenticated, service_role;
grant execute on function public.get_tournament_operation_details(uuid, text)
to anon, authenticated, service_role;

-- Pre-event seeding is intentionally no longer a participant-facing tournament operation.
revoke all on function public.set_tournament_seed(uuid, uuid, integer),
  public.randomize_tournament_seeds(uuid, text)
from public, anon, authenticated;
grant execute on function public.set_tournament_seed(uuid, uuid, integer),
  public.randomize_tournament_seeds(uuid, text)
to service_role;

notify pgrst, 'reload schema';
commit;
