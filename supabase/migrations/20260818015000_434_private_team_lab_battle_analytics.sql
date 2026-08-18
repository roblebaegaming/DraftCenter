-- Private Battle Room replay, rating, sheet, matchup, and move analytics.
-- Existing v1/v2 reports remain valid; new v3 reports use a strictly validated v2 series shape.

begin;

create or replace function public.is_valid_team_lab_series_v2(
  p_series jsonb,
  p_my_pokemon jsonb,
  p_opponent_pokemon jsonb
)
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
  select coalesce((
    jsonb_typeof(p_series) = 'object'
    and p_series ->> 'version' = '2'
    and jsonb_typeof(p_series -> 'games') = 'array'
    and case
      when jsonb_typeof(p_series -> 'best_of') = 'number'
        and p_series ->> 'best_of' in ('1','3','5')
      then jsonb_array_length(p_series -> 'games') = (p_series ->> 'best_of')::integer
      else false
    end
    and octet_length(p_series::text) <= 45000
    and not exists (
      select 1
      from jsonb_array_elements(p_series -> 'games') game
      where jsonb_typeof(game) is distinct from 'object'
        or not case
          when jsonb_typeof(game -> 'game') = 'number'
            and game ->> 'game' ~ '^[1-5]$'
            and p_series ->> 'best_of' in ('1','3','5')
          then (game ->> 'game')::integer between 1 and (p_series ->> 'best_of')::integer
          else false
        end
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
        or jsonb_typeof(game -> 'replay_url') is distinct from 'string'
        or char_length(game ->> 'replay_url') > 2048
        or (
          game ->> 'replay_url' <> ''
          and game ->> 'replay_url' !~* '^https://[^[:space:]]+$'
        )
        or not case
          when jsonb_typeof(game -> 'elo_before') = 'null' then true
          when jsonb_typeof(game -> 'elo_before') = 'number'
            and game ->> 'elo_before' ~ '^[0-9]+$'
          then (game ->> 'elo_before')::integer between 0 and 100000
          else false
        end
        or not case
          when jsonb_typeof(game -> 'elo_after') = 'null' then true
          when jsonb_typeof(game -> 'elo_after') = 'number'
            and game ->> 'elo_after' ~ '^[0-9]+$'
          then (game ->> 'elo_after')::integer between 0 and 100000
          else false
        end
        or (
          game ->> 'my_lead' <> ''
          and not exists (
            select 1
            from jsonb_array_elements(p_my_pokemon) pokemon
            where pokemon ->> 'name' = game ->> 'my_lead'
          )
        )
        or (
          game ->> 'opponent_lead' <> ''
          and not exists (
            select 1
            from jsonb_array_elements(p_opponent_pokemon) pokemon
            where pokemon ->> 'name' = game ->> 'opponent_lead'
          )
        )
    )
    and (
      select count(*)
      from jsonb_array_elements(p_series -> 'games')
    ) = (
      select count(distinct game ->> 'game')
      from jsonb_array_elements(p_series -> 'games') game
    )
  ), false);
$$;

revoke all on function public.is_valid_team_lab_series_v2(jsonb, jsonb, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.is_valid_team_lab_series_v2(jsonb, jsonb, jsonb)
  to service_role;

create or replace function public.is_valid_team_lab_battle_report(p_report jsonb)
returns boolean
language sql
immutable
security definer
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
        and public.is_valid_team_lab_series(
          p_report -> 'series',
          p_report -> 'my_pokemon',
          p_report -> 'opponent_pokemon'
        )
        and public.is_valid_team_lab_battle_state(
          p_report -> 'battle_state',
          p_report -> 'my_pokemon',
          p_report -> 'opponent_pokemon'
        )
      when '3' then
        jsonb_typeof(p_report -> 'turn_log') = 'object'
        and p_report -> 'turn_log' ->> 'version' = '2'
        and octet_length(p_report::text) <= 350000
        and public.is_valid_team_lab_battle_report_v1(
          (p_report - 'series' - 'battle_state')
          || jsonb_build_object(
            'version', 1,
            'turn_log', (p_report -> 'turn_log') || jsonb_build_object('version', 1)
          )
        )
        and public.is_valid_team_lab_series_v2(
          p_report -> 'series',
          p_report -> 'my_pokemon',
          p_report -> 'opponent_pokemon'
        )
        and public.is_valid_team_lab_battle_state(
          p_report -> 'battle_state',
          p_report -> 'my_pokemon',
          p_report -> 'opponent_pokemon'
        )
      else false
    end
  ), false);
$$;

revoke all on function public.is_valid_team_lab_battle_report(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.is_valid_team_lab_battle_report(jsonb)
  to authenticated, service_role;

comment on function public.is_valid_team_lab_series_v2(jsonb, jsonb, jsonb) is
  'Internal strict validator for private Battle Room v3 per-game replay and rating fields.';
comment on function public.is_valid_team_lab_battle_report(jsonb) is
  'Security-definer constraint dispatcher for backward-compatible private Battle Room reports.';

do $validation$
begin
  if has_function_privilege('public', 'public.is_valid_team_lab_series_v2(jsonb,jsonb,jsonb)', 'execute')
     or has_function_privilege('anon', 'public.is_valid_team_lab_series_v2(jsonb,jsonb,jsonb)', 'execute')
     or has_function_privilege('authenticated', 'public.is_valid_team_lab_series_v2(jsonb,jsonb,jsonb)', 'execute')
     or not has_function_privilege('service_role', 'public.is_valid_team_lab_series_v2(jsonb,jsonb,jsonb)', 'execute') then
    raise exception 'The Battle Room v2 series helper grants are incorrect.';
  end if;

  if has_function_privilege('public', 'public.is_valid_team_lab_battle_report(jsonb)', 'execute')
     or has_function_privilege('anon', 'public.is_valid_team_lab_battle_report(jsonb)', 'execute')
     or not has_function_privilege('authenticated', 'public.is_valid_team_lab_battle_report(jsonb)', 'execute')
     or not has_function_privilege('service_role', 'public.is_valid_team_lab_battle_report(jsonb)', 'execute') then
    raise exception 'The Battle Room report dispatcher grants are incorrect.';
  end if;
end;
$validation$;

commit;

notify pgrst, 'reload schema';

