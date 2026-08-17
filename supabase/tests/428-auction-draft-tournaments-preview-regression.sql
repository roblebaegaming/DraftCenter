-- Preview-only 32-player matrix for migration 428.
-- Run only in the one isolated Supabase Preview branch created for this
-- release. Every synthetic identity, event, room, roster, and bracket rolls
-- back with this transaction.

begin;

create temp table dc_auction_tournament_results (
  result jsonb not null
) on commit preserve rows;

create function pg_temp.dc_auth(p_user_id uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', p_user_id, 'role', 'authenticated')::text,
    true
  );
end;
$$;

do $validation$
declare
  v_owner uuid := gen_random_uuid();
  v_players uuid[];
  v_player uuid;
  v_payload jsonb;
  v_tournament_id uuid;
  v_event_id uuid;
  v_league_id uuid;
  v_elimination_tournament_id uuid;
  v_elimination_event_id uuid;
  v_state jsonb;
  v_started jsonb;
  v_final_rosters jsonb;
  v_prefix text;
  v_revision bigint;
  v_phase text;
  v_elapsed_ms numeric;
  v_started_at timestamptz;
  v_match_count integer;
  v_fixture_leagues uuid[];
  v_snake_cap_ok boolean := false;
begin
  select array_agg(gen_random_uuid()) into v_players
  from generate_series(1, 32);
  if array_length(v_players, 1) <> 32 then
    raise exception 'The auction Draft Tournament matrix must contain 32 managers.';
  end if;

  if not has_function_privilege(
       'authenticated',
       'public.create_auction_draft_first_tournament(text,text,text,integer,integer,text,integer,integer,integer,integer,integer,boolean,text)',
       'execute'
     )
     or has_function_privilege(
       'anon',
       'public.create_auction_draft_first_tournament(text,text,text,integer,integer,text,integer,integer,integer,integer,integer,boolean,text)',
       'execute'
     )
     or not has_function_privilege(
       'authenticated',
       'public.lock_auction_draft_tournament_field(uuid,bigint)',
       'execute'
     )
     or has_function_privilege(
       'authenticated',
       'public.materialize_auction_draft_tournament_rosters(uuid)',
       'execute'
     )
     or not has_function_privilege(
       'service_role',
       'public.materialize_auction_draft_tournament_rosters(uuid)',
       'execute'
     ) then
    raise exception 'Auction Draft Tournament grants do not match the RPC-only browser boundary.';
  end if;
  insert into dc_auction_tournament_results values
    (jsonb_build_object('check', 'grants', 'ok', true));

  if (select count(*) = 6 and bool_and(relrowsecurity)
      from pg_class
      where oid in (
        'public.draft_tournament_events'::regclass,
        'public.draft_tournament_seats'::regclass,
        'public.draft_tournament_rounds'::regclass,
        'public.draft_tournament_pairings'::regclass,
        'public.draft_tournament_standing_snapshots'::regclass,
        'public.draft_tournament_top_cut_entries'::regclass
      )) is distinct from true then
    raise exception 'Every Draft Tournament table must keep RLS enabled.';
  end if;
  insert into dc_auction_tournament_results values
    (jsonb_build_object('check', 'rls', 'ok', true));

  insert into auth.users(id, aud, role)
  select identity, 'authenticated', 'authenticated'
  from unnest(array[v_owner] || v_players) identity;
  insert into public.profiles(id, display_name)
  select identity, 'Auction Preview Identity'
  from unnest(array[v_owner] || v_players) identity
  on conflict (id) do update set display_name = excluded.display_name;

  perform pg_temp.dc_auth(v_owner);
  begin
    perform public.create_draft_first_tournament(
      'Rejected 17 Manager Snake', '', 'public', 3, 17, '', 4, 5,
      false, null, false, 'swiss'
    );
  exception when others then
    if sqlerrm not ilike '%invalid%' then raise; end if;
    v_snake_cap_ok := true;
  end;
  if not v_snake_cap_ok then
    raise exception 'The existing snake Draft Tournament boundary no longer rejects 17 entrants.';
  end if;
  insert into dc_auction_tournament_results values
    (jsonb_build_object('check', 'snake_boundary', 'ok', true));

  select public.create_auction_draft_first_tournament(
    'Thirty Two Manager Auction Swiss',
    'Synthetic migration 428 lifecycle',
    'public',
    3,
    32,
    'Preview-only auction matrix',
    4,
    120,
    30,
    30,
    10,
    true,
    'swiss'
  ) into v_payload;
  v_tournament_id := (v_payload ->> 'tournament_id')::uuid;
  v_event_id := (v_payload ->> 'event_id')::uuid;
  v_prefix := 'dc-auction-' || left(replace(v_tournament_id::text, '-', ''), 10) || '-';

  foreach v_player in array v_players loop
    perform pg_temp.dc_auth(v_player);
    perform public.join_tournament(
      v_tournament_id,
      'Auction manager ' || array_position(v_players, v_player),
      null,
      null
    );
  end loop;
  perform pg_temp.dc_auth(v_owner);
  perform public.open_draft_tournament_check_in(v_tournament_id, 0);
  foreach v_player in array v_players loop
    perform pg_temp.dc_auth(v_player);
    perform public.set_draft_tournament_check_in(v_tournament_id, true);
  end loop;
  perform pg_temp.dc_auth(v_owner);
  select revision into v_revision
  from public.draft_tournament_events where id = v_event_id;
  perform public.lock_auction_draft_tournament_field(v_tournament_id, v_revision);
  select draft_league_id into v_league_id
  from public.draft_tournament_events where id = v_event_id;
  v_fixture_leagues := array[v_league_id];

  if (select count(*) from public.draft_tournament_seats
      where event_id = v_event_id and status = 'active') <> 32
     or (select count(*) from public.auction_team_owners
         where league_id = v_league_id) <> 32
     or exists (
       select 1
       from public.draft_tournament_seats seat
       left join public.auction_team_owners owner
         on owner.league_id = v_league_id
        and owner.team_index = seat.team_key
        and owner.user_id = seat.user_id
       where seat.event_id = v_event_id
         and seat.status = 'active'
         and owner.user_id is null
     ) then
    raise exception 'The 32 auction seats were not bound to their exact account IDs.';
  end if;
  insert into dc_auction_tournament_results values
    (jsonb_build_object('check', 'exact_identity', 'ok', true));

  select state into v_state
  from public.league_state_snapshots where league_id = v_league_id;
  v_started := v_state || jsonb_build_object(
    'locked', true,
    'pool', (
      select jsonb_agg(jsonb_build_object(
        'id', v_prefix || pokemon_number,
        'name', 'Preview Pokemon ' || pokemon_number,
        't1', 'normal',
        'cost', 1,
        'listedCost', 1,
        'isMega', false,
        'isRestricted', false
      ) order by pokemon_number)
      from generate_series(1, 128) pokemon_number
    ),
    'budgets', (select jsonb_agg(120 order by team_index) from generate_series(0, 31) team_index),
    'auctionNominationOrder', (select jsonb_agg(team_index order by team_index) from generate_series(0, 31) team_index),
    'auctionNominationIdx', 0,
    'nominationDeadline', null,
    'nominee', null,
    'paused', false,
    'pausedAt', null,
    'pauseIsOvernight', false,
    'auctionEnded', false
  );

  begin
    update public.league_state_snapshots
    set state = jsonb_set(
      v_started,
      '{pool}',
      (select jsonb_agg(value order by ordinality)
       from jsonb_array_elements(v_started -> 'pool') with ordinality
       where ordinality <= 127),
      true
    )
    where league_id = v_league_id;
    raise exception 'The undersized 32-player pool was accepted.';
  exception when others then
    if sqlerrm not ilike '%pool is too small%' then raise; end if;
  end;
  insert into dc_auction_tournament_results values
    (jsonb_build_object('check', 'pool_capacity', 'ok', true));

  update public.league_state_snapshots
  set state = v_started, revision = revision + 1, updated_at = now()
  where league_id = v_league_id;
  select phase into v_phase from public.draft_tournament_events where id = v_event_id;
  if v_phase <> 'drafting' then
    raise exception 'Starting the hosted auction did not move the event into drafting.';
  end if;
  insert into dc_auction_tournament_results values
    (jsonb_build_object('check', 'auction_start', 'ok', true));

  select jsonb_agg(roster order by team_index)
  into v_final_rosters
  from (
    select team_index,
      jsonb_agg(jsonb_build_object(
        'id', v_prefix || (team_index * 4 + roster_slot),
        'name', 'Preview Pokemon ' || (team_index * 4 + roster_slot),
        't1', 'normal',
        'cost', 1,
        'listedCost', 1,
        'acquiredVia', 'draft',
        'isMega', false,
        'isRestricted', false
      ) order by roster_slot) as roster
    from generate_series(0, 31) team_index
    cross join generate_series(1, 4) roster_slot
    group by team_index
  ) completed_rosters;

  update public.league_state_snapshots
  set state = state || jsonb_build_object(
        'rosters', v_final_rosters,
        'pool', '[]'::jsonb,
        'budgets', (select jsonb_agg(116 order by team_index) from generate_series(0, 31) team_index),
        'nominationDeadline', null,
        'nominee', null,
        'paused', false,
        'auctionEnded', true
      ),
      revision = revision + 1,
      updated_at = now()
  where league_id = v_league_id;
  select phase, revision into v_phase, v_revision
  from public.draft_tournament_events where id = v_event_id;
  if v_phase <> 'roster-review' then
    raise exception 'Completing the hosted auction did not move the event into roster review.';
  end if;

  v_started_at := clock_timestamp();
  perform public.lock_draft_tournament_rosters(v_tournament_id, v_revision);
  v_elapsed_ms := extract(epoch from clock_timestamp() - v_started_at) * 1000;
  if v_elapsed_ms > 5000 then
    raise exception 'The 32-player roster lock and first Swiss pairing exceeded 5 seconds (% ms).', v_elapsed_ms;
  end if;
  if not exists (
    select 1 from public.draft_tournament_events event
    where event.id = v_event_id
      and event.phase = 'swiss'
      and event.draft_type = 'auction'
      and event.swiss_round_count = 5
      and event.current_swiss_round = 1
      and event.roster_locked_at is not null
  )
     or (select count(*) from public.draft_tournament_pairings
         where event_id = v_event_id) <> 16
     or (select count(*) from public.draft_tournament_standing_snapshots
         where event_id = v_event_id) <> 32
     or (select count(*) from public.draft_tournament_seats
         where event_id = v_event_id and roster_hash is not null and team_id is not null) <> 32
     or (select count(*) from public.teams where league_id = v_league_id) <> 32
     or (select count(*) from public.roster_entries entry
         join public.teams team on team.id = entry.team_id
         where team.league_id = v_league_id and entry.released_at is null) <> 128 then
    raise exception 'The 32-player auction-to-Swiss roster lock is incomplete.';
  end if;
  if (public.get_draft_tournament_workspace(v_tournament_id) #>> '{event,draft_type}') <> 'auction'
     or (public.get_draft_tournament_workspace(v_tournament_id) #>> '{event,swiss_round_count}') <> '5' then
    raise exception 'The Draft Tournament workspace did not expose the auction lifecycle.';
  end if;
  insert into dc_auction_tournament_results values
    (jsonb_build_object('check', 'auction_roster_lock', 'ok', true, 'elapsed_ms', round(v_elapsed_ms, 2)));
  insert into dc_auction_tournament_results values
    (jsonb_build_object('check', 'swiss_32', 'ok', true, 'pairings', 16));

  perform pg_temp.dc_auth(v_owner);
  select public.create_auction_draft_first_tournament(
    'Thirty Two Manager Auction Double Elimination', '', 'public', 3, 32,
    'Preview-only elimination graph', 4, 120, 30, 30, 10, false,
    'double-elimination'
  ) into v_payload;
  v_elimination_tournament_id := (v_payload ->> 'tournament_id')::uuid;
  v_elimination_event_id := (v_payload ->> 'event_id')::uuid;
  foreach v_player in array v_players loop
    perform pg_temp.dc_auth(v_player);
    perform public.join_tournament(
      v_elimination_tournament_id,
      'Auction elimination manager ' || array_position(v_players, v_player),
      null,
      null
    );
  end loop;
  perform pg_temp.dc_auth(v_owner);
  update public.tournaments set status = 'active' where id = v_elimination_tournament_id;
  update public.draft_tournament_events set phase = 'roster-review' where id = v_elimination_event_id;
  perform public.build_draft_first_elimination_bracket(v_elimination_event_id, v_owner);
  select count(*) into v_match_count
  from public.tournament_matches where tournament_id = v_elimination_tournament_id;
  if v_match_count <> 63
     or (select format from public.tournaments where id = v_elimination_tournament_id) <> 'draft-tournament' then
    raise exception 'The 32-player double-elimination graph must reserve 63 matches and restore the Draft Tournament shell.';
  end if;
  insert into dc_auction_tournament_results values
    (jsonb_build_object('check', 'elimination_32', 'ok', true, 'matches', v_match_count));

  delete from public.tournaments
  where id in (v_tournament_id, v_elimination_tournament_id);
  delete from public.profiles where id = any(array[v_owner] || v_players);
  delete from auth.users where id = any(array[v_owner] || v_players);
  if exists (select 1 from public.tournaments where id in (v_tournament_id, v_elimination_tournament_id))
     or exists (select 1 from public.leagues where id = any(v_fixture_leagues))
     or exists (select 1 from auth.users where id = any(array[v_owner] || v_players)) then
    raise exception 'Synthetic auction Draft Tournament fixtures were not fully removed.';
  end if;
  insert into dc_auction_tournament_results values
    (jsonb_build_object('check', 'cleanup', 'ok', true));
end;
$validation$;

select result from dc_auction_tournament_results order by result ->> 'check';

rollback;
