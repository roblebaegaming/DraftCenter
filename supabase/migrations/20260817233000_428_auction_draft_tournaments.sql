-- Migration 428: auction Draft Tournaments for 4-32 entrants.
--
-- The released 4-16 snake path stays unchanged. Auction events use their own
-- creation and field-lock RPCs, the existing server-authoritative auction
-- engine, and the existing Swiss or elimination engines after atomic roster
-- materialization and lock.
begin;

-- The shared table cannot see the draft subtype. Browser writes remain RPC-only:
-- the existing snake RPC still rejects more than 16 while the new auction RPC
-- is the only path that accepts 17-32.
alter table public.tournaments
  drop constraint if exists tournaments_entrant_limit_check;
alter table public.tournaments
  add constraint tournaments_entrant_limit_check check (
    (format = 'single-elimination' and entrant_limit between 2 and 512)
    or (format = 'double-elimination' and entrant_limit between 4 and 256)
    or (format = 'draft-tournament' and entrant_limit between 4 and 32)
  );

alter table public.draft_tournament_events
  add column if not exists draft_type text not null default 'snake';
alter table public.draft_tournament_events
  drop constraint if exists draft_tournament_events_draft_type_check;
alter table public.draft_tournament_events
  add constraint draft_tournament_events_draft_type_check
  check (draft_type in ('snake', 'auction'));

alter table public.draft_tournament_events
  add column if not exists auction_nomination_seconds smallint not null default 30;
alter table public.draft_tournament_events
  add column if not exists auction_timer_seconds smallint not null default 30;
alter table public.draft_tournament_events
  add column if not exists auction_bid_reset_seconds smallint not null default 10;
alter table public.draft_tournament_events
  drop constraint if exists draft_tournament_events_auction_nomination_seconds_check;
alter table public.draft_tournament_events
  add constraint draft_tournament_events_auction_nomination_seconds_check
  check (auction_nomination_seconds between 5 and 600);
alter table public.draft_tournament_events
  drop constraint if exists draft_tournament_events_auction_timer_seconds_check;
alter table public.draft_tournament_events
  add constraint draft_tournament_events_auction_timer_seconds_check
  check (auction_timer_seconds between 5 and 600);
alter table public.draft_tournament_events
  drop constraint if exists draft_tournament_events_auction_bid_reset_seconds_check;
alter table public.draft_tournament_events
  add constraint draft_tournament_events_auction_bid_reset_seconds_check
  check (auction_bid_reset_seconds between 1 and 120);

alter table public.draft_tournament_events
  drop constraint if exists draft_tournament_events_check;
alter table public.draft_tournament_events
  drop constraint if exists draft_tournament_events_draft_budget_check;
alter table public.draft_tournament_events
  add constraint draft_tournament_events_draft_budget_check check (
    (
      draft_type = 'snake'
      and (
        (not snake_budget_enabled and draft_budget is null)
        or (snake_budget_enabled and draft_budget between 60 and 1000)
      )
    )
    or (
      draft_type = 'auction'
      and not snake_budget_enabled
      and draft_budget between 60 and 1000
    )
  );

alter table public.draft_tournament_events
  drop constraint if exists draft_tournament_events_swiss_round_count_check;
alter table public.draft_tournament_events
  add constraint draft_tournament_events_swiss_round_count_check
  check (swiss_round_count in (3, 4, 5));
alter table public.draft_tournament_events
  drop constraint if exists draft_tournament_events_current_swiss_round_check;
alter table public.draft_tournament_events
  add constraint draft_tournament_events_current_swiss_round_check
  check (current_swiss_round between 0 and 5);

alter table public.draft_tournament_seats
  drop constraint if exists draft_tournament_seats_initial_seed_check;
alter table public.draft_tournament_seats
  add constraint draft_tournament_seats_initial_seed_check
  check (initial_seed between 1 and 32);
alter table public.draft_tournament_seats
  drop constraint if exists draft_tournament_seats_team_key_check;
alter table public.draft_tournament_seats
  add constraint draft_tournament_seats_team_key_check
  check (team_key between 0 and 31);

alter table public.draft_tournament_rounds
  drop constraint if exists draft_tournament_rounds_round_number_check;
alter table public.draft_tournament_rounds
  add constraint draft_tournament_rounds_round_number_check
  check (round_number between 1 and 5);
alter table public.draft_tournament_pairings
  drop constraint if exists draft_tournament_pairings_board_number_check;
alter table public.draft_tournament_pairings
  add constraint draft_tournament_pairings_board_number_check
  check (board_number between 1 and 16);

alter table public.draft_tournament_standing_snapshots
  drop constraint if exists draft_tournament_standing_snapshots_rank_check;
alter table public.draft_tournament_standing_snapshots
  add constraint draft_tournament_standing_snapshots_rank_check
  check (rank between 1 and 32);
alter table public.draft_tournament_standing_snapshots
  drop constraint if exists draft_tournament_standing_snapshots_match_wins_check;
alter table public.draft_tournament_standing_snapshots
  add constraint draft_tournament_standing_snapshots_match_wins_check
  check (match_wins between 0 and 5);
alter table public.draft_tournament_standing_snapshots
  drop constraint if exists draft_tournament_standing_snapshots_match_losses_check;
alter table public.draft_tournament_standing_snapshots
  add constraint draft_tournament_standing_snapshots_match_losses_check
  check (match_losses between 0 and 5);
alter table public.draft_tournament_standing_snapshots
  drop constraint if exists draft_tournament_standing_snapshots_game_wins_check;
alter table public.draft_tournament_standing_snapshots
  add constraint draft_tournament_standing_snapshots_game_wins_check
  check (game_wins between 0 and 15);
alter table public.draft_tournament_standing_snapshots
  drop constraint if exists draft_tournament_standing_snapshots_game_losses_check;
alter table public.draft_tournament_standing_snapshots
  add constraint draft_tournament_standing_snapshots_game_losses_check
  check (game_losses between 0 and 15);
alter table public.draft_tournament_standing_snapshots
  drop constraint if exists draft_tournament_standing_snapshots_bye_count_check;
alter table public.draft_tournament_standing_snapshots
  add constraint draft_tournament_standing_snapshots_bye_count_check
  check (bye_count between 0 and 5);

create or replace function public.create_auction_draft_first_tournament(
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
set search_path = public, extensions
as $$
declare
  v_tournament_id uuid := gen_random_uuid();
  v_event_id uuid;
  v_name text := btrim(p_name);
  v_slug_base text;
  v_slug text;
  v_code text;
begin
  if auth.uid() is null then
    raise exception 'Sign in to create an auction Draft Tournament.';
  end if;
  if char_length(v_name) not between 2 and 120
     or coalesce(p_visibility, '') not in ('public', 'private')
     or p_best_of not in (1, 3)
     or p_entrant_limit not between 4 and 32
     or p_roster_size not between 4 and 12
     or p_draft_budget not between 60 and 1000
     or p_auction_nomination_seconds not between 5 and 600
     or p_auction_timer_seconds not between 5 and 600
     or p_auction_bid_reset_seconds not between 1 and 120
     or p_competition_format not in ('swiss', 'single-elimination', 'double-elimination')
     or char_length(coalesce(p_description, '')) > 2000
     or char_length(coalesce(p_rules, '')) > 10000 then
    raise exception 'Auction Draft Tournament settings are invalid.';
  end if;

  v_slug_base := left(trim(both '-' from regexp_replace(lower(v_name), '[^a-z0-9]+', '-', 'g')), 60);
  if v_slug_base = '' then v_slug_base := 'auction-draft-tournament'; end if;
  v_slug := v_slug_base || '-' || left(replace(v_tournament_id::text, '-', ''), 8);

  insert into public.tournaments(
    id, slug, owner_id, name, description, visibility, format,
    status, rules, best_of, entrant_limit
  ) values (
    v_tournament_id, v_slug, auth.uid(), v_name, coalesce(p_description, ''),
    p_visibility, 'draft-tournament', 'registration', coalesce(p_rules, ''),
    p_best_of, p_entrant_limit
  );

  insert into public.draft_tournament_events(
    tournament_id, draft_type, competition_format, roster_size,
    pick_time_limit_minutes, snake_budget_enabled, draft_budget,
    auction_nomination_seconds, auction_timer_seconds,
    auction_bid_reset_seconds, top_cut_size, publish_rosters
  ) values (
    v_tournament_id, 'auction', p_competition_format, p_roster_size,
    0, false, p_draft_budget, p_auction_nomination_seconds,
    p_auction_timer_seconds, p_auction_bid_reset_seconds, 0,
    p_visibility = 'public' and coalesce(p_publish_rosters, false)
  ) returning id into v_event_id;

  if p_visibility = 'private' then
    v_code := encode(gen_random_bytes(16), 'hex');
    insert into public.tournament_registration_codes(tournament_id, code_hash)
    values (v_tournament_id, encode(digest(v_code, 'sha256'), 'hex'));
  end if;

  insert into public.tournament_audit_events(tournament_id, actor_id, kind, payload)
  values (
    v_tournament_id,
    auth.uid(),
    'draft_tournament_created',
    jsonb_build_object(
      'event_id', v_event_id,
      'draft_type', 'auction',
      'competition_format', p_competition_format,
      'entrant_limit', p_entrant_limit,
      'roster_size', p_roster_size,
      'draft_budget', p_draft_budget,
      'auction_nomination_seconds', p_auction_nomination_seconds,
      'auction_timer_seconds', p_auction_timer_seconds,
      'auction_bid_reset_seconds', p_auction_bid_reset_seconds
    )
  );

  return jsonb_build_object(
    'tournament_id', v_tournament_id,
    'event_id', v_event_id,
    'slug', v_slug,
    'registration_code', v_code,
    'draft_type', 'auction',
    'competition_format', p_competition_format
  );
end;
$$;

create or replace function public.lock_auction_draft_tournament_field(
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
  v_count integer;
  v_league_id uuid := gen_random_uuid();
  v_league_slug text;
  v_teams jsonb;
  v_rosters jsonb;
  v_state jsonb;
begin
  if auth.uid() is null then raise exception 'Sign in to lock the auction event field.'; end if;
  select * into v_tournament from public.tournaments where id = p_tournament_id for update;
  select * into v_event from public.draft_tournament_events where tournament_id = p_tournament_id for update;
  if not found or v_tournament.owner_id <> auth.uid()
     or v_tournament.format <> 'draft-tournament'
     or v_tournament.status <> 'registration'
     or v_event.draft_type <> 'auction'
     or v_event.phase <> 'check-in'
     or v_event.field_locked_at is not null then
    raise exception 'Only the owner can lock an open auction Draft Tournament field.';
  end if;
  if v_event.revision <> p_expected_revision then
    raise exception 'The event changed. Refresh before locking the field.';
  end if;

  select count(*) into v_count
  from public.tournament_entrants
  where tournament_id = p_tournament_id
    and status = 'registered'
    and checked_in_at is not null;
  if v_count not between 4 and 32 or v_count > v_tournament.entrant_limit then
    raise exception 'An auction Draft Tournament needs between 4 and 32 checked-in entrants within its configured limit.';
  end if;
  if exists (
    select 1 from public.tournament_entrants entrant
    where entrant.tournament_id = p_tournament_id
      and entrant.status = 'registered'
      and entrant.checked_in_at is not null
      and entrant.user_id is null
  ) then
    raise exception 'Every checked-in auction entrant must be attached to an account.';
  end if;

  update public.tournament_entrants
  set status = 'no-show'
  where tournament_id = p_tournament_id
    and status = 'registered'
    and checked_in_at is null;

  with seeded as (
    select entrant.id,
      case when entrant.status = 'registered'
        then row_number() over (
          partition by entrant.status
          order by entrant.seed nulls last, entrant.registered_at, entrant.id
        )::smallint
        else null
      end as field_seed
    from public.tournament_entrants entrant
    where entrant.tournament_id = p_tournament_id
  )
  insert into public.draft_tournament_seats(
    event_id, tournament_id, entrant_id, user_id, status, initial_seed, team_key
  )
  select
    v_event.id,
    p_tournament_id,
    entrant.id,
    entrant.user_id,
    case when entrant.status = 'registered' then 'active' else 'no-show' end,
    seeded.field_seed,
    case when seeded.field_seed is not null then seeded.field_seed - 1 else null end
  from public.tournament_entrants entrant
  join seeded on seeded.id = entrant.id
  where entrant.tournament_id = p_tournament_id;

  update public.tournament_entrants set seed = null where tournament_id = p_tournament_id;
  update public.tournament_entrants entrant
  set seed = seat.initial_seed
  from public.draft_tournament_seats seat
  where seat.event_id = v_event.id
    and seat.entrant_id = entrant.id
    and seat.status = 'active';

  v_league_slug := 'auction-draft-event-' || left(replace(p_tournament_id::text, '-', ''), 20);
  insert into public.leagues(
    id, name, slug, description, season_label, created_by,
    is_public, league_visibility, workspace_kind
  ) values (
    v_league_id,
    left(v_tournament.name || ' Auction Room', 120),
    v_league_slug,
    'Internal auction Draft Tournament room for ' || v_tournament.name,
    'Auction Draft Tournament',
    v_tournament.owner_id,
    false,
    'private',
    'draft-tournament'
  );

  insert into public.league_memberships(league_id, user_id, role)
  values (v_league_id, v_tournament.owner_id, 'commissioner');
  insert into public.league_memberships(league_id, user_id, role)
  select v_league_id, seat.user_id, 'coach'
  from public.draft_tournament_seats seat
  where seat.event_id = v_event.id
    and seat.status = 'active'
    and seat.user_id <> v_tournament.owner_id
  on conflict (league_id, user_id) do update
  set role = case
    when public.league_memberships.role in ('commissioner', 'co_commissioner')
      then public.league_memberships.role
    else 'coach'
  end;

  select jsonb_agg(jsonb_build_object(
    'id', seat.team_key,
    'name', left(entrant.display_name, 80) || ' · Seed ' || seat.initial_seed,
    'claimedBy', entrant.display_name,
    'claimedByUserId', seat.user_id::text,
    'description', 'Auction Draft Tournament seed ' || seat.initial_seed
  ) order by seat.team_key)
  into v_teams
  from public.draft_tournament_seats seat
  join public.tournament_entrants entrant on entrant.id = seat.entrant_id
  where seat.event_id = v_event.id and seat.status = 'active';

  select jsonb_agg('[]'::jsonb order by seat.team_key)
  into v_rosters
  from public.draft_tournament_seats seat
  where seat.event_id = v_event.id and seat.status = 'active';

  v_state := jsonb_build_object(
    'eventMode', 'draft-tournament',
    'tournamentId', p_tournament_id,
    'tournamentSlug', v_tournament.slug,
    'commissioner', coalesce(
      (select nullif(btrim(profile.display_name), '') from public.profiles profile where profile.id = v_tournament.owner_id),
      'Commissioner'
    ),
    'locked', false,
    'teams', coalesce(v_teams, '[]'::jsonb),
    'rosters', coalesce(v_rosters, '[]'::jsonb),
    'pool', '[]'::jsonb,
    'settings', jsonb_build_object(
      'leagueSize', v_count,
      'leagueScaleMode', 'expanded',
      'draftType', 'auction',
      'rosterSize', v_event.roster_size,
      'rosterMin', v_event.roster_size,
      'rosterMax', v_event.roster_size,
      'budget', v_event.draft_budget,
      'auctionNominationSeconds', v_event.auction_nomination_seconds,
      'auctionTimerSeconds', v_event.auction_timer_seconds,
      'auctionBidResetSeconds', v_event.auction_bid_reset_seconds,
      'publicLeague', false,
      'overnightPauseEnabled', false,
      'keepersEnabled', false,
      'tradesEnabled', false,
      'freeAgencyEnabled', false
    )
  );
  insert into public.league_state_snapshots(league_id, state) values (v_league_id, v_state);

  insert into public.auction_team_owners(league_id, team_index, user_id)
  select v_league_id, seat.team_key, seat.user_id
  from public.draft_tournament_seats seat
  where seat.event_id = v_event.id and seat.status = 'active';

  update public.draft_tournament_events
  set draft_league_id = v_league_id,
      phase = 'draft-setup',
      swiss_round_count = case when v_count <= 8 then 3 when v_count <= 16 then 4 else 5 end,
      field_locked_at = now(),
      revision = revision + 1,
      updated_at = now()
  where id = v_event.id;
  update public.tournaments
  set status = 'active', revision = revision + 1, updated_at = now()
  where id = p_tournament_id;

  insert into public.tournament_audit_events(tournament_id, actor_id, kind, payload)
  values (
    p_tournament_id,
    auth.uid(),
    'draft_tournament_field_locked',
    jsonb_build_object(
      'checked_in_count', v_count,
      'no_show_count', (
        select count(*) from public.draft_tournament_seats
        where event_id = v_event.id and status = 'no-show'
      ),
      'draft_type', 'auction',
      'competition_format', v_event.competition_format,
      'swiss_round_count', case when v_event.competition_format = 'swiss'
        then case when v_count <= 8 then 3 when v_count <= 16 then 4 else 5 end
        else null end,
      'draft_league_id', v_league_id
    )
  );
  return jsonb_build_object(
    'event_id', v_event.id,
    'draft_league_id', v_league_id,
    'draft_room_slug', v_league_slug,
    'checked_in_count', v_count,
    'draft_type', 'auction'
  );
end;
$$;

-- Preserve the released snake snapshot contract while allowing the dedicated
-- auction trigger below to validate auction events.
create or replace function public.guard_draft_tournament_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.draft_tournament_events%rowtype;
begin
  select * into v_event
  from public.draft_tournament_events
  where draft_league_id = new.league_id;
  if not found or v_event.draft_type = 'auction' then return new; end if;

  if jsonb_typeof(coalesce(new.state -> 'teams', 'null'::jsonb)) <> 'array'
     or jsonb_array_length(new.state -> 'teams') <> (
       select count(*)
       from public.draft_tournament_seats seat
       where seat.event_id = v_event.id and seat.initial_seed is not null
     )
     or coalesce(new.state #>> '{settings,draftType}', '') <> 'snake'
     or coalesce(nullif(new.state #>> '{settings,leagueSize}', '')::integer, -1) <> (
       select count(*)
       from public.draft_tournament_seats seat
       where seat.event_id = v_event.id and seat.initial_seed is not null
     )
     or coalesce(nullif(new.state #>> '{settings,rosterSize}', '')::integer, -1) <> v_event.roster_size
     or coalesce(nullif(new.state #>> '{settings,rosterMin}', '')::integer, -1) <> v_event.roster_size
     or coalesce(nullif(new.state #>> '{settings,rosterMax}', '')::integer, -1) <> v_event.roster_size
     or coalesce(nullif(new.state #>> '{settings,pickTimeLimitMinutes}', '')::integer, -1) <> v_event.pick_time_limit_minutes
     or coalesce((new.state #>> '{settings,keepersEnabled}')::boolean, false)
     or coalesce((new.state #>> '{settings,tradesEnabled}')::boolean, false)
     or coalesce((new.state #>> '{settings,freeAgencyEnabled}')::boolean, false)
     or coalesce((new.state #>> '{settings,publicLeague}')::boolean, false)
     or coalesce((new.state #>> '{settings,overnightPauseEnabled}')::boolean, false)
     or new.state #> '{settings,manualDraftOrder}' is distinct from (
       select jsonb_agg(seat.team_key order by seat.team_key)
       from public.draft_tournament_seats seat
       where seat.event_id = v_event.id and seat.initial_seed is not null
     )
     or (
       v_event.snake_budget_enabled
       and coalesce(nullif(new.state #>> '{settings,budget}', '')::integer, -1) <> v_event.draft_budget
     )
     or exists (
       select 1
       from public.draft_tournament_seats seat
       join public.tournament_entrants entrant on entrant.id = seat.entrant_id
       where seat.event_id = v_event.id
         and seat.initial_seed is not null
         and (
           coalesce(new.state #>> array['teams', seat.team_key::text, 'id'], '') <> seat.team_key::text
           or coalesce(new.state #>> array['teams', seat.team_key::text, 'name'], '')
             <> left(entrant.display_name, 80) || ' · Seed ' || seat.initial_seed
           or coalesce(new.state #>> array['teams', seat.team_key::text, 'claimedByUserId'], '') <> seat.user_id::text
         )
     ) then
    raise exception 'Draft Tournament team identities cannot be changed.';
  end if;

  if v_event.roster_locked_at is not null
     and (
       new.state -> 'rosters' is distinct from old.state -> 'rosters'
       or new.state -> 'teams' is distinct from old.state -> 'teams'
     ) then
    raise exception 'Draft Tournament rosters are locked.';
  end if;
  return new;
end;
$$;

-- League settings are normally represented inside the snapshot, but retain a
-- safe auction pass-through if an internal maintenance path touches the
-- relational settings column.
create or replace function public.guard_draft_tournament_league_settings()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.draft_tournament_events%rowtype;
begin
  select * into v_event
  from public.draft_tournament_events
  where draft_league_id = new.id;
  if not found or v_event.draft_type = 'auction' then return new; end if;
  if coalesce(new.settings ->> 'draftType', '') <> 'snake'
     or coalesce(nullif(new.settings ->> 'leagueSize', '')::integer, -1) <> (
       select count(*)
       from public.draft_tournament_seats seat
       where seat.event_id = v_event.id and seat.initial_seed is not null
     )
     or coalesce(nullif(new.settings ->> 'rosterSize', '')::integer, -1) <> v_event.roster_size
     or coalesce(nullif(new.settings ->> 'rosterMin', '')::integer, -1) <> v_event.roster_size
     or coalesce(nullif(new.settings ->> 'rosterMax', '')::integer, -1) <> v_event.roster_size
     or coalesce(nullif(new.settings ->> 'pickTimeLimitMinutes', '')::integer, -1) <> v_event.pick_time_limit_minutes
     or coalesce((new.settings ->> 'keepersEnabled')::boolean, false)
     or coalesce((new.settings ->> 'tradesEnabled')::boolean, false)
     or coalesce((new.settings ->> 'freeAgencyEnabled')::boolean, false)
     or coalesce((new.settings ->> 'publicLeague')::boolean, false)
     or coalesce((new.settings ->> 'overnightPauseEnabled')::boolean, false)
     or new.settings -> 'manualDraftOrder' is distinct from (
       select jsonb_agg(seat.team_key order by seat.team_key)
       from public.draft_tournament_seats seat
       where seat.event_id = v_event.id and seat.initial_seed is not null
     )
     or coalesce((new.settings ->> 'snakeBudgetEnabled')::boolean, false) <> v_event.snake_budget_enabled
     or (
       v_event.snake_budget_enabled
       and coalesce(nullif(new.settings ->> 'budget', '')::integer, -1) <> v_event.draft_budget
     ) then
    raise exception 'Draft Tournament draft settings are fixed when the field locks.';
  end if;
  return new;
end;
$$;

create or replace function public.guard_auction_draft_tournament_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.draft_tournament_events%rowtype;
  v_team_count integer;
  v_distinct_order_count integer;
  v_min_order integer;
  v_max_order integer;
begin
  select * into v_event
  from public.draft_tournament_events
  where draft_league_id = new.league_id;
  if not found or v_event.draft_type <> 'auction' then return new; end if;

  if new.state ->> 'eventMode' <> 'draft-tournament'
     or new.state ->> 'tournamentId' <> v_event.tournament_id::text
     or coalesce(new.state #>> '{settings,draftType}', '') <> 'auction'
     or coalesce(new.state #>> '{settings,leagueScaleMode}', '') <> 'expanded'
     or coalesce(nullif(new.state #>> '{settings,rosterSize}', '')::integer, -1) <> v_event.roster_size
     or coalesce(nullif(new.state #>> '{settings,rosterMin}', '')::integer, -1) <> v_event.roster_size
     or coalesce(nullif(new.state #>> '{settings,rosterMax}', '')::integer, -1) <> v_event.roster_size
     or coalesce(nullif(new.state #>> '{settings,budget}', '')::integer, -1) <> v_event.draft_budget
     or coalesce(nullif(new.state #>> '{settings,auctionNominationSeconds}', '')::integer, -1) <> v_event.auction_nomination_seconds
     or coalesce(nullif(new.state #>> '{settings,auctionTimerSeconds}', '')::integer, -1) <> v_event.auction_timer_seconds
     or coalesce(nullif(new.state #>> '{settings,auctionBidResetSeconds}', '')::integer, -1) <> v_event.auction_bid_reset_seconds
     or coalesce((new.state #>> '{settings,keepersEnabled}')::boolean, false)
     or coalesce((new.state #>> '{settings,tradesEnabled}')::boolean, false)
     or coalesce((new.state #>> '{settings,freeAgencyEnabled}')::boolean, false)
     or coalesce((new.state #>> '{settings,publicLeague}')::boolean, false)
     or coalesce((new.state #>> '{settings,overnightPauseEnabled}')::boolean, false) then
    raise exception 'Auction Draft Tournament settings are fixed when the field locks.';
  end if;

  if jsonb_typeof(new.state -> 'teams') <> 'array'
     or jsonb_typeof(new.state -> 'rosters') <> 'array' then
    raise exception 'Auction Draft Tournament teams and rosters must remain ordered arrays.';
  end if;
  v_team_count := jsonb_array_length(new.state -> 'teams');
  if v_team_count not between 4 and 32
     or v_team_count <> (
       select count(*) from public.draft_tournament_seats seat
       where seat.event_id = v_event.id and seat.status = 'active'
     )
     or jsonb_array_length(new.state -> 'rosters') <> v_team_count
     or coalesce(nullif(new.state #>> '{settings,leagueSize}', '')::integer, -1) <> v_team_count then
    raise exception 'Auction Draft Tournament team capacity no longer matches its locked field.';
  end if;

  if exists (
    select 1
    from public.draft_tournament_seats seat
    join public.tournament_entrants entrant on entrant.id = seat.entrant_id
    where seat.event_id = v_event.id
      and seat.status = 'active'
      and (
        coalesce(new.state #>> array['teams', seat.team_key::text, 'id'], '') <> seat.team_key::text
        or coalesce(new.state #>> array['teams', seat.team_key::text, 'name'], '')
          <> left(entrant.display_name, 80) || ' · Seed ' || seat.initial_seed
        or coalesce(new.state #>> array['teams', seat.team_key::text, 'claimedByUserId'], '') <> seat.user_id::text
      )
  ) then
    raise exception 'Auction Draft Tournament team identities cannot be changed.';
  end if;

  if exists (
    select 1 from jsonb_array_elements(new.state -> 'rosters') roster(value)
    where jsonb_typeof(roster.value) <> 'array'
       or jsonb_array_length(roster.value) > v_event.roster_size
  ) then
    raise exception 'An auction roster exceeds the tournament roster size.';
  end if;

  if coalesce((old.state ->> 'locked')::boolean, false)
     and not coalesce((new.state ->> 'locked')::boolean, false) then
    raise exception 'A live auction Draft Tournament cannot be reset. Cancel the event before roster lock instead.';
  end if;
  if v_event.roster_locked_at is not null
     and (
       new.state -> 'rosters' is distinct from old.state -> 'rosters'
       or new.state -> 'teams' is distinct from old.state -> 'teams'
     ) then
    raise exception 'Draft Tournament rosters are locked.';
  end if;

  if coalesce((new.state ->> 'locked')::boolean, false) then
    if jsonb_typeof(new.state -> 'pool') <> 'array'
       or jsonb_typeof(new.state -> 'budgets') <> 'array'
       or jsonb_typeof(new.state -> 'auctionNominationOrder') <> 'array'
       or jsonb_array_length(new.state -> 'budgets') <> v_team_count
       or jsonb_array_length(new.state -> 'auctionNominationOrder') <> v_team_count then
      raise exception 'The auction pool, budgets, and nomination order are incomplete.';
    end if;
    select count(distinct (entry.value #>> '{}')::integer),
           min((entry.value #>> '{}')::integer),
           max((entry.value #>> '{}')::integer)
    into v_distinct_order_count, v_min_order, v_max_order
    from jsonb_array_elements(new.state -> 'auctionNominationOrder') entry(value)
    where jsonb_typeof(entry.value) = 'number'
      and entry.value #>> '{}' ~ '^[0-9]+$';
    if v_distinct_order_count <> v_team_count
       or v_min_order <> 0
       or v_max_order <> v_team_count - 1 then
      raise exception 'The auction nomination order must contain every locked seat exactly once.';
    end if;
    if exists (
      select 1 from jsonb_array_elements(new.state -> 'budgets') budget(value)
      where jsonb_typeof(budget.value) <> 'number'
         or budget.value #>> '{}' !~ '^[0-9]+$'
         or (budget.value #>> '{}')::integer > v_event.draft_budget
    ) then
      raise exception 'Auction Tournament budgets are invalid.';
    end if;
    if not coalesce((old.state ->> 'locked')::boolean, false) then
      if jsonb_array_length(new.state -> 'pool') < v_team_count * v_event.roster_size then
        raise exception 'The legal auction pool is too small to fill every tournament roster.';
      end if;
      if exists (
        select 1 from jsonb_array_elements(new.state -> 'budgets') budget(value)
        where (budget.value #>> '{}')::integer <> v_event.draft_budget
      ) then
        raise exception 'Every auction seat must begin with the configured budget.';
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_auction_draft_tournament_snapshot_trigger on public.league_state_snapshots;
create trigger guard_auction_draft_tournament_snapshot_trigger
before update of state on public.league_state_snapshots
for each row execute function public.guard_auction_draft_tournament_snapshot();

create or replace function public.sync_auction_draft_tournament_phase()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.draft_tournament_events%rowtype;
  v_actor uuid;
begin
  select * into v_event
  from public.draft_tournament_events
  where draft_league_id = new.league_id
    and draft_type = 'auction'
  for update;
  if not found then return new; end if;
  select owner_id into v_actor from public.tournaments where id = v_event.tournament_id;

  if v_event.phase = 'draft-setup'
     and not coalesce((old.state ->> 'locked')::boolean, false)
     and coalesce((new.state ->> 'locked')::boolean, false)
     and not coalesce((new.state ->> 'auctionEnded')::boolean, false) then
    update public.draft_tournament_events
    set phase = 'drafting',
        draft_started_at = coalesce(draft_started_at, now()),
        revision = revision + 1,
        updated_at = now()
    where id = v_event.id;
    insert into public.tournament_audit_events(tournament_id, actor_id, kind, payload)
    values (
      v_event.tournament_id,
      coalesce(auth.uid(), v_actor),
      'draft_tournament_draft_started',
      jsonb_build_object(
        'draft_type', 'auction',
        'source', case when auth.uid() is null then 'server_automation' else 'commissioner' end
      )
    );
  elsif v_event.phase = 'drafting'
     and not coalesce((old.state ->> 'auctionEnded')::boolean, false)
     and coalesce((new.state ->> 'auctionEnded')::boolean, false) then
    update public.draft_tournament_events
    set phase = 'roster-review',
        revision = revision + 1,
        updated_at = now()
    where id = v_event.id;
    insert into public.tournament_audit_events(tournament_id, actor_id, kind, payload)
    values (
      v_event.tournament_id,
      coalesce(auth.uid(), v_actor),
      'draft_tournament_draft_completed',
      jsonb_build_object(
        'draft_type', 'auction',
        'source', case when auth.uid() is null then 'server_automation' else 'auction_action' end
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists sync_auction_draft_tournament_phase_trigger on public.league_state_snapshots;
create trigger sync_auction_draft_tournament_phase_trigger
after update of state on public.league_state_snapshots
for each row execute function public.sync_auction_draft_tournament_phase();

create or replace function public.materialize_auction_draft_tournament_rosters(
  p_event_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_event public.draft_tournament_events%rowtype;
  v_state jsonb;
  v_seat public.draft_tournament_seats%rowtype;
  v_membership_id uuid;
  v_team_id uuid;
  v_roster jsonb;
  v_mon jsonb;
  v_source_key text;
  v_league_pokemon_id uuid;
  v_materialized integer := 0;
begin
  select * into v_event
  from public.draft_tournament_events
  where id = p_event_id
    and draft_type = 'auction'
    and phase = 'roster-review'
  for update;
  if not found or v_event.draft_league_id is null then
    raise exception 'The auction Draft Tournament is not ready to materialize rosters.';
  end if;
  select state into v_state
  from public.league_state_snapshots
  where league_id = v_event.draft_league_id
  for update;
  if v_state is null
     or not coalesce((v_state ->> 'locked')::boolean, false)
     or not coalesce((v_state ->> 'auctionEnded')::boolean, false)
     or coalesce(v_state -> 'nominee', 'null'::jsonb) <> 'null'::jsonb then
    raise exception 'The hosted auction is not complete.';
  end if;
  if exists (select 1 from public.teams where league_id = v_event.draft_league_id)
     or exists (select 1 from public.league_pokemon where league_id = v_event.draft_league_id) then
    raise exception 'Auction Tournament roster materialization has already started.';
  end if;

  for v_seat in
    select * from public.draft_tournament_seats
    where event_id = v_event.id and status = 'active'
    order by initial_seed
    for update
  loop
    select membership.id into v_membership_id
    from public.league_memberships membership
    where membership.league_id = v_event.draft_league_id
      and membership.user_id = v_seat.user_id;
    if v_membership_id is null then
      raise exception 'A checked-in entrant is not attached to the expected auction membership.';
    end if;

    v_roster := coalesce(v_state #> array['rosters', v_seat.team_key::text], '[]'::jsonb);
    if jsonb_typeof(v_roster) <> 'array' or jsonb_array_length(v_roster) <> v_event.roster_size then
      raise exception 'Every checked-in entrant must have exactly % auctioned Pokemon before roster lock.', v_event.roster_size;
    end if;

    insert into public.teams(
      league_id, source_key, owner_membership_id, name, description
    ) values (
      v_event.draft_league_id,
      v_seat.team_key::text,
      v_membership_id,
      coalesce(nullif(btrim(v_state #>> array['teams', v_seat.team_key::text, 'name']), ''), 'Team ' || (v_seat.team_key + 1)),
      'Locked auction Draft Tournament roster'
    ) returning id into v_team_id;

    for v_mon in select value from jsonb_array_elements(v_roster)
    loop
      v_source_key := nullif(btrim(v_mon ->> 'id'), '');
      if v_source_key is null then
        raise exception 'Every auctioned Pokemon needs a stable source ID.';
      end if;
      insert into public.pokemon_catalogue(
        id, display_name, primary_type, secondary_type, base_stat_total,
        sprite_url, is_mega, is_restricted
      ) values (
        v_source_key,
        coalesce(nullif(btrim(v_mon ->> 'name'), ''), v_source_key),
        coalesce(nullif(lower(v_mon ->> 't1'), ''), 'normal'),
        nullif(lower(v_mon ->> 't2'), ''),
        case when coalesce(v_mon ->> 'bst', '') ~ '^[0-9]+$' then (v_mon ->> 'bst')::smallint else null end,
        coalesce(nullif(v_mon ->> 'spriteUrl', ''), nullif(v_mon ->> 'sprite', '')),
        coalesce((v_mon ->> 'isMega')::boolean, false),
        coalesce((v_mon ->> 'isRestricted')::boolean, false)
      )
      on conflict (id) do update
      set display_name = excluded.display_name,
          primary_type = excluded.primary_type,
          secondary_type = excluded.secondary_type,
          base_stat_total = excluded.base_stat_total,
          sprite_url = coalesce(excluded.sprite_url, public.pokemon_catalogue.sprite_url),
          is_mega = excluded.is_mega,
          is_restricted = excluded.is_restricted;

      insert into public.league_pokemon(
        league_id, pokemon_id, source_key, cost, is_allowed,
        is_drafted, is_restricted, is_mega
      ) values (
        v_event.draft_league_id,
        v_source_key,
        v_source_key,
        greatest(0, coalesce(nullif(v_mon ->> 'cost', '')::numeric, 0)),
        true,
        true,
        coalesce((v_mon ->> 'isRestricted')::boolean, false),
        coalesce((v_mon ->> 'isMega')::boolean, false)
      ) returning id into v_league_pokemon_id;

      insert into public.roster_entries(team_id, league_pokemon_id, acquisition_type)
      values (v_team_id, v_league_pokemon_id, 'draft');
    end loop;

    update public.draft_tournament_seats
    set team_id = v_team_id,
        roster_snapshot = v_roster,
        roster_hash = encode(digest(v_roster::text, 'sha256'), 'hex'),
        updated_at = now()
    where id = v_seat.id;
    v_materialized := v_materialized + 1;
  end loop;
  return v_materialized;
end;
$$;

create or replace function public.build_draft_first_elimination_bracket(
  p_event_id uuid,
  p_actor_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.draft_tournament_events%rowtype;
  v_tournament public.tournaments%rowtype;
  v_match_count integer;
  v_active_count integer;
  v_maximum integer;
begin
  select * into v_event
  from public.draft_tournament_events
  where id = p_event_id
  for update;
  if not found
     or v_event.competition_format not in ('single-elimination', 'double-elimination')
     or v_event.phase <> 'roster-review' then
    raise exception 'The draft-first bracket is not ready.';
  end if;

  select * into v_tournament
  from public.tournaments
  where id = v_event.tournament_id
  for update;
  if not found
     or v_tournament.owner_id <> p_actor_id
     or v_tournament.format <> 'draft-tournament'
     or v_tournament.status <> 'active' then
    raise exception 'Only the owner can build the draft-first bracket.';
  end if;
  if exists (
    select 1 from public.tournament_matches bracket_match
    where bracket_match.tournament_id = v_tournament.id
  ) then
    raise exception 'The tournament bracket already exists.';
  end if;
  select count(*) into v_active_count
  from public.tournament_entrants entrant
  where entrant.tournament_id = v_tournament.id and entrant.status = 'registered';
  v_maximum := case when v_event.draft_type = 'auction' then 32 else 16 end;
  if v_active_count not between 4 and v_maximum then
    raise exception 'A % draft-first elimination bracket needs between 4 and % active entrants.', v_event.draft_type, v_maximum;
  end if;

  update public.tournaments
  set format = v_event.competition_format,
      status = 'registration',
      updated_at = now()
  where id = v_tournament.id;

  if v_event.competition_format = 'double-elimination' then
    perform public.lock_double_elimination_tournament(v_tournament.id);
  else
    perform public.lock_single_elimination_tournament(v_tournament.id);
  end if;

  update public.tournaments
  set format = 'draft-tournament',
      status = 'active',
      updated_at = now()
  where id = v_tournament.id;

  select count(*) into v_match_count
  from public.tournament_matches bracket_match
  where bracket_match.tournament_id = v_tournament.id;
  return jsonb_build_object(
    'competition_format', v_event.competition_format,
    'match_count', v_match_count
  );
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
  v_bracket jsonb;
  v_materialized integer;
begin
  if auth.uid() is null then raise exception 'Sign in to lock Draft Tournament rosters.'; end if;
  select * into v_tournament from public.tournaments where id = p_tournament_id for update;
  select * into v_event from public.draft_tournament_events where tournament_id = p_tournament_id for update;
  if not found or v_tournament.owner_id <> auth.uid()
     or v_event.phase <> 'roster-review'
     or v_event.roster_locked_at is not null
     or v_event.draft_league_id is null then
    raise exception 'Only the owner can lock completed Draft Tournament rosters.';
  end if;
  if v_event.revision <> p_expected_revision then
    raise exception 'The event changed. Refresh before locking rosters.';
  end if;

  if v_event.draft_type = 'snake' then
    if v_event.draft_session_id is null or not exists (
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
  else
    v_materialized := public.materialize_auction_draft_tournament_rosters(v_event.id);
    if v_materialized <> (
      select count(*) from public.draft_tournament_seats seat
      where seat.event_id = v_event.id and seat.status = 'active'
    ) then
      raise exception 'Not every auction roster was materialized.';
    end if;
  end if;

  if v_event.competition_format = 'swiss' then
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
      jsonb_build_object(
        'roster_size', v_event.roster_size,
        'competition_format', 'swiss',
        'draft_type', v_event.draft_type
      )
    );
    perform public.create_draft_tournament_swiss_round(v_event.id, 1, auth.uid());
    return jsonb_build_object(
      'phase', 'swiss',
      'round_number', 1,
      'competition_format', 'swiss',
      'draft_type', v_event.draft_type
    );
  end if;

  v_bracket := public.build_draft_first_elimination_bracket(v_event.id, auth.uid());
  update public.draft_tournament_events
  set phase = 'bracket',
      roster_locked_at = now(),
      revision = revision + 1,
      updated_at = now()
  where id = v_event.id;
  insert into public.tournament_audit_events(tournament_id, actor_id, kind, payload)
  values (
    p_tournament_id,
    auth.uid(),
    'draft_tournament_rosters_locked',
    jsonb_build_object(
      'roster_size', v_event.roster_size,
      'competition_format', v_event.competition_format,
      'draft_type', v_event.draft_type,
      'match_count', (v_bracket ->> 'match_count')::integer
    )
  );
  return jsonb_build_object(
    'phase', 'bracket',
    'competition_format', v_event.competition_format,
    'draft_type', v_event.draft_type,
    'match_count', (v_bracket ->> 'match_count')::integer
  );
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
  'competition_format', (
    select event.competition_format
    from public.draft_tournament_events event
    where event.tournament_id = tournament.id
  ),
  'draft_type', (
    select event.draft_type
    from public.draft_tournament_events event
    where event.tournament_id = tournament.id
  ),
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

create or replace function public.get_draft_tournament_workspace(p_tournament_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tournament public.tournaments%rowtype;
  v_event public.draft_tournament_events%rowtype;
  v_is_owner boolean;
  v_is_participant boolean;
  v_show_rosters boolean;
begin
  select * into v_tournament from public.tournaments where id = p_tournament_id;
  select * into v_event from public.draft_tournament_events where tournament_id = p_tournament_id;
  if not found or v_tournament.format <> 'draft-tournament'
     or not public.can_view_tournament(p_tournament_id) then
    return null;
  end if;
  v_is_owner := v_tournament.owner_id = auth.uid();
  v_is_participant := exists (
    select 1 from public.tournament_entrants entrant
    where entrant.tournament_id = p_tournament_id and entrant.user_id = auth.uid()
  );
  v_show_rosters := v_event.roster_locked_at is not null and (
    v_is_owner
    or v_is_participant
    or (v_tournament.visibility = 'public' and v_event.publish_rosters)
  );

  return jsonb_build_object(
    'event', jsonb_build_object(
      'id', v_event.id,
      'phase', v_event.phase,
      'revision', v_event.revision,
      'draft_type', v_event.draft_type,
      'competition_format', v_event.competition_format,
      'roster_size', v_event.roster_size,
      'pick_time_limit_minutes', v_event.pick_time_limit_minutes,
      'snake_budget_enabled', v_event.snake_budget_enabled,
      'draft_budget', v_event.draft_budget,
      'auction_nomination_seconds', v_event.auction_nomination_seconds,
      'auction_timer_seconds', v_event.auction_timer_seconds,
      'auction_bid_reset_seconds', v_event.auction_bid_reset_seconds,
      'swiss_round_count', v_event.swiss_round_count,
      'current_swiss_round', v_event.current_swiss_round,
      'top_cut_size', v_event.top_cut_size,
      'publish_rosters', v_event.publish_rosters,
      'field_locked_at', v_event.field_locked_at,
      'draft_started_at', v_event.draft_started_at,
      'roster_locked_at', v_event.roster_locked_at,
      'swiss_completed_at', v_event.swiss_completed_at,
      'completed_at', v_event.completed_at
    ),
    'draft_room', case
      when v_event.draft_league_id is not null and (v_is_owner or v_is_participant)
        then jsonb_build_object(
          'league_id', v_event.draft_league_id,
          'slug', (select league.slug from public.leagues league where league.id = v_event.draft_league_id),
          'phase', v_event.phase
        )
      else null
    end,
    'seats', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', seat.id,
        'entrant_id', seat.entrant_id,
        'status', seat.status,
        'initial_seed', seat.initial_seed,
        'team_key', seat.team_key,
        'is_me', seat.user_id = auth.uid(),
        'checked_in', case
          when v_is_owner or seat.user_id = auth.uid() then entrant.checked_in_at is not null
          else null
        end,
        'roster', case when v_show_rosters then seat.roster_snapshot else null end,
        'roster_hash', case when v_show_rosters then seat.roster_hash else null end
      ) order by seat.initial_seed nulls last, entrant.registered_at)
      from public.draft_tournament_seats seat
      join public.tournament_entrants entrant on entrant.id = seat.entrant_id
      where seat.event_id = v_event.id
    ), '[]'::jsonb),
    'check_in', jsonb_build_object(
      'checked_in_count', (
        select count(*) from public.tournament_entrants entrant
        where entrant.tournament_id = p_tournament_id
          and entrant.status = 'registered'
          and entrant.checked_in_at is not null
      ),
      'my_checked_in_at', (
        select entrant.checked_in_at from public.tournament_entrants entrant
        where entrant.tournament_id = p_tournament_id and entrant.user_id = auth.uid()
      )
    ),
    'rounds', coalesce((
      select jsonb_agg(to_jsonb(round_row) order by round_row.round_number)
      from public.draft_tournament_rounds round_row
      where round_row.event_id = v_event.id
    ), '[]'::jsonb),
    'pairings', coalesce((
      select jsonb_agg(to_jsonb(pairing) order by round_row.round_number, pairing.board_number)
      from public.draft_tournament_pairings pairing
      join public.draft_tournament_rounds round_row on round_row.id = pairing.round_id
      where pairing.event_id = v_event.id
    ), '[]'::jsonb),
    'standings', coalesce((
      select jsonb_agg(to_jsonb(standing) order by round_row.round_number, standing.rank)
      from public.draft_tournament_standing_snapshots standing
      join public.draft_tournament_rounds round_row on round_row.id = standing.round_id
      where standing.event_id = v_event.id
    ), '[]'::jsonb),
    'top_cut', coalesce((
      select jsonb_agg(to_jsonb(entry) order by entry.seed)
      from public.draft_tournament_top_cut_entries entry
      where entry.event_id = v_event.id
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.create_auction_draft_first_tournament(
  text, text, text, integer, integer, text, integer, integer,
  integer, integer, integer, boolean, text
) from public, anon, authenticated, service_role;
grant execute on function public.create_auction_draft_first_tournament(
  text, text, text, integer, integer, text, integer, integer,
  integer, integer, integer, boolean, text
) to authenticated;

revoke all on function public.lock_auction_draft_tournament_field(uuid, bigint)
from public, anon, authenticated, service_role;
grant execute on function public.lock_auction_draft_tournament_field(uuid, bigint)
to authenticated;

revoke all on function public.materialize_auction_draft_tournament_rosters(uuid),
  public.guard_auction_draft_tournament_snapshot(),
  public.sync_auction_draft_tournament_phase(),
  public.build_draft_first_elimination_bracket(uuid, uuid)
from public, anon, authenticated, service_role;
grant execute on function public.materialize_auction_draft_tournament_rosters(uuid),
  public.guard_auction_draft_tournament_snapshot(),
  public.sync_auction_draft_tournament_phase(),
  public.build_draft_first_elimination_bracket(uuid, uuid)
to service_role;

revoke all on function public.lock_draft_tournament_rosters(uuid, bigint)
from public, anon, authenticated, service_role;
grant execute on function public.lock_draft_tournament_rosters(uuid, bigint)
to authenticated;
revoke all on function public.list_tournaments(), public.get_draft_tournament_workspace(uuid)
from public, anon, authenticated, service_role;
grant execute on function public.list_tournaments(), public.get_draft_tournament_workspace(uuid)
to anon, authenticated;
grant execute on function public.list_tournaments(), public.get_draft_tournament_workspace(uuid)
to service_role;

comment on function public.create_auction_draft_first_tournament(
  text, text, text, integer, integer, text, integer, integer,
  integer, integer, integer, boolean, text
) is 'Creates a 4-32 entrant auction Draft Tournament without changing the released 4-16 snake boundary.';
comment on function public.materialize_auction_draft_tournament_rosters(uuid)
is 'Atomically copies completed auction snapshot rosters into the relational roster store before tournament roster lock.';

notify pgrst, 'reload schema';
commit;
