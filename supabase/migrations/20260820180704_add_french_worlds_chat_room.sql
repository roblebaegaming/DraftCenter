-- Add French to the existing account-only Worlds chat rooms.
-- This forward-only migration preserves the RPC-only table boundary and broadens
-- only the reviewed language allowlist.

alter table public.worlds_chat_messages
  add constraint worlds_chat_messages_language_check_v2
  check (language_code in ('en', 'it', 'es', 'fr', 'de', 'ja', 'ko'))
  not valid;

alter table public.worlds_chat_messages
  validate constraint worlds_chat_messages_language_check_v2;

alter table public.worlds_chat_messages
  drop constraint worlds_chat_messages_language_check;

alter table public.worlds_chat_messages
  rename constraint worlds_chat_messages_language_check_v2
  to worlds_chat_messages_language_check;

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

  if p_language_code is null or p_language_code not in ('en', 'it', 'es', 'fr', 'de', 'ja', 'ko') then
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

  if p_language_code is null or p_language_code not in ('en', 'it', 'es', 'fr', 'de', 'ja', 'ko') then
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

revoke all on function public.get_worlds_chat_messages(text, text, timestamptz, uuid, integer) from public, anon, authenticated, service_role;
revoke all on function public.create_worlds_chat_message(text, text, text) from public, anon, authenticated, service_role;

grant execute on function public.get_worlds_chat_messages(text, text, timestamptz, uuid, integer) to authenticated, service_role;
grant execute on function public.create_worlds_chat_message(text, text, text) to authenticated, service_role;

comment on constraint worlds_chat_messages_language_check on public.worlds_chat_messages
  is 'Reviewed DraftCenter Worlds chat language rooms, including French.';
