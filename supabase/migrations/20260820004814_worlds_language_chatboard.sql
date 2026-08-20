-- Language-specific, account-only discussion rooms for Worlds prediction events.
-- Direct table access stays closed; the browser uses the bounded RPC contract below.

create table public.worlds_chat_messages (
  id uuid primary key default gen_random_uuid(),
  event_id text not null references public.worlds_pick_events(id) on delete restrict,
  language_code text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  removed_at timestamptz,
  removed_by uuid references auth.users(id) on delete set null,
  constraint worlds_chat_messages_language_check
    check (language_code in ('en', 'it', 'es', 'de', 'ja', 'ko')),
  constraint worlds_chat_messages_body_check
    check (char_length(btrim(body)) between 1 and 500),
  constraint worlds_chat_messages_removal_check
    check ((removed_at is null and removed_by is null) or removed_at is not null)
);

create index worlds_chat_messages_room_page_idx
  on public.worlds_chat_messages (event_id, language_code, created_at desc, id desc)
  where removed_at is null;

create index worlds_chat_messages_user_rate_idx
  on public.worlds_chat_messages (user_id, created_at desc);

create table public.worlds_chat_reports (
  id bigint generated always as identity primary key,
  message_id uuid not null references public.worlds_chat_messages(id) on delete cascade,
  reporter_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint worlds_chat_reports_one_per_member unique (message_id, reporter_user_id)
);

create index worlds_chat_reports_reporter_idx
  on public.worlds_chat_reports (reporter_user_id, created_at desc);

alter table public.worlds_chat_messages enable row level security;
alter table public.worlds_chat_reports enable row level security;

revoke all on table public.worlds_chat_messages from public, anon, authenticated, service_role;
revoke all on table public.worlds_chat_reports from public, anon, authenticated, service_role;
revoke all on sequence public.worlds_chat_reports_id_seq from public, anon, authenticated, service_role;

grant select, insert, update, delete on table public.worlds_chat_messages to service_role;
grant select, insert, update, delete on table public.worlds_chat_reports to service_role;
grant usage, select on sequence public.worlds_chat_reports_id_seq to service_role;

create or replace function public.get_worlds_chat_messages(
  p_event_id text,
  p_language_code text,
  p_before_created_at timestamptz default null,
  p_before_id uuid default null,
  p_limit integer default 30
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_limit integer := least(greatest(coalesce(p_limit, 30), 1), 50);
  v_payload jsonb;
begin
  if v_user_id is null then
    raise exception 'Sign in to read the Worlds chat.' using errcode = '42501';
  end if;

  if p_language_code is null or p_language_code not in ('en', 'it', 'es', 'de', 'ja', 'ko') then
    raise exception 'Choose a supported Worlds chat language.' using errcode = '22023';
  end if;

  if not exists (select 1 from public.worlds_pick_events where id = p_event_id) then
    raise exception 'This Worlds event is unavailable.' using errcode = '22023';
  end if;

  if (p_before_created_at is null) <> (p_before_id is null) then
    raise exception 'The chat page cursor is incomplete.' using errcode = '22023';
  end if;

  with candidates as (
    select
      message.id,
      message.body,
      message.created_at,
      message.user_id,
      profile.username,
      coalesce(nullif(btrim(profile.display_name), ''), nullif(btrim(profile.username), ''), 'Coach') as display_name,
      profile.avatar_url,
      exists (
        select 1
        from public.worlds_chat_reports report
        where report.message_id = message.id
          and report.reporter_user_id = v_user_id
      ) as reported_by_me,
      row_number() over (order by message.created_at desc, message.id desc) as page_position
    from public.worlds_chat_messages message
    left join public.profiles profile on profile.id = message.user_id
    where message.event_id = p_event_id
      and message.language_code = p_language_code
      and message.removed_at is null
      and (
        p_before_created_at is null
        or (message.created_at, message.id) < (p_before_created_at, p_before_id)
      )
    order by message.created_at desc, message.id desc
    limit v_limit + 1
  ), page as (
    select * from candidates where page_position <= v_limit
  )
  select jsonb_build_object(
    'messages', coalesce(jsonb_agg(jsonb_build_object(
      'id', page.id,
      'body', page.body,
      'created_at', page.created_at,
      'is_mine', page.user_id = v_user_id,
      'username', page.username,
      'display_name', page.display_name,
      'avatar_url', page.avatar_url,
      'reported_by_me', page.reported_by_me
    ) order by page.created_at asc, page.id asc), '[]'::jsonb),
    'has_more', exists (select 1 from candidates where page_position > v_limit)
  )
  into v_payload
  from page;

  return coalesce(v_payload, jsonb_build_object('messages', '[]'::jsonb, 'has_more', false));
end;
$function$;

create or replace function public.create_worlds_chat_message(
  p_event_id text,
  p_language_code text,
  p_body text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_body text := btrim(coalesce(p_body, ''));
  v_message_id uuid;
begin
  if v_user_id is null then
    raise exception 'Sign in to join the Worlds chat.' using errcode = '42501';
  end if;

  if p_language_code is null or p_language_code not in ('en', 'it', 'es', 'de', 'ja', 'ko') then
    raise exception 'Choose a supported Worlds chat language.' using errcode = '22023';
  end if;

  if not exists (select 1 from public.worlds_pick_events where id = p_event_id) then
    raise exception 'This Worlds event is unavailable.' using errcode = '22023';
  end if;

  if char_length(v_body) < 1 or char_length(v_body) > 500 then
    raise exception 'Messages must be between 1 and 500 characters.' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('worlds-chat:' || v_user_id::text, 0));

  if (select count(*) from public.worlds_chat_messages where user_id = v_user_id and created_at > now() - interval '1 minute') >= 5
     or (select count(*) from public.worlds_chat_messages where user_id = v_user_id and created_at > now() - interval '1 day') >= 100 then
    raise exception 'Please wait before posting another message.' using errcode = 'P0001';
  end if;

  insert into public.worlds_chat_messages(event_id, language_code, user_id, body)
  values (p_event_id, p_language_code, v_user_id, v_body)
  returning id into v_message_id;

  return v_message_id;
end;
$function$;

create or replace function public.remove_my_worlds_chat_message(p_message_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception 'Sign in to remove a Worlds chat message.' using errcode = '42501';
  end if;

  update public.worlds_chat_messages
  set removed_at = now(), removed_by = v_user_id
  where id = p_message_id
    and user_id = v_user_id
    and removed_at is null;

  return found;
end;
$function$;

create or replace function public.report_worlds_chat_message(p_message_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception 'Sign in to report a Worlds chat message.' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.worlds_chat_messages
    where id = p_message_id
      and removed_at is null
      and user_id <> v_user_id
  ) then
    raise exception 'This message cannot be reported.' using errcode = '22023';
  end if;

  insert into public.worlds_chat_reports(message_id, reporter_user_id)
  values (p_message_id, v_user_id)
  on conflict (message_id, reporter_user_id) do nothing;

  return true;
end;
$function$;

revoke all on function public.get_worlds_chat_messages(text, text, timestamptz, uuid, integer) from public, anon, authenticated, service_role;
revoke all on function public.create_worlds_chat_message(text, text, text) from public, anon, authenticated, service_role;
revoke all on function public.remove_my_worlds_chat_message(uuid) from public, anon, authenticated, service_role;
revoke all on function public.report_worlds_chat_message(uuid) from public, anon, authenticated, service_role;

grant execute on function public.get_worlds_chat_messages(text, text, timestamptz, uuid, integer) to authenticated, service_role;
grant execute on function public.create_worlds_chat_message(text, text, text) to authenticated, service_role;
grant execute on function public.remove_my_worlds_chat_message(uuid) to authenticated, service_role;
grant execute on function public.report_worlds_chat_message(uuid) to authenticated, service_role;

comment on table public.worlds_chat_messages is 'Account-only Worlds discussion messages separated by event and language.';
comment on table public.worlds_chat_reports is 'One private moderation report per member and Worlds chat message.';
