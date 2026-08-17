-- Open organization membership and private commissioner-to-member email.
-- Recipient addresses are available only to the service-role resolver. Browser
-- APIs receive public directory fields, the viewer's own role, and aggregates.

begin;

alter table public.league_organizations
  add column if not exists membership_policy text not null default 'closed';

alter table public.league_organizations
  drop constraint if exists league_organizations_membership_policy_check;
alter table public.league_organizations
  add constraint league_organizations_membership_policy_check
  check (membership_policy in ('closed', 'open'));

alter table public.league_organization_memberships
  drop constraint if exists league_organization_memberships_role_check;
alter table public.league_organization_memberships
  add constraint league_organization_memberships_role_check
  check (role in ('owner', 'administrator', 'member'));

create index if not exists league_organizations_directory_idx
  on public.league_organizations(membership_policy, visibility, lower(name));
create index if not exists league_organization_memberships_org_role_idx
  on public.league_organization_memberships(organization_id, role, user_id);

alter table public.notification_preferences
  add column if not exists email_member_announcements boolean not null default true;

create table if not exists public.member_email_broadcasts (
  id uuid primary key,
  sender_user_id uuid not null references auth.users(id) on delete restrict,
  scope_type text not null check (scope_type in ('league', 'organization')),
  scope_id uuid not null,
  scope_name text not null check (char_length(scope_name) between 1 and 120),
  subject text not null check (char_length(subject) between 3 and 120),
  recipient_count integer not null default 0 check (recipient_count between 0 and 500),
  submitted_count integer not null default 0 check (submitted_count between 0 and recipient_count),
  provider_batch_count integer not null default 0 check (provider_batch_count between 0 and 5),
  status text not null default 'pending' check (status in ('pending', 'submitted', 'failed')),
  failure_summary text check (failure_summary is null or char_length(failure_summary) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  submitted_at timestamptz
);

create index if not exists member_email_broadcasts_sender_created_idx
  on public.member_email_broadcasts(sender_user_id, created_at desc);
create index if not exists member_email_broadcasts_scope_created_idx
  on public.member_email_broadcasts(scope_type, scope_id, created_at desc);

alter table public.member_email_broadcasts enable row level security;
revoke all on table public.member_email_broadcasts from public, anon, authenticated;
grant select, insert, update on table public.member_email_broadcasts to service_role;

create or replace function public.list_my_league_organizations()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when auth.uid() is null then '[]'::jsonb else coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', organization.id,
        'slug', organization.slug,
        'name', organization.name,
        'description', organization.description,
        'visibility', organization.visibility,
        'membership_policy', organization.membership_policy,
        'role', membership.role,
        'revision', organization.revision,
        'updated_at', organization.updated_at
      ) order by organization.updated_at desc
    )
    from public.league_organization_memberships membership
    join public.league_organizations organization on organization.id = membership.organization_id
    where membership.user_id = auth.uid()
      and membership.role in ('owner', 'administrator')
  ), '[]'::jsonb) end;
$$;

create or replace function public.update_league_organization_membership_policy(
  p_organization_id uuid,
  p_membership_policy text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_policy text := lower(btrim(coalesce(p_membership_policy, '')));
  v_visibility text;
begin
  if not public.is_league_organization_admin(p_organization_id) then
    raise exception 'Only organization owners and administrators can change joining.';
  end if;
  if v_policy not in ('closed', 'open') then
    raise exception 'Organization joining must be open or invite only.';
  end if;

  select visibility into v_visibility
  from public.league_organizations
  where id = p_organization_id
  for update;
  if not found then raise exception 'Organization not found.'; end if;
  if v_policy = 'open' and v_visibility <> 'public' then
    raise exception 'Make the organization public before opening independent joining.';
  end if;

  update public.league_organizations
  set membership_policy = v_policy,
      revision = revision + 1,
      updated_at = now()
  where id = p_organization_id;
  insert into public.league_organization_audit_events(organization_id, actor_id, kind, payload)
  values (p_organization_id, auth.uid(), 'membership_policy_updated', jsonb_build_object('membership_policy', v_policy));
  return v_policy;
end;
$$;

create or replace function public.get_league_organization_directory()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', organization.id,
      'name', organization.name,
      'slug', organization.slug,
      'description', organization.description,
      'visibility', organization.visibility,
      'membership_policy', organization.membership_policy,
      'member_count', (
        select count(*)::integer
        from public.league_organization_memberships counted_member
        where counted_member.organization_id = organization.id
      ),
      'active_season_count', (
        select count(*)::integer
        from public.league_organization_seasons season
        where season.organization_id = organization.id
          and season.status in ('active', 'qualification', 'championship')
      ),
      'my_role', viewer.role
    ) order by lower(organization.name), organization.id
  ), '[]'::jsonb)
  from public.league_organizations organization
  left join public.league_organization_memberships viewer
    on viewer.organization_id = organization.id
   and viewer.user_id = auth.uid()
  where (organization.membership_policy = 'open' and organization.visibility = 'public')
     or viewer.user_id is not null;
$$;

create or replace function public.join_open_league_organization(p_organization_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_policy text;
  v_visibility text;
  v_role text;
begin
  if auth.uid() is null then raise exception 'Sign in to join an organization.'; end if;

  select membership_policy, visibility into v_policy, v_visibility
  from public.league_organizations
  where id = p_organization_id
  for update;
  if not found then raise exception 'Organization not found.'; end if;
  if v_policy <> 'open' or v_visibility <> 'public' then raise exception 'This organization is invite only.'; end if;

  insert into public.league_organization_memberships(organization_id, user_id, role)
  values (p_organization_id, auth.uid(), 'member')
  on conflict (organization_id, user_id) do nothing;

  select role into v_role
  from public.league_organization_memberships
  where organization_id = p_organization_id
    and user_id = auth.uid();
  return v_role;
end;
$$;

create or replace function public.leave_league_organization(p_organization_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Sign in to leave an organization.'; end if;
  if exists (
    select 1
    from public.league_organization_memberships membership
    where membership.organization_id = p_organization_id
      and membership.user_id = auth.uid()
      and membership.role in ('owner', 'administrator')
  ) then
    raise exception 'Organization staff must transfer or remove their staff role before leaving.';
  end if;

  delete from public.league_organization_memberships
  where organization_id = p_organization_id
    and user_id = auth.uid()
    and role = 'member';
  return found;
end;
$$;

-- Service-role-only address resolution. The route authenticates the bearer,
-- then this function independently rechecks the supplied sender and scope.
create or replace function public.resolve_member_email_audience(
  p_sender_user_id uuid,
  p_scope_type text,
  p_scope_id uuid
)
returns table(user_id uuid, email text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_sender_user_id is null or not exists (
    select 1 from auth.users account where account.id = p_sender_user_id
  ) then
    raise exception 'A verified sender is required.';
  end if;

  if p_scope_type = 'league' then
    if not exists (
      select 1
      from public.league_memberships sender_membership
      where sender_membership.league_id = p_scope_id
        and sender_membership.user_id = p_sender_user_id
        and sender_membership.role in ('commissioner', 'co_commissioner')
        and sender_membership.archived_at is null
    ) then
      raise exception 'League commissioner access is required.';
    end if;

    return query
    select distinct member.user_id, account.email::text
    from public.league_memberships member
    join auth.users account on account.id = member.user_id
    left join public.notification_preferences preference on preference.user_id = member.user_id
    where member.league_id = p_scope_id
      and member.role in ('commissioner', 'co_commissioner', 'coach')
      and member.archived_at is null
      and account.email is not null
      and account.email_confirmed_at is not null
      and coalesce(preference.email_member_announcements, true);
    return;
  end if;

  if p_scope_type = 'organization' then
    if not exists (
      select 1
      from public.league_organization_memberships sender_membership
      where sender_membership.organization_id = p_scope_id
        and sender_membership.user_id = p_sender_user_id
        and sender_membership.role in ('owner', 'administrator')
    ) then
      raise exception 'Organization commissioner access is required.';
    end if;

    return query
    select distinct member.user_id, account.email::text
    from public.league_organization_memberships member
    join auth.users account on account.id = member.user_id
    left join public.notification_preferences preference on preference.user_id = member.user_id
    where member.organization_id = p_scope_id
      and account.email is not null
      and account.email_confirmed_at is not null
      and coalesce(preference.email_member_announcements, true);
    return;
  end if;

  raise exception 'Email scope must be a league or organization.';
end;
$$;

revoke all on function public.list_my_league_organizations() from public, anon, authenticated, service_role;
revoke all on function public.update_league_organization_membership_policy(uuid, text) from public, anon, authenticated, service_role;
revoke all on function public.get_league_organization_directory() from public, anon, authenticated, service_role;
revoke all on function public.join_open_league_organization(uuid) from public, anon, authenticated, service_role;
revoke all on function public.leave_league_organization(uuid) from public, anon, authenticated, service_role;
revoke all on function public.resolve_member_email_audience(uuid, text, uuid) from public, anon, authenticated, service_role;

grant execute on function public.list_my_league_organizations() to authenticated, service_role;
grant execute on function public.update_league_organization_membership_policy(uuid, text) to authenticated, service_role;
grant execute on function public.get_league_organization_directory() to anon, authenticated, service_role;
grant execute on function public.join_open_league_organization(uuid) to authenticated, service_role;
grant execute on function public.leave_league_organization(uuid) to authenticated, service_role;
grant execute on function public.resolve_member_email_audience(uuid, text, uuid) to service_role;

notify pgrst, 'reload schema';

commit;
