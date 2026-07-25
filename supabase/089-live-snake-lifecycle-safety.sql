-- Atomic hosted snake-draft start, keeper support, and authoritative clock controls.

begin;

alter table public.league_pokemon
  add column if not exists is_restricted boolean not null default false;
alter table public.league_pokemon
  add column if not exists is_mega boolean not null default false;

create or replace function public.provision_live_snake_draft_v2(
  p_league_id uuid,
  p_teams jsonb,
  p_pokemon jsonb,
  p_pick_order integer[],
  p_settings jsonb,
  p_keepers jsonb,
  p_started_state jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_state jsonb;
  v_state jsonb;
  v_session_id uuid;
  v_team record;
  v_pokemon jsonb;
  v_keeper jsonb;
  v_team_id uuid;
  v_team_ids uuid[] := array[]::uuid[];
  v_order_ids uuid[];
  v_source_key text;
  v_owner_name text;
  v_owner_id uuid;
  v_membership_id uuid;
  v_league_pokemon_id uuid;
  v_team_count integer;
  v_team_index integer;
  v_target integer;
  v_keeper_count integer;
  v_pokemon_ids jsonb;
  v_now_ms bigint := floor(extract(epoch from clock_timestamp()) * 1000)::bigint;
begin
  if not public.is_league_staff(p_league_id) then
    raise exception 'Only league commissioners can start a live draft.';
  end if;
  if jsonb_typeof(p_teams) <> 'array'
     or jsonb_typeof(p_pokemon) <> 'array'
     or jsonb_typeof(coalesce(p_keepers, '{}'::jsonb)) <> 'object'
     or jsonb_typeof(p_started_state) <> 'object' then
    raise exception 'The saved draft setup is incomplete. Refresh Setup and try again.';
  end if;

  v_team_count := jsonb_array_length(p_teams);
  if v_team_count < 2 or v_team_count > 16 then
    raise exception 'A live draft needs between 2 and 16 teams.';
  end if;
  if jsonb_array_length(p_pokemon) = 0 then
    raise exception 'No eligible Pokemon were supplied.';
  end if;
  if coalesce(array_length(p_pick_order, 1), 0) < 1
     or coalesce(array_length(p_pick_order, 1), 0) > 480
     or exists (
       select 1
       from unnest(p_pick_order) item
       where item < 0 or item >= v_team_count
     ) then
    raise exception 'The draft order could not be built. Refresh Setup and try again.';
  end if;
  if exists (
    select 1
    from public.draft_sessions
    where league_id = p_league_id
      and status in ('active', 'paused', 'complete')
  ) then
    raise exception 'This league already has a live draft. Do not provision it again.';
  end if;

  select state
  into v_existing_state
  from public.league_state_snapshots
  where league_id = p_league_id
  for update;
  if v_existing_state is null then
    raise exception 'League setup was not found.';
  end if;
  if coalesce((v_existing_state ->> 'locked')::boolean, false) then
    raise exception 'This league draft has already started.';
  end if;

  delete from public.roster_entries
  where team_id in (
    select id from public.teams where league_id = p_league_id
  );
  delete from public.league_pokemon where league_id = p_league_id;
  delete from public.teams where league_id = p_league_id;

  for v_team in
    select value as team, ordinality - 1 as team_index
    from jsonb_array_elements(p_teams) with ordinality
  loop
    v_source_key := v_team.team_index::text;
    insert into public.teams (
      league_id,
      source_key,
      name,
      color,
      logo_url,
      description
    )
    values (
      p_league_id,
      v_source_key,
      coalesce(
        nullif(btrim(v_team.team ->> 'name'), ''),
        'Team ' || (v_team.team_index + 1)
      ),
      nullif(v_team.team ->> 'color', ''),
      nullif(v_team.team ->> 'logoUrl', ''),
      coalesce(v_team.team ->> 'description', '')
    )
    returning id into v_team_id;
    v_team_ids := array_append(v_team_ids, v_team_id);

    v_owner_name := nullif(btrim(v_team.team ->> 'claimedBy'), '');
    if v_owner_name is not null then
      select id
      into v_owner_id
      from public.profiles
      where lower(coalesce(username, '')) = lower(v_owner_name)
         or lower(coalesce(display_name, '')) = lower(v_owner_name)
      order by case
        when lower(coalesce(username, '')) = lower(v_owner_name) then 0
        else 1
      end
      limit 1;

      if v_owner_id is not null then
        insert into public.league_memberships (league_id, user_id, role)
        values (p_league_id, v_owner_id, 'coach')
        on conflict (league_id, user_id) do update
        set role = case
          when public.league_memberships.role = 'viewer' then 'coach'
          else public.league_memberships.role
        end
        returning id into v_membership_id;

        update public.teams
        set owner_membership_id = v_membership_id
        where id = v_team_id;
      end if;
    end if;
    v_owner_id := null;
    v_membership_id := null;
  end loop;

  for v_pokemon in
    select value from jsonb_array_elements(p_pokemon)
  loop
    v_source_key := nullif(v_pokemon ->> 'id', '');
    if v_source_key is null then
      raise exception 'Every Pokemon needs a stable source ID.';
    end if;
    if exists (
      select 1
      from public.league_pokemon
      where league_id = p_league_id
        and source_key = v_source_key
    ) then
      raise exception 'Every Pokemon must have a unique source ID.';
    end if;

    insert into public.pokemon_catalogue (
      id,
      display_name,
      primary_type,
      secondary_type,
      base_stat_total,
      sprite_url
    )
    values (
      v_source_key,
      coalesce(v_pokemon ->> 'name', v_source_key),
      coalesce(v_pokemon ->> 't1', 'normal'),
      nullif(v_pokemon ->> 't2', ''),
      nullif(v_pokemon ->> 'bst', '')::smallint,
      nullif(v_pokemon ->> 'spriteUrl', '')
    )
    on conflict (id) do update
    set display_name = excluded.display_name,
        primary_type = excluded.primary_type,
        secondary_type = excluded.secondary_type,
        base_stat_total = excluded.base_stat_total,
        sprite_url = coalesce(
          excluded.sprite_url,
          public.pokemon_catalogue.sprite_url
        );

    insert into public.league_pokemon (
      league_id,
      pokemon_id,
      source_key,
      cost,
      is_allowed,
      is_drafted,
      is_restricted,
      is_mega
    )
    values (
      p_league_id,
      v_source_key,
      v_source_key,
      greatest(0, coalesce(nullif(v_pokemon ->> 'cost', '')::numeric, 0)),
      true,
      false,
      coalesce((v_pokemon ->> 'isRestricted')::boolean, false),
      coalesce((v_pokemon ->> 'isMega')::boolean, false)
    );
  end loop;

  v_target := greatest(
    1,
    case
      when coalesce((p_settings ->> 'snakeBudgetEnabled')::boolean, false)
        then coalesce((p_settings ->> 'rosterMax')::integer, 1)
      else coalesce((p_settings ->> 'rosterSize')::integer, 1)
    end
  );

  for v_team_index in 0..v_team_count - 1
  loop
    if jsonb_typeof(coalesce(p_keepers -> v_team_index::text, '[]'::jsonb)) <> 'array' then
      raise exception 'The keeper list for Team % is invalid.', v_team_index + 1;
    end if;
    v_keeper_count := jsonb_array_length(
      coalesce(p_keepers -> v_team_index::text, '[]'::jsonb)
    );
    if v_keeper_count > v_target then
      raise exception 'Team % has more keepers than roster slots.', v_team_index + 1;
    end if;

    for v_keeper in
      select value
      from jsonb_array_elements(
        coalesce(p_keepers -> v_team_index::text, '[]'::jsonb)
      )
    loop
      v_source_key := nullif(v_keeper ->> 'id', '');
      if v_source_key is null then
        raise exception 'Every keeper needs a stable source ID.';
      end if;

      update public.league_pokemon
      set is_drafted = true,
          cost = greatest(
            0,
            coalesce(nullif(v_keeper ->> 'cost', '')::numeric, cost)
          )
      where league_id = p_league_id
        and source_key = v_source_key
        and is_allowed
        and not is_drafted
      returning id into v_league_pokemon_id;

      if v_league_pokemon_id is null then
        raise exception 'A keeper is no longer legal or appears on more than one team.';
      end if;

      insert into public.roster_entries (
        team_id,
        league_pokemon_id,
        acquisition_type
      )
      values (
        v_team_ids[v_team_index + 1],
        v_league_pokemon_id,
        'draft'
      );
      v_league_pokemon_id := null;
    end loop;
  end loop;

  select array_agg(
    v_team_ids[pick.item + 1]
    order by pick.ordinality
  )
  into v_order_ids
  from unnest(p_pick_order) with ordinality as pick(item, ordinality);
  if coalesce(array_length(v_order_ids, 1), 0)
     <> coalesce(array_length(p_pick_order, 1), 0)
     or exists (select 1 from unnest(v_order_ids) id where id is null) then
    raise exception 'The draft order could not be built. Refresh Setup and try again.';
  end if;

  insert into public.draft_sessions (
    league_id,
    mode,
    status,
    current_pick_number,
    current_team_id,
    configuration
  )
  values (
    p_league_id,
    'snake',
    'active',
    0,
    v_order_ids[1],
    jsonb_build_object('team_order', to_jsonb(v_order_ids))
  )
  returning id into v_session_id;

  update public.leagues
  set settings = coalesce(settings, '{}'::jsonb)
      || coalesce(p_settings, '{}'::jsonb)
      || jsonb_build_object('rosterMax', v_target),
      status = 'drafting',
      updated_at = now()
  where id = p_league_id;

  select coalesce(jsonb_object_agg(source_key, id), '{}'::jsonb)
  into v_pokemon_ids
  from public.league_pokemon
  where league_id = p_league_id;

  v_state := p_started_state;
  v_state := jsonb_set(
    v_state,
    '{liveDraft,sessionId}',
    to_jsonb(v_session_id),
    true
  );
  v_state := jsonb_set(
    v_state,
    '{liveDraft,pokemonIds}',
    v_pokemon_ids,
    true
  );
  v_state := jsonb_set(v_state, '{locked}', 'true'::jsonb, true);
  v_state := jsonb_set(
    v_state,
    '{draftStartedAt}',
    to_jsonb(v_now_ms),
    true
  );
  v_state := jsonb_set(
    v_state,
    '{rev}',
    to_jsonb(coalesce((v_existing_state ->> 'rev')::bigint, 0) + 1),
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
    'draft_started',
    auth.uid(),
    jsonb_build_object(
      'draft_session_id',
      v_session_id,
      'keeper_count',
      (
        select count(*)
        from public.roster_entries entry
        join public.teams team on team.id = entry.team_id
        where team.league_id = p_league_id
          and entry.released_at is null
      )
    )
  );

  return jsonb_build_object(
    'state',
    v_state,
    'draft_session_id',
    v_session_id,
    'pokemon_ids',
    v_pokemon_ids
  );
end;
$$;

create or replace function public.set_live_snake_draft_paused(
  p_league_id uuid,
  p_paused boolean,
  p_overnight boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.draft_sessions;
  v_state jsonb;
  v_now_ms bigint := floor(extract(epoch from clock_timestamp()) * 1000)::bigint;
  v_pause_started_ms bigint;
  v_pause_duration_ms bigint;
begin
  if not public.is_league_staff(p_league_id) then
    raise exception 'Only league commissioners can pause or resume the draft.';
  end if;

  select *
  into v_session
  from public.draft_sessions
  where league_id = p_league_id
    and mode = 'snake'
    and status in ('active', 'paused')
  for update;
  if v_session.id is null then
    raise exception 'No active live snake draft was found.';
  end if;

  select state
  into v_state
  from public.league_state_snapshots
  where league_id = p_league_id
  for update;
  if v_state is null then
    raise exception 'League state was not found.';
  end if;

  if p_paused and v_session.status = 'active' then
    update public.draft_sessions
    set status = 'paused',
        configuration = jsonb_set(
          jsonb_set(
            coalesce(configuration, '{}'::jsonb),
            '{pause_started_at}',
            to_jsonb(v_now_ms),
            true
          ),
          '{pause_is_overnight}',
          to_jsonb(coalesce(p_overnight, false)),
          true
        )
    where id = v_session.id;

    v_state := jsonb_set(v_state, '{paused}', 'true'::jsonb, true);
    v_state := jsonb_set(v_state, '{pausedAt}', to_jsonb(v_now_ms), true);
    v_state := jsonb_set(
      v_state,
      '{pauseIsOvernight}',
      to_jsonb(coalesce(p_overnight, false)),
      true
    );
  elsif not p_paused and v_session.status = 'paused' then
    v_pause_started_ms := coalesce(
      (v_session.configuration ->> 'pause_started_at')::bigint,
      v_now_ms
    );
    v_pause_duration_ms := greatest(0, v_now_ms - v_pause_started_ms);

    update public.draft_sessions
    set status = 'active',
        updated_at = updated_at
          + make_interval(secs => v_pause_duration_ms::double precision / 1000.0),
        configuration = coalesce(configuration, '{}'::jsonb)
          - array['pause_started_at', 'pause_is_overnight']
    where id = v_session.id;

    v_state := jsonb_set(v_state, '{paused}', 'false'::jsonb, true);
    v_state := jsonb_set(v_state, '{pausedAt}', 'null'::jsonb, true);
    v_state := jsonb_set(v_state, '{pauseIsOvernight}', 'false'::jsonb, true);
  else
    return v_state;
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
  values (
    p_league_id,
    case when p_paused then 'draft_paused' else 'draft_resumed' end,
    auth.uid(),
    jsonb_build_object('overnight', coalesce(p_overnight, false))
  );

  return v_state;
end;
$$;

create or replace function public.advance_live_snake_turn(p_league_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.draft_sessions;
  v_state jsonb;
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

  select state
  into v_state
  from public.league_state_snapshots
  where league_id = p_league_id
  for update;
  if v_state is null then
    raise exception 'League state was not found.';
  end if;

  v_order := coalesce(v_session.configuration -> 'team_order', '[]'::jsonb);
  v_total := jsonb_array_length(v_order);
  v_scan := v_session.current_pick_number + 1;
  v_roster_max := greatest(
    1,
    coalesce((v_state #>> '{settings,rosterMax}')::integer, 1)
  );
  v_budget_enabled := coalesce(
    (v_state #>> '{settings,snakeBudgetEnabled}')::boolean,
    false
  );
  v_budget := greatest(
    0,
    coalesce((v_state #>> '{settings,budget}')::numeric, 0)
  );

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
        updated_at = now()
    where id = v_session.id;
  else
    update public.draft_sessions
    set current_pick_number = v_scan,
        current_team_id = v_next_team,
        updated_at = now()
    where id = v_session.id;
  end if;

  v_state := jsonb_set(v_state, '{pickIndex}', to_jsonb(v_scan), true);
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
    jsonb_build_object('next_pick_number', v_scan)
  );

  return v_state;
end;
$$;

-- Keep overnight pauses authoritative for hosted snake drafts as well as
-- for snapshot-backed auctions and local-compatible league state.
create or replace function public.reconcile_overnight_draft_pauses()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_state jsonb;
  v_settings jsonb;
  v_start integer;
  v_end integer;
  v_hour integer;
  v_in_window boolean;
  v_now_ms bigint;
  v_paused_ms bigint;
  v_changed integer := 0;
begin
  v_now_ms := floor(extract(epoch from clock_timestamp()) * 1000)::bigint;
  v_hour := extract(
    hour from (clock_timestamp() at time zone 'UTC')
  )::integer;

  for r in
    select league_id, state
    from public.league_state_snapshots
    for update
  loop
    v_state := r.state;
    v_settings := coalesce(v_state -> 'settings', '{}'::jsonb);
    if not coalesce((v_state ->> 'locked')::boolean, false)
       or not coalesce(
         (v_settings ->> 'overnightPauseEnabled')::boolean,
         false
       ) then
      continue;
    end if;

    v_start := coalesce(
      (v_settings ->> 'overnightPauseStartUTCHour')::integer,
      3
    );
    v_end := coalesce(
      (v_settings ->> 'overnightPauseEndUTCHour')::integer,
      13
    );
    v_in_window := case
      when v_start = v_end then false
      when v_start < v_end then v_hour >= v_start and v_hour < v_end
      else v_hour >= v_start or v_hour < v_end
    end;

    if v_in_window
       and not coalesce((v_state ->> 'paused')::boolean, false) then
      v_state := jsonb_set(v_state, '{paused}', 'true'::jsonb, true);
      v_state := jsonb_set(v_state, '{pausedAt}', to_jsonb(v_now_ms), true);
      v_state := jsonb_set(
        v_state,
        '{pauseIsOvernight}',
        'true'::jsonb,
        true
      );

      update public.draft_sessions
      set status = 'paused',
          configuration = jsonb_set(
            jsonb_set(
              coalesce(configuration, '{}'::jsonb),
              '{pause_started_at}',
              to_jsonb(v_now_ms),
              true
            ),
            '{pause_is_overnight}',
            'true'::jsonb,
            true
          )
      where league_id = r.league_id
        and mode = 'snake'
        and status = 'active';

      update public.league_state_snapshots
      set state = v_state,
          revision = revision + 1,
          updated_at = now()
      where league_id = r.league_id;
      v_changed := v_changed + 1;

    elsif not v_in_window
       and coalesce((v_state ->> 'paused')::boolean, false)
       and coalesce((v_state ->> 'pauseIsOvernight')::boolean, false) then
      v_paused_ms := greatest(
        0,
        v_now_ms - coalesce((v_state ->> 'pausedAt')::bigint, v_now_ms)
      );
      if v_state ->> 'pickDeadline' is not null then
        v_state := jsonb_set(
          v_state,
          '{pickDeadline}',
          to_jsonb((v_state ->> 'pickDeadline')::bigint + v_paused_ms),
          true
        );
      end if;
      if v_state ->> 'nominationDeadline' is not null then
        v_state := jsonb_set(
          v_state,
          '{nominationDeadline}',
          to_jsonb(
            (v_state ->> 'nominationDeadline')::bigint + v_paused_ms
          ),
          true
        );
      end if;
      if v_state #>> '{nominee,deadline}' is not null then
        v_state := jsonb_set(
          v_state,
          '{nominee,deadline}',
          to_jsonb(
            (v_state #>> '{nominee,deadline}')::bigint + v_paused_ms
          ),
          true
        );
      end if;
      v_state := jsonb_set(v_state, '{paused}', 'false'::jsonb, true);
      v_state := jsonb_set(v_state, '{pausedAt}', 'null'::jsonb, true);
      v_state := jsonb_set(
        v_state,
        '{pauseIsOvernight}',
        'false'::jsonb,
        true
      );

      update public.draft_sessions
      set status = 'active',
          updated_at = updated_at
            + make_interval(secs => v_paused_ms::double precision / 1000.0),
          configuration = coalesce(configuration, '{}'::jsonb)
            - array['pause_started_at', 'pause_is_overnight']
      where league_id = r.league_id
        and mode = 'snake'
        and status = 'paused'
        and coalesce(
          (configuration ->> 'pause_is_overnight')::boolean,
          false
        );

      update public.league_state_snapshots
      set state = v_state,
          revision = revision + 1,
          updated_at = now()
      where league_id = r.league_id;
      v_changed := v_changed + 1;
    end if;
  end loop;

  return v_changed;
end;
$$;

-- The earlier live-snake picker enforced roster size and budget, but not the
-- restricted/Mega caps that commissioners can configure. Persist those flags
-- in league_pokemon and enforce them for both the current pick and turn skips.
create or replace function public.make_snake_pick(
  p_draft_session_id uuid,
  p_league_pokemon_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_league uuid;
  v_team uuid;
  v_pick integer;
  v_config jsonb;
  v_order jsonb;
  v_total integer;
  v_next_team uuid;
  v_candidate uuid;
  v_pokemon public.league_pokemon;
  v_pick_id uuid;
  v_settings jsonb;
  v_budget_enabled boolean;
  v_budget numeric;
  v_spent numeric;
  v_cost numeric;
  v_roster_max integer;
  v_roster_count integer;
  v_restricted_cap integer;
  v_mega_cap integer;
  v_restricted_count integer;
  v_mega_count integer;
  v_scan integer;
  v_can_pick boolean;
  v_state jsonb;
  v_team_index integer;
  v_snapshot_mon jsonb;
  v_snapshot_rosters jsonb;
  v_snapshot_roster jsonb;
  v_snapshot_budgets jsonb;
  v_snapshot_pool jsonb;
begin
  select league_id, current_team_id, current_pick_number, configuration
  into v_league, v_team, v_pick, v_config
  from public.draft_sessions
  where id = p_draft_session_id
    and status = 'active'
    and mode = 'snake'
  for update;
  if v_league is null then
    raise exception 'No active snake draft found.';
  end if;
  if not public.is_league_staff(v_league)
     and not exists (
       select 1
       from public.teams t
       join public.league_memberships membership
         on membership.id = t.owner_membership_id
       where t.id = v_team
         and membership.user_id = auth.uid()
     ) then
    raise exception 'It is not your team''s turn.';
  end if;

  select state
  into v_state
  from public.league_state_snapshots
  where league_id = v_league
  for update;
  if v_state is null then
    raise exception 'League state was not found.';
  end if;

  select settings into v_settings
  from public.leagues
  where id = v_league;
  v_budget_enabled := coalesce(
    (v_settings ->> 'snakeBudgetEnabled')::boolean,
    false
  );
  v_budget := greatest(
    0,
    coalesce((v_settings ->> 'budget')::numeric, 0)
  );
  v_roster_max := greatest(
    1,
    coalesce((v_settings ->> 'rosterMax')::integer, 1)
  );
  v_restricted_cap := case
    when jsonb_typeof(v_settings -> 'restrictedCap') = 'number'
      then (v_settings ->> 'restrictedCap')::integer
    else null
  end;
  v_mega_cap := case
    when jsonb_typeof(v_settings -> 'megaCap') = 'number'
      then (v_settings ->> 'megaCap')::integer
    else null
  end;

  select * into v_pokemon
  from public.league_pokemon
  where id = p_league_pokemon_id
    and league_id = v_league
  for update;
  if v_pokemon.id is null
     or not v_pokemon.is_allowed
     or v_pokemon.is_drafted then
    raise exception 'That Pokemon is no longer available.';
  end if;
  v_cost := coalesce(v_pokemon.cost, 0);
  select
    count(*),
    count(*) filter (where lp.is_restricted),
    count(*) filter (where lp.is_mega),
    coalesce(sum(lp.cost), 0)
  into
    v_roster_count,
    v_restricted_count,
    v_mega_count,
    v_spent
  from public.roster_entries entry
  join public.league_pokemon lp
    on lp.id = entry.league_pokemon_id
  where entry.team_id = v_team
    and entry.released_at is null;

  if v_roster_count >= v_roster_max then
    raise exception 'That roster is full.';
  end if;
  if v_pokemon.is_restricted
     and v_restricted_cap is not null
     and v_restricted_count >= v_restricted_cap then
    raise exception 'That team has reached its restricted Pokemon limit.';
  end if;
  if v_pokemon.is_mega
     and v_mega_cap is not null
     and v_mega_count >= v_mega_cap then
    raise exception 'That team has reached its Mega Pokemon limit.';
  end if;
  if v_budget_enabled and v_cost > v_budget - v_spent then
    raise exception 'That Pokemon costs more than this team''s remaining budget.';
  end if;

  update public.league_pokemon
  set is_drafted = true
  where id = p_league_pokemon_id;
  insert into public.draft_picks(
    draft_session_id,
    team_id,
    league_pokemon_id,
    pick_number,
    made_by
  )
  values (
    p_draft_session_id,
    v_team,
    p_league_pokemon_id,
    v_pick,
    auth.uid()
  )
  returning id into v_pick_id;
  insert into public.roster_entries(
    team_id,
    league_pokemon_id,
    acquisition_type
  )
  values (v_team, p_league_pokemon_id, 'draft');

  v_order := v_config -> 'team_order';
  v_total := jsonb_array_length(v_order);
  v_scan := v_pick + 1;
  v_next_team := null;
  while v_scan < v_total loop
    v_candidate := (v_order ->> v_scan)::uuid;
    select
      count(*),
      count(*) filter (where lp.is_restricted),
      count(*) filter (where lp.is_mega),
      coalesce(sum(lp.cost), 0)
    into
      v_roster_count,
      v_restricted_count,
      v_mega_count,
      v_spent
    from public.roster_entries entry
    join public.league_pokemon lp
      on lp.id = entry.league_pokemon_id
    where entry.team_id = v_candidate
      and entry.released_at is null;

    v_can_pick := v_roster_count < v_roster_max
      and exists (
        select 1
        from public.league_pokemon available
        where available.league_id = v_league
          and available.is_allowed
          and not available.is_drafted
          and (
            not v_budget_enabled
            or coalesce(available.cost, 0) <= v_budget - v_spent
          )
          and (
            not available.is_restricted
            or v_restricted_cap is null
            or v_restricted_count < v_restricted_cap
          )
          and (
            not available.is_mega
            or v_mega_cap is null
            or v_mega_count < v_mega_cap
          )
      );
    if v_can_pick then
      v_next_team := v_candidate;
      exit;
    end if;
    v_scan := v_scan + 1;
  end loop;

  if v_next_team is null then
    update public.draft_sessions
    set status = 'complete',
        current_pick_number = v_scan,
        current_team_id = null,
        updated_at = now()
    where id = p_draft_session_id;
  else
    update public.draft_sessions
    set current_pick_number = v_scan,
        current_team_id = v_next_team,
        updated_at = now()
    where id = p_draft_session_id;
  end if;

  select source_key::integer
  into v_team_index
  from public.teams
  where id = v_team;
  if v_team_index is null then
    raise exception 'The active team is not mapped to the league snapshot.';
  end if;

  if jsonb_typeof(v_state #> '{liveDraft,basePool}') = 'array' then
    select mon.value
    into v_snapshot_mon
    from jsonb_array_elements(v_state #> '{liveDraft,basePool}') mon(value)
    where mon.value ->> 'id' = v_pokemon.source_key
    limit 1;
  end if;
  if v_snapshot_mon is null then
    select mon.value
    into v_snapshot_mon
    from jsonb_array_elements(
      coalesce(v_state -> 'pool', '[]'::jsonb)
    ) mon(value)
    where mon.value ->> 'id' = v_pokemon.source_key
    limit 1;
  end if;
  if v_snapshot_mon is null then
    raise exception 'The selected Pokemon is missing from the league snapshot.';
  end if;

  v_snapshot_rosters := coalesce(v_state -> 'rosters', '[]'::jsonb);
  if jsonb_typeof(v_snapshot_rosters) <> 'array'
     or v_team_index >= jsonb_array_length(v_snapshot_rosters) then
    raise exception 'The league snapshot roster map is invalid.';
  end if;
  v_snapshot_roster := coalesce(
    v_snapshot_rosters -> v_team_index,
    '[]'::jsonb
  );
  v_snapshot_roster := v_snapshot_roster || jsonb_build_array(
    jsonb_set(
      jsonb_set(
        v_snapshot_mon,
        '{draftPick}',
        to_jsonb(v_pick),
        true
      ),
      '{acquiredVia}',
      to_jsonb('draft'::text),
      true
    )
  );
  v_snapshot_rosters := jsonb_set(
    v_snapshot_rosters,
    array[v_team_index::text],
    v_snapshot_roster,
    false
  );
  v_state := jsonb_set(v_state, '{rosters}', v_snapshot_rosters, true);

  if v_budget_enabled then
    v_snapshot_budgets := coalesce(v_state -> 'budgets', '[]'::jsonb);
    if jsonb_typeof(v_snapshot_budgets) <> 'array'
       or v_team_index >= jsonb_array_length(v_snapshot_budgets) then
      raise exception 'The league snapshot budget map is invalid.';
    end if;
    v_snapshot_budgets := jsonb_set(
      v_snapshot_budgets,
      array[v_team_index::text],
      to_jsonb(
        greatest(
          0,
          coalesce((v_snapshot_budgets ->> v_team_index)::numeric, 0)
            - v_cost
        )
      ),
      false
    );
    v_state := jsonb_set(v_state, '{budgets}', v_snapshot_budgets, true);
  end if;

  select coalesce(jsonb_agg(mon.value order by mon.ordinality), '[]'::jsonb)
  into v_snapshot_pool
  from jsonb_array_elements(
    coalesce(v_state -> 'pool', '[]'::jsonb)
  ) with ordinality mon(value, ordinality)
  where mon.value ->> 'id' <> v_pokemon.source_key;
  v_state := jsonb_set(v_state, '{pool}', v_snapshot_pool, true);
  v_state := jsonb_set(v_state, '{pickIndex}', to_jsonb(v_scan), true);
  v_state := jsonb_set(
    v_state,
    '{pickDeadline}',
    case
      when v_next_team is null
        or coalesce((v_settings ->> 'pickTimeLimitMinutes')::integer, 0) <= 0
        then 'null'::jsonb
      else to_jsonb(
        floor(extract(epoch from clock_timestamp()) * 1000)::bigint
          + (v_settings ->> 'pickTimeLimitMinutes')::integer * 60000
      )
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
  where league_id = v_league;

  insert into public.league_events(league_id, kind, actor_id, payload)
  values (
    v_league,
    'draft_pick',
    auth.uid(),
    jsonb_build_object(
      'draft_pick_id', v_pick_id,
      'team_id', v_team,
      'league_pokemon_id', p_league_pokemon_id,
      'pick_number', v_pick
    )
  );
  return v_pick_id;
end;
$$;

revoke all on function public.provision_live_snake_draft_v2(
  uuid, jsonb, jsonb, integer[], jsonb, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.provision_live_snake_draft_v2(
  uuid, jsonb, jsonb, integer[], jsonb, jsonb, jsonb
) to authenticated;

revoke all on function public.set_live_snake_draft_paused(
  uuid, boolean, boolean
) from public, anon, authenticated;
grant execute on function public.set_live_snake_draft_paused(
  uuid, boolean, boolean
) to authenticated;

revoke all on function public.advance_live_snake_turn(uuid)
  from public, anon, authenticated;
grant execute on function public.advance_live_snake_turn(uuid)
  to authenticated;

revoke all on function public.make_snake_pick(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.make_snake_pick(uuid, uuid)
  to authenticated;

revoke all on function public.reconcile_overnight_draft_pauses()
  from public, anon, authenticated;
grant execute on function public.reconcile_overnight_draft_pauses()
  to service_role;

commit;

notify pgrst, 'reload schema';
