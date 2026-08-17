-- Distinguish invited spectators from managers visiting a sibling pod.
--
-- Spectators receive only standings, predictions, the draft board, and
-- playoffs. A manager or commissioner in another pod from the same
-- organization season may additionally read completed league activity and
-- use the League Board, but receives no team, transaction, or direct-message
-- authority in the visited pod.

begin;

create or replace function public.is_linked_pod_manager(p_league_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.league_organization_pods target_pod
    join public.league_organization_seasons season
      on season.id = target_pod.season_id
    join public.league_organization_pods source_pod
      on source_pod.season_id = target_pod.season_id
     and source_pod.league_id <> target_pod.league_id
    join public.league_memberships source_membership
      on source_membership.league_id = source_pod.league_id
     and source_membership.user_id = auth.uid()
     and source_membership.role::text in ('commissioner', 'co_commissioner', 'coach')
    join public.leagues target_league
      on target_league.id = target_pod.league_id
    where target_pod.league_id = p_league_id
      and target_pod.status <> 'archived'
      and source_pod.status <> 'archived'
      and season.status <> 'archived'
      and target_league.status::text <> 'archived'
  );
$$;

-- This projection is the only state shape returned to spectators and linked
-- pod managers. Keep it as an explicit allow-list: new private state fields do
-- not become visible merely because they are added to the shared snapshot.
create or replace function public.project_league_observer_state(
  p_state jsonb,
  p_include_activity boolean default false
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_projection jsonb;
  v_teams jsonb := '[]'::jsonb;
  v_messages jsonb := '{"board":[],"direct":{}}'::jsonb;
  v_trades jsonb := '[]'::jsonb;
  v_receipts jsonb := '{}'::jsonb;
  v_name text;
begin
  select coalesce(jsonb_object_agg(entry.key, entry.value), '{}'::jsonb)
    into v_projection
  from jsonb_each(coalesce(p_state, '{}'::jsonb)) entry
  where entry.key = any (array[
    'rev', 'locked', 'settings', 'teams', 'rosters', 'pool', 'budgets',
    'snakeOrder', 'pickIndex', 'pickDeadline', 'paused', 'pausedAt',
    'pauseIsOvernight', 'auctionNominationOrder', 'auctionNominationIdx',
    'nominationDeadline', 'nominee', 'auctionEnded', 'liveDraft',
    'draftStartedAt', 'keeperRosters', 'schedule', 'week', 'matchResults',
    'predictions', 'playoffs', 'seasonNumber'
  ]);

  if jsonb_typeof(p_state -> 'teams') = 'array' then
    select coalesce(jsonb_agg(
      team.value
        - 'claimedByUserId'
        - 'ownerUserId'
        - 'ownerMembershipId'
        - 'membershipId'
        - 'userId'
        - 'email'
      order by team.ordinality
    ), '[]'::jsonb)
      into v_teams
    from jsonb_array_elements(p_state -> 'teams')
      with ordinality team(value, ordinality);
    v_projection := jsonb_set(v_projection, '{teams}', v_teams, true);
  end if;

  if p_include_activity then
    v_messages := jsonb_build_object(
      'board', coalesce(p_state #> '{messages,board}', '[]'::jsonb),
      'direct', '{}'::jsonb
    );

    select coalesce(jsonb_agg(item.value order by item.ordinality), '[]'::jsonb)
      into v_trades
    from jsonb_array_elements(coalesce(p_state -> 'trades', '[]'::jsonb))
      with ordinality item(value, ordinality)
    where coalesce(item.value ->> 'status', 'pending') <> 'pending';

    select coalesce(nullif(btrim(profile.display_name), ''), nullif(btrim(profile.username), ''), 'Coach')
      into v_name
    from public.profiles profile
    where profile.id = auth.uid();
    if v_name is not null then
      v_receipts := jsonb_build_object(
        v_name,
        coalesce(p_state #> array['readReceipts', v_name], '{}'::jsonb)
      );
    end if;

    v_projection := v_projection || jsonb_build_object(
      'messages', v_messages,
      'readReceipts', v_receipts,
      'transactionLog', coalesce(p_state -> 'transactionLog', '[]'::jsonb),
      'trades', v_trades,
      'auditLog', coalesce(p_state -> 'auditLog', '[]'::jsonb)
    );
  else
    v_projection := v_projection || jsonb_build_object(
      'messages', v_messages,
      'readReceipts', '{}'::jsonb,
      'transactionLog', '[]'::jsonb,
      'trades', '[]'::jsonb,
      'auditLog', '[]'::jsonb
    );
  end if;

  return v_projection;
end;
$$;

-- Existing transaction and auction RPCs use these ownership helpers. Make
-- the participant role explicit so a viewer membership can never act merely
-- because its profile name resembles a manager or stale ownership remains.
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
  if not exists (
    select 1 from public.league_memberships membership
    where membership.league_id = p_league_id
      and membership.user_id = auth.uid()
      and membership.role::text in ('commissioner', 'co_commissioner', 'coach')
  ) then
    return false;
  end if;
  if public.is_league_staff(p_league_id) then return true; end if;
  if p_team_index is null
     or p_team_index < 0
     or jsonb_typeof(p_state -> 'teams') <> 'array'
     or p_team_index >= jsonb_array_length(p_state -> 'teams') then
    return false;
  end if;

  if exists (
    select 1
    from public.teams team
    join public.league_memberships membership
      on membership.id = team.owner_membership_id
    where team.league_id = p_league_id
      and team.source_key = p_team_index::text
      and membership.user_id = auth.uid()
      and membership.role::text in ('commissioner', 'co_commissioner', 'coach')
  ) then
    return true;
  end if;

  select profile.display_name, profile.username
    into v_display_name, v_username
  from public.profiles profile
  where profile.id = auth.uid();
  v_claimed_by := nullif(btrim(p_state #>> array['teams', p_team_index::text, 'claimedBy']), '');
  return v_claimed_by is not null and (
    lower(v_claimed_by) = lower(coalesce(v_username, ''))
    or lower(v_claimed_by) = lower(coalesce(v_display_name, ''))
  );
end;
$$;

create or replace function public.auction_actor_can_control_team(
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
begin
  if not exists (
    select 1 from public.league_memberships membership
    where membership.league_id = p_league_id
      and membership.user_id = auth.uid()
      and membership.role::text in ('commissioner', 'co_commissioner', 'coach')
  ) then
    return false;
  end if;
  if public.is_league_staff(p_league_id) then return true; end if;
  return exists (
    select 1
    from public.auction_team_owners owner
    where owner.league_id = p_league_id
      and owner.team_index = p_team_index
      and owner.user_id = auth.uid()
  );
end;
$$;

create or replace function public.get_my_league_state(p_league_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role public.membership_role;
  v_state jsonb;
  v_linked_manager boolean;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to open this league.';
  end if;

  select membership.role
    into v_role
  from public.league_memberships membership
  where membership.league_id = p_league_id
    and membership.user_id = auth.uid();

  v_linked_manager := public.is_linked_pod_manager(p_league_id);
  if v_role is null and not v_linked_manager then
    raise exception 'That league is unavailable or you no longer have access.';
  end if;

  select snapshot.state
    into v_state
  from public.league_state_snapshots snapshot
  where snapshot.league_id = p_league_id;
  if v_state is null then
    raise exception 'League state was not found.';
  end if;

  if v_role::text in ('commissioner', 'co_commissioner', 'coach') then
    return v_state;
  end if;
  return public.project_league_observer_state(v_state, v_linked_manager);
end;
$$;

create or replace function public.get_my_league_access(p_league_key text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_league public.leagues%rowtype;
  v_role public.membership_role;
  v_access_role text;
begin
  if auth.uid() is null then return null; end if;

  select league.*
    into v_league
  from public.leagues league
  where league.slug = btrim(coalesce(p_league_key, ''))
     or league.id::text = btrim(coalesce(p_league_key, ''))
  order by case when league.slug = btrim(coalesce(p_league_key, '')) then 0 else 1 end
  limit 1;
  if not found then return null; end if;

  select membership.role
    into v_role
  from public.league_memberships membership
  where membership.league_id = v_league.id
    and membership.user_id = auth.uid();

  if v_role::text in ('commissioner', 'co_commissioner', 'coach') then
    v_access_role := v_role::text;
  elsif public.is_linked_pod_manager(v_league.id) then
    v_access_role := 'pod_manager';
  elsif v_role::text = 'viewer' then
    v_access_role := 'viewer';
  else
    return null;
  end if;

  return jsonb_build_object(
    'role', v_access_role,
    'league', jsonb_build_object(
      'id', v_league.id,
      'name', v_league.name,
      'slug', v_league.slug,
      'description', v_league.description,
      'image_url', v_league.image_url,
      'season_label', v_league.season_label,
      'status', v_league.status,
      'draft_starts_at', v_league.draft_starts_at,
      'league_visibility', v_league.league_visibility,
      'draft_start_visibility', v_league.draft_start_visibility,
      'is_practice', v_league.is_practice,
      'practice_expires_at', v_league.practice_expires_at,
      'lifecycle_archived_at', v_league.lifecycle_archived_at,
      'workspace_kind', v_league.workspace_kind
    )
  );
end;
$$;

create or replace function public.get_my_league_pod_navigation(p_league_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_season public.league_organization_seasons%rowtype;
  v_organization public.league_organizations%rowtype;
  v_current_pod public.league_organization_pods%rowtype;
begin
  if auth.uid() is null then return null; end if;

  select season.*
    into v_season
  from public.league_organization_pods target_pod
  join public.league_organization_seasons season
    on season.id = target_pod.season_id
  join public.leagues target_league
    on target_league.id = target_pod.league_id
  where target_pod.league_id = p_league_id
    and target_pod.status <> 'archived'
    and season.status <> 'archived'
    and target_league.status::text <> 'archived'
    and exists (
      select 1
      from public.league_organization_pods source_pod
      join public.league_memberships source_membership
        on source_membership.league_id = source_pod.league_id
       and source_membership.user_id = auth.uid()
       and source_membership.role::text in ('commissioner', 'co_commissioner', 'coach')
      where source_pod.season_id = target_pod.season_id
        and source_pod.status <> 'archived'
    )
  order by
    case season.status
      when 'active' then 0
      when 'qualification' then 1
      when 'championship' then 2
      when 'complete' then 3
      else 4
    end,
    season.created_at desc
  limit 1;
  if not found then return null; end if;

  select * into v_organization
  from public.league_organizations
  where id = v_season.organization_id;
  select * into v_current_pod
  from public.league_organization_pods
  where season_id = v_season.id and league_id = p_league_id;

  return jsonb_build_object(
    'organization', jsonb_build_object(
      'id', v_organization.id,
      'slug', v_organization.slug,
      'name', v_organization.name
    ),
    'season', jsonb_build_object(
      'id', v_season.id,
      'name', v_season.name,
      'status', v_season.status
    ),
    'current_pod_id', v_current_pod.id,
    'pods', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', pod.id,
        'league_id', pod.league_id,
        'league_slug', league.slug,
        'league_name', league.name,
        'label', pod.label,
        'sort_order', pod.sort_order,
        'status', pod.status,
        'is_current', pod.league_id = p_league_id
      ) order by pod.sort_order)
      from public.league_organization_pods pod
      join public.leagues league on league.id = pod.league_id
      where pod.season_id = v_season.id
        and pod.status <> 'archived'
        and league.status::text <> 'archived'
    ), '[]'::jsonb)
  );
end;
$$;

-- Direct table reads are reserved for actual managers and staff. Spectators
-- and linked pod managers must use the bounded projection above.
drop policy if exists "league members read snapshots"
  on public.league_state_snapshots;
create policy "league participants read snapshots"
  on public.league_state_snapshots for select to authenticated
  using (exists (
    select 1
    from public.league_memberships membership
    where membership.league_id = league_state_snapshots.league_id
      and membership.user_id = auth.uid()
      and membership.role::text in ('commissioner', 'co_commissioner', 'coach')
  ));

drop policy if exists "members read league events" on public.league_events;
create policy "participants and linked pod managers read league events"
  on public.league_events for select to authenticated
  using (
    exists (
      select 1
      from public.league_memberships membership
      where membership.league_id = league_events.league_id
        and membership.user_id = auth.uid()
        and membership.role::text in ('commissioner', 'co_commissioner', 'coach')
    )
    or public.is_linked_pod_manager(league_events.league_id)
  );

drop policy if exists "linked pod managers read draft catalogue"
  on public.league_pokemon;
create policy "linked pod managers read draft catalogue"
  on public.league_pokemon for select to authenticated
  using (public.is_linked_pod_manager(league_id));

create or replace function public.mutate_league_communication(
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
  v_role public.membership_role;
  v_is_participant boolean;
  v_is_linked_manager boolean;
  v_name text;
  v_state jsonb;
  v_messages jsonb;
  v_receipts jsonb;
  v_board jsonb;
  v_direct jsonb;
  v_key text;
  v_other text;
  v_text text;
  v_id text;
  v_now bigint := floor(extract(epoch from clock_timestamp()) * 1000);
  v_revision bigint;
  v_return_state jsonb;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to use league messages.';
  end if;
  select membership.role into v_role
  from public.league_memberships membership
  where membership.league_id = p_league_id and membership.user_id = auth.uid();
  v_is_participant := coalesce(v_role::text in ('commissioner', 'co_commissioner', 'coach'), false);
  v_is_linked_manager := public.is_linked_pod_manager(p_league_id);
  if not v_is_participant and not v_is_linked_manager then
    raise exception 'Spectators cannot use league messages.';
  end if;
  if not v_is_participant and p_action not in ('board_post', 'board_delete', 'board_read') then
    raise exception 'Managers visiting another pod can use its League Board, but cannot send direct messages.';
  end if;

  select coalesce(nullif(btrim(display_name), ''), nullif(btrim(username), ''), 'Coach')
    into v_name from public.profiles where id = auth.uid();
  select state into v_state from public.league_state_snapshots
    where league_id = p_league_id for update;
  if v_state is null then raise exception 'League state was not found.'; end if;
  v_messages := coalesce(v_state -> 'messages', '{"board":[],"direct":{}}'::jsonb);
  v_receipts := coalesce(v_state -> 'readReceipts', '{}'::jsonb);
  v_board := coalesce(v_messages -> 'board', '[]'::jsonb);
  v_direct := coalesce(v_messages -> 'direct', '{}'::jsonb);

  if p_action = 'board_post' then
    v_text := btrim(coalesce(p_payload ->> 'text', ''));
    if char_length(v_text) not between 1 and 1000 then raise exception 'Enter a message up to 1,000 characters.'; end if;
    v_id := gen_random_uuid()::text;
    v_board := v_board || jsonb_build_array(jsonb_build_object('id', v_id, 'author', v_name, 'text', v_text, 'ts', v_now));
    v_messages := jsonb_set(v_messages, '{board}', v_board, true);
  elsif p_action = 'board_delete' then
    v_id := p_payload ->> 'id';
    if coalesce(v_role::text, 'pod_manager') not in ('commissioner', 'co_commissioner') and not exists (
      select 1 from jsonb_array_elements(v_board) message
      where message ->> 'id' = v_id and message ->> 'author' = v_name
    ) then raise exception 'You cannot delete that post.'; end if;
    select coalesce(jsonb_agg(message), '[]'::jsonb) into v_board
    from jsonb_array_elements(v_board) message where message ->> 'id' <> v_id;
    v_messages := jsonb_set(v_messages, '{board}', v_board, true);
  elsif p_action = 'direct_send' then
    v_other := btrim(coalesce(p_payload ->> 'to', ''));
    v_text := btrim(coalesce(p_payload ->> 'text', ''));
    if v_other = '' or char_length(v_text) not between 1 and 1000 then raise exception 'Choose a manager and enter a message.'; end if;
    v_key := case when v_name < v_other then v_name || '||' || v_other else v_other || '||' || v_name end;
    v_direct := jsonb_set(v_direct, array[v_key],
      coalesce(v_direct -> v_key, '[]'::jsonb) || jsonb_build_array(jsonb_build_object('from', v_name, 'text', v_text, 'ts', v_now)), true);
    v_messages := jsonb_set(v_messages, '{direct}', v_direct, true);
  elsif p_action = 'board_read' then
    v_receipts := jsonb_set(v_receipts, array[v_name],
      coalesce(v_receipts -> v_name, '{}'::jsonb) || jsonb_build_object('board', v_now), true);
  elsif p_action = 'direct_read' then
    v_other := btrim(coalesce(p_payload ->> 'other', ''));
    if v_other = '' then raise exception 'Choose a message thread.'; end if;
    v_key := case when v_name < v_other then v_name || '||' || v_other else v_other || '||' || v_name end;
    v_receipts := jsonb_set(v_receipts, array[v_name],
      jsonb_set(
        coalesce(v_receipts -> v_name, '{}'::jsonb),
        '{direct}',
        jsonb_set(coalesce(v_receipts #> array[v_name, 'direct'], '{}'::jsonb), array[v_key], to_jsonb(v_now), true),
        true
      ),
      true
    );
  else
    raise exception 'Unknown communication action.';
  end if;

  v_state := jsonb_set(jsonb_set(v_state, '{messages}', v_messages, true), '{readReceipts}', v_receipts, true);
  update public.league_state_snapshots
    set state = v_state, revision = revision + 1, updated_at = now()
    where league_id = p_league_id
    returning revision into v_revision;
  v_return_state := case when v_is_participant then v_state else public.project_league_observer_state(v_state, true) end;
  return jsonb_build_object('state', v_return_state, 'revision', v_revision);
end;
$$;

create or replace function public.save_league_prediction(
  p_league_id uuid,
  p_week integer,
  p_match_index integer,
  p_patch jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.membership_role;
  v_linked_manager boolean;
  v_state jsonb;
  v_name text;
  v_key text;
  v_match jsonb;
  v_existing jsonb;
  v_safe_patch jsonb := '{}'::jsonb;
  v_revision bigint;
begin
  if auth.uid() is null then raise exception 'You must be signed in to predict.'; end if;
  select membership.role into v_role
  from public.league_memberships membership
  where membership.league_id = p_league_id and membership.user_id = auth.uid();
  v_linked_manager := public.is_linked_pod_manager(p_league_id);
  if v_role is null and not v_linked_manager then
    raise exception 'Join or watch this league before predicting.';
  end if;

  if p_week < 0 or p_match_index < 0 then raise exception 'That matchup does not exist.'; end if;
  select state, revision into v_state, v_revision
  from public.league_state_snapshots where league_id = p_league_id for update;
  if v_state is null then raise exception 'League state was not found.'; end if;

  v_match := v_state #> array['schedule', p_week::text, p_match_index::text];
  if v_match is null or jsonb_typeof(v_match) <> 'array' or jsonb_array_length(v_match) <> 2 then
    raise exception 'That matchup does not exist.';
  end if;
  v_key := p_week::text || '-' || p_match_index::text;
  if v_state #> array['matchResults', v_key] is not null then
    raise exception 'Predictions are closed because this result is final.';
  end if;

  select coalesce(nullif(btrim(display_name), ''), nullif(btrim(username), ''), 'Coach')
    into v_name from public.profiles where id = auth.uid();
  if p_patch ? 'side' then
    if p_patch ->> 'side' not in ('A', 'B') then raise exception 'Prediction side must be A or B.'; end if;
    v_safe_patch := v_safe_patch || jsonb_build_object('side', p_patch -> 'side');
  end if;
  if p_patch ? 'setScore' then
    if jsonb_typeof(p_patch -> 'setScore') not in ('string', 'null') then raise exception 'The predicted score is invalid.'; end if;
    v_safe_patch := v_safe_patch || jsonb_build_object('setScore', p_patch -> 'setScore');
  end if;
  if p_patch ? 'monsAlive' then
    if jsonb_typeof(p_patch -> 'monsAlive') not in ('number', 'null')
       or (jsonb_typeof(p_patch -> 'monsAlive') = 'number' and (p_patch ->> 'monsAlive')::integer not between 0 and 6) then
      raise exception 'Mons remaining must be between 0 and 6.';
    end if;
    v_safe_patch := v_safe_patch || jsonb_build_object('monsAlive', p_patch -> 'monsAlive');
  end if;
  if p_patch ? 'gameMargins' then
    if jsonb_typeof(p_patch -> 'gameMargins') not in ('array', 'null') then raise exception 'Per-game predictions are invalid.'; end if;
    v_safe_patch := v_safe_patch || jsonb_build_object('gameMargins', p_patch -> 'gameMargins');
  end if;
  if v_safe_patch = '{}'::jsonb then raise exception 'No supported prediction fields were supplied.'; end if;

  v_existing := coalesce(v_state #> array['predictions', v_key, v_name], '{}'::jsonb);
  v_state := jsonb_set(v_state, array['predictions', v_key, v_name], v_existing || v_safe_patch, true);
  v_state := jsonb_set(v_state, '{rev}', to_jsonb(coalesce((v_state ->> 'rev')::bigint, v_revision, 0) + 1), true);
  update public.league_state_snapshots
  set state = v_state, revision = revision + 1, updated_at = now()
  where league_id = p_league_id;

  if v_role::text in ('commissioner', 'co_commissioner', 'coach') then return v_state; end if;
  return public.project_league_observer_state(v_state, v_linked_manager);
end;
$$;

drop function if exists public.list_private_free_agent_claims(uuid);
create function public.list_private_free_agent_claims(p_league_id uuid)
returns table (
  id uuid,
  team_index integer,
  add_name text,
  drop_name text,
  bid_amount integer,
  week integer,
  submitted_at timestamptz,
  claim_priority integer,
  can_withdraw boolean
)
language plpgsql
security definer
set search_path = public
stable
as $$
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
$$;

revoke all on function public.is_linked_pod_manager(uuid) from public, anon, authenticated;
revoke all on function public.project_league_observer_state(jsonb, boolean) from public, anon, authenticated;
revoke all on function public.league_actor_can_control_snapshot_team(uuid, jsonb, integer) from public, anon, authenticated;
revoke all on function public.auction_actor_can_control_team(uuid, jsonb, integer) from public, anon, authenticated;
revoke all on function public.get_my_league_state(uuid) from public, anon, authenticated;
revoke all on function public.get_my_league_access(text) from public, anon, authenticated;
revoke all on function public.get_my_league_pod_navigation(uuid) from public, anon, authenticated;
revoke all on function public.mutate_league_communication(uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.save_league_prediction(uuid, integer, integer, jsonb) from public, anon, authenticated;
revoke all on function public.list_private_free_agent_claims(uuid) from public, anon, authenticated;

grant execute on function public.is_linked_pod_manager(uuid) to authenticated;
grant execute on function public.get_my_league_state(uuid) to authenticated;
grant execute on function public.get_my_league_access(text) to authenticated;
grant execute on function public.get_my_league_pod_navigation(uuid) to authenticated;
grant execute on function public.mutate_league_communication(uuid, text, jsonb) to authenticated;
grant execute on function public.save_league_prediction(uuid, integer, integer, jsonb) to authenticated;
grant execute on function public.list_private_free_agent_claims(uuid) to authenticated;

notify pgrst, 'reload schema';

commit;
