-- Private account-wide personal team workspaces.
-- Intentionally independent from leagues and archived league history.
begin;

create table if not exists public.personal_teams (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  team_name text not null check (char_length(btrim(team_name)) between 1 and 120),
  league_name text check (league_name is null or char_length(league_name) <= 120),
  format_name text check (format_name is null or char_length(format_name) <= 100),
  notes text not null default '' check (char_length(notes) <= 20000),
  weekly_notes text not null default '' check (char_length(weekly_notes) <= 30000),
  pokepaste_url text,
  replica_code text not null default '' check (char_length(replica_code) <= 5000),
  spreadsheet_url text,
  pokemon jsonb not null default '[]'::jsonb,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (pokepaste_url is null or pokepaste_url ~ '^https?://'),
  check (spreadsheet_url is null or spreadsheet_url ~ '^https?://'),
  check (jsonb_typeof(pokemon) = 'array' and jsonb_array_length(pokemon) <= 20)
);

create index if not exists personal_teams_owner_updated_idx on public.personal_teams (owner_id, updated_at desc);
alter table public.personal_teams enable row level security;
revoke all on table public.personal_teams from public, anon, authenticated;
grant select, insert, update, delete on table public.personal_teams to authenticated;

drop policy if exists "Owners read their personal teams" on public.personal_teams;
create policy "Owners read their personal teams" on public.personal_teams for select to authenticated using (owner_id = auth.uid());
drop policy if exists "Owners create their personal teams" on public.personal_teams;
create policy "Owners create their personal teams" on public.personal_teams for insert to authenticated with check (owner_id = auth.uid());
drop policy if exists "Owners update their personal teams" on public.personal_teams;
create policy "Owners update their personal teams" on public.personal_teams for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "Owners delete their personal teams" on public.personal_teams;
create policy "Owners delete their personal teams" on public.personal_teams for delete to authenticated using (owner_id = auth.uid());

create or replace function public.set_personal_team_updated_at()
returns trigger language plpgsql security invoker set search_path = ''
as $$ begin new.updated_at = now(); return new; end; $$;
revoke all on function public.set_personal_team_updated_at() from public, anon, authenticated;
drop trigger if exists personal_teams_set_updated_at on public.personal_teams;
create trigger personal_teams_set_updated_at before update on public.personal_teams for each row execute function public.set_personal_team_updated_at();

commit;
notify pgrst, 'reload schema';
