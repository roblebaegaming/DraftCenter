-- Commissioner workspace controls for multi-pod league organizations.
-- Direct browser table access remains disabled. Every mutation is bounded,
-- revision-aware, and recorded in the organization audit history.

begin;

alter table public.league_organizations
  add column image_url text,
  add column brand_color text not null default '#4fd1c5';

alter table public.league_organizations
  add constraint league_organizations_image_url_check
    check (image_url is null or (char_length(image_url) <= 2048 and image_url ~ '^https://')),
  add constraint league_organizations_brand_color_check
    check (brand_color ~ '^#[0-9a-fA-F]{6}$');

create table public.league_organization_administrator_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.league_organizations(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  created_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null,
  accepted_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > created_at),
  check ((accepted_at is null and accepted_by is null) or (accepted_at is not null and accepted_by is not null)),
  check (accepted_at is null or revoked_at is null)
);

create index league_organization_admin_invites_active_idx
  on public.league_organization_administrator_invites(organization_id, expires_at desc)
  where accepted_at is null and revoked_at is null;

alter table public.league_organization_administrator_invites enable row level security;
revoke all on public.league_organization_administrator_invites from public, anon, authenticated;
grant all on public.league_organization_administrator_invites to service_role;

create or replace function public.is_league_organization_owner(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.league_organizations organization
    where organization.id = p_organization_id
      and organization.owner_id = auth.uid()
  );
$$;

create or replace function public.update_league_organization(
  p_organization_id uuid,
  p_expected_revision bigint,
  p_name text,
  p_description text default '',
  p_visibility text default 'private',
  p_image_url text default null,
  p_brand_color text default '#4fd1c5'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_organization public.league_organizations%rowtype;
  v_name text := btrim(coalesce(p_name, ''));
  v_image_url text := nullif(btrim(coalesce(p_image_url, '')), '');
  v_brand_color text := lower(btrim(coalesce(p_brand_color, '')));
begin
  select * into v_organization
  from public.league_organizations
  where id = p_organization_id
  for update;
  if not found or not public.is_league_organization_admin(p_organization_id) then
    raise exception 'Only organization administrators can update organization details.';
  end if;
  if p_expected_revision is null or v_organization.revision <> p_expected_revision then
    raise exception 'The organization changed in another session. Refresh before saving again.';
  end if;
  if char_length(v_name) not between 2 and 120
     or char_length(coalesce(p_description, '')) > 4000
     or p_visibility is null
     or p_visibility not in ('private', 'public')
     or (v_image_url is not null and (char_length(v_image_url) > 2048 or v_image_url !~ '^https://'))
     or v_brand_color !~ '^#[0-9a-f]{6}$' then
    raise exception 'Organization settings are invalid.';
  end if;

  update public.league_organizations
  set name = v_name,
      description = coalesce(p_description, ''),
      visibility = p_visibility,
      image_url = v_image_url,
      brand_color = v_brand_color,
      revision = revision + 1,
      updated_at = now()
  where id = p_organization_id
  returning * into v_organization;

  insert into public.league_organization_audit_events(organization_id, actor_id, kind, payload)
  values (
    p_organization_id,
    auth.uid(),
    'organization_updated',
    jsonb_build_object('visibility', p_visibility, 'has_image', v_image_url is not null)
  );
  return jsonb_build_object(
    'id', v_organization.id,
    'slug', v_organization.slug,
    'revision', v_organization.revision
  );
end;
$$;

create or replace function public.create_league_organization_administrator_invite(
  p_organization_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_token text := encode(gen_random_bytes(24), 'hex');
  v_id uuid;
  v_expires_at timestamptz := now() + interval '7 days';
begin
  if not public.is_league_organization_owner(p_organization_id) then
    raise exception 'Only the organization owner can invite administrators.';
  end if;
  if (
    select count(*)
    from public.league_organization_administrator_invites invitation
    where invitation.organization_id = p_organization_id
      and invitation.accepted_at is null
      and invitation.revoked_at is null
      and invitation.expires_at > now()
  ) >= 10 then
    raise exception 'Revoke or wait for an existing administrator invitation before creating another.';
  end if;

  insert into public.league_organization_administrator_invites(
    organization_id, token_hash, created_by, expires_at
  ) values (
    p_organization_id,
    encode(digest(v_token, 'sha256'), 'hex'),
    auth.uid(),
    v_expires_at
  ) returning id into v_id;

  insert into public.league_organization_audit_events(organization_id, actor_id, kind, payload)
  values (
    p_organization_id,
    auth.uid(),
    'administrator_invite_created',
    jsonb_build_object('invite_id', v_id, 'expires_at', v_expires_at)
  );
  return jsonb_build_object('id', v_id, 'token', v_token, 'expires_at', v_expires_at);
end;
$$;

create or replace function public.preview_league_organization_administrator_invite(
  p_token text
)
returns jsonb
language sql
stable
security definer
set search_path = public, extensions
as $$
  select case
    when coalesce(p_token, '') !~ '^[0-9a-f]{48}$' then null
    else (
      select jsonb_build_object(
        'organization_id', organization.id,
        'organization_name', organization.name,
        'organization_slug', organization.slug,
        'role', 'administrator',
        'expires_at', invitation.expires_at
      )
      from public.league_organization_administrator_invites invitation
      join public.league_organizations organization on organization.id = invitation.organization_id
      where invitation.token_hash = encode(digest(p_token, 'sha256'), 'hex')
        and invitation.accepted_at is null
        and invitation.revoked_at is null
        and invitation.expires_at > now()
    )
  end;
$$;

create or replace function public.accept_league_organization_administrator_invite(
  p_token text
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_invitation public.league_organization_administrator_invites%rowtype;
begin
  if auth.uid() is null then raise exception 'Sign in to accept this invitation.'; end if;
  if coalesce(p_token, '') !~ '^[0-9a-f]{48}$' then raise exception 'This administrator invitation is invalid.'; end if;

  select * into v_invitation
  from public.league_organization_administrator_invites invitation
  where invitation.token_hash = encode(digest(p_token, 'sha256'), 'hex')
  for update;
  if not found
     or v_invitation.accepted_at is not null
     or v_invitation.revoked_at is not null
     or v_invitation.expires_at <= now() then
    raise exception 'This administrator invitation is invalid or expired.';
  end if;

  insert into public.league_organization_memberships(organization_id, user_id, role)
  values (v_invitation.organization_id, auth.uid(), 'administrator')
  on conflict (organization_id, user_id) do update
  set role = case
    when league_organization_memberships.role = 'owner' then 'owner'
    else 'administrator'
  end;

  update public.league_organization_administrator_invites
  set accepted_by = auth.uid(), accepted_at = now()
  where id = v_invitation.id;
  update public.league_organizations
  set revision = revision + 1, updated_at = now()
  where id = v_invitation.organization_id;
  insert into public.league_organization_audit_events(organization_id, actor_id, kind, payload)
  values (
    v_invitation.organization_id,
    auth.uid(),
    'administrator_invite_accepted',
    jsonb_build_object('invite_id', v_invitation.id)
  );
  return v_invitation.organization_id;
end;
$$;

create or replace function public.revoke_league_organization_administrator_invite(
  p_organization_id uuid,
  p_invitation_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_league_organization_owner(p_organization_id) then
    raise exception 'Only the organization owner can revoke administrator invitations.';
  end if;
  update public.league_organization_administrator_invites
  set revoked_at = now()
  where id = p_invitation_id
    and organization_id = p_organization_id
    and accepted_at is null
    and revoked_at is null;
  if not found then raise exception 'That administrator invitation is no longer active.'; end if;
  insert into public.league_organization_audit_events(organization_id, actor_id, kind, payload)
  values (
    p_organization_id,
    auth.uid(),
    'administrator_invite_revoked',
    jsonb_build_object('invite_id', p_invitation_id)
  );
end;
$$;

create or replace function public.remove_league_organization_administrator(
  p_organization_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_league_organization_owner(p_organization_id) then
    raise exception 'Only the organization owner can remove administrators.';
  end if;
  delete from public.league_organization_memberships
  where organization_id = p_organization_id
    and user_id = p_user_id
    and role = 'administrator';
  if not found then raise exception 'That administrator membership was not found.'; end if;
  update public.league_organizations
  set revision = revision + 1, updated_at = now()
  where id = p_organization_id;
  insert into public.league_organization_audit_events(organization_id, actor_id, kind, payload)
  values (
    p_organization_id,
    auth.uid(),
    'administrator_removed',
    jsonb_build_object('removed_user_id', p_user_id)
  );
end;
$$;

create or replace function public.confirm_league_organization_pod_regulations(
  p_pod_id uuid,
  p_expected_season_revision bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pod public.league_organization_pods%rowtype;
  v_season public.league_organization_seasons%rowtype;
  v_snapshot public.league_state_snapshots%rowtype;
begin
  select * into v_pod from public.league_organization_pods where id = p_pod_id for update;
  if not found then raise exception 'That pod was not found.'; end if;
  select * into v_season from public.league_organization_seasons where id = v_pod.season_id for update;
  if not public.is_league_organization_admin(v_season.organization_id)
     or not public.is_league_staff(v_pod.league_id) then
    raise exception 'Confirming shared regulations requires organization and source-league authority.';
  end if;
  if v_season.status <> 'planning' then raise exception 'Regulations can only be confirmed while the season is being planned.'; end if;
  if p_expected_season_revision is null or v_season.revision <> p_expected_season_revision then
    raise exception 'The organization season changed in another session. Refresh before confirming regulations.';
  end if;
  select * into v_snapshot from public.league_state_snapshots where league_id = v_pod.league_id for update;
  if not found
     or coalesce((v_snapshot.state ->> 'seasonNumber')::integer, 1) <> v_pod.league_season_number then
    raise exception 'The source league season changed. Refresh before confirming regulations.';
  end if;

  update public.league_organization_pods
  set regulations_status = 'confirmed',
      attached_state_revision = v_snapshot.revision,
      updated_at = now()
  where id = v_pod.id;
  update public.league_organization_seasons
  set revision = revision + 1, updated_at = now()
  where id = v_season.id
  returning * into v_season;
  update public.league_organizations
  set revision = revision + 1, updated_at = now()
  where id = v_season.organization_id;
  insert into public.league_organization_audit_events(organization_id, season_id, actor_id, kind, payload)
  values (
    v_season.organization_id,
    v_season.id,
    auth.uid(),
    'pod_regulations_confirmed',
    jsonb_build_object('pod_id', v_pod.id, 'league_id', v_pod.league_id, 'state_revision', v_snapshot.revision)
  );
  return jsonb_build_object('pod_id', v_pod.id, 'season_revision', v_season.revision);
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
  if v_pod_count < 2 then raise exception 'Attach at least two pods before launching the season.'; end if;
  if exists (
    select 1 from public.league_organization_pods pod
    where pod.season_id = v_season.id and pod.regulations_status <> 'confirmed'
  ) then raise exception 'Every pod must confirm the shared regulations before launch.'; end if;
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
  ) then raise exception 'A pod changed after regulations were confirmed. Review each changed pod again.'; end if;

  update public.league_organization_seasons
  set status = 'active', revision = revision + 1, updated_at = now()
  where id = v_season.id
  returning * into v_season;
  update public.league_organization_pods
  set status = 'active', updated_at = now()
  where season_id = v_season.id;
  update public.league_organizations
  set revision = revision + 1, updated_at = now()
  where id = v_season.organization_id;
  insert into public.league_organization_audit_events(organization_id, season_id, actor_id, kind, payload)
  values (
    v_season.organization_id,
    v_season.id,
    auth.uid(),
    'season_launched',
    jsonb_build_object('pod_count', v_pod_count)
  );
  return jsonb_build_object('season_id', v_season.id, 'status', v_season.status, 'revision', v_season.revision);
end;
$$;

create or replace function public.get_league_organization_workspace(p_organization_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_organization public.league_organizations%rowtype;
  v_is_admin boolean;
  v_is_owner boolean;
begin
  if not public.can_view_league_organization(p_organization_id) then return null; end if;
  select * into v_organization from public.league_organizations where id = p_organization_id;
  if not found then return null; end if;
  v_is_admin := public.is_league_organization_admin(v_organization.id);
  v_is_owner := public.is_league_organization_owner(v_organization.id);

  return jsonb_build_object(
    'organization', jsonb_build_object(
      'id', v_organization.id,
      'slug', v_organization.slug,
      'name', v_organization.name,
      'description', v_organization.description,
      'visibility', v_organization.visibility,
      'image_url', v_organization.image_url,
      'brand_color', v_organization.brand_color,
      'revision', v_organization.revision,
      'is_admin', v_is_admin,
      'is_owner', v_is_owner
    ),
    'administrators', case when v_is_admin then coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id', membership.user_id,
        'role', membership.role,
        'username', profile.username,
        'display_name', profile.display_name
      ) order by case membership.role when 'owner' then 0 else 1 end, membership.created_at)
      from public.league_organization_memberships membership
      left join public.profiles profile on profile.id = membership.user_id
      where membership.organization_id = v_organization.id
    ), '[]'::jsonb) else '[]'::jsonb end,
    'pending_invitations', case when v_is_owner then coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', invitation.id,
        'expires_at', invitation.expires_at,
        'created_at', invitation.created_at
      ) order by invitation.created_at desc)
      from public.league_organization_administrator_invites invitation
      where invitation.organization_id = v_organization.id
        and invitation.accepted_at is null
        and invitation.revoked_at is null
        and invitation.expires_at > now()
    ), '[]'::jsonb) else '[]'::jsonb end,
    'seasons', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', season.id,
          'name', season.name,
          'status', season.status,
          'regulations', season.regulations,
          'qualification_rules', season.qualification_rules,
          'allow_cross_pod_species_duplicates', season.allow_cross_pod_species_duplicates,
          'qualified_teams_keep_rosters', season.qualified_teams_keep_rosters,
          'roster_policy', season.roster_policy,
          'replacement_policy', season.replacement_policy,
          'revision', season.revision,
          'pods', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'id', pod.id,
                'league_id', pod.league_id,
                'league_slug', league.slug,
                'league_name', league.name,
                'label', pod.label,
                'sort_order', pod.sort_order,
                'league_season_number', pod.league_season_number,
                'qualification_spots', pod.qualification_spots,
                'regulations_status', pod.regulations_status,
                'attached_state_revision', pod.attached_state_revision,
                'status', pod.status
              ) order by pod.sort_order
            )
            from public.league_organization_pods pod
            join public.leagues league on league.id = pod.league_id
            where pod.season_id = season.id
          ), '[]'::jsonb)
        ) order by season.created_at desc
      )
      from public.league_organization_seasons season
      where season.organization_id = v_organization.id
        and (v_is_admin or season.status not in ('planning', 'archived'))
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.get_public_league_organization_workspace(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_organization_id uuid;
begin
  select organization.id into v_organization_id
  from public.league_organizations organization
  where organization.slug = btrim(coalesce(p_slug, ''))
    and (organization.visibility = 'public' or public.can_view_league_organization(organization.id));
  if not found then return null; end if;
  return public.get_league_organization_workspace(v_organization_id);
end;
$$;

revoke all on function public.is_league_organization_owner(uuid) from public, anon, authenticated;
revoke all on function public.update_league_organization(uuid,bigint,text,text,text,text,text) from public, anon, authenticated;
revoke all on function public.create_league_organization_administrator_invite(uuid) from public, anon, authenticated;
revoke all on function public.preview_league_organization_administrator_invite(text) from public, anon, authenticated;
revoke all on function public.accept_league_organization_administrator_invite(text) from public, anon, authenticated;
revoke all on function public.revoke_league_organization_administrator_invite(uuid,uuid) from public, anon, authenticated;
revoke all on function public.remove_league_organization_administrator(uuid,uuid) from public, anon, authenticated;
revoke all on function public.confirm_league_organization_pod_regulations(uuid,bigint) from public, anon, authenticated;
revoke all on function public.launch_league_organization_season(uuid,bigint) from public, anon, authenticated;
revoke all on function public.get_public_league_organization_workspace(text) from public, anon, authenticated;

grant execute on function public.is_league_organization_owner(uuid) to authenticated;
grant execute on function public.update_league_organization(uuid,bigint,text,text,text,text,text) to authenticated;
grant execute on function public.create_league_organization_administrator_invite(uuid) to authenticated;
grant execute on function public.preview_league_organization_administrator_invite(text) to anon, authenticated;
grant execute on function public.accept_league_organization_administrator_invite(text) to authenticated;
grant execute on function public.revoke_league_organization_administrator_invite(uuid,uuid) to authenticated;
grant execute on function public.remove_league_organization_administrator(uuid,uuid) to authenticated;
grant execute on function public.confirm_league_organization_pod_regulations(uuid,bigint) to authenticated;
grant execute on function public.launch_league_organization_season(uuid,bigint) to authenticated;
grant execute on function public.get_public_league_organization_workspace(text) to anon, authenticated;

notify pgrst, 'reload schema';

commit;
