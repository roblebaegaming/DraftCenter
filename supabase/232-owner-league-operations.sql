-- Private owner-operations audit records. Server routes use service_role;
-- league members never receive access to these tables.

begin;

create table if not exists public.owner_notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  dedupe_key text not null unique,
  kind text not null check (kind in ('new_league', 'daily_digest')),
  league_id uuid references public.leagues(id) on delete cascade,
  recipient text not null,
  payload jsonb not null default '{}'::jsonb,
  sent_at timestamptz,
  failed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);

create table if not exists public.league_backup_events (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  backup_type text not null check (backup_type in ('spreadsheet', 'recovery_json')),
  created_at timestamptz not null default now()
);

create index if not exists league_backup_events_league_created_idx
  on public.league_backup_events (league_id, created_at desc);

alter table public.owner_notification_deliveries enable row level security;
alter table public.league_backup_events enable row level security;
revoke all on public.owner_notification_deliveries from public, anon, authenticated;
revoke all on public.league_backup_events from public, anon, authenticated;

commit;
