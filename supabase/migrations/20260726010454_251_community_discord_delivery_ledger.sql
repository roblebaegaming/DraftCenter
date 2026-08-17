-- Keep website-community Discord posts separate from operational error records.
-- The primary key makes the claim atomic, so concurrent dispatchers cannot post
-- the same Question of the Day or Daily Three results twice.

begin;

create table if not exists public.community_discord_deliveries (
  delivery_kind text not null check (delivery_kind in (
    'question_of_the_day',
    'daily_three_results'
  )),
  delivery_date date not null,
  channel_id text not null check (
    channel_id ~ '^[0-9]+$'
    and char_length(channel_id) between 15 and 24
  ),
  claimed_at timestamptz not null default now(),
  primary key (delivery_kind, delivery_date)
);

alter table public.community_discord_deliveries enable row level security;
revoke all on table public.community_discord_deliveries
  from public, anon, authenticated;
grant select, insert, delete on table public.community_discord_deliveries
  to service_role;

commit;

notify pgrst, 'reload schema';
