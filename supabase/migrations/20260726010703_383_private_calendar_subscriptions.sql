-- Revocable, read-only calendar feeds. The usable bearer token is returned
-- once and never stored; only its SHA-256 hash is retained server-side.

begin;

create table if not exists public.pokemon_calendar_feed_tokens (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  token_hash text not null unique,
  timezone text not null default 'UTC',
  created_at timestamptz not null default now(),
  rotated_at timestamptz not null default now(),
  constraint pokemon_calendar_feed_token_hash_check
    check (token_hash ~ '^[0-9a-f]{64}$'),
  constraint pokemon_calendar_feed_timezone_check
    check (char_length(btrim(timezone)) between 1 and 80)
);

alter table public.pokemon_calendar_feed_tokens enable row level security;
alter table public.pokemon_calendar_feed_tokens force row level security;

revoke all on table public.pokemon_calendar_feed_tokens from public, anon, authenticated;
grant select, insert, update, delete on table public.pokemon_calendar_feed_tokens to service_role;

comment on table public.pokemon_calendar_feed_tokens is
  'Server-only hashes for revocable private iCalendar subscription URLs.';
comment on column public.pokemon_calendar_feed_tokens.token_hash is
  'SHA-256 hash of the bearer token; the usable token is never stored.';

commit;

notify pgrst, 'reload schema';
