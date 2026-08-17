-- Keep hosted auction clocks moving from the database clock. Previously an
-- open browser was the only process that resolved an expired winning bid and
-- started the following nomination turn.

begin;

create or replace function public.reconcile_autonomous_live_auctions()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_snapshot record;
  v_state jsonb;
  v_nominee jsonb;
  v_now_ms bigint;
  v_deadline bigint;
  v_nomination_seconds integer;
  v_nomination_index integer;
  v_team_index integer;
  v_bid integer;
  v_budget integer;
  v_roster_max integer;
  v_roster jsonb;
  v_mon jsonb;
  v_mon_id text;
  v_pool jsonb;
  v_resolved integer := 0;
  v_advanced integer := 0;
  v_started_clocks integer := 0;
  v_failed integer := 0;
begin
  v_now_ms := floor(extract(epoch from clock_timestamp()) * 1000)::bigint;

  for v_snapshot in
    select snapshot.league_id, snapshot.state
    from public.league_state_snapshots snapshot
    where coalesce(snapshot.state #>> '{settings,draftType}', '') = 'auction'
      and coalesce((snapshot.state ->> 'locked')::boolean, false)
      and not coalesce((snapshot.state ->> 'paused')::boolean, false)
      and not coalesce((snapshot.state ->> 'auctionEnded')::boolean, false)
      and jsonb_array_length(coalesce(snapshot.state -> 'pool', '[]'::jsonb)) > 0
    for update skip locked
  loop
    begin
      v_state := v_snapshot.state;
      v_nominee := v_state -> 'nominee';
      v_nomination_index := coalesce((v_state ->> 'auctionNominationIdx')::integer, 0);
      v_nomination_seconds := greatest(
        1,
        public.draft_setting_nonnegative_integer(
          v_state -> 'settings',
          'auctionNominationSeconds',
          30
        )
      );

      if v_nominee is not null and v_nominee <> 'null'::jsonb then
        if coalesce(v_nominee ->> 'deadline', '') !~ '^[0-9]+$' then
          raise exception 'The active auction has an invalid bidding deadline.';
        end if;
        v_deadline := (v_nominee ->> 'deadline')::bigint;
        if v_now_ms < v_deadline then
          continue;
        end if;

        v_team_index := (v_nominee ->> 'currentBidder')::integer;
        v_bid := (v_nominee ->> 'currentBid')::integer;
        v_roster_max := greatest(
          1,
          public.draft_setting_nonnegative_integer(
            v_state -> 'settings',
            'rosterMax',
            1
          )
        );
        v_roster := coalesce(
          v_state #> array['rosters', v_team_index::text],
          '[]'::jsonb
        );
        v_budget := coalesce(
          (v_state #>> array['budgets', v_team_index::text])::integer,
          0
        );
        if jsonb_array_length(v_roster) >= v_roster_max or v_bid > v_budget then
          raise exception 'The winning team can no longer complete this purchase.';
        end if;

        v_mon := jsonb_set(v_nominee -> 'mon', '{cost}', to_jsonb(v_bid), true);
        v_mon := jsonb_set(v_mon, '{acquiredVia}', '"draft"'::jsonb, true);
        v_mon_id := v_nominee #>> '{mon,id}';
        v_state := jsonb_set(
          v_state,
          array['rosters', v_team_index::text],
          v_roster || jsonb_build_array(v_mon),
          true
        );
        v_state := jsonb_set(
          v_state,
          array['budgets', v_team_index::text],
          to_jsonb(v_budget - v_bid),
          true
        );
        select coalesce(
          jsonb_agg(pokemon.value order by pokemon.ordinality),
          '[]'::jsonb
        )
        into v_pool
        from jsonb_array_elements(coalesce(v_state -> 'pool', '[]'::jsonb))
          with ordinality as pokemon(value, ordinality)
        where pokemon.value ->> 'id' <> v_mon_id;
        v_state := jsonb_set(v_state, '{pool}', v_pool, true);
        v_state := jsonb_set(v_state, '{nominee}', 'null'::jsonb, true);
        v_state := jsonb_set(
          v_state,
          '{auctionNominationIdx}',
          to_jsonb(v_nomination_index + 1),
          true
        );
        v_state := jsonb_set(
          v_state,
          '{nominationDeadline}',
          case
            when jsonb_array_length(v_pool) > 0
              then to_jsonb(v_now_ms + v_nomination_seconds::bigint * 1000)
            else 'null'::jsonb
          end,
          true
        );
        v_resolved := v_resolved + 1;

        insert into public.league_events (league_id, kind, actor_id, payload)
        values (
          v_snapshot.league_id,
          'auction_resolve',
          null,
          jsonb_build_object(
            'team_index', v_team_index,
            'pokemon_id', v_mon_id,
            'amount', v_bid,
            'source', 'server_clock'
          )
        );
      else
        if coalesce(v_state ->> 'nominationDeadline', '') !~ '^[0-9]+$' then
          v_state := jsonb_set(
            v_state,
            '{nominationDeadline}',
            to_jsonb(v_now_ms + v_nomination_seconds::bigint * 1000),
            true
          );
          v_started_clocks := v_started_clocks + 1;
        else
          v_deadline := (v_state ->> 'nominationDeadline')::bigint;
          if v_now_ms < v_deadline then
            continue;
          end if;
          v_state := jsonb_set(
            v_state,
            '{auctionNominationIdx}',
            to_jsonb(v_nomination_index + 1),
            true
          );
          v_state := jsonb_set(
            v_state,
            '{nominationDeadline}',
            to_jsonb(v_now_ms + v_nomination_seconds::bigint * 1000),
            true
          );
          v_advanced := v_advanced + 1;

          insert into public.league_events (league_id, kind, actor_id, payload)
          values (
            v_snapshot.league_id,
            'auction_skip',
            null,
            jsonb_build_object(
              'nomination_index', v_nomination_index,
              'source', 'server_clock'
            )
          );
        end if;
      end if;

      v_state := jsonb_set(
        v_state,
        '{rev}',
        to_jsonb(coalesce((v_state ->> 'rev')::bigint, 0) + 1),
        true
      );
      update public.league_state_snapshots
      set state = v_state,
          revision = revision + 1,
          updated_at = now()
      where league_id = v_snapshot.league_id;
    exception when others then
      insert into public.league_events (league_id, kind, actor_id, payload)
      values (
        v_snapshot.league_id,
        'auction_reconciliation_failed',
        null,
        jsonb_build_object('error', sqlerrm, 'source', 'server_clock')
      );
      v_failed := v_failed + 1;
    end;
  end loop;

  return jsonb_build_object(
    'resolved', v_resolved,
    'advanced', v_advanced,
    'started_clocks', v_started_clocks,
    'failed', v_failed
  );
end;
$$;

revoke all on function public.reconcile_autonomous_live_auctions()
  from public, anon, authenticated;
grant execute on function public.reconcile_autonomous_live_auctions()
  to service_role;

-- This project had cron-aware migrations but pg_cron itself was not enabled,
-- so none of those registrations could run without a browser. Supabase makes
-- the extension available to the database owner.
create extension if not exists pg_cron;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (
      select 1 from cron.job
      where jobname = 'draftcenter-scheduled-auctions'
    ) then
      perform cron.unschedule('draftcenter-scheduled-auctions');
    end if;
    perform cron.schedule(
      'draftcenter-scheduled-auctions',
      '* * * * *',
      'select public.reconcile_scheduled_auction_drafts()'
    );
    if exists (
      select 1 from cron.job
      where jobname = 'draftcenter-live-auction-rollover'
    ) then
      perform cron.unschedule('draftcenter-live-auction-rollover');
    end if;
    perform cron.schedule(
      'draftcenter-live-auction-rollover',
      '* * * * *',
      'select public.reconcile_autonomous_live_auctions()'
    );
  else
    raise notice 'Enable pg_cron, then run reconcile_autonomous_live_auctions every minute.';
  end if;
exception when others then
  raise notice 'Auction rollover cron registration needs manual verification: %', sqlerrm;
end;
$$;

-- Repair any auction that was already waiting on an expired browser timer.
select public.reconcile_autonomous_live_auctions();

commit;

notify pgrst, 'reload schema';
