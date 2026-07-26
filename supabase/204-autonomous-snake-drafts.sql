-- Hosted snake drafts must keep moving with every browser closed. This adds:
--   1. prepared scheduled starts, owned by the server clock; and
--   2. queue-first automatic picks when a live pick clock expires.

begin;

create table if not exists public.scheduled_snake_draft_jobs (
  league_id uuid primary key references public.leagues(id) on delete cascade,
  starts_at timestamptz not null,
  commissioner_id uuid not null references public.profiles(id) on delete cascade,
  teams jsonb not null,
  pokemon jsonb not null,
  pick_order integer[] not null,
  settings jsonb not null,
  keepers jsonb not null default '{}'::jsonb,
  started_state jsonb not null,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'starting', 'started', 'cancelled', 'failed')),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.scheduled_snake_draft_jobs enable row level security;
revoke all on table public.scheduled_snake_draft_jobs
  from public, anon, authenticated;

create or replace function public.schedule_live_snake_draft_v2(
  p_league_id uuid,
  p_starts_at timestamptz,
  p_teams jsonb,
  p_pokemon jsonb,
  p_pick_order integer[],
  p_settings jsonb,
  p_keepers jsonb,
  p_started_state jsonb
)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_league_staff(p_league_id) then
    raise exception 'Only the commissioner can schedule this draft.';
  end if;
  if p_starts_at is null then
    raise exception 'Choose a scheduled draft time.';
  end if;
  if coalesce(p_settings ->> 'draftType', 'snake') <> 'snake' then
    raise exception 'Automatic scheduled starts currently require a snake draft.';
  end if;
  if jsonb_typeof(p_teams) <> 'array'
     or jsonb_array_length(p_teams) < 2
     or jsonb_typeof(p_pokemon) <> 'array'
     or jsonb_array_length(p_pokemon) < 1
     or coalesce(array_length(p_pick_order, 1), 0) < 1
     or jsonb_typeof(p_started_state) <> 'object' then
    raise exception 'Finish the draft setup before scheduling its automatic start.';
  end if;
  if exists (
    select 1 from public.draft_sessions
    where league_id = p_league_id
      and status in ('active', 'paused', 'complete')
  ) then
    raise exception 'This league draft has already started.';
  end if;

  insert into public.scheduled_snake_draft_jobs (
    league_id, starts_at, commissioner_id, teams, pokemon, pick_order,
    settings, keepers, started_state, status, last_error, updated_at
  )
  values (
    p_league_id, p_starts_at, auth.uid(), p_teams, p_pokemon, p_pick_order,
    p_settings, coalesce(p_keepers, '{}'::jsonb), p_started_state,
    'scheduled', null, now()
  )
  on conflict (league_id) do update
  set starts_at = excluded.starts_at,
      commissioner_id = excluded.commissioner_id,
      teams = excluded.teams,
      pokemon = excluded.pokemon,
      pick_order = excluded.pick_order,
      settings = excluded.settings,
      keepers = excluded.keepers,
      started_state = excluded.started_state,
      status = 'scheduled',
      last_error = null,
      updated_at = now();

  return p_starts_at;
end;
$$;

create or replace function public.cancel_scheduled_snake_draft(
  p_league_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_league_staff(p_league_id) then
    raise exception 'Only the commissioner can cancel this scheduled draft.';
  end if;
  update public.scheduled_snake_draft_jobs
  set status = 'cancelled', updated_at = now()
  where league_id = p_league_id
    and status in ('scheduled', 'failed');
  return found;
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
  v_settings jsonb;
  v_result jsonb;
  v_claims text;
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

  -- Provision due drafts with the commissioner's identity solely so the
  -- existing, fully validated provisioning function can be reused.
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

      v_limit_minutes := greatest(
        0,
        coalesce((v_job.settings ->> 'pickTimeLimitMinutes')::integer, 0)
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
      v_failed := v_failed + 1;
    end;
  end loop;

  -- Resolve every expired hosted snake turn. Queue items are attempted in the
  -- owner's private order, then the shared draft-board order is used. The
  -- authoritative pick RPC remains the final legality/budget/race check.
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
        or coalesce(
          (
            snapshot.state #>> array[
              'teams',
              active_team.source_key,
              'autoDraft'
            ]
          )::boolean,
          false
        )
        or (
          greatest(
              0,
              coalesce((league.settings ->> 'pickTimeLimitMinutes')::integer, 0)
            ) > 0
          and session.updated_at
            + make_interval(mins => greatest(
              0,
              coalesce((league.settings ->> 'pickTimeLimitMinutes')::integer, 0)
            ))
            <= clock_timestamp()
        )
      )
    order by session.updated_at
    for update of session skip locked
  loop
    begin
      select snapshot.state, league.settings
      into v_state, v_settings
      from public.league_state_snapshots snapshot
      join public.leagues league on league.id = snapshot.league_id
      where snapshot.league_id = v_session.league_id
      for update of snapshot;

      if coalesce((v_state ->> 'paused')::boolean, false) then
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
            -- The next queue/board option may still be legal and affordable.
            null;
          end;
      end loop;

      if not v_picked then
        -- Use the commissioner identity for the validated skip/complete path.
        select league.created_by into v_owner_id
        from public.leagues league
        where league.id = v_session.league_id;
        perform set_config(
          'request.jwt.claims',
          json_build_object('sub', v_owner_id::text, 'role', 'authenticated')::text,
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
          'resolution', case when v_picked then 'automatic_pick' else 'advanced' end
        )
      );
    exception when others then
      v_failed := v_failed + 1;
    end;
  end loop;

  perform set_config('request.jwt.claims', '{}'::text, true);
  return jsonb_build_object(
    'started', v_started,
    'automatic_picks', v_picked_count,
    'advanced', v_advanced,
    'failed', v_failed
  );
end;
$$;

revoke all on function public.schedule_live_snake_draft_v2(
  uuid, timestamptz, jsonb, jsonb, integer[], jsonb, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.schedule_live_snake_draft_v2(
  uuid, timestamptz, jsonb, jsonb, integer[], jsonb, jsonb, jsonb
) to authenticated;

revoke all on function public.cancel_scheduled_snake_draft(uuid)
  from public, anon, authenticated;
grant execute on function public.cancel_scheduled_snake_draft(uuid)
  to authenticated;

revoke all on function public.reconcile_autonomous_snake_drafts()
  from public, anon, authenticated;
grant execute on function public.reconcile_autonomous_snake_drafts()
  to service_role;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid)
    from cron.job
    where jobname = 'draftcenter-autonomous-snake-drafts';
    perform cron.schedule(
      'draftcenter-autonomous-snake-drafts',
      '* * * * *',
      'select public.reconcile_autonomous_snake_drafts()'
    );
  else
    raise notice 'Enable pg_cron, then run reconcile_autonomous_snake_drafts every minute.';
  end if;
end
$$;

commit;

notify pgrst, 'reload schema';
