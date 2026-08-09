-- Migration 362: Draft Tournament event foundation.
--
-- A Draft Tournament is one tournament-scoped hosted snake draft followed by
-- Swiss rounds and an optional single-elimination top cut. The existing draft
-- and tournament match engines remain authoritative; these tables bind them
-- together without exposing a second, conflicting source of truth.
begin;

create extension if not exists pgcrypto with schema extensions;

alter table public.tournaments
  drop constraint if exists tournaments_format_check;
alter table public.tournaments
  add constraint tournaments_format_check
  check (format in ('single-elimination', 'double-elimination', 'draft-tournament'));

alter table public.tournament_entrants
  add column if not exists checked_in_at timestamptz;
alter table public.tournament_entrants
  drop constraint if exists tournament_entrants_status_check;
alter table public.tournament_entrants
  add constraint tournament_entrants_status_check
  check (status in ('registered', 'no-show', 'dropped', 'disqualified'));

alter table public.leagues
  add column if not exists workspace_kind text not null default 'league';
alter table public.leagues
  drop constraint if exists leagues_workspace_kind_check;
alter table public.leagues
  add constraint leagues_workspace_kind_check
  check (workspace_kind in ('league', 'draft-tournament'));

alter table public.tournament_matches
  drop constraint if exists tournament_matches_bracket_stage_check;
alter table public.tournament_matches
  add constraint tournament_matches_bracket_stage_check
  check (bracket_stage in ('single', 'winners', 'losers', 'grand-final', 'swiss', 'top-cut'));

create table public.draft_tournament_events (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null unique references public.tournaments(id) on delete cascade,
  draft_league_id uuid unique references public.leagues(id) on delete restrict,
  draft_session_id uuid unique references public.draft_sessions(id) on delete restrict,
  phase text not null default 'registration'
    check (phase in (
      'registration', 'check-in', 'draft-setup', 'drafting',
      'roster-review', 'swiss', 'swiss-complete', 'top-cut',
      'complete', 'cancelled', 'archived'
    )),
  revision bigint not null default 0 check (revision >= 0),
  roster_size smallint not null default 6 check (roster_size between 4 and 12),
  pick_time_limit_minutes smallint not null default 5 check (pick_time_limit_minutes between 0 and 1440),
  snake_budget_enabled boolean not null default false,
  draft_budget integer check (
    (not snake_budget_enabled and draft_budget is null)
    or (snake_budget_enabled and draft_budget between 60 and 1000)
  ),
  swiss_round_count smallint check (swiss_round_count in (3, 4)),
  current_swiss_round smallint not null default 0 check (current_swiss_round between 0 and 4),
  top_cut_size smallint not null default 0 check (top_cut_size in (0, 2, 4, 8)),
  publish_rosters boolean not null default false,
  field_locked_at timestamptz,
  draft_started_at timestamptz,
  roster_locked_at timestamptz,
  swiss_completed_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, tournament_id)
);

create table public.draft_tournament_seats (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null,
  tournament_id uuid not null,
  entrant_id uuid not null,
  user_id uuid references auth.users(id) on delete restrict,
  status text not null check (status in ('active', 'no-show', 'dropped', 'disqualified')),
  initial_seed smallint check (initial_seed between 1 and 16),
  team_key smallint check (team_key between 0 and 15),
  team_id uuid references public.teams(id) on delete restrict,
  roster_snapshot jsonb check (roster_snapshot is null or jsonb_typeof(roster_snapshot) = 'array'),
  roster_hash text check (roster_hash is null or roster_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, entrant_id),
  unique (event_id, user_id),
  unique (event_id, initial_seed),
  unique (event_id, team_key),
  unique (event_id, team_id),
  foreign key (event_id, tournament_id)
    references public.draft_tournament_events(id, tournament_id) on delete cascade,
  foreign key (entrant_id, tournament_id)
    references public.tournament_entrants(id, tournament_id) on delete restrict
);

create table public.draft_tournament_rounds (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null,
  tournament_id uuid not null,
  round_number smallint not null check (round_number between 1 and 4),
  status text not null default 'active' check (status in ('active', 'complete', 'rolled-back')),
  revision bigint not null default 0 check (revision >= 0),
  paired_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (event_id, round_number),
  unique (id, event_id, tournament_id),
  foreign key (event_id, tournament_id)
    references public.draft_tournament_events(id, tournament_id) on delete cascade
);

create table public.draft_tournament_pairings (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null,
  event_id uuid not null,
  tournament_id uuid not null,
  tournament_match_id uuid not null,
  board_number smallint not null check (board_number between 1 and 8),
  entrant_a_id uuid not null,
  entrant_b_id uuid,
  is_bye boolean not null default false,
  created_at timestamptz not null default now(),
  unique (round_id, board_number),
  unique (tournament_match_id),
  check (entrant_a_id is distinct from entrant_b_id),
  check (is_bye = (entrant_b_id is null)),
  foreign key (round_id, event_id, tournament_id)
    references public.draft_tournament_rounds(id, event_id, tournament_id) on delete cascade,
  foreign key (tournament_match_id, tournament_id)
    references public.tournament_matches(id, tournament_id) on delete cascade,
  foreign key (entrant_a_id, tournament_id)
    references public.tournament_entrants(id, tournament_id) on delete restrict,
  foreign key (entrant_b_id, tournament_id)
    references public.tournament_entrants(id, tournament_id) on delete restrict
);

create table public.draft_tournament_standing_snapshots (
  round_id uuid not null,
  event_id uuid not null,
  tournament_id uuid not null,
  entrant_id uuid not null,
  rank smallint not null check (rank between 1 and 16),
  match_wins smallint not null default 0 check (match_wins between 0 and 4),
  match_losses smallint not null default 0 check (match_losses between 0 and 4),
  game_wins smallint not null default 0 check (game_wins between 0 and 12),
  game_losses smallint not null default 0 check (game_losses between 0 and 12),
  bye_count smallint not null default 0 check (bye_count between 0 and 4),
  head_to_head numeric(8, 6) not null default 0.5 check (head_to_head between 0 and 1),
  opponent_match_win_percentage numeric(8, 6) not null default 0 check (opponent_match_win_percentage between 0 and 1),
  game_win_percentage numeric(8, 6) not null default 0 check (game_win_percentage between 0 and 1),
  opponent_game_win_percentage numeric(8, 6) not null default 0 check (opponent_game_win_percentage between 0 and 1),
  opponents uuid[] not null default '{}',
  calculated_at timestamptz not null default now(),
  primary key (round_id, entrant_id),
  unique (round_id, rank),
  foreign key (round_id, event_id, tournament_id)
    references public.draft_tournament_rounds(id, event_id, tournament_id) on delete cascade,
  foreign key (entrant_id, tournament_id)
    references public.tournament_entrants(id, tournament_id) on delete restrict
);

create table public.draft_tournament_top_cut_entries (
  event_id uuid not null,
  tournament_id uuid not null,
  entrant_id uuid not null,
  seed smallint not null check (seed between 1 and 8),
  created_at timestamptz not null default now(),
  primary key (event_id, entrant_id),
  unique (event_id, seed),
  foreign key (event_id, tournament_id)
    references public.draft_tournament_events(id, tournament_id) on delete cascade,
  foreign key (entrant_id, tournament_id)
    references public.tournament_entrants(id, tournament_id) on delete restrict
);

create index draft_tournament_events_phase_idx
  on public.draft_tournament_events(phase, updated_at desc);
create index draft_tournament_seats_event_status_idx
  on public.draft_tournament_seats(event_id, status, initial_seed);
create index draft_tournament_rounds_event_idx
  on public.draft_tournament_rounds(event_id, round_number);
create index draft_tournament_pairings_round_idx
  on public.draft_tournament_pairings(round_id, board_number);
create index draft_tournament_standings_event_idx
  on public.draft_tournament_standing_snapshots(event_id, round_id, rank);

alter table public.draft_tournament_events enable row level security;
alter table public.draft_tournament_seats enable row level security;
alter table public.draft_tournament_rounds enable row level security;
alter table public.draft_tournament_pairings enable row level security;
alter table public.draft_tournament_standing_snapshots enable row level security;
alter table public.draft_tournament_top_cut_entries enable row level security;

revoke all on
  public.draft_tournament_events,
  public.draft_tournament_seats,
  public.draft_tournament_rounds,
  public.draft_tournament_pairings,
  public.draft_tournament_standing_snapshots,
  public.draft_tournament_top_cut_entries
from public, anon, authenticated;
grant all on
  public.draft_tournament_events,
  public.draft_tournament_seats,
  public.draft_tournament_rounds,
  public.draft_tournament_pairings,
  public.draft_tournament_standing_snapshots,
  public.draft_tournament_top_cut_entries
to service_role;

create or replace function public.create_draft_tournament(
  p_name text,
  p_description text default '',
  p_visibility text default 'public',
  p_best_of integer default 3,
  p_entrant_limit integer default 16,
  p_rules text default '',
  p_roster_size integer default 6,
  p_pick_time_limit_minutes integer default 5,
  p_top_cut_size integer default 0,
  p_snake_budget_enabled boolean default false,
  p_draft_budget integer default null,
  p_publish_rosters boolean default false
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
  if auth.uid() is null then raise exception 'Sign in to create a Draft Tournament.'; end if;
  if char_length(v_name) not between 2 and 120
     or coalesce(p_visibility, '') not in ('public', 'private')
     or p_best_of not in (1, 3)
     or p_entrant_limit not between 4 and 16
     or p_roster_size not between 4 and 12
     or p_pick_time_limit_minutes not between 0 and 1440
     or p_top_cut_size not in (0, 2, 4, 8)
     or p_top_cut_size > p_entrant_limit
     or (coalesce(p_snake_budget_enabled, false) and coalesce(p_draft_budget, 0) not between 60 and 1000)
     or (not coalesce(p_snake_budget_enabled, false) and p_draft_budget is not null)
     or char_length(coalesce(p_description, '')) > 2000
     or char_length(coalesce(p_rules, '')) > 10000 then
    raise exception 'Draft Tournament settings are invalid.';
  end if;

  v_slug_base := left(trim(both '-' from regexp_replace(lower(v_name), '[^a-z0-9]+', '-', 'g')), 60);
  if v_slug_base = '' then v_slug_base := 'draft-tournament'; end if;
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
    tournament_id, roster_size, pick_time_limit_minutes, snake_budget_enabled, draft_budget,
    top_cut_size, publish_rosters
  ) values (
    v_tournament_id, p_roster_size, p_pick_time_limit_minutes, coalesce(p_snake_budget_enabled, false),
    case when coalesce(p_snake_budget_enabled, false) then p_draft_budget else null end,
    p_top_cut_size,
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
      'roster_size', p_roster_size,
      'pick_time_limit_minutes', p_pick_time_limit_minutes,
      'top_cut_size', p_top_cut_size,
      'draft_type', 'snake'
    )
  );

  return jsonb_build_object(
    'tournament_id', v_tournament_id,
    'event_id', v_event_id,
    'slug', v_slug,
    'registration_code', v_code
  );
end;
$$;

create or replace function public.open_draft_tournament_check_in(
  p_tournament_id uuid,
  p_expected_revision bigint
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tournament public.tournaments%rowtype;
  v_event public.draft_tournament_events%rowtype;
begin
  if auth.uid() is null then raise exception 'Sign in to open check-in.'; end if;
  select * into v_tournament from public.tournaments where id = p_tournament_id for update;
  select * into v_event from public.draft_tournament_events where tournament_id = p_tournament_id for update;
  if not found or v_tournament.owner_id <> auth.uid()
     or v_tournament.format <> 'draft-tournament'
     or v_tournament.status <> 'registration'
     or v_event.phase <> 'registration' then
    raise exception 'Only the owner can open Draft Tournament check-in.';
  end if;
  if v_event.revision <> p_expected_revision then
    raise exception 'The event changed. Refresh before opening check-in.';
  end if;

  update public.draft_tournament_events
  set phase = 'check-in', revision = revision + 1, updated_at = now()
  where id = v_event.id
  returning revision into p_expected_revision;
  update public.tournaments
  set revision = revision + 1, updated_at = now()
  where id = p_tournament_id;
  insert into public.tournament_audit_events(tournament_id, actor_id, kind)
  values (p_tournament_id, auth.uid(), 'draft_tournament_check_in_opened');
  return p_expected_revision;
end;
$$;

create or replace function public.set_draft_tournament_check_in(
  p_tournament_id uuid,
  p_checked_in boolean
)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.draft_tournament_events%rowtype;
  v_checked_in_at timestamptz;
begin
  if auth.uid() is null then raise exception 'Sign in to check in.'; end if;
  select event.* into v_event
  from public.draft_tournament_events event
  join public.tournaments tournament on tournament.id = event.tournament_id
  where event.tournament_id = p_tournament_id
    and tournament.status = 'registration'
  for update of event;
  if not found or v_event.phase <> 'check-in' then
    raise exception 'Check-in is not open.';
  end if;

  update public.tournament_entrants
  set checked_in_at = case when coalesce(p_checked_in, false) then now() else null end
  where tournament_id = p_tournament_id
    and user_id = auth.uid()
    and status = 'registered'
  returning checked_in_at into v_checked_in_at;
  if not found then raise exception 'Only a registered entrant can check in.'; end if;

  update public.draft_tournament_events
  set revision = revision + 1, updated_at = now()
  where id = v_event.id;
  update public.tournaments
  set revision = revision + 1, updated_at = now()
  where id = p_tournament_id;
  insert into public.tournament_audit_events(tournament_id, actor_id, kind, payload)
  values (
    p_tournament_id,
    auth.uid(),
    case when coalesce(p_checked_in, false) then 'draft_tournament_checked_in' else 'draft_tournament_check_in_withdrawn' end,
    '{}'::jsonb
  );
  return v_checked_in_at;
end;
$$;

create or replace function public.lock_draft_tournament_field(
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
  if auth.uid() is null then raise exception 'Sign in to lock the event field.'; end if;
  select * into v_tournament from public.tournaments where id = p_tournament_id for update;
  select * into v_event from public.draft_tournament_events where tournament_id = p_tournament_id for update;
  if not found or v_tournament.owner_id <> auth.uid()
     or v_tournament.format <> 'draft-tournament'
     or v_tournament.status <> 'registration'
     or v_event.phase <> 'check-in'
     or v_event.field_locked_at is not null then
    raise exception 'Only the owner can lock an open Draft Tournament field.';
  end if;
  if v_event.revision <> p_expected_revision then
    raise exception 'The event changed. Refresh before locking the field.';
  end if;

  select count(*) into v_count
  from public.tournament_entrants
  where tournament_id = p_tournament_id
    and status = 'registered'
    and checked_in_at is not null;
  if v_count not between 4 and 16 then
    raise exception 'A Draft Tournament needs between 4 and 16 checked-in entrants.';
  end if;
  if v_event.top_cut_size > v_count then
    raise exception 'The checked-in field is smaller than the configured top cut.';
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

  update public.tournament_entrants
  set seed = null
  where tournament_id = p_tournament_id;
  update public.tournament_entrants entrant
  set seed = seat.initial_seed
  from public.draft_tournament_seats seat
  where seat.event_id = v_event.id
    and seat.entrant_id = entrant.id
    and seat.status = 'active';

  v_league_slug := 'draft-event-' || left(replace(p_tournament_id::text, '-', ''), 24);
  insert into public.leagues(
    id, name, slug, description, season_label, created_by,
    is_public, league_visibility, workspace_kind
  ) values (
    v_league_id,
    left(v_tournament.name || ' Draft Room', 120),
    v_league_slug,
    'Internal Draft Tournament room for ' || v_tournament.name,
    'Draft Tournament',
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
    and seat.user_id is not null
    and seat.user_id <> v_tournament.owner_id
  on conflict (league_id, user_id) do update
  set role = case
    when public.league_memberships.role in ('commissioner', 'co_commissioner')
      then public.league_memberships.role
    else 'coach'
  end;

  select jsonb_agg(jsonb_build_object(
    'id', seat.team_key,
    'name', entrant.display_name,
    'claimedBy', entrant.display_name,
    'claimedByUserId', seat.user_id::text,
    'description', 'Draft Tournament seed ' || seat.initial_seed
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
      'draftType', 'snake',
      'rosterSize', v_event.roster_size,
      'rosterMin', v_event.roster_size,
      'rosterMax', v_event.roster_size,
      'pickTimeLimitMinutes', v_event.pick_time_limit_minutes,
      'snakeBudgetEnabled', v_event.snake_budget_enabled,
      'budget', v_event.draft_budget,
      'manualDraftOrder', (
        select jsonb_agg(team_index order by team_index)
        from generate_series(0, v_count - 1) team_index
      ),
      'publicLeague', false,
      'overnightPauseEnabled', false,
      'keepersEnabled', false,
      'tradesEnabled', false,
      'freeAgencyEnabled', false
    )
  );
  insert into public.league_state_snapshots(league_id, state)
  values (v_league_id, v_state);

  update public.draft_tournament_events
  set draft_league_id = v_league_id,
      phase = 'draft-setup',
      swiss_round_count = case when v_count <= 8 then 3 else 4 end,
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
      'draft_league_id', v_league_id,
      'swiss_round_count', case when v_count <= 8 then 3 else 4 end
    )
  );
  return jsonb_build_object(
    'event_id', v_event.id,
    'draft_league_id', v_league_id,
    'phase', 'draft-setup',
    'checked_in_count', v_count
  );
end;
$$;

-- A Draft Tournament team is always owned by the exact account recorded in
-- its event seat. Display names are never used as an ownership authority.
create or replace function public.enforce_draft_tournament_team_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.draft_tournament_events%rowtype;
  v_expected_membership uuid;
begin
  select * into v_event
  from public.draft_tournament_events
  where draft_league_id = new.league_id;
  if not found then return new; end if;
  if new.source_key !~ '^[0-9]{1,2}$' then
    raise exception 'Draft Tournament team identity is invalid.';
  end if;
  select membership.id into v_expected_membership
  from public.draft_tournament_seats seat
  join public.league_memberships membership
    on membership.league_id = v_event.draft_league_id
   and membership.user_id = seat.user_id
  where seat.event_id = v_event.id
    and seat.initial_seed is not null
    and seat.team_key = new.source_key::smallint;
  if v_expected_membership is null then
    raise exception 'Draft Tournament team ownership could not be verified.';
  end if;
  new.owner_membership_id := v_expected_membership;
  return new;
end;
$$;

drop trigger if exists enforce_draft_tournament_team_owner_trigger on public.teams;
create trigger enforce_draft_tournament_team_owner_trigger
before insert or update of league_id, source_key, owner_membership_id on public.teams
for each row execute function public.enforce_draft_tournament_team_owner();

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
  if not found then return new; end if;

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
           or coalesce(new.state #>> array['teams', seat.team_key::text, 'name'], '') <> entrant.display_name
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

drop trigger if exists guard_draft_tournament_snapshot_trigger on public.league_state_snapshots;
create trigger guard_draft_tournament_snapshot_trigger
before update of state on public.league_state_snapshots
for each row execute function public.guard_draft_tournament_snapshot();

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
  if not found then return new; end if;
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

drop trigger if exists guard_draft_tournament_league_settings_trigger on public.leagues;
create trigger guard_draft_tournament_league_settings_trigger
before update of settings on public.leagues
for each row execute function public.guard_draft_tournament_league_settings();

create or replace function public.guard_draft_tournament_roster_entries()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_id uuid := coalesce(new.team_id, old.team_id);
begin
  if exists (
    select 1
    from public.teams team
    join public.draft_tournament_events event on event.draft_league_id = team.league_id
    where team.id = v_team_id and event.roster_locked_at is not null
  ) then
    raise exception 'Draft Tournament rosters are locked.';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists guard_draft_tournament_roster_entries_trigger on public.roster_entries;
create trigger guard_draft_tournament_roster_entries_trigger
before insert or update or delete on public.roster_entries
for each row execute function public.guard_draft_tournament_roster_entries();

create or replace function public.guard_draft_tournament_session()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.mode <> 'snake' and exists (
    select 1 from public.draft_tournament_events event
    where event.draft_league_id = new.league_id
  ) then
    raise exception 'The first Draft Tournament release supports snake drafts only.';
  end if;
  if exists (
    select 1
    from public.draft_tournament_events event
    where event.draft_league_id = new.league_id
      and (
        event.phase <> 'draft-setup'
        or exists (
          select 1
          from public.roster_entries entry
          join public.teams team on team.id = entry.team_id
          where team.league_id = new.league_id and entry.released_at is null
        )
      )
  ) then
    raise exception 'Draft Tournament drafts cannot use keepers or be provisioned more than once.';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_draft_tournament_session_trigger on public.draft_sessions;
create trigger guard_draft_tournament_session_trigger
before insert or update of mode on public.draft_sessions
for each row execute function public.guard_draft_tournament_session();

create or replace function public.sync_draft_tournament_session_phase()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.draft_tournament_events%rowtype;
  v_next_phase text;
begin
  select * into v_event
  from public.draft_tournament_events
  where draft_league_id = new.league_id
  for update;
  if not found then return new; end if;
  if tg_op = 'INSERT' and new.status in ('active', 'paused') then
    v_next_phase := 'drafting';
  elsif new.status = 'complete' then
    v_next_phase := 'roster-review';
  else
    return new;
  end if;
  if tg_op = 'INSERT' then
    delete from public.league_memberships membership
    where membership.league_id = v_event.draft_league_id
      and membership.role = 'coach'
      and not exists (
          select 1 from public.draft_tournament_seats seat
          where seat.event_id = v_event.id
          and seat.initial_seed is not null
          and seat.user_id = membership.user_id
      );
  end if;
  update public.draft_tournament_events
  set draft_session_id = new.id,
      phase = v_next_phase,
      draft_started_at = coalesce(draft_started_at, now()),
      revision = revision + 1,
      updated_at = now()
  where id = v_event.id
    and phase in ('draft-setup', 'drafting', 'roster-review');
  if found then
    insert into public.tournament_audit_events(tournament_id, actor_id, kind, payload)
    values (
      v_event.tournament_id,
      auth.uid(),
      case when v_next_phase = 'drafting' then 'draft_tournament_draft_started' else 'draft_tournament_draft_completed' end,
      jsonb_build_object('draft_session_id', new.id)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists sync_draft_tournament_session_phase_trigger on public.draft_sessions;
create trigger sync_draft_tournament_session_phase_trigger
after insert or update of status on public.draft_sessions
for each row execute function public.sync_draft_tournament_session_phase();

create or replace function public.guard_locked_draft_tournament_entrant_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.draft_tournament_events event
    where event.tournament_id = new.tournament_id
  ) and new.registered_team_id is not null then
    raise exception 'Draft Tournament rosters are created in the shared event draft.';
  end if;
  if exists (
    select 1 from public.draft_tournament_events event
    where event.tournament_id = new.tournament_id and event.field_locked_at is not null
  ) then
    raise exception 'Late entry is not allowed after the Draft Tournament field locks.';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_locked_draft_tournament_entrant_insert_trigger on public.tournament_entrants;
create trigger guard_locked_draft_tournament_entrant_insert_trigger
before insert on public.tournament_entrants
for each row execute function public.guard_locked_draft_tournament_entrant_insert();

create or replace function public.guard_locked_draft_tournament_entrant_identity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.draft_tournament_events event
    where event.tournament_id = new.tournament_id and event.field_locked_at is not null
  ) then
    raise exception 'Draft Tournament entrant identities lock with the field.';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_locked_draft_tournament_entrant_identity_trigger on public.tournament_entrants;
create trigger guard_locked_draft_tournament_entrant_identity_trigger
before update of user_id, display_name, registered_team_id on public.tournament_entrants
for each row execute function public.guard_locked_draft_tournament_entrant_identity();

create or replace function public.sync_draft_tournament_seat_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status and new.status in ('dropped', 'disqualified') then
    update public.draft_tournament_seats
    set status = new.status, updated_at = now()
    where tournament_id = new.tournament_id and entrant_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_draft_tournament_seat_status_trigger on public.tournament_entrants;
create trigger sync_draft_tournament_seat_status_trigger
after update of status on public.tournament_entrants
for each row execute function public.sync_draft_tournament_seat_status();

-- A Draft Tournament owns its private draft room. Deleting the tournament
-- cascades through the event, then this trigger removes the otherwise hidden
-- internal league and every league-scoped draft record.
create or replace function public.cleanup_draft_tournament_league()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.draft_league_id is not null then
    delete from public.leagues
    where id = old.draft_league_id
      and workspace_kind = 'draft-tournament';
  end if;
  return old;
end;
$$;

drop trigger if exists cleanup_draft_tournament_league_trigger on public.draft_tournament_events;
create trigger cleanup_draft_tournament_league_trigger
after delete on public.draft_tournament_events
for each row execute function public.cleanup_draft_tournament_league();

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
      'roster_size', v_event.roster_size,
      'pick_time_limit_minutes', v_event.pick_time_limit_minutes,
      'snake_budget_enabled', v_event.snake_budget_enabled,
      'draft_budget', v_event.draft_budget,
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

revoke all on function public.create_draft_tournament(text, text, text, integer, integer, text, integer, integer, integer, boolean, integer, boolean),
  public.open_draft_tournament_check_in(uuid, bigint),
  public.set_draft_tournament_check_in(uuid, boolean),
  public.lock_draft_tournament_field(uuid, bigint),
  public.get_draft_tournament_workspace(uuid)
from public, anon, authenticated;
grant execute on function public.create_draft_tournament(text, text, text, integer, integer, text, integer, integer, integer, boolean, integer, boolean),
  public.open_draft_tournament_check_in(uuid, bigint),
  public.set_draft_tournament_check_in(uuid, boolean),
  public.lock_draft_tournament_field(uuid, bigint)
to authenticated;
grant execute on function public.get_draft_tournament_workspace(uuid)
to anon, authenticated;

revoke all on function public.enforce_draft_tournament_team_owner(),
  public.guard_draft_tournament_snapshot(),
  public.guard_draft_tournament_league_settings(),
  public.guard_draft_tournament_roster_entries(),
  public.guard_draft_tournament_session(),
  public.sync_draft_tournament_session_phase(),
  public.guard_locked_draft_tournament_entrant_insert(),
  public.guard_locked_draft_tournament_entrant_identity(),
  public.sync_draft_tournament_seat_status(),
  public.cleanup_draft_tournament_league()
from public, anon, authenticated;
grant execute on function public.enforce_draft_tournament_team_owner(),
  public.guard_draft_tournament_snapshot(),
  public.guard_draft_tournament_league_settings(),
  public.guard_draft_tournament_roster_entries(),
  public.guard_draft_tournament_session(),
  public.sync_draft_tournament_session_phase(),
  public.guard_locked_draft_tournament_entrant_insert(),
  public.guard_locked_draft_tournament_entrant_identity(),
  public.sync_draft_tournament_seat_status(),
  public.cleanup_draft_tournament_league()
to service_role;

notify pgrst, 'reload schema';
commit;
