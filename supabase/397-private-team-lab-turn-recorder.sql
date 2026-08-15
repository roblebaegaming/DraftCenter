-- Private, bounded turn-by-turn battle recording for Team Lab.

begin;

create or replace function public.is_valid_team_lab_turn_log(
  p_log jsonb,
  p_my_pokemon jsonb,
  p_opponent_pokemon jsonb
)
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
  select coalesce((p_log is not null
    and jsonb_typeof(p_log) = 'object'
    and p_log ->> 'version' = '1'
    and case
      when jsonb_typeof(p_log -> 'current_game') = 'number'
        and p_log ->> 'current_game' ~ '^[0-9]+$'
        and char_length(p_log ->> 'current_game') <= 1
      then (p_log ->> 'current_game')::integer between 1 and 9
      else false
    end
    and case
      when jsonb_typeof(p_log -> 'current_turn') = 'number'
        and p_log ->> 'current_turn' ~ '^[0-9]+$'
        and char_length(p_log ->> 'current_turn') <= 3
      then (p_log ->> 'current_turn')::integer between 1 and 999
      else false
    end
    and jsonb_typeof(p_log -> 'active_my_pokemon') = 'string'
    and char_length(p_log ->> 'active_my_pokemon') <= 120
    and jsonb_typeof(p_log -> 'active_opponent_pokemon') = 'string'
    and char_length(p_log ->> 'active_opponent_pokemon') <= 120
    and jsonb_typeof(p_log -> 'events') = 'array'
    and jsonb_array_length(case when jsonb_typeof(p_log -> 'events') = 'array' then p_log -> 'events' else '[]'::jsonb end) <= 300
    and (
      p_log ->> 'active_my_pokemon' = ''
      or exists (
        select 1
        from jsonb_array_elements(case when jsonb_typeof(p_my_pokemon) = 'array' then p_my_pokemon else '[]'::jsonb end) pokemon
        where pokemon ->> 'name' = p_log ->> 'active_my_pokemon'
      )
    )
    and (
      p_log ->> 'active_opponent_pokemon' = ''
      or exists (
        select 1
        from jsonb_array_elements(case when jsonb_typeof(p_opponent_pokemon) = 'array' then p_opponent_pokemon else '[]'::jsonb end) pokemon
        where pokemon ->> 'name' = p_log ->> 'active_opponent_pokemon'
      )
    )
    and not exists (
      select 1
      from jsonb_array_elements(case when jsonb_typeof(p_log -> 'events') = 'array' then p_log -> 'events' else '[]'::jsonb end) entry
      where jsonb_typeof(entry) is distinct from 'object'
        or jsonb_typeof(entry -> 'id') is distinct from 'string'
        or char_length(btrim(entry ->> 'id')) not between 1 and 80
        or not case
          when jsonb_typeof(entry -> 'game') = 'number'
            and entry ->> 'game' ~ '^[0-9]+$'
            and char_length(entry ->> 'game') <= 1
          then (entry ->> 'game')::integer between 1 and 9
          else false
        end
        or not case
          when jsonb_typeof(entry -> 'turn') = 'number'
            and entry ->> 'turn' ~ '^[0-9]+$'
            and char_length(entry ->> 'turn') <= 3
          then (entry ->> 'turn')::integer between 1 and (p_log ->> 'current_turn')::integer
          else false
        end
        or jsonb_typeof(entry -> 'kind') is distinct from 'string'
        or entry ->> 'kind' not in ('move', 'switch', 'faint', 'note')
        or jsonb_typeof(entry -> 'side') is distinct from 'string'
        or entry ->> 'side' not in ('my', 'opponent')
        or jsonb_typeof(entry -> 'pokemon') is distinct from 'string'
        or char_length(entry ->> 'pokemon') > 120
        or jsonb_typeof(entry -> 'target') is distinct from 'string'
        or char_length(entry ->> 'target') > 120
        or jsonb_typeof(entry -> 'move') is distinct from 'string'
        or char_length(entry ->> 'move') > 100
        or jsonb_typeof(entry -> 'damage') is distinct from 'string'
        or char_length(entry ->> 'damage') > 40
        or jsonb_typeof(entry -> 'note') is distinct from 'string'
        or char_length(entry ->> 'note') > 160
        or (entry ->> 'kind' = 'note' and (entry ->> 'pokemon' <> '' or btrim(entry ->> 'note') = ''))
        or (entry ->> 'kind' <> 'note' and char_length(btrim(entry ->> 'pokemon')) not between 1 and 120)
        or (entry ->> 'kind' = 'move' and char_length(btrim(entry ->> 'move')) not between 1 and 100)
        or (entry ->> 'kind' <> 'move' and (entry ->> 'target' <> '' or entry ->> 'move' <> '' or entry ->> 'damage' <> ''))
        or (
          entry ->> 'kind' <> 'note'
          and not exists (
            select 1
            from jsonb_array_elements(
              case
                when entry ->> 'side' = 'my' and jsonb_typeof(p_my_pokemon) = 'array' then p_my_pokemon
                when entry ->> 'side' = 'opponent' and jsonb_typeof(p_opponent_pokemon) = 'array' then p_opponent_pokemon
                else '[]'::jsonb
              end
            ) pokemon
            where pokemon ->> 'name' = entry ->> 'pokemon'
          )
        )
        or (
          entry ->> 'kind' = 'move'
          and entry ->> 'target' <> ''
          and not exists (
            select 1
            from jsonb_array_elements(
              case
                when entry ->> 'side' = 'my' and jsonb_typeof(p_opponent_pokemon) = 'array' then p_opponent_pokemon
                when entry ->> 'side' = 'opponent' and jsonb_typeof(p_my_pokemon) = 'array' then p_my_pokemon
                else '[]'::jsonb
              end
            ) pokemon
            where pokemon ->> 'name' = entry ->> 'target'
          )
        )
    )
    and (
      select count(*)
      from jsonb_array_elements(case when jsonb_typeof(p_log -> 'events') = 'array' then p_log -> 'events' else '[]'::jsonb end)
    ) = (
      select count(distinct entry ->> 'id')
      from jsonb_array_elements(case when jsonb_typeof(p_log -> 'events') = 'array' then p_log -> 'events' else '[]'::jsonb end) entry
    )
  ), false);
$$;

revoke all on function public.is_valid_team_lab_turn_log(jsonb, jsonb, jsonb)
  from public, anon, authenticated;

create or replace function public.is_valid_team_lab_battle_report(p_report jsonb)
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
  select coalesce((p_report is not null
    and jsonb_typeof(p_report) = 'object'
    and p_report ->> 'version' = '1'
    and jsonb_typeof(p_report -> 'my_pokemon') = 'array'
    and jsonb_array_length(case when jsonb_typeof(p_report -> 'my_pokemon') = 'array' then p_report -> 'my_pokemon' else '[]'::jsonb end) <= 10
    and jsonb_typeof(p_report -> 'opponent_pokemon') = 'array'
    and jsonb_array_length(case when jsonb_typeof(p_report -> 'opponent_pokemon') = 'array' then p_report -> 'opponent_pokemon' else '[]'::jsonb end) <= 10
    and jsonb_typeof(p_report -> 'battle_notes') = 'string'
    and char_length(p_report ->> 'battle_notes') <= 10000
    and octet_length(p_report::text) <= 200000
    and not exists (
      select 1
      from jsonb_array_elements(case when jsonb_typeof(p_report -> 'my_pokemon') = 'array' then p_report -> 'my_pokemon' else '[]'::jsonb end) entry
      where jsonb_typeof(entry) is distinct from 'object'
         or jsonb_typeof(entry -> 'name') is distinct from 'string'
         or char_length(btrim(entry ->> 'name')) not between 1 and 120
         or jsonb_typeof(entry -> 'brought') is distinct from 'boolean'
         or jsonb_typeof(entry -> 'fainted') is distinct from 'boolean'
    )
    and (
      select count(*) from jsonb_array_elements(case when jsonb_typeof(p_report -> 'my_pokemon') = 'array' then p_report -> 'my_pokemon' else '[]'::jsonb end)
    ) = (
      select count(distinct lower(btrim(entry ->> 'name')))
      from jsonb_array_elements(case when jsonb_typeof(p_report -> 'my_pokemon') = 'array' then p_report -> 'my_pokemon' else '[]'::jsonb end) entry
    )
    and not exists (
      select 1
      from jsonb_array_elements(case when jsonb_typeof(p_report -> 'opponent_pokemon') = 'array' then p_report -> 'opponent_pokemon' else '[]'::jsonb end) entry
      where jsonb_typeof(entry) is distinct from 'object'
         or jsonb_typeof(entry -> 'name') is distinct from 'string'
         or char_length(btrim(entry ->> 'name')) not between 1 and 120
         or jsonb_typeof(entry -> 'brought') is distinct from 'boolean'
         or jsonb_typeof(entry -> 'fainted') is distinct from 'boolean'
         or (entry ? 'ability' and jsonb_typeof(entry -> 'ability') is distinct from 'string')
         or char_length(coalesce(entry ->> 'ability', '')) > 100
         or jsonb_typeof(entry -> 'moves') is distinct from 'array'
         or jsonb_array_length(case when jsonb_typeof(entry -> 'moves') = 'array' then entry -> 'moves' else '[]'::jsonb end) > 4
         or exists (
           select 1
           from jsonb_array_elements(case when jsonb_typeof(entry -> 'moves') = 'array' then entry -> 'moves' else '[]'::jsonb end) move
           where jsonb_typeof(move) is distinct from 'string'
              or char_length(btrim(move #>> '{}')) not between 1 and 100
         )
         or (
           select count(*) from jsonb_array_elements(case when jsonb_typeof(entry -> 'moves') = 'array' then entry -> 'moves' else '[]'::jsonb end) move
         ) <> (
           select count(distinct lower(btrim(move #>> '{}')))
           from jsonb_array_elements(case when jsonb_typeof(entry -> 'moves') = 'array' then entry -> 'moves' else '[]'::jsonb end) move
         )
    )
    and (
      select count(*) from jsonb_array_elements(case when jsonb_typeof(p_report -> 'opponent_pokemon') = 'array' then p_report -> 'opponent_pokemon' else '[]'::jsonb end)
    ) = (
      select count(distinct lower(btrim(entry ->> 'name')))
      from jsonb_array_elements(case when jsonb_typeof(p_report -> 'opponent_pokemon') = 'array' then p_report -> 'opponent_pokemon' else '[]'::jsonb end) entry
    )
    and (
      not (p_report ? 'turn_log')
      or public.is_valid_team_lab_turn_log(
        p_report -> 'turn_log',
        p_report -> 'my_pokemon',
        p_report -> 'opponent_pokemon'
      )
    )
  ), false);
$$;

revoke all on function public.is_valid_team_lab_battle_report(jsonb)
  from public, anon, authenticated;

update public.team_lab_matchups
set battle_report = jsonb_set(
  battle_report,
  '{turn_log}',
  '{"version":1,"current_game":1,"current_turn":1,"active_my_pokemon":"","active_opponent_pokemon":"","events":[]}'::jsonb,
  true
)
where not (battle_report ? 'turn_log');

alter table public.team_lab_matchups
  alter column battle_report set default
  '{"version":1,"my_pokemon":[],"opponent_pokemon":[],"battle_notes":"","turn_log":{"version":1,"current_game":1,"current_turn":1,"active_my_pokemon":"","active_opponent_pokemon":"","events":[]}}'::jsonb;

comment on function public.is_valid_team_lab_turn_log(jsonb, jsonb, jsonb) is
  'Validates the bounded private Team Lab turn recorder against the report rosters.';
comment on column public.team_lab_matchups.battle_report is
  'Private owner-only Battle Mode state, including a bounded turn timeline. Exported and restored only through owner RPCs.';

do $hardening$
begin
  if not exists (
    select 1
    from pg_class relation
    where relation.oid = 'public.team_lab_matchups'::regclass
      and relation.relrowsecurity
      and relation.relforcerowsecurity
  ) then
    raise exception 'Team Lab turn logs require forced row-level security.';
  end if;
  if has_table_privilege('anon', 'public.team_lab_matchups', 'select')
     or has_table_privilege('authenticated', 'public.team_lab_matchups', 'select')
     or has_table_privilege('authenticated', 'public.team_lab_matchups', 'insert')
     or has_table_privilege('authenticated', 'public.team_lab_matchups', 'update')
     or has_table_privilege('authenticated', 'public.team_lab_matchups', 'delete') then
    raise exception 'Team Lab turn logs must remain RPC-only.';
  end if;
  if has_function_privilege('anon', 'public.save_my_team_lab_battle_report(uuid,text,text,jsonb)', 'execute')
     or not has_function_privilege('authenticated', 'public.save_my_team_lab_battle_report(uuid,text,text,jsonb)', 'execute') then
    raise exception 'Team Lab Battle Mode RPC grants are incorrect.';
  end if;
  if has_function_privilege('anon', 'public.is_valid_team_lab_turn_log(jsonb,jsonb,jsonb)', 'execute')
     or has_function_privilege('authenticated', 'public.is_valid_team_lab_turn_log(jsonb,jsonb,jsonb)', 'execute') then
    raise exception 'The internal turn-log validator is exposed to browser roles.';
  end if;
end;
$hardening$;

commit;
