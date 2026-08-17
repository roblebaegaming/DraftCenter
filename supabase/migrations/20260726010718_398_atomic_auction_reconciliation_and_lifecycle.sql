-- Make hosted auction completion independent of a connected browser while
-- preserving the browser RPC as the immediate, responsive path.

begin;

-- Scheduling either draft mode is the authoritative switch for that league.
-- The advisory lock makes simultaneous snake/auction preparations serialize;
-- the last successfully scheduled mode wins and cancels the opposite job in
-- the same transaction.
create or replace function public.cancel_opposite_scheduled_draft_job()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(
    hashtextextended('draftcenter-draft-mode:' || new.league_id::text, 0)
  );

  if new.status <> 'scheduled' then
    return new;
  end if;

  if tg_table_name = 'scheduled_snake_draft_jobs' then
    update public.scheduled_auction_draft_jobs
    set status = 'cancelled',
        last_error = null,
        updated_at = now()
    where league_id = new.league_id
      and status in ('scheduled', 'starting', 'failed');
  elsif tg_table_name = 'scheduled_auction_draft_jobs' then
    update public.scheduled_snake_draft_jobs
    set status = 'cancelled',
        last_error = null,
        updated_at = now()
    where league_id = new.league_id
      and status in ('scheduled', 'starting', 'failed');
  else
    raise exception 'Unexpected scheduled draft job table: %', tg_table_name;
  end if;

  return new;
end;
$$;

drop trigger if exists cancel_opposite_scheduled_draft_job
  on public.scheduled_snake_draft_jobs;
create trigger cancel_opposite_scheduled_draft_job
before insert or update on public.scheduled_snake_draft_jobs
for each row execute function public.cancel_opposite_scheduled_draft_job();

drop trigger if exists cancel_opposite_scheduled_draft_job
  on public.scheduled_auction_draft_jobs;
create trigger cancel_opposite_scheduled_draft_job
before insert or update on public.scheduled_auction_draft_jobs
for each row execute function public.cancel_opposite_scheduled_draft_job();

-- A saved setup-mode change must also invalidate the old mode's prepared job.
-- This is part of the same snapshot transaction, so a stale job cannot remain
-- armed after the new setting becomes authoritative.
create or replace function public.cancel_stale_scheduled_draft_mode()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mode text := coalesce(new.state #>> '{settings,draftType}', 'snake');
begin
  if tg_op = 'UPDATE'
     and v_mode = coalesce(old.state #>> '{settings,draftType}', 'snake') then
    return new;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('draftcenter-draft-mode:' || new.league_id::text, 0)
  );

  if v_mode = 'snake' then
    update public.scheduled_auction_draft_jobs
    set status = 'cancelled',
        last_error = null,
        updated_at = now()
    where league_id = new.league_id
      and status in ('scheduled', 'starting', 'failed');
  elsif v_mode = 'auction' then
    update public.scheduled_snake_draft_jobs
    set status = 'cancelled',
        last_error = null,
        updated_at = now()
    where league_id = new.league_id
      and status in ('scheduled', 'starting', 'failed');
  end if;

  return new;
end;
$$;

drop trigger if exists cancel_stale_scheduled_draft_mode
  on public.league_state_snapshots;
create trigger cancel_stale_scheduled_draft_mode
after insert or update of state on public.league_state_snapshots
for each row execute function public.cancel_stale_scheduled_draft_mode();

-- Keep the canonical league lifecycle aligned with every hosted auction path:
-- manual starts, scheduled starts, browser awards, server awards, and explicit
-- commissioner completion. The trigger also closes an auction once the pool
-- is empty or every roster is at its configured stopping condition.
create or replace function public.sync_live_auction_league_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_state jsonb := new.state;
  v_team_count integer;
  v_team_index integer;
  v_roster_min integer;
  v_roster_max integer;
  v_roster_count integer;
  v_budget integer;
  v_all_done boolean := true;
  v_complete boolean := false;
begin
  if coalesce(v_state #>> '{settings,draftType}', '') <> 'auction'
     or not coalesce((v_state ->> 'locked')::boolean, false) then
    return new;
  end if;

  if not coalesce((v_state ->> 'auctionEnded')::boolean, false)
     and coalesce(v_state -> 'nominee', 'null'::jsonb) = 'null'::jsonb then
    if jsonb_array_length(coalesce(v_state -> 'pool', '[]'::jsonb)) = 0 then
      v_complete := true;
    else
      v_team_count := jsonb_array_length(
        coalesce(v_state -> 'teams', '[]'::jsonb)
      );
      v_roster_min := greatest(
        1,
        public.draft_setting_nonnegative_integer(
          v_state -> 'settings',
          'rosterMin',
          1
        )
      );
      v_roster_max := greatest(
        v_roster_min,
        public.draft_setting_nonnegative_integer(
          v_state -> 'settings',
          'rosterMax',
          v_roster_min
        )
      );
      v_all_done := v_team_count > 0;

      if v_team_count > 0 then
        for v_team_index in 0..(v_team_count - 1) loop
          v_roster_count := jsonb_array_length(
            coalesce(
              v_state #> array['rosters', v_team_index::text],
              '[]'::jsonb
            )
          );
          v_budget := coalesce(
            (v_state #>> array['budgets', v_team_index::text])::integer,
            0
          );
          if v_roster_count < v_roster_min
             or (v_roster_count < v_roster_max and v_budget >= 1) then
            v_all_done := false;
            exit;
          end if;
        end loop;
      end if;
      v_complete := v_all_done;
    end if;
  else
    v_complete := coalesce((v_state ->> 'auctionEnded')::boolean, false);
  end if;

  if v_complete then
    new.state := jsonb_set(v_state, '{auctionEnded}', 'true'::jsonb, true);
    new.state := jsonb_set(
      new.state,
      '{nominationDeadline}',
      'null'::jsonb,
      true
    );
    update public.leagues
    set status = 'active',
        updated_at = now()
    where id = new.league_id
      and status is distinct from 'active';
  else
    update public.leagues
    set status = 'drafting',
        updated_at = now()
    where id = new.league_id
      and status is distinct from 'drafting';
  end if;

  return new;
end;
$$;

-- The zz prefix makes this run after the existing validation triggers. A
-- pool-empty update is therefore checked against roster minimums before the
-- lifecycle trigger marks the auction complete.
drop trigger if exists zz_sync_live_auction_league_lifecycle
  on public.league_state_snapshots;
create trigger zz_sync_live_auction_league_lifecycle
before insert or update of state on public.league_state_snapshots
for each row execute function public.sync_live_auction_league_lifecycle();

-- Resolve exactly one expired winning nomination. The snapshot row lock is
-- the idempotency boundary: a concurrent browser or server call waits, then
-- observes that the nominee is already gone and safely returns a no-op.
create or replace function public.resolve_expired_auction_nomination(
  p_league_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_state jsonb;
  v_nominee jsonb;
  v_now_ms bigint := floor(
    extract(epoch from clock_timestamp()) * 1000
  )::bigint;
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
begin
  select snapshot.state
  into v_state
  from public.league_state_snapshots snapshot
  where snapshot.league_id = p_league_id
  for update;

  if v_state is null then
    return jsonb_build_object('status', 'missing');
  end if;
  if coalesce(v_state #>> '{settings,draftType}', '') <> 'auction'
     or not coalesce((v_state ->> 'locked')::boolean, false)
     or coalesce((v_state ->> 'paused')::boolean, false)
     or coalesce((v_state ->> 'auctionEnded')::boolean, false) then
    return jsonb_build_object('status', 'inactive');
  end if;

  v_nominee := v_state -> 'nominee';
  if v_nominee is null or v_nominee = 'null'::jsonb then
    return jsonb_build_object('status', 'no_nomination');
  end if;
  if coalesce(v_nominee ->> 'deadline', '') !~ '^[0-9]+$' then
    raise exception 'The active auction has an invalid bidding deadline.';
  end if;
  v_deadline := (v_nominee ->> 'deadline')::bigint;
  if v_now_ms < v_deadline then
    return jsonb_build_object('status', 'not_due');
  end if;

  v_team_index := (v_nominee ->> 'currentBidder')::integer;
  v_bid := (v_nominee ->> 'currentBid')::integer;
  v_nomination_index := coalesce(
    (v_state ->> 'auctionNominationIdx')::integer,
    0
  );
  v_nomination_seconds := greatest(
    1,
    public.draft_setting_nonnegative_integer(
      v_state -> 'settings',
      'auctionNominationSeconds',
      30
    )
  );
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

  v_mon_id := v_nominee #>> '{mon,id}';
  if nullif(v_mon_id, '') is null
     or not exists (
       select 1
       from jsonb_array_elements(
         coalesce(v_state -> 'pool', '[]'::jsonb)
       ) pokemon(value)
       where pokemon.value ->> 'id' = v_mon_id
     ) then
    raise exception 'The nominated Pokemon is no longer in the draft pool.';
  end if;

  v_mon := jsonb_set(
    v_nominee -> 'mon',
    '{listedCost}',
    to_jsonb(
      coalesce(
        (v_nominee #>> '{mon,listedCost}')::integer,
        (v_nominee #>> '{mon,cost}')::integer,
        1
      )
    ),
    true
  );
  v_mon := jsonb_set(v_mon, '{cost}', to_jsonb(v_bid), true);
  v_mon := jsonb_set(v_mon, '{acquiredVia}', '"draft"'::jsonb, true);

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
  where league_id = p_league_id;

  insert into public.league_events (league_id, kind, actor_id, payload)
  values (
    p_league_id,
    'auction_resolve',
    null,
    jsonb_build_object(
      'team_index', v_team_index,
      'pokemon_id', v_mon_id,
      'amount', v_bid,
      'source', 'server_clock'
    )
  );

  return jsonb_build_object('status', 'resolved');
end;
$$;

-- Start scheduled auctions only when the currently saved setup still says
-- auction. A stale due job is cancelled instead of overwriting a newer snake
-- configuration.
create or replace function public.reconcile_scheduled_auction_drafts()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.scheduled_auction_draft_jobs;
  v_state jsonb;
  v_now_ms bigint;
  v_nomination_seconds integer;
  v_started integer := 0;
  v_cancelled integer := 0;
  v_failed integer := 0;
begin
  v_now_ms := floor(extract(epoch from clock_timestamp()) * 1000)::bigint;
  for v_job in
    select *
    from public.scheduled_auction_draft_jobs
    where status = 'scheduled'
      and starts_at <= clock_timestamp()
    order by starts_at
    for update skip locked
  loop
    begin
      perform pg_advisory_xact_lock(
        hashtextextended('draftcenter-draft-mode:' || v_job.league_id::text, 0)
      );
      update public.scheduled_auction_draft_jobs
      set status = 'starting', updated_at = now()
      where league_id = v_job.league_id;

      select state
      into v_state
      from public.league_state_snapshots
      where league_id = v_job.league_id
      for update;

      if v_state is null
         or coalesce(v_state #>> '{settings,draftType}', 'snake') <> 'auction'
         or coalesce((v_state ->> 'locked')::boolean, false) then
        update public.scheduled_auction_draft_jobs
        set status = 'cancelled', last_error = null, updated_at = now()
        where league_id = v_job.league_id;
        insert into public.league_events (league_id, kind, actor_id, payload)
        values (
          v_job.league_id,
          'scheduled_auction_cancelled_stale',
          null,
          jsonb_build_object('source', 'server_clock')
        );
        v_cancelled := v_cancelled + 1;
        continue;
      end if;

      v_nomination_seconds := greatest(
        1,
        public.draft_setting_nonnegative_integer(
          v_job.started_state -> 'settings',
          'auctionNominationSeconds',
          30
        )
      );
      v_state := jsonb_set(
        v_job.started_state,
        '{settings,draftScheduledAt}',
        'null'::jsonb,
        true
      );
      v_state := jsonb_set(
        v_state,
        '{draftStartedAt}',
        to_jsonb(v_now_ms),
        true
      );
      v_state := jsonb_set(
        v_state,
        '{nominationDeadline}',
        to_jsonb(v_now_ms + v_nomination_seconds::bigint * 1000),
        true
      );
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
      where league_id = v_job.league_id;
      update public.leagues
      set draft_starts_at = null, updated_at = now()
      where id = v_job.league_id;
      update public.scheduled_auction_draft_jobs
      set status = 'started', last_error = null, updated_at = now()
      where league_id = v_job.league_id;
      insert into public.league_events (league_id, kind, actor_id, payload)
      values (
        v_job.league_id,
        'scheduled_auction_started',
        null,
        jsonb_build_object('started_at', clock_timestamp())
      );
      v_started := v_started + 1;
    exception when others then
      update public.scheduled_auction_draft_jobs
      set status = 'failed', last_error = sqlerrm, updated_at = now()
      where league_id = v_job.league_id;
      insert into public.league_events (league_id, kind, actor_id, payload)
      values (
        v_job.league_id,
        'scheduled_auction_start_failed',
        null,
        jsonb_build_object('error', sqlerrm)
      );
      v_failed := v_failed + 1;
    end;
  end loop;
  return jsonb_build_object(
    'started', v_started,
    'cancelled', v_cancelled,
    'failed', v_failed
  );
end;
$$;

-- The fleet reconciler retains nomination-clock starts and expired skips. An
-- active winning nomination delegates to the row-locked helper above.
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
  v_result jsonb;
  v_now_ms bigint;
  v_deadline bigint;
  v_nomination_seconds integer;
  v_nomination_index integer;
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
      and case
        when coalesce(snapshot.state -> 'nominee', 'null'::jsonb)
          <> 'null'::jsonb then
          coalesce(snapshot.state #>> '{nominee,deadline}', '')
            !~ '^[0-9]+$'
          or (snapshot.state #>> '{nominee,deadline}')::bigint <= v_now_ms
        else
          coalesce(snapshot.state ->> 'nominationDeadline', '')
            !~ '^[0-9]+$'
          or (snapshot.state ->> 'nominationDeadline')::bigint <= v_now_ms
      end
    for update skip locked
  loop
    begin
      v_state := v_snapshot.state;
      v_nominee := v_state -> 'nominee';
      v_nomination_index := coalesce(
        (v_state ->> 'auctionNominationIdx')::integer,
        0
      );
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

        v_result := public.resolve_expired_auction_nomination(
          v_snapshot.league_id
        );
        if v_result ->> 'status' = 'resolved' then
          v_resolved := v_resolved + 1;
        end if;
        continue;
      end if;

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

revoke all on function public.cancel_opposite_scheduled_draft_job()
  from public, anon, authenticated;
revoke all on function public.cancel_stale_scheduled_draft_mode()
  from public, anon, authenticated;
revoke all on function public.sync_live_auction_league_lifecycle()
  from public, anon, authenticated;
revoke all on function public.resolve_expired_auction_nomination(uuid)
  from public, anon, authenticated;
grant execute on function public.resolve_expired_auction_nomination(uuid)
  to service_role;
revoke all on function public.reconcile_scheduled_auction_drafts()
  from public, anon, authenticated;
grant execute on function public.reconcile_scheduled_auction_drafts()
  to service_role;
revoke all on function public.reconcile_autonomous_live_auctions()
  from public, anon, authenticated;
grant execute on function public.reconcile_autonomous_live_auctions()
  to service_role;

-- Repair only stale prepared jobs; active drafts, picks, rosters, nominations,
-- and deadlines are intentionally untouched by the migration itself.
update public.scheduled_snake_draft_jobs job
set status = 'cancelled', last_error = null, updated_at = now()
from public.league_state_snapshots snapshot
where snapshot.league_id = job.league_id
  and job.status in ('scheduled', 'failed')
  and coalesce(snapshot.state #>> '{settings,draftType}', 'snake') <> 'snake';

update public.scheduled_auction_draft_jobs job
set status = 'cancelled', last_error = null, updated_at = now()
from public.league_state_snapshots snapshot
where snapshot.league_id = job.league_id
  and job.status in ('scheduled', 'failed')
  and coalesce(snapshot.state #>> '{settings,draftType}', 'snake') <> 'auction';

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid)
    from cron.job
    where jobname = 'draftcenter-live-auction-rollover';
    perform cron.schedule(
      'draftcenter-live-auction-rollover',
      '10 seconds',
      'select public.reconcile_autonomous_live_auctions()'
    );
  else
    raise notice 'Enable pg_cron, then run reconcile_autonomous_live_auctions every 10 seconds.';
  end if;
exception when others then
  raise notice 'Auction rollover cron registration needs manual verification: %', sqlerrm;
end;
$$;

commit;

notify pgrst, 'reload schema';
