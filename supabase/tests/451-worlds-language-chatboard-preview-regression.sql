-- Run only after the Worlds language chatboard and FK-index migrations on an isolated Supabase Preview branch.
-- The fixture proves account-only room separation and moderation ownership, then rolls back.

begin;

do $validation$
declare
  v_event_id text := 'preview-worlds-language-chat';
  v_user_one uuid := gen_random_uuid();
  v_user_two uuid := gen_random_uuid();
  v_message_en uuid;
  v_message_it uuid;
  v_payload jsonb;
begin
  if has_table_privilege('anon', 'public.worlds_chat_messages', 'select')
     or has_table_privilege('authenticated', 'public.worlds_chat_messages', 'select')
     or has_table_privilege('anon', 'public.worlds_chat_reports', 'select')
     or has_table_privilege('authenticated', 'public.worlds_chat_reports', 'select')
     or not has_table_privilege('service_role', 'public.worlds_chat_messages', 'select')
     or not has_table_privilege('service_role', 'public.worlds_chat_reports', 'update')
     or not has_function_privilege('authenticated', 'public.get_worlds_chat_messages(text,text,timestamptz,uuid,integer)', 'execute')
     or not has_function_privilege('authenticated', 'public.create_worlds_chat_message(text,text,text)', 'execute')
     or has_function_privilege('anon', 'public.get_worlds_chat_messages(text,text,timestamptz,uuid,integer)', 'execute')
     or has_function_privilege('anon', 'public.create_worlds_chat_message(text,text,text)', 'execute')
     or exists (
       select 1 from pg_catalog.pg_class relation
       join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace
       where namespace.nspname = 'public'
         and relation.relname in ('worlds_chat_messages', 'worlds_chat_reports')
         and not relation.relrowsecurity
     )
     or exists (
       select 1 from pg_catalog.pg_policies
       where schemaname = 'public'
         and tablename in ('worlds_chat_messages', 'worlds_chat_reports')
     ) then
    raise exception 'The Worlds chat exceeded its RPC-only account boundary.';
  end if;

  if to_regclass('public.worlds_chat_messages_removed_by_idx') is null then
    raise exception 'The Worlds chat moderation actor foreign key is not indexed.';
  end if;

  insert into auth.users(id, aud, role)
  values (v_user_one, 'authenticated', 'authenticated'), (v_user_two, 'authenticated', 'authenticated');

  insert into public.profiles(id, display_name, username, avatar_url)
  values
    (v_user_one, 'Worlds Chat One', 'worlds-chat-one', 'https://example.com/one.png'),
    (v_user_two, 'Worlds Chat Two', 'worlds-chat-two', 'https://example.com/two.png');

  insert into public.worlds_pick_events (
    id, display_name, discipline, entry_unit, division, picks_required, status,
    opens_at, locks_at, starts_at, ends_at, bracket_status, roster_source_url,
    roster_checked_at, scoring_rules
  ) values (
    v_event_id, 'Worlds language chat preview', 'vgc', 'individual', 'Masters', 10, 'open',
    now() - interval '1 day', now() + interval '1 day', now() + interval '1 day',
    now() + interval '4 days', 'waiting_for_official_bracket',
    'https://worlds.pokemon.com/en-us', current_date, '{"selection_multiplier":2}'::jsonb
  );

  perform set_config('request.jwt.claim.sub', v_user_one::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_user_one, 'role', 'authenticated')::text, true);

  v_message_en := public.create_worlds_chat_message(v_event_id, 'en', 'English room prediction');
  v_message_it := public.create_worlds_chat_message(v_event_id, 'it', 'Pronostico della chat italiana');
  v_payload := public.get_worlds_chat_messages(v_event_id, 'en', null, null, 30);

  if jsonb_array_length(v_payload -> 'messages') <> 1
     or v_payload #>> '{messages,0,id}' <> v_message_en::text
     or v_payload #>> '{messages,0,body}' <> 'English room prediction'
     or (v_payload #>> '{messages,0,is_mine}')::boolean is not true then
    raise exception 'Another language room leaked into the English chat: %', v_payload;
  end if;

  if (v_payload #> '{messages,0}') ?| array['user_id','email','timezone','discord_user_id','removed_by'] then
    raise exception 'The chat RPC exposed a private profile or identity field: %', v_payload;
  end if;

  perform set_config('request.jwt.claim.sub', v_user_two::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_user_two, 'role', 'authenticated')::text, true);
  v_payload := public.get_worlds_chat_messages(v_event_id, 'en', null, null, 30);

  if (v_payload #>> '{messages,0,is_mine}')::boolean is not false
     or public.remove_my_worlds_chat_message(v_message_en) then
    raise exception 'A different member removed someone else''s message.';
  end if;

  perform public.report_worlds_chat_message(v_message_en);
  perform public.report_worlds_chat_message(v_message_en);
  if (select count(*) from public.worlds_chat_reports where message_id = v_message_en and reporter_user_id = v_user_two) <> 1 then
    raise exception 'Duplicate moderation reports were not collapsed.';
  end if;

  perform set_config('request.jwt.claim.sub', v_user_one::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_user_one, 'role', 'authenticated')::text, true);
  if not public.remove_my_worlds_chat_message(v_message_en)
     or jsonb_array_length(public.get_worlds_chat_messages(v_event_id, 'en', null, null, 30) -> 'messages') <> 0 then
    raise exception 'The author could not soft-remove their own message.';
  end if;

  if not exists (select 1 from public.worlds_chat_messages where id = v_message_it and language_code = 'it') then
    raise exception 'The Italian room fixture was unexpectedly changed.';
  end if;
end;
$validation$;

rollback;
