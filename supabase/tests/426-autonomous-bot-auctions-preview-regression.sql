-- Preview-only regression matrix for migrations 426 and 427.
-- Run only in an isolated Supabase branch after the production baseline
-- through migration 427 exists. The transaction rolls back every fixture.

begin;

do $regression$
declare
  v_owner uuid := gen_random_uuid();
  v_league uuid;
  v_base_state jsonb;
  v_state jsonb;
  v_before_state jsonb;
  v_result jsonb;
  v_revision bigint;
  v_before_revision bigint;
  v_first_deadline bigint;
  v_event_count integer;
  v_index integer;
begin
  insert into auth.users(id, aud, role)
  values (v_owner, 'authenticated', 'authenticated');
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_owner, 'role', 'authenticated')::text,
    true
  );

  select public.create_league(
    'Autonomous Auction Preview',
    'autonomous-auction-' || substr(replace(v_owner::text, '-', ''), 1, 12),
    'Disposable migration 426 fixture',
    'Preview'
  ) into v_league;

  v_base_state := jsonb_build_object(
    'settings', jsonb_build_object(
      'draftType', 'auction',
      'leagueSize', 3,
      'rosterMin', 1,
      'rosterMax', 2,
      'restrictedCap', 1,
      'megaCap', 1,
      'priceTierMax', 20,
      'auctionNominationSeconds', 30,
      'auctionTimerSeconds', 30,
      'auctionBidResetSeconds', 30
    ),
    'teams', jsonb_build_array(
      jsonb_build_object('id', 0, 'name', 'Preview Bot One'),
      jsonb_build_object(
        'id', 1,
        'name', 'Preview Human',
        'claimedBy', 'Preview Owner',
        'claimedByUserId', v_owner::text
      ),
      jsonb_build_object('id', 2, 'name', 'Preview Bot Two')
    ),
    'rosters', jsonb_build_array('[]'::jsonb, '[]'::jsonb, '[]'::jsonb),
    'budgets', jsonb_build_array(10, 10, 10),
    'pool', jsonb_build_array(
      jsonb_build_object('id', 'preview-premium', 'name', 'Preview Premium', 'cost', 8),
      jsonb_build_object('id', 'preview-mid', 'name', 'Preview Mid', 'cost', 5),
      jsonb_build_object('id', 'preview-value', 'name', 'Preview Value', 'cost', 2)
    ),
    'queues', jsonb_build_object(
      '0', jsonb_build_array('Preview Value')
    ),
    'auctionNominationOrder', jsonb_build_array(0, 1, 2),
    'auctionNominationIdx', 0,
    'nominationDeadline', null,
    'nominee', null,
    'paused', false,
    'pausedAt', null,
    'pauseIsOvernight', false,
    'auctionEnded', false,
    'locked', true,
    'rev', 1
  );

  -- Paused real auctions, including an intentionally paused incident league,
  -- are strict no-ops. The migration never resumes one implicitly.
  update public.league_state_snapshots
  set state = jsonb_set(v_base_state, '{paused}', 'true'::jsonb, true),
      revision = revision + 1,
      updated_at = now()
  where league_id = v_league;
  select state, revision into v_before_state, v_before_revision
  from public.league_state_snapshots where league_id = v_league;
  v_result := public.run_autonomous_live_auction_action(v_league);
  select state, revision into v_state, v_revision
  from public.league_state_snapshots where league_id = v_league;
  if v_result ->> 'status' <> 'inactive'
     or v_state <> v_before_state
     or v_revision <> v_before_revision then
    raise exception 'A paused auction was changed or resumed by automation.';
  end if;

  -- An unclaimed team nominates without any browser, and an immediate second
  -- scheduler attempt cannot produce a duplicate action.
  update public.league_state_snapshots
  set state = v_base_state,
      revision = revision + 1,
      updated_at = now()
  where league_id = v_league;
  v_result := public.run_autonomous_live_auction_action(v_league);
  select state, revision into v_state, v_revision
  from public.league_state_snapshots where league_id = v_league;
  if v_result ->> 'status' <> 'bot_nominated'
     or v_state #>> '{nominee,nominatedBy}' <> '0'
     or v_state #>> '{nominee,currentBidder}' <> '0'
     or v_state #>> '{nominee,mon,id}' <> 'preview-value'
     or (v_state #>> '{nominee,deadline}')::bigint
       <= floor(extract(epoch from clock_timestamp()) * 1000)::bigint then
    raise exception 'The unattended bot did not create a valid nomination.';
  end if;
  select count(*) into v_event_count
  from public.league_events
  where league_id = v_league
    and kind = 'auction_nominate'
    and payload ->> 'source' = 'server_bot';
  if v_event_count <> 1 then
    raise exception 'The server bot nomination was not distinctly recorded.';
  end if;
  v_before_revision := v_revision;
  v_result := public.run_autonomous_live_auction_action(v_league);
  select revision into v_revision
  from public.league_state_snapshots where league_id = v_league;
  if v_result ->> 'status' <> 'throttled'
     or v_revision <> v_before_revision then
    raise exception 'A duplicate scheduler pass changed the auction.';
  end if;

  -- A second bot can bid from the authoritative state, and that bid creates a
  -- fresh complete response window rather than shortening the human clock.
  update public.league_state_snapshots
  set state = jsonb_set(
        jsonb_set(
          v_base_state,
          '{nominee}',
          jsonb_build_object(
            'mon', jsonb_build_object(
              'id', 'preview-premium',
              'name', 'Preview Premium',
              'cost', 8
            ),
            'currentBid', 1,
            'currentBidder', 0,
            'nominatedBy', 0,
            'deadline', floor(extract(epoch from clock_timestamp() + interval '1 minute') * 1000)::bigint,
            'bids', jsonb_build_array(
              jsonb_build_object('teamIdx', 0, 'amount', 1, 'at', 1)
            )
          ),
          true
        ),
        '{auctionAutomation}',
        jsonb_build_object('lastServerActionAt', 0),
        true
      ),
      revision = revision + 1,
      updated_at = now()
  where league_id = v_league;
  v_result := public.run_autonomous_live_auction_action(v_league);
  select state into v_state
  from public.league_state_snapshots where league_id = v_league;
  if v_result ->> 'status' <> 'bot_bid'
     or v_state #>> '{nominee,currentBidder}' <> '2'
     or (v_state #>> '{nominee,currentBid}')::integer <= 1
     or (v_state #>> '{nominee,deadline}')::bigint
       < floor(extract(epoch from clock_timestamp() + interval '25 seconds') * 1000)::bigint then
    raise exception 'The unattended bot bid or reset window was invalid.';
  end if;
  if not exists (
    select 1 from public.league_events
    where league_id = v_league
      and kind = 'auction_bid'
      and payload ->> 'source' = 'server_bot'
      and payload ->> 'team_index' = '2'
  ) then
    raise exception 'The server bot bid was not distinctly recorded.';
  end if;

  -- A claimed team receives the complete nomination window. Before expiry the
  -- scheduler is a no-op; after expiry it advances exactly once.
  update public.league_state_snapshots
  set state = jsonb_set(
        jsonb_set(
          jsonb_set(v_base_state, '{auctionNominationIdx}', '1'::jsonb, true),
          '{nominationDeadline}',
          'null'::jsonb,
          true
        ),
        '{auctionAutomation}',
        jsonb_build_object('lastServerActionAt', 0),
        true
      ),
      revision = revision + 1,
      updated_at = now()
  where league_id = v_league;
  v_result := public.run_autonomous_live_auction_action(v_league);
  select state, revision into v_state, v_revision
  from public.league_state_snapshots where league_id = v_league;
  v_first_deadline := (v_state ->> 'nominationDeadline')::bigint;
  if v_result ->> 'status' <> 'started_human_clock'
     or v_first_deadline
       < floor(extract(epoch from clock_timestamp() + interval '25 seconds') * 1000)::bigint then
    raise exception 'The human nomination clock did not receive its full window.';
  end if;
  update public.league_state_snapshots
  set state = jsonb_set(
        state,
        '{auctionAutomation,lastServerActionAt}',
        '0'::jsonb,
        true
      ),
      updated_at = now()
  where league_id = v_league;
  select revision into v_before_revision
  from public.league_state_snapshots where league_id = v_league;
  v_result := public.run_autonomous_live_auction_action(v_league);
  select revision into v_revision
  from public.league_state_snapshots where league_id = v_league;
  if v_result ->> 'status' <> 'waiting_for_human_nomination'
     or v_revision <> v_before_revision then
    raise exception 'Automation advanced before the human window expired.';
  end if;
  update public.league_state_snapshots
  set state = jsonb_set(
        jsonb_set(state, '{nominationDeadline}', '1'::jsonb, true),
        '{auctionAutomation,lastServerActionAt}',
        '0'::jsonb,
        true
      ),
      updated_at = now()
  where league_id = v_league;
  v_result := public.run_autonomous_live_auction_action(v_league);
  select state into v_state
  from public.league_state_snapshots where league_id = v_league;
  if v_result ->> 'status' <> 'skipped'
     or (v_state ->> 'auctionNominationIdx')::integer <> 2
     or (v_state #>> '{auctionAutomation,consecutiveNoProgress}')::integer <> 1 then
    raise exception 'The expired human nomination did not advance once.';
  end if;

  -- Three claimed teams that each use their full window without nominating
  -- produce one complete no-progress rotation and a recoverable pause.
  update public.league_state_snapshots
  set state = jsonb_set(
        jsonb_set(
          jsonb_set(
            v_base_state,
            '{teams}',
            jsonb_build_array(
              jsonb_build_object('id', 0, 'name', 'Human Zero', 'claimedByUserId', gen_random_uuid()::text),
              jsonb_build_object('id', 1, 'name', 'Human One', 'claimedByUserId', gen_random_uuid()::text),
              jsonb_build_object('id', 2, 'name', 'Human Two', 'claimedByUserId', gen_random_uuid()::text)
            ),
            true
          ),
          '{nominationDeadline}',
          '1'::jsonb,
          true
        ),
        '{auctionAutomation}',
        jsonb_build_object('lastServerActionAt', 0, 'consecutiveNoProgress', 0),
        true
      ),
      revision = revision + 1,
      updated_at = now()
  where league_id = v_league;
  for v_index in 1..3 loop
    update public.league_state_snapshots
    set state = jsonb_set(
          jsonb_set(state, '{nominationDeadline}', '1'::jsonb, true),
          '{auctionAutomation,lastServerActionAt}',
          '0'::jsonb,
          true
        ),
        updated_at = now()
    where league_id = v_league;
    v_result := public.run_autonomous_live_auction_action(v_league);
  end loop;
  select state into v_state
  from public.league_state_snapshots where league_id = v_league;
  if v_result ->> 'status' <> 'auto_paused'
     or not coalesce((v_state ->> 'paused')::boolean, false)
     or coalesce((v_state ->> 'auctionEnded')::boolean, false)
     or jsonb_array_length(v_state -> 'pool') <> 3
     or exists (
       select 1 from jsonb_array_elements(v_state -> 'rosters') roster(value)
       where jsonb_array_length(roster.value) <> 0
     )
     or not exists (
       select 1 from public.leagues
       where id = v_league
         and status = 'regular_season'
     ) then
    raise exception 'A no-progress rotation was not safely paused intact.';
  end if;
  if not exists (
    select 1 from public.league_events
    where league_id = v_league
      and kind = 'auction_auto_pause'
      and payload ->> 'reason' = 'complete_rotation_without_nomination'
  ) then
    raise exception 'The automatic no-progress pause was not recorded.';
  end if;

  -- If nobody can afford even the minimum legal opening bid, the auction ends
  -- instead of looping or pausing indefinitely.
  update public.league_state_snapshots
  set state = jsonb_set(
        jsonb_set(
          jsonb_set(
            jsonb_set(v_base_state, '{budgets}', '[0, 0, 0]'::jsonb, true),
            '{settings,rosterMin}',
            '0'::jsonb,
            true
          ),
          '{auctionAutomation}',
          jsonb_build_object('lastServerActionAt', 0),
          true
        ),
        '{paused}',
        'false'::jsonb,
        true
      ),
      revision = revision + 1,
      updated_at = now()
  where league_id = v_league;
  v_result := public.run_autonomous_live_auction_action(v_league);
  select state into v_state
  from public.league_state_snapshots where league_id = v_league;
  if v_result ->> 'status' <> 'ended'
     or not coalesce((v_state ->> 'auctionEnded')::boolean, false)
     or jsonb_array_length(v_state -> 'pool') <> 3
     or exists (
       select 1 from jsonb_array_elements(v_state -> 'rosters') roster(value)
       where jsonb_array_length(roster.value) <> 0
     ) then
    raise exception 'The unaffordable auction did not end with its data intact.';
  end if;

  if has_function_privilege(
       'anon',
       'public.run_autonomous_live_auction_action(uuid)',
       'execute'
     )
     or has_function_privilege(
       'authenticated',
       'public.run_autonomous_live_auction_action(uuid)',
       'execute'
     )
     or not has_function_privilege(
       'service_role',
       'public.run_autonomous_live_auction_action(uuid)',
       'execute'
     )
     or has_function_privilege(
       'anon',
       'public.auction_bot_bid_ceiling(jsonb,integer,jsonb)',
       'execute'
     )
     or has_function_privilege(
       'authenticated',
       'public.auction_bot_bid_ceiling(jsonb,integer,jsonb)',
       'execute'
     ) then
    raise exception 'Autonomous auction grants are not service-only.';
  end if;

  if exists (select 1 from pg_extension where extname = 'pg_cron')
     and not exists (
       select 1
       from cron.job
       where jobname = 'draftcenter-live-auction-rollover'
         and schedule = '10 seconds'
     ) then
    raise exception 'The autonomous auction scheduler is not registered.';
  end if;
end;
$regression$;

rollback;
