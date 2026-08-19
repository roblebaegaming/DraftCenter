-- Flexible private tournament practice fields.
--
-- Entrant limits remain capacity ceilings. Operators may add clearly labeled,
-- accountless practice entrants before play, but only to permanently private
-- practice events. Existing fixed organizer demos remain unchanged.
begin;

alter table public.tournaments
  add column if not exists is_practice boolean not null default false;
alter table public.tournaments
  drop constraint if exists tournaments_practice_private_check;
alter table public.tournaments
  add constraint tournaments_practice_private_check
  check (not is_practice or visibility = 'private');

comment on column public.tournaments.entrant_limit is
  'Maximum registration capacity, not a required field size. Format-specific technical minimums are checked only when play starts.';
comment on column public.tournaments.is_practice is
  'True when the private event contains operator-created synthetic entrants. Practice status is visible to every authorized viewer.';
comment on column public.tournament_entrants.is_demo_bot is
  'True for an accountless synthetic entrant in either the fixed organizer demo or a flexible private practice event.';

create or replace function public.guard_tournament_synthetic_entrant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_demo_bot and (
    new.user_id is not null
    or not exists (
      select 1
      from public.tournaments tournament
      where tournament.id = new.tournament_id
        and tournament.visibility = 'private'
        and (tournament.is_demo or tournament.is_practice)
    )
  ) then
    raise exception 'Synthetic entrants are limited to private practice tournaments.';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_tournament_synthetic_entrant_trigger on public.tournament_entrants;
create trigger guard_tournament_synthetic_entrant_trigger
before insert or update of tournament_id, user_id, is_demo_bot on public.tournament_entrants
for each row execute function public.guard_tournament_synthetic_entrant();

create or replace function public.add_tournament_practice_entrants(
  p_tournament_id uuid,
  p_expected_revision bigint,
  p_count integer,
  p_label_prefix text default 'Practice Player'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tournament public.tournaments%rowtype;
  v_event public.draft_tournament_events%rowtype;
  v_registered_count integer;
  v_existing_synthetic_count integer;
  v_prefix text := btrim(coalesce(p_label_prefix, ''));
  v_revision bigint;
begin
  if auth.uid() is null then
    raise exception 'Sign in to add practice entrants.';
  end if;
  select * into v_tournament
  from public.tournaments
  where id = p_tournament_id
  for update;
  if not found
     or v_tournament.owner_id <> auth.uid()
     or v_tournament.status <> 'registration'
     or v_tournament.visibility <> 'private'
     or v_tournament.is_demo then
    raise exception 'Practice entrants can be added only by the operator of a private event before play begins.';
  end if;
  if v_tournament.revision <> p_expected_revision then
    raise exception 'The tournament changed. Refresh before editing the practice field.';
  end if;
  if p_count not between 1 and 64 then
    raise exception 'Add between 1 and 64 practice entrants at a time.';
  end if;
  if char_length(v_prefix) not between 1 and 70 then
    raise exception 'Enter a short label for the practice entrants.';
  end if;

  if v_tournament.format = 'draft-tournament' then
    select * into v_event
    from public.draft_tournament_events
    where tournament_id = p_tournament_id
    for update;
    if not found
       or v_event.phase not in ('registration', 'check-in')
       or v_event.field_locked_at is not null
       or exists (
         select 1 from public.draft_tournament_seats seat
         where seat.event_id = v_event.id
       ) then
      raise exception 'Practice entrants cannot be added after a draft field locks.';
    end if;
  elsif exists (
    select 1 from public.tournament_matches bracket_match
    where bracket_match.tournament_id = p_tournament_id
  ) then
    raise exception 'Practice entrants cannot be added after a bracket is created.';
  end if;

  select count(*), count(*) filter (where entrant.is_demo_bot)
  into v_registered_count, v_existing_synthetic_count
  from public.tournament_entrants entrant
  where entrant.tournament_id = p_tournament_id
    and entrant.status = 'registered';
  if v_registered_count + p_count > v_tournament.entrant_limit then
    raise exception 'This tournament has no room for that many practice entrants.';
  end if;

  update public.tournaments
  set is_practice = true,
      revision = revision + 1,
      updated_at = now()
  where id = p_tournament_id
  returning revision into v_revision;

  insert into public.tournament_entrants(
    tournament_id, user_id, registered_team_id, display_name,
    status, checked_in_at, is_demo_bot
  )
  select
    p_tournament_id,
    null,
    null,
    left(v_prefix, 70) || ' ' || lpad((v_existing_synthetic_count + ordinal)::text, 2, '0') || ' · Practice',
    'registered',
    case when v_tournament.format = 'draft-tournament' then now() else null end,
    true
  from generate_series(1, p_count) ordinal;

  insert into public.tournament_audit_events(tournament_id, actor_id, kind, payload)
  values (
    p_tournament_id,
    auth.uid(),
    'tournament_practice_entrants_added',
    jsonb_build_object(
      'synthetic', true,
      'added_count', p_count,
      'registered_count', v_registered_count + p_count,
      'entrant_limit', v_tournament.entrant_limit
    )
  );
  return jsonb_build_object(
    'added_count', p_count,
    'registered_count', v_registered_count + p_count,
    'entrant_limit', v_tournament.entrant_limit,
    'revision', v_revision
  );
end;
$$;

create or replace function public.remove_tournament_practice_entrant(
  p_tournament_id uuid,
  p_entrant_id uuid,
  p_expected_revision bigint
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tournament public.tournaments%rowtype;
  v_event public.draft_tournament_events%rowtype;
  v_revision bigint;
begin
  if auth.uid() is null then
    raise exception 'Sign in to remove a practice entrant.';
  end if;
  select * into v_tournament
  from public.tournaments
  where id = p_tournament_id
  for update;
  if not found
     or v_tournament.owner_id <> auth.uid()
     or v_tournament.status <> 'registration'
     or not v_tournament.is_practice
     or v_tournament.is_demo then
    raise exception 'Only the operator can remove a flexible practice entrant before play begins.';
  end if;
  if v_tournament.revision <> p_expected_revision then
    raise exception 'The tournament changed. Refresh before editing the practice field.';
  end if;
  if v_tournament.format = 'draft-tournament' then
    select * into v_event
    from public.draft_tournament_events
    where tournament_id = p_tournament_id
    for update;
    if not found
       or v_event.phase not in ('registration', 'check-in')
       or v_event.field_locked_at is not null
       or exists (
         select 1 from public.draft_tournament_seats seat
         where seat.event_id = v_event.id
       ) then
      raise exception 'Practice entrants cannot be removed after a draft field locks.';
    end if;
  elsif exists (
    select 1 from public.tournament_matches bracket_match
    where bracket_match.tournament_id = p_tournament_id
  ) then
    raise exception 'Practice entrants cannot be removed after a bracket is created.';
  end if;

  delete from public.tournament_entrants
  where id = p_entrant_id
    and tournament_id = p_tournament_id
    and status = 'registered'
    and is_demo_bot
    and user_id is null;
  if not found then
    raise exception 'Choose a removable practice entrant.';
  end if;

  update public.tournaments
  set is_practice = exists (
        select 1 from public.tournament_entrants entrant
        where entrant.tournament_id = p_tournament_id and entrant.is_demo_bot
      ),
      revision = revision + 1,
      updated_at = now()
  where id = p_tournament_id
  returning revision into v_revision;
  insert into public.tournament_audit_events(tournament_id, actor_id, kind, payload)
  values (
    p_tournament_id,
    auth.uid(),
    'tournament_practice_entrant_removed',
    jsonb_build_object('synthetic', true, 'entrant_id', p_entrant_id)
  );
  return v_revision;
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
set search_path = ''
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
          and code.code_hash = encode(extensions.digest(p_access_code, 'sha256'), 'hex')
      )
    )
  ) then
    return null;
  end if;
  return jsonb_build_object(
    'regulation_id', v_tournament.regulation_id,
    'registration_closes_at', v_tournament.registration_closes_at,
    'check_in_opens_at', v_tournament.check_in_opens_at,
    'starts_at', v_tournament.starts_at,
    'is_practice', v_tournament.is_practice or v_tournament.is_demo,
    'synthetic_entrant_ids', coalesce((
      select jsonb_agg(entrant.id order by entrant.registered_at, entrant.id)
      from public.tournament_entrants entrant
      where entrant.tournament_id = p_tournament_id
        and entrant.is_demo_bot
    ), '[]'::jsonb)
  );
end;
$$;

-- Draft practice bots deliberately have no membership owner so the existing
-- autonomous draft agents can control them. Real seats remain bound to the
-- exact authenticated membership recorded at field lock.
create or replace function public.lock_draft_tournament_field(
  p_tournament_id uuid,
  p_expected_revision bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tournament public.tournaments%rowtype;
  v_event public.draft_tournament_events%rowtype;
  v_count integer;
  v_bot_count integer;
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
     or v_event.draft_type <> 'snake'
     or v_event.phase <> 'check-in'
     or v_event.field_locked_at is not null then
    raise exception 'Only the owner can lock an open snake Draft Tournament field.';
  end if;
  if v_event.revision <> p_expected_revision then
    raise exception 'The event changed. Refresh before locking the field.';
  end if;

  select count(*), count(*) filter (where entrant.is_demo_bot)
  into v_count, v_bot_count
  from public.tournament_entrants entrant
  where entrant.tournament_id = p_tournament_id
    and entrant.status = 'registered'
    and entrant.checked_in_at is not null;
  if v_count not between 4 and 16 or v_count > v_tournament.entrant_limit then
    raise exception 'A snake Draft Tournament needs between 4 and 16 checked-in entrants within its configured capacity.';
  end if;
  if exists (
    select 1 from public.tournament_entrants entrant
    where entrant.tournament_id = p_tournament_id
      and entrant.status = 'registered'
      and entrant.checked_in_at is not null
      and entrant.user_id is null
      and not (
        v_tournament.visibility = 'private'
        and (v_tournament.is_demo or v_tournament.is_practice)
        and entrant.is_demo_bot
      )
  ) then
    raise exception 'Every checked-in entrant must be attached to an account unless it is a private practice bot.';
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

  update public.tournament_entrants set seed = null where tournament_id = p_tournament_id;
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
    case when v_tournament.is_demo or v_tournament.is_practice
      then 'Private synthetic Draft Tournament practice room for ' || v_tournament.name
      else 'Internal Draft Tournament room for ' || v_tournament.name
    end,
    case when v_tournament.is_demo or v_tournament.is_practice then 'Tournament Practice' else 'Draft Tournament' end,
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
    'name', left(entrant.display_name, 80) || ' · Seed ' || seat.initial_seed,
    'claimedBy', case when entrant.is_demo_bot then null else entrant.display_name end,
    'claimedByUserId', case when entrant.is_demo_bot then null else seat.user_id::text end,
    'description', case when entrant.is_demo_bot
      then 'Synthetic practice bot · Seed ' || seat.initial_seed
      else 'Draft Tournament seed ' || seat.initial_seed
    end
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
      'freeAgencyEnabled', false,
      'demoMode', v_tournament.is_demo,
      'practiceMode', v_tournament.is_practice
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
      'swiss_round_count', case when v_count <= 8 then 3 else 4 end,
      'synthetic', v_tournament.is_demo or v_tournament.is_practice,
      'bot_seats', v_bot_count
    )
  );
  return jsonb_build_object(
    'event_id', v_event.id,
    'draft_league_id', v_league_id,
    'phase', 'draft-setup',
    'checked_in_count', v_count,
    'is_practice', v_tournament.is_practice
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
set search_path = ''
as $$
declare
  v_tournament public.tournaments%rowtype;
  v_event public.draft_tournament_events%rowtype;
  v_count integer;
  v_real_count integer;
  v_bot_count integer;
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

  select count(*),
         count(*) filter (where entrant.user_id is not null),
         count(*) filter (where entrant.is_demo_bot)
  into v_count, v_real_count, v_bot_count
  from public.tournament_entrants entrant
  where entrant.tournament_id = p_tournament_id
    and entrant.status = 'registered'
    and entrant.checked_in_at is not null;
  if v_count not between 4 and 32 or v_count > v_tournament.entrant_limit then
    raise exception 'An auction Draft Tournament needs between 4 and 32 checked-in entrants within its configured capacity.';
  end if;
  if exists (
    select 1 from public.tournament_entrants entrant
    where entrant.tournament_id = p_tournament_id
      and entrant.status = 'registered'
      and entrant.checked_in_at is not null
      and entrant.user_id is null
      and not (
        v_tournament.visibility = 'private'
        and (v_tournament.is_demo or v_tournament.is_practice)
        and entrant.is_demo_bot
      )
  ) then
    raise exception 'Every checked-in auction entrant must be attached to an account unless it is a private practice bot.';
  end if;
  if v_tournament.is_demo and (
    v_count <> v_tournament.entrant_limit
    or v_real_count <> 1
    or not exists (
      select 1 from public.tournament_entrants entrant
      where entrant.tournament_id = p_tournament_id
        and entrant.user_id = v_tournament.owner_id
        and entrant.status = 'registered'
        and entrant.checked_in_at is not null
        and not entrant.is_demo_bot
    )
    or exists (
      select 1 from public.tournament_entrants entrant
      where entrant.tournament_id = p_tournament_id
        and entrant.status = 'registered'
        and entrant.checked_in_at is not null
        and entrant.user_id is null
        and not entrant.is_demo_bot
    )
  ) then
    raise exception 'The private organizer demo must contain one owner seat and a complete synthetic bot field.';
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
    case when v_tournament.is_demo or v_tournament.is_practice
      then 'Private synthetic tournament-organizer auction practice room for ' || v_tournament.name
      else 'Internal auction Draft Tournament room for ' || v_tournament.name
    end,
    case when v_tournament.is_demo or v_tournament.is_practice then 'Tournament Practice' else 'Auction Draft Tournament' end,
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
    'name', left(entrant.display_name, 80) || ' · Seed ' || seat.initial_seed,
    'claimedBy', case when entrant.is_demo_bot then null else entrant.display_name end,
    'claimedByUserId', case when entrant.is_demo_bot then null else seat.user_id::text end,
    'description', case when entrant.is_demo_bot
      then 'Synthetic tournament practice bot · Seed ' || seat.initial_seed
      else 'Auction Draft Tournament seed ' || seat.initial_seed
    end
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
      'freeAgencyEnabled', false,
      'demoMode', v_tournament.is_demo,
      'practiceMode', v_tournament.is_practice
    )
  );
  insert into public.league_state_snapshots(league_id, state) values (v_league_id, v_state);

  insert into public.auction_team_owners(league_id, team_index, user_id)
  select v_league_id, seat.team_key, seat.user_id
  from public.draft_tournament_seats seat
  where seat.event_id = v_event.id
    and seat.status = 'active'
    and seat.user_id is not null;

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
      'draft_league_id', v_league_id,
      'synthetic', v_tournament.is_demo or v_tournament.is_practice,
      'bot_seats', v_bot_count
    )
  );
  return jsonb_build_object(
    'event_id', v_event.id,
    'draft_league_id', v_league_id,
    'draft_room_slug', v_league_slug,
    'checked_in_count', v_count,
    'draft_type', 'auction',
    'is_demo', v_tournament.is_demo,
    'is_practice', v_tournament.is_practice
  );
end;
$$;

create or replace function public.enforce_draft_tournament_team_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.draft_tournament_events%rowtype;
  v_is_synthetic_event boolean;
  v_expected_membership uuid;
  v_is_synthetic_bot boolean;
begin
  select * into v_event
  from public.draft_tournament_events
  where draft_league_id = new.league_id;
  if not found then return new; end if;
  if new.source_key !~ '^[0-9]{1,2}$' then
    raise exception 'Draft Tournament team identity is invalid.';
  end if;
  select tournament.is_demo or tournament.is_practice into v_is_synthetic_event
  from public.tournaments tournament
  where tournament.id = v_event.tournament_id;
  select membership.id, entrant.is_demo_bot
  into v_expected_membership, v_is_synthetic_bot
  from public.draft_tournament_seats seat
  join public.tournament_entrants entrant on entrant.id = seat.entrant_id
  left join public.league_memberships membership
    on membership.league_id = v_event.draft_league_id
   and membership.user_id = seat.user_id
  where seat.event_id = v_event.id
    and seat.initial_seed is not null
    and seat.team_key = new.source_key::smallint;
  if not found then
    raise exception 'Draft Tournament team ownership could not be verified.';
  end if;
  if v_is_synthetic_bot then
    if not v_is_synthetic_event or new.owner_membership_id is not null then
      raise exception 'Only an unclaimed private practice bot can omit team ownership.';
    end if;
    new.owner_membership_id := null;
    return new;
  end if;
  if v_expected_membership is null then
    raise exception 'Draft Tournament team ownership could not be verified.';
  end if;
  new.owner_membership_id := v_expected_membership;
  return new;
end;
$$;

create or replace function public.guard_practice_draft_team_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_id uuid;
begin
  select event.id into v_event_id
  from public.draft_tournament_events event
  join public.tournaments tournament on tournament.id = event.tournament_id
  where event.draft_league_id = new.league_id
    and tournament.is_practice;
  if v_event_id is null then return new; end if;

  if exists (
    select 1
    from public.draft_tournament_seats seat
    join public.tournament_entrants entrant on entrant.id = seat.entrant_id
    where seat.event_id = v_event_id
      and seat.status = 'active'
      and (
        (new.state #>> array['teams', seat.team_key::text, 'claimedByUserId'])
          is distinct from case when entrant.is_demo_bot then null else seat.user_id::text end
        or (new.state #>> array['teams', seat.team_key::text, 'claimedBy'])
          is distinct from case when entrant.is_demo_bot then null else entrant.display_name end
      )
  ) then
    raise exception 'Practice bot identities cannot be changed.';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_practice_draft_team_identity_trigger on public.league_state_snapshots;
create trigger guard_practice_draft_team_identity_trigger
before update of state on public.league_state_snapshots
for each row execute function public.guard_practice_draft_team_identity();

create or replace function public.materialize_auction_draft_tournament_rosters(
  p_event_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.draft_tournament_events%rowtype;
  v_is_synthetic_event boolean;
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
  select event.* into v_event
  from public.draft_tournament_events event
  where event.id = p_event_id
    and event.draft_type = 'auction'
    and event.phase = 'roster-review'
  for update;
  if not found or v_event.draft_league_id is null then
    raise exception 'The auction Draft Tournament is not ready to materialize rosters.';
  end if;
  select tournament.is_demo or tournament.is_practice into v_is_synthetic_event
  from public.tournaments tournament
  where tournament.id = v_event.tournament_id;
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
    v_membership_id := null;
    if v_seat.user_id is null then
      if not v_is_synthetic_event or not exists (
        select 1 from public.tournament_entrants entrant
        where entrant.id = v_seat.entrant_id
          and entrant.tournament_id = v_event.tournament_id
          and entrant.is_demo_bot
      ) then
        raise exception 'Only a private practice event can materialize an unclaimed bot roster.';
      end if;
    else
      select membership.id into v_membership_id
      from public.league_memberships membership
      where membership.league_id = v_event.draft_league_id
        and membership.user_id = v_seat.user_id;
      if v_membership_id is null then
        raise exception 'A checked-in entrant is not attached to the expected auction membership.';
      end if;
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
      case when v_seat.user_id is null
        then 'Synthetic private practice roster'
        else 'Locked auction Draft Tournament roster'
      end
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
        roster_hash = encode(extensions.digest(v_roster::text, 'sha256'), 'hex'),
        updated_at = now()
    where id = v_seat.id;
    v_materialized := v_materialized + 1;
  end loop;
  return v_materialized;
end;
$$;

create or replace function public.lock_draft_tournament_rosters(
  p_tournament_id uuid,
  p_expected_revision bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
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
      join public.tournament_entrants entrant on entrant.id = v_seat.entrant_id
      left join public.league_memberships membership on membership.id = team.owner_membership_id
      where team.league_id = v_event.draft_league_id
        and team.source_key = v_seat.team_key::text
        and (
          (
            not entrant.is_demo_bot
            and v_seat.user_id is not null
            and membership.user_id = v_seat.user_id
          )
          or (
            entrant.is_demo_bot
            and v_seat.user_id is null
            and team.owner_membership_id is null
            and v_tournament.visibility = 'private'
            and (v_tournament.is_demo or v_tournament.is_practice)
          )
        );
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
          roster_hash = encode(extensions.digest(v_roster::text, 'sha256'), 'hex'),
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
        'draft_type', v_event.draft_type,
        'synthetic', v_tournament.is_demo or v_tournament.is_practice
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
      'match_count', (v_bracket ->> 'match_count')::integer,
      'synthetic', v_tournament.is_demo or v_tournament.is_practice
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

revoke all on function public.guard_tournament_synthetic_entrant(),
  public.enforce_draft_tournament_team_owner(),
  public.guard_practice_draft_team_identity(),
  public.materialize_auction_draft_tournament_rosters(uuid),
  public.add_tournament_practice_entrants(uuid, bigint, integer, text),
  public.remove_tournament_practice_entrant(uuid, uuid, bigint)
from public, anon, authenticated, service_role;
grant execute on function public.guard_tournament_synthetic_entrant(),
  public.enforce_draft_tournament_team_owner(),
  public.guard_practice_draft_team_identity(),
  public.materialize_auction_draft_tournament_rosters(uuid)
to service_role;
grant execute on function public.add_tournament_practice_entrants(uuid, bigint, integer, text),
  public.remove_tournament_practice_entrant(uuid, uuid, bigint)
to authenticated, service_role;

revoke all on function public.lock_draft_tournament_field(uuid, bigint),
  public.lock_auction_draft_tournament_field(uuid, bigint),
  public.lock_draft_tournament_rosters(uuid, bigint)
from public, anon, authenticated, service_role;
grant execute on function public.lock_draft_tournament_field(uuid, bigint),
  public.lock_auction_draft_tournament_field(uuid, bigint),
  public.lock_draft_tournament_rosters(uuid, bigint)
to authenticated, service_role;

revoke all on function public.get_tournament_operation_details(uuid, text)
from public, anon, authenticated, service_role;
grant execute on function public.get_tournament_operation_details(uuid, text)
to anon, authenticated, service_role;

notify pgrst, 'reload schema';
commit;
