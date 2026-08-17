-- Foundation for organization seasons made of independent draft-league pods.
-- This migration does not create, clone, or mutate a league, team, roster,
-- tournament, or result. Future promotion RPCs will snapshot the exact source
-- team and roster into the reserved qualifier tables below.

begin;

create table public.league_organizations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{4,80}$'),
  owner_id uuid not null references auth.users(id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 2 and 120),
  description text not null default '' check (char_length(description) <= 4000),
  visibility text not null default 'private' check (visibility in ('private', 'public')),
  revision bigint not null default 0 check (revision >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.league_organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.league_organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'administrator')),
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table public.league_organization_seasons (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.league_organizations(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 120),
  status text not null default 'planning'
    check (status in ('planning', 'active', 'qualification', 'championship', 'complete', 'archived')),
  regulations jsonb not null default '{}'::jsonb check (jsonb_typeof(regulations) = 'object'),
  qualification_rules jsonb not null check (jsonb_typeof(qualification_rules) = 'object'),
  allow_cross_pod_species_duplicates boolean not null default true
    check (allow_cross_pod_species_duplicates),
  qualified_teams_keep_rosters boolean not null default true
    check (qualified_teams_keep_rosters),
  roster_policy text not null default 'retain-regular-season-roster'
    check (roster_policy = 'retain-regular-season-roster'),
  replacement_policy text not null default 'inherit-source-league'
    check (replacement_policy = 'inherit-source-league'),
  revision bigint not null default 0 check (revision >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id)
);

create table public.league_organization_pods (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.league_organization_seasons(id) on delete cascade,
  league_id uuid not null references public.leagues(id) on delete restrict,
  label text not null check (char_length(btrim(label)) between 1 and 80),
  sort_order smallint not null check (sort_order between 1 and 64),
  league_season_number integer not null check (league_season_number >= 1),
  qualification_spots smallint not null check (qualification_spots between 1 and 16),
  regulations_status text not null default 'pending'
    check (regulations_status in ('pending', 'confirmed', 'out-of-sync')),
  attached_state_revision bigint not null check (attached_state_revision >= 0),
  status text not null default 'planning'
    check (status in ('planning', 'active', 'complete', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (season_id, league_id),
  unique (season_id, sort_order),
  unique (season_id, label),
  unique (id, season_id, league_id)
);

create table public.league_organization_qualifiers (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.league_organization_seasons(id) on delete cascade,
  pod_id uuid not null,
  source_league_id uuid not null,
  source_team_key integer not null check (source_team_key between 0 and 255),
  source_team_id text not null check (char_length(source_team_id) between 1 and 120),
  display_name text not null check (char_length(btrim(display_name)) between 1 and 120),
  manager_user_id uuid references auth.users(id) on delete set null,
  placement smallint check (placement between 1 and 64),
  qualification_kind text not null
    check (qualification_kind in ('pod-finish', 'wildcard', 'commissioner-replacement')),
  status text not null default 'qualified'
    check (status in ('qualified', 'withdrawn', 'replaced')),
  source_state_revision bigint not null check (source_state_revision >= 0),
  source_state_rev bigint not null check (source_state_rev >= 0),
  team_snapshot jsonb not null check (jsonb_typeof(team_snapshot) = 'object'),
  roster_snapshot jsonb not null check (jsonb_typeof(roster_snapshot) = 'array'),
  roster_snapshot_hash text not null check (roster_snapshot_hash ~ '^[0-9a-f]{64}$'),
  qualification_basis jsonb not null default '{}'::jsonb check (jsonb_typeof(qualification_basis) = 'object'),
  qualified_at timestamptz not null default now(),
  replaced_by_id uuid,
  unique (season_id, pod_id, source_team_key),
  unique (id, season_id),
  foreign key (pod_id, season_id, source_league_id)
    references public.league_organization_pods(id, season_id, league_id) on delete restrict,
  foreign key (replaced_by_id, season_id)
    references public.league_organization_qualifiers(id, season_id) on delete restrict,
  check (replaced_by_id is null or replaced_by_id <> id)
);

create table public.league_organization_championships (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null unique references public.league_organization_seasons(id) on delete cascade,
  tournament_id uuid not null unique references public.tournaments(id) on delete restrict,
  format text not null check (format in ('single-elimination', 'double-elimination')),
  status text not null default 'planning'
    check (status in ('planning', 'registration', 'active', 'complete', 'archived')),
  revision bigint not null default 0 check (revision >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, season_id, tournament_id)
);

create table public.league_organization_championship_entrants (
  id uuid primary key default gen_random_uuid(),
  championship_id uuid not null,
  season_id uuid not null,
  tournament_id uuid not null,
  qualifier_id uuid not null,
  tournament_entrant_id uuid not null,
  seed smallint check (seed between 1 and 64),
  created_at timestamptz not null default now(),
  unique (championship_id, qualifier_id),
  unique (tournament_id, tournament_entrant_id),
  unique (championship_id, seed),
  foreign key (championship_id, season_id, tournament_id)
    references public.league_organization_championships(id, season_id, tournament_id) on delete cascade,
  foreign key (qualifier_id, season_id)
    references public.league_organization_qualifiers(id, season_id) on delete restrict,
  foreign key (tournament_entrant_id, tournament_id)
    references public.tournament_entrants(id, tournament_id) on delete restrict
);

create table public.league_organization_audit_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.league_organizations(id) on delete cascade,
  season_id uuid references public.league_organization_seasons(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  kind text not null check (char_length(kind) between 2 and 80),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now()
);

create index league_organizations_owner_updated_idx
  on public.league_organizations(owner_id, updated_at desc);
create index league_organization_memberships_user_idx
  on public.league_organization_memberships(user_id, organization_id);
create index league_organization_seasons_org_idx
  on public.league_organization_seasons(organization_id, created_at desc);
create index league_organization_pods_season_idx
  on public.league_organization_pods(season_id, sort_order);
create index league_organization_pods_league_idx
  on public.league_organization_pods(league_id, season_id);
create index league_organization_qualifiers_season_idx
  on public.league_organization_qualifiers(season_id, pod_id, placement);
create index league_organization_audit_idx
  on public.league_organization_audit_events(organization_id, created_at desc);

alter table public.league_organizations enable row level security;
alter table public.league_organization_memberships enable row level security;
alter table public.league_organization_seasons enable row level security;
alter table public.league_organization_pods enable row level security;
alter table public.league_organization_qualifiers enable row level security;
alter table public.league_organization_championships enable row level security;
alter table public.league_organization_championship_entrants enable row level security;
alter table public.league_organization_audit_events enable row level security;

revoke all on
  public.league_organizations,
  public.league_organization_memberships,
  public.league_organization_seasons,
  public.league_organization_pods,
  public.league_organization_qualifiers,
  public.league_organization_championships,
  public.league_organization_championship_entrants,
  public.league_organization_audit_events
from public, anon, authenticated;

grant all on
  public.league_organizations,
  public.league_organization_memberships,
  public.league_organization_seasons,
  public.league_organization_pods,
  public.league_organization_qualifiers,
  public.league_organization_championships,
  public.league_organization_championship_entrants,
  public.league_organization_audit_events
to service_role;
grant usage, select on sequence public.league_organization_audit_events_id_seq to service_role;

create or replace function public.is_league_organization_admin(p_organization_id uuid)
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
      and (
        organization.owner_id = auth.uid()
        or exists (
          select 1
          from public.league_organization_memberships membership
          where membership.organization_id = organization.id
            and membership.user_id = auth.uid()
            and membership.role in ('owner', 'administrator')
        )
      )
  );
$$;

create or replace function public.can_view_league_organization(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.league_organizations organization
    where organization.id = p_organization_id
      and (
        organization.visibility = 'public'
        or organization.owner_id = auth.uid()
        or exists (
          select 1
          from public.league_organization_memberships membership
          where membership.organization_id = organization.id
            and membership.user_id = auth.uid()
        )
      )
  );
$$;

revoke all on function public.is_league_organization_admin(uuid) from public, anon, authenticated;
revoke all on function public.can_view_league_organization(uuid) from public, anon, authenticated;
grant execute on function public.is_league_organization_admin(uuid) to authenticated;
grant execute on function public.can_view_league_organization(uuid) to anon, authenticated;

create or replace function public.create_league_organization(
  p_name text,
  p_description text default '',
  p_visibility text default 'private'
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_id uuid := gen_random_uuid();
  v_name text := btrim(coalesce(p_name, ''));
  v_slug_base text;
  v_slug text;
begin
  if auth.uid() is null then
    raise exception 'Sign in to create an organization.';
  end if;
  if char_length(v_name) not between 2 and 120
     or char_length(coalesce(p_description, '')) > 4000
     or p_visibility is null
     or p_visibility not in ('private', 'public') then
    raise exception 'Organization settings are invalid.';
  end if;

  v_slug_base := left(trim(both '-' from regexp_replace(lower(v_name), '[^a-z0-9]+', '-', 'g')), 60);
  if v_slug_base = '' then v_slug_base := 'organization'; end if;
  v_slug := v_slug_base || '-' || left(replace(v_id::text, '-', ''), 8);

  insert into public.league_organizations(id, slug, owner_id, name, description, visibility)
  values (v_id, v_slug, auth.uid(), v_name, coalesce(p_description, ''), p_visibility);
  insert into public.league_organization_memberships(organization_id, user_id, role)
  values (v_id, auth.uid(), 'owner');
  insert into public.league_organization_audit_events(organization_id, actor_id, kind)
  values (v_id, auth.uid(), 'organization_created');

  return jsonb_build_object('id', v_id, 'slug', v_slug);
end;
$$;

create or replace function public.create_league_organization_season(
  p_organization_id uuid,
  p_name text,
  p_regulations jsonb default '{}'::jsonb,
  p_top_per_pod integer default 2,
  p_wildcard_slots integer default 0,
  p_tiebreakers text[] default array['wins', 'differential', 'head-to-head']
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_name text := btrim(coalesce(p_name, ''));
begin
  if not public.is_league_organization_admin(p_organization_id) then
    raise exception 'Only organization administrators can create seasons.';
  end if;
  if char_length(v_name) not between 2 and 120
     or p_regulations is null
     or jsonb_typeof(p_regulations) <> 'object'
     or p_top_per_pod is null
     or p_top_per_pod not between 1 and 16
     or p_wildcard_slots is null
     or p_wildcard_slots not between 0 and 32
     or p_tiebreakers is null
     or coalesce(array_length(p_tiebreakers, 1), 0) not between 1 and 5
     or exists (
       select 1
       from unnest(p_tiebreakers) value
       where value not in ('wins', 'differential', 'head-to-head', 'game-win-percentage', 'commissioner-draw')
     ) then
    raise exception 'Season settings are invalid.';
  end if;

  insert into public.league_organization_seasons(
    organization_id,
    name,
    regulations,
    qualification_rules
  ) values (
    p_organization_id,
    v_name,
    p_regulations,
    jsonb_build_object(
      'top_per_pod', p_top_per_pod,
      'wildcard_slots', p_wildcard_slots,
      'tiebreakers', to_jsonb(p_tiebreakers)
    )
  ) returning id into v_id;

  update public.league_organizations
  set revision = revision + 1, updated_at = now()
  where id = p_organization_id;
  insert into public.league_organization_audit_events(
    organization_id, season_id, actor_id, kind, payload
  ) values (
    p_organization_id, v_id, auth.uid(), 'season_created',
    jsonb_build_object('top_per_pod', p_top_per_pod, 'wildcard_slots', p_wildcard_slots)
  );
  return v_id;
end;
$$;

create or replace function public.attach_league_organization_pod(
  p_season_id uuid,
  p_league_id uuid,
  p_label text,
  p_sort_order integer,
  p_league_season_number integer,
  p_qualification_spots integer default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_season public.league_organization_seasons%rowtype;
  v_snapshot public.league_state_snapshots%rowtype;
  v_id uuid;
  v_spots integer;
begin
  select * into v_season
  from public.league_organization_seasons
  where id = p_season_id
  for update;
  if not found or not public.is_league_organization_admin(v_season.organization_id) then
    raise exception 'Only organization administrators can add pods.';
  end if;
  if not public.is_league_staff(p_league_id) then
    raise exception 'You must also be a commissioner of the source league.';
  end if;
  if v_season.status <> 'planning' then
    raise exception 'Pods can only be attached while the organization season is being planned.';
  end if;

  select * into v_snapshot
  from public.league_state_snapshots
  where league_id = p_league_id
  for update;
  if not found then raise exception 'The source league state was not found.'; end if;
  if coalesce((v_snapshot.state ->> 'seasonNumber')::integer, 1) <> p_league_season_number then
    raise exception 'The source league season changed. Refresh before attaching this pod.';
  end if;

  v_spots := coalesce(
    p_qualification_spots,
    (v_season.qualification_rules ->> 'top_per_pod')::integer
  );
  if char_length(btrim(coalesce(p_label, ''))) not between 1 and 80
     or p_sort_order is null
     or p_sort_order not between 1 and 64
     or p_league_season_number is null
     or p_league_season_number < 1
     or v_spots is null
     or v_spots not between 1 and 16 then
    raise exception 'Pod settings are invalid.';
  end if;
  if exists (
    select 1
    from public.league_organization_pods pod
    join public.league_organization_seasons season on season.id = pod.season_id
    where pod.league_id = p_league_id
      and pod.season_id <> p_season_id
      and season.status not in ('complete', 'archived')
  ) then
    raise exception 'That league already belongs to another active organization season.';
  end if;

  insert into public.league_organization_pods(
    season_id,
    league_id,
    label,
    sort_order,
    league_season_number,
    qualification_spots,
    attached_state_revision
  ) values (
    p_season_id,
    p_league_id,
    btrim(p_label),
    p_sort_order,
    p_league_season_number,
    v_spots,
    v_snapshot.revision
  ) returning id into v_id;

  update public.league_organization_seasons
  set revision = revision + 1, updated_at = now()
  where id = p_season_id;
  update public.league_organizations
  set revision = revision + 1, updated_at = now()
  where id = v_season.organization_id;
  insert into public.league_organization_audit_events(
    organization_id, season_id, actor_id, kind, payload
  ) values (
    v_season.organization_id,
    p_season_id,
    auth.uid(),
    'pod_attached',
    jsonb_build_object(
      'pod_id', v_id,
      'league_id', p_league_id,
      'league_season_number', p_league_season_number,
      'qualification_spots', v_spots
    )
  );
  return v_id;
exception when unique_violation then
  raise exception 'That league, pod order, or pod label is already attached.';
end;
$$;

create or replace function public.list_my_league_organizations()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case when auth.uid() is null then '[]'::jsonb else coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', organization.id,
        'slug', organization.slug,
        'name', organization.name,
        'description', organization.description,
        'visibility', organization.visibility,
        'role', membership.role,
        'revision', organization.revision,
        'updated_at', organization.updated_at
      ) order by organization.updated_at desc
    )
    from public.league_organization_memberships membership
    join public.league_organizations organization on organization.id = membership.organization_id
    where membership.user_id = auth.uid()
  ), '[]'::jsonb) end;
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
begin
  if not public.can_view_league_organization(p_organization_id) then return null; end if;
  select * into v_organization from public.league_organizations where id = p_organization_id;
  if not found then return null; end if;

  return jsonb_build_object(
    'organization', jsonb_build_object(
      'id', v_organization.id,
      'slug', v_organization.slug,
      'name', v_organization.name,
      'description', v_organization.description,
      'visibility', v_organization.visibility,
      'revision', v_organization.revision,
      'is_admin', public.is_league_organization_admin(v_organization.id)
    ),
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
        and (season.status <> 'archived' or public.is_league_organization_admin(v_organization.id))
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.create_league_organization(text, text, text) from public, anon, authenticated;
revoke all on function public.create_league_organization_season(uuid, text, jsonb, integer, integer, text[]) from public, anon, authenticated;
revoke all on function public.attach_league_organization_pod(uuid, uuid, text, integer, integer, integer) from public, anon, authenticated;
revoke all on function public.list_my_league_organizations() from public, anon, authenticated;
revoke all on function public.get_league_organization_workspace(uuid) from public, anon, authenticated;
grant execute on function public.create_league_organization(text, text, text) to authenticated;
grant execute on function public.create_league_organization_season(uuid, text, jsonb, integer, integer, text[]) to authenticated;
grant execute on function public.attach_league_organization_pod(uuid, uuid, text, integer, integer, integer) to authenticated;
grant execute on function public.list_my_league_organizations() to authenticated;
grant execute on function public.get_league_organization_workspace(uuid) to anon, authenticated;

notify pgrst, 'reload schema';

commit;
