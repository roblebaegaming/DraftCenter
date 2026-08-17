begin;
create table if not exists public.league_onboarding_deliveries (
  league_id uuid primary key references public.leagues(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  recipient text not null,
  sent_at timestamptz,
  failed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);
alter table public.league_onboarding_deliveries enable row level security;
revoke all on public.league_onboarding_deliveries from public,anon,authenticated;
commit;
