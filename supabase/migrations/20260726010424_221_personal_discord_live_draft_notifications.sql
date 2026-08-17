begin;

-- Older installations restricted notification delivery to league Discord
-- channels and email. Personal messages use their own explicit channel.
alter table public.notification_events
  drop constraint if exists notification_events_channel_check;
alter table public.notification_events
  add constraint notification_events_channel_check
  check (channel in ('email', 'discord', 'discord_dm'));

-- Every personal email draft reminder also receives an independently
-- deliverable Discord DM event when that member opted in.
create or replace function public.queue_personal_discord_draft_reminder()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.channel = 'email'
     and new.kind = 'draft_reminder'
     and new.user_id is not null
     and exists (
       select 1
       from public.discord_user_connections connection
       where connection.user_id = new.user_id
         and connection.dm_enabled
         and connection.notify_draft_reminders
     ) then
    insert into public.notification_events (
      league_id, user_id, kind, channel, dedupe_key, scheduled_for, payload
    )
    values (
      new.league_id,
      new.user_id,
      new.kind,
      'discord_dm',
      'discord-dm:' || new.dedupe_key,
      new.scheduled_for,
      new.payload
    )
    on conflict (dedupe_key) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists queue_personal_discord_draft_reminder
  on public.notification_events;
create trigger queue_personal_discord_draft_reminder
after insert on public.notification_events
for each row execute function public.queue_personal_discord_draft_reminder();

-- Queue a private message whenever an owned team becomes the active snake
-- draft team. The unique key makes retries and server rollovers harmless.
create or replace function public.queue_personal_discord_draft_turn()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_league_name text;
begin
  if new.status <> 'active'
     or new.current_team_id is null
     or (
       tg_op = 'UPDATE'
       and old.current_team_id is not distinct from new.current_team_id
       and old.current_pick_number is not distinct from new.current_pick_number
     ) then
    return new;
  end if;

  select membership.user_id, league.name
  into v_user_id, v_league_name
  from public.teams team
  join public.league_memberships membership
    on membership.id = team.owner_membership_id
  join public.leagues league
    on league.id = team.league_id
  where team.id = new.current_team_id
    and team.league_id = new.league_id;

  if v_user_id is null or not exists (
    select 1
    from public.discord_user_connections connection
    where connection.user_id = v_user_id
      and connection.dm_enabled
      and connection.notify_draft_reminders
  ) then
    return new;
  end if;

  insert into public.notification_events (
    league_id, user_id, kind, channel, dedupe_key, scheduled_for, payload
  )
  values (
    new.league_id,
    v_user_id,
    'draft_turn',
    'discord_dm',
    'discord-dm-turn:' || new.id::text || ':' || new.current_pick_number::text || ':' || new.current_team_id::text,
    now(),
    jsonb_build_object(
      'league_name', v_league_name,
      'draft_session_id', new.id,
      'pick_number', new.current_pick_number,
      'team_id', new.current_team_id
    )
  )
  on conflict (dedupe_key) do nothing;
  return new;
end;
$$;

drop trigger if exists queue_personal_discord_draft_turn
  on public.draft_sessions;
create trigger queue_personal_discord_draft_turn
after insert or update
on public.draft_sessions
for each row execute function public.queue_personal_discord_draft_turn();

-- Backfill reminders already waiting in the queue.
insert into public.notification_events (
  league_id, user_id, kind, channel, dedupe_key, scheduled_for, payload
)
select
  event.league_id,
  event.user_id,
  event.kind,
  'discord_dm',
  'discord-dm:' || event.dedupe_key,
  event.scheduled_for,
  event.payload
from public.notification_events event
join public.discord_user_connections connection
  on connection.user_id = event.user_id
 and connection.dm_enabled
 and connection.notify_draft_reminders
where event.channel = 'email'
  and event.kind = 'draft_reminder'
  and event.sent_at is null
  and event.failed_at is null
on conflict (dedupe_key) do nothing;

-- Queue the current turn for drafts that were already live when this repair
-- was installed.
insert into public.notification_events (
  league_id, user_id, kind, channel, dedupe_key, scheduled_for, payload
)
select
  session.league_id,
  membership.user_id,
  'draft_turn',
  'discord_dm',
  'discord-dm-turn:' || session.id::text || ':' || session.current_pick_number::text || ':' || session.current_team_id::text,
  now(),
  jsonb_build_object(
    'league_name', league.name,
    'draft_session_id', session.id,
    'pick_number', session.current_pick_number,
    'team_id', session.current_team_id
  )
from public.draft_sessions session
join public.teams team
  on team.id = session.current_team_id
join public.league_memberships membership
  on membership.id = team.owner_membership_id
join public.leagues league
  on league.id = session.league_id
join public.discord_user_connections connection
  on connection.user_id = membership.user_id
 and connection.dm_enabled
 and connection.notify_draft_reminders
where session.status = 'active'
  and session.current_team_id is not null
on conflict (dedupe_key) do nothing;

revoke all on function public.queue_personal_discord_draft_reminder()
  from public, anon, authenticated;
revoke all on function public.queue_personal_discord_draft_turn()
  from public, anon, authenticated;

commit;
notify pgrst, 'reload schema';
