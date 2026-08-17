-- Restore canonical function definitions after the Supabase integration partially replayed migrations 204-248.
-- The definitions below were read from a fresh, data-less replay of migrations 204-421.
begin;

CREATE OR REPLACE FUNCTION public.capture_league_recovery_snapshot()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ begin
 if old.state is distinct from new.state and not exists (
  select 1 from public.league_recovery_snapshots r where r.league_id=old.league_id and r.created_at>now()-interval '6 hours'
 ) then
  insert into public.league_recovery_snapshots(league_id,revision,state,source) values(old.league_id,old.revision,old.state,'automatic');
  delete from public.league_recovery_snapshots where league_id=old.league_id and created_at<now()-interval '30 days';
 end if;
 return new;
end; $function$;

CREATE OR REPLACE FUNCTION public.claim_league_notification_events(p_claim_token uuid, p_league_id uuid, p_limit integer DEFAULT 50)
 RETURNS SETOF notification_events
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
 if p_claim_token is null or p_league_id is null then raise exception 'A claim token and league are required.'; end if;
 return query with candidates as (
  select event.id from public.notification_events event
  where event.league_id=p_league_id and event.sent_at is null and event.failed_at is null
   and coalesce(event.next_attempt_at,event.scheduled_for)<=now()
   and (event.claimed_at is null or event.claimed_at<now()-interval '15 minutes')
  order by coalesce(event.next_attempt_at,event.scheduled_for),event.created_at
  for update skip locked limit greatest(1,least(coalesce(p_limit,50),50))
 ) update public.notification_events event set claimed_at=now(),claim_token=p_claim_token,attempt_count=event.attempt_count+1
 from candidates where event.id=candidates.id returning event.*;
end; $function$;

CREATE OR REPLACE FUNCTION public.claim_live_setup_team(p_league_id uuid, p_team_index integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_state jsonb;
  v_team jsonb;
  v_name text;
  v_username text;
  v_user_id text := auth.uid()::text;
  v_team_count integer;
begin
  if auth.uid() is null then raise exception 'You must be signed in.'; end if;
  if p_team_index < 0 then raise exception 'Choose a valid team.'; end if;
  if not exists (
    select 1 from public.league_memberships
    where league_id = p_league_id and user_id = auth.uid()
      and role in ('coach', 'commissioner', 'co_commissioner')
  ) then
    raise exception 'Join this league before claiming a team.';
  end if;

  select state into v_state
  from public.league_state_snapshots
  where league_id = p_league_id
  for update;

  if v_state is null then raise exception 'League setup was not found.'; end if;
  if coalesce((v_state ->> 'locked')::boolean, false) then
    raise exception 'Teams cannot be claimed after the live draft starts.';
  end if;
  if jsonb_typeof(v_state -> 'teams') <> 'array' then
    raise exception 'League teams have not been initialized yet.';
  end if;

  v_team := v_state #> array['teams', p_team_index::text];
  if v_team is null then raise exception 'Team not found.'; end if;
  if nullif(btrim(v_team ->> 'claimedBy'), '') is not null
     or nullif(btrim(v_team ->> 'claimedByUserId'), '') is not null then
    raise exception 'That team has already been claimed. Refresh to see the remaining teams.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_state -> 'teams') team
    where team ->> 'claimedByUserId' = v_user_id
  ) then
    raise exception 'You already claimed a team in this league.';
  end if;

  select display_name, username into v_name, v_username
  from public.profiles where id = auth.uid();
  v_name := coalesce(nullif(btrim(v_name), ''), nullif(btrim(v_username), ''), 'Coach');

  v_state := jsonb_set(
    v_state,
    array['teams', p_team_index::text],
    v_team || jsonb_build_object('claimedBy', v_name, 'claimedByUserId', v_user_id),
    false
  );
  v_team_count := jsonb_array_length(v_state -> 'teams');
  v_state := public.compact_pre_draft_teams_claimed_first(
    p_league_id,
    v_state,
    v_team_count
  );
  v_state := jsonb_set(
    v_state,
    '{rev}',
    to_jsonb(greatest(coalesce((v_state ->> 'rev')::bigint, 0) + 1, 1)),
    true
  );

  update public.league_state_snapshots
  set state = v_state,
      revision = revision + 1,
      updated_at = now()
  where league_id = p_league_id;

  return v_state;
end;
$function$;

CREATE OR REPLACE FUNCTION public.claim_twitch_eventsub_message(p_message_id text, p_message_type text, p_broadcaster_id text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
 if nullif(trim(p_message_id),'') is null then return false; end if;
 delete from public.twitch_eventsub_messages where received_at<now()-interval '24 hours';
 insert into public.twitch_eventsub_messages(message_id,message_type,broadcaster_id) values(left(p_message_id,255),left(coalesce(p_message_type,'unknown'),100),left(p_broadcaster_id,255)) on conflict(message_id) do nothing;
 return found;
end; $function$;

CREATE OR REPLACE FUNCTION public.consume_api_rate_limit(p_scope_key text, p_limit integer, p_window_seconds integer)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_row public.api_rate_limits%rowtype;
begin
 if nullif(trim(p_scope_key),'') is null or p_limit<1 or p_window_seconds<1 then return false; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_scope_key,0));
 select * into v_row from public.api_rate_limits where scope_key=p_scope_key for update;
 if not found then insert into public.api_rate_limits(scope_key,window_started_at,request_count) values(left(p_scope_key,128),now(),1); return true; end if;
 if v_row.window_started_at<=now()-make_interval(secs=>p_window_seconds) then update public.api_rate_limits set window_started_at=now(),request_count=1,updated_at=now() where scope_key=p_scope_key; return true; end if;
 if v_row.request_count>=p_limit then return false; end if;
 update public.api_rate_limits set request_count=request_count+1,updated_at=now() where scope_key=p_scope_key; return true;
end; $function$;

CREATE OR REPLACE FUNCTION public.get_public_explore()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_shared jsonb;
  v_refreshed_at timestamptz;
  v_full jsonb;
  v_poll jsonb;
begin
  select cache.payload, cache.refreshed_at
  into v_shared, v_refreshed_at
  from public.public_explore_cache cache
  where cache.cache_key = 'shared';

  if v_shared is null
     or v_refreshed_at < clock_timestamp() - interval '15 minutes' then
    -- Serialize refreshes so a burst of visitors cannot all run the expensive
    -- aggregate after the cache expires. The lock is transaction-scoped.
    perform pg_catalog.pg_advisory_xact_lock(249, 1);

    select cache.payload, cache.refreshed_at
    into v_shared, v_refreshed_at
    from public.public_explore_cache cache
    where cache.cache_key = 'shared';

    if v_shared is null
       or v_refreshed_at < clock_timestamp() - interval '15 minutes' then
      v_full := public.get_public_explore_uncached();
      v_shared := jsonb_build_object(
        'leagues', coalesce(v_full -> 'leagues', '[]'::jsonb),
        'popularity', coalesce(v_full -> 'popularity', '[]'::jsonb),
        'adp', coalesce(v_full -> 'adp', '[]'::jsonb)
      );

      insert into public.public_explore_cache(cache_key, payload, refreshed_at)
      values ('shared', v_shared, clock_timestamp())
      on conflict (cache_key) do update
      set payload = excluded.payload,
          refreshed_at = excluded.refreshed_at;
    end if;
  end if;

  select coalesce((
    select jsonb_build_object(
      'id', poll.id,
      'poll_date', poll.poll_date,
      'question', poll.question,
      'answer_type', poll.answer_type,
      'options', poll.options,
      'counts', case
        when auth.uid() is null then '{}'::jsonb
        else coalesce((
          select jsonb_object_agg(counts.answer_key, counts.total)
          from (
            select answer.answer_key, count(*)::integer as total
            from public.daily_poll_answers answer
            where answer.poll_id = poll.id
            group by answer.answer_key
          ) counts
        ), '{}'::jsonb)
      end,
      'total_votes', (
        select count(*)::integer
        from public.daily_poll_answers answer
        where answer.poll_id = poll.id
      ),
      'selected_key', case
        when auth.uid() is null then null
        else (
          select answer.answer_key
          from public.daily_poll_answers answer
          where answer.poll_id = poll.id
            and answer.user_id = auth.uid()
        )
      end
    )
    from public.daily_polls poll
    where poll.poll_date <= current_date
    order by poll.poll_date desc
    limit 1
  ), 'null'::jsonb)
  into v_poll;

  return v_shared || jsonb_build_object(
    'signed_in', auth.uid() is not null,
    'poll', v_poll
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.is_my_setup_team(p_league_id uuid, p_team_index integer)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_state jsonb;
  v_claimed_by text;
  v_claimed_by_user_id text;
  v_display_name text;
  v_username text;
begin
  if auth.uid() is null or p_team_index is null or p_team_index < 0 then
    return false;
  end if;

  if not exists (
    select 1
    from public.league_memberships membership
    where membership.league_id = p_league_id
      and membership.user_id = auth.uid()
      and membership.role in ('coach', 'commissioner', 'co_commissioner')
  ) then
    return false;
  end if;

  select snapshot.state
  into v_state
  from public.league_state_snapshots snapshot
  where snapshot.league_id = p_league_id;

  if v_state is null
     or jsonb_typeof(v_state -> 'teams') <> 'array'
     or p_team_index >= jsonb_array_length(v_state -> 'teams') then
    return false;
  end if;

  v_claimed_by_user_id := nullif(
    btrim(v_state #>> array['teams', p_team_index::text, 'claimedByUserId']),
    ''
  );
  if v_claimed_by_user_id = auth.uid()::text then
    return true;
  end if;

  if exists (
    select 1
    from public.teams team_record
    join public.league_memberships owner_membership
      on owner_membership.id = team_record.owner_membership_id
    where team_record.league_id = p_league_id
      and team_record.source_key = p_team_index::text
      and owner_membership.user_id = auth.uid()
  ) then
    return true;
  end if;

  select profile.display_name, profile.username
  into v_display_name, v_username
  from public.profiles profile
  where profile.id = auth.uid();

  v_claimed_by := nullif(
    btrim(v_state #>> array['teams', p_team_index::text, 'claimedBy']),
    ''
  );
  return v_claimed_by is not null
    and (
      lower(v_claimed_by) = lower(coalesce(v_username, ''))
      or lower(v_claimed_by) = lower(coalesce(v_display_name, ''))
    );
end;
$function$;

CREATE OR REPLACE FUNCTION public.list_private_free_agent_claims(p_league_id uuid)
 RETURNS TABLE(id uuid, team_index integer, add_name text, drop_name text, bid_amount integer, week integer, submitted_at timestamp with time zone, claim_priority integer, can_withdraw boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_state jsonb;
  v_staff boolean;
begin
  if auth.uid() is null or not exists (
    select 1 from public.league_memberships membership
    where membership.league_id = p_league_id
      and membership.user_id = auth.uid()
      and membership.role::text in ('commissioner', 'co_commissioner', 'coach')
  ) then
    raise exception 'You must be a manager in this league.';
  end if;
  select state into v_state from public.league_state_snapshots where league_id = p_league_id;
  v_staff := public.is_league_staff(p_league_id);

  return query
  select
    claim.id,
    claim.team_index,
    claim.add_name,
    claim.drop_name,
    case when v_staff or public.league_actor_can_control_snapshot_team(p_league_id, v_state, claim.team_index)
      then claim.bid_amount else null end,
    claim.week,
    claim.submitted_at,
    claim.claim_priority,
    v_staff or public.league_actor_can_control_snapshot_team(p_league_id, v_state, claim.team_index)
  from public.league_free_agent_claims claim
  where claim.league_id = p_league_id
  order by claim.team_index, claim.claim_priority, claim.submitted_at, claim.id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.mutate_live_auction(p_league_id uuid, p_action text, p_payload jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  select snapshot.state
  into v_state
  from public.league_state_snapshots snapshot
  where snapshot.league_id = p_league_id
  for update;

  if v_state is null then raise exception 'League draft state was not found.'; end if;
  if coalesce(v_state #>> '{settings,draftType}', '') <> 'auction'
     or not coalesce((v_state ->> 'locked')::boolean, false) then
    raise exception 'There is no active hosted auction draft.';
  end if;

  insert into public.auction_team_owners (league_id, team_index, user_id)
  select p_league_id, team.ordinality - 1, owner.id
  from jsonb_array_elements(coalesce(v_state -> 'teams', '[]'::jsonb))
    with ordinality as team(value, ordinality)
  cross join lateral (
    select profile.id
    from public.profiles profile
    join public.league_memberships membership
      on membership.user_id = profile.id
     and membership.league_id = p_league_id
    where nullif(trim(team.value ->> 'claimedBy'), '') is not null
      and (
        lower(coalesce(profile.username, '')) = lower(team.value ->> 'claimedBy')
        or lower(coalesce(profile.display_name, '')) = lower(team.value ->> 'claimedBy')
      )
    order by case
      when lower(coalesce(profile.username, '')) = lower(team.value ->> 'claimedBy') then 0
      else 1
    end
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
      v_deadline := v_now_ms
        + greatest(1, coalesce((v_state #>> '{settings,auctionNominationSeconds}')::integer, 30)) * 1000;
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
    select pokemon.value
    into v_mon
    from jsonb_array_elements(coalesce(v_state -> 'pool', '[]'::jsonb)) pokemon(value)
    where pokemon.value ->> 'id' = v_mon_id
    limit 1;
    if v_mon is null then raise exception 'That Pokemon is no longer available.'; end if;
    v_roster := coalesce(v_state #> array['rosters', v_team_index::text], '[]'::jsonb);
    if jsonb_array_length(v_roster) >= v_roster_max then raise exception 'That roster is full.'; end if;
    v_restricted_cap := nullif(v_state #>> '{settings,restrictedCap}', '')::integer;
    v_mega_cap := nullif(v_state #>> '{settings,megaCap}', '')::integer;
    select
      count(*) filter (where coalesce((pokemon.value ->> 'isRestricted')::boolean, false)),
      count(*) filter (where coalesce((pokemon.value ->> 'isMega')::boolean, false))
    into v_restricted_count, v_mega_count
    from jsonb_array_elements(v_roster) pokemon(value);
    if coalesce((v_mon ->> 'isRestricted')::boolean, false)
       and v_restricted_cap is not null
       and v_restricted_count >= v_restricted_cap then
      raise exception 'That team has reached its restricted Pokemon limit.';
    end if;
    if coalesce((v_mon ->> 'isMega')::boolean, false)
       and v_mega_cap is not null
       and v_mega_count >= v_mega_cap then
      raise exception 'That team has reached its Mega Pokemon limit.';
    end if;
    v_bid := greatest(1, coalesce((p_payload ->> 'amount')::integer, 1));
    v_budget := coalesce((v_state #>> array['budgets', v_team_index::text])::integer, 0);
    if v_bid > v_budget then raise exception 'That opening bid is over the team''s remaining budget.'; end if;
    v_deadline := v_now_ms
      + greatest(1, coalesce((v_state #>> '{settings,auctionTimerSeconds}')::integer, 30)) * 1000;
    v_nominee := jsonb_build_object(
      'mon', v_mon,
      'currentBid', v_bid,
      'currentBidder', v_team_index,
      'nominatedBy', v_team_index,
      'deadline', v_deadline,
      'bids', jsonb_build_array(
        jsonb_build_object('teamIdx', v_team_index, 'amount', v_bid, 'at', v_now_ms)
      )
    );
    v_state := jsonb_set(v_state, '{nominee}', v_nominee, true);
    v_state := jsonb_set(v_state, '{nominationDeadline}', 'null'::jsonb, true);
    v_event_payload := jsonb_build_object(
      'team_index', v_team_index,
      'pokemon_id', v_mon_id,
      'amount', v_bid
    );

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
    if v_team_index = (v_nominee ->> 'currentBidder')::integer then
      raise exception 'Your team already has the highest bid.';
    end if;
    v_bid := (p_payload ->> 'amount')::integer;
    if v_bid <= (v_nominee ->> 'currentBid')::integer then raise exception 'That bid is no longer high enough.'; end if;
    v_budget := coalesce((v_state #>> array['budgets', v_team_index::text])::integer, 0);
    if v_bid > v_budget then raise exception 'That bid is over the team''s remaining budget.'; end if;
    v_roster := coalesce(v_state #> array['rosters', v_team_index::text], '[]'::jsonb);
    if jsonb_array_length(v_roster) >= v_roster_max then raise exception 'That roster is full.'; end if;
    v_mon := v_nominee -> 'mon';
    v_restricted_cap := nullif(v_state #>> '{settings,restrictedCap}', '')::integer;
    v_mega_cap := nullif(v_state #>> '{settings,megaCap}', '')::integer;
    select
      count(*) filter (where coalesce((pokemon.value ->> 'isRestricted')::boolean, false)),
      count(*) filter (where coalesce((pokemon.value ->> 'isMega')::boolean, false))
    into v_restricted_count, v_mega_count
    from jsonb_array_elements(v_roster) pokemon(value);
    if coalesce((v_mon ->> 'isRestricted')::boolean, false)
       and v_restricted_cap is not null
       and v_restricted_count >= v_restricted_cap then
      raise exception 'That team has reached its restricted Pokemon limit.';
    end if;
    if coalesce((v_mon ->> 'isMega')::boolean, false)
       and v_mega_cap is not null
       and v_mega_count >= v_mega_cap then
      raise exception 'That team has reached its Mega Pokemon limit.';
    end if;
    v_reset_seconds := greatest(
      1,
      coalesce((v_state #>> '{settings,auctionBidResetSeconds}')::integer, 10)
    );
    v_nominee := jsonb_set(v_nominee, '{currentBid}', to_jsonb(v_bid), true);
    v_nominee := jsonb_set(v_nominee, '{currentBidder}', to_jsonb(v_team_index), true);
    v_nominee := jsonb_set(
      v_nominee,
      '{deadline}',
      to_jsonb(v_now_ms + v_reset_seconds * 1000),
      true
    );
    v_nominee := jsonb_set(
      v_nominee,
      '{bids}',
      coalesce(v_nominee -> 'bids', '[]'::jsonb)
        || jsonb_build_array(
          jsonb_build_object('teamIdx', v_team_index, 'amount', v_bid, 'at', v_now_ms)
        ),
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
    v_mon_id := v_nominee #>> '{mon,id}';
    select coalesce(jsonb_agg(pokemon.value order by pokemon.ordinality), '[]'::jsonb)
    into v_pool
    from jsonb_array_elements(coalesce(v_state -> 'pool', '[]'::jsonb))
      with ordinality as pokemon(value, ordinality)
    where pokemon.value ->> 'id' <> v_mon_id;
    v_state := jsonb_set(v_state, '{pool}', v_pool, true);
    v_state := jsonb_set(v_state, '{nominee}', 'null'::jsonb, true);
    v_state := jsonb_set(v_state, '{nominationDeadline}', 'null'::jsonb, true);
    v_state := jsonb_set(
      v_state,
      '{auctionNominationIdx}',
      to_jsonb(v_nomination_index + 1),
      true
    );
    v_event_payload := jsonb_build_object(
      'team_index', v_team_index,
      'pokemon_id', v_mon_id,
      'amount', v_bid
    );

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
    v_state := jsonb_set(
      v_state,
      '{auctionNominationIdx}',
      to_jsonb(v_nomination_index + 1),
      true
    );
    v_state := jsonb_set(v_state, '{nominationDeadline}', 'null'::jsonb, true);

  elsif v_action = 'pause' then
    if not public.is_league_staff(p_league_id) then raise exception 'Only league staff can pause the draft.'; end if;
    if coalesce((v_state ->> 'paused')::boolean, false) then return v_state; end if;
    v_state := jsonb_set(v_state, '{paused}', 'true'::jsonb, true);
    v_state := jsonb_set(v_state, '{pausedAt}', to_jsonb(v_now_ms), true);
    v_state := jsonb_set(
      v_state,
      '{pauseIsOvernight}',
      to_jsonb(coalesce((p_payload ->> 'overnight')::boolean, false)),
      true
    );

  elsif v_action = 'resume' then
    if not public.is_league_staff(p_league_id) then raise exception 'Only league staff can resume the draft.'; end if;
    if not coalesce((v_state ->> 'paused')::boolean, false) then return v_state; end if;
    v_pause_started := coalesce((v_state ->> 'pausedAt')::bigint, v_now_ms);
    v_pause_ms := greatest(0, v_now_ms - v_pause_started);
    if v_state -> 'nominationDeadline' <> 'null'::jsonb then
      v_state := jsonb_set(
        v_state,
        '{nominationDeadline}',
        to_jsonb((v_state ->> 'nominationDeadline')::bigint + v_pause_ms),
        true
      );
    end if;
    if v_state -> 'nominee' <> 'null'::jsonb then
      v_state := jsonb_set(
        v_state,
        '{nominee,deadline}',
        to_jsonb((v_state #>> '{nominee,deadline}')::bigint + v_pause_ms),
        true
      );
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
  values (p_league_id, 'auction_' || v_action, auth.uid(), v_event_payload);

  return v_state;
end;
$function$;

CREATE OR REPLACE FUNCTION public.process_private_free_agent_claims_internal(p_league_id uuid, p_cycle text DEFAULT NULL::text, p_cutoff timestamp with time zone DEFAULT NULL::timestamp with time zone, p_actor_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_state jsonb;
  v_settings jsonb;
  v_context jsonb;
  v_mode text;
  v_team_count integer;
  v_rosters jsonb;
  v_budgets jsonb;
  v_pool jsonb;
  v_faab_budgets jsonb;
  v_priority jsonb;
  v_transaction_log jsonb;
  v_results jsonb := '[]'::jsonb;
  v_claim_count integer := 0;
  v_winner_count integer := 0;
  v_current_week integer;
  v_now_ms bigint := floor(extract(epoch from clock_timestamp()) * 1000)::bigint;
  v_uses_budget boolean;
  v_skip_tier_cost boolean;
  v_total_limit integer;
  v_week_limit integer;
  v_deadline_week integer;
  v_total_used integer;
  v_week_used integer;
  v_claim record;
  v_group record;
  v_roster jsonb;
  v_new_roster jsonb;
  v_add_mon jsonb;
  v_drop_mon jsonb;
  v_awarded_mon jsonb;
  v_add_cost numeric;
  v_drop_cost numeric;
  v_final_cost numeric;
  v_current_budget numeric;
  v_new_budget numeric;
  v_current_faab integer;
  v_new_faab integer;
  v_bid integer;
  v_reason text;
  v_awarded boolean;
  v_result_claim jsonb;
begin
  select state
  into v_state
  from public.league_state_snapshots
  where league_id = p_league_id
  for update;
  if v_state is null then
    raise exception 'League state was not found.';
  end if;

  v_settings := coalesce(v_state -> 'settings', '{}'::jsonb);
  v_mode := coalesce(v_settings ->> 'faClaimMode', 'instant');
  if not public.snapshot_draft_is_complete(v_state) then
    raise exception 'Transactions open only after the draft is complete.';
  end if;
  if v_mode = 'instant' then
    raise exception 'This league processes free agents instantly.';
  end if;

  -- Scheduled calls are re-checked after taking the league row lock. This
  -- prevents a stale cron scan from processing after the commissioner changes
  -- the clock, time zone, claim mode, or automatic-processing setting.
  if p_cycle is not null then
    v_context := public.league_claim_due_context(v_state, clock_timestamp());
    if v_context is null
       or coalesce(v_context ->> 'cycle', '') <> p_cycle then
      return v_state;
    end if;
    p_cutoff := (v_context ->> 'due_at')::timestamptz;
  end if;

  v_rosters := coalesce(v_state -> 'rosters', '[]'::jsonb);
  v_pool := case
    when jsonb_typeof(v_state -> 'pool') = 'array'
    then v_state -> 'pool'
    else '[]'::jsonb
  end;
  if jsonb_typeof(v_rosters) <> 'array'
     or jsonb_typeof(v_state -> 'teams') <> 'array' then
    raise exception 'League roster data is invalid. Ask a commissioner to restore a backup.';
  end if;
  v_team_count := jsonb_array_length(v_state -> 'teams');
  if jsonb_array_length(v_rosters) <> v_team_count then
    raise exception 'League roster data does not match the team list.';
  end if;

  v_budgets := case
    when jsonb_typeof(v_state -> 'budgets') = 'array'
    then v_state -> 'budgets'
    else '[]'::jsonb
  end;
  if jsonb_array_length(v_budgets) <> v_team_count then
    select coalesce(
      jsonb_agg(
        greatest(
          0,
          coalesce(
            nullif(v_budgets ->> team_index, '')::numeric,
            nullif(v_settings ->> 'budget', '')::numeric,
            0
          )
        )
        order by team_index
      ),
      '[]'::jsonb
    )
    into v_budgets
    from generate_series(0, v_team_count - 1) team_index;
  end if;

  v_faab_budgets := case
    when jsonb_typeof(v_state -> 'faabBudgets') = 'object'
    then v_state -> 'faabBudgets'
    else '{}'::jsonb
  end;
  v_priority := case
    when jsonb_typeof(v_state -> 'waiverPriority') = 'array'
      and jsonb_array_length(v_state -> 'waiverPriority') > 0
    then v_state -> 'waiverPriority'
    else (
      select coalesce(jsonb_agg(team_index order by team_index), '[]'::jsonb)
      from generate_series(0, v_team_count - 1) team_index
    )
  end;
  v_transaction_log := case
    when jsonb_typeof(v_state -> 'transactionLog') = 'array'
    then v_state -> 'transactionLog'
    else '[]'::jsonb
  end;
  v_current_week := public.snapshot_operational_week(v_state, clock_timestamp());
  v_uses_budget := case
    when jsonb_typeof(v_settings -> 'postDraftBudgetEnabled') = 'boolean'
    then (v_settings ->> 'postDraftBudgetEnabled')::boolean
    else coalesce(v_settings ->> 'draftType', 'snake') = 'auction'
      or coalesce((v_settings ->> 'snakeBudgetEnabled')::boolean, false)
  end;
  v_skip_tier_cost := v_mode = 'faab'
    and coalesce((v_settings ->> 'faabReplacesTierCost')::boolean, false);
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

  select count(*)
  into v_claim_count
  from public.league_free_agent_claims
  where league_id = p_league_id
    and (p_cutoff is null or submitted_at <= p_cutoff);

  for v_group in
    select
      coalesce(claim_priority, 2147483647) as claim_priority,
      lower(add_name) as add_key,
      min(submitted_at) as first_submitted
    from public.league_free_agent_claims
    where league_id = p_league_id
      and (p_cutoff is null or submitted_at <= p_cutoff)
    group by coalesce(claim_priority, 2147483647), lower(add_name)
    order by coalesce(claim_priority, 2147483647), min(submitted_at), lower(add_name)
  loop
    v_awarded := false;

    for v_claim in
      select
        claim.*,
        coalesce(
          (
            select priority_item.ordinality::integer
            from jsonb_array_elements_text(v_priority)
              with ordinality priority_item(value, ordinality)
            where priority_item.value::integer = claim.team_index
            limit 1
          ),
          2147483647
        ) as priority_rank,
        public.snapshot_team_record_score(v_state, claim.team_index)
          as record_score
      from public.league_free_agent_claims claim
      where claim.league_id = p_league_id
        and lower(claim.add_name) = v_group.add_key
        and coalesce(claim.claim_priority, 2147483647) = v_group.claim_priority
        and (p_cutoff is null or claim.submitted_at <= p_cutoff)
      order by
        case when v_mode = 'faab' then coalesce(claim.bid_amount, 0) end desc,
        case when v_mode = 'worst-record'
          then public.snapshot_team_record_score(v_state, claim.team_index)
        end asc,
        case when v_mode in ('faab', 'priority') then
          coalesce(
            (
              select priority_item.ordinality::integer
              from jsonb_array_elements_text(v_priority)
                with ordinality priority_item(value, ordinality)
              where priority_item.value::integer = claim.team_index
              limit 1
            ),
            2147483647
          )
        end asc,
        case when v_mode = 'random'
          then md5(claim.id::text || coalesce(p_cycle, 'manual'))
        end asc,
        claim.submitted_at,
        claim.id
    loop
      v_reason := null;
      v_result_claim := jsonb_build_object(
        'id', v_claim.id,
        'teamIdx', v_claim.team_index,
        'addName', v_claim.add_name,
        'dropName', v_claim.drop_name,
        'submittedAt',
          floor(extract(epoch from v_claim.submitted_at) * 1000)::bigint,
        'week', v_claim.week
      );

      if v_awarded then
        v_reason := 'Lost the claim.';
      elsif v_claim.team_index < 0
         or v_claim.team_index >= v_team_count then
        v_reason := 'The claiming team is no longer valid.';
      elsif exists (
        select 1
        from jsonb_array_elements(v_rosters) roster(value)
        cross join lateral jsonb_array_elements(
          case when jsonb_typeof(roster.value) = 'array'
            then roster.value else '[]'::jsonb end
        ) mon(value)
        where lower(coalesce(mon.value ->> 'name', ''))
          = lower(v_claim.add_name)
      ) then
        v_reason := 'No longer available.';
      elsif coalesce((v_settings ->> 'lockTransactionsAtPlayoffs')::boolean, false)
         and v_state -> 'playoffs' is not null
         and v_state -> 'playoffs' <> 'null'::jsonb then
        v_reason := 'Transactions are closed once the playoff bracket is generated.';
      elsif v_deadline_week is not null
         and v_deadline_week > 0
         and v_current_week > v_deadline_week - 1 then
        v_reason := 'The transaction deadline has passed.';
      else
        select
          count(*),
          count(*) filter (
            where coalesce((entry.value ->> 'week')::integer, -1)
              = v_current_week
          )
        into v_total_used, v_week_used
        from jsonb_array_elements(v_transaction_log) entry(value)
        where coalesce((entry.value ->> 'teamIdx')::integer, -1)
          = v_claim.team_index;

        if v_total_limit is not null
           and v_total_limit > 0
           and v_total_used >= v_total_limit then
          v_reason := 'This team has reached its season transaction limit.';
        elsif v_week_limit is not null
           and v_week_limit > 0
           and v_week_used >= v_week_limit then
          v_reason := 'This team has reached its weekly transaction limit.';
        end if;
      end if;

      if v_reason is null then
        v_roster := v_rosters -> v_claim.team_index;
        v_add_mon := null;
        select mon.value
        into v_add_mon
        from jsonb_array_elements(v_pool) mon(value)
        where lower(coalesce(mon.value ->> 'name', ''))
          = lower(v_claim.add_name)
        limit 1;
        if v_add_mon is null
           and jsonb_typeof(v_state #> '{liveDraft,basePool}') = 'array' then
          select mon.value
          into v_add_mon
          from jsonb_array_elements(v_state #> '{liveDraft,basePool}') mon(value)
          where lower(coalesce(mon.value ->> 'name', ''))
            = lower(v_claim.add_name)
          limit 1;
        end if;
        v_drop_mon := null;
        if jsonb_typeof(v_roster) <> 'array'
           or jsonb_typeof(v_add_mon) <> 'object'
           or lower(coalesce(v_add_mon ->> 'name', ''))
             <> lower(v_claim.add_name) then
          v_reason := 'The claim data is no longer valid.';
        elsif exists (
          select 1
          from jsonb_array_elements(
            case
              when jsonb_typeof(v_settings -> 'bannedMons') = 'array'
              then v_settings -> 'bannedMons'
              else '[]'::jsonb
            end
          ) banned(value)
          where lower(banned.value #>> '{}') = lower(v_claim.add_name)
        ) or (
          coalesce((v_add_mon ->> 'isMega')::boolean, false)
          and not coalesce((v_settings ->> 'allowMegas')::boolean, false)
        ) then
          v_reason := 'That Pokemon is no longer legal in this league.';
        end if;

        if v_reason is null and v_claim.drop_name is not null then
          select mon.value
          into v_drop_mon
          from jsonb_array_elements(v_roster) mon(value)
          where lower(coalesce(mon.value ->> 'name', ''))
            = lower(v_claim.drop_name)
          limit 1;
          if v_drop_mon is null then
            v_reason := 'The selected drop is no longer on that roster.';
          end if;
        end if;
      end if;

      if v_reason is null then
        select coalesce(jsonb_agg(mon.value order by mon.ordinality), '[]'::jsonb)
        into v_new_roster
        from jsonb_array_elements(v_roster)
          with ordinality mon(value, ordinality)
        where v_claim.drop_name is null
          or lower(coalesce(mon.value ->> 'name', ''))
            <> lower(v_claim.drop_name);

        if jsonb_array_length(v_new_roster)
           >= greatest(1, coalesce((v_settings ->> 'rosterMax')::integer, 1))
           and v_claim.drop_name is null then
          v_reason := 'Roster was full.';
        end if;
      end if;

      if v_reason is null then
        v_add_cost := greatest(0, coalesce((v_add_mon ->> 'cost')::numeric, 0));
        v_drop_cost := greatest(0, coalesce((v_drop_mon ->> 'cost')::numeric, 0));
        v_bid := greatest(0, coalesce(v_claim.bid_amount, 0));
        v_current_budget := greatest(
          0,
          coalesce((v_budgets ->> v_claim.team_index)::numeric, 0)
        );
        v_new_budget := v_current_budget;
        v_current_faab := greatest(
          0,
          coalesce(
            (v_faab_budgets ->> v_claim.team_index)::integer,
            (v_settings ->> 'faabBudget')::integer,
            0
          )
        );
        v_new_faab := v_current_faab;

        if v_uses_budget and not v_skip_tier_cost then
          v_new_budget := v_new_budget + v_drop_cost - v_add_cost;
        end if;
        if v_mode = 'faab' then
          if coalesce(
            (v_settings ->> 'faabUsesLeftoverDraftBudget')::boolean,
            false
          ) then
            v_new_budget := v_new_budget - v_bid;
          else
            v_new_faab := v_new_faab - v_bid;
          end if;
        end if;

        if v_new_budget < 0 then
          v_reason := 'That team does not have enough remaining budget.';
        elsif v_new_faab < 0 then
          v_reason := 'That bid is greater than this team''s available FAAB.';
        end if;
      end if;

      if v_reason is null then
        v_final_cost := case
          when v_skip_tier_cost then v_bid
          else v_add_cost
        end;
        v_awarded_mon := jsonb_set(
          jsonb_set(
            v_add_mon,
            '{cost}',
            to_jsonb(v_final_cost),
            true
          ),
          '{acquiredVia}',
          to_jsonb('freeagency'::text),
          true
        );
        v_new_roster := v_new_roster || jsonb_build_array(v_awarded_mon);
        if not public.snapshot_roster_respects_caps(
          v_new_roster,
          v_settings
        ) then
          v_reason := 'That move would exceed the roster size or a configured roster cap.';
        end if;
      end if;

      if v_reason is null then
        v_rosters := jsonb_set(
          v_rosters,
          array[v_claim.team_index::text],
          v_new_roster,
          false
        );
        v_budgets := jsonb_set(
          v_budgets,
          array[v_claim.team_index::text],
          to_jsonb(v_new_budget),
          false
        );
        if v_mode = 'faab'
           and not coalesce(
             (v_settings ->> 'faabUsesLeftoverDraftBudget')::boolean,
             false
           ) then
          v_faab_budgets := jsonb_set(
            v_faab_budgets,
            array[v_claim.team_index::text],
            to_jsonb(v_new_faab),
            true
          );
        end if;

        v_transaction_log := v_transaction_log || jsonb_build_array(
          jsonb_build_object(
            'id', gen_random_uuid()::text,
            'teamIdx', v_claim.team_index,
            'week', v_current_week,
            'timestamp', v_now_ms,
            'addName', v_add_mon ->> 'name',
            'addCost', v_final_cost,
            'dropName', case
              when v_drop_mon is null then null
              else v_drop_mon ->> 'name'
            end,
            'dropCost', case
              when v_drop_mon is null then null
              else v_drop_cost
            end
          )
        );
        select coalesce(
          jsonb_agg(mon.value order by mon.ordinality),
          '[]'::jsonb
        )
        into v_pool
        from jsonb_array_elements(v_pool)
          with ordinality mon(value, ordinality)
        where lower(coalesce(mon.value ->> 'name', ''))
          <> lower(v_claim.add_name);
        if v_drop_mon is not null
           and not exists (
             select 1
             from jsonb_array_elements(v_pool) mon(value)
             where lower(coalesce(mon.value ->> 'name', ''))
               = lower(v_claim.drop_name)
           ) then
          v_pool := v_pool || jsonb_build_array(v_drop_mon);
        end if;
        if v_mode = 'priority' then
          select coalesce(
            jsonb_agg(item.value order by item.ordinality)
              filter (where item.value::integer <> v_claim.team_index),
            '[]'::jsonb
          ) || jsonb_build_array(v_claim.team_index)
          into v_priority
          from jsonb_array_elements(v_priority)
            with ordinality item(value, ordinality);
        end if;

        v_results := v_results || jsonb_build_array(
          jsonb_build_object(
            'claim', v_result_claim,
            'ok', true,
            'reason', ''
          )
        );
        v_awarded := true;
        v_winner_count := v_winner_count + 1;
      else
        v_results := v_results || jsonb_build_array(
          jsonb_build_object(
            'claim', v_result_claim,
            'ok', false,
            'reason', v_reason
          )
        );
      end if;
    end loop;
  end loop;

  if v_claim_count = 0 and p_cycle is null then
    return v_state;
  end if;

  if v_claim_count > 0 then
    delete from public.league_free_agent_claims
    where league_id = p_league_id
      and (p_cutoff is null or submitted_at <= p_cutoff);
    v_state := jsonb_set(v_state, '{rosters}', v_rosters, true);
    v_state := jsonb_set(v_state, '{budgets}', v_budgets, true);
    v_state := jsonb_set(v_state, '{pool}', v_pool, true);
    v_state := jsonb_set(v_state, '{faabBudgets}', v_faab_budgets, true);
    v_state := jsonb_set(v_state, '{waiverPriority}', v_priority, true);
    v_state := jsonb_set(
      v_state,
      '{transactionLog}',
      v_transaction_log,
      true
    );
    v_state := jsonb_set(v_state, '{lastClaimResults}', v_results, true);
  end if;
  v_state := jsonb_set(v_state, '{pendingClaims}', '[]'::jsonb, true);
  if p_cycle is not null then
    v_state := jsonb_set(
      v_state,
      '{lastAutoClaimCycle}',
      to_jsonb(p_cycle),
      true
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
  where league_id = p_league_id;

  insert into public.league_events(league_id, kind, actor_id, payload)
  values (
    p_league_id,
    case
      when p_cycle is null then 'free_agent_claims_processed'
      else 'scheduled_free_agent_claims_processed'
    end,
    p_actor_id,
    jsonb_build_object(
      'claim_count', v_claim_count,
      'winner_count', v_winner_count,
      'cycle', p_cycle,
      'automatic', p_cycle is not null
    )
  );
  return v_state;
end;
$function$;

CREATE OR REPLACE FUNCTION public.reconcile_autonomous_league_claims()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_snapshot record;
  v_context jsonb;
  v_now timestamptz := clock_timestamp();
  v_checked integer := 0;
  v_processed integer := 0;
  v_failed integer := 0;
begin
  for v_snapshot in
    select snapshot.league_id, snapshot.state
    from public.league_state_snapshots snapshot
    join pg_catalog.pg_timezone_names zone
      on zone.name = coalesce(
        nullif(btrim(snapshot.state #>> '{settings,leagueTimeZone}'), ''),
        'UTC'
      )
    cross join lateral (
      select timezone(zone.name, v_now) as local_now
    ) local_clock
    where coalesce(snapshot.state #>> '{settings,calendarMode}', '') = 'weekly'
      and coalesce(snapshot.state #>> '{settings,autoProcessClaims}', 'false') = 'true'
      and coalesce(snapshot.state #>> '{settings,faClaimMode}', 'instant') <> 'instant'
      and extract(dow from local_clock.local_now)::integer = case
        when coalesce(snapshot.state #>> '{settings,claimDayOfWeek}', '') ~ '^[0-6]$'
          then (snapshot.state #>> '{settings,claimDayOfWeek}')::integer
        else 3
      end
      and local_clock.local_now::time >= case
        when coalesce(snapshot.state #>> '{settings,claimTime}', '')
          ~ '^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9](\.[0-9]+)?)?$'
          then (snapshot.state #>> '{settings,claimTime}')::time
        else time '20:00'
      end
      and coalesce(snapshot.state ->> 'lastAutoClaimCycle', '')
        <> to_char(local_clock.local_now::date, 'YYYY-MM-DD')
  loop
    v_checked := v_checked + 1;
    begin
      -- This remains the authority for season start, draft completion, time
      -- zone validation, and the exact cycle/due timestamp.
      v_context := public.league_claim_due_context(v_snapshot.state, v_now);
      if v_context is not null then
        perform public.process_private_free_agent_claims_internal(
          v_snapshot.league_id,
          v_context ->> 'cycle',
          (v_context ->> 'due_at')::timestamptz,
          null
        );
        v_processed := v_processed + 1;
      end if;
    exception when others then
      v_failed := v_failed + 1;
    end;
  end loop;

  return jsonb_build_object(
    'checked', v_checked,
    'processed', v_processed,
    'failed', v_failed
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.reconcile_autonomous_live_auctions()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.reconcile_autonomous_snake_drafts()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_job public.scheduled_snake_draft_jobs;
  v_session public.draft_sessions;
  v_state jsonb;
  v_result jsonb;
  v_claims text;
  v_previous_claims text;
  v_now_ms bigint;
  v_limit_minutes integer;
  v_team_index integer;
  v_owner_id uuid;
  v_candidate record;
  v_picked boolean;
  v_started integer := 0;
  v_picked_count integer := 0;
  v_advanced integer := 0;
  v_failed integer := 0;
begin
  v_now_ms := floor(extract(epoch from clock_timestamp()) * 1000)::bigint;
  v_previous_claims := current_setting('request.jwt.claims', true);

  for v_job in
    select *
    from public.scheduled_snake_draft_jobs
    where status = 'scheduled'
      and starts_at <= clock_timestamp()
    order by starts_at
    for update skip locked
  loop
    begin
      update public.scheduled_snake_draft_jobs
      set status = 'starting', updated_at = now()
      where league_id = v_job.league_id;

      v_claims := json_build_object(
        'sub', v_job.commissioner_id::text,
        'role', 'authenticated'
      )::text;
      perform set_config('request.jwt.claims', v_claims, true);

      v_result := public.provision_live_snake_draft_v2(
        v_job.league_id,
        v_job.teams,
        v_job.pokemon,
        v_job.pick_order,
        v_job.settings,
        v_job.keepers,
        v_job.started_state
      );

      v_limit_minutes := public.draft_setting_nonnegative_integer(
        v_job.settings,
        'pickTimeLimitMinutes',
        0
      );
      update public.draft_sessions
      set updated_at = clock_timestamp()
      where id = (v_result ->> 'draft_session_id')::uuid;

      update public.league_state_snapshots
      set state = jsonb_set(
                    jsonb_set(state, '{settings,draftScheduledAt}', 'null'::jsonb, true),
                    '{pickDeadline}',
                    case when v_limit_minutes > 0
                      then to_jsonb(v_now_ms + v_limit_minutes::bigint * 60000)
                      else 'null'::jsonb
                    end,
                    true
                  ),
          revision = revision + 1,
          updated_at = now()
      where league_id = v_job.league_id;

      update public.leagues
      set draft_starts_at = null, updated_at = now()
      where id = v_job.league_id;
      update public.scheduled_snake_draft_jobs
      set status = 'started', last_error = null, updated_at = now()
      where league_id = v_job.league_id;
      v_started := v_started + 1;
    exception when others then
      update public.scheduled_snake_draft_jobs
      set status = 'failed', last_error = sqlerrm, updated_at = now()
      where league_id = v_job.league_id;
      insert into public.league_events (league_id, kind, actor_id, payload)
      values (
        v_job.league_id,
        'draft_start_failed',
        null,
        jsonb_build_object('error', sqlerrm)
      );
      v_failed := v_failed + 1;
    end;
  end loop;

  for v_session in
    select session.*
    from public.draft_sessions session
    join public.leagues league on league.id = session.league_id
    join public.teams active_team on active_team.id = session.current_team_id
    join public.league_state_snapshots snapshot
      on snapshot.league_id = session.league_id
    where session.mode = 'snake'
      and session.status = 'active'
      and (
        active_team.owner_membership_id is null
        or lower(coalesce(
          snapshot.state #>> array['teams', active_team.source_key, 'autoDraft'],
          'false'
        )) in ('true', 't', '1', 'yes', 'on')
        or (
          public.draft_setting_nonnegative_integer(
            league.settings,
            'pickTimeLimitMinutes',
            0
          ) > 0
          and session.updated_at + make_interval(
            mins => public.draft_setting_nonnegative_integer(
              league.settings,
              'pickTimeLimitMinutes',
              0
            )
          ) <= clock_timestamp()
        )
      )
    order by session.updated_at
    for update of session skip locked
  loop
    begin
      select snapshot.state
      into v_state
      from public.league_state_snapshots snapshot
      where snapshot.league_id = v_session.league_id
      for update of snapshot;

      if lower(coalesce(v_state ->> 'paused', 'false'))
        in ('true', 't', '1', 'yes', 'on') then
        continue;
      end if;

      select team.source_key::integer, membership.user_id
      into v_team_index, v_owner_id
      from public.teams team
      left join public.league_memberships membership
        on membership.id = team.owner_membership_id
      where team.id = v_session.current_team_id;

      if v_owner_id is null then
        select league.created_by
        into v_owner_id
        from public.leagues league
        where league.id = v_session.league_id;
      end if;

      v_claims := json_build_object(
        'sub', v_owner_id::text,
        'role', 'authenticated'
      )::text;
      perform set_config('request.jwt.claims', v_claims, true);
      v_picked := false;

      for v_candidate in
        with choices as (
          select
            pokemon.id,
            queue.position::bigint as choice_order,
            0 as source_order
          from public.private_draft_queue_items queue
          join public.league_pokemon pokemon
            on pokemon.league_id = queue.league_id
          join public.pokemon_catalogue catalogue
            on catalogue.id = pokemon.pokemon_id
           and lower(catalogue.display_name) = lower(queue.pokemon_name)
          where queue.league_id = v_session.league_id
            and queue.user_id = v_owner_id
            and queue.team_index = v_team_index

          union all

          select
            pokemon.id,
            pool.ordinality::bigint as choice_order,
            1 as source_order
          from jsonb_array_elements(coalesce(v_state -> 'pool', '[]'::jsonb))
            with ordinality pool(mon, ordinality)
          join public.league_pokemon pokemon
            on pokemon.league_id = v_session.league_id
           and pokemon.source_key = pool.mon ->> 'id'
        ),
        ranked as (
          select
            choices.id,
            min(choices.source_order) as source_order,
            min(choices.choice_order) filter (
              where choices.source_order = (
                select min(inner_choice.source_order)
                from choices inner_choice
                where inner_choice.id = choices.id
              )
            ) as choice_order
          from choices
          group by choices.id
        )
        select ranked.id
        from ranked
        join public.league_pokemon pokemon on pokemon.id = ranked.id
        where pokemon.is_allowed and not pokemon.is_drafted
        order by ranked.source_order, ranked.choice_order
      loop
        begin
          perform public.make_snake_pick(v_session.id, v_candidate.id);
          delete from public.private_draft_queue_items
          where league_id = v_session.league_id
            and pokemon_name = (
              select catalogue.display_name
              from public.league_pokemon pokemon
              join public.pokemon_catalogue catalogue
                on catalogue.id = pokemon.pokemon_id
              where pokemon.id = v_candidate.id
            );
          v_picked := true;
          v_picked_count := v_picked_count + 1;
          exit;
        exception when others then
          null;
        end;
      end loop;

      if not v_picked then
        select league.created_by into v_owner_id
        from public.leagues league
        where league.id = v_session.league_id;
        perform set_config(
          'request.jwt.claims',
          json_build_object(
            'sub', v_owner_id::text,
            'role', 'authenticated'
          )::text,
          true
        );
        perform public.advance_live_snake_turn(v_session.league_id);
        v_advanced := v_advanced + 1;
      end if;

      insert into public.league_events (league_id, kind, actor_id, payload)
      values (
        v_session.league_id,
        'draft_clock_resolved',
        null,
        jsonb_build_object(
          'pick_number', v_session.current_pick_number,
          'team_id', v_session.current_team_id,
          'resolution', case
            when v_picked then 'automatic_pick'
            else 'advanced'
          end
        )
      );
    exception when others then
      v_failed := v_failed + 1;
      insert into public.league_events (league_id, kind, actor_id, payload)
      values (
        v_session.league_id,
        'draft_clock_resolution_failed',
        null,
        jsonb_build_object(
          'pick_number', v_session.current_pick_number,
          'team_id', v_session.current_team_id,
          'error', sqlerrm
        )
      );
    end;
  end loop;

  perform set_config(
    'request.jwt.claims',
    coalesce(nullif(v_previous_claims, ''), '{}'),
    true
  );
  return jsonb_build_object(
    'started', v_started,
    'automatic_picks', v_picked_count,
    'advanced', v_advanced,
    'failed', v_failed
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.reconcile_scheduled_auction_drafts()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.restore_my_personal_teams(p_teams jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_team jsonb;
  v_id uuid;
  v_restored integer := 0;
  v_workspace_type text;
  v_column_name text;
  v_updated integer;
  v_update_sql text := $update$
    update public.personal_teams
    set team_name = btrim($1 ->> 'team_name'),
        league_name = nullif(btrim($1 ->> 'league_name'), ''),
        format_name = nullif(btrim($1 ->> 'format_name'), ''),
        workspace_type = $2,
        planning_entries = coalesce($1 -> 'planning_entries', '[]'::jsonb),
        notes = coalesce($1 ->> 'notes', ''),
        weekly_notes = coalesce($1 ->> 'weekly_notes', ''),
        pokepaste_url = nullif(btrim($1 ->> 'pokepaste_url'), ''),
        replica_code = coalesce($1 ->> 'replica_code', ''),
        spreadsheet_url = nullif(btrim($1 ->> 'spreadsheet_url'), ''),
        pokemon = coalesce($1 -> 'pokemon', '[]'::jsonb),
        team_sets = coalesce($1 -> 'team_sets', '{"version":1,"pokemon":[]}'::jsonb),
        archived = coalesce(($1 ->> 'archived')::boolean, false)
  $update$;
  v_insert_columns text := 'id, owner_id, team_name, league_name, format_name, workspace_type, planning_entries, notes, weekly_notes, pokepaste_url, replica_code, spreadsheet_url, pokemon, team_sets, archived';
  v_insert_values text := $values$
    $3, auth.uid(), btrim($1 ->> 'team_name'),
    nullif(btrim($1 ->> 'league_name'), ''),
    nullif(btrim($1 ->> 'format_name'), ''), $2,
    coalesce($1 -> 'planning_entries', '[]'::jsonb),
    coalesce($1 ->> 'notes', ''),
    coalesce($1 ->> 'weekly_notes', ''),
    nullif(btrim($1 ->> 'pokepaste_url'), ''),
    coalesce($1 ->> 'replica_code', ''),
    nullif(btrim($1 ->> 'spreadsheet_url'), ''),
    coalesce($1 -> 'pokemon', '[]'::jsonb),
    coalesce($1 -> 'team_sets', '{"version":1,"pokemon":[]}'::jsonb),
    coalesce(($1 ->> 'archived')::boolean, false)
  $values$;
begin
  if auth.uid() is null then
    raise exception 'Sign in before restoring My Teams.';
  end if;
  if p_teams is null
     or jsonb_typeof(p_teams) <> 'array'
     or octet_length(p_teams::text) > 10000000 then
    raise exception 'The My Teams recovery file is invalid or too large.';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_teams) team
    where nullif(team ->> 'id', '') is null
       or nullif(btrim(team ->> 'team_name'), '') is null
  ) then
    raise exception 'The recovery file contains an invalid team.';
  end if;

  -- Retained Preview projects can intentionally carry a smaller historical
  -- personal_teams surface. Restore every optional field that exists without
  -- making migration 404 backfill unrelated legacy columns.
  for v_column_name in
    select column_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'personal_teams'
      and column_name in (
        'team_report_url', 'is_public', 'regulation_id', 'public_summary',
        'share_pokepaste', 'share_replica_code', 'share_team_report',
        'nuzlocke_run'
      )
    order by ordinal_position
  loop
    case v_column_name
      when 'team_report_url' then
        v_update_sql := v_update_sql || ', team_report_url = nullif(btrim($1 ->> ''team_report_url''), '''')';
        v_insert_values := v_insert_values || ', nullif(btrim($1 ->> ''team_report_url''), '''')';
      when 'is_public' then
        v_update_sql := v_update_sql || ', is_public = case when $2 = ''nuzlocke'' then false else coalesce(($1 ->> ''is_public'')::boolean, false) end';
        v_insert_values := v_insert_values || ', case when $2 = ''nuzlocke'' then false else coalesce(($1 ->> ''is_public'')::boolean, false) end';
      when 'regulation_id' then
        v_update_sql := v_update_sql || ', regulation_id = case when $2 = ''nuzlocke'' then null else nullif(btrim($1 ->> ''regulation_id''), '''') end';
        v_insert_values := v_insert_values || ', case when $2 = ''nuzlocke'' then null else nullif(btrim($1 ->> ''regulation_id''), '''') end';
      when 'public_summary' then
        v_update_sql := v_update_sql || ', public_summary = case when $2 = ''nuzlocke'' then '''' else coalesce($1 ->> ''public_summary'', '''') end';
        v_insert_values := v_insert_values || ', case when $2 = ''nuzlocke'' then '''' else coalesce($1 ->> ''public_summary'', '''') end';
      when 'share_pokepaste' then
        v_update_sql := v_update_sql || ', share_pokepaste = case when $2 = ''nuzlocke'' then false else coalesce(($1 ->> ''share_pokepaste'')::boolean, false) end';
        v_insert_values := v_insert_values || ', case when $2 = ''nuzlocke'' then false else coalesce(($1 ->> ''share_pokepaste'')::boolean, false) end';
      when 'share_replica_code' then
        v_update_sql := v_update_sql || ', share_replica_code = case when $2 = ''nuzlocke'' then false else coalesce(($1 ->> ''share_replica_code'')::boolean, false) end';
        v_insert_values := v_insert_values || ', case when $2 = ''nuzlocke'' then false else coalesce(($1 ->> ''share_replica_code'')::boolean, false) end';
      when 'share_team_report' then
        v_update_sql := v_update_sql || ', share_team_report = case when $2 = ''nuzlocke'' then false else coalesce(($1 ->> ''share_team_report'')::boolean, false) end';
        v_insert_values := v_insert_values || ', case when $2 = ''nuzlocke'' then false else coalesce(($1 ->> ''share_team_report'')::boolean, false) end';
      when 'nuzlocke_run' then
        v_update_sql := v_update_sql || ', nuzlocke_run = case when $2 = ''nuzlocke'' then $1 -> ''nuzlocke_run'' else null end';
        v_insert_values := v_insert_values || ', case when $2 = ''nuzlocke'' then $1 -> ''nuzlocke_run'' else null end';
      else
        raise exception 'Unexpected personal team recovery column.';
    end case;
    v_insert_columns := v_insert_columns || ', ' || quote_ident(v_column_name);
  end loop;

  v_update_sql := v_update_sql || ', updated_at = now() where id = $3 and owner_id = auth.uid()';

  for v_team in select value from jsonb_array_elements(p_teams)
  loop
    v_id := (v_team ->> 'id')::uuid;
    v_workspace_type := case
      when (v_team ->> 'workspace_type') in ('tournament', 'nuzlocke') then v_team ->> 'workspace_type'
      else 'weekly'
    end;

    execute v_update_sql using v_team, v_workspace_type, v_id;
    get diagnostics v_updated = row_count;

    if v_updated = 0 then
      execute format(
        'insert into public.personal_teams (%s) values (%s)',
        v_insert_columns,
        v_insert_values
      ) using v_team, v_workspace_type, v_id;
    end if;
    v_restored := v_restored + 1;
  end loop;

  return v_restored;
end;
$function$;

CREATE OR REPLACE FUNCTION public.schedule_live_auction_draft(p_league_id uuid, p_starts_at timestamp with time zone, p_started_state jsonb, p_preparation_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_league_staff(p_league_id) then
    raise exception 'Only the commissioner can schedule this auction.';
  end if;
  if p_starts_at is null then
    raise exception 'Choose a scheduled draft time.';
  end if;
  if jsonb_typeof(p_started_state) <> 'object'
     or coalesce(p_started_state #>> '{settings,draftType}', '') <> 'auction'
     or coalesce((p_started_state ->> 'locked')::boolean, false) is not true
     or jsonb_array_length(coalesce(p_started_state -> 'teams', '[]'::jsonb)) < 2
     or jsonb_array_length(coalesce(p_started_state -> 'teams', '[]'::jsonb)) > public.league_team_limit(p_started_state -> 'settings')
     or jsonb_array_length(coalesce(p_started_state -> 'pool', '[]'::jsonb)) < 1 then
    raise exception 'Finish the auction setup before scheduling its automatic start.';
  end if;
  if nullif(btrim(coalesce(p_preparation_key, '')), '') is null then
    raise exception 'The scheduled auction configuration is missing its preparation key.';
  end if;

  insert into public.scheduled_auction_draft_jobs (
    league_id, starts_at, commissioner_id, started_state, preparation_key,
    status, last_error, updated_at
  )
  values (
    p_league_id, p_starts_at, auth.uid(), p_started_state, p_preparation_key,
    'scheduled', null, now()
  )
  on conflict (league_id) do update
  set starts_at = excluded.starts_at,
      commissioner_id = excluded.commissioner_id,
      started_state = excluded.started_state,
      preparation_key = excluded.preparation_key,
      status = 'scheduled',
      last_error = null,
      updated_at = now();

  update public.leagues
  set draft_starts_at = p_starts_at, updated_at = now()
  where id = p_league_id;

  return jsonb_build_object(
    'status', 'ready',
    'starts_at', p_starts_at,
    'preparation_key', p_preparation_key
  );
end;
$function$;

drop function if exists public.reset_current_weekly_claim_cycle(uuid);

commit;

notify pgrst, 'reload schema';
