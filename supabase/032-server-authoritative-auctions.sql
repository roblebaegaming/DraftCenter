-- DraftCenter milestone 13: server-authoritative hosted auction drafts.
--
-- Every nomination, bid, timer transition, sale, pause and resume locks the
-- league snapshot row before validating and changing it. This prevents two
-- browsers from accepting conflicting bids or awarding the same Pokemon.

create table if not exists public.auction_team_owners (
  league_id uuid not null references public.leagues(id) on delete cascade,
  team_index integer not null check (team_index >= 0),
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (league_id, team_index),
  unique (league_id, user_id)
);

alter table public.auction_team_owners enable row level security;
drop policy if exists "members read auction team owners" on public.auction_team_owners;
create policy "members read auction team owners"
  on public.auction_team_owners for select to authenticated
  using (public.is_league_member(league_id));

create or replace function public.auction_actor_can_control_team(
  p_league_id uuid,
  p_state jsonb,
  p_team_index integer
)
returns boolean
language plpgsql stable security definer set search_path = public
as $$
begin
  if public.is_league_staff(p_league_id) then return true; end if;
  return exists (
    select 1 from public.auction_team_owners o
    where o.league_id = p_league_id and o.team_index = p_team_index and o.user_id = auth.uid()
  );
end;
$$;

create or replace function public.mutate_live_auction(
  p_league_id uuid,
  p_action text,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_state jsonb;
  v_action text := lower(trim(coalesce(p_action, '')));
  v_now_ms bigint := floor(extract(epoch from clock_timestamp()) * 1000);
  v_team_index integer;
  v_n integer;
  v_nomination_index integer;
  v_order jsonb;
  v_nominee jsonb;
  v_mon jsonb;
  v_mon_id text;
  v_bid integer;
  v_budget integer;
  v_roster jsonb;
  v_roster_max integer;
  v_deadline bigint;
  v_reset_seconds integer;
  v_pause_started bigint;
  v_pause_ms bigint;
  v_pool jsonb;
  v_event_payload jsonb := '{}'::jsonb;
  v_restricted_cap integer;
  v_mega_cap integer;
  v_restricted_count integer;
  v_mega_count integer;
begin
  if auth.uid() is null or not public.is_league_member(p_league_id) then
    raise exception 'You must be a member of this league.';
  end if;

  select state into v_state
  from public.league_state_snapshots
  where league_id = p_league_id
  for update;

  if v_state is null then raise exception 'League draft state was not found.'; end if;
  if coalesce(v_state #>> '{settings,draftType}', '') <> 'auction'
     or not coalesce((v_state ->> 'locked')::boolean, false) then
    raise exception 'There is no active hosted auction draft.';
  end if;

  -- Freeze the setup ownership mapping to account IDs. Exact usernames take
  -- priority over display-name matches, and later profile edits cannot move
  -- a team to somebody else during the auction.
  insert into public.auction_team_owners (league_id, team_index, user_id)
  select p_league_id, team.ordinality - 1, owner.id
  from jsonb_array_elements(coalesce(v_state -> 'teams', '[]'::jsonb)) with ordinality as team(value, ordinality)
  cross join lateral (
    select p.id
    from public.profiles p
    join public.league_memberships m on m.user_id = p.id and m.league_id = p_league_id
    where nullif(trim(team.value ->> 'claimedBy'), '') is not null
      and (lower(coalesce(p.username, '')) = lower(team.value ->> 'claimedBy')
        or lower(coalesce(p.display_name, '')) = lower(team.value ->> 'claimedBy'))
    order by case when lower(coalesce(p.username, '')) = lower(team.value ->> 'claimedBy') then 0 else 1 end
    limit 1
  ) owner
  on conflict do nothing;

  v_order := coalesce(v_state -> 'auctionNominationOrder', '[]'::jsonb);
  v_n := jsonb_array_length(v_order);
  v_nomination_index := coalesce((v_state ->> 'auctionNominationIdx')::integer, 0);
  v_roster_max := greatest(1, coalesce((v_state #>> '{settings,rosterMax}')::integer, 1));

  if v_action = 'start_clock' then
    if coalesce((v_state ->> 'paused')::boolean, false)
       or v_state -> 'nominee' <> 'null'::jsonb
       or coalesce((v_state ->> 'auctionEnded')::boolean, false)
       or jsonb_array_length(coalesce(v_state -> 'pool', '[]'::jsonb)) = 0 then
      return v_state;
    end if;
    if v_state -> 'nominationDeadline' = 'null'::jsonb then
      v_deadline := v_now_ms + greatest(1, coalesce((v_state #>> '{settings,auctionNominationSeconds}')::integer, 30)) * 1000;
      v_state := jsonb_set(v_state, '{nominationDeadline}', to_jsonb(v_deadline), true);
    else
      return v_state;
    end if;

  elsif v_action = 'nominate' then
    if coalesce((v_state ->> 'paused')::boolean, false) then raise exception 'The draft is paused.'; end if;
    if v_state -> 'nominee' <> 'null'::jsonb then raise exception 'Another Pokemon is already being auctioned.'; end if;
    if v_n = 0 then raise exception 'The nomination order is missing.'; end if;
    v_team_index := (v_order ->> (v_nomination_index % v_n))::integer;
    if not public.auction_actor_can_control_team(p_league_id, v_state, v_team_index) then
      raise exception 'It is not your team''s nomination turn.';
    end if;
    v_mon_id := p_payload ->> 'pokemon_id';
    select value into v_mon
    from jsonb_array_elements(coalesce(v_state -> 'pool', '[]'::jsonb))
    where value ->> 'id' = v_mon_id
    limit 1;
    if v_mon is null then raise exception 'That Pokemon is no longer available.'; end if;
    v_roster := coalesce(v_state #> array['rosters', v_team_index::text], '[]'::jsonb);
    if jsonb_array_length(v_roster) >= v_roster_max then raise exception 'That roster is full.'; end if;
    v_restricted_cap := nullif(v_state #>> '{settings,restrictedCap}', '')::integer;
    v_mega_cap := nullif(v_state #>> '{settings,megaCap}', '')::integer;
    select count(*) filter (where coalesce((value ->> 'isRestricted')::boolean, false)),
           count(*) filter (where coalesce((value ->> 'isMega')::boolean, false))
      into v_restricted_count, v_mega_count
    from jsonb_array_elements(v_roster);
    if coalesce((v_mon ->> 'isRestricted')::boolean, false)
       and v_restricted_cap is not null and v_restricted_count >= v_restricted_cap then
      raise exception 'That team has reached its restricted Pokemon limit.';
    end if;
    if coalesce((v_mon ->> 'isMega')::boolean, false)
       and v_mega_cap is not null and v_mega_count >= v_mega_cap then
      raise exception 'That team has reached its Mega Pokemon limit.';
    end if;
    v_bid := greatest(1, coalesce((p_payload ->> 'amount')::integer, 1));
    v_budget := coalesce((v_state #>> array['budgets', v_team_index::text])::integer, 0);
    if v_bid > v_budget then raise exception 'That opening bid is over the team''s remaining budget.'; end if;
    v_deadline := v_now_ms + greatest(1, coalesce((v_state #>> '{settings,auctionTimerSeconds}')::integer, 30)) * 1000;
    v_nominee := jsonb_build_object(
      'mon', v_mon, 'currentBid', v_bid, 'currentBidder', v_team_index,
      'nominatedBy', v_team_index, 'deadline', v_deadline,
      'bids', jsonb_build_array(jsonb_build_object('teamIdx', v_team_index, 'amount', v_bid, 'at', v_now_ms))
    );
    v_state := jsonb_set(v_state, '{nominee}', v_nominee, true);
    v_state := jsonb_set(v_state, '{nominationDeadline}', 'null'::jsonb, true);
    v_event_payload := jsonb_build_object('team_index', v_team_index, 'pokemon_id', v_mon_id, 'amount', v_bid);

  elsif v_action = 'bid' then
    if coalesce((v_state ->> 'paused')::boolean, false) then raise exception 'The draft is paused.'; end if;
    v_nominee := v_state -> 'nominee';
    if v_nominee is null or v_nominee = 'null'::jsonb then raise exception 'There is no active nomination.'; end if;
    v_deadline := (v_nominee ->> 'deadline')::bigint;
    if v_now_ms >= v_deadline then raise exception 'The bidding clock has expired.'; end if;
    v_team_index := (p_payload ->> 'team_index')::integer;
    if not public.auction_actor_can_control_team(p_league_id, v_state, v_team_index) then
      raise exception 'You cannot bid for that team.';
    end if;
    if v_team_index = (v_nominee ->> 'currentBidder')::integer then raise exception 'Your team already has the highest bid.'; end if;
    v_bid := (p_payload ->> 'amount')::integer;
    if v_bid <= (v_nominee ->> 'currentBid')::integer then raise exception 'That bid is no longer high enough.'; end if;
    v_budget := coalesce((v_state #>> array['budgets', v_team_index::text])::integer, 0);
    if v_bid > v_budget then raise exception 'That bid is over the team''s remaining budget.'; end if;
    v_roster := coalesce(v_state #> array['rosters', v_team_index::text], '[]'::jsonb);
    if jsonb_array_length(v_roster) >= v_roster_max then raise exception 'That roster is full.'; end if;

    v_mon := v_nominee -> 'mon';
    v_restricted_cap := nullif(v_state #>> '{settings,restrictedCap}', '')::integer;
    v_mega_cap := nullif(v_state #>> '{settings,megaCap}', '')::integer;
    select count(*) filter (where coalesce((value ->> 'isRestricted')::boolean, false)),
           count(*) filter (where coalesce((value ->> 'isMega')::boolean, false))
      into v_restricted_count, v_mega_count
    from jsonb_array_elements(v_roster);
    if coalesce((v_mon ->> 'isRestricted')::boolean, false)
       and v_restricted_cap is not null and v_restricted_count >= v_restricted_cap then
      raise exception 'That team has reached its restricted Pokemon limit.';
    end if;
    if coalesce((v_mon ->> 'isMega')::boolean, false)
       and v_mega_cap is not null and v_mega_count >= v_mega_cap then
      raise exception 'That team has reached its Mega Pokemon limit.';
    end if;

    v_reset_seconds := greatest(1, coalesce((v_state #>> '{settings,auctionBidResetSeconds}')::integer, 10));
    v_nominee := jsonb_set(v_nominee, '{currentBid}', to_jsonb(v_bid), true);
    v_nominee := jsonb_set(v_nominee, '{currentBidder}', to_jsonb(v_team_index), true);
    v_nominee := jsonb_set(v_nominee, '{deadline}', to_jsonb(v_now_ms + v_reset_seconds * 1000), true);
    v_nominee := jsonb_set(
      v_nominee, '{bids}',
      coalesce(v_nominee -> 'bids', '[]'::jsonb) || jsonb_build_array(jsonb_build_object('teamIdx', v_team_index, 'amount', v_bid, 'at', v_now_ms)),
      true
    );
    v_state := jsonb_set(v_state, '{nominee}', v_nominee, true);
    v_event_payload := jsonb_build_object('team_index', v_team_index, 'amount', v_bid);

  elsif v_action = 'resolve' then
    if coalesce((v_state ->> 'paused')::boolean, false) then return v_state; end if;
    v_nominee := v_state -> 'nominee';
    if v_nominee is null or v_nominee = 'null'::jsonb then return v_state; end if;
    if v_now_ms < (v_nominee ->> 'deadline')::bigint then return v_state; end if;
    v_team_index := (v_nominee ->> 'currentBidder')::integer;
    v_bid := (v_nominee ->> 'currentBid')::integer;
    v_mon := jsonb_set(v_nominee -> 'mon', '{cost}', to_jsonb(v_bid), true);
    v_mon := jsonb_set(v_mon, '{acquiredVia}', '"draft"'::jsonb, true);
    v_roster := coalesce(v_state #> array['rosters', v_team_index::text], '[]'::jsonb);
    v_budget := coalesce((v_state #>> array['budgets', v_team_index::text])::integer, 0);
    if jsonb_array_length(v_roster) >= v_roster_max or v_bid > v_budget then
      raise exception 'The winning team can no longer complete this purchase.';
    end if;
    v_state := jsonb_set(v_state, array['rosters', v_team_index::text], v_roster || jsonb_build_array(v_mon), true);
    v_state := jsonb_set(v_state, array['budgets', v_team_index::text], to_jsonb(v_budget - v_bid), true);
    v_mon_id := v_nominee #>> '{mon,id}';
    select coalesce(jsonb_agg(value order by ordinality), '[]'::jsonb) into v_pool
    from jsonb_array_elements(coalesce(v_state -> 'pool', '[]'::jsonb)) with ordinality
    where value ->> 'id' <> v_mon_id;
    v_state := jsonb_set(v_state, '{pool}', v_pool, true);
    v_state := jsonb_set(v_state, '{nominee}', 'null'::jsonb, true);
    v_state := jsonb_set(v_state, '{nominationDeadline}', 'null'::jsonb, true);
    v_state := jsonb_set(v_state, '{auctionNominationIdx}', to_jsonb(v_nomination_index + 1), true);
    v_event_payload := jsonb_build_object('team_index', v_team_index, 'pokemon_id', v_mon_id, 'amount', v_bid);

  elsif v_action = 'skip' then
    if v_state -> 'nominee' <> 'null'::jsonb then raise exception 'An active auction cannot be skipped.'; end if;
    if v_n = 0 then raise exception 'The nomination order is missing.'; end if;
    v_team_index := (v_order ->> (v_nomination_index % v_n))::integer;
    if not public.is_league_staff(p_league_id) then
      if not public.auction_actor_can_control_team(p_league_id, v_state, v_team_index) then
        raise exception 'You cannot skip another team''s nomination turn.';
      end if;
      if v_state -> 'nominationDeadline' = 'null'::jsonb
         or v_now_ms < (v_state ->> 'nominationDeadline')::bigint then
        raise exception 'The nomination clock has not expired.';
      end if;
    end if;
    v_state := jsonb_set(v_state, '{auctionNominationIdx}', to_jsonb(v_nomination_index + 1), true);
    v_state := jsonb_set(v_state, '{nominationDeadline}', 'null'::jsonb, true);

  elsif v_action = 'pause' then
    if not public.is_league_staff(p_league_id) then raise exception 'Only league staff can pause the draft.'; end if;
    if coalesce((v_state ->> 'paused')::boolean, false) then return v_state; end if;
    v_state := jsonb_set(v_state, '{paused}', 'true'::jsonb, true);
    v_state := jsonb_set(v_state, '{pausedAt}', to_jsonb(v_now_ms), true);
    v_state := jsonb_set(v_state, '{pauseIsOvernight}', to_jsonb(coalesce((p_payload ->> 'overnight')::boolean, false)), true);

  elsif v_action = 'resume' then
    if not public.is_league_staff(p_league_id) then raise exception 'Only league staff can resume the draft.'; end if;
    if not coalesce((v_state ->> 'paused')::boolean, false) then return v_state; end if;
    v_pause_started := coalesce((v_state ->> 'pausedAt')::bigint, v_now_ms);
    v_pause_ms := greatest(0, v_now_ms - v_pause_started);
    if v_state -> 'nominationDeadline' <> 'null'::jsonb then
      v_state := jsonb_set(v_state, '{nominationDeadline}', to_jsonb((v_state ->> 'nominationDeadline')::bigint + v_pause_ms), true);
    end if;
    if v_state -> 'nominee' <> 'null'::jsonb then
      v_state := jsonb_set(v_state, '{nominee,deadline}', to_jsonb((v_state #>> '{nominee,deadline}')::bigint + v_pause_ms), true);
    end if;
    v_state := jsonb_set(v_state, '{paused}', 'false'::jsonb, true);
    v_state := jsonb_set(v_state, '{pausedAt}', 'null'::jsonb, true);
    v_state := jsonb_set(v_state, '{pauseIsOvernight}', 'false'::jsonb, true);

  elsif v_action = 'end' then
    if not public.is_league_staff(p_league_id) then raise exception 'Only league staff can end the auction.'; end if;
    if v_state -> 'nominee' <> 'null'::jsonb then raise exception 'Let the current nomination finish first.'; end if;
    v_state := jsonb_set(v_state, '{auctionEnded}', 'true'::jsonb, true);

  else
    raise exception 'Unknown auction action.';
  end if;

  v_state := jsonb_set(v_state, '{rev}', to_jsonb(coalesce((v_state ->> 'rev')::bigint, 0) + 1), true);
  update public.league_state_snapshots
  set state = v_state, revision = revision + 1, updated_at = now()
  where league_id = p_league_id;

  insert into public.league_events (league_id, kind, actor_id, payload)
  values (p_league_id, 'auction_' || v_action, auth.uid(), v_event_payload);
  return v_state;
end;
$$;

-- Whole-state saves remain useful for settings, queues and messages, but an
-- active hosted auction's competitive fields may only come from the locked
-- mutation function above.
create or replace function public.save_league_snapshot(
  p_league_id uuid,
  p_state jsonb
)
returns bigint
language plpgsql security definer set search_path = public
as $$
declare
  v_revision bigint;
  v_existing jsonb;
  v_next jsonb := p_state;
  v_key text;
  v_protected_keys text[] := array[
    'locked', 'rosters', 'budgets', 'pool', 'auctionNominationOrder',
    'auctionNominationIdx', 'nominationDeadline', 'nominee', 'paused',
    'pausedAt', 'pauseIsOvernight', 'auctionEnded'
  ];
begin
  if not public.is_league_staff(p_league_id) then
    raise exception 'Only league commissioners can save the prototype state.';
  end if;
  select state into v_existing from public.league_state_snapshots where league_id = p_league_id for update;
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
    delete from public.auction_team_owners where league_id = p_league_id;
  end if;
  update public.league_state_snapshots
  set state = v_next, revision = revision + 1, updated_at = now()
  where league_id = p_league_id
  returning revision into v_revision;
  return v_revision;
end;
$$;

grant execute on function public.auction_actor_can_control_team(uuid, jsonb, integer) to authenticated;
grant execute on function public.mutate_live_auction(uuid, text, jsonb) to authenticated;
grant execute on function public.save_league_snapshot(uuid, jsonb) to authenticated;
