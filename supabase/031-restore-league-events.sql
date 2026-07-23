-- DraftCenter milestone 12: restore the missing league event feed.
--
-- Live draft functions record starts, picks, pauses, and other shared changes
-- here. Some remote projects received later draft migrations without this
-- table from migration 004.

create table if not exists public.league_events (
  id bigint generated always as identity primary key,
  league_id uuid not null references public.leagues(id) on delete cascade,
  kind text not null,
  actor_id uuid references public.profiles(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists league_events_feed_idx
  on public.league_events (league_id, id desc);

alter table public.league_events enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'league_events'
      and policyname = 'members read league events'
  ) then
    create policy "members read league events"
      on public.league_events
      for select
      to authenticated
      using (public.is_league_member(league_id));
  end if;
end;
$$;

grant select on public.league_events to authenticated;

do $$
begin
  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'league_events'
  ) then
    alter publication supabase_realtime add table public.league_events;
  end if;
end;
$$;
