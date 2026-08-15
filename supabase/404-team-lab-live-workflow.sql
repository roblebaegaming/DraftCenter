-- Complete private team sets plus backward-compatible Battle Mode v2 state.
-- Existing team and v1 battle-report rows remain valid and are not rewritten.

begin;

alter table public.personal_teams
  add column if not exists team_sets jsonb not null default '{"version":1,"pokemon":[]}'::jsonb;

create or replace function public.is_valid_team_lab_team_sets(p_sets jsonb, p_roster jsonb)
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
  select coalesce((
    p_sets is not null
    and jsonb_typeof(p_sets) = 'object'
    and p_sets ->> 'version' = '1'
    and jsonb_typeof(p_sets -> 'pokemon') = 'array'
    and jsonb_typeof(p_roster) = 'array'
    and jsonb_array_length(p_sets -> 'pokemon') <= 10
    and octet_length(p_sets::text) <= 100000
    and jsonb_array_length(p_sets -> 'pokemon') <= jsonb_array_length(p_roster)
    and not exists (
      select 1 from jsonb_array_elements(p_sets -> 'pokemon') entry
      where jsonb_typeof(entry) is distinct from 'object'
        or jsonb_typeof(entry -> 'name') is distinct from 'string'
        or char_length(btrim(entry ->> 'name')) not between 1 and 120
        or jsonb_typeof(entry -> 'nickname') is distinct from 'string'
        or char_length(entry ->> 'nickname') > 80
        or jsonb_typeof(entry -> 'gender') is distinct from 'string'
        or entry ->> 'gender' not in ('', 'M', 'F')
        or not case when jsonb_typeof(entry -> 'level') = 'number' and entry ->> 'level' ~ '^[0-9]+$'
          then (entry ->> 'level')::integer between 1 and 100 else false end
        or jsonb_typeof(entry -> 'ability') is distinct from 'string'
        or char_length(entry ->> 'ability') > 100
        or jsonb_typeof(entry -> 'item') is distinct from 'string'
        or char_length(entry ->> 'item') > 100
        or jsonb_typeof(entry -> 'nature') is distinct from 'string'
        or char_length(entry ->> 'nature') > 30
        or jsonb_typeof(entry -> 'tera_type') is distinct from 'string'
        or char_length(entry ->> 'tera_type') > 20
        or jsonb_typeof(entry -> 'shiny') is distinct from 'boolean'
        or not case when jsonb_typeof(entry -> 'happiness') = 'number' and entry ->> 'happiness' ~ '^[0-9]+$'
          then (entry ->> 'happiness')::integer between 0 and 255 else false end
        or jsonb_typeof(entry -> 'evs') is distinct from 'object'
        or (select count(*) from pg_catalog.jsonb_object_keys(case when jsonb_typeof(entry -> 'evs') = 'object' then entry -> 'evs' else '{}'::jsonb end)) <> 6
        or exists (
          select 1 from jsonb_each(case when jsonb_typeof(entry -> 'evs') = 'object' then entry -> 'evs' else '{}'::jsonb end) stat
          where stat.key not in ('hp','atk','def','spa','spd','spe')
             or not case when jsonb_typeof(stat.value) = 'number' and stat.value #>> '{}' ~ '^[0-9]+$'
               then (stat.value #>> '{}')::integer between 0 and 252 else false end
        )
        or jsonb_typeof(entry -> 'ivs') is distinct from 'object'
        or (select count(*) from pg_catalog.jsonb_object_keys(case when jsonb_typeof(entry -> 'ivs') = 'object' then entry -> 'ivs' else '{}'::jsonb end)) <> 6
        or exists (
          select 1 from jsonb_each(case when jsonb_typeof(entry -> 'ivs') = 'object' then entry -> 'ivs' else '{}'::jsonb end) stat
          where stat.key not in ('hp','atk','def','spa','spd','spe')
             or not case when jsonb_typeof(stat.value) = 'number' and stat.value #>> '{}' ~ '^[0-9]+$'
               then (stat.value #>> '{}')::integer between 0 and 31 else false end
        )
        or jsonb_typeof(entry -> 'moves') is distinct from 'array'
        or jsonb_array_length(case when jsonb_typeof(entry -> 'moves') = 'array' then entry -> 'moves' else '[]'::jsonb end) > 4
        or exists (
          select 1 from jsonb_array_elements(case when jsonb_typeof(entry -> 'moves') = 'array' then entry -> 'moves' else '[]'::jsonb end) move
          where jsonb_typeof(move) is distinct from 'string'
             or char_length(btrim(move #>> '{}')) not between 1 and 100
        )
        or (select count(*) from jsonb_array_elements(case when jsonb_typeof(entry -> 'moves') = 'array' then entry -> 'moves' else '[]'::jsonb end))
          <> (select count(distinct lower(btrim(move #>> '{}'))) from jsonb_array_elements(case when jsonb_typeof(entry -> 'moves') = 'array' then entry -> 'moves' else '[]'::jsonb end) move)
        or jsonb_typeof(entry -> 'role') is distinct from 'string'
        or char_length(entry ->> 'role') > 120
        or jsonb_typeof(entry -> 'notes') is distinct from 'string'
        or char_length(entry ->> 'notes') > 1000
    )
    and (select count(*) from jsonb_array_elements(p_sets -> 'pokemon'))
      = (select count(distinct lower(btrim(entry ->> 'name'))) from jsonb_array_elements(p_sets -> 'pokemon') entry)
    and not exists (
      select 1 from jsonb_array_elements(p_sets -> 'pokemon') entry
      where not exists (select 1 from jsonb_array_elements_text(p_roster) roster(name) where roster.name = entry ->> 'name')
    )
  ), false);
$$;

revoke all on function public.is_valid_team_lab_team_sets(jsonb, jsonb)
  from public, anon, authenticated;

alter table public.personal_teams
  drop constraint if exists personal_teams_team_sets_check,
  add constraint personal_teams_team_sets_check
  check (public.is_valid_team_lab_team_sets(team_sets, pokemon));

comment on column public.personal_teams.team_sets is
  'Private roster-aligned complete sets used by Team Lab and Battle Mode. Empty sets remain valid for legacy workspaces.';

create or replace function public.is_valid_team_lab_series(p_series jsonb, p_my_pokemon jsonb, p_opponent_pokemon jsonb)
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
  select coalesce((
    jsonb_typeof(p_series) = 'object'
    and p_series ->> 'version' = '1'
    and jsonb_typeof(p_series -> 'games') = 'array'
    and case
      when jsonb_typeof(p_series -> 'best_of') = 'number'
        and p_series ->> 'best_of' in ('1','3','5')
      then jsonb_array_length(p_series -> 'games') = (p_series ->> 'best_of')::integer
      else false
    end
    and octet_length(p_series::text) <= 30000
    and not exists (
      select 1 from jsonb_array_elements(p_series -> 'games') game
      where jsonb_typeof(game) is distinct from 'object'
        or not case when jsonb_typeof(game -> 'game') = 'number' and game ->> 'game' ~ '^[1-5]$'
          and p_series ->> 'best_of' in ('1','3','5')
          then (game ->> 'game')::integer between 1 and (p_series ->> 'best_of')::integer else false end
        or jsonb_typeof(game -> 'result') is distinct from 'string'
        or game ->> 'result' not in ('pending','win','loss','tie')
        or jsonb_typeof(game -> 'my_lead') is distinct from 'string'
        or char_length(game ->> 'my_lead') > 120
        or jsonb_typeof(game -> 'opponent_lead') is distinct from 'string'
        or char_length(game ->> 'opponent_lead') > 120
        or jsonb_typeof(game -> 'plan') is distinct from 'string'
        or char_length(game ->> 'plan') > 2000
        or jsonb_typeof(game -> 'adjustments') is distinct from 'string'
        or char_length(game ->> 'adjustments') > 2000
        or (game ->> 'my_lead' <> '' and not exists (select 1 from jsonb_array_elements(p_my_pokemon) pokemon where pokemon ->> 'name' = game ->> 'my_lead'))
        or (game ->> 'opponent_lead' <> '' and not exists (select 1 from jsonb_array_elements(p_opponent_pokemon) pokemon where pokemon ->> 'name' = game ->> 'opponent_lead'))
    )
    and (select count(*) from jsonb_array_elements(p_series -> 'games'))
      = (select count(distinct game ->> 'game') from jsonb_array_elements(p_series -> 'games') game)
  ), false);
$$;

create or replace function public.is_valid_team_lab_battle_side_state(p_side jsonb, p_roster jsonb)
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
  select coalesce((
    jsonb_typeof(p_side) = 'object'
    and jsonb_typeof(p_side -> 'hazards') = 'object'
    and jsonb_typeof(p_side -> 'hazards' -> 'stealth_rock') = 'boolean'
    and jsonb_typeof(p_side -> 'hazards' -> 'sticky_web') = 'boolean'
    and case when jsonb_typeof(p_side -> 'hazards' -> 'spikes') = 'number' and p_side -> 'hazards' ->> 'spikes' ~ '^[0-3]$' then true else false end
    and case when jsonb_typeof(p_side -> 'hazards' -> 'toxic_spikes') = 'number' and p_side -> 'hazards' ->> 'toxic_spikes' ~ '^[0-2]$' then true else false end
    and jsonb_typeof(p_side -> 'screens') = 'object'
    and jsonb_typeof(p_side -> 'screens' -> 'reflect') = 'boolean'
    and jsonb_typeof(p_side -> 'screens' -> 'light_screen') = 'boolean'
    and jsonb_typeof(p_side -> 'screens' -> 'aurora_veil') = 'boolean'
    and jsonb_typeof(p_side -> 'pokemon') = 'array'
    and jsonb_array_length(p_side -> 'pokemon') = jsonb_array_length(p_roster)
    and jsonb_array_length(p_side -> 'pokemon') <= 10
    and not exists (
      select 1 from jsonb_array_elements(p_side -> 'pokemon') entry
      where jsonb_typeof(entry) is distinct from 'object'
        or jsonb_typeof(entry -> 'name') is distinct from 'string'
        or char_length(btrim(entry ->> 'name')) not between 1 and 120
        or not case when jsonb_typeof(entry -> 'hp_percent') = 'number'
          then (entry ->> 'hp_percent')::numeric between 0 and 100 else false end
        or jsonb_typeof(entry -> 'status') is distinct from 'string'
        or entry ->> 'status' not in ('','burn','paralysis','poison','toxic','sleep','freeze')
        or jsonb_typeof(entry -> 'terastallized') is distinct from 'boolean'
        or jsonb_typeof(entry -> 'tera_type') is distinct from 'string'
        or char_length(entry ->> 'tera_type') > 20
    )
    and (select count(*) from jsonb_array_elements(p_side -> 'pokemon'))
      = (select count(distinct lower(btrim(entry ->> 'name'))) from jsonb_array_elements(p_side -> 'pokemon') entry)
    and not exists (
      select 1 from jsonb_array_elements(p_roster) roster
      where not exists (select 1 from jsonb_array_elements(p_side -> 'pokemon') entry where entry ->> 'name' = roster ->> 'name')
    )
  ), false);
$$;

create or replace function public.is_valid_team_lab_battle_state(p_state jsonb, p_my_pokemon jsonb, p_opponent_pokemon jsonb)
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
  select coalesce((
    jsonb_typeof(p_state) = 'object'
    and p_state ->> 'version' = '1'
    and jsonb_typeof(p_state -> 'weather') = 'string'
    and p_state ->> 'weather' in ('','sun','rain','sand','snow')
    and jsonb_typeof(p_state -> 'terrain') = 'string'
    and p_state ->> 'terrain' in ('','electric','grassy','misty','psychic')
    and octet_length(p_state::text) <= 30000
    and public.is_valid_team_lab_battle_side_state(p_state -> 'my_side', p_my_pokemon)
    and public.is_valid_team_lab_battle_side_state(p_state -> 'opponent_side', p_opponent_pokemon)
  ), false);
$$;

revoke all on function public.is_valid_team_lab_series(jsonb, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.is_valid_team_lab_battle_side_state(jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.is_valid_team_lab_battle_state(jsonb, jsonb, jsonb) from public, anon, authenticated;

-- Preserve the released v1 validator as the compatibility layer, then bind
-- the table check and RPCs to a v1/v2 dispatcher.
alter function public.is_valid_team_lab_battle_report(jsonb)
  rename to is_valid_team_lab_battle_report_v1;

create function public.is_valid_team_lab_battle_report(p_report jsonb)
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
  select coalesce((
    case p_report ->> 'version'
      when '1' then public.is_valid_team_lab_battle_report_v1(p_report)
      when '2' then
        jsonb_typeof(p_report -> 'turn_log') = 'object'
        and p_report -> 'turn_log' ->> 'version' = '2'
        and octet_length(p_report::text) <= 300000
        and public.is_valid_team_lab_battle_report_v1(
          (p_report - 'series' - 'battle_state')
          || jsonb_build_object(
            'version', 1,
            'turn_log', (p_report -> 'turn_log') || jsonb_build_object('version', 1)
          )
        )
        and public.is_valid_team_lab_series(p_report -> 'series', p_report -> 'my_pokemon', p_report -> 'opponent_pokemon')
        and public.is_valid_team_lab_battle_state(p_report -> 'battle_state', p_report -> 'my_pokemon', p_report -> 'opponent_pokemon')
      else false
    end
  ), false);
$$;

revoke all on function public.is_valid_team_lab_battle_report_v1(jsonb) from public, anon, authenticated;
revoke all on function public.is_valid_team_lab_battle_report(jsonb) from public, anon, authenticated;

alter table public.team_lab_matchups
  drop constraint if exists team_lab_matchups_battle_report_check,
  add constraint team_lab_matchups_battle_report_check
  check (public.is_valid_team_lab_battle_report(battle_report));

create or replace function public.restore_my_personal_teams(p_teams jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team jsonb;
  v_id uuid;
  v_restored integer := 0;
  v_workspace_type text;
begin
  if auth.uid() is null then
    raise exception 'Sign in before restoring My Teams.';
  end if;
  if p_teams is null
     or jsonb_typeof(p_teams) <> 'array'
     or octet_length(p_teams::text) > 10000000 then
    raise exception 'The My Teams recovery file is invalid or too large.';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_teams) team
    where nullif(team ->> 'id', '') is null
       or nullif(btrim(team ->> 'team_name'), '') is null
  ) then
    raise exception 'The recovery file contains an invalid team.';
  end if;

  for v_team in select value from jsonb_array_elements(p_teams)
  loop
    v_id := (v_team ->> 'id')::uuid;
    v_workspace_type := case
      when (v_team ->> 'workspace_type') in ('tournament', 'nuzlocke') then v_team ->> 'workspace_type'
      else 'weekly'
    end;

    update public.personal_teams
    set team_name = btrim(v_team ->> 'team_name'),
        league_name = nullif(btrim(v_team ->> 'league_name'), ''),
        format_name = nullif(btrim(v_team ->> 'format_name'), ''),
        workspace_type = v_workspace_type,
        planning_entries = coalesce(v_team -> 'planning_entries', '[]'::jsonb),
        notes = coalesce(v_team ->> 'notes', ''),
        weekly_notes = coalesce(v_team ->> 'weekly_notes', ''),
        pokepaste_url = nullif(btrim(v_team ->> 'pokepaste_url'), ''),
        replica_code = coalesce(v_team ->> 'replica_code', ''),
        spreadsheet_url = nullif(btrim(v_team ->> 'spreadsheet_url'), ''),
        team_report_url = nullif(btrim(v_team ->> 'team_report_url'), ''),
        pokemon = coalesce(v_team -> 'pokemon', '[]'::jsonb),
        team_sets = coalesce(v_team -> 'team_sets', '{"version":1,"pokemon":[]}'::jsonb),
        archived = coalesce((v_team ->> 'archived')::boolean, false),
        is_public = case when v_workspace_type = 'nuzlocke' then false else coalesce((v_team ->> 'is_public')::boolean, false) end,
        regulation_id = case when v_workspace_type = 'nuzlocke' then null else nullif(btrim(v_team ->> 'regulation_id'), '') end,
        public_summary = case when v_workspace_type = 'nuzlocke' then '' else coalesce(v_team ->> 'public_summary', '') end,
        share_pokepaste = case when v_workspace_type = 'nuzlocke' then false else coalesce((v_team ->> 'share_pokepaste')::boolean, false) end,
        share_replica_code = case when v_workspace_type = 'nuzlocke' then false else coalesce((v_team ->> 'share_replica_code')::boolean, false) end,
        share_team_report = case when v_workspace_type = 'nuzlocke' then false else coalesce((v_team ->> 'share_team_report')::boolean, false) end,
        nuzlocke_run = case when v_workspace_type = 'nuzlocke' then v_team -> 'nuzlocke_run' else null end,
        updated_at = now()
    where id = v_id and owner_id = auth.uid();

    if not found then
      insert into public.personal_teams (
        id, owner_id, team_name, league_name, format_name, workspace_type,
        planning_entries, notes, weekly_notes, pokepaste_url, replica_code,
        spreadsheet_url, team_report_url, pokemon, team_sets, archived, is_public,
        regulation_id, public_summary, share_pokepaste, share_replica_code,
        share_team_report, nuzlocke_run
      ) values (
        v_id, auth.uid(), btrim(v_team ->> 'team_name'),
        nullif(btrim(v_team ->> 'league_name'), ''),
        nullif(btrim(v_team ->> 'format_name'), ''), v_workspace_type,
        coalesce(v_team -> 'planning_entries', '[]'::jsonb),
        coalesce(v_team ->> 'notes', ''),
        coalesce(v_team ->> 'weekly_notes', ''),
        nullif(btrim(v_team ->> 'pokepaste_url'), ''),
        coalesce(v_team ->> 'replica_code', ''),
        nullif(btrim(v_team ->> 'spreadsheet_url'), ''),
        nullif(btrim(v_team ->> 'team_report_url'), ''),
        coalesce(v_team -> 'pokemon', '[]'::jsonb),
        coalesce(v_team -> 'team_sets', '{"version":1,"pokemon":[]}'::jsonb),
        coalesce((v_team ->> 'archived')::boolean, false),
        case when v_workspace_type = 'nuzlocke' then false else coalesce((v_team ->> 'is_public')::boolean, false) end,
        case when v_workspace_type = 'nuzlocke' then null else nullif(btrim(v_team ->> 'regulation_id'), '') end,
        case when v_workspace_type = 'nuzlocke' then '' else coalesce(v_team ->> 'public_summary', '') end,
        case when v_workspace_type = 'nuzlocke' then false else coalesce((v_team ->> 'share_pokepaste')::boolean, false) end,
        case when v_workspace_type = 'nuzlocke' then false else coalesce((v_team ->> 'share_replica_code')::boolean, false) end,
        case when v_workspace_type = 'nuzlocke' then false else coalesce((v_team ->> 'share_team_report')::boolean, false) end,
        case when v_workspace_type = 'nuzlocke' then v_team -> 'nuzlocke_run' else null end
      );
    end if;
    v_restored := v_restored + 1;
  end loop;

  return v_restored;
end;
$$;

revoke all on function public.restore_my_personal_teams(jsonb)
  from public, anon, authenticated;
grant execute on function public.restore_my_personal_teams(jsonb)
  to authenticated;

comment on column public.team_lab_matchups.battle_report is
  'Private owner-only Battle Mode v1/v2 state, including set plans, results, field state, and a bounded correctable timeline.';

do $hardening$
begin
  if not exists (
    select 1 from pg_class relation
    where relation.oid = 'public.team_lab_matchups'::regclass
      and relation.relrowsecurity
      and relation.relforcerowsecurity
  ) then
    raise exception 'Team Lab must keep forced row-level security.';
  end if;
  if has_table_privilege('anon', 'public.team_lab_matchups', 'select')
     or has_table_privilege('authenticated', 'public.team_lab_matchups', 'select')
     or has_table_privilege('authenticated', 'public.team_lab_matchups', 'insert')
     or has_table_privilege('authenticated', 'public.team_lab_matchups', 'update')
     or has_table_privilege('authenticated', 'public.team_lab_matchups', 'delete') then
    raise exception 'Team Lab matchup access must remain RPC-only.';
  end if;
  if has_function_privilege('anon', 'public.is_valid_team_lab_team_sets(jsonb,jsonb)', 'execute')
     or has_function_privilege('authenticated', 'public.is_valid_team_lab_team_sets(jsonb,jsonb)', 'execute')
     or has_function_privilege('anon', 'public.is_valid_team_lab_series(jsonb,jsonb,jsonb)', 'execute')
     or has_function_privilege('authenticated', 'public.is_valid_team_lab_series(jsonb,jsonb,jsonb)', 'execute')
     or has_function_privilege('anon', 'public.is_valid_team_lab_battle_side_state(jsonb,jsonb)', 'execute')
     or has_function_privilege('authenticated', 'public.is_valid_team_lab_battle_side_state(jsonb,jsonb)', 'execute')
     or has_function_privilege('anon', 'public.is_valid_team_lab_battle_state(jsonb,jsonb,jsonb)', 'execute')
     or has_function_privilege('authenticated', 'public.is_valid_team_lab_battle_state(jsonb,jsonb,jsonb)', 'execute')
     or has_function_privilege('anon', 'public.is_valid_team_lab_battle_report_v1(jsonb)', 'execute')
     or has_function_privilege('authenticated', 'public.is_valid_team_lab_battle_report_v1(jsonb)', 'execute')
     or has_function_privilege('anon', 'public.is_valid_team_lab_battle_report(jsonb)', 'execute')
     or has_function_privilege('authenticated', 'public.is_valid_team_lab_battle_report(jsonb)', 'execute') then
    raise exception 'Internal Team Lab validators are exposed to browser roles.';
  end if;
  if has_function_privilege('anon', 'public.save_my_team_lab_battle_report(uuid,text,text,jsonb)', 'execute')
     or not has_function_privilege('authenticated', 'public.save_my_team_lab_battle_report(uuid,text,text,jsonb)', 'execute') then
    raise exception 'Team Lab Battle Mode RPC grants are incorrect.';
  end if;
end;
$hardening$;

commit;
notify pgrst, 'reload schema';
