-- Commissioner-approved, time-limited owner support sessions.
-- Access is consumed only by server routes using service_role. It does not
-- make the support user a league member or league staff member.

begin;

create table if not exists public.league_support_grants (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  support_user_id uuid not null references auth.users(id) on delete cascade,
  approved_by uuid not null references auth.users(id) on delete cascade,
  permission text not null default 'read_only' check (permission = 'read_only'),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (expires_at > created_at)
);

create unique index if not exists league_support_grants_one_active_idx
  on public.league_support_grants (league_id, support_user_id)
  where revoked_at is null;
create index if not exists league_support_grants_lookup_idx
  on public.league_support_grants (league_id, expires_at desc);

create table if not exists public.league_support_audit_log (
  id bigint generated always as identity primary key,
  league_id uuid not null references public.leagues(id) on delete cascade,
  grant_id uuid references public.league_support_grants(id) on delete set null,
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  action text not null check (action in ('approved', 'viewed', 'revoked', 'expired')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists league_support_audit_lookup_idx
  on public.league_support_audit_log (league_id, created_at desc);

alter table public.league_support_grants enable row level security;
alter table public.league_support_audit_log enable row level security;
revoke all on public.league_support_grants from public, anon, authenticated;
revoke all on public.league_support_audit_log from public, anon, authenticated;

commit;
