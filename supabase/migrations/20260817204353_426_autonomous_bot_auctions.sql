-- Hosted auctions must continue when every commissioner browser is closed.
-- This migration moves unclaimed-team nominations and bids into the existing
-- row-locked server clock while preserving the complete human action windows.

begin;

create or replace function public.auction_state_team_is_bot(
  p_state jsonb,
  p_team_index integer
)
returns boolean
language sql
immutable
set search_path = public
as $$
  select nullif(trim(coalesce(p_state #>> array['teams', p_team_index::text, 'claimedBy'], '')), '') is null
    and nullif(trim(coalesce(p_state #>> array['teams', p_team_index::text, 'claimedByUserId'], '')), '') is null;
$$;

create or replace function public.auction_state_team_can_acquire(
  p_state jsonb,
  p_team_index integer,
  p_mon jsonb
)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
  v_roster jsonb := coalesce(
    p_state #> array['rosters', p_team_index::text],
    '[]'::jsonb
  );
  v_roster_max integer := greatest(
    1,
    public.draft_setting_nonnegative_integer(
      p_state -> 'settings',
      'rosterMax',
      1
    )
  );
  v_budget integer := case
    when coalesce(
      p_state #>> array['budgets', p_team_index::text],
      ''
    ) ~ '^[0-9]+$'
      then (p_state #>> array['budgets', p_team_index::text])::integer
    else 0
  end;
  v_restricted_cap integer;
  v_mega_cap integer;
  v_restricted_count integer;
  v_mega_count integer;
begin
  if p_team_index is null
     or p_team_index < 0
     or p_team_index >= jsonb_array_length(coalesce(p_state -> 'teams', '[]'::jsonb))
     or jsonb_array_length(v_roster) >= v_roster_max
     or v_budget < 1
     or p_mon is null
     or p_mon = 'null'::jsonb then
    return false;
  end if;

  v_restricted_cap := case
    when coalesce(p_state #>> '{settings,restrictedCap}', '') ~ '^[0-9]+$'
      then (p_state #>> '{settings,restrictedCap}')::integer
    else null
  end;
  v_mega_cap := case
    when coalesce(p_state #>> '{settings,megaCap}', '') ~ '^[0-9]+$'
      then (p_state #>> '{settings,megaCap}')::integer
    else null
  end;

  select
    count(*) filter (
      where lower(coalesce(pokemon.value ->> 'isRestricted', 'false'))
        in ('true', 't', '1', 'yes', 'on')
    ),
    count(*) filter (
      where lower(coalesce(pokemon.value ->> 'isMega', 'false'))
        in ('true', 't', '1', 'yes', 'on')
    )
  into v_restricted_count, v_mega_count
  from jsonb_array_elements(v_roster) pokemon(value);

  if lower(coalesce(p_mon ->> 'isRestricted', 'false'))
       in ('true', 't', '1', 'yes', 'on')
     and v_restricted_cap is not null
     and v_restricted_count >= v_restricted_cap then
    return false;
  end if;
  if lower(coalesce(p_mon ->> 'isMega', 'false'))
       in ('true', 't', '1', 'yes', 'on')
     and v_mega_cap is not null
     and v_mega_count >= v_mega_cap then
    return false;
  end if;

  return true;
end;
$$;

create or replace function public.auction_bot_bid_ceiling(
  p_state jsonb,
  p_team_index integer,
  p_mon jsonb
)
returns integer
language plpgsql
immutable
set search_path = public
as $$
declare
  v_roster_count integer := jsonb_array_length(
    coalesce(p_state #> array['rosters', p_team_index::text], '[]'::jsonb)
  );
  v_roster_max integer := greatest(
    1,
    public.draft_setting_nonnegative_integer(
      p_state -> 'settings',
      'rosterMax',
      1
    )
  );
  v_slots_remaining integer;
  v_budget integer := case
    when coalesce(
      p_state #>> array['budgets', p_team_index::text],
      ''
    ) ~ '^[0-9]+$'
      then (p_state #>> array['budgets', p_team_index::text])::integer
    else 0
  end;
  v_listed_cost integer := greatest(1, case
    when coalesce(p_mon ->> 'cost', '') ~ '^[0-9]+$'
      then (p_mon ->> 'cost')::integer
    else 1
  end);
  v_tier_max integer := greatest(
    v_listed_cost,
    public.draft_setting_nonnegative_integer(
      p_state -> 'settings',
      'priceTierMax',
      20
    )
  );
  v_reserve_safe integer;
  v_share_cap integer;
  v_market_ceiling integer;
  v_pace_ceiling integer;
  v_desired integer;
  v_aggression numeric;
  v_hash bigint;
  v_premium boolean;
begin
  if not public.auction_state_team_can_acquire(
    p_state,
    p_team_index,
    p_mon
  ) then
    return 0;
  end if;

  v_slots_remaining := greatest(1, v_roster_max - v_roster_count);
  v_reserve_safe := greatest(1, v_budget - greatest(0, v_slots_remaining - 1));
  v_premium := v_listed_cost::numeric / greatest(1, v_tier_max) >= 0.75;
  v_hash := hashtextextended(
    coalesce(p_state #>> array['teams', p_team_index::text, 'id'], p_team_index::text)
      || ':' || coalesce(p_mon ->> 'id', '')
      || ':' || coalesce(p_state ->> 'seasonNumber', '1'),
    0
  );
  v_aggression := 0.90
    + mod((v_hash & 2147483647::bigint), 31::bigint)::numeric / 100;

  v_market_ceiling := greatest(1, round(v_listed_cost * v_aggression)::integer);
  v_pace_ceiling := greatest(
    1,
    round((v_budget::numeric / v_slots_remaining) * v_aggression)::integer
  );
  v_share_cap := greatest(
    1,
    round(
      v_budget * case
        when v_slots_remaining <= 2 then 1.00
        when v_slots_remaining <= 4 and v_premium then 0.70
        when v_slots_remaining <= 4 then 0.55
        when v_premium then 0.45
        else 0.35
      end
    )::integer
  );
  v_desired := case
    when v_premium then greatest(v_market_ceiling, v_pace_ceiling)
    when v_listed_cost::numeric / greatest(1, v_tier_max) >= 0.50
      then least(v_market_ceiling, greatest(1, round(v_pace_ceiling * 1.05)::integer))
    else least(v_market_ceiling, v_pace_ceiling)
  end;

  return greatest(
    0,
    least(v_desired, v_reserve_safe, v_share_cap, v_budget)
  );
end;
$$;

-- Human nominations or purchases break a run of server-observed empty turns.
-- Resuming manually also starts a fresh no-progress rotation.
create or replace function public.reset_live_auction_no_progress()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_automation jsonb;
begin
  if coalesce(new.state #>> '{settings,draftType}', '') <> 'auction' then
    return new;
  end if;

  if (
    coalesce(old.state -> 'nominee', 'null'::jsonb) = 'null'::jsonb
    and coalesce(new.state -> 'nominee', 'null'::jsonb) <> 'null'::jsonb
  ) or jsonb_array_length(coalesce(new.state -> 'pool', '[]'::jsonb))
      < jsonb_array_length(coalesce(old.state -> 'pool', '[]'::jsonb))
    or (
      coalesce((old.state ->> 'paused')::boolean, false)
      and not coalesce((new.state ->> 'paused')::boolean, false)
    ) then
    v_automation := coalesce(new.state -> 'auctionAutomation', '{}'::jsonb)
      || jsonb_build_object('consecutiveNoProgress', 0);
    new.state := jsonb_set(
      new.state,
      '{auctionAutomation}',
      v_automation,
      true
    );
  end if;

  return new;
end;
$$;

drop trigger if exists reset_live_auction_no_progress
  on public.league_state_snapshots;
create trigger reset_live_auction_no_progress
before update of state on public.league_state_snapshots
for each row execute function public.reset_live_auction_no_progress();

-- Keep the existing atomic award boundary, and mark the resolution as the one
-- server action for this league during the current scheduler interval.
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
  v_automation jsonb;
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
  v_automation := coalesce(v_state -> 'auctionAutomation', '{}'::jsonb)
    || jsonb_build_object(
      'consecutiveNoProgress', 0,
      'lastServerActionAt', v_now_ms,
      'lastServerAction', 'resolve',
      'lastServerTeamIndex', v_team_index
    );
  v_state := jsonb_set(
    v_state,
    '{auctionAutomation}',
    v_automation,
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
      'source', 'server_automation'
    )
  );

  return jsonb_build_object('status', 'resolved');
end;
$$;

create or replace function public.run_autonomous_live_auction_action(
  p_league_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_state jsonb;
  v_now_ms bigint := floor(
    extract(epoch from clock_timestamp()) * 1000
  )::bigint;
  v_last_server_action_at bigint;
  v_nominee jsonb;
  v_deadline bigint;
  v_order jsonb;
  v_n integer;
  v_team_count integer;
  v_nomination_index integer;
  v_team_index integer;
  v_team_is_bot boolean;
  v_mon jsonb;
  v_mon_id text;
  v_current_bid integer;
  v_current_bidder integer;
  v_bid_team_index integer;
  v_bid_ceiling integer;
  v_bid integer;
  v_reset_seconds integer;
  v_nomination_seconds integer;
  v_auction_seconds integer;
  v_any_eligible boolean;
  v_all_rosters_full boolean;
  v_roster_max integer;
  v_no_progress integer;
  v_nomination_tier_window integer;
  v_automation jsonb;
  v_event_kind text;
  v_event_payload jsonb := '{}'::jsonb;
  v_status text;
  v_result jsonb;
begin
  if not pg_try_advisory_xact_lock(
    hashtextextended('draftcenter-auction:' || p_league_id::text, 0)
  ) then
    return jsonb_build_object('status', 'locked');
  end if;

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

  v_last_server_action_at := case
    when coalesce(v_state #>> '{auctionAutomation,lastServerActionAt}', '')
      ~ '^[0-9]+$'
      then (v_state #>> '{auctionAutomation,lastServerActionAt}')::bigint
    else 0
  end;
  if v_last_server_action_at > v_now_ms - 8000 then
    return jsonb_build_object('status', 'throttled');
  end if;

  v_nomination_seconds := greatest(
    1,
    public.draft_setting_nonnegative_integer(
      v_state -> 'settings',
      'auctionNominationSeconds',
      30
    )
  );
  v_auction_seconds := greatest(
    1,
    public.draft_setting_nonnegative_integer(
      v_state -> 'settings',
      'auctionTimerSeconds',
      30
    )
  );
  v_reset_seconds := greatest(
    1,
    public.draft_setting_nonnegative_integer(
      v_state -> 'settings',
      'auctionBidResetSeconds',
      10
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
  v_order := coalesce(v_state -> 'auctionNominationOrder', '[]'::jsonb);
  v_n := jsonb_array_length(v_order);
  v_team_count := jsonb_array_length(coalesce(v_state -> 'teams', '[]'::jsonb));
  v_nomination_index := coalesce((v_state ->> 'auctionNominationIdx')::integer, 0);
  v_no_progress := greatest(0, case
    when coalesce(
      v_state #>> '{auctionAutomation,consecutiveNoProgress}',
      ''
    ) ~ '^[0-9]+$'
      then (v_state #>> '{auctionAutomation,consecutiveNoProgress}')::integer
    else 0
  end);
  v_nominee := coalesce(v_state -> 'nominee', 'null'::jsonb);

  if v_nominee <> 'null'::jsonb then
    if coalesce(v_nominee ->> 'deadline', '') !~ '^[0-9]+$' then
      raise exception 'The active auction has an invalid bidding deadline.';
    end if;
    v_deadline := (v_nominee ->> 'deadline')::bigint;
    if v_now_ms >= v_deadline then
      v_result := public.resolve_expired_auction_nomination(p_league_id);
      return v_result;
    end if;

    v_mon := v_nominee -> 'mon';
    v_current_bid := (v_nominee ->> 'currentBid')::integer;
    v_current_bidder := (v_nominee ->> 'currentBidder')::integer;
    select candidate.team_index, candidate.ceiling
    into v_bid_team_index, v_bid_ceiling
    from (
      select
        team.ordinality::integer - 1 as team_index,
        public.auction_bot_bid_ceiling(
          v_state,
          team.ordinality::integer - 1,
          v_mon
        ) as ceiling
      from jsonb_array_elements(coalesce(v_state -> 'teams', '[]'::jsonb))
        with ordinality as team(value, ordinality)
      where team.ordinality::integer - 1 <> v_current_bidder
        and public.auction_state_team_is_bot(
          v_state,
          team.ordinality::integer - 1
        )
        and public.auction_state_team_can_acquire(
          v_state,
          team.ordinality::integer - 1,
          v_mon
        )
    ) candidate
    where candidate.ceiling > v_current_bid
    order by candidate.ceiling desc,
      md5(
        p_league_id::text || ':'
          || coalesce(v_mon ->> 'id', '') || ':'
          || candidate.team_index::text || ':'
          || v_current_bid::text
      )
    limit 1;

    if v_bid_team_index is null then
      return jsonb_build_object('status', 'waiting_for_bids');
    end if;

    v_bid := least(
      v_bid_ceiling,
      v_current_bid
        + greatest(1, ceil((v_bid_ceiling - v_current_bid) * 0.35)::integer)
    );
    v_nominee := jsonb_set(v_nominee, '{currentBid}', to_jsonb(v_bid), true);
    v_nominee := jsonb_set(
      v_nominee,
      '{currentBidder}',
      to_jsonb(v_bid_team_index),
      true
    );
    v_nominee := jsonb_set(
      v_nominee,
      '{deadline}',
      to_jsonb(v_now_ms + v_reset_seconds::bigint * 1000),
      true
    );
    v_nominee := jsonb_set(
      v_nominee,
      '{bids}',
      coalesce(v_nominee -> 'bids', '[]'::jsonb)
        || jsonb_build_array(
          jsonb_build_object(
            'teamIdx', v_bid_team_index,
            'amount', v_bid,
            'at', v_now_ms
          )
        ),
      true
    );
    v_state := jsonb_set(v_state, '{nominee}', v_nominee, true);
    v_status := 'bot_bid';
    v_event_kind := 'auction_bid';
    v_event_payload := jsonb_build_object(
      'team_index', v_bid_team_index,
      'amount', v_bid,
      'source', 'server_bot'
    );
    v_team_index := v_bid_team_index;
  else
    select exists (
      select 1
      from jsonb_array_elements(coalesce(v_state -> 'teams', '[]'::jsonb))
        with ordinality as team(value, ordinality)
      cross join jsonb_array_elements(coalesce(v_state -> 'pool', '[]'::jsonb))
        pokemon(value)
      where public.auction_state_team_can_acquire(
        v_state,
        team.ordinality::integer - 1,
        pokemon.value
      )
    ) into v_any_eligible;
    select coalesce(bool_and(
      jsonb_array_length(
        coalesce(v_state #> array['rosters', (team.ordinality::integer - 1)::text], '[]'::jsonb)
      ) >= v_roster_max
    ), false)
    into v_all_rosters_full
    from jsonb_array_elements(coalesce(v_state -> 'teams', '[]'::jsonb))
      with ordinality as team(value, ordinality);

    if v_team_count = 0 or not v_any_eligible then
      v_state := jsonb_set(v_state, '{auctionEnded}', 'true'::jsonb, true);
      v_state := jsonb_set(v_state, '{nominationDeadline}', 'null'::jsonb, true);
      v_status := 'ended';
      v_event_kind := 'auction_end';
      v_event_payload := jsonb_build_object(
        'source', 'server_automation',
        'reason', case
          when v_all_rosters_full then 'rosters_complete'
          else 'no_eligible_affordable_pokemon'
        end
      );
      v_team_index := null;
    elsif v_n = 0 then
      v_state := jsonb_set(v_state, '{paused}', 'true'::jsonb, true);
      v_state := jsonb_set(v_state, '{pausedAt}', to_jsonb(v_now_ms), true);
      v_state := jsonb_set(v_state, '{pauseIsOvernight}', 'false'::jsonb, true);
      v_state := jsonb_set(v_state, '{nominationDeadline}', 'null'::jsonb, true);
      v_status := 'auto_paused';
      v_event_kind := 'auction_auto_pause';
      v_event_payload := jsonb_build_object(
        'source', 'server_automation',
        'reason', 'missing_nomination_order'
      );
      v_team_index := null;
    else
      v_team_index := (v_order ->> (v_nomination_index % v_n))::integer;
      if v_team_index < 0 or v_team_index >= v_team_count then
        raise exception 'The auction nomination order contains an invalid team.';
      end if;
      v_team_is_bot := public.auction_state_team_is_bot(v_state, v_team_index);

      if v_team_is_bot then
        -- Preserve the existing bot preference for a queued legal Pokemon.
        select pokemon.value
        into v_mon
        from jsonb_array_elements(coalesce(v_state -> 'pool', '[]'::jsonb))
          pokemon(value)
        join jsonb_array_elements_text(
          coalesce(
            v_state #> array['queues', v_team_index::text],
            '[]'::jsonb
          )
        ) with ordinality as queued(name, position)
          on queued.name = pokemon.value ->> 'name'
        where public.auction_state_team_can_acquire(
          v_state,
          v_team_index,
          pokemon.value
        )
        order by queued.position
        limit 1;

        -- Without a queue, rotate deterministically through the three to five
        -- best remaining price tiers instead of always exposing the top name.
        v_nomination_tier_window := 3 + mod(
          hashtextextended(
            p_league_id::text || ':' || v_team_index::text || ':'
              || v_nomination_index::text,
            0
          ) & 2147483647::bigint,
          3::bigint
        )::integer;
        if v_mon is null then
          select candidate.value
          into v_mon
          from (
            select
              pokemon.value,
              dense_rank() over (
                order by case
                  when coalesce(pokemon.value ->> 'cost', '') ~ '^[0-9]+$'
                    then (pokemon.value ->> 'cost')::integer
                  else 0
                end desc
              ) as tier_rank
            from jsonb_array_elements(coalesce(v_state -> 'pool', '[]'::jsonb))
              pokemon(value)
            where public.auction_state_team_can_acquire(
              v_state,
              v_team_index,
              pokemon.value
            )
          ) candidate
          where candidate.tier_rank <= v_nomination_tier_window
          order by md5(
            p_league_id::text || ':' || v_team_index::text || ':'
              || v_nomination_index::text || ':'
              || coalesce(candidate.value ->> 'id', '')
          )
          limit 1;
        end if;

        if v_mon is not null then
          v_mon_id := v_mon ->> 'id';
          v_nominee := jsonb_build_object(
            'mon', v_mon,
            'currentBid', 1,
            'currentBidder', v_team_index,
            'nominatedBy', v_team_index,
            'deadline', v_now_ms + v_auction_seconds::bigint * 1000,
            'bids', jsonb_build_array(
              jsonb_build_object(
                'teamIdx', v_team_index,
                'amount', 1,
                'at', v_now_ms
              )
            )
          );
          v_state := jsonb_set(v_state, '{nominee}', v_nominee, true);
          v_state := jsonb_set(v_state, '{nominationDeadline}', 'null'::jsonb, true);
          v_no_progress := 0;
          v_status := 'bot_nominated';
          v_event_kind := 'auction_nominate';
          v_event_payload := jsonb_build_object(
            'team_index', v_team_index,
            'pokemon_id', v_mon_id,
            'amount', 1,
            'source', 'server_bot'
          );
        else
          v_no_progress := v_no_progress + 1;
          v_state := jsonb_set(
            v_state,
            '{auctionNominationIdx}',
            to_jsonb(v_nomination_index + 1),
            true
          );
          if v_no_progress >= v_n then
            v_state := jsonb_set(v_state, '{paused}', 'true'::jsonb, true);
            v_state := jsonb_set(v_state, '{pausedAt}', to_jsonb(v_now_ms), true);
            v_state := jsonb_set(v_state, '{pauseIsOvernight}', 'false'::jsonb, true);
            v_state := jsonb_set(v_state, '{nominationDeadline}', 'null'::jsonb, true);
            v_status := 'auto_paused';
            v_event_kind := 'auction_auto_pause';
            v_event_payload := jsonb_build_object(
              'team_index', v_team_index,
              'source', 'server_automation',
              'reason', 'complete_rotation_without_nomination',
              'rotation_size', v_n
            );
          else
            v_state := jsonb_set(
              v_state,
              '{nominationDeadline}',
              to_jsonb(v_now_ms + v_nomination_seconds::bigint * 1000),
              true
            );
            v_status := 'skipped';
            v_event_kind := 'auction_skip';
            v_event_payload := jsonb_build_object(
              'team_index', v_team_index,
              'source', 'server_automation',
              'reason', 'no_eligible_affordable_pokemon_for_team',
              'consecutive_no_progress', v_no_progress
            );
          end if;
        end if;
      else
        if coalesce(v_state ->> 'nominationDeadline', '') !~ '^[0-9]+$' then
          v_state := jsonb_set(
            v_state,
            '{nominationDeadline}',
            to_jsonb(v_now_ms + v_nomination_seconds::bigint * 1000),
            true
          );
          v_status := 'started_human_clock';
          v_event_kind := 'auction_start_clock';
          v_event_payload := jsonb_build_object(
            'team_index', v_team_index,
            'source', 'server_automation'
          );
        else
          v_deadline := (v_state ->> 'nominationDeadline')::bigint;
          if v_now_ms < v_deadline then
            return jsonb_build_object('status', 'waiting_for_human_nomination');
          end if;

          v_no_progress := v_no_progress + 1;
          v_state := jsonb_set(
            v_state,
            '{auctionNominationIdx}',
            to_jsonb(v_nomination_index + 1),
            true
          );
          if v_no_progress >= v_n then
            v_state := jsonb_set(v_state, '{paused}', 'true'::jsonb, true);
            v_state := jsonb_set(v_state, '{pausedAt}', to_jsonb(v_now_ms), true);
            v_state := jsonb_set(v_state, '{pauseIsOvernight}', 'false'::jsonb, true);
            v_state := jsonb_set(v_state, '{nominationDeadline}', 'null'::jsonb, true);
            v_status := 'auto_paused';
            v_event_kind := 'auction_auto_pause';
            v_event_payload := jsonb_build_object(
              'team_index', v_team_index,
              'source', 'server_automation',
              'reason', 'complete_rotation_without_nomination',
              'rotation_size', v_n
            );
          else
            v_state := jsonb_set(
              v_state,
              '{nominationDeadline}',
              to_jsonb(v_now_ms + v_nomination_seconds::bigint * 1000),
              true
            );
            v_status := 'skipped';
            v_event_kind := 'auction_skip';
            v_event_payload := jsonb_build_object(
              'team_index', v_team_index,
              'source', 'server_automation',
              'reason', 'human_nomination_window_expired',
              'consecutive_no_progress', v_no_progress
            );
          end if;
        end if;
      end if;
    end if;
  end if;

  v_automation := coalesce(v_state -> 'auctionAutomation', '{}'::jsonb)
    || jsonb_build_object(
      'consecutiveNoProgress', v_no_progress,
      'lastServerActionAt', v_now_ms,
      'lastServerAction', v_status,
      'lastServerTeamIndex', v_team_index
    );
  v_state := jsonb_set(
    v_state,
    '{auctionAutomation}',
    v_automation,
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
  values (p_league_id, v_event_kind, null, v_event_payload);

  return jsonb_build_object('status', v_status);
end;
$$;

create or replace function public.reconcile_autonomous_live_auctions()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_league_id uuid;
  v_result jsonb;
  v_status text;
  v_actions integer := 0;
  v_waiting integer := 0;
  v_failed integer := 0;
  v_resolved integer := 0;
  v_advanced integer := 0;
  v_started_clocks integer := 0;
  v_bot_nominations integer := 0;
  v_bot_bids integer := 0;
  v_ended integer := 0;
  v_auto_paused integer := 0;
begin
  for v_league_id in
    select snapshot.league_id
    from public.league_state_snapshots snapshot
    where coalesce(snapshot.state #>> '{settings,draftType}', '') = 'auction'
      and coalesce((snapshot.state ->> 'locked')::boolean, false)
      and not coalesce((snapshot.state ->> 'paused')::boolean, false)
      and not coalesce((snapshot.state ->> 'auctionEnded')::boolean, false)
    order by snapshot.league_id
  loop
    begin
      v_result := public.run_autonomous_live_auction_action(v_league_id);
      v_status := coalesce(v_result ->> 'status', 'unknown');
      if v_status in (
        'bot_bid',
        'bot_nominated',
        'ended',
        'auto_paused',
        'skipped',
        'started_human_clock',
        'resolved'
      ) then
        v_actions := v_actions + 1;
      else
        v_waiting := v_waiting + 1;
      end if;
      if v_status = 'resolved' then
        v_resolved := v_resolved + 1;
      elsif v_status = 'skipped' then
        v_advanced := v_advanced + 1;
      elsif v_status = 'started_human_clock' then
        v_started_clocks := v_started_clocks + 1;
      elsif v_status = 'bot_nominated' then
        v_bot_nominations := v_bot_nominations + 1;
      elsif v_status = 'bot_bid' then
        v_bot_bids := v_bot_bids + 1;
      elsif v_status = 'ended' then
        v_ended := v_ended + 1;
      elsif v_status = 'auto_paused' then
        v_auto_paused := v_auto_paused + 1;
      end if;
    exception when others then
      insert into public.league_events (league_id, kind, actor_id, payload)
      values (
        v_league_id,
        'auction_reconciliation_failed',
        null,
        jsonb_build_object(
          'error', sqlerrm,
          'source', 'server_automation'
        )
      );
      v_failed := v_failed + 1;
    end;
  end loop;

  return jsonb_build_object(
    'actions', v_actions,
    'waiting', v_waiting,
    'failed', v_failed,
    -- Preserve the original reconciler's result keys for operator scripts.
    'resolved', v_resolved,
    'advanced', v_advanced,
    'started_clocks', v_started_clocks,
    'bot_nominations', v_bot_nominations,
    'bot_bids', v_bot_bids,
    'ended', v_ended,
    'auto_paused', v_auto_paused
  );
end;
$$;

revoke all on function public.auction_state_team_is_bot(jsonb, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.auction_state_team_is_bot(jsonb, integer)
  to service_role;
revoke all on function public.auction_state_team_can_acquire(jsonb, integer, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.auction_state_team_can_acquire(jsonb, integer, jsonb)
  to service_role;
revoke all on function public.auction_bot_bid_ceiling(jsonb, integer, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.auction_bot_bid_ceiling(jsonb, integer, jsonb)
  to service_role;
revoke all on function public.reset_live_auction_no_progress()
  from public, anon, authenticated, service_role;
revoke all on function public.resolve_expired_auction_nomination(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.resolve_expired_auction_nomination(uuid)
  to service_role;
revoke all on function public.run_autonomous_live_auction_action(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.run_autonomous_live_auction_action(uuid)
  to service_role;
revoke all on function public.reconcile_autonomous_live_auctions()
  from public, anon, authenticated, service_role;
grant execute on function public.reconcile_autonomous_live_auctions()
  to service_role;

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
  raise notice 'Autonomous auction cron registration needs manual verification: %', sqlerrm;
end;
$$;

commit;
