-- Run after migration 422 on an isolated data-less branch.
-- This test is read-only and rolls back for consistency.

begin;

do $validation$
declare
  v_function text;
begin
  foreach v_function in array array[
    'capture_league_recovery_snapshot()',
    'claim_league_notification_events(uuid,uuid,integer)',
    'claim_live_setup_team(uuid,integer)',
    'claim_twitch_eventsub_message(text,text,text)',
    'consume_api_rate_limit(text,integer,integer)',
    'get_public_explore()',
    'is_my_setup_team(uuid,integer)',
    'list_private_free_agent_claims(uuid)',
    'mutate_live_auction(uuid,text,jsonb)',
    'process_private_free_agent_claims_internal(uuid,text,timestamp with time zone,uuid)',
    'reconcile_autonomous_league_claims()',
    'reconcile_autonomous_live_auctions()',
    'reconcile_autonomous_snake_drafts()',
    'reconcile_scheduled_auction_drafts()',
    'restore_my_personal_teams(jsonb)',
    'schedule_live_auction_draft(uuid,timestamp with time zone,jsonb,text)'
  ] loop
    if to_regprocedure(format('public.%s', v_function)) is null then
      raise exception 'Canonical function % is missing after migration 422.', v_function;
    end if;
  end loop;

  if to_regprocedure('public.reset_current_weekly_claim_cycle(uuid)') is not null then
    raise exception 'The retired weekly-claim-cycle function returned after migration 422.';
  end if;

  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    join pg_language l on l.oid = p.prolang
    where n.nspname = 'public'
      and p.proname = 'get_public_explore'
      and pg_get_function_identity_arguments(p.oid) = ''
      and l.lanname = 'plpgsql'
      and p.provolatile = 'v'
      and p.prosecdef
      and p.proconfig = array['search_path=public']
  ) then
    raise exception 'get_public_explore does not match the canonical replay definition.';
  end if;

  if (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public') <> 392 then
    raise exception 'The public function count differs from the canonical replay.';
  end if;
end;
$validation$;

rollback;
