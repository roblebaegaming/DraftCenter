-- Process scheduled waiver and FAAB claims from the database clock. The
-- previous implementation depended on a commissioner keeping DraftCenter
-- open, and it trusted a browser-computed winning state. This migration makes
-- claim timing, winner selection, budgets, limits, rosters, and audit records
-- atomic and server-authoritative.

begin;

create or replace function public.snapshot_operational_week(
  p_state jsonb,
  p_at timestamptz default clock_timestamp()
)
returns integer
language plpgsql
stable
set search_path = public
as $$
declare
  v_week integer;
  v_start timestamptz;
begin
  v_week := greatest(0, coalesce((p_state ->> 'week')::integer, 0));
  if coalesce(p_state #>> '{settings,calendarMode}', '') <> 'weekly'
     or nullif(p_state #>> '{settings,seasonStartsAt}', '') is null then
    return v_week;
  end if;

  begin
    v_start := (p_state #>> '{settings,seasonStartsAt}')::timestamptz;
    return greatest(
      0,
      floor(extract(epoch from (p_at - v_start)) / 604800)::integer
    );
  exception when others then
    return v_week;
  end;
end;
$$;

create or replace function public.snapshot_team_record_score(
  p_state jsonb,
  p_team_index integer
)
returns integer
language sql
immutable
set search_path = public
as $$
  select coalesce(
    sum(
      case
        when coalesce((match.value ->> 0)::integer, -1) = p_team_index then
          case
            when coalesce((result.value ->> 'gamesA')::integer, 0)
               > coalesce((result.value ->> 'gamesB')::integer, 0) then 1
            when coalesce((result.value ->> 'gamesB')::integer, 0)
               > coalesce((result.value ->> 'gamesA')::integer, 0) then -1
            else 0
          end
        when coalesce((match.value ->> 1)::integer, -1) = p_team_index then
          case
            when coalesce((result.value ->> 'gamesB')::integer, 0)
               > coalesce((result.value ->> 'gamesA')::integer, 0) then 1
            when coalesce((result.value ->> 'gamesA')::integer, 0)
               > coalesce((result.value ->> 'gamesB')::integer, 0) then -1
            else 0
          end
        else 0
      end
    ),
    0
  )::integer
  from jsonb_array_elements(
    case
      when jsonb_typeof(p_state -> 'schedule') = 'array'
      then p_state -> 'schedule'
      else '[]'::jsonb
    end
  ) with ordinality week(value, ordinality)
  cross join lateral jsonb_array_elements(
    case
      when jsonb_typeof(week.value) = 'array' then week.value
      else '[]'::jsonb
    end
  ) with ordinality match(value, ordinality)
  cross join lateral (
    select p_state #> array[
      'matchResults',
      (week.ordinality - 1)::text || '-' || (match.ordinality - 1)::text
    ] as value
  ) result
  where jsonb_typeof(result.value) = 'object'
    and p_team_index in (
      coalesce((match.value ->> 0)::integer, -1),
      coalesce((match.value ->> 1)::integer, -1)
    );
$$;

create or replace function public.league_claim_due_context(
  p_state jsonb,
  p_at timestamptz default clock_timestamp()
)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_settings jsonb := coalesce(p_state -> 'settings', '{}'::jsonb);
  v_zone text;
  v_local_at timestamp without time zone;
  v_claim_time time without time zone;
  v_claim_day integer;
  v_cycle text;
  v_due_at timestamptz;
  v_season_start timestamptz;
begin
  if coalesce(v_settings ->> 'calendarMode', '') <> 'weekly'
     or coalesce(v_settings ->> 'autoProcessClaims', 'false') <> 'true'
     or coalesce(v_settings ->> 'faClaimMode', 'instant') = 'instant'
     or not public.snapshot_draft_is_complete(p_state) then
    return null;
  end if;

  if nullif(v_settings ->> 'seasonStartsAt', '') is not null then
    begin
      v_season_start := (v_settings ->> 'seasonStartsAt')::timestamptz;
      if p_at < v_season_start then
        return null;
      end if;
    exception when others then
      return null;
    end;
  end if;

  v_zone := coalesce(nullif(btrim(v_settings ->> 'leagueTimeZone'), ''), 'UTC');
  if not exists (
    select 1 from pg_timezone_names where name = v_zone
  ) then
    return null;
  end if;

  v_claim_day := case
    when coalesce(v_settings ->> 'claimDayOfWeek', '') ~ '^[0-6]$'
    then (v_settings ->> 'claimDayOfWeek')::integer
    else 3
  end;
  begin
    v_claim_time := coalesce(
      nullif(v_settings ->> 'claimTime', '')::time,
      time '20:00'
    );
  exception when others then
    return null;
  end;

  v_local_at := timezone(v_zone, p_at);
  if extract(dow from v_local_at)::integer <> v_claim_day
     or v_local_at::time < v_claim_time then
    return null;
  end if;

  v_cycle := to_char(v_local_at::date, 'YYYY-MM-DD');
  if coalesce(p_state ->> 'lastAutoClaimCycle', '') = v_cycle then
    return null;
  end if;

  v_due_at := (v_local_at::date + v_claim_time) at time zone v_zone;
  return jsonb_build_object(
    'cycle', v_cycle,
    'due_at', v_due_at,
    'time_zone', v_zone
  );
end;
$$;

-- Keep the browser-supplied Pokemon payload out of the trust boundary. The
-- name is validated by migration 091, then the private claim stores the
-- canonical Pokemon object from the locked server snapshot.
create or replace function public.submit_private_free_agent_claim(
  p_league_id uuid,
  p_team_index integer,
  p_add_name text,
  p_add_mon jsonb,
  p_drop_name text default null,
  p_bid_amount integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
  v_claim jsonb;
  v_canonical_mon jsonb;
  v_claim_id uuid;
begin
  v_result := public.mutate_league_transaction(
    p_league_id,
    'claim_submit',
    jsonb_build_object(
      'team_index', p_team_index,
      'add_name', p_add_name,
      'add_mon', p_add_mon,
      'drop_name', p_drop_name,
      'bid_amount', p_bid_amount
    )
  );

  select value
  into v_claim
  from jsonb_array_elements(coalesce(v_result -> 'pendingClaims', '[]'::jsonb))
  where (value ->> 'teamIdx')::integer = p_team_index
    and lower(value ->> 'addName') = lower(btrim(p_add_name))
  order by (value ->> 'submittedAt')::bigint desc
  limit 1;
  if v_claim is null then
    raise exception 'The claim could not be created.';
  end if;

  select mon.value
  into v_canonical_mon
  from jsonb_array_elements(
    case
      when jsonb_typeof(v_result -> 'pool') = 'array'
      then v_result -> 'pool'
      else '[]'::jsonb
    end
  ) mon(value)
  where lower(coalesce(mon.value ->> 'name', ''))
    = lower(v_claim ->> 'addName')
  limit 1;
  if v_canonical_mon is null
     and jsonb_typeof(v_result #> '{liveDraft,basePool}') = 'array' then
    select mon.value
    into v_canonical_mon
    from jsonb_array_elements(v_result #> '{liveDraft,basePool}') mon(value)
    where lower(coalesce(mon.value ->> 'name', ''))
      = lower(v_claim ->> 'addName')
    limit 1;
  end if;
  if v_canonical_mon is null then
    raise exception 'That Pokemon is not in this league''s verified free-agent pool.';
  end if;

  v_claim_id := gen_random_uuid();
  insert into public.league_free_agent_claims(
    id, league_id, team_index, add_name, add_mon, drop_name, bid_amount,
    week, submitted_at, submitted_by
  ) values (
    v_claim_id,
    p_league_id,
    p_team_index,
    v_claim ->> 'addName',
    v_canonical_mon,
    nullif(v_claim ->> 'dropName', ''),
    nullif(v_claim ->> 'bidAmount', '')::integer,
    greatest(0, coalesce((v_claim ->> 'week')::integer, 0)),
    to_timestamp((v_claim ->> 'submittedAt')::double precision / 1000.0),
    auth.uid()
  );

  v_result := jsonb_set(v_result, '{pendingClaims}', '[]'::jsonb, true);
  update public.league_state_snapshots
  set state = v_result
  where league_id = p_league_id;

  return jsonb_build_object('state', v_result, 'claim_id', v_claim_id);
end;
$$;

create or replace function public.process_private_free_agent_claims_internal(
  p_league_id uuid,
  p_cycle text default null,
  p_cutoff timestamptz default null,
  p_actor_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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
    select lower(add_name) as add_key, min(submitted_at) as first_submitted
    from public.league_free_agent_claims
    where league_id = p_league_id
      and (p_cutoff is null or submitted_at <= p_cutoff)
    group by lower(add_name)
    order by min(submitted_at), lower(add_name)
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
$$;

create or replace function public.process_private_free_agent_claims(
  p_league_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_league_staff(p_league_id) then
    raise exception 'Only a commissioner can process pending claims.';
  end if;
  return public.process_private_free_agent_claims_internal(
    p_league_id,
    null,
    null,
    auth.uid()
  );
end;
$$;

-- Keep the old browser RPC safe during the deployment window. Its
-- browser-computed state is deliberately ignored; the server recomputes every
-- outcome while holding the league lock.
create or replace function public.finalize_private_free_agent_claims(
  p_league_id uuid,
  p_state jsonb,
  p_claim_ids jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expected_ids text[];
  v_actual_ids text[];
begin
  if auth.uid() is null or not public.is_league_staff(p_league_id) then
    raise exception 'Only a commissioner can process pending claims.';
  end if;
  if jsonb_typeof(coalesce(p_claim_ids, 'null'::jsonb)) <> 'array' then
    raise exception 'The claim-processing request is invalid.';
  end if;

  perform 1
  from public.league_state_snapshots
  where league_id = p_league_id
  for update;
  select coalesce(array_agg(value order by value), array[]::text[])
  into v_expected_ids
  from jsonb_array_elements_text(p_claim_ids);
  select coalesce(array_agg(id::text order by id::text), array[]::text[])
  into v_actual_ids
  from public.league_free_agent_claims
  where league_id = p_league_id;
  if v_expected_ids is distinct from v_actual_ids then
    raise exception 'Pending claims changed while processing. Reload and try again.';
  end if;

  return public.process_private_free_agent_claims_internal(
    p_league_id,
    null,
    null,
    auth.uid()
  );
end;
$$;

create or replace function public.reconcile_autonomous_league_claims()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_snapshot record;
  v_context jsonb;
  v_checked integer := 0;
  v_processed integer := 0;
  v_failed integer := 0;
begin
  for v_snapshot in
    select league_id, state
    from public.league_state_snapshots
    where coalesce(state #>> '{settings,calendarMode}', '') = 'weekly'
      and coalesce(state #>> '{settings,autoProcessClaims}', 'false') = 'true'
      and coalesce(state #>> '{settings,faClaimMode}', 'instant') <> 'instant'
  loop
    v_checked := v_checked + 1;
    begin
      v_context := public.league_claim_due_context(
        v_snapshot.state,
        clock_timestamp()
      );
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
$$;

revoke all on function public.snapshot_operational_week(jsonb, timestamptz)
  from public, anon, authenticated;
revoke all on function public.snapshot_team_record_score(jsonb, integer)
  from public, anon, authenticated;
revoke all on function public.league_claim_due_context(jsonb, timestamptz)
  from public, anon, authenticated;
revoke all on function public.submit_private_free_agent_claim(
  uuid, integer, text, jsonb, text, integer
) from public, anon, authenticated;
revoke all on function public.process_private_free_agent_claims_internal(
  uuid, text, timestamptz, uuid
) from public, anon, authenticated;
revoke all on function public.process_private_free_agent_claims(uuid)
  from public, anon, authenticated;
revoke all on function public.finalize_private_free_agent_claims(
  uuid, jsonb, jsonb
) from public, anon, authenticated;
revoke all on function public.reconcile_autonomous_league_claims()
  from public, anon, authenticated;

grant execute on function public.process_private_free_agent_claims(uuid)
  to authenticated;
grant execute on function public.submit_private_free_agent_claim(
  uuid, integer, text, jsonb, text, integer
) to authenticated;
grant execute on function public.finalize_private_free_agent_claims(
  uuid, jsonb, jsonb
) to authenticated;
grant execute on function public.reconcile_autonomous_league_claims()
  to service_role;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid)
    from cron.job
    where jobname = 'draftcenter-autonomous-league-claims';
    perform cron.schedule(
      'draftcenter-autonomous-league-claims',
      '* * * * *',
      'select public.reconcile_autonomous_league_claims()'
    );
  else
    raise notice 'Enable pg_cron, then run reconcile_autonomous_league_claims every minute.';
  end if;
end
$$;

commit;

notify pgrst, 'reload schema';
