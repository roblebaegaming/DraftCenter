-- Repair deployments where later lifecycle migrations are installed but the
-- auction ownership table from migration 032 is absent. Several reset,
-- rollover, snapshot-save, and auction functions depend on this relation.

begin;

create table if not exists public.auction_team_owners (
  league_id uuid not null references public.leagues(id) on delete cascade,
  team_index integer not null check (team_index >= 0),
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (league_id, team_index),
  unique (league_id, user_id)
);

alter table public.auction_team_owners enable row level security;

drop policy if exists "members read auction team owners"
  on public.auction_team_owners;
create policy "members read auction team owners"
  on public.auction_team_owners
  for select
  to authenticated
  using (public.is_league_member(league_id));

revoke all on table public.auction_team_owners
  from public, anon;
grant select on table public.auction_team_owners
  to authenticated;

commit;

notify pgrst, 'reload schema';
