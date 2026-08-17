-- Durable Twitch EventSub replay protection. Message IDs are retained briefly
-- and can only be claimed by the service-role webhook route.

begin;

create table if not exists public.twitch_eventsub_messages (
  message_id text primary key,
  message_type text not null,
  broadcaster_id text,
  received_at timestamptz not null default now()
);

alter table public.twitch_eventsub_messages enable row level security;
revoke all on table public.twitch_eventsub_messages from public, anon, authenticated;
grant select, insert, delete on table public.twitch_eventsub_messages to service_role;

create or replace function public.claim_twitch_eventsub_message(
  p_message_id text,
  p_message_type text,
  p_broadcaster_id text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if nullif(trim(p_message_id), '') is null then
    return false;
  end if;
  delete from public.twitch_eventsub_messages where received_at < now() - interval '24 hours';
  insert into public.twitch_eventsub_messages(message_id, message_type, broadcaster_id)
  values (left(p_message_id, 255), left(coalesce(p_message_type, 'unknown'), 100), left(p_broadcaster_id, 255))
  on conflict (message_id) do nothing;
  return found;
end;
$$;

revoke all on function public.claim_twitch_eventsub_message(text, text, text) from public, anon, authenticated;
grant execute on function public.claim_twitch_eventsub_message(text, text, text) to service_role;

commit;
