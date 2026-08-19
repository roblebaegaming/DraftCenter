-- Midseason league retirement and tournament drop lifecycle.
-- Public snapshots contain only operational status. Optional commissioner
-- reasons live in RLS-hidden history tables and are never projected publicly.
begin;

create table public.league_participation_events (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  season_number integer not null check (season_number > 0),
  team_index integer not null check (team_index between 0 and 255),
  action text not null check (action in ('retired', 'reactivated')),
  effective_after integer check (effective_after is null or effective_after between 0 and 255),
  unresolved_match_policy text check (unresolved_match_policy is null or unresolved_match_policy in ('forfeit', 'no-contest', 'left-unplayed')),
  private_reason text check (private_reason is null or char_length(btrim(private_reason)) between 2 and 500),
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index league_participation_events_lookup_idx
  on public.league_participation_events(league_id, season_number, team_index, created_at desc);

alter table public.league_participation_events enable row level security;
revoke all on public.league_participation_events from public, anon, authenticated;
grant all on public.league_participation_events to service_role;

create or replace function public.guard_league_participation_state()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_index integer;
  v_old_team jsonb;
  v_new_team jsonb;
  v_effective_after integer;
  v_week record;
  v_match record;
  v_key text;
begin
  if current_setting('draftcenter.participant_status_write', true) = 'on'
     or coalesce((old.state ->> 'seasonNumber')::integer, 1)
        is distinct from coalesce((new.state ->> 'seasonNumber')::integer, 1) then
    return new;
  end if;

  if jsonb_typeof(old.state -> 'teams') <> 'array'
     or jsonb_typeof(new.state -> 'teams') <> 'array' then
    return new;
  end if;

  for v_index in 0..jsonb_array_length(old.state -> 'teams') - 1 loop
    v_old_team := old.state #> array['teams', v_index::text];
    v_new_team := new.state #> array['teams', v_index::text];
    if v_old_team -> 'seasonStatus' is distinct from v_new_team -> 'seasonStatus' then
      raise exception 'Season participation can only be changed from Commissioner Tools.';
    end if;
    if v_old_team #>> '{seasonStatus,status}' = 'retired' then
      if v_old_team is distinct from v_new_team
         or old.state #> array['rosters', v_index::text]
            is distinct from new.state #> array['rosters', v_index::text] then
        raise exception 'A retired team is frozen for the rest of this season.';
      end if;
      v_effective_after := coalesce((v_old_team #>> '{seasonStatus,effectiveAfter}')::integer, 0);
      for v_week in
        select week.value, (week.ordinality - 1)::integer as week_index
        from jsonb_array_elements(coalesce(old.state -> 'schedule', '[]'::jsonb)) with ordinality week(value, ordinality)
        where week.ordinality - 1 >= v_effective_after
      loop
        for v_match in
          select match.value, (match.ordinality - 1)::integer as match_index
          from jsonb_array_elements(case when jsonb_typeof(v_week.value) = 'array' then v_week.value else '[]'::jsonb end) with ordinality match(value, ordinality)
          where jsonb_typeof(match.value) = 'array'
            and jsonb_array_length(match.value) = 2
            and v_index in ((match.value ->> 0)::integer, (match.value ->> 1)::integer)
        loop
          v_key := v_week.week_index::text || '-' || v_match.match_index::text;
          if old.state -> 'matchResults' -> v_key is distinct from new.state -> 'matchResults' -> v_key then
            raise exception 'Future fixtures for a retired team are frozen. Reactivate the team before changing them.';
          end if;
        end loop;
      end loop;
    end if;
  end loop;

  if coalesce(jsonb_typeof(old.state -> 'playoffs'), 'null') = 'null'
     and coalesce(jsonb_typeof(new.state -> 'playoffs'), 'null') <> 'null' then
    for v_index in 0..jsonb_array_length(new.state -> 'teams') - 1 loop
      if new.state #>> array['teams', v_index::text, 'seasonStatus', 'status'] = 'retired'
         and (
           jsonb_path_exists(new.state -> 'playoffs', '$.seeds[*] ? (@ == $team)', jsonb_build_object('team', v_index))
           or jsonb_path_exists(new.state -> 'playoffs', '$.divisionBrackets[*].seeds[*] ? (@ == $team)', jsonb_build_object('team', v_index))
         ) then
        raise exception 'Retired teams cannot be seeded into playoffs.';
      end if;
    end loop;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_league_participation_state_trigger on public.league_state_snapshots;
create trigger guard_league_participation_state_trigger
before update of state on public.league_state_snapshots
for each row execute function public.guard_league_participation_state();

create or replace function public.set_league_team_retirement(
  p_league_id uuid,
  p_team_index integer,
  p_expected_state_rev bigint,
  p_effective_after integer,
  p_unresolved_match_policy text,
  p_private_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_snapshot public.league_state_snapshots%rowtype;
  v_state jsonb;
  v_team jsonb;
  v_team_name text;
  v_actor_name text;
  v_schedule_length integer;
  v_week record;
  v_match record;
  v_key text;
  v_a integer;
  v_b integer;
  v_resolution jsonb;
  v_now_ms bigint := floor(extract(epoch from clock_timestamp()) * 1000)::bigint;
begin
  if auth.uid() is null or not public.is_league_staff(p_league_id) then
    raise exception 'Only league commissioners can retire a team.';
  end if;
  if p_unresolved_match_policy not in ('forfeit', 'no-contest', 'left-unplayed')
     or char_length(btrim(coalesce(p_private_reason, ''))) not between 2 and 500 then
    raise exception 'Choose a future-fixture policy and enter a short private reason.';
  end if;

  select * into v_snapshot from public.league_state_snapshots
  where league_id = p_league_id for update;
  if not found then raise exception 'League state not found.'; end if;
  v_state := v_snapshot.state;
  if coalesce((v_state ->> 'rev')::bigint, 0) <> p_expected_state_rev then
    raise exception 'The league changed. Refresh before retiring a team.';
  end if;
  if coalesce((v_state ->> 'locked')::boolean, false) is not true then
    raise exception 'Team retirement is available after the draft begins.';
  end if;
  if coalesce(jsonb_typeof(v_state -> 'playoffs'), 'null') <> 'null' then
    raise exception 'A team cannot retire after the playoff field has been created.';
  end if;
  if jsonb_typeof(v_state -> 'teams') <> 'array'
     or p_team_index < 0 or p_team_index >= jsonb_array_length(v_state -> 'teams') then
    raise exception 'Choose a valid team.';
  end if;
  v_team := v_state #> array['teams', p_team_index::text];
  if v_team #>> '{seasonStatus,status}' = 'retired' then
    raise exception 'That team is already retired for this season.';
  end if;
  v_schedule_length := jsonb_array_length(coalesce(v_state -> 'schedule', '[]'::jsonb));
  if p_effective_after < 0 or p_effective_after > v_schedule_length then
    raise exception 'The effective week or round is outside this regular season.';
  end if;
  v_team_name := coalesce(nullif(btrim(v_team ->> 'name'), ''), 'Team ' || (p_team_index + 1));
  select coalesce(nullif(btrim(profile.display_name), ''), nullif(btrim(profile.username), ''), 'Commissioner')
  into v_actor_name from public.profiles profile where profile.id = auth.uid();

  v_team := v_team || jsonb_build_object('seasonStatus', jsonb_build_object(
    'status', 'retired',
    'effectiveAfter', p_effective_after,
    'unresolvedMatchPolicy', p_unresolved_match_policy,
    'changedAt', now()
  ));
  v_state := jsonb_set(v_state, array['teams', p_team_index::text], v_team, false);

  for v_week in
    select week.value, (week.ordinality - 1)::integer as week_index
    from jsonb_array_elements(coalesce(v_state -> 'schedule', '[]'::jsonb)) with ordinality week(value, ordinality)
    where week.ordinality - 1 >= p_effective_after
  loop
    for v_match in
      select match.value, (match.ordinality - 1)::integer as match_index
      from jsonb_array_elements(case when jsonb_typeof(v_week.value) = 'array' then v_week.value else '[]'::jsonb end) with ordinality match(value, ordinality)
      where jsonb_typeof(match.value) = 'array' and jsonb_array_length(match.value) = 2
    loop
      v_a := (v_match.value ->> 0)::integer;
      v_b := (v_match.value ->> 1)::integer;
      if p_team_index not in (v_a, v_b) then continue; end if;
      v_key := v_week.week_index::text || '-' || v_match.match_index::text;
      if v_state -> 'matchResults' -> v_key is not null then continue; end if;
      v_resolution := jsonb_build_object(
        'resolution', p_unresolved_match_policy,
        'administrative', true,
        'gameScoreKnown', false,
        'gamesA', 0,
        'gamesB', 0,
        'monsAliveA', 0,
        'monsAliveB', 0,
        'reportedBy', v_actor_name,
        'resolvedAt', now()
      );
      if p_unresolved_match_policy = 'forfeit' then
        v_resolution := v_resolution || jsonb_build_object('outcomeWinner', case when p_team_index = v_a then 'B' else 'A' end);
      end if;
      v_state := jsonb_set(v_state, array['matchResults', v_key], v_resolution, true);
    end loop;
  end loop;

  v_state := jsonb_set(v_state, '{auditLog}',
    coalesce(case when jsonb_typeof(v_state -> 'auditLog') = 'array' then v_state -> 'auditLog' end, '[]'::jsonb)
      || jsonb_build_array(jsonb_build_object(
        'id', v_now_ms::text || '-team-retired', 'ts', v_now_ms, 'actor', v_actor_name,
        'action', 'Retired team for season',
        'detail', v_team_name || ' after ' || case when v_state #>> '{settings,regularSeasonFormat}' = 'swiss' then 'Round ' else 'Week ' end || p_effective_after
      )), true);
  v_state := jsonb_set(v_state, '{rev}', to_jsonb(p_expected_state_rev + 1), true);

  perform set_config('draftcenter.participant_status_write', 'on', true);
  update public.league_state_snapshots
  set state = v_state, revision = revision + 1, updated_at = now()
  where league_id = p_league_id;

  insert into public.league_participation_events(
    league_id, season_number, team_index, action, effective_after,
    unresolved_match_policy, private_reason, actor_id
  ) values (
    p_league_id, coalesce((v_state ->> 'seasonNumber')::integer, 1), p_team_index,
    'retired', p_effective_after, p_unresolved_match_policy, btrim(p_private_reason), auth.uid()
  );
  insert into public.league_events(league_id, kind, actor_id, payload)
  values (p_league_id, 'team_retired_for_season', auth.uid(), jsonb_build_object(
    'team_index', p_team_index, 'team_name', v_team_name,
    'effective_after', p_effective_after, 'unresolved_match_policy', p_unresolved_match_policy
  ));
  return v_state;
end;
$$;

create or replace function public.reactivate_league_team(
  p_league_id uuid,
  p_team_index integer,
  p_expected_state_rev bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_snapshot public.league_state_snapshots%rowtype;
  v_state jsonb;
  v_team jsonb;
  v_effective_after integer;
  v_week record;
  v_match record;
  v_key text;
  v_now_ms bigint := floor(extract(epoch from clock_timestamp()) * 1000)::bigint;
begin
  if auth.uid() is null or not public.is_league_staff(p_league_id) then
    raise exception 'Only league commissioners can reactivate a team.';
  end if;
  select * into v_snapshot from public.league_state_snapshots where league_id = p_league_id for update;
  if not found then raise exception 'League state not found.'; end if;
  v_state := v_snapshot.state;
  if coalesce((v_state ->> 'rev')::bigint, 0) <> p_expected_state_rev then
    raise exception 'The league changed. Refresh before reactivating a team.';
  end if;
  v_team := v_state #> array['teams', p_team_index::text];
  if v_team #>> '{seasonStatus,status}' <> 'retired' then
    raise exception 'That team is not retired.';
  end if;
  if coalesce(jsonb_typeof(v_state -> 'playoffs'), 'null') <> 'null' then
    raise exception 'The playoff field already depends on this retirement.';
  end if;
  v_effective_after := coalesce((v_team #>> '{seasonStatus,effectiveAfter}')::integer, 0);
  if coalesce((v_state ->> 'week')::integer, 0) >= v_effective_after then
    raise exception 'A later week or round has already begun. Reactivation is no longer safe.';
  end if;

  for v_week in
    select week.value, (week.ordinality - 1)::integer as week_index
    from jsonb_array_elements(coalesce(v_state -> 'schedule', '[]'::jsonb)) with ordinality week(value, ordinality)
    where week.ordinality - 1 >= v_effective_after
  loop
    for v_match in
      select match.value, (match.ordinality - 1)::integer as match_index
      from jsonb_array_elements(case when jsonb_typeof(v_week.value) = 'array' then v_week.value else '[]'::jsonb end) with ordinality match(value, ordinality)
      where jsonb_typeof(match.value) = 'array' and jsonb_array_length(match.value) = 2
        and p_team_index in ((match.value ->> 0)::integer, (match.value ->> 1)::integer)
    loop
      v_key := v_week.week_index::text || '-' || v_match.match_index::text;
      if v_state #>> array['matchResults', v_key, 'administrative'] = 'true' then
        v_state := jsonb_set(v_state, '{matchResults}', (v_state -> 'matchResults') - v_key, true);
      end if;
    end loop;
  end loop;
  v_team := v_team - 'seasonStatus';
  v_state := jsonb_set(v_state, array['teams', p_team_index::text], v_team, false);
  v_state := jsonb_set(v_state, '{auditLog}',
    coalesce(case when jsonb_typeof(v_state -> 'auditLog') = 'array' then v_state -> 'auditLog' end, '[]'::jsonb)
      || jsonb_build_array(jsonb_build_object(
        'id', v_now_ms::text || '-team-reactivated', 'ts', v_now_ms,
        'actor', 'Commissioner', 'action', 'Reactivated team for season',
        'detail', coalesce(v_team ->> 'name', 'Team ' || (p_team_index + 1))
      )), true);
  v_state := jsonb_set(v_state, '{rev}', to_jsonb(p_expected_state_rev + 1), true);
  perform set_config('draftcenter.participant_status_write', 'on', true);
  update public.league_state_snapshots set state = v_state, revision = revision + 1, updated_at = now()
  where league_id = p_league_id;
  insert into public.league_participation_events(league_id, season_number, team_index, action, actor_id)
  values (p_league_id, coalesce((v_state ->> 'seasonNumber')::integer, 1), p_team_index, 'reactivated', auth.uid());
  insert into public.league_events(league_id, kind, actor_id, payload)
  values (p_league_id, 'team_reactivated_for_season', auth.uid(), jsonb_build_object('team_index', p_team_index));
  return v_state;
end;
$$;

alter table public.tournament_entrants
  add column if not exists status_effective_round smallint
    check (status_effective_round is null or status_effective_round between 0 and 10),
  add column if not exists unresolved_match_policy text
    check (unresolved_match_policy is null or unresolved_match_policy in ('forfeit', 'no-contest', 'left-unplayed')),
  add column if not exists status_changed_at timestamptz;

alter table public.tournament_matches
  add column if not exists administrative_resolution text
    check (administrative_resolution is null or administrative_resolution in ('forfeit', 'no-contest', 'left-unplayed'));

create table public.tournament_participation_events (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  entrant_id uuid not null,
  action text not null check (action in ('dropped', 'disqualified', 'reactivated')),
  effective_round smallint check (effective_round is null or effective_round between 0 and 10),
  unresolved_match_policy text check (unresolved_match_policy is null or unresolved_match_policy in ('forfeit', 'no-contest', 'left-unplayed')),
  private_reason text check (private_reason is null or char_length(btrim(private_reason)) between 2 and 500),
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (entrant_id, tournament_id)
    references public.tournament_entrants(id, tournament_id) on delete cascade
);

create index tournament_participation_events_lookup_idx
  on public.tournament_participation_events(tournament_id, entrant_id, created_at desc);
alter table public.tournament_participation_events enable row level security;
revoke all on public.tournament_participation_events from public, anon, authenticated;
grant all on public.tournament_participation_events to service_role;

create or replace function public.get_tournament_participation_statuses(p_tournament_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when public.can_view_tournament(p_tournament_id) then coalesce(jsonb_agg(jsonb_build_object(
    'entrant_id', entrant.id,
    'status_effective_round', entrant.status_effective_round,
    'unresolved_match_policy', entrant.unresolved_match_policy,
    'status_changed_at', entrant.status_changed_at
  ) order by entrant.registered_at), '[]'::jsonb) else null end
  from public.tournament_entrants entrant
  where entrant.tournament_id = p_tournament_id;
$$;

create or replace function public.set_tournament_participation_status(
  p_tournament_id uuid,
  p_entrant_id uuid,
  p_expected_tournament_revision bigint,
  p_status text,
  p_effective_round integer,
  p_unresolved_match_policy text,
  p_private_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tournament public.tournaments%rowtype;
  v_entrant public.tournament_entrants%rowtype;
  v_event public.draft_tournament_events%rowtype;
  v_match public.tournament_matches%rowtype;
  v_winner uuid;
  v_wins integer;
begin
  if auth.uid() is null then raise exception 'Only the tournament owner can change entrant status.'; end if;
  if p_status not in ('dropped', 'disqualified')
     or p_effective_round not between 0 and 10
     or p_unresolved_match_policy not in ('forfeit', 'no-contest', 'left-unplayed')
     or char_length(btrim(coalesce(p_private_reason, ''))) not between 2 and 500 then
    raise exception 'Entrant participation details are invalid.';
  end if;
  select * into v_tournament from public.tournaments where id = p_tournament_id for update;
  if not found or v_tournament.owner_id <> auth.uid()
     or v_tournament.status not in ('registration', 'active') then
    raise exception 'Only the tournament owner can change an active entrant.';
  end if;
  if v_tournament.revision <> p_expected_tournament_revision then
    raise exception 'The tournament changed. Refresh before changing entrant status.';
  end if;
  select * into v_entrant from public.tournament_entrants
  where id = p_entrant_id and tournament_id = p_tournament_id for update;
  if not found or v_entrant.status <> 'registered' then raise exception 'That entrant is no longer active.'; end if;
  select * into v_event from public.draft_tournament_events where tournament_id = p_tournament_id for update;

  select * into v_match from public.tournament_matches
  where tournament_id = p_tournament_id
    and p_entrant_id in (entrant_a_id, entrant_b_id)
    and winner_id is null and status in ('pending', 'ready', 'reported')
  order by round_number desc, match_number desc limit 1 for update;

  if found and v_match.entrant_a_id is not null and v_match.entrant_b_id is not null then
    if v_match.bracket_stage = 'swiss' then
      update public.tournament_result_submissions
      set status = 'rejected', confirmed_by = auth.uid(), resolved_at = now()
      where match_id = v_match.id and status = 'pending';
      if p_unresolved_match_policy = 'forfeit' then
        v_winner := case when p_entrant_id = v_match.entrant_a_id then v_match.entrant_b_id else v_match.entrant_a_id end;
        v_wins := (v_match.best_of + 1) / 2;
        update public.tournament_matches
        set status = 'complete',
            games_a = case when v_winner = entrant_a_id then v_wins else 0 end,
            games_b = case when v_winner = entrant_b_id then v_wins else 0 end,
            winner_id = v_winner, loser_id = p_entrant_id,
            replay_urls = '{}', mvp = null,
            administrative_resolution = 'forfeit', revision = revision + 1, completed_at = now()
        where id = v_match.id;
      else
        update public.tournament_matches
        set status = 'complete', games_a = 0, games_b = 0,
            winner_id = null, loser_id = null, replay_urls = '{}', mvp = null,
            administrative_resolution = p_unresolved_match_policy,
            revision = revision + 1, completed_at = now()
        where id = v_match.id;
      end if;
    elsif p_unresolved_match_policy = 'forfeit' then
      perform public.resolve_tournament_forfeit_chain(
        v_match.id, p_entrant_id, auth.uid(), 'Commissioner-selected participation forfeit',
        case when p_status = 'dropped' then 'dropped_entrant_forfeited' else 'disqualified_entrant_forfeited' end
      );
      update public.tournament_matches set administrative_resolution = 'forfeit' where id = v_match.id;
    else
      raise exception 'Elimination withdrawals after seeding require an explicit forfeit so the bracket can advance.';
    end if;
  end if;

  update public.tournament_entrants
  set status = p_status,
      seed = case when v_tournament.status = 'registration' then null else seed end,
      status_effective_round = p_effective_round,
      unresolved_match_policy = p_unresolved_match_policy,
      status_changed_at = now()
  where id = p_entrant_id;
  update public.tournaments set revision = revision + 1, updated_at = now() where id = p_tournament_id;
  insert into public.tournament_participation_events(
    tournament_id, entrant_id, action, effective_round, unresolved_match_policy, private_reason, actor_id
  ) values (
    p_tournament_id, p_entrant_id, p_status, p_effective_round,
    p_unresolved_match_policy, btrim(p_private_reason), auth.uid()
  );
  insert into public.tournament_audit_events(tournament_id, actor_id, kind, payload)
  values (p_tournament_id, auth.uid(), 'entrant_' || p_status, jsonb_build_object(
    'entrant_id', p_entrant_id, 'effective_round', p_effective_round,
    'unresolved_match_policy', p_unresolved_match_policy
  ));
end;
$$;

create or replace function public.reactivate_tournament_participant(
  p_tournament_id uuid,
  p_entrant_id uuid,
  p_expected_tournament_revision bigint
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tournament public.tournaments%rowtype;
  v_entrant public.tournament_entrants%rowtype;
  v_event public.draft_tournament_events%rowtype;
begin
  select * into v_tournament from public.tournaments where id = p_tournament_id for update;
  if auth.uid() is null or not found or v_tournament.owner_id <> auth.uid() then
    raise exception 'Only the tournament owner can reactivate an entrant.';
  end if;
  if v_tournament.revision <> p_expected_tournament_revision then
    raise exception 'The tournament changed. Refresh before reactivating an entrant.';
  end if;
  select * into v_entrant from public.tournament_entrants
  where id = p_entrant_id and tournament_id = p_tournament_id for update;
  if not found or v_entrant.status not in ('dropped', 'disqualified') then
    raise exception 'That entrant is not inactive.';
  end if;
  select * into v_event from public.draft_tournament_events where tournament_id = p_tournament_id for update;
  if found then
    if v_event.phase not in ('registration', 'check-in', 'swiss', 'swiss-complete') then
      raise exception 'This tournament phase already depends on the withdrawal.';
    end if;
    if exists (
      select 1 from public.draft_tournament_rounds round_row
      where round_row.event_id = v_event.id
        and round_row.round_number > coalesce(v_entrant.status_effective_round, 0)
    ) then raise exception 'A later Swiss round has already been paired.'; end if;
  elsif v_tournament.status <> 'registration' then
    raise exception 'A seeded elimination entrant cannot be reactivated safely.';
  end if;
  update public.tournament_entrants
  set status = 'registered', status_effective_round = null,
      unresolved_match_policy = null, status_changed_at = now()
  where id = p_entrant_id;
  update public.draft_tournament_seats set status = 'active', updated_at = now()
  where tournament_id = p_tournament_id and entrant_id = p_entrant_id;
  update public.tournaments set revision = revision + 1, updated_at = now() where id = p_tournament_id;
  insert into public.tournament_participation_events(tournament_id, entrant_id, action, actor_id)
  values (p_tournament_id, p_entrant_id, 'reactivated', auth.uid());
  insert into public.tournament_audit_events(tournament_id, actor_id, kind, payload)
  values (p_tournament_id, auth.uid(), 'entrant_reactivated', jsonb_build_object('entrant_id', p_entrant_id));
end;
$$;

alter table public.league_organization_qualification_candidates
  add column if not exists eligible boolean not null default true;

create or replace function public.apply_league_qualification_eligibility(p_run_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run public.league_organization_qualification_runs%rowtype;
  v_wildcard_slots integer;
begin
  select * into v_run from public.league_organization_qualification_runs where id = p_run_id for update;
  if not found then raise exception 'Qualification run not found.'; end if;
  v_wildcard_slots := coalesce((v_run.rules_snapshot ->> 'wildcard_slots')::integer, 0);

  update public.league_organization_qualification_candidates candidate
  set eligible = coalesce(candidate.team_snapshot #>> '{seasonStatus,status}', '') <> 'retired',
      pod_rank = null, wildcard_rank = null, selected_kind = null, unresolved = false,
      updated_at = now()
  where candidate.run_id = p_run_id;

  with ranked as (
    select candidate.id, row_number() over (
      partition by candidate.pod_id
      order by candidate.ranking_path desc, candidate.source_team_key
    ) as rank
    from public.league_organization_qualification_candidates candidate
    where candidate.run_id = p_run_id and candidate.eligible
  )
  update public.league_organization_qualification_candidates candidate
  set pod_rank = ranked.rank
  from ranked where candidate.id = ranked.id;

  update public.league_organization_qualification_candidates candidate
  set selected_kind = 'pod-finish'
  from public.league_organization_pods pod
  where candidate.run_id = p_run_id and candidate.eligible
    and pod.id = candidate.pod_id and candidate.pod_rank <= pod.qualification_spots;

  update public.league_organization_qualification_candidates
  set wildcard_ranking_path = ranking_path
  where run_id = p_run_id and eligible and selected_kind is null;

  with ranked as (
    select candidate.id, row_number() over (
      order by candidate.wildcard_ranking_path desc, candidate.pod_id, candidate.source_team_key
    ) as rank
    from public.league_organization_qualification_candidates candidate
    where candidate.run_id = p_run_id and candidate.eligible and candidate.selected_kind is null
  )
  update public.league_organization_qualification_candidates candidate
  set wildcard_rank = ranked.rank
  from ranked where candidate.id = ranked.id;

  if v_wildcard_slots > 0 then
    update public.league_organization_qualification_candidates
    set selected_kind = 'wildcard'
    where run_id = p_run_id and eligible and selected_kind is null
      and wildcard_rank <= v_wildcard_slots;
  end if;

  with boundaries as (
    select boundary.pod_id, boundary.ranking_path
    from public.league_organization_qualification_candidates boundary
    join public.league_organization_pods pod on pod.id = boundary.pod_id
    join public.league_organization_qualification_candidates next_candidate
      on next_candidate.run_id = boundary.run_id and next_candidate.pod_id = boundary.pod_id
     and next_candidate.eligible and next_candidate.pod_rank = pod.qualification_spots + 1
    where boundary.run_id = p_run_id and boundary.eligible
      and boundary.pod_rank = pod.qualification_spots
      and boundary.ranking_path = next_candidate.ranking_path
  )
  update public.league_organization_qualification_candidates candidate
  set unresolved = true from boundaries
  where candidate.run_id = p_run_id and candidate.eligible
    and candidate.pod_id = boundaries.pod_id and candidate.ranking_path = boundaries.ranking_path;

  if v_wildcard_slots > 0 then
    with boundary as (
      select selected.wildcard_ranking_path
      from public.league_organization_qualification_candidates selected
      join public.league_organization_qualification_candidates next_candidate
        on next_candidate.run_id = selected.run_id and next_candidate.eligible
       and next_candidate.wildcard_rank = v_wildcard_slots + 1
      where selected.run_id = p_run_id and selected.eligible
        and selected.wildcard_rank = v_wildcard_slots
        and selected.wildcard_ranking_path = next_candidate.wildcard_ranking_path
      limit 1
    )
    update public.league_organization_qualification_candidates candidate
    set unresolved = true from boundary
    where candidate.run_id = p_run_id and candidate.eligible
      and candidate.wildcard_rank is not null
      and candidate.wildcard_ranking_path = boundary.wildcard_ranking_path;
  end if;

  update public.league_organization_qualification_runs
  set needs_draw = exists (
    select 1 from public.league_organization_qualification_candidates
    where run_id = p_run_id and eligible and unresolved
  ), updated_at = now()
  where id = p_run_id and status <> 'finalized';
end;
$$;

alter function public.recalculate_league_organization_qualification(uuid)
  rename to recalculate_league_organization_qualification_before_participation;

create or replace function public.recalculate_league_organization_qualification(p_run_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.recalculate_league_organization_qualification_before_participation(p_run_id);
  perform public.apply_league_qualification_eligibility(p_run_id);
end;
$$;

create or replace function public.lock_league_organization_pod_standings(
  p_pod_id uuid,
  p_expected_run_revision bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pod public.league_organization_pods%rowtype;
  v_season public.league_organization_seasons%rowtype;
  v_run public.league_organization_qualification_runs%rowtype;
  v_snapshot public.league_state_snapshots%rowtype;
  v_state jsonb;
  v_team_count integer;
  v_playable_matches integer;
  v_candidate_count integer;
begin
  select * into v_pod from public.league_organization_pods where id = p_pod_id for update;
  if not found then raise exception 'Pod not found.'; end if;
  select * into v_season from public.league_organization_seasons where id = v_pod.season_id for update;
  if not public.is_league_organization_admin(v_season.organization_id)
     or not public.is_league_staff(v_pod.league_id) then
    raise exception 'Locking pod standings requires organization and source-league authority.';
  end if;
  select * into v_run from public.league_organization_qualification_runs
  where season_id = v_season.id for update;
  if not found or v_run.status <> 'collecting' then
    raise exception 'This qualification run is not collecting pod standings.';
  end if;
  if p_expected_run_revision is null or v_run.revision <> p_expected_run_revision then
    raise exception 'Qualification changed in another session. Refresh before locking this pod.';
  end if;
  if v_pod.status <> 'active' then raise exception 'Only an active pod can lock standings.'; end if;
  if exists (
    select 1 from public.league_organization_qualification_candidates
    where run_id = v_run.id and pod_id = v_pod.id
  ) then raise exception 'This pod already has locked standings.'; end if;

  select * into v_snapshot from public.league_state_snapshots where league_id = v_pod.league_id;
  if not found then raise exception 'The source league has no authoritative state snapshot.'; end if;
  v_state := v_snapshot.state;
  if coalesce((v_state ->> 'seasonNumber')::integer, 1) <> v_pod.league_season_number then
    raise exception 'The source league season number no longer matches this pod.';
  end if;
  if jsonb_typeof(v_state -> 'teams') <> 'array'
     or jsonb_typeof(v_state -> 'rosters') <> 'array'
     or jsonb_typeof(v_state -> 'schedule') <> 'array'
     or jsonb_typeof(v_state -> 'matchResults') <> 'object' then
    raise exception 'The source league does not have a complete qualification snapshot.';
  end if;
  v_team_count := jsonb_array_length(v_state -> 'teams');
  if v_team_count < 2 or v_team_count > 64
     or jsonb_array_length(v_state -> 'rosters') <> v_team_count then
    raise exception 'The source league must contain 2 to 64 teams with matching rosters.';
  end if;
  if exists (
    select 1 from jsonb_array_elements(v_state -> 'rosters') roster
    where jsonb_typeof(roster.value) <> 'array' or jsonb_array_length(roster.value) = 0
  ) then raise exception 'Every source team must have a non-empty roster before qualification.'; end if;
  if exists (
    select 1 from jsonb_array_elements(v_state -> 'schedule') week
    where jsonb_typeof(week.value) <> 'array'
  ) then raise exception 'The source schedule contains an invalid week.'; end if;
  if exists (
    select 1
    from jsonb_array_elements(v_state -> 'schedule') week
    cross join lateral jsonb_array_elements(week.value) match
    where jsonb_typeof(match.value) <> 'array' or jsonb_array_length(match.value) <> 2
       or (match.value ->> 0) !~ '^[0-9]+$' or (match.value ->> 1) !~ '^[0-9]+$'
       or (match.value ->> 0)::integer < 0 or (match.value ->> 1)::integer < 0
       or (match.value ->> 0)::integer >= v_team_count or (match.value ->> 1)::integer >= v_team_count
       or (match.value ->> 0)::integer = (match.value ->> 1)::integer
  ) then raise exception 'The source schedule contains an invalid matchup.'; end if;

  select count(*) into v_playable_matches
  from jsonb_array_elements(v_state -> 'schedule') week
  cross join lateral jsonb_array_elements(week.value) match;
  if v_playable_matches = 0 then raise exception 'The source schedule has no regular-season matches.'; end if;

  if exists (
    select 1
    from jsonb_array_elements(v_state -> 'schedule') with ordinality week(value, week_number)
    cross join lateral jsonb_array_elements(week.value) with ordinality match(value, match_number)
    left join lateral (
      select v_state -> 'matchResults' -> ((week.week_number - 1)::text || '-' || (match.match_number - 1)::text) as result
    ) saved on true
    where saved.result is null or jsonb_typeof(saved.result) <> 'object'
       or not (
         saved.result ->> 'resolution' in ('no-contest', 'left-unplayed')
         or (saved.result ->> 'resolution' = 'forfeit' and saved.result ->> 'outcomeWinner' in ('A', 'B'))
         or (
           coalesce(saved.result ->> 'gamesA', '') ~ '^[0-9]+$'
           and coalesce(saved.result ->> 'gamesB', '') ~ '^[0-9]+$'
           and (saved.result ->> 'gamesA')::integer <> (saved.result ->> 'gamesB')::integer
           and coalesce(saved.result ->> 'monsAliveA', '') ~ '^[0-9]+$'
           and coalesce(saved.result ->> 'monsAliveB', '') ~ '^[0-9]+$'
         )
       )
  ) then raise exception 'Every scheduled match needs a reported result or an explicit commissioner resolution before qualification.'; end if;

  with team_entries as (
    select (team.ordinality - 1)::integer as team_key, team.value as team
    from jsonb_array_elements(v_state -> 'teams') with ordinality team(value, ordinality)
  ), matches as (
    select
      (match.value ->> 0)::integer as team_a,
      (match.value ->> 1)::integer as team_b,
      coalesce((result.value ->> 'gamesA')::integer, 0) as games_a,
      coalesce((result.value ->> 'gamesB')::integer, 0) as games_b,
      coalesce((result.value ->> 'monsAliveA')::integer, 0) as mons_a,
      coalesce((result.value ->> 'monsAliveB')::integer, 0) as mons_b,
      case
        when result.value ->> 'resolution' in ('no-contest', 'left-unplayed') then null
        when result.value ->> 'outcomeWinner' in ('A', 'B') then result.value ->> 'outcomeWinner'
        when (result.value ->> 'gamesA')::integer > (result.value ->> 'gamesB')::integer then 'A'
        else 'B'
      end as winner_side
    from jsonb_array_elements(v_state -> 'schedule') with ordinality week(value, week_number)
    cross join lateral jsonb_array_elements(week.value) with ordinality match(value, match_number)
    cross join lateral (
      select v_state -> 'matchResults' -> ((week.week_number - 1)::text || '-' || (match.match_number - 1)::text) as value
    ) result
  ), contributions as (
    select team_a as team_key, team_b as opponent_key,
      (winner_side = 'A')::integer as won, (winner_side = 'B')::integer as lost,
      games_a as game_wins, games_b as game_losses, mons_a - mons_b as differential,
      case when winner_side = 'A' then 1 else -1 end as head_to_head
    from matches where winner_side is not null
    union all
    select team_b, team_a, (winner_side = 'B')::integer, (winner_side = 'A')::integer,
      games_b, games_a, mons_b - mons_a, case when winner_side = 'B' then 1 else -1 end
    from matches where winner_side is not null
  ), metrics as (
    select team_key, coalesce(sum(won), 0)::integer as wins,
      coalesce(sum(lost), 0)::integer as losses,
      coalesce(sum(game_wins), 0)::integer as game_wins,
      coalesce(sum(game_losses), 0)::integer as game_losses,
      coalesce(sum(differential), 0)::integer as differential
    from contributions group by team_key
  ), head_to_head_pairs as (
    select team_key, opponent_key, sum(head_to_head)::integer as score
    from contributions group by team_key, opponent_key
  )
  insert into public.league_organization_qualification_candidates(
    run_id, season_id, pod_id, source_league_id, source_team_key, source_team_id,
    display_name, manager_user_id, source_state_revision, source_state_rev,
    team_snapshot, roster_snapshot, roster_snapshot_hash, eligible,
    wins, losses, game_wins, game_losses, differential, head_to_head
  )
  select v_run.id, v_season.id, v_pod.id, v_pod.league_id, team_entry.team_key,
    left(coalesce(nullif(team_entry.team ->> 'id', ''), team_entry.team_key::text), 120),
    left(coalesce(nullif(btrim(team_entry.team ->> 'name'), ''), 'Team ' || (team_entry.team_key + 1)), 120),
    case when coalesce(team_entry.team ->> 'claimedByUserId', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then (team_entry.team ->> 'claimedByUserId')::uuid else null end,
    v_snapshot.revision,
    case when coalesce(v_state ->> 'rev', '') ~ '^[0-9]+$' then (v_state ->> 'rev')::bigint else 0 end,
    team_entry.team, v_state #> array['rosters', team_entry.team_key::text],
    encode(extensions.digest((v_state #> array['rosters', team_entry.team_key::text])::text, 'sha256'), 'hex'),
    coalesce(team_entry.team #>> '{seasonStatus,status}', '') <> 'retired',
    coalesce(metric.wins, 0), coalesce(metric.losses, 0),
    coalesce(metric.game_wins, 0), coalesce(metric.game_losses, 0), coalesce(metric.differential, 0),
    coalesce((select jsonb_object_agg(pair.opponent_key::text, pair.score order by pair.opponent_key)
      from head_to_head_pairs pair where pair.team_key = team_entry.team_key), '{}'::jsonb)
  from team_entries team_entry left join metrics metric on metric.team_key = team_entry.team_key;

  get diagnostics v_candidate_count = row_count;
  update public.league_organization_pods set status = 'complete', updated_at = now() where id = v_pod.id;
  update public.league_organization_qualification_runs
  set revision = revision + 1, updated_at = now() where id = v_run.id returning * into v_run;
  perform public.recalculate_league_organization_qualification(v_run.id);
  select * into v_run from public.league_organization_qualification_runs where id = v_run.id;
  insert into public.league_organization_audit_events(organization_id, season_id, actor_id, kind, payload)
  values (v_season.organization_id, v_season.id, auth.uid(), 'pod_standings_locked', jsonb_build_object(
    'run_id', v_run.id, 'pod_id', v_pod.id, 'source_league_id', v_pod.league_id,
    'source_state_revision', v_snapshot.revision, 'candidate_count', v_candidate_count,
    'ineligible_count', (select count(*) from public.league_organization_qualification_candidates where run_id = v_run.id and pod_id = v_pod.id and not eligible)
  ));
  return jsonb_build_object('run_id', v_run.id, 'pod_id', v_pod.id,
    'candidate_count', v_candidate_count, 'status', v_run.status,
    'revision', v_run.revision, 'needs_draw', v_run.needs_draw);
end;
$$;

-- Older clients may still call this signature. It deliberately selects the
-- non-awarding policy instead of retaining the former implicit-forfeit path.
create or replace function public.set_tournament_entrant_status(
  p_tournament_id uuid,
  p_entrant_id uuid,
  p_expected_tournament_revision bigint,
  p_status text,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_round integer := 0;
begin
  select coalesce(event.current_swiss_round, 0) into v_round
  from public.draft_tournament_events event where event.tournament_id = p_tournament_id;
  perform public.set_tournament_participation_status(
    p_tournament_id, p_entrant_id, p_expected_tournament_revision,
    p_status, coalesce(v_round, 0), 'left-unplayed', p_reason
  );
end;
$$;

revoke all on function public.guard_league_participation_state(),
  public.set_league_team_retirement(uuid, integer, bigint, integer, text, text),
  public.reactivate_league_team(uuid, integer, bigint),
  public.get_tournament_participation_statuses(uuid),
  public.set_tournament_participation_status(uuid, uuid, bigint, text, integer, text, text),
  public.reactivate_tournament_participant(uuid, uuid, bigint),
  public.set_tournament_entrant_status(uuid, uuid, bigint, text, text),
  public.apply_league_qualification_eligibility(uuid),
  public.recalculate_league_organization_qualification(uuid),
  public.recalculate_league_organization_qualification_before_participation(uuid),
  public.lock_league_organization_pod_standings(uuid, bigint)
from public, anon, authenticated, service_role;

grant execute on function public.set_league_team_retirement(uuid, integer, bigint, integer, text, text),
  public.reactivate_league_team(uuid, integer, bigint),
  public.set_tournament_participation_status(uuid, uuid, bigint, text, integer, text, text),
  public.reactivate_tournament_participant(uuid, uuid, bigint),
  public.set_tournament_entrant_status(uuid, uuid, bigint, text, text)
to authenticated, service_role;

grant execute on function public.get_tournament_participation_statuses(uuid)
to anon, authenticated, service_role;
grant execute on function public.lock_league_organization_pod_standings(uuid, bigint)
to authenticated, service_role;
grant execute on function public.guard_league_participation_state(),
  public.apply_league_qualification_eligibility(uuid),
  public.recalculate_league_organization_qualification(uuid),
  public.recalculate_league_organization_qualification_before_participation(uuid)
to service_role;

commit;
notify pgrst, 'reload schema';
