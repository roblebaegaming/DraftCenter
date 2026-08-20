-- Run only after migration 454 on an isolated Supabase Preview branch.
-- The fixture proves French room access, cross-language isolation, and unchanged
-- RPC-only permissions, then rolls back every test row.

begin;

do $validation$
declare
  v_event_id text := 'preview-worlds-french-chat';
  v_user_id uuid := gen_random_uuid();
  v_message_id uuid;
  v_payload jsonb;
  v_constraint text;
begin
  select pg_catalog.pg_get_constraintdef(constraint_record.oid)
  into v_constraint
  from pg_catalog.pg_constraint constraint_record
  where constraint_record.conrelid = 'public.worlds_chat_messages'::regclass
    and constraint_record.conname = 'worlds_chat_messages_language_check';

  if v_constraint is null or position('fr' in v_constraint) = 0 then
    raise exception 'The Worlds chat constraint does not include French: %', v_constraint;
  end if;

  if has_table_privilege('anon', 'public.worlds_chat_messages', 'select')
     or has_table_privilege('authenticated', 'public.worlds_chat_messages', 'select')
     or not has_function_privilege('authenticated', 'public.get_worlds_chat_messages(text,text,timestamptz,uuid,integer)', 'execute')
     or not has_function_privilege('authenticated', 'public.create_worlds_chat_message(text,text,text)', 'execute')
     or has_function_privilege('anon', 'public.get_worlds_chat_messages(text,text,timestamptz,uuid,integer)', 'execute')
     or has_function_privilege('anon', 'public.create_worlds_chat_message(text,text,text)', 'execute')
     or exists (
       select 1
       from pg_catalog.pg_proc function_record
       join pg_catalog.pg_namespace namespace_record on namespace_record.oid = function_record.pronamespace
       where namespace_record.nspname = 'public'
         and function_record.proname in ('get_worlds_chat_messages', 'create_worlds_chat_message')
         and (
           not function_record.prosecdef
           or not coalesce(function_record.proconfig, array[]::text[]) @> array['search_path=']
         )
     )
     or not (select relrowsecurity from pg_catalog.pg_class where oid = 'public.worlds_chat_messages'::regclass) then
    raise exception 'Migration 454 weakened the account-only Worlds chat boundary.';
  end if;

  insert into auth.users(id, aud, role)
  values (v_user_id, 'authenticated', 'authenticated');

  insert into public.profiles(id, display_name, username)
  values (v_user_id, 'French Chat Preview', 'french-chat-preview');

  insert into public.worlds_pick_events (
    id, display_name, discipline, entry_unit, division, picks_required, status,
    opens_at, locks_at, starts_at, ends_at, bracket_status, roster_source_url,
    roster_checked_at, scoring_rules
  ) values (
    v_event_id, 'French Worlds chat preview', 'vgc', 'individual', 'Masters', 10, 'open',
    now() - interval '1 day', now() + interval '1 day', now() + interval '1 day',
    now() + interval '4 days', 'waiting_for_official_bracket',
    'https://worlds.pokemon.com/en-us', current_date, '{"selection_multiplier":2}'::jsonb
  );

  perform set_config('request.jwt.claim.sub', v_user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_user_id, 'role', 'authenticated')::text, true);

  v_message_id := public.create_worlds_chat_message(v_event_id, 'fr', 'Pronostic de la salle française');
  v_payload := public.get_worlds_chat_messages(v_event_id, 'fr', null, null, 30);

  if jsonb_array_length(v_payload -> 'messages') <> 1
     or v_payload #>> '{messages,0,id}' <> v_message_id::text
     or v_payload #>> '{messages,0,body}' <> 'Pronostic de la salle française'
     or (v_payload #>> '{messages,0,is_mine}')::boolean is not true then
    raise exception 'The French Worlds chat room did not round-trip correctly: %', v_payload;
  end if;

  if jsonb_array_length(public.get_worlds_chat_messages(v_event_id, 'en', null, null, 30) -> 'messages') <> 0 then
    raise exception 'The French Worlds message leaked into the English room.';
  end if;

  begin
    perform public.create_worlds_chat_message(v_event_id, 'pt', 'Unsupported room');
    raise exception 'An unsupported Worlds chat language was accepted.';
  exception
    when sqlstate '22023' then null;
  end;
end;
$validation$;

rollback;
