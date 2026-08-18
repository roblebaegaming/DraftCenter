-- Migration 439: private tournament-organizer demo mode.
--
-- Demo events use one real commissioner account plus synthetic bot entrants.
-- They are permanently private and visibly marked so their generated rosters,
-- pairings, standings, and results cannot be mistaken for real competition.
begin;

create extension if not exists pgcrypto with schema extensions;

alter table public.tournaments
  add column if not exists is_demo boolean not null default false;
alter table public.tournaments
  drop constraint if exists tournaments_demo_private_check;
alter table public.tournaments
  add constraint tournaments_demo_private_check
  check (not is_demo or visibility = 'private');

alter table public.tournament_entrants
  add column if not exists is_demo_bot boolean not null default false;
alter table public.tournament_entrants
  drop constraint if exists tournament_entrants_demo_bot_check;
alter table public.tournament_entrants
  add constraint tournament_entrants_demo_bot_check
  check (not is_demo_bot or user_id is null);

create or replace function public.enable_tournament_demo(
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
  v_owner_entrant_id uuid;
  v_owner_count integer;
  v_total_count integer;
begin
  if auth.uid() is null then
    raise exception 'Sign in to enable the organizer demo.';
  end if;

  select * into v_tournament
  from public.tournaments
  where id = p_tournament_id
  for update;
  select * into v_event
  from public.draft_tournament_events
  where tournament_id = p_tournament_id
  for update;

  if not found
     or v_tournament.owner_id <> auth.uid()
     or v_tournament.visibility <> 'private'
     or v_tournament.format <> 'draft-tournament'
     or v_tournament.status <> 'registration'
     or v_tournament.is_demo
     or v_event.draft_type <> 'auction'
     or v_event.competition_format <> 'swiss'
     or v_event.phase <> 'registration'
     or v_event.field_locked_at is not null
     or exists (
       select 1 from public.draft_tournament_seats seat
       where seat.event_id = v_event.id
     )
     or exists (
       select 1 from public.tournament_matches bracket_match
       where bracket_match.tournament_id = p_tournament_id
     ) then
    raise exception 'Only an untouched private auction Swiss event can become an organizer demo.';
  end if;
  if v_tournament.revision <> p_expected_revision then
    raise exception 'The tournament changed. Refresh before enabling the organizer demo.';
  end if;

  select count(*),
         count(*) filter (where entrant.user_id = v_tournament.owner_id)
  into v_total_count, v_owner_count
  from public.tournament_entrants entrant
  where entrant.tournament_id = p_tournament_id
    and entrant.status = 'registered';
  select entrant.id into v_owner_entrant_id
  from public.tournament_entrants entrant
  where entrant.tournament_id = p_tournament_id
    and entrant.status = 'registered'
    and entrant.user_id = v_tournament.owner_id;
  if v_total_count <> 1 or v_owner_count <> 1 or v_owner_entrant_id is null then
    raise exception 'The organizer demo needs exactly one registered owner before bot seats are added.';
  end if;

  update public.tournaments
  set is_demo = true,
      revision = revision + 1,
      updated_at = now()
  where id = p_tournament_id;

  update public.tournament_entrants
  set seed = 1,
      checked_in_at = now(),
      is_demo_bot = false
  where id = v_owner_entrant_id;

  insert into public.tournament_entrants(
    tournament_id, user_id, registered_team_id, display_name,
    seed, status, checked_in_at, is_demo_bot
  )
  select
    p_tournament_id,
    null,
    null,
    'Demo Coach ' || lpad(seed_number::text, 2, '0') || ' · Bot',
    seed_number,
    'registered',
    now(),
    true
  from generate_series(2, v_tournament.entrant_limit) seed_number;

  update public.draft_tournament_events
  set phase = 'check-in',
      revision = revision + 1,
      updated_at = now()
  where id = v_event.id;

  insert into public.tournament_audit_events(tournament_id, actor_id, kind, payload)
  values (
    p_tournament_id,
    auth.uid(),
    'tournament_demo_enabled',
    jsonb_build_object(
      'synthetic', true,
      'real_accounts', 1,
      'bot_entrants', v_tournament.entrant_limit - 1,
      'entrant_limit', v_tournament.entrant_limit
    )
  );

  return jsonb_build_object(
    'is_demo', true,
    'phase', 'check-in',
    'entrant_count', v_tournament.entrant_limit,
    'bot_count', v_tournament.entrant_limit - 1
  );
end;
$$;

create or replace function public.create_demo_auction_draft_first_tournament(
  p_name text,
  p_description text default '',
  p_visibility text default 'private',
  p_best_of integer default 3,
  p_entrant_limit integer default 32,
  p_rules text default '',
  p_roster_size integer default 4,
  p_draft_budget integer default 120,
  p_auction_nomination_seconds integer default 30,
  p_auction_timer_seconds integer default 30,
  p_auction_bid_reset_seconds integer default 10,
  p_publish_rosters boolean default false,
  p_competition_format text default 'swiss'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_created jsonb;
  v_tournament_id uuid;
  v_owner_name text;
begin
  if auth.uid() is null then
    raise exception 'Sign in to create an organizer demo.';
  end if;
  if p_visibility <> 'private'
     or p_competition_format <> 'swiss'
     or p_entrant_limit <> 32
     or coalesce(p_publish_rosters, false) then
    raise exception 'Organizer demos are private 32-seat Swiss events with unpublished rosters.';
  end if;

  v_created := public.create_auction_draft_first_tournament(
    p_name,
    p_description,
    'private',
    p_best_of,
    32,
    p_rules,
    p_roster_size,
    p_draft_budget,
    p_auction_nomination_seconds,
    p_auction_timer_seconds,
    p_auction_bid_reset_seconds,
    false,
    'swiss'
  );
  v_tournament_id := (v_created ->> 'tournament_id')::uuid;
  select coalesce(nullif(btrim(profile.display_name), ''), 'Commissioner')
  into v_owner_name
  from public.profiles profile
  where profile.id = auth.uid();
  v_owner_name := coalesce(v_owner_name, 'Commissioner');

  insert into public.tournament_entrants(
    tournament_id, user_id, display_name, status
  ) values (
    v_tournament_id, auth.uid(), left(v_owner_name, 100), 'registered'
  );

  perform public.enable_tournament_demo(v_tournament_id, 0);
  return v_created || jsonb_build_object(
    'is_demo', true,
    'bot_count', 31
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
  v_real_count integer;
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

  select count(*), count(*) filter (where entrant.user_id is not null)
  into v_count, v_real_count
  from public.tournament_entrants entrant
  where entrant.tournament_id = p_tournament_id
    and entrant.status = 'registered'
    and entrant.checked_in_at is not null;
  if v_count not between 4 and 32 or v_count > v_tournament.entrant_limit then
    raise exception 'An auction Draft Tournament needs between 4 and 32 checked-in entrants within its configured limit.';
  end if;
  if exists (
    select 1 from public.tournament_entrants entrant
    where entrant.tournament_id = p_tournament_id
      and entrant.status = 'registered'
      and entrant.checked_in_at is not null
      and entrant.user_id is null
      and not (v_tournament.is_demo and entrant.is_demo_bot)
  ) then
    raise exception 'Every checked-in auction entrant must be attached to an account unless it is a private demo bot.';
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
    case when v_tournament.is_demo
      then 'Private synthetic tournament-organizer auction sandbox for ' || v_tournament.name
      else 'Internal auction Draft Tournament room for ' || v_tournament.name
    end,
    case when v_tournament.is_demo then 'Organizer Demo' else 'Auction Draft Tournament' end,
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
      then 'Synthetic organizer demo bot · Seed ' || seat.initial_seed
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
      'demoMode', v_tournament.is_demo
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
      'synthetic', v_tournament.is_demo,
      'bot_seats', case when v_tournament.is_demo then v_count - v_real_count else 0 end
    )
  );
  return jsonb_build_object(
    'event_id', v_event.id,
    'draft_league_id', v_league_id,
    'draft_room_slug', v_league_slug,
    'checked_in_count', v_count,
    'draft_type', 'auction',
    'is_demo', v_tournament.is_demo
  );
end;
$$;

create or replace function public.guard_demo_auction_team_identity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
begin
  select event.id into v_event_id
  from public.draft_tournament_events event
  join public.tournaments tournament on tournament.id = event.tournament_id
  where event.draft_league_id = new.league_id
    and event.draft_type = 'auction'
    and tournament.is_demo;
  if v_event_id is null then return new; end if;

  if exists (
    select 1
    from public.draft_tournament_seats seat
    join public.tournament_entrants entrant on entrant.id = seat.entrant_id
    where seat.event_id = v_event_id
      and seat.status = 'active'
      and (
        (new.state #>> array['teams', seat.team_key::text, 'name'])
          is distinct from left(entrant.display_name, 80) || ' · Seed ' || seat.initial_seed
        or (new.state #>> array['teams', seat.team_key::text, 'claimedByUserId'])
          is distinct from case when entrant.is_demo_bot then null else seat.user_id::text end
        or (new.state #>> array['teams', seat.team_key::text, 'claimedBy'])
          is distinct from case when entrant.is_demo_bot then null else entrant.display_name end
      )
  ) then
    raise exception 'Organizer demo bot identities cannot be changed.';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_demo_auction_team_identity_trigger on public.league_state_snapshots;
create trigger guard_demo_auction_team_identity_trigger
before update of state on public.league_state_snapshots
for each row execute function public.guard_demo_auction_team_identity();

create or replace function public.enforce_draft_tournament_team_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.draft_tournament_events%rowtype;
  v_is_demo boolean;
  v_expected_membership uuid;
  v_is_demo_bot boolean;
begin
  select * into v_event
  from public.draft_tournament_events
  where draft_league_id = new.league_id;
  if not found then return new; end if;
  if new.source_key !~ '^[0-9]{1,2}$' then
    raise exception 'Draft Tournament team identity is invalid.';
  end if;
  select tournament.is_demo into v_is_demo
  from public.tournaments tournament
  where tournament.id = v_event.tournament_id;
  select membership.id, entrant.is_demo_bot
  into v_expected_membership, v_is_demo_bot
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
  if v_is_demo_bot then
    if not v_is_demo or new.owner_membership_id is not null then
      raise exception 'Only an unclaimed private organizer demo bot can omit team ownership.';
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
  v_is_demo boolean;
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
  select tournament.is_demo into v_is_demo
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
      if not v_is_demo or not exists (
        select 1 from public.tournament_entrants entrant
        where entrant.id = v_seat.entrant_id
          and entrant.tournament_id = v_event.tournament_id
          and entrant.is_demo_bot
      ) then
        raise exception 'Only a private organizer demo can materialize an unclaimed bot roster.';
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
        then 'Synthetic organizer demo roster'
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
        roster_hash = encode(digest(v_roster::text, 'sha256'), 'hex'),
        updated_at = now()
    where id = v_seat.id;
    v_materialized := v_materialized + 1;
  end loop;
  return v_materialized;
end;
$$;

create or replace function public.fill_tournament_demo_auction(
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
  v_state jsonb;
  v_pool jsonb;
  v_rosters jsonb := '[]'::jsonb;
  v_empty_rosters jsonb;
  v_roster jsonb;
  v_budgets jsonb;
  v_start_budgets jsonb;
  v_order jsonb;
  v_team_count integer;
  v_required integer;
  v_team_index integer;
begin
  if auth.uid() is null then raise exception 'Sign in to generate the demo auction.'; end if;
  select * into v_tournament from public.tournaments where id = p_tournament_id for update;
  select * into v_event from public.draft_tournament_events where tournament_id = p_tournament_id for update;
  if not found
     or v_tournament.owner_id <> auth.uid()
     or not v_tournament.is_demo
     or v_tournament.visibility <> 'private'
     or v_event.draft_type <> 'auction'
     or v_event.phase not in ('draft-setup', 'drafting')
     or v_event.draft_league_id is null then
    raise exception 'Only the owner can generate a private demo auction before roster review.';
  end if;
  if v_event.revision <> p_expected_revision then
    raise exception 'The demo changed. Refresh before generating the auction.';
  end if;

  select count(*) into v_team_count
  from public.draft_tournament_seats seat
  where seat.event_id = v_event.id and seat.status = 'active';
  v_required := v_team_count * v_event.roster_size;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', picked.id,
    'name', picked.display_name,
    'cost', 1,
    't1', picked.primary_type,
    't2', picked.secondary_type,
    'bst', picked.base_stat_total,
    'spriteUrl', picked.sprite_url,
    'isMega', picked.is_mega,
    'isRestricted', picked.is_restricted,
    'acquiredVia', 'demo-auction'
  ) order by picked.demo_order), '[]'::jsonb)
  into v_pool
  from (
    select catalogue.*,
      row_number() over (
        order by md5(v_event.id::text || ':' || catalogue.id), catalogue.id
      ) as demo_order
    from public.pokemon_catalogue catalogue
    where not catalogue.is_mega and not catalogue.is_restricted
    order by md5(v_event.id::text || ':' || catalogue.id), catalogue.id
    limit v_required
  ) picked;
  if jsonb_array_length(v_pool) <> v_required then
    raise exception 'The Pokemon catalogue does not contain the % unique entries needed for this demo.', v_required;
  end if;

  select jsonb_agg('[]'::jsonb order by team_index)
  into v_empty_rosters
  from generate_series(0, v_team_count - 1) team_index;
  select jsonb_agg(v_event.draft_budget order by team_index),
         jsonb_agg(v_event.draft_budget - v_event.roster_size order by team_index),
         jsonb_agg(team_index order by team_index)
  into v_start_budgets, v_budgets, v_order
  from generate_series(0, v_team_count - 1) team_index;

  for v_team_index in 0..v_team_count - 1 loop
    select coalesce(jsonb_agg(mon.value order by mon.ordinality), '[]'::jsonb)
    into v_roster
    from jsonb_array_elements(v_pool) with ordinality mon(value, ordinality)
    where mon.ordinality between
      v_team_index * v_event.roster_size + 1
      and (v_team_index + 1) * v_event.roster_size;
    v_rosters := v_rosters || jsonb_build_array(v_roster);
  end loop;

  select state into v_state
  from public.league_state_snapshots
  where league_id = v_event.draft_league_id
  for update;
  if v_state is null then raise exception 'The private demo auction room is unavailable.'; end if;

  if v_event.phase = 'draft-setup' then
    v_state := v_state || jsonb_build_object(
      'locked', true,
      'draftStartedAt', floor(extract(epoch from clock_timestamp()) * 1000),
      'pool', v_pool,
      'rosters', v_empty_rosters,
      'budgets', v_start_budgets,
      'auctionNominationOrder', v_order,
      'auctionNominationIdx', 0,
      'nominationDeadline', null,
      'nominee', null,
      'paused', false,
      'pausedAt', null,
      'pauseIsOvernight', false,
      'auctionEnded', false
    );
    update public.league_state_snapshots
    set state = v_state, revision = revision + 1, updated_at = now()
    where league_id = v_event.draft_league_id;
  end if;

  v_state := v_state || jsonb_build_object(
    'locked', true,
    'pool', '[]'::jsonb,
    'rosters', v_rosters,
    'budgets', v_budgets,
    'auctionNominationOrder', v_order,
    'auctionNominationIdx', v_required,
    'nominationDeadline', null,
    'nominee', null,
    'paused', false,
    'pausedAt', null,
    'pauseIsOvernight', false,
    'auctionEnded', true
  );
  update public.league_state_snapshots
  set state = v_state, revision = revision + 1, updated_at = now()
  where league_id = v_event.draft_league_id;

  update public.tournaments
  set revision = revision + 1, updated_at = now()
  where id = p_tournament_id;
  insert into public.tournament_audit_events(tournament_id, actor_id, kind, payload)
  values (
    p_tournament_id,
    auth.uid(),
    'tournament_demo_auction_generated',
    jsonb_build_object(
      'synthetic', true,
      'team_count', v_team_count,
      'roster_size', v_event.roster_size,
      'pokemon_count', v_required
    )
  );

  return jsonb_build_object(
    'phase', 'roster-review',
    'team_count', v_team_count,
    'roster_size', v_event.roster_size,
    'pokemon_count', v_required
  );
end;
$$;

create or replace function public.complete_tournament_demo_swiss(
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
  v_match public.tournament_matches%rowtype;
  v_winner uuid;
  v_loser uuid;
  v_winner_games integer;
  v_loser_games integer;
  v_completed integer := 0;
  v_round_guard integer := 0;
begin
  if auth.uid() is null then raise exception 'Sign in to complete the demo Swiss rounds.'; end if;
  select * into v_tournament from public.tournaments where id = p_tournament_id for update;
  select * into v_event from public.draft_tournament_events where tournament_id = p_tournament_id for update;
  if not found
     or v_tournament.owner_id <> auth.uid()
     or not v_tournament.is_demo
     or v_tournament.visibility <> 'private'
     or v_event.competition_format <> 'swiss'
     or v_event.phase not in ('swiss', 'swiss-complete') then
    raise exception 'Only the owner can generate results for a private demo Swiss event.';
  end if;
  if v_event.revision <> p_expected_revision then
    raise exception 'The demo changed. Refresh before generating Swiss results.';
  end if;

  while v_event.phase = 'swiss' loop
    v_round_guard := v_round_guard + 1;
    if v_round_guard > 5 then raise exception 'The demo Swiss generator exceeded its bounded round count.'; end if;

    update public.tournament_result_submissions submission
    set status = 'rejected',
        confirmed_by = auth.uid(),
        resolved_at = now()
    from public.tournament_matches bracket_match
    where submission.match_id = bracket_match.id
      and bracket_match.tournament_id = p_tournament_id
      and bracket_match.bracket_stage = 'swiss'
      and bracket_match.bracket_round = v_event.current_swiss_round
      and submission.status = 'pending';

    for v_match in
      select * from public.tournament_matches bracket_match
      where bracket_match.tournament_id = p_tournament_id
        and bracket_match.bracket_stage = 'swiss'
        and bracket_match.bracket_round = v_event.current_swiss_round
        and bracket_match.status in ('ready', 'reported')
      order by bracket_match.match_number
      for update
    loop
      if (v_match.round_number + v_match.match_number) % 2 = 0 then
        v_winner := v_match.entrant_a_id;
        v_loser := v_match.entrant_b_id;
      else
        v_winner := v_match.entrant_b_id;
        v_loser := v_match.entrant_a_id;
      end if;
      v_winner_games := (v_match.best_of + 1) / 2;
      v_loser_games := case
        when v_match.best_of = 1 then 0
        when (v_match.round_number + v_match.match_number) % 3 = 0 then 1
        else 0
      end;

      update public.tournament_matches
      set status = 'complete',
          games_a = case when v_winner = v_match.entrant_a_id then v_winner_games else v_loser_games end,
          games_b = case when v_winner = v_match.entrant_b_id then v_winner_games else v_loser_games end,
          winner_id = v_winner,
          loser_id = v_loser,
          replay_urls = '{}',
          mvp = null,
          revision = revision + 1,
          completed_at = now()
      where id = v_match.id;
      v_completed := v_completed + 1;
    end loop;

    select * into v_event
    from public.draft_tournament_events
    where tournament_id = p_tournament_id
    for update;
    if v_event.phase = 'swiss'
       and v_event.current_swiss_round < v_event.swiss_round_count then
      if not exists (
        select 1 from public.draft_tournament_rounds round_row
        where round_row.event_id = v_event.id
          and round_row.round_number = v_event.current_swiss_round
          and round_row.status = 'complete'
      ) then
        raise exception 'The current demo Swiss round still contains an unresolved match.';
      end if;
      perform public.start_next_draft_tournament_swiss_round(
        p_tournament_id,
        v_event.revision
      );
      select * into v_event
      from public.draft_tournament_events
      where tournament_id = p_tournament_id
      for update;
    end if;
  end loop;

  if v_event.phase = 'swiss-complete' then
    perform public.start_draft_tournament_top_cut(
      p_tournament_id,
      v_event.revision
    );
    select * into v_event
    from public.draft_tournament_events
    where tournament_id = p_tournament_id;
  end if;

  update public.tournaments
  set revision = revision + 1, updated_at = now()
  where id = p_tournament_id;
  insert into public.tournament_audit_events(tournament_id, actor_id, kind, payload)
  values (
    p_tournament_id,
    auth.uid(),
    'tournament_demo_swiss_generated',
    jsonb_build_object(
      'synthetic', true,
      'completed_matches', v_completed,
      'round_count', v_event.swiss_round_count,
      'final_phase', v_event.phase
    )
  );

  return jsonb_build_object(
    'phase', v_event.phase,
    'completed_matches', v_completed,
    'round_count', v_event.swiss_round_count
  );
end;
$$;

create or replace function public.reset_tournament_demo(
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
  v_draft_league_id uuid;
  v_removed_matches integer;
begin
  if auth.uid() is null then raise exception 'Sign in to reset the organizer demo.'; end if;
  select * into v_tournament from public.tournaments where id = p_tournament_id for update;
  select * into v_event from public.draft_tournament_events where tournament_id = p_tournament_id for update;
  if not found
     or v_tournament.owner_id <> auth.uid()
     or not v_tournament.is_demo
     or v_tournament.visibility <> 'private' then
    raise exception 'Only the owner can reset a private organizer demo.';
  end if;
  if v_event.revision <> p_expected_revision then
    raise exception 'The demo changed. Refresh before resetting it.';
  end if;
  v_draft_league_id := v_event.draft_league_id;

  update public.tournament_matches
  set winner_to_match_id = null,
      winner_to_slot = null
  where tournament_id = p_tournament_id
    and winner_to_match_id is not null;
  delete from public.tournament_matches
  where tournament_id = p_tournament_id;
  get diagnostics v_removed_matches = row_count;
  delete from public.draft_tournament_top_cut_entries
  where event_id = v_event.id;
  delete from public.draft_tournament_rounds
  where event_id = v_event.id;
  delete from public.draft_tournament_seats
  where event_id = v_event.id;

  update public.draft_tournament_events
  set draft_league_id = null,
      draft_session_id = null,
      phase = 'check-in',
      swiss_round_count = null,
      current_swiss_round = 0,
      field_locked_at = null,
      draft_started_at = null,
      roster_locked_at = null,
      swiss_completed_at = null,
      completed_at = null,
      revision = revision + 1,
      updated_at = now()
  where id = v_event.id;

  if v_draft_league_id is not null then
    delete from public.roster_entries entry
    using public.teams team
    where entry.team_id = team.id
      and team.league_id = v_draft_league_id;
    delete from public.draft_picks pick
    where pick.league_pokemon_id in (
      select league_pokemon.id
      from public.league_pokemon
      where league_id = v_draft_league_id
    );
    delete from public.transaction_items item
    where item.league_pokemon_id in (
      select league_pokemon.id
      from public.league_pokemon
      where league_id = v_draft_league_id
    );
    delete from public.leagues
    where id = v_draft_league_id
      and workspace_kind = 'draft-tournament';
  end if;

  update public.tournament_entrants
  set seed = null
  where tournament_id = p_tournament_id;
  update public.tournament_entrants entrant
  set status = 'registered',
      checked_in_at = now(),
      seed = ordered.seed_number
  from (
    select source.id,
      row_number() over (
        order by source.is_demo_bot, source.display_name, source.registered_at, source.id
      )::smallint as seed_number
    from public.tournament_entrants source
    where source.tournament_id = p_tournament_id
  ) ordered
  where entrant.id = ordered.id;
  update public.tournaments
  set status = 'registration',
      revision = revision + 1,
      updated_at = now()
  where id = p_tournament_id;

  insert into public.tournament_audit_events(tournament_id, actor_id, kind, payload)
  values (
    p_tournament_id,
    auth.uid(),
    'tournament_demo_reset',
    jsonb_build_object(
      'synthetic', true,
      'removed_matches', v_removed_matches,
      'removed_draft_room', v_draft_league_id is not null
    )
  );
  return jsonb_build_object(
    'phase', 'check-in',
    'entrant_count', (
      select count(*) from public.tournament_entrants entrant
      where entrant.tournament_id = p_tournament_id
    ),
    'removed_matches', v_removed_matches
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
  'is_demo', tournament.is_demo,
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
      'is_demo', v_tournament.is_demo,
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
        'is_bot', entrant.is_demo_bot,
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

revoke all on function public.enable_tournament_demo(uuid, bigint),
  public.create_demo_auction_draft_first_tournament(
    text, text, text, integer, integer, text, integer, integer,
    integer, integer, integer, boolean, text
  ),
  public.fill_tournament_demo_auction(uuid, bigint),
  public.complete_tournament_demo_swiss(uuid, bigint),
  public.reset_tournament_demo(uuid, bigint)
from public, anon, authenticated, service_role;
grant execute on function public.enable_tournament_demo(uuid, bigint),
  public.create_demo_auction_draft_first_tournament(
    text, text, text, integer, integer, text, integer, integer,
    integer, integer, integer, boolean, text
  ),
  public.fill_tournament_demo_auction(uuid, bigint),
  public.complete_tournament_demo_swiss(uuid, bigint),
  public.reset_tournament_demo(uuid, bigint)
to authenticated;

revoke all on function public.guard_demo_auction_team_identity(),
  public.enforce_draft_tournament_team_owner(),
  public.materialize_auction_draft_tournament_rosters(uuid)
from public, anon, authenticated, service_role;
grant execute on function public.guard_demo_auction_team_identity(),
  public.enforce_draft_tournament_team_owner(),
  public.materialize_auction_draft_tournament_rosters(uuid)
to service_role;

revoke all on function public.lock_auction_draft_tournament_field(uuid, bigint)
from public, anon, authenticated, service_role;
grant execute on function public.lock_auction_draft_tournament_field(uuid, bigint)
to authenticated;

revoke all on function public.list_tournaments(), public.get_draft_tournament_workspace(uuid)
from public, anon, authenticated, service_role;
grant execute on function public.list_tournaments(), public.get_draft_tournament_workspace(uuid)
to anon, authenticated;
grant execute on function public.list_tournaments(), public.get_draft_tournament_workspace(uuid)
to service_role;

comment on column public.tournaments.is_demo
is 'True only for permanently private tournament-organizer sandboxes containing synthetic data.';
comment on column public.tournament_entrants.is_demo_bot
is 'Synthetic unclaimed entrant used only inside a private tournament-organizer demo.';
comment on function public.create_demo_auction_draft_first_tournament(
  text, text, text, integer, integer, text, integer, integer,
  integer, integer, integer, boolean, text
) is 'Creates a private 32-seat auction Swiss sandbox with one owner and 31 synthetic bot entrants.';

notify pgrst, 'reload schema';
commit;
