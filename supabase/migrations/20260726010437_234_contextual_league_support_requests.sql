-- Commissioner-submitted support requests with privacy-safe diagnostics.
begin;
create table if not exists public.league_support_requests (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('setup','pricing','draft','teams','results','notifications','other')),
  message text not null check (char_length(message) between 10 and 2000),
  page_path text not null default '/',
  diagnostics_included boolean not null default false,
  diagnostic_context jsonb not null default '{}'::jsonb check (jsonb_typeof(diagnostic_context) = 'object' and pg_column_size(diagnostic_context) <= 4096),
  status text not null default 'open' check (status in ('open','in_progress','resolved')),
  owner_notified_at timestamptz,
  notification_error text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists league_support_requests_status_idx on public.league_support_requests(status,created_at desc);
create index if not exists league_support_requests_league_idx on public.league_support_requests(league_id,created_at desc);
alter table public.league_support_requests enable row level security;
revoke all on public.league_support_requests from public,anon,authenticated;
commit;
