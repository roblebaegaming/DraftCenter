-- Private personal Pokemon calendar events. League drafts and matchups are
-- derived from existing league data; this table stores user-created events.

begin;

create table if not exists public.pokemon_calendar_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  event_type text not null default 'tournament',
  starts_at timestamptz not null,
  ends_at timestamptz,
  all_day boolean not null default false,
  location text,
  source_url text,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pokemon_calendar_event_type_check
    check (event_type in ('tournament', 'practice', 'registration', 'team_lock', 'lesson', 'other')),
  constraint pokemon_calendar_event_title_check
    check (char_length(btrim(title)) between 1 and 160),
  constraint pokemon_calendar_event_location_check
    check (location is null or char_length(location) <= 300),
  constraint pokemon_calendar_event_url_check
    check (source_url is null or char_length(source_url) <= 2000),
  constraint pokemon_calendar_event_notes_check
    check (char_length(notes) <= 10000),
  constraint pokemon_calendar_event_end_check
    check (ends_at is null or ends_at >= starts_at)
);

create index if not exists pokemon_calendar_events_owner_start_idx
  on public.pokemon_calendar_events (owner_id, starts_at);

alter table public.pokemon_calendar_events enable row level security;
revoke all on table public.pokemon_calendar_events from public, anon, authenticated;
grant select, insert, update, delete on table public.pokemon_calendar_events to authenticated;

drop policy if exists "Owners read their calendar events" on public.pokemon_calendar_events;
create policy "Owners read their calendar events"
  on public.pokemon_calendar_events for select to authenticated
  using (owner_id = auth.uid());

drop policy if exists "Owners create their calendar events" on public.pokemon_calendar_events;
create policy "Owners create their calendar events"
  on public.pokemon_calendar_events for insert to authenticated
  with check (owner_id = auth.uid());

drop policy if exists "Owners update their calendar events" on public.pokemon_calendar_events;
create policy "Owners update their calendar events"
  on public.pokemon_calendar_events for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "Owners delete their calendar events" on public.pokemon_calendar_events;
create policy "Owners delete their calendar events"
  on public.pokemon_calendar_events for delete to authenticated
  using (owner_id = auth.uid());

create or replace function public.set_pokemon_calendar_event_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists pokemon_calendar_events_set_updated_at
  on public.pokemon_calendar_events;
create trigger pokemon_calendar_events_set_updated_at
before update on public.pokemon_calendar_events
for each row execute function public.set_pokemon_calendar_event_updated_at();

commit;

notify pgrst, 'reload schema';
