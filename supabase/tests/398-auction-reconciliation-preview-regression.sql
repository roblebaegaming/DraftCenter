-- Preview-only regression matrix for migration 398.
-- Run only in an isolated Supabase branch after the Production baseline
-- through migration 398 exists. The transaction rolls back every fixture.

begin;

do $regression$
declare
  v_owner uuid := gen_random_uuid();
  v_league uuid;
  v_start_state jsonb;
  v_state jsonb;
  v_result jsonb;
  v_awards integer;
begin
  insert into auth.users(id, aud, role)
  values (v_owner, 'authenticated', 'authenticated');
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_owner, 'role', 'authenticated')::text,
    true
  );

  select public.create_league(
    'Auction Reconciler Preview',
    'auction-reconciler-' || substr(replace(v_owner::text, '-', ''), 1, 12),
    'Disposable migration 398 fixture',
    'Preview'
  ) into v_league;

  v_start_state := jsonb_build_object(
    'settings', jsonb_build_object(
      'draftType', 'auction',
      'leagueSize', 2,
      'rosterMin', 1,
      'rosterMax', 1,
      'auctionNominationSeconds', 30,
      'draftScheduledAt', (clock_timestamp() - interval '1 minute')::text
    ),
    'teams', jsonb_build_array(
      jsonb_build_object('id', 0, 'name', 'Preview Team One'),
      jsonb_build_object('id', 1, 'name', 'Preview Team Two')
    ),
    'rosters', jsonb_build_array('[]'::jsonb, '[]'::jsonb),
    'budgets', jsonb_build_array(10, 10),
    'pool', jsonb_build_array(
      jsonb_build_object('id', 'preview-mon-one', 'name', 'Preview One', 'cost', 2),
      jsonb_build_object('id', 'preview-mon-two', 'name', 'Preview Two', 'cost', 2)
    ),
    'auctionNominationOrder', jsonb_build_array(0, 1),
    'auctionNominationIdx', 0,
    'nominationDeadline', null,
    'nominee', null,
    'paused', false,
    'auctionEnded', false,
    'locked', true,
    'rev', 1
  );

  update public.league_state_snapshots
  set state = jsonb_set(v_start_state, '{locked}', 'false'::jsonb, true),
      revision = revision + 1,
      updated_at = now()
  where league_id = v_league;

  insert into public.scheduled_auction_draft_jobs(
    league_id,
    starts_at,
    commissioner_id,
    started_state,
    preparation_key,
    status
  ) values (
    v_league,
    clock_timestamp() - interval '1 second',
    v_owner,
    v_start_state,
    'preview-auction-start',
    'scheduled'
  );

  perform public.reconcile_scheduled_auction_drafts();
  if (select status::text from public.leagues where id = v_league) <> 'drafting' then
    raise exception 'Scheduled auction start did not set league status to drafting.';
  end if;
  if (select status from public.scheduled_auction_draft_jobs where league_id = v_league) <> 'started'
     or not coalesce(
       (
         select (state ->> 'locked')::boolean
         from public.league_state_snapshots
         where league_id = v_league
       ),
       false
     ) then
    raise exception 'The due scheduled auction did not start exactly once.';
  end if;

  -- Simulate every commissioner browser disconnecting before the first award.
  update public.league_state_snapshots
  set state = jsonb_set(
        jsonb_set(
          state,
          '{nominee}',
          jsonb_build_object(
            'mon', jsonb_build_object(
              'id', 'preview-mon-one',
              'name', 'Preview One',
              'cost', 2
            ),
            'currentBid', 3,
            'currentBidder', 0,
            'nominatedBy', 0,
            'deadline', 1,
            'bids', jsonb_build_array(
              jsonb_build_object('teamIdx', 0, 'amount', 3, 'at', 1)
            )
          ),
          true
        ),
        '{nominationDeadline}',
        'null'::jsonb,
        true
      ),
      revision = revision + 1,
      updated_at = clock_timestamp() - interval '5 minutes'
  where league_id = v_league;

  v_result := public.resolve_expired_auction_nomination(v_league);
  if v_result ->> 'status' <> 'resolved' then
    raise exception 'Disconnect-before-award fallback did not resolve the purchase.';
  end if;

  select state into v_state
  from public.league_state_snapshots
  where league_id = v_league;
  if jsonb_array_length(v_state #> '{rosters,0}') <> 1
     or (v_state #>> '{budgets,0}')::integer <> 7
     or v_state #>> '{rosters,0,0,id}' <> 'preview-mon-one'
     or v_state #>> '{rosters,0,0,listedCost}' <> '2'
     or v_state -> 'nominee' <> 'null'::jsonb then
    raise exception 'The server award was not applied atomically.';
  end if;

  select count(*) into v_awards
  from public.league_events
  where league_id = v_league
    and kind = 'auction_resolve';
  v_result := public.resolve_expired_auction_nomination(v_league);
  select state into v_state
  from public.league_state_snapshots
  where league_id = v_league;
  if v_result ->> 'status' <> 'no_nomination'
     or jsonb_array_length(v_state #> '{rosters,0}') <> 1
     or (v_state #>> '{budgets,0}')::integer <> 7 then
    raise exception 'Duplicate resolution changed the winning roster or budget.';
  end if;
  if (
    select count(*)
    from public.league_events
    where league_id = v_league
      and kind = 'auction_resolve'
  ) <> v_awards then
    raise exception 'Duplicate resolution emitted another award event.';
  end if;

  -- Resolve the final nomination and verify draft-to-season lifecycle.
  update public.league_state_snapshots
  set state = jsonb_set(
        state,
        '{nominee}',
        jsonb_build_object(
          'mon', jsonb_build_object(
            'id', 'preview-mon-two',
            'name', 'Preview Two',
            'cost', 2
          ),
          'currentBid', 4,
          'currentBidder', 1,
          'nominatedBy', 1,
          'deadline', 1,
          'bids', jsonb_build_array(
            jsonb_build_object('teamIdx', 1, 'amount', 4, 'at', 1)
          )
        ),
        true
      ),
      revision = revision + 1,
      updated_at = now()
  where league_id = v_league;
  v_result := public.resolve_expired_auction_nomination(v_league);
  select state into v_state
  from public.league_state_snapshots
  where league_id = v_league;
  if v_result ->> 'status' <> 'resolved'
     or jsonb_array_length(v_state -> 'pool') <> 0
     or not coalesce((v_state ->> 'auctionEnded')::boolean, false)
     or (select status::text from public.leagues where id = v_league) <> 'active' then
    raise exception 'Completed auction did not move the league into its active season.';
  end if;

  -- Arm both job shapes, then switch the saved setup to snake. The job-row
  -- trigger serializes the preparations and the snapshot trigger cancels the
  -- now-opposite auction job in the same mode-change transaction.
  insert into public.scheduled_snake_draft_jobs(
    league_id,
    starts_at,
    commissioner_id,
    teams,
    pokemon,
    pick_order,
    settings,
    keepers,
    started_state,
    preparation_key,
    status
  ) values (
    v_league,
    clock_timestamp() + interval '1 hour',
    v_owner,
    v_start_state -> 'teams',
    v_start_state -> 'pool',
    array[0, 1],
    jsonb_build_object('draftType', 'snake'),
    '{}'::jsonb,
    jsonb_set(v_start_state, '{settings,draftType}', '"snake"'::jsonb, true),
    'preview-snake-start',
    'scheduled'
  )
  on conflict (league_id) do update
  set status = 'scheduled',
      preparation_key = excluded.preparation_key,
      updated_at = now();

  update public.scheduled_auction_draft_jobs
  set status = 'scheduled',
      starts_at = clock_timestamp() + interval '1 hour',
      preparation_key = 'preview-stale-auction',
      updated_at = now()
  where league_id = v_league;
  if (select status from public.scheduled_snake_draft_jobs where league_id = v_league) <> 'cancelled' then
    raise exception 'Scheduling auction did not transactionally cancel the snake job.';
  end if;

  update public.league_state_snapshots
  set state = jsonb_set(state, '{settings,draftType}', '"snake"'::jsonb, true),
      revision = revision + 1,
      updated_at = now()
  where league_id = v_league;
  if (select status from public.scheduled_auction_draft_jobs where league_id = v_league) <> 'cancelled' then
    raise exception 'A snake-mode switch left the stale auction job armed.';
  end if;

  if has_function_privilege(
       'anon',
       'public.resolve_expired_auction_nomination(uuid)',
       'execute'
     )
     or has_function_privilege(
       'authenticated',
       'public.resolve_expired_auction_nomination(uuid)',
       'execute'
     )
     or not has_function_privilege(
       'service_role',
       'public.resolve_expired_auction_nomination(uuid)',
       'execute'
     ) then
    raise exception 'Auction resolver grants are not service-only.';
  end if;

  if exists (select 1 from pg_extension where extname = 'pg_cron')
     and not exists (
       select 1
       from cron.job
       where jobname = 'draftcenter-live-auction-rollover'
         and schedule = '10 seconds'
     ) then
    raise exception 'The live auction reconciler is not scheduled every 10 seconds.';
  end if;
end;
$regression$;

rollback;
