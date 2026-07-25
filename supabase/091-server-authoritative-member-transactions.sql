-- Server-authoritative manager transactions and stale whole-snapshot protection.

begin;

create or replace function public.league_actor_can_control_snapshot_team(
  p_league_id uuid,
  p_state jsonb,
  p_team_index integer
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_claimed_by text;
  v_display_name text;
  v_username text;
begin
  if public.is_league_staff(p_league_id) then
    return true;
  end if;
  if auth.uid() is null
     or not public.is_league_member(p_league_id)
     or p_team_index is null
     or p_team_index < 0
     or jsonb_typeof(p_state -> 'teams') <> 'array'
     or p_team_index >= jsonb_array_length(p_state -> 'teams') then
    return false;
  end if;

  if exists (
    select 1
    from public.teams t
    join public.league_memberships membership
      on membership.id = t.owner_membership_id
    where t.league_id = p_league_id
      and t.source_key = p_team_index::text
      and membership.user_id = auth.uid()
  ) then
    return true;
  end if;

  select display_name, username
  into v_display_name, v_username
  from public.profiles
  where id = auth.uid();

  v_claimed_by := nullif(
    btrim(p_state #>> array['teams', p_team_index::text, 'claimedBy']),
    ''
  );
  return v_claimed_by is not null
    and (
      lower(v_claimed_by) = lower(coalesce(v_username, ''))
      or lower(v_claimed_by) = lower(coalesce(v_display_name, ''))
    );
end;
$$;

create or replace function public.snapshot_draft_is_complete(p_state jsonb)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
  v_draft_type text;
  v_order jsonb;
begin
  if not coalesce((p_state ->> 'locked')::boolean, false) then
    return false;
  end if;
  v_draft_type := coalesce(p_state #>> '{settings,draftType}', 'snake');
  if v_draft_type = 'snake' then
    v_order := coalesce(p_state -> 'snakeOrder', '[]'::jsonb);
    return jsonb_typeof(v_order) = 'array'
      and coalesce((p_state ->> 'pickIndex')::integer, 0)
        >= jsonb_array_length(v_order);
  end if;
  return coalesce((p_state ->> 'auctionEnded')::boolean, false)
    or jsonb_array_length(coalesce(p_state -> 'pool', '[]'::jsonb)) = 0;
end;
$$;

create or replace function public.snapshot_roster_respects_caps(
  p_roster jsonb,
  p_settings jsonb
)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
  v_roster_max integer;
  v_restricted_cap integer;
  v_mega_cap integer;
  v_restricted_count integer;
  v_mega_count integer;
begin
  if jsonb_typeof(p_roster) <> 'array' then
    return false;
  end if;
  v_roster_max := greatest(
    1,
    coalesce(nullif(p_settings ->> 'rosterMax', '')::integer, 1)
  );
  if jsonb_array_length(p_roster) > v_roster_max then
    return false;
  end if;

  v_restricted_cap := case
    when jsonb_typeof(p_settings -> 'restrictedCap') = 'number'
      then (p_settings ->> 'restrictedCap')::integer
    else null
  end;
  v_mega_cap := case
    when jsonb_typeof(p_settings -> 'megaCap') = 'number'
      then (p_settings ->> 'megaCap')::integer
    else null
  end;
  select
    count(*) filter (
      where coalesce((mon.value ->> 'isRestricted')::boolean, false)
    ),
    count(*) filter (
      where coalesce((mon.value ->> 'isMega')::boolean, false)
    )
  into v_restricted_count, v_mega_count
  from jsonb_array_elements(p_roster) mon(value);

  return (v_restricted_cap is null or v_restricted_count <= v_restricted_cap)
    and (v_mega_cap is null or v_mega_count <= v_mega_cap);
end;
$$;

create or replace function public.mutate_league_transaction(
  p_league_id uuid,
  p_action text,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_state jsonb;
  v_settings jsonb;
  v_action text := lower(btrim(coalesce(p_action, '')));
  v_now_ms bigint := floor(extract(epoch from clock_timestamp()) * 1000)::bigint;
  v_identity text;
  v_team_count integer;
  v_team_index integer;
  v_other_team integer;
  v_rosters jsonb;
  v_budgets jsonb;
  v_pool jsonb;
  v_roster jsonb;
  v_other_roster jsonb;
  v_new_roster jsonb;
  v_other_new_roster jsonb;
  v_add_name text;
  v_drop_name text;
  v_add_mon jsonb;
  v_drop_mon jsonb;
  v_add_cost numeric;
  v_drop_cost numeric;
  v_current_budget numeric;
  v_new_budget numeric;
  v_uses_budget boolean;
  v_week integer;
  v_total_limit integer;
  v_week_limit integer;
  v_deadline_week integer;
  v_total_used integer;
  v_week_used integer;
  v_claim jsonb;
  v_claim_id text;
  v_claim_index integer;
  v_bid integer;
  v_available_faab integer;
  v_trade jsonb;
  v_trade_id text;
  v_trade_index integer;
  v_offer_names jsonb;
  v_request_names jsonb;
  v_offer_mons jsonb := '[]'::jsonb;
  v_request_mons jsonb := '[]'::jsonb;
  v_mon jsonb;
  v_name text;
  v_offer_value numeric;
  v_request_value numeric;
  v_diff numeric;
  v_event_kind text;
  v_event_payload jsonb := '{}'::jsonb;
begin
  if auth.uid() is null or not public.is_league_member(p_league_id) then
    raise exception 'You must be a member of this league.';
  end if;
  if jsonb_typeof(coalesce(p_payload, '{}'::jsonb)) <> 'object' then
    raise exception 'The transaction request is invalid.';
  end if;

  select coalesce(nullif(display_name, ''), nullif(username, ''), 'League member')
  into v_identity
  from public.profiles
  where id = auth.uid();

  select state
  into v_state
  from public.league_state_snapshots
  where league_id = p_league_id
  for update;
  if v_state is null then
    raise exception 'League state was not found.';
  end if;
  if not public.snapshot_draft_is_complete(v_state) then
    raise exception 'Transactions open only after the draft is complete.';
  end if;

  v_settings := coalesce(v_state -> 'settings', '{}'::jsonb);
  v_rosters := coalesce(v_state -> 'rosters', '[]'::jsonb);
  v_budgets := coalesce(v_state -> 'budgets', '[]'::jsonb);
  v_pool := coalesce(v_state -> 'pool', '[]'::jsonb);
  if jsonb_typeof(v_rosters) <> 'array'
     or jsonb_typeof(v_pool) <> 'array'
     or jsonb_typeof(v_state -> 'teams') <> 'array' then
    raise exception 'League roster data is invalid. Ask a commissioner to restore a backup.';
  end if;
  v_team_count := jsonb_array_length(v_state -> 'teams');
  v_week := greatest(0, coalesce((v_state ->> 'week')::integer, 0));
  if coalesce(v_settings ->> 'calendarMode', '') = 'weekly'
     and nullif(v_settings ->> 'seasonStartsAt', '') is not null then
    begin
      v_week := greatest(
        0,
        floor(
          extract(
            epoch from (
              clock_timestamp()
              - (v_settings ->> 'seasonStartsAt')::timestamptz
            )
          ) / 604800
        )::integer
      );
    exception when others then
      v_week := greatest(0, coalesce((v_state ->> 'week')::integer, 0));
    end;
  end if;

  if v_action in ('instant_free_agent', 'claim_submit') then
    v_team_index := nullif(p_payload ->> 'team_index', '')::integer;
    if v_team_index is null
       or v_team_index < 0
       or v_team_index >= v_team_count
       or v_team_index >= jsonb_array_length(v_rosters) then
      raise exception 'Choose a valid team.';
    end if;
    if not public.league_actor_can_control_snapshot_team(
      p_league_id,
      v_state,
      v_team_index
    ) then
      raise exception 'Only that team owner or a commissioner can make this move.';
    end if;
    if coalesce((v_settings ->> 'lockTransactionsAtPlayoffs')::boolean, false)
       and (v_state -> 'playoffs') is not null
       and (v_state -> 'playoffs') <> 'null'::jsonb then
      raise exception 'Transactions are closed once the playoff bracket is generated.';
    end if;

    v_total_limit := case
      when jsonb_typeof(v_settings -> 'maxTransactionsTotal') = 'number'
        then (v_settings ->> 'maxTransactionsTotal')::integer
      else null
    end;
    v_week_limit := case
      when jsonb_typeof(v_settings -> 'maxTransactionsPerWeek') = 'number'
        then (v_settings ->> 'maxTransactionsPerWeek')::integer
      else null
    end;
    v_deadline_week := case
      when jsonb_typeof(v_settings -> 'transactionsLastWeek') = 'number'
        then (v_settings ->> 'transactionsLastWeek')::integer
      else null
    end;
    if v_deadline_week is not null
       and v_deadline_week > 0
       and v_week > v_deadline_week - 1 then
      raise exception 'The transaction deadline has passed.';
    end if;

    select
      count(*),
      count(*) filter (
        where coalesce((entry.value ->> 'week')::integer, -1) = v_week
      )
    into v_total_used, v_week_used
    from jsonb_array_elements(
      coalesce(v_state -> 'transactionLog', '[]'::jsonb)
    ) entry(value)
    where coalesce((entry.value ->> 'teamIdx')::integer, -1) = v_team_index;
    if v_total_limit is not null
       and v_total_limit > 0
       and v_total_used >= v_total_limit then
      raise exception 'This team has reached its season transaction limit.';
    end if;
    if v_week_limit is not null
       and v_week_limit > 0
       and v_week_used >= v_week_limit then
      raise exception 'This team has reached its weekly transaction limit.';
    end if;

    v_add_name := nullif(btrim(p_payload ->> 'add_name'), '');
    v_drop_name := nullif(btrim(p_payload ->> 'drop_name'), '');
    if v_add_name is null then
      raise exception 'Choose a Pokemon to add.';
    end if;
    if exists (
      select 1
      from jsonb_array_elements(v_rosters) roster(value)
      cross join lateral jsonb_array_elements(
        case when jsonb_typeof(roster.value) = 'array'
          then roster.value else '[]'::jsonb end
      ) mon(value)
      where lower(coalesce(mon.value ->> 'name', '')) = lower(v_add_name)
    ) then
      raise exception 'That Pokemon is already rostered.';
    end if;

    select mon.value
    into v_add_mon
    from jsonb_array_elements(v_pool) mon(value)
    where lower(coalesce(mon.value ->> 'name', '')) = lower(v_add_name)
    limit 1;
    if v_add_mon is null
       and jsonb_typeof(v_state #> '{liveDraft,basePool}') = 'array' then
      select mon.value
      into v_add_mon
      from jsonb_array_elements(v_state #> '{liveDraft,basePool}') mon(value)
      where lower(coalesce(mon.value ->> 'name', '')) = lower(v_add_name)
      limit 1;
    end if;
    if v_add_mon is null then
      raise exception 'That Pokemon is not in this league''s verified free-agent pool.';
    end if;

    v_roster := v_rosters -> v_team_index;
    if jsonb_typeof(v_roster) <> 'array' then
      raise exception 'That team roster is invalid.';
    end if;
    if v_drop_name is not null then
      select mon.value
      into v_drop_mon
      from jsonb_array_elements(v_roster) mon(value)
      where lower(coalesce(mon.value ->> 'name', '')) = lower(v_drop_name)
      limit 1;
      if v_drop_mon is null then
        raise exception 'The selected drop is no longer on that roster.';
      end if;
    end if;

    select coalesce(jsonb_agg(mon.value order by mon.ordinality), '[]'::jsonb)
    into v_new_roster
    from jsonb_array_elements(v_roster) with ordinality mon(value, ordinality)
    where v_drop_name is null
       or lower(coalesce(mon.value ->> 'name', '')) <> lower(v_drop_name);
    v_new_roster := v_new_roster || jsonb_build_array(
      jsonb_set(
        v_add_mon,
        '{acquiredVia}',
        to_jsonb('freeagency'::text),
        true
      )
    );
    if not public.snapshot_roster_respects_caps(v_new_roster, v_settings) then
      raise exception 'That move would exceed the roster size or a configured roster cap.';
    end if;
  end if;

  if v_action = 'instant_free_agent' then
    if coalesce(v_settings ->> 'faClaimMode', 'instant') <> 'instant' then
      raise exception 'This league uses claims. Submit a claim instead.';
    end if;
    v_uses_budget := case
      when jsonb_typeof(v_settings -> 'postDraftBudgetEnabled') = 'boolean'
        then (v_settings ->> 'postDraftBudgetEnabled')::boolean
      else coalesce(v_settings ->> 'draftType', 'snake') = 'auction'
        or coalesce((v_settings ->> 'snakeBudgetEnabled')::boolean, false)
    end;
    v_add_cost := greatest(0, coalesce((v_add_mon ->> 'cost')::numeric, 0));
    v_drop_cost := greatest(0, coalesce((v_drop_mon ->> 'cost')::numeric, 0));
    if v_uses_budget then
      if jsonb_typeof(v_budgets) <> 'array' then
        v_budgets := '[]'::jsonb;
      end if;
      if jsonb_array_length(v_budgets) <> v_team_count then
        select jsonb_agg(
          coalesce(
            nullif(v_budgets ->> team_index, '')::numeric,
            greatest(0, coalesce((v_settings ->> 'budget')::numeric, 0))
          )
          order by team_index
        )
        into v_budgets
        from generate_series(0, v_team_count - 1) as series(team_index);
      end if;
      v_current_budget := greatest(
        0,
        coalesce((v_budgets ->> v_team_index)::numeric, 0)
      );
      v_new_budget := v_current_budget + v_drop_cost - v_add_cost;
      if v_new_budget < 0 then
        raise exception 'That team does not have enough remaining budget.';
      end if;
      v_budgets := jsonb_set(
        v_budgets,
        array[v_team_index::text],
        to_jsonb(v_new_budget),
        false
      );
    end if;

    v_rosters := jsonb_set(
      v_rosters,
      array[v_team_index::text],
      v_new_roster,
      false
    );
    select coalesce(jsonb_agg(mon.value order by mon.ordinality), '[]'::jsonb)
    into v_pool
    from jsonb_array_elements(v_pool) with ordinality mon(value, ordinality)
    where lower(coalesce(mon.value ->> 'name', '')) <> lower(v_add_name);
    if v_drop_mon is not null
       and not exists (
         select 1
         from jsonb_array_elements(v_pool) mon(value)
         where lower(coalesce(mon.value ->> 'name', '')) = lower(v_drop_name)
       ) then
      v_pool := v_pool || jsonb_build_array(v_drop_mon);
    end if;

    v_state := jsonb_set(v_state, '{rosters}', v_rosters, true);
    v_state := jsonb_set(v_state, '{budgets}', v_budgets, true);
    v_state := jsonb_set(v_state, '{pool}', v_pool, true);
    v_state := jsonb_set(
      v_state,
      '{transactionLog}',
      coalesce(v_state -> 'transactionLog', '[]'::jsonb)
        || jsonb_build_array(
          jsonb_build_object(
            'id', gen_random_uuid()::text,
            'teamIdx', v_team_index,
            'week', v_week,
            'timestamp', v_now_ms,
            'addName', v_add_mon ->> 'name',
            'addCost', v_add_cost,
            'dropName', case when v_drop_mon is null
              then null else v_drop_mon ->> 'name' end,
            'dropCost', case when v_drop_mon is null
              then null else v_drop_cost end
          )
        ),
      true
    );
    v_event_kind := 'free_agent_transaction';
    v_event_payload := jsonb_build_object(
      'team_index', v_team_index,
      'add_name', v_add_mon ->> 'name',
      'drop_name', case when v_drop_mon is null
        then null else v_drop_mon ->> 'name' end
    );

  elsif v_action = 'claim_submit' then
    if coalesce(v_settings ->> 'faClaimMode', 'instant') = 'instant' then
      raise exception 'This league processes free agents instantly.';
    end if;
    if exists (
      select 1
      from jsonb_array_elements(
        coalesce(v_state -> 'pendingClaims', '[]'::jsonb)
      ) existing(value)
      where coalesce((existing.value ->> 'teamIdx')::integer, -1) = v_team_index
        and lower(coalesce(existing.value ->> 'addName', '')) = lower(v_add_name)
    ) then
      raise exception 'This team already has a pending claim on that Pokemon.';
    end if;

    v_bid := case
      when coalesce(v_settings ->> 'faClaimMode', '') = 'faab'
        then greatest(0, coalesce((p_payload ->> 'bid_amount')::integer, 0))
      else null
    end;
    if coalesce(v_settings ->> 'faClaimMode', '') = 'faab' then
      if coalesce((v_settings ->> 'faabUsesLeftoverDraftBudget')::boolean, false) then
        v_available_faab := greatest(
          0,
          coalesce((v_budgets ->> v_team_index)::integer, 0)
        );
      else
        v_available_faab := greatest(
          0,
          coalesce(
            (v_state #>> array['faabBudgets', v_team_index::text])::integer,
            (v_settings ->> 'faabBudget')::integer,
            0
          )
        );
      end if;
      if v_bid > v_available_faab then
        raise exception 'That bid is greater than this team''s available FAAB.';
      end if;
    end if;

    v_claim_id := gen_random_uuid()::text;
    v_claim := jsonb_build_object(
      'id', v_claim_id,
      'teamIdx', v_team_index,
      'addName', v_add_mon ->> 'name',
      'dropName', case when v_drop_mon is null
        then null else v_drop_mon ->> 'name' end,
      'bidAmount', v_bid,
      'submittedAt', v_now_ms,
      'week', v_week
    );
    v_state := jsonb_set(
      v_state,
      '{pendingClaims}',
      coalesce(v_state -> 'pendingClaims', '[]'::jsonb)
        || jsonb_build_array(v_claim),
      true
    );
    v_event_kind := 'free_agent_claim_submitted';
    v_event_payload := jsonb_build_object(
      'claim_id', v_claim_id,
      'team_index', v_team_index,
      'add_name', v_add_mon ->> 'name'
    );

  elsif v_action = 'claim_cancel' then
    v_claim_id := nullif(btrim(p_payload ->> 'claim_id'), '');
    select claim.value, claim.ordinality - 1
    into v_claim, v_claim_index
    from jsonb_array_elements(
      coalesce(v_state -> 'pendingClaims', '[]'::jsonb)
    ) with ordinality claim(value, ordinality)
    where claim.value ->> 'id' = v_claim_id
    limit 1;
    if v_claim is null then
      raise exception 'That pending claim was not found.';
    end if;
    v_team_index := (v_claim ->> 'teamIdx')::integer;
    if not public.league_actor_can_control_snapshot_team(
      p_league_id,
      v_state,
      v_team_index
    ) then
      raise exception 'Only that team owner or a commissioner can withdraw this claim.';
    end if;
    v_state := jsonb_set(
      v_state,
      '{pendingClaims}',
      coalesce(
        (
          select jsonb_agg(claim.value order by claim.ordinality)
          from jsonb_array_elements(
            coalesce(v_state -> 'pendingClaims', '[]'::jsonb)
          ) with ordinality claim(value, ordinality)
          where claim.value ->> 'id' <> v_claim_id
        ),
        '[]'::jsonb
      ),
      true
    );
    v_event_kind := 'free_agent_claim_withdrawn';
    v_event_payload := jsonb_build_object(
      'claim_id', v_claim_id,
      'team_index', v_team_index
    );

  elsif v_action = 'trade_propose' then
    v_team_index := nullif(p_payload ->> 'from_team', '')::integer;
    v_other_team := nullif(p_payload ->> 'to_team', '')::integer;
    if v_team_index is null
       or v_other_team is null
       or v_team_index < 0
       or v_other_team < 0
       or v_team_index >= v_team_count
       or v_other_team >= v_team_count
       or v_team_index = v_other_team then
      raise exception 'Choose two different valid teams.';
    end if;
    if not public.league_actor_can_control_snapshot_team(
      p_league_id,
      v_state,
      v_team_index
    ) then
      raise exception 'Only that team owner or a commissioner can propose this trade.';
    end if;
    v_offer_names := coalesce(p_payload -> 'offer_names', '[]'::jsonb);
    v_request_names := coalesce(p_payload -> 'request_names', '[]'::jsonb);
    if jsonb_typeof(v_offer_names) <> 'array'
       or jsonb_typeof(v_request_names) <> 'array'
       or jsonb_array_length(v_offer_names) + jsonb_array_length(v_request_names) = 0 then
      raise exception 'Choose at least one Pokemon.';
    end if;
    if exists (
      select 1
      from jsonb_array_elements_text(v_offer_names) offered(name)
      group by lower(offered.name)
      having count(*) > 1
    ) or exists (
      select 1
      from jsonb_array_elements_text(v_request_names) requested(name)
      group by lower(requested.name)
      having count(*) > 1
    ) then
      raise exception 'A Pokemon cannot appear twice in the same trade.';
    end if;

    v_roster := v_rosters -> v_team_index;
    v_other_roster := v_rosters -> v_other_team;
    for v_name in
      select value from jsonb_array_elements_text(v_offer_names)
    loop
      select mon.value into v_mon
      from jsonb_array_elements(v_roster) mon(value)
      where lower(coalesce(mon.value ->> 'name', '')) = lower(v_name)
      limit 1;
      if v_mon is null then
        raise exception 'An offered Pokemon is no longer on the proposing roster.';
      end if;
    end loop;
    for v_name in
      select value from jsonb_array_elements_text(v_request_names)
    loop
      select mon.value into v_mon
      from jsonb_array_elements(v_other_roster) mon(value)
      where lower(coalesce(mon.value ->> 'name', '')) = lower(v_name)
      limit 1;
      if v_mon is null then
        raise exception 'A requested Pokemon is no longer on the receiving roster.';
      end if;
    end loop;

    v_trade_id := gen_random_uuid()::text;
    v_trade := jsonb_build_object(
      'id', v_trade_id,
      'fromTeam', v_team_index,
      'toTeam', v_other_team,
      'offerNames', v_offer_names,
      'requestNames', v_request_names,
      'status', 'pending',
      'proposedBy', v_identity,
      'createdAt', v_now_ms
    );
    v_state := jsonb_set(
      v_state,
      '{trades}',
      coalesce(v_state -> 'trades', '[]'::jsonb)
        || jsonb_build_array(v_trade),
      true
    );
    v_event_kind := 'trade_proposed';
    v_event_payload := jsonb_build_object(
      'trade_id', v_trade_id,
      'from_team', v_team_index,
      'to_team', v_other_team
    );

  elsif v_action in ('trade_cancel', 'trade_respond') then
    v_trade_id := nullif(btrim(p_payload ->> 'trade_id'), '');
    select trade.value, trade.ordinality - 1
    into v_trade, v_trade_index
    from jsonb_array_elements(
      coalesce(v_state -> 'trades', '[]'::jsonb)
    ) with ordinality trade(value, ordinality)
    where trade.value ->> 'id' = v_trade_id
    limit 1;
    if v_trade is null or coalesce(v_trade ->> 'status', '') <> 'pending' then
      raise exception 'That trade is no longer pending.';
    end if;
    v_team_index := (v_trade ->> 'fromTeam')::integer;
    v_other_team := (v_trade ->> 'toTeam')::integer;

    if v_action = 'trade_cancel' then
      if not public.league_actor_can_control_snapshot_team(
        p_league_id,
        v_state,
        v_team_index
      ) then
        raise exception 'Only the proposing team or a commissioner can cancel this trade.';
      end if;
      v_trade := jsonb_set(
        v_trade,
        '{status}',
        to_jsonb('cancelled'::text),
        true
      );
      v_event_kind := 'trade_cancelled';
    else
      if not public.league_actor_can_control_snapshot_team(
        p_league_id,
        v_state,
        v_other_team
      ) then
        raise exception 'Only the receiving team or a commissioner can respond to this trade.';
      end if;
      if not coalesce((p_payload ->> 'accept')::boolean, false) then
        v_trade := jsonb_set(
          v_trade,
          '{status}',
          to_jsonb('rejected'::text),
          true
        );
        v_event_kind := 'trade_rejected';
      else
        v_offer_names := coalesce(v_trade -> 'offerNames', '[]'::jsonb);
        v_request_names := coalesce(v_trade -> 'requestNames', '[]'::jsonb);
        v_roster := v_rosters -> v_team_index;
        v_other_roster := v_rosters -> v_other_team;

        for v_name in
          select value from jsonb_array_elements_text(v_offer_names)
        loop
          select mon.value into v_mon
          from jsonb_array_elements(v_roster) mon(value)
          where lower(coalesce(mon.value ->> 'name', '')) = lower(v_name)
          limit 1;
          if v_mon is null then
            raise exception 'An offered Pokemon moved after this trade was proposed.';
          end if;
          v_offer_mons := v_offer_mons || jsonb_build_array(
            jsonb_set(v_mon, '{acquiredVia}', to_jsonb('trade'::text), true)
          );
        end loop;
        for v_name in
          select value from jsonb_array_elements_text(v_request_names)
        loop
          select mon.value into v_mon
          from jsonb_array_elements(v_other_roster) mon(value)
          where lower(coalesce(mon.value ->> 'name', '')) = lower(v_name)
          limit 1;
          if v_mon is null then
            raise exception 'A requested Pokemon moved after this trade was proposed.';
          end if;
          v_request_mons := v_request_mons || jsonb_build_array(
            jsonb_set(v_mon, '{acquiredVia}', to_jsonb('trade'::text), true)
          );
        end loop;

        select coalesce(jsonb_agg(mon.value order by mon.ordinality), '[]'::jsonb)
        into v_new_roster
        from jsonb_array_elements(v_roster) with ordinality mon(value, ordinality)
        where not exists (
          select 1
          from jsonb_array_elements_text(v_offer_names) offered(name)
          where lower(offered.name) = lower(coalesce(mon.value ->> 'name', ''))
        );
        select coalesce(jsonb_agg(mon.value order by mon.ordinality), '[]'::jsonb)
        into v_other_new_roster
        from jsonb_array_elements(v_other_roster) with ordinality mon(value, ordinality)
        where not exists (
          select 1
          from jsonb_array_elements_text(v_request_names) requested(name)
          where lower(requested.name) = lower(coalesce(mon.value ->> 'name', ''))
        );
        v_new_roster := v_new_roster || v_request_mons;
        v_other_new_roster := v_other_new_roster || v_offer_mons;
        if not public.snapshot_roster_respects_caps(v_new_roster, v_settings)
           or not public.snapshot_roster_respects_caps(
             v_other_new_roster,
             v_settings
           ) then
          raise exception 'The trade would exceed a roster size or configured roster cap.';
        end if;

        v_uses_budget := coalesce(v_settings ->> 'draftType', 'snake') = 'auction'
          or coalesce((v_settings ->> 'snakeBudgetEnabled')::boolean, false);
        if v_uses_budget then
          if jsonb_typeof(v_budgets) <> 'array'
             or jsonb_array_length(v_budgets) <> v_team_count then
            raise exception 'League budgets are incomplete. Ask a commissioner to restore a backup.';
          end if;
          select coalesce(sum((mon.value ->> 'cost')::numeric), 0)
          into v_offer_value
          from jsonb_array_elements(v_offer_mons) mon(value);
          select coalesce(sum((mon.value ->> 'cost')::numeric), 0)
          into v_request_value
          from jsonb_array_elements(v_request_mons) mon(value);
          v_diff := v_request_value - v_offer_value;
          if (v_budgets ->> v_team_index)::numeric - v_diff < 0
             or (v_budgets ->> v_other_team)::numeric + v_diff < 0 then
            raise exception 'The trade would put a team below zero budget.';
          end if;
          v_budgets := jsonb_set(
            v_budgets,
            array[v_team_index::text],
            to_jsonb((v_budgets ->> v_team_index)::numeric - v_diff),
            false
          );
          v_budgets := jsonb_set(
            v_budgets,
            array[v_other_team::text],
            to_jsonb((v_budgets ->> v_other_team)::numeric + v_diff),
            false
          );
        end if;

        v_rosters := jsonb_set(
          v_rosters,
          array[v_team_index::text],
          v_new_roster,
          false
        );
        v_rosters := jsonb_set(
          v_rosters,
          array[v_other_team::text],
          v_other_new_roster,
          false
        );
        v_state := jsonb_set(v_state, '{rosters}', v_rosters, true);
        v_state := jsonb_set(v_state, '{budgets}', v_budgets, true);
        v_trade := jsonb_set(
          v_trade,
          '{status}',
          to_jsonb('accepted'::text),
          true
        );
        v_event_kind := 'trade_accepted';
      end if;
    end if;

    v_state := jsonb_set(
      v_state,
      array['trades', v_trade_index::text],
      v_trade,
      false
    );
    v_event_payload := jsonb_build_object(
      'trade_id', v_trade_id,
      'from_team', v_team_index,
      'to_team', v_other_team
    );
  else
    raise exception 'Unknown league transaction action.';
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
  where league_id = p_league_id;

  insert into public.league_events(league_id, kind, actor_id, payload)
  values (
    p_league_id,
    v_event_kind,
    auth.uid(),
    coalesce(v_event_payload, '{}'::jsonb)
  );
  return v_state;
end;
$$;

-- Whole-snapshot commissioner saves remain necessary while the prototype is
-- gradually moving fields to dedicated RPCs. Reject an incoming state unless
-- it is strictly newer than the locked server state, preventing a stale tab
-- from erasing a manager transaction or match report that just landed.
create or replace function public.save_league_snapshot(
  p_league_id uuid,
  p_state jsonb
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_revision bigint;
  v_existing jsonb;
  v_next jsonb := p_state;
  v_key text;
  v_incoming_rev bigint;
  v_existing_rev bigint;
  v_protected_keys text[] := array[
    'locked', 'rosters', 'budgets', 'pool', 'auctionNominationOrder',
    'auctionNominationIdx', 'nominationDeadline', 'nominee', 'paused',
    'pausedAt', 'pauseIsOvernight', 'auctionEnded'
  ];
begin
  if not public.is_league_staff(p_league_id) then
    raise exception 'Only league commissioners can save league state.';
  end if;
  if jsonb_typeof(p_state) <> 'object' then
    raise exception 'League state must be a JSON object.';
  end if;

  select state
  into v_existing
  from public.league_state_snapshots
  where league_id = p_league_id
  for update;
  if v_existing is null then
    raise exception 'League state was not found.';
  end if;

  v_incoming_rev := coalesce((p_state ->> 'rev')::bigint, 0);
  v_existing_rev := coalesce((v_existing ->> 'rev')::bigint, 0);
  if v_incoming_rev <= v_existing_rev then
    raise exception 'This league changed in another session. Refresh before saving again.';
  end if;

  if v_existing ? 'messages' then
    v_next := jsonb_set(v_next, '{messages}', v_existing -> 'messages', true);
  end if;
  if v_existing ? 'readReceipts' then
    v_next := jsonb_set(
      v_next,
      '{readReceipts}',
      v_existing -> 'readReceipts',
      true
    );
  end if;
  if coalesce(v_existing #>> '{settings,draftType}', '') = 'auction'
     and coalesce((v_existing ->> 'locked')::boolean, false)
     and coalesce((p_state ->> 'locked')::boolean, false) then
    foreach v_key in array v_protected_keys loop
      if v_existing ? v_key then
        v_next := jsonb_set(v_next, array[v_key], v_existing -> v_key, true);
      end if;
    end loop;
  elsif coalesce(v_existing #>> '{settings,draftType}', '') = 'auction'
     and coalesce((v_existing ->> 'locked')::boolean, false)
     and not coalesce((p_state ->> 'locked')::boolean, false) then
    delete from public.auction_team_owners
    where league_id = p_league_id;
  end if;

  update public.league_state_snapshots
  set state = v_next,
      revision = revision + 1,
      updated_at = now()
  where league_id = p_league_id
  returning revision into v_revision;
  return v_revision;
end;
$$;

revoke all on function public.league_actor_can_control_snapshot_team(
  uuid, jsonb, integer
) from public, anon, authenticated;
revoke all on function public.snapshot_draft_is_complete(jsonb)
  from public, anon, authenticated;
revoke all on function public.snapshot_roster_respects_caps(jsonb, jsonb)
  from public, anon, authenticated;
revoke all on function public.mutate_league_transaction(uuid, text, jsonb)
  from public, anon, authenticated;
revoke all on function public.save_league_snapshot(uuid, jsonb)
  from public, anon, authenticated;

grant execute on function public.mutate_league_transaction(uuid, text, jsonb)
  to authenticated;
grant execute on function public.save_league_snapshot(uuid, jsonb)
  to authenticated;

commit;

notify pgrst, 'reload schema';
