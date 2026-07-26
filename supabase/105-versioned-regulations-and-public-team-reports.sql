-- Shared, versioned regulation catalog and privacy-safe public team reports.
-- Catalog rows are immutable references: published reports retain the exact
-- version selected when they were created.

begin;

create table if not exists public.regulation_series (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9-]{1,79}$'),
  name text not null check (char_length(name) between 1 and 120),
  game text not null check (char_length(game) between 1 and 120),
  format text not null check (char_length(format) between 1 and 80),
  created_at timestamptz not null default now()
);

create table if not exists public.regulation_versions (
  id uuid primary key default gen_random_uuid(),
  series_id text not null references public.regulation_series(id) on delete restrict,
  version integer not null check (version > 0),
  label text not null check (char_length(label) between 1 and 160),
  effective_from date,
  effective_until date,
  roster_rules jsonb not null default '{}'::jsonb,
  legal_pokemon jsonb not null default '[]'::jsonb,
  banned_pokemon jsonb not null default '[]'::jsonb,
  restrictions jsonb not null default '{}'::jsonb,
  clauses jsonb not null default '[]'::jsonb,
  source_urls jsonb not null default '[]'::jsonb,
  source_verified boolean not null default false,
  published_at timestamptz not null default now(),
  retired_at timestamptz,
  unique (series_id, version),
  check (effective_until is null or effective_from is null or effective_until >= effective_from),
  check (jsonb_typeof(roster_rules) = 'object'),
  check (jsonb_typeof(legal_pokemon) = 'array'),
  check (jsonb_typeof(banned_pokemon) = 'array'),
  check (jsonb_typeof(restrictions) = 'object'),
  check (jsonb_typeof(clauses) = 'array'),
  check (jsonb_typeof(source_urls) = 'array')
);

alter table public.personal_teams
  add column if not exists regulation_version_id uuid references public.regulation_versions(id) on delete restrict,
  add column if not exists custom_regulation_name text;

create table if not exists public.public_team_reports (
  id uuid primary key default gen_random_uuid(),
  personal_team_id uuid not null unique references public.personal_teams(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  slug text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 16),
  regulation_version_id uuid references public.regulation_versions(id) on delete restrict,
  public_snapshot jsonb not null,
  published_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unpublished_at timestamptz,
  check (jsonb_typeof(public_snapshot) = 'object'),
  check (not (public_snapshot ?| array['notes','weekly_notes','planning_entries','replica_code','spreadsheet_url','owner_id']))
);

create table if not exists public.public_team_destinations (
  report_id uuid not null references public.public_team_reports(id) on delete cascade,
  destination text not null check (destination in ('community', 'weekly', 'tournament')),
  active boolean not null default true,
  published_at timestamptz not null default now(),
  unpublished_at timestamptz,
  primary key (report_id, destination)
);

create index if not exists public_team_destinations_active_idx
  on public.public_team_destinations (destination, active, published_at desc);

alter table public.regulation_series enable row level security;
alter table public.regulation_versions enable row level security;
alter table public.public_team_reports enable row level security;
alter table public.public_team_destinations enable row level security;

revoke all on table public.regulation_series, public.regulation_versions,
  public.public_team_reports, public.public_team_destinations
  from public, anon, authenticated;
grant select on table public.regulation_series, public.regulation_versions to anon, authenticated;
grant select on table public.public_team_reports, public.public_team_destinations to authenticated;

drop policy if exists "Anyone reads regulation series" on public.regulation_series;
create policy "Anyone reads regulation series" on public.regulation_series
  for select to anon, authenticated using (true);
drop policy if exists "Anyone reads regulation versions" on public.regulation_versions;
create policy "Anyone reads regulation versions" on public.regulation_versions
  for select to anon, authenticated using (true);

drop policy if exists "Owners read their safe team reports" on public.public_team_reports;
create policy "Owners read their safe team reports" on public.public_team_reports
  for select to authenticated using (owner_id = auth.uid());
drop policy if exists "Owners read their team destinations" on public.public_team_destinations;
create policy "Owners read their team destinations" on public.public_team_destinations
  for select to authenticated using (
    exists (
      select 1 from public.public_team_reports report
      where report.id = report_id and report.owner_id = auth.uid()
    )
  );

create or replace function public.sync_public_personal_team_destinations(
  p_team_id uuid,
  p_destinations text[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team public.personal_teams%rowtype;
  v_report public.public_team_reports%rowtype;
  v_destination text;
  v_destinations text[] := coalesce(p_destinations, array[]::text[]);
begin
  select * into v_team
  from public.personal_teams
  where id = p_team_id and owner_id = auth.uid()
  for update;
  if not found then raise exception 'Personal team not found.'; end if;
  if exists (
    select 1 from unnest(v_destinations) requested(value)
    where requested.value not in ('community', 'weekly', 'tournament')
  ) then raise exception 'Unknown publication destination.'; end if;

  insert into public.public_team_reports (
    personal_team_id, owner_id, regulation_version_id, public_snapshot,
    published_at, updated_at, unpublished_at
  ) values (
    v_team.id,
    v_team.owner_id,
    v_team.regulation_version_id,
    jsonb_strip_nulls(jsonb_build_object(
      'team_name', v_team.team_name,
      'league_name', v_team.league_name,
      'format_name', v_team.format_name,
      'custom_regulation_name', v_team.custom_regulation_name,
      'workspace_type', v_team.workspace_type,
      'pokemon', v_team.pokemon,
      'pokepaste_url', v_team.pokepaste_url
    )),
    now(), now(),
    case when cardinality(v_destinations) = 0 then now() else null end
  )
  on conflict (personal_team_id) do update
    set regulation_version_id = excluded.regulation_version_id,
        public_snapshot = excluded.public_snapshot,
        updated_at = now(),
        unpublished_at = excluded.unpublished_at
  returning * into v_report;

  update public.public_team_destinations
    set active = false, unpublished_at = now()
  where report_id = v_report.id
    and not (destination = any(v_destinations));

  foreach v_destination in array v_destinations loop
    insert into public.public_team_destinations (
      report_id, destination, active, published_at, unpublished_at
    ) values (v_report.id, v_destination, true, now(), null)
    on conflict (report_id, destination) do update
      set active = true, published_at = now(), unpublished_at = null;
  end loop;

  return jsonb_build_object(
    'id', v_report.id,
    'slug', v_report.slug,
    'destinations', to_jsonb(v_destinations)
  );
end;
$$;

create or replace function public.get_public_team_directory(p_destination text default null)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'slug', report.slug,
    'snapshot', report.public_snapshot,
    'published_at', report.published_at,
    'updated_at', report.updated_at,
    'regulation', case when version.id is null then null else jsonb_build_object(
      'id', version.id,
      'series_id', version.series_id,
      'version', version.version,
      'label', version.label,
      'effective_from', version.effective_from,
      'effective_until', version.effective_until
    ) end,
    'destinations', (
      select jsonb_agg(destination.destination order by destination.destination)
      from public.public_team_destinations destination
      where destination.report_id = report.id and destination.active
    )
  ) order by report.updated_at desc), '[]'::jsonb)
  from public.public_team_reports report
  left join public.regulation_versions version on version.id = report.regulation_version_id
  where report.unpublished_at is null
    and exists (
      select 1 from public.public_team_destinations destination
      where destination.report_id = report.id
        and destination.active
        and (p_destination is null or destination.destination = p_destination)
    );
$$;

revoke all on function public.sync_public_personal_team_destinations(uuid, text[])
  from public, anon, authenticated;
grant execute on function public.sync_public_personal_team_destinations(uuid, text[])
  to authenticated;
revoke all on function public.get_public_team_directory(text)
  from public, anon, authenticated;
grant execute on function public.get_public_team_directory(text)
  to anon, authenticated;

insert into public.regulation_series (id, name, game, format) values
  ('sv-vgc', 'Scarlet & Violet VGC', 'Pokémon Scarlet & Violet', 'VGC'),
  ('champions-vgc', 'Pokémon Champions VGC', 'Pokémon Champions', 'VGC'),
  ('custom', 'Custom', 'Custom', 'Custom')
on conflict (id) do nothing;

insert into public.regulation_versions (
  series_id, version, label, effective_from, effective_until,
  restrictions, source_verified
) values
  ('sv-vgc', 1, 'Regulation A', '2023-01-02', '2023-01-31', '{"legacy_id":"reg-a"}', false),
  ('sv-vgc', 2, 'Regulation B', '2023-02-01', '2023-03-31', '{"legacy_id":"reg-b"}', false),
  ('sv-vgc', 3, 'Regulation C', '2023-04-01', '2023-06-30', '{"legacy_id":"reg-c"}', false),
  ('sv-vgc', 4, 'Regulation D', '2023-07-01', '2023-09-30', '{"legacy_id":"reg-d"}', false),
  ('sv-vgc', 5, 'Regulation E', '2023-10-01', '2024-01-03', '{"legacy_id":"reg-e"}', false),
  ('sv-vgc', 6, 'Regulation F', '2024-01-04', '2024-04-30', '{"legacy_id":"reg-f"}', false),
  ('sv-vgc', 7, 'Regulation G', '2024-05-01', '2024-08-31', '{"legacy_id":"reg-g"}', false),
  ('sv-vgc', 8, 'Regulation H', '2024-09-01', '2025-01-05', '{"legacy_id":"reg-h"}', false),
  ('sv-vgc', 9, 'Regulation I', '2025-05-01', '2025-08-31', '{"legacy_id":"reg-i"}', false),
  ('sv-vgc', 10, 'Regulation J', '2025-09-01', '2026-01-04', '{"legacy_id":"reg-j"}', false),
  ('champions-vgc', 1, 'Regulation M-A', '2026-04-08', '2026-06-17', '{"legacy_id":"reg-ma"}', false),
  ('champions-vgc', 2, 'Regulation M-B', '2026-06-17', '2026-09-02', '{"legacy_id":"reg-mb"}', false),
  ('custom', 1, 'Custom', null, null, '{"legacy_id":"custom"}', false)
on conflict (series_id, version) do nothing;

commit;
notify pgrst, 'reload schema';
