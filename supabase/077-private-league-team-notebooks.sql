-- Private manager notebooks. Rows are visible and writable only by their owner.

begin;

create table if not exists public.private_league_team_notebooks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  league_id uuid not null references public.leagues(id) on delete cascade,
  team_source_key text not null,
  week_number integer not null check (week_number between 0 and 100),
  notes text not null default '' check (char_length(notes) <= 20000),
  pokepaste_url text,
  replica_code text not null default '' check (char_length(replica_code) <= 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, league_id, team_source_key, week_number),
  check (
    pokepaste_url is null
    or pokepaste_url = ''
    or pokepaste_url ~ '^https://pokepast\.es/[A-Za-z0-9]+/?$'
  )
);

alter table public.private_league_team_notebooks enable row level security;

revoke all on table public.private_league_team_notebooks
  from public, anon, authenticated;

grant select, insert, update, delete
  on table public.private_league_team_notebooks
  to authenticated;

drop policy if exists "Managers read only their private league notebooks"
  on public.private_league_team_notebooks;
create policy "Managers read only their private league notebooks"
  on public.private_league_team_notebooks
  for select
  to authenticated
  using (
    user_id = auth.uid()
    and public.is_league_member(league_id)
  );

drop policy if exists "Managers create only their private league notebooks"
  on public.private_league_team_notebooks;
create policy "Managers create only their private league notebooks"
  on public.private_league_team_notebooks
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and public.is_league_member(league_id)
  );

drop policy if exists "Managers update only their private league notebooks"
  on public.private_league_team_notebooks;
create policy "Managers update only their private league notebooks"
  on public.private_league_team_notebooks
  for update
  to authenticated
  using (
    user_id = auth.uid()
    and public.is_league_member(league_id)
  )
  with check (
    user_id = auth.uid()
    and public.is_league_member(league_id)
  );

drop policy if exists "Managers delete only their private league notebooks"
  on public.private_league_team_notebooks;
create policy "Managers delete only their private league notebooks"
  on public.private_league_team_notebooks
  for delete
  to authenticated
  using (
    user_id = auth.uid()
    and public.is_league_member(league_id)
  );

commit;

notify pgrst, 'reload schema';
