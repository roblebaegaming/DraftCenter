-- Migration 385: make the shared draft an independent tournament setting.
--
-- Existing Draft Tournaments keep their Swiss + optional top-cut lifecycle.
-- New draft-first events can enter the proven Swiss lifecycle or reuse the
-- single- or double-elimination graph after shared draft and atomic roster lock.
begin;

alter table public.draft_tournament_events
  add column if not exists competition_format text not null default 'swiss';

alter table public.draft_tournament_events
  drop constraint if exists draft_tournament_events_competition_format_check;
alter table public.draft_tournament_events
  add constraint draft_tournament_events_competition_format_check
  check (competition_format in ('swiss', 'single-elimination', 'double-elimination'));

alter table public.draft_tournament_events
  drop constraint if exists draft_tournament_events_phase_check;
alter table public.draft_tournament_events
  add constraint draft_tournament_events_phase_check
  check (phase in (
    'registration', 'check-in', 'draft-setup', 'drafting',
    'roster-review', 'bracket', 'swiss', 'swiss-complete', 'top-cut',
    'complete', 'cancelled', 'archived'
  ));

create or replace function public.enforce_draft_first_competition_settings()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.competition_format in ('single-elimination', 'double-elimination') then
    new.swiss_round_count := null;
    new.current_swiss_round := 0;
    new.top_cut_size := 0;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_draft_first_competition_settings_trigger on public.draft_tournament_events;
create trigger enforce_draft_first_competition_settings_trigger
before insert or update on public.draft_tournament_events
for each row execute function public.enforce_draft_first_competition_settings();

create or replace function public.enrich_draft_first_audit_payload()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_competition_format text;
begin
  if new.kind <> 'draft_tournament_field_locked' then return new; end if;
  select event.competition_format into v_competition_format
  from public.draft_tournament_events event
  where event.tournament_id = new.tournament_id;
  if v_competition_format in ('single-elimination', 'double-elimination') then
    new.payload := (coalesce(new.payload, '{}'::jsonb) - 'swiss_round_count')
      || jsonb_build_object('competition_format', v_competition_format);
  end if;
  return new;
end;
$$;

drop trigger if exists enrich_draft_first_audit_payload_trigger on public.tournament_audit_events;
create trigger enrich_draft_first_audit_payload_trigger
before insert on public.tournament_audit_events
for each row execute function public.enrich_draft_first_audit_payload();

create or replace function public.create_draft_first_tournament(
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
  v_tournament_id uuid;
  v_event_id uuid;
begin
  if p_competition_format not in ('swiss', 'single-elimination', 'double-elimination') then
    raise exception 'Draft-first tournaments must use single elimination, double elimination, or Swiss.';
  end if;

  v_result := public.create_draft_tournament(
    p_name,
    p_description,
    p_visibility,
    p_best_of,
    p_entrant_limit,
    p_rules,
    p_roster_size,
    p_pick_time_limit_minutes,
    0,
    p_snake_budget_enabled,
    p_draft_budget,
    p_publish_rosters
  );
  v_tournament_id := (v_result ->> 'tournament_id')::uuid;
  v_event_id := (v_result ->> 'event_id')::uuid;

  update public.draft_tournament_events
  set competition_format = p_competition_format,
      updated_at = now()
  where id = v_event_id and tournament_id = v_tournament_id;

  insert into public.tournament_audit_events(tournament_id, actor_id, kind, payload)
  values (
    v_tournament_id,
    auth.uid(),
    'draft_first_competition_selected',
    jsonb_build_object('competition_format', p_competition_format)
  );

  return v_result || jsonb_build_object('competition_format', p_competition_format);
end;
$$;

-- The elimination lock functions already own mature seeding, bye propagation,
-- winners/losers routing, Grand Final reset behavior, and audit history. This
-- adapter changes the tournament discriminator only inside this transaction,
-- calls that authoritative builder, then restores the Draft Tournament shell.
-- No concurrent reader can observe the temporary values.
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
  if (select count(*) from public.tournament_entrants entrant
      where entrant.tournament_id = v_tournament.id and entrant.status = 'registered') not between 4 and 16 then
    raise exception 'A draft-first elimination bracket needs between 4 and 16 active entrants.';
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
      jsonb_build_object('roster_size', v_event.roster_size, 'competition_format', 'swiss')
    );
    perform public.create_draft_tournament_swiss_round(v_event.id, 1, auth.uid());
    return jsonb_build_object('phase', 'swiss', 'round_number', 1, 'competition_format', 'swiss');
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
      'match_count', (v_bracket ->> 'match_count')::integer
    )
  );
  return jsonb_build_object(
    'phase', 'bracket',
    'competition_format', v_event.competition_format,
    'match_count', (v_bracket ->> 'match_count')::integer
  );
end;
$$;

create or replace function public.sync_draft_first_tournament_completion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.draft_tournament_events%rowtype;
begin
  if new.format <> 'draft-tournament'
     or new.status <> 'complete'
     or old.status is not distinct from new.status then
    return new;
  end if;
  select * into v_event
  from public.draft_tournament_events
  where tournament_id = new.id
  for update;
  if found
     and v_event.competition_format in ('single-elimination', 'double-elimination')
     and v_event.phase = 'bracket' then
    update public.draft_tournament_events
    set phase = 'complete',
        completed_at = now(),
        revision = revision + 1,
        updated_at = now()
    where id = v_event.id;
    insert into public.tournament_audit_events(tournament_id, actor_id, kind, payload)
    values (
      new.id,
      auth.uid(),
      'draft_tournament_completed',
      jsonb_build_object('competition_format', v_event.competition_format)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists sync_draft_first_tournament_completion_trigger on public.tournaments;
create trigger sync_draft_first_tournament_completion_trigger
after update of status on public.tournaments
for each row execute function public.sync_draft_first_tournament_completion();

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
      'competition_format', v_event.competition_format,
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

revoke all on function public.create_draft_first_tournament(text, text, text, integer, integer, text, integer, integer, boolean, integer, boolean, text),
  public.build_draft_first_elimination_bracket(uuid, uuid),
  public.enforce_draft_first_competition_settings(),
  public.enrich_draft_first_audit_payload(),
  public.sync_draft_first_tournament_completion()
from public, anon, authenticated;
grant execute on function public.create_draft_first_tournament(text, text, text, integer, integer, text, integer, integer, boolean, integer, boolean, text)
to authenticated;
grant execute on function public.build_draft_first_elimination_bracket(uuid, uuid),
  public.enforce_draft_first_competition_settings(),
  public.enrich_draft_first_audit_payload(),
  public.sync_draft_first_tournament_completion()
to service_role;

revoke all on function public.lock_draft_tournament_rosters(uuid, bigint) from public, anon, authenticated;
grant execute on function public.lock_draft_tournament_rosters(uuid, bigint) to authenticated;
revoke all on function public.list_tournaments(), public.get_draft_tournament_workspace(uuid) from public, anon, authenticated;
grant execute on function public.list_tournaments(), public.get_draft_tournament_workspace(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
commit;

