-- Keep 16 teams as the safe default, allow an explicit 32-team expansion,
-- and reserve the larger 128-team ceiling for leagues with multiple pods.

begin;

create or replace function public.league_team_limit(p_settings jsonb)
returns integer
language plpgsql
immutable
security invoker
set search_path = public
as $$
declare
  v_mode text := lower(coalesce(p_settings ->> 'leagueScaleMode', 'standard'));
  v_divisions jsonb := coalesce(p_settings -> 'divisions', '[]'::jsonb);
  v_populated_pods integer := 0;
begin
  if v_mode = 'multi-pod' and jsonb_typeof(v_divisions) = 'array' then
    select count(*)
    into v_populated_pods
    from jsonb_array_elements(v_divisions) division(value)
    where jsonb_typeof(division.value) = 'object'
      and jsonb_typeof(division.value -> 'teamIds') = 'array'
      and jsonb_array_length(division.value -> 'teamIds') > 0;
    if v_populated_pods >= 2 then
      return 128;
    end if;
  end if;
  if v_mode in ('expanded', 'multi-pod') then
    return 32;
  end if;
  return 16;
end;
$$;

comment on function public.league_team_limit(jsonb) is
  'Returns the explicit league-size ceiling: 16 standard, 32 expanded, or 128 for a configured multi-pod league.';

create or replace function public.enforce_league_team_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_count integer;
  v_team_limit integer;
  v_divisions jsonb;
  v_assignment_count integer;
  v_distinct_assignment_count integer;
  v_min_team_index integer;
  v_max_team_index integer;
begin
  if jsonb_typeof(new.state -> 'teams') <> 'array' then
    return new;
  end if;
  v_team_count := jsonb_array_length(new.state -> 'teams');
  if v_team_count = 0 then
    return new;
  end if;
  if v_team_count < 2 then
    raise exception 'A league needs at least 2 teams.';
  end if;
  v_team_limit := public.league_team_limit(new.state -> 'settings');
  if v_team_count > v_team_limit then
    raise exception 'This league has % teams, above its active % team limit.', v_team_count, v_team_limit;
  end if;
  if v_team_count > 32 then
    v_divisions := coalesce(new.state #> '{settings,divisions}', '[]'::jsonb);
    if jsonb_typeof(v_divisions) <> 'array' then
      raise exception 'Every team above 32 must belong to exactly one valid pod.';
    end if;
    if exists (
      select 1
      from jsonb_array_elements(v_divisions) division(value)
      where jsonb_typeof(division.value) <> 'object'
         or jsonb_typeof(division.value -> 'teamIds') <> 'array'
    ) then
      raise exception 'Every team above 32 must belong to exactly one valid pod.';
    end if;
    if exists (
      select 1
      from jsonb_array_elements(v_divisions) division(value)
      cross join lateral jsonb_array_elements(division.value -> 'teamIds') team_id(value)
      where jsonb_typeof(team_id.value) <> 'number'
         or team_id.value #>> '{}' !~ '^[0-9]+$'
    ) then
      raise exception 'Every team above 32 must belong to exactly one valid pod.';
    end if;

    select
      count(*),
      count(distinct (team_id.value #>> '{}')::integer),
      min((team_id.value #>> '{}')::integer),
      max((team_id.value #>> '{}')::integer)
    into v_assignment_count, v_distinct_assignment_count, v_min_team_index, v_max_team_index
    from jsonb_array_elements(v_divisions) division(value)
    cross join lateral jsonb_array_elements(division.value -> 'teamIds') team_id(value);

    if v_assignment_count <> v_team_count
       or v_distinct_assignment_count <> v_team_count
       or v_min_team_index <> 0
       or v_max_team_index <> v_team_count - 1 then
      raise exception 'Every team above 32 must belong to exactly one valid pod.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_league_team_limit on public.league_state_snapshots;
create trigger enforce_league_team_limit
before insert or update of state on public.league_state_snapshots
for each row execute function public.enforce_league_team_limit();

-- These functions predate configurable league-scale modes. Replace only the
-- reviewed guard expressions while retaining their authoritative bodies,
-- ownership, security-definer boundary, and existing grants.
do $migration$
declare
  v_function regprocedure;
  v_definition text;
  v_updated text;
begin
  v_function := to_regprocedure('public.provision_live_snake_draft_v2(uuid,jsonb,jsonb,integer[],jsonb,jsonb,jsonb)');
  if v_function is null then
    raise exception 'provision_live_snake_draft_v2 was not found.';
  end if;
  select pg_get_functiondef(v_function) into v_definition;
  if strpos(v_definition, 'v_team_count > 16') = 0
     or strpos(v_definition, 'A live draft needs between 2 and 16 teams.') = 0
     or strpos(v_definition, 'coalesce(array_length(p_pick_order, 1), 0) > 480') = 0 then
    raise exception 'The live snake provisioning guard no longer matches the reviewed baseline.';
  end if;
  v_updated := replace(
    v_definition,
    'v_team_count > 16',
    'v_team_count > public.league_team_limit(p_settings)'
  );
  v_updated := replace(
    v_updated,
    'A live draft needs between 2 and 16 teams.',
    $replacement$The live draft team count exceeds this league''s active size mode.$replacement$
  );
  v_updated := replace(
    v_updated,
    'coalesce(array_length(p_pick_order, 1), 0) > 480',
    'coalesce(array_length(p_pick_order, 1), 0) > 8192'
  );
  execute v_updated;

  v_function := to_regprocedure('public.initialize_league_setup_if_empty(uuid,jsonb)');
  if v_function is null then
    raise exception 'initialize_league_setup_if_empty was not found.';
  end if;
  select pg_get_functiondef(v_function) into v_definition;
  if strpos(v_definition, 'v_team_count > 16') = 0
     or strpos(v_definition, 'A league must start with 2 to 16 teams.') = 0 then
    raise exception 'The empty-league initialization guard no longer matches the reviewed baseline.';
  end if;
  v_updated := replace(
    v_definition,
    'v_team_count > 16',
    'v_team_count > public.league_team_limit(p_state -> ''settings'')'
  );
  v_updated := replace(
    v_updated,
    'A league must start with 2 to 16 teams.',
    'The initial team count exceeds this league''s active size mode.'
  );
  execute v_updated;

  v_function := to_regprocedure('public.schedule_live_auction_draft(uuid,timestamptz,jsonb,text)');
  if v_function is null then
    raise exception 'schedule_live_auction_draft was not found.';
  end if;
  select pg_get_functiondef(v_function) into v_definition;
  if strpos(v_definition, 'or jsonb_array_length(coalesce(p_started_state -> ''teams'', ''[]''::jsonb)) < 2') = 0 then
    raise exception 'The scheduled auction team guard no longer matches the reviewed baseline.';
  end if;
  v_updated := replace(
    v_definition,
    'or jsonb_array_length(coalesce(p_started_state -> ''teams'', ''[]''::jsonb)) < 2',
    'or jsonb_array_length(coalesce(p_started_state -> ''teams'', ''[]''::jsonb)) < 2
     or jsonb_array_length(coalesce(p_started_state -> ''teams'', ''[]''::jsonb)) > public.league_team_limit(p_started_state -> ''settings'')'
  );
  execute v_updated;
end;
$migration$;

revoke all on function public.league_team_limit(jsonb)
  from public, anon, authenticated;
grant execute on function public.league_team_limit(jsonb)
  to service_role;
revoke all on function public.enforce_league_team_limit()
  from public, anon, authenticated;

commit;

notify pgrst, 'reload schema';
