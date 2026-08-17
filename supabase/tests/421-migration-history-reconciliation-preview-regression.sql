-- Run after the complete standard migration chain on an isolated data-less branch.
-- This test is read-only and the transaction is rolled back for consistency.

begin;

do $validation$
declare
  v_table text;
begin
  foreach v_table in array array[
    'league_match_availability',
    'league_match_schedules',
    'tester_feedback',
    'community_question_prompts',
    'community_question_deliveries',
    'daily_poll_discord_deliveries'
  ] loop
    if to_regclass(format('public.%I', v_table)) is null then
      raise exception 'Reconciled table % is missing.', v_table;
    end if;
  end loop;

  if to_regprocedure('public.claim_vacant_league_commissioner(uuid)') is null
     or to_regprocedure('public.reset_current_weekly_claim_cycle(uuid)') is not null then
    raise exception 'The reconciled function set does not match Production.';
  end if;

  if has_table_privilege('anon', 'public.personal_teams', 'SELECT')
     or not has_table_privilege('authenticated', 'public.personal_teams', 'SELECT')
     or not has_table_privilege('authenticated', 'public.personal_teams', 'INSERT')
     or not has_table_privilege('authenticated', 'public.personal_teams', 'UPDATE')
     or not has_table_privilege('authenticated', 'public.personal_teams', 'DELETE') then
    raise exception 'The personal team privacy bridge is not in force.';
  end if;

  foreach v_table in array array[
    'community_question_prompts',
    'community_question_deliveries',
    'daily_poll_discord_deliveries'
  ] loop
    if has_table_privilege('anon', format('public.%I', v_table), 'SELECT')
       or has_table_privilege('authenticated', format('public.%I', v_table), 'SELECT')
       or not has_table_privilege('service_role', format('public.%I', v_table), 'SELECT') then
      raise exception 'Service-only table % has an unexpected Data API boundary.', v_table;
    end if;
  end loop;

  if has_table_privilege('anon', 'public.worlds_pick_entries', 'SELECT')
     or has_table_privilege('authenticated', 'public.worlds_pick_entries', 'SELECT')
     or not has_function_privilege('anon', 'public.get_worlds_pick_popularity(text)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.get_worlds_pick_popularity(text)', 'EXECUTE') then
    raise exception 'Worlds aggregate privacy grants changed during history reconciliation.';
  end if;

  if (select count(*) from public.badge_catalog) <> 17
     or (select count(*) from public.pokemon_game_versions) <> 33 then
    raise exception 'Pre-baseline public reference rows were not restored.';
  end if;
end;
$validation$;

rollback;
