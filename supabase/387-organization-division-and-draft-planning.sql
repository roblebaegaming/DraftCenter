-- Plan a large organization season as concurrent, independently operated pods.
-- Pod draft changes and manager placement retain the existing dual-authority
-- boundary: the actor must administer the organization and staff the pod.

begin;

alter table public.league_organization_seasons
  add column planned_pod_count smallint not null default 2
    check (planned_pod_count between 2 and 32);

update public.league_organization_seasons season
set planned_pod_count = greatest(2, least(32, (
  select count(*)::integer
  from public.league_organization_pods pod
  where pod.season_id = season.id
)));

alter table public.league_organization_pods
  add constraint league_organization_pods_id_season_key unique (id, season_id);

create table public.league_organization_manager_assignments (
  season_id uuid not null references public.league_organization_seasons(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  pod_id uuid,
  availability_note text not null default '' check (char_length(availability_note) <= 500),
  assigned_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (season_id, user_id),
  foreign key (pod_id, season_id)
    references public.league_organization_pods(id, season_id) on delete restrict
);

create index league_organization_manager_assignments_pod_idx
  on public.league_organization_manager_assignments(pod_id, user_id)
  where pod_id is not null;

alter table public.league_organization_manager_assignments enable row level security;
revoke all on public.league_organization_manager_assignments from public, anon, authenticated;
grant all on public.league_organization_manager_assignments to service_role;

create or replace function public.get_league_organization_pod_start_status(
  p_league_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_snake_status text;
  v_auction_status text;
begin
  if to_regclass('public.scheduled_snake_draft_jobs') is not null then
    execute 'select status::text from public.scheduled_snake_draft_jobs where league_id = $1 order by updated_at desc limit 1'
      into v_snake_status using p_league_id;
  end if;
  if to_regclass('public.scheduled_auction_draft_jobs') is not null then
    execute 'select status::text from public.scheduled_auction_draft_jobs where league_id = $1 order by updated_at desc limit 1'
      into v_auction_status using p_league_id;
  end if;
  return jsonb_build_object(
    'snake_start_status', v_snake_status,
    'auction_start_status', v_auction_status
  );
end;
$$;

create or replace function public.create_planned_league_organization_season(
  p_organization_id uuid,
  p_name text,
  p_regulations jsonb default '{}'::jsonb,
  p_top_per_pod integer default 2,
  p_wildcard_slots integer default 0,
  p_tiebreakers text[] default array['wins', 'differential', 'head-to-head', 'commissioner-draw'],
  p_divisions jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_organization public.league_organizations%rowtype;
  v_season_id uuid;
  v_league_id uuid;
  v_division jsonb;
  v_label text;
  v_labels text[] := array[]::text[];
  v_draft_starts_at timestamptz;
  v_division_count integer;
  v_sort_order integer := 0;
  v_slug_base text;
  v_slug text;
begin
  select * into v_organization
  from public.league_organizations
  where id = p_organization_id
  for update;
  if not found or not public.is_league_organization_admin(p_organization_id) then
    raise exception 'Only organization administrators can create planned seasons.';
  end if;
  if p_divisions is null or jsonb_typeof(p_divisions) <> 'array' then
    raise exception 'Divisions must be provided as a list.';
  end if;
  v_division_count := jsonb_array_length(p_divisions);
  if v_division_count not between 2 and 32 then
    raise exception 'A concurrent season needs between 2 and 32 divisions.';
  end if;

  v_season_id := public.create_league_organization_season(
    p_organization_id,
    p_name,
    p_regulations,
    p_top_per_pod,
    p_wildcard_slots,
    p_tiebreakers
  );
  update public.league_organization_seasons
  set planned_pod_count = v_division_count
  where id = v_season_id;

  for v_division in select value from jsonb_array_elements(p_divisions)
  loop
    v_sort_order := v_sort_order + 1;
    if jsonb_typeof(v_division) <> 'object' then
      raise exception 'Every division must include a label and optional draft time.';
    end if;
    v_label := btrim(coalesce(v_division ->> 'label', ''));
    if char_length(v_label) not between 1 and 80 then
      raise exception 'Every division label must be between 1 and 80 characters.';
    end if;
    if lower(v_label) = any(v_labels) then
      raise exception 'Every division label must be unique.';
    end if;
    v_labels := array_append(v_labels, lower(v_label));
    begin
      v_draft_starts_at := nullif(v_division ->> 'draft_starts_at', '')::timestamptz;
    exception when invalid_datetime_format or datetime_field_overflow then
      raise exception 'A division draft time is invalid.';
    end;
    if v_draft_starts_at is not null and v_draft_starts_at <= now() then
      raise exception 'Division draft times must be in the future.';
    end if;

    v_slug_base := trim(both '-' from regexp_replace(
      lower(btrim(p_name) || '-' || v_label), '[^a-z0-9]+', '-', 'g'
    ));
    if char_length(v_slug_base) < 3 then v_slug_base := 'league-pod'; end if;
    v_slug := left(v_slug_base, 80) || '-' || left(replace(gen_random_uuid()::text, '-', ''), 12);
    v_league_id := public.create_league(
      btrim(p_name) || ' - ' || v_label,
      v_slug,
      left(coalesce(p_regulations ->> 'notes', ''), 4000),
      btrim(p_name),
      'private',
      false,
      v_draft_starts_at
    );
    perform public.attach_league_organization_pod(
      v_season_id,
      v_league_id,
      v_label,
      v_sort_order,
      1,
      p_top_per_pod
    );
  end loop;

  insert into public.league_organization_audit_events(
    organization_id, season_id, actor_id, kind, payload
  ) values (
    p_organization_id,
    v_season_id,
    auth.uid(),
    'season_divisions_provisioned',
    jsonb_build_object('planned_pod_count', v_division_count)
  );
  return jsonb_build_object('season_id', v_season_id, 'pod_count', v_division_count);
end;
$$;

create or replace function public.update_league_organization_pod_plan(
  p_pod_id uuid,
  p_label text,
  p_draft_starts_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pod public.league_organization_pods%rowtype;
  v_season public.league_organization_seasons%rowtype;
  v_label text := btrim(coalesce(p_label, ''));
begin
  select * into v_pod
  from public.league_organization_pods
  where id = p_pod_id
  for update;
  if not found then raise exception 'That pod was not found.'; end if;
  select * into v_season
  from public.league_organization_seasons
  where id = v_pod.season_id
  for update;
  if not public.is_league_organization_admin(v_season.organization_id)
     or not public.is_league_staff(v_pod.league_id) then
    raise exception 'Changing a pod plan requires organization and source-league authority.';
  end if;
  if v_season.status <> 'planning' or v_pod.status <> 'planning' then
    raise exception 'Pod plans can only change while the organization season is being planned.';
  end if;
  if char_length(v_label) not between 1 and 80 then
    raise exception 'Pod label must be between 1 and 80 characters.';
  end if;
  if p_draft_starts_at is not null and p_draft_starts_at <= now() then
    raise exception 'The pod draft time must be in the future.';
  end if;
  if exists (
    select 1 from public.draft_sessions session
    where session.league_id = v_pod.league_id
      and session.status::text in ('active', 'paused', 'complete')
  ) then
    raise exception 'The pod plan cannot change after its draft starts.';
  end if;
  if coalesce(public.get_league_organization_pod_start_status(v_pod.league_id) ->> 'snake_start_status', '') = 'scheduled'
     or coalesce(public.get_league_organization_pod_start_status(v_pod.league_id) ->> 'auction_start_status', '') = 'scheduled' then
    raise exception 'Cancel the existing automatic start in Draft Setup before changing this time.';
  end if;

  update public.league_organization_pods
  set label = v_label, updated_at = now()
  where id = v_pod.id;
  update public.leagues
  set name = v_season.name || ' - ' || v_label,
      draft_starts_at = p_draft_starts_at,
      updated_at = now()
  where id = v_pod.league_id;
  update public.league_organization_seasons
  set revision = revision + 1, updated_at = now()
  where id = v_season.id;
  update public.league_organizations
  set revision = revision + 1, updated_at = now()
  where id = v_season.organization_id;
  insert into public.league_organization_audit_events(
    organization_id, season_id, actor_id, kind, payload
  ) values (
    v_season.organization_id,
    v_season.id,
    auth.uid(),
    'pod_plan_updated',
    jsonb_build_object('pod_id', v_pod.id, 'league_id', v_pod.league_id, 'draft_starts_at', p_draft_starts_at)
  );
  return jsonb_build_object('pod_id', v_pod.id, 'label', v_label, 'draft_starts_at', p_draft_starts_at);
exception when unique_violation then
  raise exception 'Every pod label in a season must be unique.';
end;
$$;

create or replace function public.upsert_league_organization_manager_assignment(
  p_season_id uuid,
  p_username text,
  p_pod_id uuid default null,
  p_availability_note text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_season public.league_organization_seasons%rowtype;
  v_target_user uuid;
  v_display_name text;
  v_username text;
  v_previous_pod_id uuid;
  v_previous_league_id uuid;
  v_target_league_id uuid;
  v_previous_membership_id uuid;
  v_state jsonb;
begin
  select * into v_season
  from public.league_organization_seasons
  where id = p_season_id
  for update;
  if not found or not public.is_league_organization_admin(v_season.organization_id) then
    raise exception 'Only organization administrators can plan manager placement.';
  end if;
  if v_season.status <> 'planning' then
    raise exception 'Manager placement can only change while the season is being planned.';
  end if;
  if char_length(coalesce(p_availability_note, '')) > 500 then
    raise exception 'Availability notes must be 500 characters or fewer.';
  end if;
  select profile.id, profile.display_name, profile.username
  into v_target_user, v_display_name, v_username
  from public.profiles profile
  where lower(profile.username) = lower(btrim(coalesce(p_username, '')));
  if v_target_user is null then
    raise exception 'No DraftCenter profile has that username yet.';
  end if;
  if p_pod_id is not null then
    select pod.league_id into v_target_league_id
    from public.league_organization_pods pod
    where pod.id = p_pod_id and pod.season_id = p_season_id;
    if v_target_league_id is null then raise exception 'That pod is not part of this season.'; end if;
    if not public.is_league_staff(v_target_league_id) then
      raise exception 'You must also be a commissioner of the destination pod.';
    end if;
    if exists (
      select 1 from public.draft_sessions session
      where session.league_id = v_target_league_id
        and session.status::text in ('active', 'paused', 'complete')
    ) then
      raise exception 'Managers cannot be placed after the destination pod draft starts.';
    end if;
  end if;

  select assignment.pod_id into v_previous_pod_id
  from public.league_organization_manager_assignments assignment
  where assignment.season_id = p_season_id and assignment.user_id = v_target_user
  for update;

  if v_previous_pod_id is not null and v_previous_pod_id is distinct from p_pod_id then
    select pod.league_id into v_previous_league_id
    from public.league_organization_pods pod
    where pod.id = v_previous_pod_id;
    if not public.is_league_staff(v_previous_league_id) then
      raise exception 'You must also be a commissioner of the manager''s current pod.';
    end if;
    if exists (
      select 1 from public.draft_sessions session
      where session.league_id = v_previous_league_id
        and session.status::text in ('active', 'paused', 'complete')
    ) then
      raise exception 'That manager cannot move after the current pod draft starts.';
    end if;
    select membership.id into v_previous_membership_id
    from public.league_memberships membership
    where membership.league_id = v_previous_league_id and membership.user_id = v_target_user;
    select snapshot.state into v_state
    from public.league_state_snapshots snapshot
    where snapshot.league_id = v_previous_league_id;
    if exists (
      select 1 from public.teams team
      where team.league_id = v_previous_league_id
        and team.owner_membership_id = v_previous_membership_id
    ) or exists (
      select 1 from public.team_assignments assignment
      join public.teams team on team.id = assignment.team_id
      where team.league_id = v_previous_league_id and assignment.assigned_to = v_target_user
    ) or exists (
      select 1
      from jsonb_array_elements(coalesce(v_state -> 'teams', '[]'::jsonb)) team
      where team ->> 'claimedByUserId' = v_target_user::text
         or (
           nullif(lower(btrim(coalesce(team ->> 'claimedBy', ''))), '') is not null
           and lower(btrim(team ->> 'claimedBy')) in (
             lower(coalesce(v_display_name, '')), lower(coalesce(v_username, ''))
           )
         )
    ) then
      raise exception 'Unclaim that manager''s team before moving them to another pod.';
    end if;
    delete from public.league_memberships
    where league_id = v_previous_league_id and user_id = v_target_user and role = 'coach';
  end if;

  insert into public.league_organization_manager_assignments(
    season_id, user_id, pod_id, availability_note, assigned_by
  ) values (
    p_season_id, v_target_user, p_pod_id, btrim(coalesce(p_availability_note, '')), auth.uid()
  )
  on conflict (season_id, user_id) do update
  set pod_id = excluded.pod_id,
      availability_note = excluded.availability_note,
      assigned_by = excluded.assigned_by,
      updated_at = now();

  if v_target_league_id is not null then
    insert into public.league_memberships(league_id, user_id, role)
    values (v_target_league_id, v_target_user, 'coach')
    on conflict (league_id, user_id) do update
    set role = case
      when public.league_memberships.role = 'viewer' then 'coach'::public.membership_role
      else public.league_memberships.role
    end;
  end if;
  update public.league_organization_seasons
  set revision = revision + 1, updated_at = now()
  where id = v_season.id;
  update public.league_organizations
  set revision = revision + 1, updated_at = now()
  where id = v_season.organization_id;
  insert into public.league_organization_audit_events(
    organization_id, season_id, actor_id, kind, payload
  ) values (
    v_season.organization_id,
    v_season.id,
    auth.uid(),
    'manager_placement_updated',
    jsonb_build_object('manager_user_id', v_target_user, 'pod_id', p_pod_id)
  );
  return jsonb_build_object(
    'user_id', v_target_user,
    'username', v_username,
    'display_name', v_display_name,
    'pod_id', p_pod_id,
    'availability_note', btrim(coalesce(p_availability_note, ''))
  );
end;
$$;

create or replace function public.remove_league_organization_manager_assignment(
  p_season_id uuid,
  p_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_season public.league_organization_seasons%rowtype;
  v_pod_id uuid;
  v_league_id uuid;
  v_membership_id uuid;
  v_state jsonb;
  v_display_name text;
  v_username text;
begin
  select * into v_season
  from public.league_organization_seasons
  where id = p_season_id
  for update;
  if not found or not public.is_league_organization_admin(v_season.organization_id) then
    raise exception 'Only organization administrators can remove planned managers.';
  end if;
  if v_season.status <> 'planning' then
    raise exception 'Manager placement can only change while the season is being planned.';
  end if;
  select assignment.pod_id into v_pod_id
  from public.league_organization_manager_assignments assignment
  where assignment.season_id = p_season_id and assignment.user_id = p_user_id
  for update;
  if not found then return false; end if;

  if v_pod_id is not null then
    select pod.league_id into v_league_id
    from public.league_organization_pods pod
    where pod.id = v_pod_id;
    if not public.is_league_staff(v_league_id) then
      raise exception 'You must also be a commissioner of the manager''s pod.';
    end if;
    if exists (
      select 1 from public.draft_sessions session
      where session.league_id = v_league_id
        and session.status::text in ('active', 'paused', 'complete')
    ) then
      raise exception 'That manager cannot be removed after the pod draft starts.';
    end if;
    select membership.id into v_membership_id
    from public.league_memberships membership
    where membership.league_id = v_league_id and membership.user_id = p_user_id;
    select profile.display_name, profile.username into v_display_name, v_username
    from public.profiles profile where profile.id = p_user_id;
    select snapshot.state into v_state
    from public.league_state_snapshots snapshot where snapshot.league_id = v_league_id;
    if exists (
      select 1 from public.teams team
      where team.league_id = v_league_id and team.owner_membership_id = v_membership_id
    ) or exists (
      select 1 from public.team_assignments assignment
      join public.teams team on team.id = assignment.team_id
      where team.league_id = v_league_id and assignment.assigned_to = p_user_id
    ) or exists (
      select 1
      from jsonb_array_elements(coalesce(v_state -> 'teams', '[]'::jsonb)) team
      where team ->> 'claimedByUserId' = p_user_id::text
         or (
           nullif(lower(btrim(coalesce(team ->> 'claimedBy', ''))), '') is not null
           and lower(btrim(team ->> 'claimedBy')) in (
             lower(coalesce(v_display_name, '')), lower(coalesce(v_username, ''))
           )
         )
    ) then
      raise exception 'Unclaim that manager''s team before removing them from the season.';
    end if;
    delete from public.league_memberships
    where league_id = v_league_id and user_id = p_user_id and role = 'coach';
  end if;

  delete from public.league_organization_manager_assignments
  where season_id = p_season_id and user_id = p_user_id;
  update public.league_organization_seasons
  set revision = revision + 1, updated_at = now()
  where id = v_season.id;
  update public.league_organizations
  set revision = revision + 1, updated_at = now()
  where id = v_season.organization_id;
  insert into public.league_organization_audit_events(
    organization_id, season_id, actor_id, kind, payload
  ) values (
    v_season.organization_id,
    v_season.id,
    auth.uid(),
    'manager_placement_removed',
    jsonb_build_object('manager_user_id', p_user_id, 'pod_id', v_pod_id)
  );
  return true;
end;
$$;

create or replace function public.get_league_organization_planning_workspace(
  p_organization_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case
    when not public.is_league_organization_admin(p_organization_id) then null
    else jsonb_build_object(
      'seasons', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', season.id,
          'planned_pod_count', season.planned_pod_count,
          'pods', coalesce((
            select jsonb_agg(jsonb_build_object(
              'id', pod.id,
              'draft_starts_at', league.draft_starts_at,
              'can_manage_plan', public.is_league_staff(pod.league_id),
              'snake_start_status', public.get_league_organization_pod_start_status(pod.league_id) ->> 'snake_start_status',
              'auction_start_status', public.get_league_organization_pod_start_status(pod.league_id) ->> 'auction_start_status'
            ) order by pod.sort_order)
            from public.league_organization_pods pod
            join public.leagues league on league.id = pod.league_id
            where pod.season_id = season.id
          ), '[]'::jsonb),
          'managers', coalesce((
            select jsonb_agg(jsonb_build_object(
              'user_id', profile.id,
              'username', profile.username,
              'display_name', profile.display_name,
              'pod_id', assignment.pod_id,
              'availability_note', assignment.availability_note
            ) order by coalesce(profile.display_name, profile.username))
            from public.league_organization_manager_assignments assignment
            join public.profiles profile on profile.id = assignment.user_id
            where assignment.season_id = season.id
          ), '[]'::jsonb)
        ) order by season.created_at desc)
        from public.league_organization_seasons season
        where season.organization_id = p_organization_id
      ), '[]'::jsonb)
    )
  end;
$$;

create or replace function public.launch_league_organization_season(
  p_season_id uuid,
  p_expected_revision bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_season public.league_organization_seasons%rowtype;
  v_pod_count integer;
begin
  select * into v_season from public.league_organization_seasons where id = p_season_id for update;
  if not found or not public.is_league_organization_admin(v_season.organization_id) then
    raise exception 'Only organization administrators can launch a season.';
  end if;
  if v_season.status <> 'planning' then raise exception 'Only a planning season can be launched.'; end if;
  if p_expected_revision is null or v_season.revision <> p_expected_revision then
    raise exception 'The organization season changed in another session. Refresh before launching.';
  end if;
  select count(*) into v_pod_count from public.league_organization_pods where season_id = v_season.id;
  if v_pod_count < v_season.planned_pod_count then
    raise exception 'Attach every planned pod before launching the season.';
  end if;
  if exists (
    select 1 from public.league_organization_pods pod
    where pod.season_id = v_season.id and pod.regulations_status <> 'confirmed'
  ) then raise exception 'Every pod must confirm the shared regulations before launch.';
  end if;
  if exists (
    select 1
    from public.league_organization_pods pod
    left join public.league_state_snapshots snapshot on snapshot.league_id = pod.league_id
    where pod.season_id = v_season.id
      and (
        snapshot.league_id is null
        or snapshot.revision <> pod.attached_state_revision
        or coalesce((snapshot.state ->> 'seasonNumber')::integer, 1) <> pod.league_season_number
      )
  ) then raise exception 'A pod changed after regulations were confirmed. Review each changed pod again.';
  end if;
  update public.league_organization_seasons
  set status = 'active', revision = revision + 1, updated_at = now()
  where id = v_season.id returning * into v_season;
  update public.league_organization_pods
  set status = 'active', updated_at = now()
  where season_id = v_season.id;
  update public.league_organizations
  set revision = revision + 1, updated_at = now()
  where id = v_season.organization_id;
  insert into public.league_organization_audit_events(organization_id, season_id, actor_id, kind, payload)
  values (
    v_season.organization_id, v_season.id, auth.uid(), 'season_launched',
    jsonb_build_object('pod_count', v_pod_count, 'planned_pod_count', v_season.planned_pod_count)
  );
  return jsonb_build_object('season_id', v_season.id, 'status', v_season.status, 'revision', v_season.revision);
end;
$$;

revoke all on function public.create_planned_league_organization_season(uuid,text,jsonb,integer,integer,text[],jsonb) from public, anon, authenticated;
revoke all on function public.get_league_organization_pod_start_status(uuid) from public, anon, authenticated;
revoke all on function public.update_league_organization_pod_plan(uuid,text,timestamptz) from public, anon, authenticated;
revoke all on function public.upsert_league_organization_manager_assignment(uuid,text,uuid,text) from public, anon, authenticated;
revoke all on function public.remove_league_organization_manager_assignment(uuid,uuid) from public, anon, authenticated;
revoke all on function public.get_league_organization_planning_workspace(uuid) from public, anon, authenticated;

grant execute on function public.create_planned_league_organization_season(uuid,text,jsonb,integer,integer,text[],jsonb) to authenticated;
grant execute on function public.update_league_organization_pod_plan(uuid,text,timestamptz) to authenticated;
grant execute on function public.upsert_league_organization_manager_assignment(uuid,text,uuid,text) to authenticated;
grant execute on function public.remove_league_organization_manager_assignment(uuid,uuid) to authenticated;
grant execute on function public.get_league_organization_planning_workspace(uuid) to authenticated;

notify pgrst, 'reload schema';

commit;
