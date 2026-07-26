-- Keep hosted snake drafts moving at the exact visible deadline while the
-- once-per-minute pg_cron job remains the browser-free source of autonomy.
--
-- This migration:
--   1. safely parses legacy timer values so one malformed league cannot abort
--      reconciliation for every active draft;
--   2. records per-league resolution failures instead of silently swallowing
--      them;
--   3. gives an authenticated league member a narrow, due-time-only RPC that
--      asks the same server reconciler to run when an open page reaches zero;
--   4. gives a skipped turn a fresh visible deadline.

begin;

create or replace function public.draft_setting_nonnegative_integer(
  p_settings jsonb,
  p_key text,
  p_default integer default 0
)
returns integer
language plpgsql
immutable
set search_path = public
as $$
declare
  v_raw text := nullif(btrim(coalesce(p_settings ->> p_key, '')), '');
  v_value bigint;
begin
  if v_raw is null or v_raw !~ '^[0-9]+$' then
    return greatest(0, coalesce(p_default, 0));
  end if;
  v_value := v_raw::bigint;
  return greatest(0, least(v_value, 525600))::integer;
exception when others then
  return greatest(0, coalesce(p_default, 0));
end;
$$;

revoke all on function public.draft_setting_nonnegative_integer(
  jsonb, text, integer
) from public, anon, authenticated;
grant execute on function public.draft_setting_nonnegative_integer(
  jsonb, text, integer
) to service_role;

create or replace function public.advance_live_snake_turn(p_league_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.draft_sessions;
  v_state jsonb;
  v_settings jsonb;
  v_order jsonb;
  v_total integer;
  v_scan integer;
  v_candidate uuid;
  v_next_team uuid;
  v_roster_max integer;
  v_roster_count integer;
  v_budget_enabled boolean;
  v_budget numeric;
  v_spent numeric;
  v_can_pick boolean;
  v_limit_minutes integer;
  v_now_ms bigint;
begin
  if not public.is_league_staff(p_league_id) then
    raise exception 'Only league commissioners can advance an expired turn.';
  end if;

  select *
  into v_session
  from public.draft_sessions
  where league_id = p_league_id
    and mode = 'snake'
    and status = 'active'
  for update;
  if v_session.id is null then
    raise exception 'No active live snake draft was found.';
  end if;

  select snapshot.state, league.settings
  into v_state, v_settings
  from public.league_state_snapshots snapshot
  join public.leagues league on league.id = snapshot.league_id
  where snapshot.league_id = p_league_id
  for update of snapshot;
  if v_state is null then
    raise exception 'League state was not found.';
  end if;

  v_order := coalesce(v_session.configuration -> 'team_order', '[]'::jsonb);
  v_total := jsonb_array_length(v_order);
  v_scan := v_session.current_pick_number + 1;
  v_roster_max := greatest(
    1,
    public.draft_setting_nonnegative_integer(v_settings, 'rosterMax', 1)
  );
  v_budget_enabled := lower(coalesce(v_settings ->> 'snakeBudgetEnabled', 'false'))
    in ('true', 't', '1', 'yes', 'on');
  v_budget := greatest(
    0,
    case
      when nullif(btrim(coalesce(v_settings ->> 'budget', '')), '')
        ~ '^[0-9]+([.][0-9]+)?$'
        then (v_settings ->> 'budget')::numeric
      else 0
    end
  );
  v_limit_minutes := public.draft_setting_nonnegative_integer(
    v_settings,
    'pickTimeLimitMinutes',
    0
  );
  v_now_ms := floor(extract(epoch from clock_timestamp()) * 1000)::bigint;

  while v_scan < v_total
  loop
    v_candidate := (v_order ->> v_scan)::uuid;
    select count(*)
    into v_roster_count
    from public.roster_entries
    where team_id = v_candidate
      and released_at is null;
    v_can_pick := v_roster_count < v_roster_max;

    if v_can_pick and v_budget_enabled then
      select coalesce(sum(pokemon.cost), 0)
      into v_spent
      from public.roster_entries entry
      join public.league_pokemon pokemon
        on pokemon.id = entry.league_pokemon_id
      where entry.team_id = v_candidate
        and entry.released_at is null;
      v_can_pick := exists (
        select 1
        from public.league_pokemon pokemon
        where pokemon.league_id = p_league_id
          and pokemon.is_allowed
          and not pokemon.is_drafted
          and coalesce(pokemon.cost, 0) <= v_budget - v_spent
      );
    end if;

    if v_can_pick then
      v_next_team := v_candidate;
      exit;
    end if;
    v_scan := v_scan + 1;
  end loop;

  if v_next_team is null then
    update public.draft_sessions
    set status = 'complete',
        current_pick_number = v_total,
        current_team_id = null,
        updated_at = clock_timestamp()
    where id = v_session.id;
  else
    update public.draft_sessions
    set current_pick_number = v_scan,
        current_team_id = v_next_team,
        updated_at = clock_timestamp()
    where id = v_session.id;
  end if;

  v_state := jsonb_set(v_state, '{pickIndex}', to_jsonb(v_scan), true);
  v_state := jsonb_set(
    v_state,
    '{pickDeadline}',
    case
      when v_next_team is null or v_limit_minutes <= 0
        then 'null'::jsonb
      else to_jsonb(v_now_ms + v_limit_minutes::bigint * 60000)
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
    'draft_turn_advanced',
    auth.uid(),
    jsonb_build_object(
      'next_pick_number', v_scan,
      'next_deadline', case
        when v_next_team is null or v_limit_minutes <= 0 then null
        else v_now_ms + v_limit_minutes::bigint * 60000
      end
    )
  );

  return v_state;
end;
$$;

create or replace function public.reconcile_autonomous_snake_drafts()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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
$$;

create or replace function public.request_due_snake_turn_resolution(
  p_league_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.draft_sessions;
  v_settings jsonb;
  v_state jsonb;
  v_owner_membership uuid;
  v_auto_draft boolean;
  v_limit_minutes integer;
  v_due_at timestamptz;
  v_result jsonb;
begin
  if not public.is_league_member(p_league_id) then
    raise exception 'You do not have access to that league.';
  end if;

  select session.*
  into v_session
  from public.draft_sessions session
  where session.league_id = p_league_id
    and session.mode = 'snake'
    and session.status = 'active';

  if v_session.id is null then
    return jsonb_build_object('status', 'no_active_draft');
  end if;

  select
    league.settings,
    snapshot.state,
    active_team.owner_membership_id
  into
    v_settings,
    v_state,
    v_owner_membership
  from public.leagues league
  join public.league_state_snapshots snapshot
    on snapshot.league_id = league.id
  join public.teams active_team on active_team.id = v_session.current_team_id
  where league.id = v_session.league_id;

  if lower(coalesce(v_state ->> 'paused', 'false'))
    in ('true', 't', '1', 'yes', 'on') then
    return jsonb_build_object('status', 'paused');
  end if;

  v_limit_minutes := public.draft_setting_nonnegative_integer(
    v_settings,
    'pickTimeLimitMinutes',
    0
  );
  v_due_at := case
    when v_limit_minutes > 0
      then v_session.updated_at + make_interval(mins => v_limit_minutes)
    else null
  end;
  v_auto_draft := lower(coalesce(
    v_state #>> array[
      'teams',
      (
        select team.source_key
        from public.teams team
        where team.id = v_session.current_team_id
      ),
      'autoDraft'
    ],
    'false'
  )) in ('true', 't', '1', 'yes', 'on');

  if v_owner_membership is not null
     and not v_auto_draft
     and (v_due_at is null or v_due_at > clock_timestamp()) then
    return jsonb_build_object(
      'status', 'waiting',
      'due_at', v_due_at,
      'pick_number', v_session.current_pick_number
    );
  end if;

  if exists (
    select 1
    from public.league_events event
    where event.league_id = p_league_id
      and event.kind = 'draft_clock_resolution_requested'
      and event.created_at >= clock_timestamp() - interval '5 seconds'
  ) then
    return jsonb_build_object(
      'status', 'processing',
      'pick_number', v_session.current_pick_number
    );
  end if;

  insert into public.league_events (league_id, kind, actor_id, payload)
  values (
    p_league_id,
    'draft_clock_resolution_requested',
    auth.uid(),
    jsonb_build_object(
      'pick_number', v_session.current_pick_number,
      'due_at', v_due_at
    )
  );

  v_result := public.reconcile_autonomous_snake_drafts();
  return coalesce(v_result, '{}'::jsonb) || jsonb_build_object(
    'status', 'processed',
    'requested_league_id', p_league_id
  );
end;
$$;

revoke all on function public.advance_live_snake_turn(uuid)
  from public, anon, authenticated;
grant execute on function public.advance_live_snake_turn(uuid)
  to authenticated;

revoke all on function public.reconcile_autonomous_snake_drafts()
  from public, anon, authenticated;
grant execute on function public.reconcile_autonomous_snake_drafts()
  to service_role;

revoke all on function public.request_due_snake_turn_resolution(uuid)
  from public, anon, authenticated;
grant execute on function public.request_due_snake_turn_resolution(uuid)
  to authenticated;

commit;

notify pgrst, 'reload schema';
