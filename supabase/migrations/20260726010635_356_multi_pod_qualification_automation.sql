-- Migration 356: auditable multi-pod qualification automation.
-- Source leagues remain authoritative. Organization qualification stores locked
-- standings and exact team/roster snapshots without mutating a league.

begin;

create table public.league_organization_qualification_runs (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null unique references public.league_organization_seasons(id) on delete cascade,
  status text not null default 'collecting'
    check (status in ('collecting', 'review', 'finalized')),
  rules_snapshot jsonb not null check (jsonb_typeof(rules_snapshot) = 'object'),
  pod_count smallint not null check (pod_count between 2 and 64),
  locked_pod_count smallint not null default 0 check (locked_pod_count between 0 and 64),
  needs_draw boolean not null default false,
  revision bigint not null default 0 check (revision >= 0),
  started_by uuid references auth.users(id) on delete set null,
  finalized_by uuid references auth.users(id) on delete set null,
  started_at timestamptz not null default now(),
  finalized_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (id, season_id)
);

create table public.league_organization_qualification_candidates (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null,
  season_id uuid not null,
  pod_id uuid not null,
  source_league_id uuid not null,
  source_team_key integer not null check (source_team_key between 0 and 255),
  source_team_id text not null check (char_length(source_team_id) between 1 and 120),
  display_name text not null check (char_length(btrim(display_name)) between 1 and 120),
  manager_user_id uuid references auth.users(id) on delete set null,
  source_state_revision bigint not null check (source_state_revision >= 0),
  source_state_rev bigint not null check (source_state_rev >= 0),
  team_snapshot jsonb not null check (jsonb_typeof(team_snapshot) = 'object'),
  roster_snapshot jsonb not null check (jsonb_typeof(roster_snapshot) = 'array'),
  roster_snapshot_hash text not null check (roster_snapshot_hash ~ '^[0-9a-f]{64}$'),
  wins integer not null default 0 check (wins >= 0),
  losses integer not null default 0 check (losses >= 0),
  game_wins integer not null default 0 check (game_wins >= 0),
  game_losses integer not null default 0 check (game_losses >= 0),
  differential integer not null default 0,
  head_to_head jsonb not null default '{}'::jsonb check (jsonb_typeof(head_to_head) = 'object'),
  ranking_path bigint[] not null default '{}'::bigint[],
  wildcard_ranking_path bigint[] not null default '{}'::bigint[],
  pod_rank smallint check (pod_rank between 1 and 64),
  wildcard_rank integer check (wildcard_rank between 1 and 4096),
  selected_kind text check (selected_kind in ('pod-finish', 'wildcard')),
  draw_rank bigint check (draw_rank is null or draw_rank > 0),
  unresolved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (run_id, pod_id, source_team_key),
  unique (id, run_id),
  foreign key (run_id, season_id)
    references public.league_organization_qualification_runs(id, season_id) on delete cascade,
  foreign key (pod_id, season_id, source_league_id)
    references public.league_organization_pods(id, season_id, league_id) on delete restrict
);

create index league_organization_qualification_candidates_run_idx
  on public.league_organization_qualification_candidates(run_id, pod_id, pod_rank);
create index league_organization_qualification_candidates_selected_idx
  on public.league_organization_qualification_candidates(season_id, selected_kind, wildcard_rank);

alter table public.league_organization_qualification_runs enable row level security;
alter table public.league_organization_qualification_candidates enable row level security;

revoke all on
  public.league_organization_qualification_runs,
  public.league_organization_qualification_candidates
from public, anon, authenticated;

grant all on
  public.league_organization_qualification_runs,
  public.league_organization_qualification_candidates
to service_role;

create or replace function public.recalculate_league_organization_qualification(
  p_run_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run public.league_organization_qualification_runs%rowtype;
  v_rule text;
  v_wildcard_slots integer;
  v_has_draw boolean;
  v_locked_pods integer;
begin
  select * into v_run
  from public.league_organization_qualification_runs
  where id = p_run_id
  for update;
  if not found then raise exception 'Qualification run not found.'; end if;

  v_wildcard_slots := coalesce((v_run.rules_snapshot ->> 'wildcard_slots')::integer, 0);
  v_has_draw := coalesce(v_run.rules_snapshot -> 'tiebreakers', '[]'::jsonb) ? 'commissioner-draw';

  update public.league_organization_qualification_candidates
  set ranking_path = '{}'::bigint[],
      wildcard_ranking_path = '{}'::bigint[],
      pod_rank = null,
      wildcard_rank = null,
      selected_kind = null,
      unresolved = false,
      updated_at = now()
  where run_id = v_run.id;

  for v_rule in
    select value
    from jsonb_array_elements_text(coalesce(v_run.rules_snapshot -> 'tiebreakers', '[]'::jsonb))
  loop
    if v_rule = 'commissioner-draw' then continue; end if;
    if v_rule = 'wins' then
      update public.league_organization_qualification_candidates
      set ranking_path = array_append(ranking_path, wins::bigint)
      where run_id = v_run.id;
    elsif v_rule = 'differential' then
      update public.league_organization_qualification_candidates
      set ranking_path = array_append(ranking_path, differential::bigint)
      where run_id = v_run.id;
    elsif v_rule = 'game-win-percentage' then
      update public.league_organization_qualification_candidates
      set ranking_path = array_append(
        ranking_path,
        case when game_wins + game_losses = 0 then 0
          else round(1000000.0 * game_wins / (game_wins + game_losses))::bigint end
      )
      where run_id = v_run.id;
    elsif v_rule = 'head-to-head' then
      with scores as (
        select candidate.id,
          coalesce(sum(case when opponent.id is null then 0 else pair.value::integer end), 0)::bigint as score
        from public.league_organization_qualification_candidates candidate
        left join lateral jsonb_each_text(candidate.head_to_head) pair on true
        left join public.league_organization_qualification_candidates opponent
          on opponent.run_id = candidate.run_id
         and opponent.pod_id = candidate.pod_id
         and opponent.source_team_key = case when pair.key ~ '^[0-9]+$' then pair.key::integer else -1 end
         and opponent.ranking_path = candidate.ranking_path
        where candidate.run_id = v_run.id
        group by candidate.id
      )
      update public.league_organization_qualification_candidates candidate
      set ranking_path = array_append(candidate.ranking_path, scores.score)
      from scores
      where candidate.id = scores.id;
    end if;
  end loop;

  if v_has_draw then
    update public.league_organization_qualification_candidates
    set ranking_path = array_append(ranking_path, coalesce(draw_rank, 0))
    where run_id = v_run.id;
  end if;

  with ranked as (
    select candidate.id,
      row_number() over (
        partition by candidate.pod_id
        order by candidate.ranking_path desc, candidate.source_team_key
      ) as rank
    from public.league_organization_qualification_candidates candidate
    where candidate.run_id = v_run.id
  )
  update public.league_organization_qualification_candidates candidate
  set pod_rank = ranked.rank
  from ranked
  where candidate.id = ranked.id;

  update public.league_organization_qualification_candidates candidate
  set selected_kind = 'pod-finish'
  from public.league_organization_pods pod
  where candidate.run_id = v_run.id
    and pod.id = candidate.pod_id
    and candidate.pod_rank <= pod.qualification_spots;

  for v_rule in
    select value
    from jsonb_array_elements_text(coalesce(v_run.rules_snapshot -> 'tiebreakers', '[]'::jsonb))
  loop
    if v_rule = 'commissioner-draw' then continue; end if;
    if v_rule = 'wins' then
      update public.league_organization_qualification_candidates
      set wildcard_ranking_path = array_append(wildcard_ranking_path, wins::bigint)
      where run_id = v_run.id and selected_kind is null;
    elsif v_rule = 'differential' then
      update public.league_organization_qualification_candidates
      set wildcard_ranking_path = array_append(wildcard_ranking_path, differential::bigint)
      where run_id = v_run.id and selected_kind is null;
    elsif v_rule = 'game-win-percentage' then
      update public.league_organization_qualification_candidates
      set wildcard_ranking_path = array_append(
        wildcard_ranking_path,
        case when game_wins + game_losses = 0 then 0
          else round(1000000.0 * game_wins / (game_wins + game_losses))::bigint end
      )
      where run_id = v_run.id and selected_kind is null;
    elsif v_rule = 'head-to-head' then
      with scores as (
        select candidate.id,
          coalesce(sum(case when opponent.id is null then 0 else pair.value::integer end), 0)::bigint as score
        from public.league_organization_qualification_candidates candidate
        left join lateral jsonb_each_text(candidate.head_to_head) pair on true
        left join public.league_organization_qualification_candidates opponent
          on opponent.run_id = candidate.run_id
         and opponent.pod_id = candidate.pod_id
         and opponent.source_team_key = case when pair.key ~ '^[0-9]+$' then pair.key::integer else -1 end
         and opponent.selected_kind is null
         and opponent.wildcard_ranking_path = candidate.wildcard_ranking_path
        where candidate.run_id = v_run.id and candidate.selected_kind is null
        group by candidate.id
      )
      update public.league_organization_qualification_candidates candidate
      set wildcard_ranking_path = array_append(candidate.wildcard_ranking_path, scores.score)
      from scores
      where candidate.id = scores.id;
    end if;
  end loop;

  if v_has_draw then
    update public.league_organization_qualification_candidates
    set wildcard_ranking_path = array_append(wildcard_ranking_path, coalesce(draw_rank, 0))
    where run_id = v_run.id and selected_kind is null;
  end if;

  with ranked as (
    select candidate.id,
      row_number() over (
        order by candidate.wildcard_ranking_path desc, candidate.pod_id, candidate.source_team_key
      ) as rank
    from public.league_organization_qualification_candidates candidate
    where candidate.run_id = v_run.id and candidate.selected_kind is null
  )
  update public.league_organization_qualification_candidates candidate
  set wildcard_rank = ranked.rank
  from ranked
  where candidate.id = ranked.id;

  if v_wildcard_slots > 0 then
    update public.league_organization_qualification_candidates
    set selected_kind = 'wildcard'
    where run_id = v_run.id
      and selected_kind is null
      and wildcard_rank <= v_wildcard_slots;
  end if;

  with boundaries as (
    select boundary.pod_id, boundary.ranking_path
    from public.league_organization_qualification_candidates boundary
    join public.league_organization_pods pod on pod.id = boundary.pod_id
    join public.league_organization_qualification_candidates next_candidate
      on next_candidate.run_id = boundary.run_id
     and next_candidate.pod_id = boundary.pod_id
     and next_candidate.pod_rank = pod.qualification_spots + 1
    where boundary.run_id = v_run.id
      and boundary.pod_rank = pod.qualification_spots
      and boundary.ranking_path = next_candidate.ranking_path
  )
  update public.league_organization_qualification_candidates candidate
  set unresolved = true
  from boundaries
  where candidate.run_id = v_run.id
    and candidate.pod_id = boundaries.pod_id
    and candidate.ranking_path = boundaries.ranking_path;

  if v_wildcard_slots > 0 then
    with boundary as (
      select selected.wildcard_ranking_path
      from public.league_organization_qualification_candidates selected
      join public.league_organization_qualification_candidates next_candidate
        on next_candidate.run_id = selected.run_id
       and next_candidate.wildcard_rank = v_wildcard_slots + 1
      where selected.run_id = v_run.id
        and selected.wildcard_rank = v_wildcard_slots
        and selected.wildcard_ranking_path = next_candidate.wildcard_ranking_path
      limit 1
    )
    update public.league_organization_qualification_candidates candidate
    set unresolved = true
    from boundary
    where candidate.run_id = v_run.id
      and candidate.wildcard_rank is not null
      and candidate.wildcard_ranking_path = boundary.wildcard_ranking_path;
  end if;

  select count(distinct pod_id) into v_locked_pods
  from public.league_organization_qualification_candidates
  where run_id = v_run.id;

  update public.league_organization_qualification_runs
  set locked_pod_count = v_locked_pods,
      status = case when v_locked_pods = pod_count then 'review' else 'collecting' end,
      needs_draw = exists (
        select 1 from public.league_organization_qualification_candidates
        where run_id = v_run.id and unresolved
      ),
      updated_at = now()
  where id = v_run.id and status <> 'finalized';
end;
$$;

create or replace function public.begin_league_organization_qualification(
  p_season_id uuid,
  p_expected_revision bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_season public.league_organization_seasons%rowtype;
  v_run public.league_organization_qualification_runs%rowtype;
  v_pod_count integer;
  v_total_slots integer;
  v_tiebreakers jsonb;
begin
  select * into v_season from public.league_organization_seasons
  where id = p_season_id for update;
  if not found or not public.is_league_organization_admin(v_season.organization_id) then
    raise exception 'Only organization administrators can begin qualification.';
  end if;
  if v_season.status <> 'active' then raise exception 'Only an active season can begin qualification.'; end if;
  if p_expected_revision is null or v_season.revision <> p_expected_revision then
    raise exception 'The organization season changed in another session. Refresh before beginning qualification.';
  end if;
  if exists (select 1 from public.league_organization_qualification_runs where season_id = v_season.id) then
    raise exception 'Qualification has already started for this season.';
  end if;

  select count(*), coalesce(sum(qualification_spots), 0)
  into v_pod_count, v_total_slots
  from public.league_organization_pods
  where season_id = v_season.id and status = 'active';
  v_total_slots := v_total_slots + coalesce((v_season.qualification_rules ->> 'wildcard_slots')::integer, 0);
  if v_pod_count < 2 then raise exception 'Qualification requires at least two active pods.'; end if;
  if v_total_slots < 2 or v_total_slots > 64 then
    raise exception 'The configured qualification places must total between 2 and 64.';
  end if;

  v_tiebreakers := coalesce(v_season.qualification_rules -> 'tiebreakers', '[]'::jsonb);
  if jsonb_typeof(v_tiebreakers) <> 'array' or jsonb_array_length(v_tiebreakers) = 0 then
    raise exception 'Qualification requires an ordered tiebreaker list.';
  end if;
  if v_tiebreakers ? 'commissioner-draw'
     and v_tiebreakers ->> (jsonb_array_length(v_tiebreakers) - 1) <> 'commissioner-draw' then
    raise exception 'Commissioner draw must be the final tiebreaker.';
  end if;

  insert into public.league_organization_qualification_runs(
    season_id, rules_snapshot, pod_count, started_by
  ) values (
    v_season.id, v_season.qualification_rules, v_pod_count, auth.uid()
  ) returning * into v_run;

  update public.league_organization_seasons
  set status = 'qualification', revision = revision + 1, updated_at = now()
  where id = v_season.id
  returning * into v_season;
  update public.league_organizations
  set revision = revision + 1, updated_at = now()
  where id = v_season.organization_id;
  insert into public.league_organization_audit_events(organization_id, season_id, actor_id, kind, payload)
  values (
    v_season.organization_id, v_season.id, auth.uid(), 'qualification_started',
    jsonb_build_object('run_id', v_run.id, 'pod_count', v_pod_count, 'qualification_slots', v_total_slots)
  );
  return jsonb_build_object('run_id', v_run.id, 'status', v_run.status, 'revision', v_run.revision);
end;
$$;

create or replace function public.lock_league_organization_pod_standings(
  p_pod_id uuid,
  p_expected_run_revision bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
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

  select * into v_snapshot from public.league_state_snapshots
  where league_id = v_pod.league_id;
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
    select 1 from jsonb_array_elements(v_state -> 'schedule') week
    where jsonb_typeof(week.value) <> 'array'
  ) then raise exception 'The source schedule contains an invalid week.'; end if;
  if exists (
    select 1
    from jsonb_array_elements(v_state -> 'rosters') roster
    where jsonb_typeof(roster.value) <> 'array' or jsonb_array_length(roster.value) = 0
  ) then raise exception 'Every source team must have a non-empty roster before qualification.'; end if;

  if exists (
    select 1
    from jsonb_array_elements(v_state -> 'schedule') with ordinality week(value, week_number)
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(week.value) = 'array' then week.value else '[]'::jsonb end
    ) with ordinality match(value, match_number)
    where jsonb_typeof(match.value) <> 'array'
       or jsonb_array_length(match.value) <> 2
       or (match.value ->> 0) !~ '^[0-9]+$'
       or (match.value ->> 1) !~ '^[0-9]+$'
       or (match.value ->> 0)::integer < 0
       or (match.value ->> 1)::integer < 0
       or (match.value ->> 0)::integer >= v_team_count
       or (match.value ->> 1)::integer >= v_team_count
       or (match.value ->> 0)::integer = (match.value ->> 1)::integer
  ) then raise exception 'The source schedule contains an invalid matchup.'; end if;

  select count(*) into v_playable_matches
  from jsonb_array_elements(v_state -> 'schedule') with ordinality week(value, week_number)
  cross join lateral jsonb_array_elements(week.value) with ordinality match(value, match_number);
  if v_playable_matches = 0 then raise exception 'The source schedule has no regular-season matches.'; end if;

  if exists (
    select 1
    from jsonb_array_elements(v_state -> 'schedule') with ordinality week(value, week_number)
    cross join lateral jsonb_array_elements(week.value) with ordinality match(value, match_number)
    left join lateral (
      select v_state -> 'matchResults' -> ((week.week_number - 1)::text || '-' || (match.match_number - 1)::text) as result
    ) saved on true
    where saved.result is null
       or jsonb_typeof(saved.result) <> 'object'
       or coalesce(saved.result ->> 'gamesA', '') !~ '^[0-9]+$'
       or coalesce(saved.result ->> 'gamesB', '') !~ '^[0-9]+$'
       or (saved.result ->> 'gamesA')::integer = (saved.result ->> 'gamesB')::integer
       or coalesce(saved.result ->> 'monsAliveA', '') !~ '^[0-9]+$'
       or coalesce(saved.result ->> 'monsAliveB', '') !~ '^[0-9]+$'
  ) then raise exception 'Every scheduled match needs a valid reported result before qualification.'; end if;

  with team_entries as (
    select (team.ordinality - 1)::integer as team_key, team.value as team
    from jsonb_array_elements(v_state -> 'teams') with ordinality team(value, ordinality)
  ), matches as (
    select
      (match.value ->> 0)::integer as team_a,
      (match.value ->> 1)::integer as team_b,
      (result.value ->> 'gamesA')::integer as games_a,
      (result.value ->> 'gamesB')::integer as games_b,
      (result.value ->> 'monsAliveA')::integer as mons_a,
      (result.value ->> 'monsAliveB')::integer as mons_b
    from jsonb_array_elements(v_state -> 'schedule') with ordinality week(value, week_number)
    cross join lateral jsonb_array_elements(week.value) with ordinality match(value, match_number)
    cross join lateral (
      select v_state -> 'matchResults' -> ((week.week_number - 1)::text || '-' || (match.match_number - 1)::text) as value
    ) result
  ), contributions as (
    select team_a as team_key, team_b as opponent_key,
      (games_a > games_b)::integer as won,
      (games_a < games_b)::integer as lost,
      games_a as game_wins, games_b as game_losses,
      mons_a - mons_b as differential,
      case when games_a > games_b then 1 else -1 end as head_to_head
    from matches
    union all
    select team_b, team_a,
      (games_b > games_a)::integer,
      (games_b < games_a)::integer,
      games_b, games_a,
      mons_b - mons_a,
      case when games_b > games_a then 1 else -1 end
    from matches
  ), metrics as (
    select team_key,
      coalesce(sum(won), 0)::integer as wins,
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
    team_snapshot, roster_snapshot, roster_snapshot_hash,
    wins, losses, game_wins, game_losses, differential, head_to_head
  )
  select
    v_run.id, v_season.id, v_pod.id, v_pod.league_id, team_entry.team_key,
    left(coalesce(nullif(team_entry.team ->> 'id', ''), team_entry.team_key::text), 120),
    left(coalesce(nullif(btrim(team_entry.team ->> 'name'), ''), 'Team ' || (team_entry.team_key + 1)), 120),
    case when coalesce(team_entry.team ->> 'claimedByUserId', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then (team_entry.team ->> 'claimedByUserId')::uuid else null end,
    v_snapshot.revision,
    case when coalesce(v_state ->> 'rev', '') ~ '^[0-9]+$' then (v_state ->> 'rev')::bigint else 0 end,
    team_entry.team,
    v_state #> array['rosters', team_entry.team_key::text],
    encode(digest((v_state #> array['rosters', team_entry.team_key::text])::text, 'sha256'), 'hex'),
    coalesce(metric.wins, 0), coalesce(metric.losses, 0),
    coalesce(metric.game_wins, 0), coalesce(metric.game_losses, 0), coalesce(metric.differential, 0),
    coalesce((
      select jsonb_object_agg(pair.opponent_key::text, pair.score order by pair.opponent_key)
      from head_to_head_pairs pair where pair.team_key = team_entry.team_key
    ), '{}'::jsonb)
  from team_entries team_entry
  left join metrics metric on metric.team_key = team_entry.team_key;

  get diagnostics v_candidate_count = row_count;
  update public.league_organization_pods
  set status = 'complete', updated_at = now()
  where id = v_pod.id;
  update public.league_organization_qualification_runs
  set revision = revision + 1, updated_at = now()
  where id = v_run.id
  returning * into v_run;
  perform public.recalculate_league_organization_qualification(v_run.id);
  select * into v_run from public.league_organization_qualification_runs where id = v_run.id;

  insert into public.league_organization_audit_events(organization_id, season_id, actor_id, kind, payload)
  values (
    v_season.organization_id, v_season.id, auth.uid(), 'pod_standings_locked',
    jsonb_build_object(
      'run_id', v_run.id, 'pod_id', v_pod.id, 'source_league_id', v_pod.league_id,
      'source_state_revision', v_snapshot.revision, 'candidate_count', v_candidate_count
    )
  );
  return jsonb_build_object(
    'run_id', v_run.id, 'pod_id', v_pod.id, 'candidate_count', v_candidate_count,
    'status', v_run.status, 'revision', v_run.revision, 'needs_draw', v_run.needs_draw
  );
end;
$$;

create or replace function public.record_league_organization_qualification_draw(
  p_run_id uuid,
  p_expected_revision bigint,
  p_candidate_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run public.league_organization_qualification_runs%rowtype;
  v_season public.league_organization_seasons%rowtype;
  v_expected_count integer;
  v_base bigint;
begin
  select * into v_run from public.league_organization_qualification_runs
  where id = p_run_id for update;
  if not found then raise exception 'Qualification run not found.'; end if;
  select * into v_season from public.league_organization_seasons where id = v_run.season_id;
  if not public.is_league_organization_admin(v_season.organization_id) then
    raise exception 'Only organization administrators can record a qualification draw.';
  end if;
  if v_run.status <> 'review' or not v_run.needs_draw then
    raise exception 'This qualification review does not need a commissioner draw.';
  end if;
  if p_expected_revision is null or v_run.revision <> p_expected_revision then
    raise exception 'Qualification changed in another session. Refresh before recording the draw.';
  end if;
  if not (coalesce(v_run.rules_snapshot -> 'tiebreakers', '[]'::jsonb) ? 'commissioner-draw') then
    raise exception 'The shared rules do not permit a commissioner draw.';
  end if;
  if p_candidate_ids is null or array_ndims(p_candidate_ids) is distinct from 1 then
    raise exception 'Provide the ordered candidates from the recorded draw.';
  end if;
  select count(*) into v_expected_count
  from public.league_organization_qualification_candidates
  where run_id = v_run.id and unresolved and draw_rank is null;
  if cardinality(p_candidate_ids) <> v_expected_count
     or (select count(distinct item.candidate_id) from unnest(p_candidate_ids) as item(candidate_id)) <> v_expected_count
     or exists (
       select 1 from unnest(p_candidate_ids) as item(candidate_id)
       where not exists (
         select 1 from public.league_organization_qualification_candidates candidate
         where candidate.id = item.candidate_id and candidate.run_id = v_run.id
           and candidate.unresolved and candidate.draw_rank is null
       )
     ) then raise exception 'The draw order must contain every unresolved candidate exactly once.'; end if;

  select coalesce(max(draw_rank), 0) into v_base
  from public.league_organization_qualification_candidates where run_id = v_run.id;
  update public.league_organization_qualification_candidates candidate
  set draw_rank = v_base + v_expected_count - ordered.ordinality + 1,
      updated_at = now()
  from unnest(p_candidate_ids) with ordinality ordered(candidate_id, ordinality)
  where candidate.id = ordered.candidate_id and candidate.run_id = v_run.id;

  update public.league_organization_qualification_runs
  set revision = revision + 1, updated_at = now()
  where id = v_run.id returning * into v_run;
  perform public.recalculate_league_organization_qualification(v_run.id);
  select * into v_run from public.league_organization_qualification_runs where id = v_run.id;
  insert into public.league_organization_audit_events(organization_id, season_id, actor_id, kind, payload)
  values (
    v_season.organization_id, v_season.id, auth.uid(), 'qualification_draw_recorded',
    jsonb_build_object('run_id', v_run.id, 'candidate_count', v_expected_count)
  );
  return jsonb_build_object('run_id', v_run.id, 'revision', v_run.revision, 'needs_draw', v_run.needs_draw);
end;
$$;

create or replace function public.finalize_league_organization_qualification(
  p_run_id uuid,
  p_expected_revision bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run public.league_organization_qualification_runs%rowtype;
  v_season public.league_organization_seasons%rowtype;
  v_qualifier_count integer;
begin
  select * into v_run from public.league_organization_qualification_runs
  where id = p_run_id for update;
  if not found then raise exception 'Qualification run not found.'; end if;
  select * into v_season from public.league_organization_seasons where id = v_run.season_id for update;
  if not public.is_league_organization_admin(v_season.organization_id) then
    raise exception 'Only organization administrators can finalize qualification.';
  end if;
  if v_run.status <> 'review' or v_run.locked_pod_count <> v_run.pod_count then
    raise exception 'Every pod must lock its final standings before qualification can be finalized.';
  end if;
  if v_run.needs_draw then raise exception 'Resolve the recorded commissioner draw before finalizing qualification.'; end if;
  if p_expected_revision is null or v_run.revision <> p_expected_revision then
    raise exception 'Qualification changed in another session. Refresh before finalizing.';
  end if;
  if exists (select 1 from public.league_organization_qualifiers where season_id = v_season.id) then
    raise exception 'Qualifiers have already been recorded for this season.';
  end if;
  if exists (
    select 1
    from public.league_organization_qualification_candidates candidate
    left join public.league_state_snapshots snapshot on snapshot.league_id = candidate.source_league_id
    where candidate.run_id = v_run.id
      and (
        snapshot.league_id is null
        or snapshot.revision <> candidate.source_state_revision
        or case when coalesce(snapshot.state ->> 'rev', '') ~ '^[0-9]+$'
          then (snapshot.state ->> 'rev')::bigint else 0 end <> candidate.source_state_rev
      )
  ) then raise exception 'A source pod changed after its standings were locked. Cancel and restart qualification.'; end if;

  insert into public.league_organization_qualifiers(
    season_id, pod_id, source_league_id, source_team_key, source_team_id,
    display_name, manager_user_id, placement, qualification_kind, status,
    source_state_revision, source_state_rev, team_snapshot, roster_snapshot,
    roster_snapshot_hash, qualification_basis
  )
  select
    candidate.season_id, candidate.pod_id, candidate.source_league_id,
    candidate.source_team_key, candidate.source_team_id, candidate.display_name,
    candidate.manager_user_id, candidate.pod_rank, candidate.selected_kind, 'qualified',
    candidate.source_state_revision, candidate.source_state_rev,
    candidate.team_snapshot, candidate.roster_snapshot, candidate.roster_snapshot_hash,
    jsonb_build_object(
      'qualification_run_id', candidate.run_id,
      'wins', candidate.wins, 'losses', candidate.losses,
      'game_wins', candidate.game_wins, 'game_losses', candidate.game_losses,
      'differential', candidate.differential,
      'pod_rank', candidate.pod_rank, 'wildcard_rank', candidate.wildcard_rank,
      'rules', v_run.rules_snapshot
    )
  from public.league_organization_qualification_candidates candidate
  where candidate.run_id = v_run.id and candidate.selected_kind is not null;
  get diagnostics v_qualifier_count = row_count;
  if v_qualifier_count < 2 or v_qualifier_count > 64 then
    raise exception 'Qualification must produce between 2 and 64 teams.';
  end if;

  update public.league_organization_qualification_runs
  set status = 'finalized', finalized_by = auth.uid(), finalized_at = now(),
      revision = revision + 1, updated_at = now()
  where id = v_run.id returning * into v_run;
  update public.league_organization_seasons
  set revision = revision + 1, updated_at = now()
  where id = v_season.id;
  update public.league_organizations
  set revision = revision + 1, updated_at = now()
  where id = v_season.organization_id;
  insert into public.league_organization_audit_events(organization_id, season_id, actor_id, kind, payload)
  values (
    v_season.organization_id, v_season.id, auth.uid(), 'qualification_finalized',
    jsonb_build_object('run_id', v_run.id, 'qualifier_count', v_qualifier_count)
  );
  return jsonb_build_object(
    'run_id', v_run.id, 'status', v_run.status,
    'revision', v_run.revision, 'qualifier_count', v_qualifier_count
  );
end;
$$;

create or replace function public.cancel_league_organization_qualification(
  p_run_id uuid,
  p_expected_revision bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run public.league_organization_qualification_runs%rowtype;
  v_season public.league_organization_seasons%rowtype;
begin
  select * into v_run from public.league_organization_qualification_runs
  where id = p_run_id for update;
  if not found then raise exception 'Qualification run not found.'; end if;
  select * into v_season from public.league_organization_seasons where id = v_run.season_id for update;
  if not public.is_league_organization_admin(v_season.organization_id) then
    raise exception 'Only organization administrators can cancel qualification.';
  end if;
  if v_run.status = 'finalized' then raise exception 'Finalized qualification cannot be cancelled.'; end if;
  if p_expected_revision is null or v_run.revision <> p_expected_revision then
    raise exception 'Qualification changed in another session. Refresh before cancelling.';
  end if;

  delete from public.league_organization_qualification_runs where id = v_run.id;
  update public.league_organization_pods
  set status = 'active', updated_at = now()
  where season_id = v_season.id and status = 'complete';
  update public.league_organization_seasons
  set status = 'active', revision = revision + 1, updated_at = now()
  where id = v_season.id;
  update public.league_organizations
  set revision = revision + 1, updated_at = now()
  where id = v_season.organization_id;
  insert into public.league_organization_audit_events(organization_id, season_id, actor_id, kind, payload)
  values (
    v_season.organization_id, v_season.id, auth.uid(), 'qualification_cancelled',
    jsonb_build_object('run_id', v_run.id)
  );
  return jsonb_build_object('season_id', v_season.id, 'status', 'active');
end;
$$;

create or replace function public.sync_league_organization_qualifier_manager(
  p_qualifier_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_qualifier public.league_organization_qualifiers%rowtype;
  v_season public.league_organization_seasons%rowtype;
  v_snapshot public.league_state_snapshots%rowtype;
  v_team jsonb;
  v_roster jsonb;
  v_manager_id uuid;
begin
  select * into v_qualifier from public.league_organization_qualifiers
  where id = p_qualifier_id for update;
  if not found then raise exception 'Qualifier not found.'; end if;
  select * into v_season from public.league_organization_seasons where id = v_qualifier.season_id;
  if not public.is_league_organization_admin(v_season.organization_id)
     or not public.is_league_staff(v_qualifier.source_league_id) then
    raise exception 'Synchronizing a replacement requires organization and source-league authority.';
  end if;
  if exists (
    select 1 from public.league_organization_championships where season_id = v_season.id
  ) then raise exception 'Use championship recovery after the connected championship has been created.'; end if;

  select * into v_snapshot from public.league_state_snapshots
  where league_id = v_qualifier.source_league_id;
  if not found then raise exception 'The source league state is unavailable.'; end if;
  v_team := v_snapshot.state #> array['teams', v_qualifier.source_team_key::text];
  v_roster := v_snapshot.state #> array['rosters', v_qualifier.source_team_key::text];
  if jsonb_typeof(v_team) <> 'object'
     or coalesce(nullif(v_team ->> 'id', ''), v_qualifier.source_team_key::text) <> v_qualifier.source_team_id
     or jsonb_typeof(v_roster) <> 'array'
     or encode(digest(v_roster::text, 'sha256'), 'hex') <> v_qualifier.roster_snapshot_hash then
    raise exception 'The source team or roster changed after qualification; manager synchronization was not applied.';
  end if;
  v_manager_id := case when coalesce(v_team ->> 'claimedByUserId', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    then (v_team ->> 'claimedByUserId')::uuid else null end;
  update public.league_organization_qualifiers
  set manager_user_id = v_manager_id
  where id = v_qualifier.id;
  insert into public.league_organization_audit_events(organization_id, season_id, actor_id, kind, payload)
  values (
    v_season.organization_id, v_season.id, auth.uid(), 'qualifier_manager_synchronized',
    jsonb_build_object('qualifier_id', v_qualifier.id, 'manager_present', v_manager_id is not null)
  );
  return jsonb_build_object('qualifier_id', v_qualifier.id, 'manager_present', v_manager_id is not null);
end;
$$;

create or replace function public.get_league_organization_qualification_workspace(
  p_organization_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_league_organization_admin(p_organization_id) then return null; end if;
  return jsonb_build_object(
    'runs', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', run.id,
        'season_id', run.season_id,
        'status', run.status,
        'rules_snapshot', run.rules_snapshot,
        'pod_count', run.pod_count,
        'locked_pod_count', run.locked_pod_count,
        'needs_draw', run.needs_draw,
        'revision', run.revision,
        'started_at', run.started_at,
        'finalized_at', run.finalized_at,
        'candidates', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', candidate.id,
            'pod_id', candidate.pod_id,
            'pod_label', pod.label,
            'source_team_key', candidate.source_team_key,
            'display_name', candidate.display_name,
            'wins', candidate.wins,
            'losses', candidate.losses,
            'game_wins', candidate.game_wins,
            'game_losses', candidate.game_losses,
            'differential', candidate.differential,
            'pod_rank', candidate.pod_rank,
            'wildcard_rank', candidate.wildcard_rank,
            'selected_kind', candidate.selected_kind,
            'unresolved', candidate.unresolved,
            'draw_recorded', candidate.draw_rank is not null,
            'roster_size', jsonb_array_length(candidate.roster_snapshot)
          ) order by pod.sort_order, candidate.pod_rank, candidate.source_team_key)
          from public.league_organization_qualification_candidates candidate
          join public.league_organization_pods pod on pod.id = candidate.pod_id
          where candidate.run_id = run.id
        ), '[]'::jsonb),
        'qualifiers', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', qualifier.id,
            'pod_id', qualifier.pod_id,
            'pod_label', pod.label,
            'display_name', qualifier.display_name,
            'placement', qualifier.placement,
            'qualification_kind', qualifier.qualification_kind,
            'status', qualifier.status,
            'roster_size', jsonb_array_length(qualifier.roster_snapshot)
          ) order by pod.sort_order, qualifier.placement, qualifier.display_name)
          from public.league_organization_qualifiers qualifier
          join public.league_organization_pods pod on pod.id = qualifier.pod_id
          where qualifier.season_id = run.season_id
        ), '[]'::jsonb)
      ) order by run.started_at desc)
      from public.league_organization_qualification_runs run
      join public.league_organization_seasons season on season.id = run.season_id
      where season.organization_id = p_organization_id
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.recalculate_league_organization_qualification(uuid)
  from public, anon, authenticated;
revoke all on function public.begin_league_organization_qualification(uuid,bigint)
  from public, anon, authenticated;
revoke all on function public.lock_league_organization_pod_standings(uuid,bigint)
  from public, anon, authenticated;
revoke all on function public.record_league_organization_qualification_draw(uuid,bigint,uuid[])
  from public, anon, authenticated;
revoke all on function public.finalize_league_organization_qualification(uuid,bigint)
  from public, anon, authenticated;
revoke all on function public.cancel_league_organization_qualification(uuid,bigint)
  from public, anon, authenticated;
revoke all on function public.sync_league_organization_qualifier_manager(uuid)
  from public, anon, authenticated;
revoke all on function public.get_league_organization_qualification_workspace(uuid)
  from public, anon, authenticated;

grant execute on function public.recalculate_league_organization_qualification(uuid)
  to service_role;
grant execute on function public.begin_league_organization_qualification(uuid,bigint)
  to authenticated;
grant execute on function public.lock_league_organization_pod_standings(uuid,bigint)
  to authenticated;
grant execute on function public.record_league_organization_qualification_draw(uuid,bigint,uuid[])
  to authenticated;
grant execute on function public.finalize_league_organization_qualification(uuid,bigint)
  to authenticated;
grant execute on function public.cancel_league_organization_qualification(uuid,bigint)
  to authenticated;
grant execute on function public.sync_league_organization_qualifier_manager(uuid)
  to authenticated;
grant execute on function public.get_league_organization_qualification_workspace(uuid)
  to authenticated;

notify pgrst, 'reload schema';

commit;
